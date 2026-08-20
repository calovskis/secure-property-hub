import { useState } from "react";
import {
  ASSIGNMENT_STRATEGY_LABEL,
  LENDER_ROLE_LABEL,
  RULE_CONDITION_LABEL,
  useLenderTeam,
  type AssignmentStrategy,
  type LenderMember,
  type RuleConditionKind,
} from "@/lib/lender-team";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const btnGhost =
  "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-brand-tint disabled:opacity-40";

const STRATEGY_DESCRIPTION: Record<AssignmentStrategy, string> = {
  license_capacity:
    "Loqal picks the licensed loan officer with the fewest open files. Fair, automatic, no setup required.",
  random: "Loqal picks any licensed loan officer at random. Good for evenly-sized, interchangeable teams.",
  manual: "Nobody is auto-assigned. Team members you allow below can hand files to specific colleagues themselves.",
  custom: "You define an ordered list of rules (price, location, daily/weekly caps) that route each new file, with a fallback if none match.",
};

const RULE_KINDS: RuleConditionKind[] = [
  "price_below",
  "price_above",
  "city_equals",
  "state_equals",
  "cap_per_day",
  "cap_per_week",
];

function ManualPermissions({ members }: { members: LenderMember[] }) {
  const { assignment, setManualPermission } = useLenderTeam();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Choose which members may assign files to which loan officers. Everyone not listed here can
        only view files already assigned to them.
      </p>
      {members.map((assigner) => {
        const perm = assignment.manualPermissions.find((p) => p.assignerId === assigner.id);
        const assigneeIds = perm?.assigneeIds ?? [];
        return (
          <div key={assigner.id} className="rounded-md border border-border p-3">
            <div className="text-sm font-semibold text-foreground">
              {assigner.name} <span className="text-xs font-normal text-muted-foreground">may assign to:</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {members
                .filter((m) => m.id !== assigner.id)
                .map((target) => {
                  const on = assigneeIds.includes(target.id);
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() =>
                        setManualPermission(
                          assigner.id,
                          on
                            ? assigneeIds.filter((id) => id !== target.id)
                            : [...assigneeIds, target.id],
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        on
                          ? "bg-brand text-background"
                          : "border border-border text-muted-foreground hover:bg-brand-tint"
                      }`}
                    >
                      {target.name}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RuleBuilder({ members }: { members: LenderMember[] }) {
  const { assignment, addCustomRule, removeCustomRule, moveCustomRule, setAssignmentSettings } =
    useLenderTeam();
  const [condition, setCondition] = useState<RuleConditionKind>("price_below");
  const [value, setValue] = useState("");
  const [targetMemberId, setTargetMemberId] = useState(members[0]?.id ?? "");

  const isLocationCondition = condition === "city_equals" || condition === "state_equals";

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Rules run top to bottom — the first matching rule wins. Add a fallback below for files that
        match none of them.
      </p>

      {assignment.customRules.length ? (
        <ul className="space-y-2">
          {assignment.customRules.map((rule, i) => {
            const target = members.find((m) => m.id === rule.targetMemberId);
            return (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-3 text-sm"
              >
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand">
                  {i + 1}
                </span>
                <span className="text-foreground">
                  {RULE_CONDITION_LABEL[rule.condition]}{" "}
                  <strong>
                    {isLocationConditionKind(rule.condition) ? rule.value.toUpperCase() : rule.value}
                  </strong>{" "}
                  → assign to <strong>{target?.name ?? "(removed member)"}</strong>
                </span>
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    aria-label="Move rule up"
                    disabled={i === 0}
                    onClick={() => moveCustomRule(rule.id, "up")}
                    className={btnGhost}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move rule down"
                    disabled={i === assignment.customRules.length - 1}
                    onClick={() => moveCustomRule(rule.id, "down")}
                    className={btnGhost}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomRule(rule.id)}
                    className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No custom rules yet.</p>
      )}

      <div className="grid gap-2 rounded-md border border-border bg-brand-tint/20 p-3 md:grid-cols-[1.2fr_1fr_1.2fr_auto]">
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as RuleConditionKind)}
          className={inputClass}
        >
          {RULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {RULE_CONDITION_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isLocationCondition ? "e.g. FL or Miami" : "e.g. 500000 or 5"}
          className={inputClass}
        />
        <select value={targetMemberId} onChange={(e) => setTargetMemberId(e.target.value)} className={inputClass}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {LENDER_ROLE_LABEL[m.role]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!value.trim() || !targetMemberId}
          onClick={() => {
            addCustomRule({ condition, value: value.trim(), targetMemberId });
            setValue("");
          }}
          className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"
        >
          Add rule
        </button>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fallback assignee (used when no rule matches)
        </span>
        <select
          value={assignment.customFallbackMemberId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setAssignmentSettings(v ? { customFallbackMemberId: v } : { customFallbackMemberId: "" });
          }}
          className={inputClass}
        >
          <option value="">No fallback — file stays unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {LENDER_ROLE_LABEL[m.role]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function isLocationConditionKind(k: RuleConditionKind) {
  return k === "city_equals" || k === "state_equals";
}

/** Company admin panel for choosing how new pre-approval files get routed. */
export function AssignmentSettingsPanel({ members }: { members: LenderMember[] }) {
  const { assignment, setAssignmentSettings } = useLenderTeam();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Assignment settings</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose how new pre-approval requests are routed to your loan officers.
      </p>

      <div className="mt-4 space-y-2">
        {(Object.keys(ASSIGNMENT_STRATEGY_LABEL) as AssignmentStrategy[]).map((s) => (
          <label
            key={s}
            className={`block cursor-pointer rounded-md border p-3 ${
              assignment.strategy === s ? "border-brand bg-brand-tint/30" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                checked={assignment.strategy === s}
                onChange={() => setAssignmentSettings({ strategy: s })}
              />
              <span className="text-sm font-semibold text-foreground">
                {ASSIGNMENT_STRATEGY_LABEL[s]}
              </span>
            </div>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">{STRATEGY_DESCRIPTION[s]}</p>
          </label>
        ))}
      </div>

      {assignment.strategy === "manual" ? (
        <div className="mt-5 border-t border-border pt-4">
          <ManualPermissions members={members} />
        </div>
      ) : null}

      {assignment.strategy === "custom" ? (
        <div className="mt-5 border-t border-border pt-4">
          <RuleBuilder members={members} />
        </div>
      ) : null}
    </div>
  );
}
