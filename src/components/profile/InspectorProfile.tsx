import { useState } from "react";
import { Upload, CheckCircle2, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UploadedDocLink } from "@/components/profile/UploadedDocLink";
import { useAuth, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { ENTITY_TYPE_LABEL, SERVICE_LABEL, inspectorLicenceRequirements } from "@/lib/inspection-licensing";
import { formatDate } from "@/lib/dates";
import { useDeepLinkAction } from "@/lib/deep-link";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";

export function InspectorProfile({ user }: { user: LoqalUser }) {
  const { authUserId } = useAuth();
  const { requests, refresh } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const profile = request?.inspectorProfile;
  const requirements = inspectorLicenceRequirements(profile);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const item = requirements.find((r) => r.key === selected);
  const missing = requirements.filter((r) => !r.provided);
  function open(key: string) { setSelected(key); setFile(null); setConfirm(false); setError(""); }
  useDeepLinkAction("licences", (focus) => {
    const target = requirements.find((r) => r.key === focus) ?? missing[0] ?? requirements[0];
    if (target) open(target.key);
  });

  async function submit() {
    if (!file || !item || !profile || !request || !authUserId || !confirm || busy) return;
    setBusy(true); setError("");
    try {
      const path = `${authUserId}/inspector-licences/${item.key}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("partner-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const uploadedAt = new Date().toISOString();
      const next = { ...profile, coverage: profile.coverage.map((area) => ({ ...area, services: area.services.map((licence) => area.state === item.state && licence.service === item.service ? { ...licence, documents: [...(licence.documents ?? []), { path, name: file.name, uploadedAt }] } : licence) })) };
      const { error: saveError } = await supabase.from("partner_requests").update({ inspector_profile: next } as never).eq("id", request.id);
      if (saveError) throw saveError;
      await refresh();
      notify({ id: `inspector-licence-${request.id}-${item.key}-${uploadedAt}`, to: "admins", title: "Inspection licence copy provided", body: `${request.companyName} — ${item.state}: ${item.label}.`, href: `/admin-people/${encodeURIComponent(request.email)}?open=profile`, severity: "info" });
      setSelected(null); toast.success("Licence copy submitted to Loqal");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit the licence copy. Please try again."); }
    finally { setBusy(false); }
  }

  if (!request || !profile) return <p className="text-sm text-muted-foreground">Inspection company registration details are not available yet.</p>;
  const fields = [
    ["Legal business name", profile.legalName], ["Trading name / DBA", profile.dba],
    ["Entity type", ENTITY_TYPE_LABEL[profile.entityType]], ["EIN / tax ID", profile.ein],
    ["Business address", [request.street, request.city, request.state, request.zip, request.country].filter(Boolean).join(", ")],
    ["Mailing address", profile.mailingSameAsBusiness ? "Same as business address" : profile.mailingAddress ? Object.values(profile.mailingAddress).filter(Boolean).join(", ") : undefined],
    ["Primary contact", `${request.firstName} ${request.lastName}${request.position ? ` · ${request.position}` : ""}`],
    ["Main phone", profile.mainPhone], ["Operations email", profile.operationsEmail], ["Website", profile.website],
    ["Years in operation", String(profile.yearsInOperation)], ["Inspectors", String(profile.inspectorCount)], ["Company languages", profile.companyLanguages.join(", ")],
  ];
  return <div className="space-y-8">
    <section>
      <h2 className="text-lg font-semibold text-foreground">Company profile</h2>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0 border-b border-border pb-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd></div>)}</dl>
    </section>
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Licences & certifications</h2><span className={`text-xs font-semibold ${missing.length ? "text-gold" : "text-success"}`}>{missing.length ? `${missing.length} copies to provide` : "All required copies provided"}</span></div>
      {missing.length ? <div className="mt-3 flex items-start gap-3 border-l-4 border-gold bg-gold-tint p-4"><FileCheck2 className="mt-0.5 size-5 shrink-0 text-gold"/><div><p className="text-sm font-semibold text-foreground">Loqal needs your licence copies</p><p className="mt-1 text-xs text-muted-foreground">Provide a clear copy for each listed service and state, showing the holder, licence number and validity. Copies remain on your company file.</p></div></div> : null}
      <div className="mt-4 divide-y divide-border">{requirements.map((r) => <div key={r.key} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold text-foreground">{r.state} · {r.label}</h3><p className="mt-1 text-xs text-muted-foreground">{r.rule.label}: {r.number || "Not provided"}{r.validUntil ? ` · valid through ${formatDate(r.validUntil)}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{r.rule.note}</p></div><Button size="sm" variant={r.provided ? "outline" : "default"} onClick={() => open(r.key)}><Upload/>{r.provided ? "Add copy" : "Upload copy"}</Button></div>{r.provided ? <p className="mt-2 flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5"/>Copy provided to Loqal</p> : null}<div className="mt-2 flex flex-col gap-1">{r.documents?.map((d) => <UploadedDocLink key={d.path} path={d.path}/>)}</div></div>)}</div>
      {!requirements.length ? <p className="mt-3 text-sm text-muted-foreground">No mandatory licence copies are listed for your registered services. Optional certifications appear here when a number is on file.</p> : null}
    </section>
    <section><h2 className="text-lg font-semibold text-foreground">Coverage & inspection services</h2><div className="mt-3 divide-y divide-border">{profile.coverage.map((a) => <div key={a.state} className="py-3"><h3 className="text-sm font-semibold text-brand">{a.state}</h3><p className="mt-1 text-sm text-foreground">{a.services.map((s) => SERVICE_LABEL[s.service]).join(" · ")}</p></div>)}</div></section>
    <section><h2 className="text-lg font-semibold text-foreground">Inspector team & languages</h2><div className="mt-3 divide-y divide-border">{profile.inspectors.map((p) => <div key={p.id} className="py-3"><p className="text-sm font-semibold text-foreground">{p.firstName} {p.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{p.languages.join(", ") || "Languages not provided"}</p></div>)}</div>{!profile.inspectors.length ? <p className="mt-3 text-sm text-muted-foreground">No individual inspector details on file.</p> : null}</section>
    <Dialog open={Boolean(item)} onOpenChange={(v) => { if (!v && !busy) setSelected(null); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{item?.state} · {item?.label}</DialogTitle><DialogDescription>Upload and confirm your licence or certification copy for Loqal.</DialogDescription></DialogHeader><p className="text-sm text-foreground">{item?.rule.label}: {item?.number || "Not provided"}</p><input aria-label="Licence copy" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={(e) => { const next = e.target.files?.[0]; setConfirm(false); setError(""); if (next && next.size > 20 * 1024 * 1024) { setFile(null); setError("Please choose a file under 20 MB."); } else setFile(next ?? null); }} className="w-full text-sm text-foreground"/>{file ? <p className="break-words text-sm font-medium text-foreground">{file.name}</p> : null}<label className="flex items-start gap-2 text-sm text-foreground"><input type="checkbox" checked={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.checked)} className="mt-1"/>I confirm this copy is correct, authentic and belongs to the registered company or inspector.</label>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button disabled={!file || !confirm || busy || !authUserId} onClick={() => void submit()}><Upload/>{busy ? "Submitting…" : "Confirm & submit copy"}</Button></DialogContent></Dialog>
  </div>;
}