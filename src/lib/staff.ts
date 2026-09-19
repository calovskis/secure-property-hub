/**
 * Loqal employee registry and platform-access matrix. The superadmin decides
 * per employee which admin sections they can see, change or approve in
 * (Settings → Access matrix). Persisted in localStorage.
 */
import { useCallback, useSyncExternalStore } from "react";
import {
  PERMISSION_ORDER,
  permissionsOfRoles,
  type LoqalRoleId,
  type Permission,
} from "@/lib/roles";
import {
  PERMISSION_ORDER,
  permissionsOfRoles,
  type LoqalRoleId,
  type Permission,
} from "@/lib/roles";

export type AdminSectionId =
  | "overview"
  | "cases"
  | "partners"
  | "employees"
  | "accounting"
  | "support"
  | "activity"
  | "settings";

export const ADMIN_SECTION_LABEL: Record<AdminSectionId, string> = {
  overview: "Home / Overview",
  cases: "Cases & files",
  partners: "Partners",
  employees: "Employees",
  accounting: "Accounting",
  support: "Support inbox",
  activity: "Activity log",
  settings: "Platform settings",
};

/** Ordered — each level includes everything below it. */
export type AccessLevel = "hidden" | "view" | "edit" | "approve";

export const ACCESS_LEVELS: AccessLevel[] = ["hidden", "view", "edit", "approve"];

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  hidden: "Hidden",
  view: "View",
  edit: "View & change",
  approve: "View, change & confirm",
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  title: string;
  /** Superadmins always have full access and cannot be edited down. */
  superadmin: boolean;
  access: Partial<Record<AdminSectionId, AccessLevel>>;
  /** Loqal roles assigned by a Full Admin; permissions are their union. */
  roles?: LoqalRoleId[];
  /** Time off: ISO yyyy-mm-dd the member is away until (inclusive). */
  awayUntil?: string;
  /** Kind of absence shown on the dashboard ("Out of office", "Sick leave"…). */
  awayReason?: string;
};

type StaffState = { members: StaffMember[] };

const STORAGE_KEY = "loqal.staff.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const ALL_SECTIONS = Object.keys(ADMIN_SECTION_LABEL) as AdminSectionId[];

function fullAccess(): Record<AdminSectionId, AccessLevel> {
  return Object.fromEntries(ALL_SECTIONS.map((s) => [s, "approve"])) as Record<
    AdminSectionId,
    AccessLevel
  >;
}

const SEED: StaffMember[] = [
  {
    id: "st-eleonora",
    name: "Eleonora Pole",
    email: "eleonora@loqal.example",
    title: "Founder · Superadmin",
    superadmin: true,
    access: fullAccess(),
    roles: ["full_admin"],
  },
  {
    id: "st-daniel",
    name: "Daniel Kris",
    email: "daniel@loqal.example",
    title: "Operations manager",
    superadmin: false,
    access: {
      overview: "view",
      cases: "approve",
      partners: "edit",
      employees: "view",
      accounting: "view",
      support: "edit",
      activity: "view",
      settings: "hidden",
    },
    roles: ["ops_manager", "mortgage_coordinator"],
  },
  {
    id: "st-anna",
    name: "Anna Berezina",
    email: "anna@loqal.example",
    title: "Client support",
    superadmin: false,
    access: {
      overview: "view",
      cases: "view",
      partners: "hidden",
      employees: "hidden",
      accounting: "hidden",
      support: "edit",
      activity: "view",
      settings: "hidden",
    },
    roles: ["support_specialist"],
  },
];

let state: StaffState | null = null;
const listeners = new Set<() => void>();

function load(): StaffState {
  if (state) return state;
  let next: StaffState = { members: SEED };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = (JSON.parse(raw) as Partial<StaffState>).members ?? [];
      // Always keep seeded superadmins present.
      const known = new Set(parsed.map((m) => m.id));
      next = { members: [...parsed, ...SEED.filter((s) => !known.has(s.id))] };
    }
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: StaffState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: StaffState = { members: [] };

export function accessOf(member: StaffMember, section: AdminSectionId): AccessLevel {
  if (member.superadmin) return "approve";
  return member.access[section] ?? "hidden";
}

export function useStaff() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const setAccess = useCallback((id: string, section: AdminSectionId, level: AccessLevel) => {
    const cur = load();
    commit({
      members: cur.members.map((m) =>
        m.id === id && !m.superadmin ? { ...m, access: { ...m.access, [section]: level } } : m,
      ),
    });
  }, []);

  const addMember = useCallback((input: Omit<StaffMember, "id" | "access" | "superadmin">) => {
    const cur = load();
    commit({
      members: [
        ...cur.members,
        {
          roles: [],
          ...input,
          id: uid(),
          superadmin: false,
          access: { overview: "view" },
        },
      ],
    });
  }, []);

  const setAway = useCallback((id: string, awayUntil: string, awayReason: string) => {
    const cur = load();
    commit({
      members: cur.members.map((m) =>
        m.id === id
          ? awayUntil
            ? { ...m, awayUntil, awayReason: awayReason || "Out of office" }
            : (({ awayUntil: _u, awayReason: _r, ...rest }) => rest)(m)
          : m,
      ),
    });
  }, []);

  /** Assign or remove one Loqal role for an employee. */
  const setRole = useCallback((id: string, role: LoqalRoleId, on: boolean) => {
    const cur = load();
    commit({
      members: cur.members.map((m) => {
        if (m.id !== id || m.superadmin) return m;
        const have = new Set(m.roles ?? []);
        if (on) have.add(role);
        else have.delete(role);
        return { ...m, roles: [...have] };
      }),
    });
  }, []);

  /** Edit an employee's own details (name, e-mail, job title). */
  const updateMember = useCallback(
    (id: string, patch: Partial<Pick<StaffMember, "name" | "email" | "title">>) => {
      const cur = load();
      commit({ members: cur.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
    },
    [],
  );

  return { members: snapshot.members, setAccess, addMember, setAway, setRole, updateMember };
}

/** Effective permissions of an employee (superadmins hold everything). */
export function permissionsOf(member: StaffMember): Permission[] {
  if (member.superadmin) return [...PERMISSION_ORDER];
  return permissionsOfRoles(member.roles ?? []);
}

/**
 * What the signed-in Loqal employee may do. Admin accounts that are not (yet)
 * on the employee roster are treated as Full Admins so the console is never
 * locked out.
 */
export function useMyPermissions(email: string | undefined, isAdmin: boolean) {
  const { members } = useStaff();
  const me = email ? members.find((m) => m.email.toLowerCase() === email.toLowerCase()) : undefined;
  const list = me ? permissionsOf(me) : isAdmin ? [...PERMISSION_ORDER] : [];
  return {
    member: me,
    permissions: list,
    can: (p: Permission) => list.includes(p),
  };
}
