/**
 * Team & role management inside a mortgage-lender partner organisation.
 * Each partner company has one or more admins with full access; other
 * seats are scoped to the functions their job actually needs.
 */
import { useCallback, useSyncExternalStore } from "react";

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
  | "team.manage";

export const LENDER_ROLE_LABEL: Record<LenderRole, string> = {
  admin: "Company admin",
  loan_officer: "Loan officer",
  underwriter: "Underwriter",
  processor: "Loan processor",
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
    "team.manage",
  ],
  loan_officer: ["requests.view", "requests.request_info", "mortgages.view", "analytics.view"],
  underwriter: ["requests.view", "requests.request_info", "requests.decide", "mortgages.view"],
  processor: ["requests.view", "mortgages.view", "mortgages.manage"],
  analyst: ["analytics.view", "mortgages.view"],
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
};

/** Can this member see work located in `code` (a two-letter state)? */
export function memberCoversState(member: LenderMember | null, code: string) {
  if (!member) return false;
  if (member.allStates) return true;
  return member.states.includes(code);
}

type TeamState = { members: LenderMember[]; activeId: string };

const STORAGE_KEY = "loqal.lender.team.v1";

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_STATE = (): TeamState => {
  const members: LenderMember[] = [
    {
      id: "seed-admin",
      name: "You (signed-in seat)",
      email: "admin@lender.example",
      role: "admin",
      addedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Dana Whitfield",
      email: "dana@lender.example",
      role: "underwriter",
      addedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Marcus Reyes",
      email: "marcus@lender.example",
      role: "loan_officer",
      addedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      name: "Priya Anand",
      email: "priya@lender.example",
      role: "processor",
      addedAt: new Date().toISOString(),
    },
  ];
  return { members, activeId: "seed-admin" };
};

let state: TeamState | null = null;
const listeners = new Set<() => void>();

function load(): TeamState {
  if (state) return state;
  let next = DEFAULT_STATE();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = JSON.parse(raw) as TeamState;
  } catch {
    /* ignore */
  }
  state = next;
  return next;
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

const SERVER_SNAPSHOT: TeamState = { members: [], activeId: "" };

export function useLenderTeam() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const addMember = useCallback((name: string, email: string, role: LenderRole) => {
    const cur = load();
    commit({
      ...cur,
      members: [
        ...cur.members,
        { id: uid(), name, email, role, addedAt: new Date().toISOString() },
      ],
    });
  }, []);

  const setRole = useCallback((id: string, role: LenderRole) => {
    const cur = load();
    commit({
      ...cur,
      members: cur.members.map((m) => (m.id === id ? { ...m, role } : m)),
    });
  }, []);

  const removeMember = useCallback((id: string) => {
    const cur = load();
    const members = cur.members.filter((m) => m.id !== id);
    commit({
      members,
      activeId: cur.activeId === id ? (members[0]?.id ?? "") : cur.activeId,
    });
  }, []);

  const setActive = useCallback((id: string) => {
    commit({ ...load(), activeId: id });
  }, []);

  const active =
    snapshot.members.find((m) => m.id === snapshot.activeId) ?? snapshot.members[0] ?? null;
  const perms = active ? permissionsFor(active.role) : [];

  return {
    members: snapshot.members,
    active,
    adminCount: snapshot.members.filter((m) => m.role === "admin").length,
    can: (p: LenderPermission) => perms.includes(p),
    addMember,
    setRole,
    removeMember,
    setActive,
  };
}
