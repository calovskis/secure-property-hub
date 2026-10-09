/**
 * Inspection-company sections of the partner registration: company identity,
 * team & languages, and per-state services with the licence each one needs.
 */
import { AddressFields } from "@/components/form/AddressFields";
import { DateInput } from "@/components/form/DateInput";
import { LanguageMultiSelect } from "@/components/form/LanguageMultiSelect";
import { PhoneField } from "@/components/form/PhoneField";
import { US_STATE_NAME_BY_CODE } from "@/data/us-states";
import {
  ENTITY_TYPE_LABEL,
  INSPECTION_SERVICES,
  licenceRule,
  type InspectionServiceId,
  type InspectorProfile,
} from "@/lib/inspection-licensing";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required ? <span className="text-destructive">*</span> : "(optional)"}
    </span>
  );
}

export const EMPTY_INSPECTOR: InspectorProfile = {
  legalName: "",
  entityType: "llc",
  mailingSameAsBusiness: true,
  mainPhone: "",
  operationsEmail: "",
  yearsInOperation: 0,
  inspectorCount: 1,
  companyLanguages: [],
  inspectors: [],
  coverage: [],
};

/** Identity block shown under Company information. */
export function InspectorIdentityFields({ value, onChange, phoneTouched }: {
  value: InspectorProfile; onChange: (patch: Partial<InspectorProfile>) => void; phoneTouched: boolean;
}) {
  const solo = value.entityType === "sole_proprietor";
  return (
    <div className="space-y-4 rounded-lg border border-brand/30 bg-brand-tint/30 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <Label>DBA / trading name</Label>
          <input value={value.dba ?? ""} onChange={(e) => onChange({ dba: e.target.value })} placeholder="If you trade under another name" className={inputClass} />
        </label>
        <label>
          <Label required>Entity type</Label>
          <select value={value.entityType} onChange={(e) => onChange({ entityType: e.target.value as InspectorProfile["entityType"] })} className={inputClass}>
            {(Object.keys(ENTITY_TYPE_LABEL) as InspectorProfile["entityType"][]).map((k) => (
              <option key={k} value={k}>{ENTITY_TYPE_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <label>
          <Label required={!solo}>EIN / tax ID</Label>
          <input value={value.ein ?? ""} onChange={(e) => onChange({ ein: e.target.value })} placeholder="12-3456789" className={inputClass} />
          {solo ? <span className="mt-1 block text-[11px] text-muted-foreground">Solo inspectors without an EIN can leave this empty — we'll ask for a W-9 later.</span> : null}
        </label>
        <label>
          <Label>Website</Label>
          <input value={value.website ?? ""} onChange={(e) => onChange({ website: e.target.value })} placeholder="https://" className={inputClass} />
        </label>
        <label>
          <Label required>Main phone number</Label>
          <PhoneField value={value.mainPhone} onChange={(v) => onChange({ mainPhone: v })} showError={phoneTouched} />
        </label>
        <label>
          <Label required>Operations e-mail</Label>
          <input type="email" value={value.operationsEmail} onChange={(e) => onChange({ operationsEmail: e.target.value })} placeholder="bookings@company.com" className={inputClass} />
        </label>
        <label>
          <Label required>Years in operation</Label>
          <input type="number" min={0} value={value.yearsInOperation || ""} onChange={(e) => onChange({ yearsInOperation: Math.max(0, Number(e.target.value)) })} className={inputClass} />
        </label>
        <label>
          <Label required>Number of inspectors</Label>
          <input type="number" min={1} value={solo ? 1 : value.inspectorCount || ""} disabled={solo} onChange={(e) => onChange({ inspectorCount: Math.max(1, Number(e.target.value)) })} className={inputClass} />
        </label>
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={value.mailingSameAsBusiness} onChange={(e) => onChange({ mailingSameAsBusiness: e.target.checked })} />
          Mailing address is the same as the business address
        </label>
        {!value.mailingSameAsBusiness ? (
          <div className="mt-3">
            <Label required>Mailing address</Label>
            <AddressFields
              value={value.mailingAddress ?? { country: "US", state: "", city: "", street: "", zip: "" }}
              streetPlaceholder="Street, number or PO Box"
              onChange={(patch) => onChange({ mailingAddress: { ...(value.mailingAddress ?? { country: "US", state: "", city: "", street: "", zip: "" }), ...patch } })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Team & languages block. */
export function InspectorTeamFields({ value, onChange, contactName }: {
  value: InspectorProfile; onChange: (patch: Partial<InspectorProfile>) => void; contactName: string;
}) {
  const solo = value.entityType === "sole_proprietor";
  const setPerson = (id: string, patch: Partial<InspectorProfile["inspectors"][number]>) =>
    onChange({ inspectors: value.inspectors.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  return (
    <div className="space-y-4">
      <div>
        <Label required>{solo ? "Languages you inspect in" : "Languages spoken by the company"}</Label>
        <LanguageMultiSelect values={value.companyLanguages} onChange={(v) => onChange({ companyLanguages: v })} />
        <p className="mt-1.5 text-[11px] text-muted-foreground">Foreign buyers are matched to inspectors who can walk them through the report in their language.</p>
      </div>
      {!solo ? (
        <div className="space-y-3 rounded-lg border border-border bg-brand-tint/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspectors (optional)</span>
            <button type="button" onClick={() => onChange({ inspectors: [...value.inspectors, { id: Math.random().toString(36).slice(2, 10), firstName: "", lastName: "", languages: [] }] })} className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-brand-tint">
              + Add inspector
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">List the people who carry out inspections and the languages each speaks{contactName ? ` — ${contactName} is already the primary contact` : ""}.</p>
          {value.inspectors.map((p) => (
            <div key={p.id} className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input value={p.firstName} onChange={(e) => setPerson(p.id, { firstName: e.target.value })} placeholder="First name" className={inputClass} />
              <input value={p.lastName} onChange={(e) => setPerson(p.id, { lastName: e.target.value })} placeholder="Last name" className={inputClass} />
              <button type="button" onClick={() => onChange({ inspectors: value.inspectors.filter((x) => x.id !== p.id) })} className="text-xs font-semibold text-destructive hover:underline">Remove</button>
              <div className="sm:col-span-3">
                <LanguageMultiSelect values={p.languages} onChange={(v) => setPerson(p.id, { languages: v })} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Per-state services and the licence each one needs there. */
export function InspectorCoverageFields({ states, value, onChange }: {
  states: string[]; value: InspectorProfile; onChange: (patch: Partial<InspectorProfile>) => void;
}) {
  const cov = (st: string) => value.coverage.find((c) => c.state === st) ?? { state: st, services: [] };
  const saveState = (st: string, services: InspectorProfile["coverage"][number]["services"]) =>
    onChange({ coverage: [...value.coverage.filter((c) => c.state !== st && states.includes(c.state)), { state: st, services }] });
  const copyFirst = () => {
    const first = cov(states[0]!);
    onChange({ coverage: states.map((st) => (st === states[0] ? first : { state: st, services: first.services.map((s) => ({ service: s.service, number: "", validUntil: "" })) })) });
  };
  return (
    <div className="space-y-3 rounded-lg border border-border bg-brand-tint/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspections you provide per state</span>
        {states.length > 1 ? <button type="button" onClick={copyFirst} className="text-xs font-semibold text-brand hover:underline">Copy {states[0]} services to all states</button> : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Licensing is set per state and per inspection type. Tick what you offer — we show which licence that state needs. Required licences need a number and validity; we remind you 30 and 15 days before one expires.
      </p>
      {states.map((st) => {
        const c = cov(st);
        return (
          <details key={st} open={states.length <= 3} className="rounded-md border border-border bg-background">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-foreground">
              <span>{st} · {US_STATE_NAME_BY_CODE[st] ?? st}</span>
              <span className="text-xs font-normal text-muted-foreground">{c.services.length ? `${c.services.length} selected` : "Nothing selected yet"}</span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {INSPECTION_SERVICES.map((svc) => {
                const sel = c.services.find((s) => s.service === svc.id);
                const rule = licenceRule(svc.id, st);
                const toggle = () =>
                  saveState(st, sel ? c.services.filter((s) => s.service !== svc.id) : [...c.services, { service: svc.id as InspectionServiceId, number: "", validUntil: "" }]);
                const setLic = (patch: { number?: string; validUntil?: string }) =>
                  saveState(st, c.services.map((s) => (s.service === svc.id ? { ...s, ...patch } : s)));
                return (
                  <li key={svc.id} className={sel ? "bg-brand-tint/30" : ""}>
                    <label className="flex cursor-pointer items-start gap-2 px-3 py-2">
                      <input type="checkbox" checked={Boolean(sel)} onChange={toggle} className="mt-1" />
                      <span className="flex-1">
                        <span className="block text-sm text-foreground">{svc.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{svc.hint}</span>
                      </span>
                      {rule.required ? <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold text-gold">Licence required</span> : null}
                    </label>
                    {sel ? (
                      <div className="grid grid-cols-1 gap-3 px-3 pb-3 pl-8 sm:grid-cols-2">
                        <p className="text-[11px] text-muted-foreground sm:col-span-2">{rule.note}</p>
                        <label>
                          <Label required={rule.required}>{rule.label}</Label>
                          <input value={sel.number} onChange={(e) => setLic({ number: e.target.value })} className={inputClass} />
                        </label>
                        <label>
                          <Label required={rule.required}>Valid until</Label>
                          <DateInput value={sel.validUntil} onChange={(v) => setLic({ validUntil: v })} className={inputClass} />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

/** First problem with the inspector-specific answers, or null. */
export function inspectorError(v: InspectorProfile, states: string[]): string | null {
  if (v.entityType !== "sole_proprietor" && !v.ein?.trim()) return "Enter the company EIN / tax ID.";
  if (!v.mainPhone) return "The main phone number is required.";
  if (!/^\S+@\S+\.\S+$/.test(v.operationsEmail.trim())) return "Enter a valid operations e-mail.";
  if (!v.mailingSameAsBusiness && (!v.mailingAddress?.street.trim() || !v.mailingAddress.city.trim() || !v.mailingAddress.zip.trim()))
    return "Complete the mailing address, or tick that it is the same as the business address.";
  if (v.entityType !== "sole_proprietor" && v.inspectorCount < 1) return "Enter the number of inspectors.";
  if (v.companyLanguages.length === 0) return "Select at least one language.";
  for (const st of states) {
    const c = v.coverage.find((x) => x.state === st);
    if (!c?.services.length) return `Select the inspections you provide in ${st}.`;
    for (const s of c.services) {
      const rule = licenceRule(s.service, st);
      if (rule.required && (!s.number.trim() || !s.validUntil))
        return `${st}: enter the ${rule.label.replace(/ №$/, "").toLowerCase()} and its validity for ${INSPECTION_SERVICES.find((x) => x.id === s.service)?.label.toLowerCase()}.`;
    }
  }
  return null;
}
