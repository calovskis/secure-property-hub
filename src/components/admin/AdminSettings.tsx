/**
 * Platform settings: the Loqal superadmin manages the employee roster and the
 * per-section access matrix (hidden / view / change / confirm). Changes save
 * immediately and are recorded in the activity log.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  ACCESS_LABEL,
  ACCESS_LEVELS,
  ADMIN_SECTION_LABEL,
  accessOf,
  useStaff,
  type AccessLevel,
  type AdminSectionId,
} from "@/lib/staff";
import { logActivity } from "@/lib/activity";

const SECTIONS = Object.keys(ADMIN_SECTION_LABEL) as AdminSectionId[];

const LEVEL_CLS: Record<AccessLevel, string> = {
  hidden: "text-muted-foreground",
  view: "text-brand",
  edit: "text-gold",
  approve: "text-success",
};

export function AdminSettings() {
  const { members, setAccess, addMember } = useStaff();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");

  function change(memberId: string, memberName: string, section: AdminSectionId, level: AccessLevel) {
    setAccess(memberId, section, level);
    logActivity(
      "Loqal superadmin",
      "changed platform access",
      `${memberName} · ${ADMIN_SECTION_LABEL[section]} → ${ACCESS_LABEL[level]}`,
    );
  }

  function add() {
    if (!name.trim() || !email.trim()) return;
    addMember({ name: name.trim(), email: email.trim(), title: title.trim() || "Employee" });
    logActivity("Loqal superadmin", "added an employee", name.trim());
    toast("Employee added", { description: `${name.trim()} — default access: view Home only.` });
    setName("");
    setEmail("");
    setTitle("");
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Loqal employees</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Who works at Loqal and what they may see, change and confirm in the admin console.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
          >
            {adding ? "Close" : "+ Add employee"}
          </button>
        </div>

        {adding ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name *"
              aria-label="Full name"
              className="rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail *"
              aria-label="E-mail"
              className="rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title"
              aria-label="Job title"
              className="rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={add}
              disabled={!name.trim() || !email.trim()}
              className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Employee</th>
                {SECTIONS.map((s) => (
                  <th key={s} className="py-2 pr-2 font-semibold">
                    {ADMIN_SECTION_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold text-foreground">
                      {m.name}
                      {m.superadmin ? (
                        <span className="ml-2 rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold text-gold">
                          Superadmin
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.title} · {m.email}
                    </div>
                  </td>
                  {SECTIONS.map((s) => {
                    const level = accessOf(m, s);
                    return (
                      <td key={s} className="py-2.5 pr-2">
                        {m.superadmin ? (
                          <span className={`text-xs font-semibold ${LEVEL_CLS.approve}`}>
                            Full
                          </span>
                        ) : (
                          <select
                            value={level}
                            onChange={(e) => change(m.id, m.name, s, e.target.value as AccessLevel)}
                            aria-label={`${m.name} — ${ADMIN_SECTION_LABEL[s]}`}
                            className={`rounded-md border border-border bg-background px-1.5 py-1 text-[11px] font-semibold outline-none focus:border-brand ${LEVEL_CLS[level]}`}
                          >
                            {ACCESS_LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {ACCESS_LABEL[l]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Access levels are cumulative: “View & change” includes viewing, “View, change & confirm”
          additionally allows approvals (partner approvals, countersignatures, invoice
          confirmation). Superadmins always have full access.
        </p>
      </section>
    </div>
  );
}
