/**
 * People directory for the Loqal admin: every client (from platform files)
 * and every partner account in one list. Admins can correct profile data and
 * jump straight into a written conversation with the person.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PARTNER_LABEL } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useDirectory } from "@/lib/directory";
import { logActivity } from "@/lib/activity";
import { formatDate } from "@/lib/dates";

export type DirectoryPerson = {
  email: string;
  name: string;
  role: string;
  phone?: string | undefined;
  company?: string | undefined;
  since: string;
  /** Source of truth for edits. */
  source: "client" | "partner";
  requestId?: string;
  note?: string | undefined;
};

export function AdminPeople({
  onMessage,
}: {
  onMessage: (person: { email: string; name: string; role: string }) => void;
}) {
  const { leads } = useLeads();
  const { requests, updateRequest } = usePartnerRequests();
  const { overrides, setOverride } = useDirectory();
  const [editing, setEditing] = useState<DirectoryPerson | null>(null);

  const people = useMemo<DirectoryPerson[]>(() => {
    const out: DirectoryPerson[] = [];
    const seenClients = new Set<string>();
    for (const l of leads) {
      const key = l.clientEmail.toLowerCase();
      if (seenClients.has(key)) continue;
      seenClients.add(key);
      const o = overrides[key];
      out.push({
        email: l.clientEmail,
        name: o?.displayName ?? l.clientName,
        role: "Client",
        phone: o?.phone,
        since: l.submittedAt,
        source: "client",
        note: o?.note,
      });
    }
    for (const r of requests) {
      const key = r.email.toLowerCase();
      const o = overrides[key];
      out.push({
        email: r.email,
        name: o?.displayName ?? `${r.firstName} ${r.lastName}`,
        role:
          r.kind === "corporate"
            ? "Corporate client"
            : `Partner · ${PARTNER_LABEL[r.partnerType ?? "other"]}`,
        phone: o?.phone ?? r.phone,
        company: o?.company ?? r.companyName,
        since: r.submittedAt,
        source: "partner",
        requestId: r.id,
        note: o?.note,
      });
    }
    return out.sort((a, b) => b.since.localeCompare(a.since));
  }, [leads, requests, overrides]);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Clients & partners</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Edit profile data or open a written conversation — messages land in the person's support
        chat instantly.
      </p>
      {people.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No accounts on the platform yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 pr-4 font-semibold">Contact</th>
                <th className="py-2 pr-4 font-semibold">On platform since</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((p) => (
                <tr key={`${p.source}-${p.email}`}>
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold text-foreground">{p.name}</div>
                    {p.company ? (
                      <div className="text-xs text-muted-foreground">{p.company}</div>
                    ) : null}
                    {p.note ? (
                      <div className="mt-0.5 text-xs italic text-gold">📝 {p.note}</div>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{p.role}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    <div>{p.email}</div>
                    {p.phone ? <div className="text-xs">{p.phone}</div> : null}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(p.since)}</td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                      >
                        Edit profile
                      </button>
                      <button
                        type="button"
                        onClick={() => onMessage({ email: p.email, name: p.name, role: p.role })}
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

      {editing ? (
        <EditPersonDialog
          person={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            setOverride(editing.email, {
              displayName: patch.name,
              phone: patch.phone,
              company: patch.company,
              note: patch.note,
            });
            if (editing.source === "partner" && editing.requestId) {
              const [firstName, ...rest] = patch.name.trim().split(/\s+/);
              updateRequest(editing.requestId, {
                firstName: firstName || editing.name,
                lastName: rest.join(" "),
                ...(patch.phone ? { phone: patch.phone } : {}),
                ...(patch.company ? { companyName: patch.company } : {}),
              });
            }
            logActivity("Loqal admin", "edited a profile", `${editing.name} (${editing.email})`);
            toast("Profile updated", { description: patch.name });
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function EditPersonDialog({
  person,
  onClose,
  onSave,
}: {
  person: DirectoryPerson;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    phone?: string | undefined;
    company?: string | undefined;
    note?: string | undefined;
  }) => void;
}) {
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone ?? "");
  const [company, setCompany] = useState(person.company ?? "");
  const [note, setNote] = useState(person.note ?? "");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${person.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-foreground">Edit profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {person.role} · {person.email}. Changes apply platform-wide immediately.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>
          {person.source === "partner" ? (
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </Field>
          ) : null}
          <Field label="Internal note (Loqal only)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                phone: phone.trim() || undefined,
                company: company.trim() || undefined,
                note: note.trim() || undefined,
              })
            }
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
