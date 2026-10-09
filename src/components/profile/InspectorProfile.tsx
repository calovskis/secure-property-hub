import { useRef, useState } from "react";
import { Upload, CheckCircle2, FileCheck2, Paperclip, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UploadedDocLink } from "@/components/profile/UploadedDocLink";
import { useAuth, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { ENTITY_TYPE_LABEL, SERVICE_LABEL, licenceRule, inspectorLicenceRequirements, type InspectorProfile as InspectorProfileData } from "@/lib/inspection-licensing";
import { formatDate } from "@/lib/dates";
import { useDeepLinkAction } from "@/lib/deep-link";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";
import { InspectorCoverageFields, inspectorError } from "@/components/partner/InspectorRegistrationFields";
import { US_STATE_CODES, US_STATE_NAME_BY_CODE } from "@/data/us-states";

export function InspectorProfile({ user }: { user: LoqalUser }) {
  const { authUserId } = useAuth();
  const { requests, refresh } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const profile = request?.inspectorProfile;
  const requirements = inspectorLicenceRequirements(profile);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "confirm">("upload");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InspectorProfileData | null>(null);
  const [draftStates, setDraftStates] = useState<string[]>([]);
  const [savingCov, setSavingCov] = useState(false);
  const [covError, setCovError] = useState("");
  const item = requirements.find((r) => r.key === selected);
  const missing = requirements.filter((r) => !r.provided);
  function open(key: string) { setSelected(key); setStep("upload"); setFile(null); setConfirm(false); setError(""); }
  useDeepLinkAction("licences", (focus) => {
    const target = requirements.find((r) => r.key === focus) ?? missing[0] ?? requirements[0];
    if (target) open(target.key);
  });

  async function submit() {
    if (!file || !item || !profile || !request || !authUserId || !confirm || busy) return;
    setBusy(true); setError("");
    try {
      const path = `requests/${request.id}/inspector-licences/${item.key}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("partner-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const uploadedAt = new Date().toISOString();
      const next = { ...profile, coverage: profile.coverage.map((area) => ({ ...area, services: area.services.map((licence) => area.state === item.state && licence.service === item.service ? { ...licence, documents: [...(licence.documents ?? []), { path, name: file.name, uploadedAt }] } : licence) })) };
      const { error: saveError } = await supabase.from("partner_requests").update({ inspector_profile: next } as never).eq("id", request.id);
      if (saveError) throw saveError;
      await refresh();
      notify({ id: `inspector-licence-${request.id}-${item.key}-${uploadedAt}`, to: "admins", title: "Inspection licence copy provided", body: `${request.companyName} — ${item.state}: ${item.label}.`, href: `/admin-people/partner-${request.id}`, severity: "info" });
      setSelected(null); toast.success("Licence copy submitted to Loqal");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit the licence copy. Please try again."); }
    finally { setBusy(false); }
  }

  function startEdit() {
    if (!profile) return;
    const st = profile.coverage.map((c) => c.state);
    setDraftStates(st.length ? st : request?.states ?? []);
    setDraft(structuredClone(profile)); setCovError(""); setEditing(true);
  }
  async function saveCoverage() {
    if (!draft || !request) return;
    if (!draftStates.length) { setCovError("Add at least one state."); return; }
    const err = inspectorError({ ...draft, companyLanguages: draft.companyLanguages.length ? draft.companyLanguages : ["English"] }, draftStates);
    if (err) { setCovError(err); return; }
    setSavingCov(true); setCovError("");
    const next = { ...draft, coverage: draft.coverage.filter((c) => draftStates.includes(c.state)) };
    const { error: e } = await supabase.from("partner_requests").update({ inspector_profile: next, states: draftStates } as never).eq("id", request.id);
    setSavingCov(false);
    if (e) { setCovError(e.message); return; }
    await refresh();
    notify({ id: `inspector-coverage-${request.id}-${Date.now()}`, to: "admins", title: "Inspection services updated", body: `${request.companyName} updated states, services or licences — please verify.`, href: `/admin-people/partner-${request.id}`, severity: "info" });
    setEditing(false); toast.success("Services and licences updated — Loqal will verify the changes");
  }

  if (!request || !profile) return <p className="text-sm text-muted-foreground">Inspection company registration details are not available yet.</p>;
  const companyLanguages = profile.companyLanguages.length ? profile.companyLanguages : request.languages ?? [];
  const fields = [
    ["Legal business name", profile.legalName], ["Trading name / DBA", profile.dba],
    ["Entity type", ENTITY_TYPE_LABEL[profile.entityType]], ["EIN / tax ID", profile.ein],
    ["Business address", [request.street, request.city, request.state, request.zip, request.country].filter(Boolean).join(", ")],
    ["Mailing address", profile.mailingSameAsBusiness ? "Same as business address" : profile.mailingAddress ? Object.values(profile.mailingAddress).filter(Boolean).join(", ") : undefined],
    ["Primary contact", `${request.firstName} ${request.lastName}${request.position ? ` · ${request.position}` : ""}`],
    ["Main phone", profile.mainPhone], ["Operations email", profile.operationsEmail], ["Website", profile.website],
    ["Years in operation", String(profile.yearsInOperation)], ["Inspectors", String(profile.inspectorCount)], ["Company languages", companyLanguages.join(", ")],
  ];
  return <div className="space-y-8">
    <section>
      <h2 className="text-lg font-semibold text-foreground">Company profile</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0 border-b border-border pb-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd></div>)}</dl>
    </section>
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Coverage, services & licences</h2>
        <div className="flex items-center gap-3"><span className={`text-xs font-semibold ${missing.length ? "text-gold" : "text-success"}`}>{missing.length ? `${missing.length} copies to provide` : "All required copies provided"}</span><Button size="sm" variant="outline" onClick={startEdit}><Pencil/>Add or edit</Button></div>
      </div>
      {missing.length ? <div className="mt-3 flex items-start gap-3 border-l-4 border-gold bg-gold-tint p-4"><FileCheck2 className="mt-0.5 size-5 shrink-0 text-gold"/><div><p className="text-sm font-semibold text-foreground">Loqal needs your licence copies</p><p className="mt-1 text-xs text-muted-foreground">Provide a clear copy showing the holder, licence number and validity.</p></div></div> : null}
      <div className="mt-5 space-y-6">
        {profile.coverage.map((area) => <div key={area.state}>
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-3">
            <h3 className="text-sm font-semibold text-brand">{area.state}</h3>
            <span className="text-xs text-muted-foreground">{area.services.length} {area.services.length === 1 ? "service" : "services"}</span>
          </div>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground lg:grid" aria-hidden="true">
            <span>Inspection service</span><span>Licence / certification №</span><span>Valid through</span><span>Licence copy</span>
          </div>
          <div className="divide-y divide-border">
            {area.services.map((service) => {
              const rule = licenceRule(service.service, area.state);
              const requirement = requirements.find((r) => r.key === `${area.state}-${service.service}`);
              return <div key={service.service} className="grid gap-3 px-3 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-4">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1"><h4 className="text-sm font-semibold text-foreground">{SERVICE_LABEL[service.service]}</h4><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.note}</p></div>
                <div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground lg:hidden">Licence / certification №</p><p className="break-words text-sm font-medium text-foreground">{service.number || (rule.required ? "Not provided" : "Not on file")}</p></div>
                <div><p className="mb-1 text-xs text-muted-foreground lg:hidden">Valid through</p><p className="text-sm font-medium text-foreground">{service.validUntil ? formatDate(service.validUntil) : "Not on file"}</p></div>
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  {requirement ? <><p className={`mb-2 flex items-center gap-1 text-xs font-medium ${requirement.provided ? "text-success" : "text-gold"}`}>{requirement.provided ? <CheckCircle2 className="size-3.5 shrink-0"/> : <FileCheck2 className="size-3.5 shrink-0"/>}{requirement.provided ? "Copy provided" : "Copy needed"}</p><Button size="sm" variant="outline" className={requirement.provided ? "text-muted-foreground" : "border-brand/40 bg-brand-tint text-brand hover:bg-brand-tint/70"} onClick={() => open(requirement.key)}><Upload/>{requirement.provided ? "Replace copy" : "Upload copy"}</Button><div className="mt-2 flex flex-col gap-1 break-words">{requirement.documents?.map((d) => <UploadedDocLink key={d.path} path={d.path}/>)}</div></> : <p className="text-xs text-muted-foreground">No mandatory copy required</p>}
                </div>
              </div>;
            })}
          </div>
        </div>)}
        {!profile.coverage.length ? <p className="text-sm text-muted-foreground">No inspection coverage on file.</p> : null}
      </div>
    </section>
    <section><h2 className="text-lg font-semibold text-foreground">Inspector team & languages</h2>
      <div className="mt-3 border-b border-border pb-3"><p className="text-xs text-muted-foreground">Company languages</p><div className="mt-2 flex flex-wrap gap-1.5">{companyLanguages.length ? companyLanguages.map((l) => <span key={l} className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand">{l}</span>) : <span className="text-sm text-muted-foreground">Not provided</span>}</div></div>
      <div className="mt-1 divide-y divide-border">{profile.inspectors.map((p) => <div key={p.id} className="py-3"><p className="text-sm font-semibold text-foreground">{p.firstName} {p.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{p.languages.join(", ") || "Languages not provided"}</p></div>)}</div>{!profile.inspectors.length ? <p className="mt-3 text-sm text-muted-foreground">No individual inspector details on file.</p> : null}</section>
    <Dialog open={editing} onOpenChange={(v) => { if (!savingCov) setEditing(v); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit inspection services & licences</DialogTitle><DialogDescription>Add states, inspection types and licence details. Changes are sent to Loqal for verification.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {draftStates.map((st) => <span key={st} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground">{st}<button type="button" aria-label={`Remove ${st}`} className="text-muted-foreground hover:text-destructive" onClick={() => { setDraftStates(draftStates.filter((s) => s !== st)); setDraft({ ...draft!, coverage: draft!.coverage.filter((c) => c.state !== st) }); }}>×</button></span>)}
            <select value="" onChange={(e) => { const st = e.target.value; if (st && !draftStates.includes(st)) setDraftStates([...draftStates, st]); }} className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground">
              <option value="">+ Add state</option>
              {US_STATE_CODES.filter((s) => !draftStates.includes(s)).map((s) => <option key={s} value={s}>{s} · {US_STATE_NAME_BY_CODE[s]}</option>)}
            </select>
          </div>
          {draft && draftStates.length ? <InspectorCoverageFields states={draftStates} value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })}/> : <p className="text-sm text-muted-foreground">Add at least one state.</p>}
          {covError ? <p role="alert" className="text-xs font-semibold text-destructive">{covError}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={savingCov} onClick={() => setEditing(false)}>Cancel</Button><Button disabled={savingCov} onClick={() => void saveCoverage()}>{savingCov ? "Saving…" : "Save changes"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(item)} onOpenChange={(v) => { if (!v && !busy) setSelected(null); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload your licence copy</DialogTitle>
          <DialogDescription>{item?.state} · {item?.label}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {step === "upload" ? <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item?.state} · {item?.number || "Number not provided"}</p>
                <p className="text-xs text-muted-foreground">Valid until {item?.validUntil ? formatDate(item.validUntil) : "not on file"}</p>
                <p className={`mt-1 text-xs font-semibold ${file ? "text-gold" : item?.provided ? "text-success" : "text-gold"}`}>{file ? "Copy selected · not submitted yet" : item?.provided ? "Copy already on file" : "Copy still needed"}</p>
              </div>
              <input ref={fileInput} aria-label="Licence copy" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} className="hidden" onChange={(e) => {
                const next = e.target.files?.[0];
                setConfirm(false); setError("");
                if (next && next.size > 20 * 1024 * 1024) { setFile(null); setError("Please choose a file under 20 MB."); }
                else setFile(next ?? null);
                e.target.value = "";
              }}/>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="border-dashed" onClick={() => fileInput.current?.click()}><Upload/>{file || item?.provided ? "Change" : "Upload"}</Button>
                {file ? <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setFile(null); setConfirm(false); setError(""); }}><Trash2/>Delete</Button> : null}
              </div>
            </div>
            {file ? <p className="flex items-start gap-2 break-words text-xs font-semibold text-gold"><Paperclip className="size-4 shrink-0"/><span className="min-w-0 break-all">{file.name}</span></p> : null}
            <p className="text-xs text-muted-foreground">PDF or image · up to 20 MB. Nothing is submitted to Loqal until you review and confirm.</p>
          </> : <>
            <div className="rounded-md border border-border bg-background p-3 text-xs text-foreground">
              <p className="font-semibold">{item?.state} · {item?.label}</p>
              <p className="mt-1 text-muted-foreground">{item?.number || "Number not provided"} · Valid until {item?.validUntil ? formatDate(item.validUntil) : "not on file"}</p>
              <p className="mt-2 flex items-start gap-2"><Paperclip className="size-4 shrink-0"/><span className="min-w-0 break-all">{file?.name}</span></p>
            </div>
            <label className="flex items-start gap-2 text-xs text-foreground"><input type="checkbox" checked={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5"/>I confirm this copy matches the licence number and validity date on file, is authentic and belongs to the registered company or inspector.</label>
          </>}
          {error ? <p role="alert" className="text-xs font-semibold text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => { if (step === "confirm") { setStep("upload"); setConfirm(false); setError(""); } else setSelected(null); }}>{step === "confirm" ? "Back" : "Cancel"}</Button>
            {step === "upload" ? <Button disabled={!file} onClick={() => { setStep("confirm"); setError(""); }}>Review &amp; submit</Button> : <Button disabled={!file || !confirm || busy || !authUserId} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit copy"}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>

  </div>;
}