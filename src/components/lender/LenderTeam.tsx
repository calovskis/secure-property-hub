import { useEffect, useRef, useState } from "react";
import {
  LENDER_ROLE_DESCRIPTION,
  LENDER_ROLE_LABEL,
  permissionsFor,
  useLenderTeam,
  type LenderLicense,
  type LenderMember,
  type LenderRole,
} from "@/lib/lender-team";
import { formatDate } from "@/lib/dates";
import { US_STATE_NAME_BY_CODE } from "@/data/us-states";
import { StateCombobox, StateMultiSelect } from "@/components/form/StateCombobox";

const ROLES: LenderRole[] = ["admin", "loan_officer", "underwriter", "processor", "analyst"];

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const btnGhost =
  "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-brand-tint disabled:opacity-40";

type Draft = {
  name: string;
  email: string;
  role: LenderRole;
  allStates: boolean;
  states: string[];
  licenses: LenderLicense[];
};

const emptyDraft = (): Draft => ({
  name: "",
  email: "",
  role: "loan_officer",
  allStates: true,
  states: [],
  licenses: [],
});

const draftOf = (m: LenderMember): Draft => ({
  name: m.name,
  email: m.email,
  role: m.role,
  allStates: m.allStates,
  states: [...m.states],
  licenses: [...m.licenses],
});

function LicenseEditor({
  licenses,
  onAdd,
  onRemove,
}: {
  licenses: LenderLicense[];
  onAdd: (l: LenderLicense) => void;
  onRemove: (index: number) => void;
}) {
  const [state, setState] = useState("");
  const [number, setNumber] = useState("");

  return (
    <div>
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
              <button
                type="button"
                aria-label={`Remove ${l.state} licence`}
                onClick={() => onRemove(i)}
                className="text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No licence recorded.</p>
      )}
      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
        <StateCombobox value={state} onChange={setState} placeholder="Licence state…" />
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Licence / NMLS number"
          maxLength={40}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => {
            if (!state || !number.trim()) return;
            onAdd({ state, number: number.trim() });
            setState("");
            setNumber("");
          }}
          className={btnGhost}
        >
          Add licence
        </button>
      </div>
    </div>
  );
}

function ScopeFields({
  draft,
  set,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        State coverage
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 text-xs text-foreground">
          <input
            type="radio"
            checked={draft.allStates}
            onChange={() => set({ allStates: true })}
          />
          All states
        </label>
        <label className="flex items-center gap-1.5 text-xs text-foreground">
          <input
            type="radio"
            checked={!draft.allStates}
            onChange={() => set({ allStates: false })}
          />
          Specific states
        </label>
      </div>
      {!draft.allStates ? (
        <div className="mt-2">
          <StateMultiSelect
            values={draft.states}
            onAdd={(c) => set({ states: [...draft.states, c].sort() })}
            onRemove={(c) => set({ states: draft.states.filter((s) => s !== c) })}
            emptyLabel="No states applied — this seat would see no requests or mortgages."
          />
        </div>
      ) : null}
    </div>
  );
}

function RowMenu({
  onEdit,
  onDelete,
  onMove,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onMove: (role: LenderRole) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setMoving(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Seat actions"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border px-2.5 py-1 text-sm font-bold leading-none text-muted-foreground hover:bg-brand-tint"
      >
        …
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
          {!moving ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setMoving(true)}
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint disabled:opacity-40"
              >
                Move to another role…
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-brand-tint disabled:opacity-40"
              >
                Delete
              </button>
            </>
          ) : (
            ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMoving(false);
                  onMove(r);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint"
              >
                {LENDER_ROLE_LABEL[r]}
              </button>
            ))
          )}
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
    removeMember,
    setActive,
    updateMember,
  } = useLenderTeam();

  const manage = can("team.manage");
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"none" | "add" | "edit">("none");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [bulk, setBulk] = useState({ role: false, scope: false });
  const [editing, setEditing] = useState<string[]>([]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const lockedAdmin = (m: LenderMember) => m.role === "admin" && adminCount <= 1;

  function openAdd() {
    setDraft(emptyDraft());
    setEditing([]);
    setMode("add");
  }

  function openEdit(ids: string[]) {
    if (!ids.length) return;
    const first = members.find((m) => m.id === ids[0]);
    setDraft(first && ids.length === 1 ? draftOf(first) : { ...emptyDraft(), role: first?.role ?? "loan_officer" });
    setBulk({ role: false, scope: false });
    setEditing(ids);
    setMode("edit");
  }

  function deleteIds(ids: string[]) {
    ids
      .filter((id) => {
        const m = members.find((x) => x.id === id);
        return m && !lockedAdmin(m);
      })
      .forEach((id) => removeMember(id));
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    if (mode === "edit" && editing.some((id) => ids.includes(id))) setMode("none");
  }

  function save() {
    if (mode === "add") {
      if (!draft.name.trim() || !draft.email.trim()) return;
      addMember(draft.name.trim(), draft.email.trim(), draft.role, {
        allStates: draft.allStates,
        states: draft.states,
        licenses: draft.licenses,
      });
    } else if (editing.length === 1) {
      updateMember(editing[0], {
        name: draft.name.trim(),
        email: draft.email.trim(),
        role: draft.role,
        allStates: draft.allStates,
        states: draft.states,
        licenses: draft.licenses,
      });
    } else {
      editing.forEach((id) => {
        const patch: Partial<LenderMember> = {};
        if (bulk.role) patch.role = draft.role;
        if (bulk.scope) {
          patch.allStates = draft.allStates;
          patch.states = draft.states;
        }
        if (Object.keys(patch).length) updateMember(id, patch);
      });
    }
    setMode("none");
    setEditing([]);
  }

  const allChecked = members.length > 0 && selected.length === members.length;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Roles & seats</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.length
                ? `${selected.length} selected`
                : "Select one or more seats to edit or delete them together."}
            </p>
          </div>
          {manage ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openAdd} className="rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-background">
                Add a new role
              </button>
              <button
                type="button"
                disabled={!selected.length}
                onClick={() => openEdit(selected)}
                className={btnGhost}
              >
                Edit existing role
              </button>
              <button
                type="button"
                disabled={!selected.length}
                onClick={() => deleteIds(selected)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-brand-tint disabled:opacity-40"
              >
                Delete existing role
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                {manage ? (
                  <th className="w-8 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all seats"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? [] : members.map((m) => m.id))}
                    />
                  </th>
                ) : null}
                <th className="py-2 font-semibold">Member</th>
                <th className="py-2 font-semibold">Role</th>
                <th className="py-2 font-semibold">States</th>
                <th className="py-2 font-semibold">Licences</th>
                <th className="py-2 font-semibold">Added</th>
                {manage ? <th className="w-10 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id} className="align-top">
                  {manage ? (
                    <td className="py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${m.name}`}
                        checked={selected.includes(m.id)}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id],
                          )
                        }
                      />
                    </td>
                  ) : null}
                  <td className="py-3">
                    <div className="font-semibold text-foreground">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                      {LENDER_ROLE_LABEL[m.role]}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {m.allStates ? (
                      "All states"
                    ) : m.states.length ? (
                      <span className="flex flex-wrap gap-1">
                        {m.states.map((c) => (
                          <span
                            key={c}
                            title={US_STATE_NAME_BY_CODE[c]}
                            className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground"
                          >
                            {c}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "None"
                    )}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {m.licenses.length
                      ? m.licenses.map((l) => `${l.state} ${l.number}`).join(", ")
                      : "—"}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{formatDate(m.addedAt)}</td>
                  {manage ? (
                    <td className="py-3">
                      <RowMenu
                        disabled={lockedAdmin(m)}
                        onEdit={() => openEdit([m.id])}
                        onDelete={() => deleteIds([m.id])}
                        onMove={(r) => setRole(m.id, r)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {adminCount <= 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            At least one company admin must remain — that seat is locked.
          </p>
        ) : null}
        {!manage ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Only company admins can invite members, change roles or edit state coverage.
          </p>
        ) : null}
      </div>

      {manage && mode !== "none" ? (
        <form
          className="rounded-lg border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h2 className="text-base font-semibold text-foreground">
            {mode === "add"
              ? "Add a new role"
              : editing.length > 1
                ? `Edit ${editing.length} selected seats`
                : "Edit existing role"}
          </h2>

          {mode === "add" || editing.length === 1 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Full name"
                maxLength={100}
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
              />
              <input
                className={inputClass}
                type="email"
                placeholder="Work e-mail"
                maxLength={255}
                value={draft.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Tick what you want to apply to every selected seat.
            </p>
          )}

          <div className="mt-4 space-y-4">
            <div>
              {editing.length > 1 ? (
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={bulk.role}
                    onChange={(e) => setBulk((b) => ({ ...b, role: e.target.checked }))}
                  />
                  Change role
                </label>
              ) : null}
              <select
                className={inputClass}
                disabled={editing.length > 1 && !bulk.role}
                value={draft.role}
                onChange={(e) => set({ role: e.target.value as LenderRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {LENDER_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                {LENDER_ROLE_DESCRIPTION[draft.role]}
              </p>
            </div>

            <div>
              {editing.length > 1 ? (
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={bulk.scope}
                    onChange={(e) => setBulk((b) => ({ ...b, scope: e.target.checked }))}
                  />
                  Change state coverage
                </label>
              ) : null}
              {editing.length <= 1 || bulk.scope ? <ScopeFields draft={draft} set={set} /> : null}
            </div>

            {mode === "add" || editing.length === 1 ? (
              <LicenseEditor
                licenses={draft.licenses}
                onAdd={(l) => set({ licenses: [...draft.licenses, l] })}
                onRemove={(i) => set({ licenses: draft.licenses.filter((_, x) => x !== i) })}
              />
            ) : null}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-background"
            >
              {mode === "add" ? "Add role" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("none");
                setEditing([]);
              }}
              className={btnGhost}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

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
