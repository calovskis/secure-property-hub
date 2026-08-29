/**
 * People directory for the Loqal admin console.
 *
 * Scopes: All / Clients (individual, corporate) / Partners (per category).
 * Each scope gets its own set of relevant filters, and every row opens the
 * full profile: registration & personal data, uploaded documents, property
 * files, activity history and engagement metrics.
 */
import { useMemo, useState } from "react";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PersonDetail } from "@/components/admin/PersonDetail";
import {
  CLIENT_SUBS,
  PARTNER_SUBS,
  coverageStates,
  useAdminPeople,
  type AdminPerson,
  type PeopleScope,
} from "@/components/admin/people-model";
import type { PartnerType } from "@/lib/auth";

type Filters = {
  q: string;
  /** all scope */
  role: "" | "individual" | "corporate" | "partner";
  /** clients */
  usStatus: "" | "us" | "non_us";
  fileStatus: "" | LeadStatus | "none";
  /** partners */
  regStatus: "" | "pending" | "approved" | "declined";
  agreement: "" | "signed" | "unsigned";
  language: string;
  /** shared */
  state: string;
  online: "" | "7d" | "30d" | "never";
};

const EMPTY: Filters = {
  q: "",
  role: "",
  usStatus: "",
  fileStatus: "",
  regStatus: "",
  agreement: "",
  language: "",
  state: "",
  online: "",
};

export function AdminPeople({
  scope,
  onMessage,
}: {
  scope: PeopleScope;
  onMessage: (person: { email: string; name: string; role: string }) => void;
}) {
  const all = useAdminPeople();
  const [sub, setSub] = useState<string>("all");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState<AdminPerson | null>(null);

  // Reset sub-tab when the scope changes.
  const subs =
    scope === "clients" ? CLIENT_SUBS : scope === "partners" ? PARTNER_SUBS : undefined;
  const activeSub = subs?.some((s) => s.id === sub) ? sub : "all";

  const scoped = useMemo(() => {
    let list = all;
    if (scope === "clients") list = list.filter((p) => p.group !== "partner");
    if (scope === "partners") list = list.filter((p) => p.group === "partner");
    if (scope === "clients" && activeSub !== "all")
      list = list.filter((p) => p.group === activeSub);
    if (scope === "partners" && activeSub !== "all")
      list = list.filter((p) => p.partnerType === (activeSub as PartnerType));
    return list;
  }, [all, scope, activeSub]);

  const states = useMemo(
    () => [...new Set(scoped.flatMap(coverageStates).filter((s) => s && s !== "ALL"))].sort(),
    [scoped],
  );
  const languages = useMemo(
    () => [...new Set(scoped.flatMap((p) => p.languages ?? []))].sort(),
    [scoped],
  );

  const people = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const now = Date.now();
    return scoped.filter((p) => {
      if (
        q &&
        ![p.name, p.email, p.company ?? "", p.phone ?? ""].some((v) => v.toLowerCase().includes(q))
      )
        return false;
      if (scope === "all" && filters.role && p.group !== filters.role) return false;

      if (scope !== "partners") {
        if (filters.usStatus === "us" && p.usPerson !== true) return false;
        if (filters.usStatus === "non_us" && p.usPerson !== false) return false;
        if (filters.fileStatus === "none" && p.leads.length) return false;
        if (
          filters.fileStatus &&
          filters.fileStatus !== "none" &&
          !p.leads.some((l) => l.status === filters.fileStatus)
        )
          return false;
      }

      if (scope !== "clients") {
        if (filters.regStatus && p.request && p.request.status !== filters.regStatus) return false;
        if (filters.regStatus && !p.request) return false;
        if (filters.agreement === "signed" && !p.request?.agreementSignedAt) return false;
        if (filters.agreement === "unsigned" && p.request?.agreementSignedAt) return false;
        if (filters.language && !(p.languages ?? []).includes(filters.language)) return false;
      }

      if (filters.state) {
        const cov = coverageStates(p);
        if (!cov.includes(filters.state) && !cov.includes("ALL")) return false;
      }

      if (filters.online) {
        const last = p.lastSeen ? new Date(p.lastSeen).getTime() : 0;
        if (filters.online === "never" && last) return false;
        if (filters.online === "7d" && now - last > 7 * 86_400_000) return false;
        if (filters.online === "30d" && now - last > 30 * 86_400_000) return false;
      }
      return true;
    });
  }, [scoped, filters, scope]);

  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {scope === "clients" ? "Clients" : scope === "partners" ? "Partners" : "All people"}
        </h2>
        <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
          {people.length} of {scoped.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Open any profile to review and edit the full registration and personal data, uploaded
        documents, property files, activity history and engagement metrics.
      </p>

      {subs ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {subs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSub(s.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeSub === s.id
                  ? "bg-brand-tint text-brand"
                  : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Scope-aware filters */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <FilterBox label="Search">
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Name, e-mail, company, phone"
            className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </FilterBox>

        {scope === "all" ? (
          <FilterBox label="Type">
            <Select
              value={filters.role}
              onChange={(v) => set({ role: v as Filters["role"] })}
              options={[
                ["", "Everyone"],
                ["individual", "Individual clients"],
                ["corporate", "Corporate clients"],
                ["partner", "Partners"],
              ]}
            />
          </FilterBox>
        ) : null}

        {scope !== "partners" ? (
          <>
            <FilterBox label="US status">
              <Select
                value={filters.usStatus}
                onChange={(v) => set({ usStatus: v as Filters["usStatus"] })}
                options={[
                  ["", "Any"],
                  ["us", "US person"],
                  ["non_us", "Non-US"],
                ]}
              />
            </FilterBox>
            <FilterBox label="Mortgage file">
              <Select
                value={filters.fileStatus}
                onChange={(v) => set({ fileStatus: v as Filters["fileStatus"] })}
                options={[
                  ["", "Any"],
                  ["none", "No application"],
                  ...(Object.entries(LEAD_STATUS_LABEL) as [string, string][]),
                ]}
              />
            </FilterBox>
          </>
        ) : null}

        {scope !== "clients" ? (
          <>
            <FilterBox label="Registration">
              <Select
                value={filters.regStatus}
                onChange={(v) => set({ regStatus: v as Filters["regStatus"] })}
                options={[
                  ["", "Any"],
                  ["pending", "Pending"],
                  ["approved", "Approved"],
                  ["declined", "Declined"],
                ]}
              />
            </FilterBox>
            <FilterBox label="Agreement">
              <Select
                value={filters.agreement}
                onChange={(v) => set({ agreement: v as Filters["agreement"] })}
                options={[
                  ["", "Any"],
                  ["signed", "Signed"],
                  ["unsigned", "Not signed"],
                ]}
              />
            </FilterBox>
            {languages.length ? (
              <FilterBox label="Language">
                <Select
                  value={filters.language}
                  onChange={(v) => set({ language: v })}
                  options={[["", "Any"], ...languages.map((l) => [l, l] as [string, string])]}
                />
              </FilterBox>
            ) : null}
          </>
        ) : null}

        {states.length ? (
          <FilterBox label={scope === "partners" ? "Licensed state" : "State"}>
            <Select
              value={filters.state}
              onChange={(v) => set({ state: v })}
              options={[["", "Any"], ...states.map((s) => [s, s] as [string, string])]}
            />
          </FilterBox>
        ) : null}

        <FilterBox label="Last online">
          <Select
            value={filters.online}
            onChange={(v) => set({ online: v as Filters["online"] })}
            options={[
              ["", "Any"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
              ["never", "Never online"],
            ]}
          />
        </FilterBox>

        <button
          type="button"
          onClick={() => setFilters(EMPTY)}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {people.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No profiles match these filters.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 pr-4 font-semibold">Contact</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">On platform since</th>
                <th className="py-2 pr-4 font-semibold">Last online</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((p) => (
                <tr key={p.key}>
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold text-foreground">{p.name}</div>
                    {p.company ? (
                      <div className="text-xs text-muted-foreground">{p.company}</div>
                    ) : null}
                    {p.note ? (
                      <div className="mt-0.5 text-xs italic text-gold">📝 {p.note}</div>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{p.roleLabel}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    <div>{p.email}</div>
                    {p.phone ? <div className="text-xs">{p.phone}</div> : null}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {p.request
                      ? p.request.status
                      : (LEAD_STATUS_LABEL[p.status as LeadStatus] ?? p.status)}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(p.since)}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {p.lastSeen ? formatDateTime(p.lastSeen) : "—"}
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpen(p)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                      >
                        Open profile
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMessage({ email: p.email, name: p.name, role: p.roleLabel })
                        }
                        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                      >
                        Message
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <PersonDetail person={open} onClose={() => setOpen(null)} onMessage={onMessage} />
      ) : null}
    </section>
  );
}

function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
