import { useState } from "react";
import {
  LENDER_ROLE_DESCRIPTION,
  LENDER_ROLE_LABEL,
  permissionsFor,
  useLenderTeam,
  type LenderLicense,
  type LenderRole,
} from "@/lib/lender-team";
import { formatDate } from "@/lib/dates";
import { US_STATE_CODES, US_STATE_NAME_BY_CODE } from "@/data/us-states";

const ROLES: LenderRole[] = ["admin", "loan_officer", "underwriter", "processor", "analyst"];

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function LicenseEditor({
  licenses,
  disabled,
  onAdd,
  onRemove,
}: {
  licenses: LenderLicense[];
  disabled: boolean;
  onAdd: (l: LenderLicense) => void;
  onRemove: (index: number) => void;
}) {
  const [state, setState] = useState<string>("");
  const [number, setNumber] = useState("");

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Licence numbers
      </div>
      {licenses.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {licenses.map((l, i) => (
            <li
              key={`${l.state}-${l.number}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand"
            >
              {l.state} · {l.number}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${l.state} licence`}
                  onClick={() => onRemove(i)}
                  className="text-destructive"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No licence recorded.</p>
      )}
      {!disabled ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">State…</option>
            {US_STATE_CODES.map((c) => (
              <option key={c} value={c}>
                {c} — {US_STATE_NAME_BY_CODE[c]}
              </option>
            ))}
          </select>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Licence / NMLS number"
            maxLength={40}
            className="min-w-[180px] flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
          />
          <button
            type="button"
            onClick={() => {
              if (!state || !number.trim()) return;
              onAdd({ state, number: number.trim() });
              setNumber("");
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand"
          >
            Add licence
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LenderTeam() {
  const {
    members,
    active,
    adminCount,
    can,
    addMember,
    setRole,
    setAllStates,
    toggleState,
    addLicense,
    removeLicense,
    removeMember,
    setActive,
  } = useLenderTeam();
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
          needs — and, optionally, to the states that seat is licensed to work.
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
          <>
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
            <p className="mt-3 text-xs text-muted-foreground">
              State coverage:{" "}
              {active.allStates
                ? "all states"
                : active.states.length
                  ? active.states.join(", ")
                  : "no states assigned — this seat sees no requests or mortgages"}
            </p>
          </>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Members</h2>
        <ul className="mt-3 divide-y divide-border">
          {members.map((m) => {
            const lastAdmin = m.role === "admin" && adminCount <= 1;
            return (
              <li key={m.id} className="py-4">
                <div className="flex flex-wrap items-center gap-3">
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
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    State coverage
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-foreground">
                      <input
                        type="radio"
                        name={`scope-${m.id}`}
                        checked={m.allStates}
                        disabled={!manage}
                        onChange={() => setAllStates(m.id, true)}
                      />
                      All states
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground">
                      <input
                        type="radio"
                        name={`scope-${m.id}`}
                        checked={!m.allStates}
                        disabled={!manage}
                        onChange={() => setAllStates(m.id, false)}
                      />
                      Specific states
                    </label>
                  </div>
                  {!m.allStates ? (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-border p-2">
                      <div className="flex flex-wrap gap-1.5">
                        {US_STATE_CODES.map((c) => {
                          const on = m.states.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              disabled={!manage}
                              onClick={() => toggleState(m.id, c)}
                              title={US_STATE_NAME_BY_CODE[c]}
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                                on
                                  ? "bg-brand text-background"
                                  : "border border-border text-muted-foreground hover:bg-brand-tint"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <LicenseEditor
                  licenses={m.licenses}
                  disabled={!manage}
                  onAdd={(l) => addLicense(m.id, l)}
                  onRemove={(i) => removeLicense(m.id, i)}
                />
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
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Work e-mail"
              maxLength={255}
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
            {LENDER_ROLE_DESCRIPTION[role]} New seats start with all-state coverage — set their
            states and licence numbers in the member list above.
          </p>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only company admins can invite members, change roles or edit state coverage.
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
