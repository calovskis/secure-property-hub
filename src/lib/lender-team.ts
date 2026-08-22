/**
 * Team & role management inside a mortgage-lender partner organisation.
 * Each partner company has one or more admins with full access; other
 * seats are scoped to the functions their job actually needs.
 */
import { useCallback, useSyncExternalStore } from "react";
import { usDateToIso } from "@/lib/dates";

export type LenderRole =
  | "admin"
  | "loan_officer"
  | "underwriter"
  | "processor"
  | "analyst";

export type LenderPermission =
  | "requests.view"
  | "requests.request_info"
  | "requests.decide"
  | "mortgages.view"
  | "mortgages.manage"
  | "analytics.view"
  | "accounting.view"
  | "team.manage";

export const LENDER_ROLE_LABEL: Record<LenderRole, string> = {
  admin: "Company admin",
  loan_officer: "Loan Officer",
  underwriter: "Underwriter",
  processor: "Loan Officer",
  analyst: "Analyst",
};

export const LENDER_ROLE_DESCRIPTION: Record<LenderRole, string> = {
  admin: "Full access: pipeline, decisions, pricing, analytics and team management.",
  loan_officer: "Owns client relationships — can review files and request more information.",
  underwriter: "Issues decisions, soft credit scores and loan pricing terms.",
  processor: "Works active mortgages, documents and conditions. No decision authority.",
  analyst: "Read-only reporting and portfolio analytics.",
};

const ROLE_PERMISSIONS: Record<LenderRole, LenderPermission[]> = {
  admin: [
    "requests.view",
    "requests.request_info",
    "requests.decide",
    "mortgages.view",
    "mortgages.manage",
    "analytics.view",
    "accounting.view",
    "team.manage",
  ],
  loan_officer: ["requests.view", "requests.request_info", "mortgages.view", "analytics.view"],
  underwriter: ["requests.view", "requests.request_info", "requests.decide", "mortgages.view"],
  processor: ["requests.view", "mortgages.view", "mortgages.manage"],
  analyst: ["analytics.view", "accounting.view", "mortgages.view"],
};

export function permissionsFor(role: LenderRole): LenderPermission[] {
  return ROLE_PERMISSIONS[role];
}

/** An individual licence held by a team member in one state. */
export type LenderLicense = {
  state: string;
  number: string;
};

export type LenderMember = {
  id: string;
  name: string;
  email: string;
  role: LenderRole;
  addedAt: string;
  /** true → oversees every state; false → limited to `states`. */
  allStates: boolean;
  /** Two-letter state codes this member can see when `allStates` is false. */
  states: string[];
  licenses: LenderLicense[];
  /** Loan officer vacation mode — excluded from auto-assignment while active. */
  vacationFrom?: string;
  vacationUntil?: string;
  vacationReason?: string;
};

/** Can this member see work located in `code` (a two-letter state)? */
export function memberCoversState(member: LenderMember | null, code: string) {
  if (!member) return false;
  if (member.allStates) return true;
  return member.states.includes(code);
}

/** Is this member licensed to originate business in `code`? */
export function memberLicensedIn(member: LenderMember, code: string) {
  if (member.allStates) return true;
  return member.licenses.some((l) => l.state === code);
}

function inRange(iso: string, from?: string, until?: string) {
  if (!from || !until) return false;
  return iso >= from && iso <= until;
}

/** Is this member currently on vacation (excluded from auto-assignment)? */
export function isMemberOnVacation(member: LenderMember, todayIso = new Date().toISOString().slice(0, 10)) {
  return inRange(todayIso, member.vacationFrom, member.vacationUntil);
}

/* ---------------------------------------------------- assignment settings */

export type AssignmentStrategy = "license_capacity" | "random" | "manual" | "custom";

export const ASSIGNMENT_STRATEGY_LABEL: Record<AssignmentStrategy, string> = {
  license_capacity: "Automatic — by license & capacity",
  random: "Automatic — random among licensed officers",
  manual: "Manual — team members choose who assigns to whom",
  custom: "Custom rules",
};

export type RuleConditionKind =
  | "price_below"
  | "price_above"
  | "city_equals"
  | "state_equals"
  | "cap_per_day"
  | "cap_per_week";

export const RULE_CONDITION_LABEL: Record<RuleConditionKind, string> = {
  price_below: "Purchase price is below",
  price_above: "Purchase price is above",
  city_equals: "Property city equals",
  state_equals: "Property state equals",
  cap_per_day: "Cap files per day at",
  cap_per_week: "Cap files per week at",
};

export type CustomRule = {
  id: string;
  condition: RuleConditionKind;
  /** Number for price/cap conditions, two-letter state or city text for location. */
  value: string;
  targetMemberId: string;
};

export type ManualAssignPermission = {
  assignerId: string;
  /** Members this assigner is allowed to hand files to. */
  assigneeIds: string[];
};

export type AssignmentSettings = {
  strategy: AssignmentStrategy;
  customRules: CustomRule[];
  customFallbackMemberId?: string;
  manualPermissions: ManualAssignPermission[];
};

export const defaultAssignmentSettings = (): AssignmentSettings => ({
  strategy: "license_capacity",
  customRules: [],
  manualPermissions: [],
});

export type CompanyVacation = { from: string; until: string; reason: string } | null;

type TeamState = {
  members: LenderMember[];
  activeId: string;
  assignment: AssignmentSettings;
  companyVacation: CompanyVacation;
};

const STORAGE_KEY = "loqal.lender.team.v2";

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_STATE = (): TeamState => {
  const now = new Date().toISOString();
  const members: LenderMember[] = [
    {
      id: "seed-admin",
      name: "You (signed-in seat)",
      email: "admin@lender.example",
      role: "admin",
      addedAt: now,
      allStates: true,
      states: [],
      licenses: [{ state: "NY", number: "NMLS-1180422" }],
    },
    {
      id: uid(),
      name: "Dana Whitfield",
      email: "dana@lender.example",
      role: "underwriter",
      addedAt: now,
      allStates: false,
      states: ["NY", "NJ"],
      licenses: [
        { state: "NY", number: "NMLS-2044118" },
        { state: "NJ", number: "NMLS-2044118-NJ" },
      ],
    },
    {
      id: uid(),
      name: "Marcus Reyes",
      email: "marcus@lender.example",
      role: "loan_officer",
      addedAt: now,
      allStates: false,
      states: ["FL"],
      licenses: [{ state: "FL", number: "NMLS-1877301" }],
    },
    {
      id: uid(),
      name: "Priya Anand",
      email: "priya@lender.example",
      role: "processor",
      addedAt: now,
      allStates: true,
      states: [],
      licenses: [],
    },
  ];
  return { members, activeId: "seed-admin", assignment: defaultAssignmentSettings(), companyVacation: null };
};

let state: TeamState | null = null;
const listeners = new Set<() => void>();

/** Older stored members may predate state scoping / licences / vacation. */
function normalise(next: Partial<TeamState>): TeamState {
  return {
    members: (next.members ?? []).map((m) => ({
      ...m,
      allStates: m.allStates ?? true,
      states: m.states ?? [],
      licenses: m.licenses ?? [],
    })),
    activeId: next.activeId ?? "",
    assignment: {
      ...defaultAssignmentSettings(),
      ...(next.assignment ?? {}),
    },
    companyVacation: next.companyVacation ?? null,
  };
}

function load(): TeamState {
  if (state) return state;
  let next = DEFAULT_STATE();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = normalise(JSON.parse(raw) as Partial<TeamState>);
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

/** Raw, non-hook accessor — used by leads.tsx to auto-assign incoming files. */
export function getTeamSnapshot(): TeamState {
  return load();
}

export function isCompanyOnVacation(snapshot: TeamState = load(), todayIso = new Date().toISOString().slice(0, 10)) {
  const v = snapshot.companyVacation;
  if (!v) return false;
  return inRange(todayIso, v.from, v.until);
}

function commit(next: TeamState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: TeamState = {
  members: [],
  activeId: "",
  assignment: defaultAssignmentSettings(),
  companyVacation: null,
};

/* --------------------------------------------------------- auto-assignment */

export type AssignContext = { state: string; city: string; price: number };
export type AssignCounts = {
  openByMember: Record<string, number>;
  todayByMember: Record<string, number>;
  weekByMember: Record<string, number>;
};

function ruleApplies(rule: CustomRule, ctx: AssignContext, counts: AssignCounts): boolean {
  switch (rule.condition) {
    case "price_below":
      return ctx.price < Number(rule.value || 0);
    case "price_above":
      return ctx.price > Number(rule.value || 0);
    case "city_equals":
      return ctx.city.trim().toLowerCase() === rule.value.trim().toLowerCase();
    case "state_equals":
      return ctx.state.trim().toUpperCase() === rule.value.trim().toUpperCase();
    case "cap_per_day":
      return (counts.todayByMember[rule.targetMemberId] ?? 0) < Number(rule.value || 0);
    case "cap_per_week":
      return (counts.weekByMember[rule.targetMemberId] ?? 0) < Number(rule.value || 0);
    default:
      return false;
  }
}

/** Decide who a new pre-approval file should be routed to, per the company's assignment settings. */
export function pickAssignee(
  ctx: AssignContext,
  counts: AssignCounts,
  snapshot: TeamState = load(),
): { id: string; name: string } | null {
  const today = new Date().toISOString().slice(0, 10);
  const available = snapshot.members.filter((m) => !isMemberOnVacation(m, today));
  const licensedPool = available.filter((m) => memberLicensedIn(m, ctx.state));
  const settings = snapshot.assignment;

  if (settings.strategy === "manual") return null;

  if (settings.strategy === "random") {
    if (!licensedPool.length) return null;
    const pick = licensedPool[Math.floor(Math.random() * licensedPool.length)]!;
    return { id: pick.id, name: pick.name };
  }

  if (settings.strategy === "custom") {
    for (const rule of settings.customRules) {
      if (!ruleApplies(rule, ctx, counts)) continue;
      const target = available.find((m) => m.id === rule.targetMemberId);
      if (target) return { id: target.id, name: target.name };
    }
    const fallback = available.find((m) => m.id === settings.customFallbackMemberId);
    return fallback ? { id: fallback.id, name: fallback.name } : null;
  }

  // license_capacity (default)
  if (!licensedPool.length) return null;
  const sorted = [...licensedPool].sort(
    (a, b) => (counts.openByMember[a.id] ?? 0) - (counts.openByMember[b.id] ?? 0),
  );
  return { id: sorted[0]!.id, name: sorted[0]!.name };
}

export function useLenderTeam() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const addMember = useCallback(
    (
      name: string,
      email: string,
      role: LenderRole,
      scope?: { allStates?: boolean; states?: string[]; licenses?: LenderLicense[] },
    ) => {
      const cur = load();
      commit({
        ...cur,
        members: [
          ...cur.members,
          {
            id: uid(),
            name,
            email,
            role,
            addedAt: new Date().toISOString(),
            allStates: scope?.allStates ?? true,
            states: scope?.states ?? [],
            licenses: scope?.licenses ?? [],
          },
        ],
      });
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<LenderMember>) => {
    const cur = load();
    commit({
      ...cur,
      members: cur.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }, []);

  const setRole = useCallback(
    (id: string, role: LenderRole) => update(id, { role }),
    [update],
  );

  const setAllStates = useCallback(
    (id: string, allStates: boolean) => update(id, { allStates }),
    [update],
  );

  const toggleState = useCallback((id: string, code: string) => {
    const cur = load();
    commit({
      ...cur,
      members: cur.members.map((m) =>
        m.id === id
          ? {
              ...m,
              states: m.states.includes(code)
                ? m.states.filter((s) => s !== code)
                : [...m.states, code].sort(),
            }
          : m,
      ),
    });
  }, []);

  const addLicense = useCallback((id: string, license: LenderLicense) => {
    const cur = load();
    commit({
      ...cur,
      members: cur.members.map((m) =>
        m.id === id ? { ...m, licenses: [...m.licenses, license] } : m,
      ),
    });
  }, []);

  const removeLicense = useCallback((id: string, index: number) => {
    const cur = load();
    commit({
      ...cur,
      members: cur.members.map((m) =>
        m.id === id ? { ...m, licenses: m.licenses.filter((_, i) => i !== index) } : m,
      ),
    });
  }, []);

  const removeMember = useCallback((id: string) => {
    const cur = load();
    const members = cur.members.filter((m) => m.id !== id);
    commit({
      ...cur,
      members,
      activeId: cur.activeId === id ? (members[0]?.id ?? "") : cur.activeId,
    });
  }, []);

  const setActive = useCallback((id: string) => {
    commit({ ...load(), activeId: id });
  }, []);

  /** Set/clear vacation mode for a member. Pass mm/dd/yyyy strings or empty to clear. */
  const setVacation = useCallback((id: string, fromUs: string, untilUs: string, reason?: string) => {
    const from = usDateToIso(fromUs);
    const until = usDateToIso(untilUs);
    update(id, {
      ...(from ? { vacationFrom: from } : { vacationFrom: "" }),
      ...(until ? { vacationUntil: until } : { vacationUntil: "" }),
      vacationReason: from && until && reason ? reason : "",
    });
  }, [update]);

  const setAssignmentSettings = useCallback((patch: Partial<AssignmentSettings>) => {
    const cur = load();
    commit({ ...cur, assignment: { ...cur.assignment, ...patch } });
  }, []);

  const addCustomRule = useCallback((rule: Omit<CustomRule, "id">) => {
    const cur = load();
    commit({
      ...cur,
      assignment: { ...cur.assignment, customRules: [...cur.assignment.customRules, { ...rule, id: uid() }] },
    });
  }, []);

  const removeCustomRule = useCallback((id: string) => {
    const cur = load();
    commit({
      ...cur,
      assignment: { ...cur.assignment, customRules: cur.assignment.customRules.filter((r) => r.id !== id) },
    });
  }, []);

  const moveCustomRule = useCallback((id: string, direction: "up" | "down") => {
    const cur = load();
    const rules = [...cur.assignment.customRules];
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= rules.length) return;
    [rules[idx], rules[swapWith]] = [rules[swapWith]!, rules[idx]!];
    commit({ ...cur, assignment: { ...cur.assignment, customRules: rules } });
  }, []);

  const setManualPermission = useCallback((assignerId: string, assigneeIds: string[]) => {
    const cur = load();
    const rest = cur.assignment.manualPermissions.filter((p) => p.assignerId !== assignerId);
    commit({
      ...cur,
      assignment: { ...cur.assignment, manualPermissions: [...rest, { assignerId, assigneeIds }] },
    });
  }, []);

  /** Set/clear company-wide vacation mode (mm/dd/yyyy). */
  const setCompanyVacation = useCallback((fromUs: string, untilUs: string, reason: string) => {
    const cur = load();
    const from = usDateToIso(fromUs);
    const until = usDateToIso(untilUs);
    commit({ ...cur, companyVacation: from && until ? { from, until, reason } : null });
  }, []);

  const clearCompanyVacation = useCallback(() => {
    const cur = load();
    commit({ ...cur, companyVacation: null });
  }, []);

  const active =
    snapshot.members.find((m) => m.id === snapshot.activeId) ?? snapshot.members[0] ?? null;
  const perms = active ? permissionsFor(active.role) : [];

  return {
    members: snapshot.members,
    active,
    adminCount: snapshot.members.filter((m) => m.role === "admin").length,
    can: (p: LenderPermission) => perms.includes(p),
    /** null → every state; otherwise the codes the signed-in seat may see. */
    scopedStates: active && !active.allStates ? active.states : null,
    coversState: (code: string) => memberCoversState(active, code),
    addMember,
    setRole,
    updateMember: update,
    setAllStates,
    toggleState,
    addLicense,
    removeLicense,
    removeMember,
    setActive,
    setVacation,
    assignment: snapshot.assignment,
    setAssignmentSettings,
    addCustomRule,
    removeCustomRule,
    moveCustomRule,
    setManualPermission,
    companyVacation: snapshot.companyVacation,
    isCompanyOnVacation: isCompanyOnVacation(snapshot),
    setCompanyVacation,
    clearCompanyVacation,
  };
}
