/**
 * Partner account header — the single place where a partner's name, email and
 * company appear in My Profile. Name, surname and company name are printed on
 * the Loqal partnership agreement, so a change to any of them is submitted as
 * a request and only takes effect once a Loqal admin approves it.
 */
import { useState } from "react";
import { toast } from "sonner";
import { PARTNER_LABEL, fullName, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type ProfileChangeRequest } from "@/lib/partner-requests";
import { uid } from "@/lib/mortgage-form";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

export function PartnerAccountCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  const currentFirst = request?.firstName || user.firstName;
  const currentLast = request?.lastName || user.lastName;
  const currentCompany = request?.companyName || user.companyName || "";

  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    companyName: string;
  } | null>(null);

  const changes = request?.profileChangeRequests ?? [];
  const pending = changes.filter((c) => c.status === "pending");

  function submit() {
    if (!request || !form) return;
    const fields: { field: ProfileChangeRequest["field"]; label: string; current: string; next: string }[] = [
      { field: "firstName", label: "First name", current: currentFirst, next: form.firstName.trim() },
      { field: "lastName", label: "Last name", current: currentLast, next: form.lastName.trim() },
      { field: "companyName", label: "Company name", current: currentCompany, next: form.companyName.trim() },
    ];
    const asked = fields
      .filter((f) => f.next && f.next !== f.current)
      .map<ProfileChangeRequest>((f) => ({
        id: uid(),
        field: f.field,
        label: f.label,
        currentValue: f.current,
        requestedValue: f.next,
        requestedAt: new Date().toISOString(),
        status: "pending",
      }));
    if (!asked.length) {
      setForm(null);
      return;
    }
    updateRequest(request.id, { profileChangeRequests: [...changes, ...asked] });
    logActivity(
      fullName(user),
      "requested a change to their registered name or company",
      asked.map((a) => `${a.label}: ${a.currentValue} → ${a.requestedValue}`).join(", "),
    );
    toast("Change request sent to Loqal", {
      description: "A Loqal admin reviews it before it appears on your agreement.",
    });
    setForm(null);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Account details</h2>
        {request ? (
          form ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Send change request
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setForm({
                  firstName: currentFirst,
                  lastName: currentLast,
                  companyName: currentCompany,
                })
              }
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
            >
              Edit name / company
            </button>
          )
        ) : null}
      </div>

      {form ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>First name</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Last name</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Company name</span>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Name, surname and company name appear on your Loqal partnership agreement — a Loqal
            admin approves the change before it takes effect.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <Row label="Full name" value={`${currentFirst} ${currentLast}`.trim()} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={request?.phone || user.phone} />
          <Row label="Company" value={currentCompany} />
          <Row
            label="Partner type"
            value={user.partnerType ? PARTNER_LABEL[user.partnerType] : undefined}
          />
        </div>
      )}

      {changes.length ? (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Change requests {pending.length ? `· ${pending.length} awaiting Loqal` : ""}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {changes
              .slice()
              .reverse()
              .map((c) => (
                <li key={c.id} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.label}</span>:{" "}
                  {c.currentValue || "—"} → {c.requestedValue} ·{" "}
                  <span
                    className={
                      c.status === "approved"
                        ? "font-semibold text-success"
                        : c.status === "declined"
                          ? "font-semibold text-destructive"
                          : "font-semibold text-gold"
                    }
                  >
                    {c.status === "pending" ? "Awaiting approval" : c.status === "approved" ? "Approved" : "Declined"}
                  </span>{" "}
                  · requested {formatDateTime(c.requestedAt)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
