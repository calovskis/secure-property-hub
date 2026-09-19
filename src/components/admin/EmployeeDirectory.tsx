/**
 * Loqal employees: the roster with a full detail view per employee — their
 * details, what they may do (roles & permissions) and their recent activity.
 * Only a Full Admin (someone with "employees.manage") can change roles.
 */
import { useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { logActivity, useActivity } from "@/lib/activity";
import { permissionsOf, useStaff, type StaffMember } from "@/lib/staff";
import {
  LOQAL_ROLES,
  PERMISSION_LABEL,
  ROLE_BY_ID,
  type LoqalRoleId,
  type Permission,
} from "@/lib/roles";

export function EmployeeDirectory({
  canManage,
  actor,
}: {
  canManage: boolean;
  actor: string;
}) {
  const { members } = useStaff();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = members.find((m) => m.id === openId) ?? null;

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Loqal employees</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Open an employee to see their details and to allocate roles and permissions.
          </p>
        </div>
        <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
          {members.length} people
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-semibold">Employee</th>
              <th className="py-2 pr-4 font-semibold">Roles</th>
              <th className="py-2 pr-4 font-semibold">Deletion rights</th>
              <th className="py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
              const perms = permissionsOf(m);
              return (
                <tr key={m.id}>
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold text-foreground">
                      {m.name}
                      {m.superadmin ? (
                        <span className="ml-2 rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold text-gold">
                          Full Admin
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.title} · {m.email}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                    {m.superadmin
                      ? "All roles"
                      : (m.roles ?? []).length
                        ? (m.roles ?? []).map((r) => ROLE_BY_ID[r]?.name ?? r).join(", ")
                        : "No role assigned"}
                  </td>
                  <td className="py-2.5 pr-4 text-xs">
                    <DeletionRights perms={perms} />
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(m.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                    >
                      Open employee
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open ? (
        <EmployeeDrawer
          member={open}
          canManage={canManage}
          actor={actor}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function DeletionRights({ perms }: { perms: Permission[] }) {
  const req = perms.includes("users.delete.request");
  const conf = perms.includes("users.delete.confirm");
  if (req && conf)
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
        Request & confirm
      </span>
    );
  if (req)
    return (
      <span className="rounded-full bg-gold-tint px-2.5 py-1 font-semibold text-gold">
        Can request
      </span>
    );
  if (conf)
    return (
      <span className="rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
        Can confirm
      </span>
    );
  return <span className="text-muted-foreground">None</span>;
}

function EmployeeDrawer({
  member,
  canManage,
  actor,
  onClose,
}: {
  member: StaffMember;
  canManage: boolean;
  actor: string;
  onClose: () => void;
}) {
  const { setRole, updateMember } = useStaff();
  const entries = useActivity().filter((e) => e.actor === member.name).slice(0, 12);
  const perms = permissionsOf(member);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [title, setTitle] = useState(member.title);

  function saveDetails() {
    updateMember(member.id, { name: name.trim(), email: email.trim(), title: title.trim() });
    logActivity(actor, "updated employee details", name.trim());
    toast("Employee details saved");
  }

  function toggle(role: LoqalRoleId, on: boolean) {
    setRole(member.id, role, on);
    logActivity(
      actor,
      on ? "assigned a role" : "removed a role",
      `${member.name} · ${ROLE_BY_ID[role].name}`,
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={`Employee ${member.name}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {member.title} · {member.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h4 className="text-sm font-semibold text-foreground">Employee details</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Full name" value={name} onChange={setName} disabled={!canManage} />
              <Field label="E-mail" value={email} onChange={setEmail} disabled={!canManage} />
              <Field label="Job title" value={title} onChange={setTitle} disabled={!canManage} />
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={saveDetails}
                className="mt-3 rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
              >
                Save details
              </button>
            ) : null}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-foreground">Roles</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.superadmin
                ? "Full Admins hold every role and every permission."
                : canManage
                  ? "Tick the roles this employee holds. Permissions below update automatically."
                  : "Only a Full Admin can change roles."}
            </p>
            <ul className="mt-3 space-y-2">
              {LOQAL_ROLES.map((r) => {
                const on = member.superadmin || (member.roles ?? []).includes(r.id);
                return (
                  <li
                    key={r.id}
                    className={`rounded-lg border p-3 ${
                      on ? "border-brand/50 bg-brand-tint/30" : "border-border"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!canManage || member.superadmin}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[hsl(var(--brand))]"
                        aria-label={r.name}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{r.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-foreground">Effective permissions</h4>
            {perms.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No permissions yet — assign a role above.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {perms.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                    <span aria-hidden className="text-success">
                      ✓
                    </span>
                    {PERMISSION_LABEL[p]}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
              Deleting a profile always takes two steps — one person requests it with a reason,
              another confirms it. An employee holding both permissions may complete a deletion on
              their own.
            </p>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-foreground">Recent activity</h4>
            {entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {entries.map((e) => (
                  <li key={e.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-foreground">{e.action}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                    </div>
                    {e.details ? (
                      <div className="text-xs text-muted-foreground">{e.details}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-60"
      />
    </label>
  );
}
