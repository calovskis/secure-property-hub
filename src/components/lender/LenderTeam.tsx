import { useState } from "react";
import {
  LENDER_ROLE_DESCRIPTION,
  LENDER_ROLE_LABEL,
  permissionsFor,
  useLenderTeam,
  type LenderRole,
} from "@/lib/lender-team";
import { formatDate } from "@/lib/dates";

const ROLES: LenderRole[] = ["admin", "loan_officer", "underwriter", "processor", "analyst"];

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

export function LenderTeam() {
  const { members, active, adminCount, can, addMember, setRole, removeMember, setActive } =
    useLenderTeam();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole_] = useState<LenderRole>("loan_officer");

  const manage = can("team.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Team & access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company admins hold full access. Every other seat is scoped to the functions that role
          needs.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Signed-in seat</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Switch seat to preview what each role sees in this portal.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                active?.id === m.id
                  ? "bg-brand text-background"
                  : "border border-border text-muted-foreground hover:bg-brand-tint"
              }`}
            >
              {m.name} · {LENDER_ROLE_LABEL[m.role]}
            </button>
          ))}
        </div>
        {active ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {permissionsFor(active.role).map((p) => (
              <span
                key={p}
                className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand"
              >
                {p}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Members</h2>
        <ul className="mt-3 divide-y divide-border">
          {members.map((m) => {
            const lastAdmin = m.role === "admin" && adminCount <= 1;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-semibold text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.email} · added {formatDate(m.addedAt)}
                  </div>
                </div>
                <select
                  value={m.role}
                  disabled={!manage || lastAdmin}
                  onChange={(e) => setRole(m.id, e.target.value as LenderRole)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {LENDER_ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!manage || lastAdmin}
                  onClick={() => removeMember(m.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        {adminCount <= 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            At least one company admin must remain — that seat is locked.
          </p>
        ) : null}
      </div>

      {manage ? (
        <form
          className="rounded-lg border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !email.trim()) return;
            addMember(name.trim(), email.trim(), role);
            setName("");
            setEmail("");
          }}
        >
          <h2 className="text-base font-semibold text-foreground">Invite a team member</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <input
              className={inputClass}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Work e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className={inputClass}
              value={role}
              onChange={(e) => setRole_(e.target.value as LenderRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {LENDER_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-background"
            >
              Invite
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {LENDER_ROLE_DESCRIPTION[role]}
          </p>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only company admins can invite members or change roles.
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Role reference</h2>
        <ul className="mt-3 divide-y divide-border">
          {ROLES.map((r) => (
            <li key={r} className="py-3">
              <div className="text-sm font-semibold text-foreground">{LENDER_ROLE_LABEL[r]}</div>
              <div className="text-xs text-muted-foreground">{LENDER_ROLE_DESCRIPTION[r]}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
