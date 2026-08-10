import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Role = "client" | "corporate" | "partner" | "admin";
export type PartnerType = "realtor" | "lender" | "cleaning" | "other";

export const ROLE_LABEL: Record<Role, string> = {
  client: "Client",
  corporate: "Corporate client",
  partner: "Partner",
  admin: "Admin",
};

export const PARTNER_LABEL: Record<PartnerType, string> = {
  realtor: "Realtor",
  lender: "Mortgage lender",
  cleaning: "Cleaning service provider",
  other: "Other service provider",
};

export type AddressEntry = {
  id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  from: string;
  to: string;
};

export type EmploymentEntry = {
  id: string;
  employer: string;
  title: string;
  from: string;
  to: string;
  current: boolean;
};

export type MortgageProfile = {
  dateOfBirth: string;
  ssn?: string;
  ssnTermsAccepted: boolean;
  /** Non-US persons only */
  hasItin?: boolean;
  itin?: string;
  countryOfResidence?: string;
  citizenship?: string;
  addresses: AddressEntry[];
  employment: EmploymentEntry[];
  monthlyGross: number;
  submittedAt: string;
};

export type LoqalUser = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  usPerson: boolean;
  role: Role;
  partnerType?: PartnerType;
  companyName?: string;
  mortgageProfile?: MortgageProfile;
};

type AuthContextValue = {
  user: LoqalUser | null;
  ready: boolean;
  signIn: (user: LoqalUser) => void;
  signOut: () => void;
  updateUser: (patch: Partial<LoqalUser>) => void;
  saveMortgageProfile: (profile: MortgageProfile) => void;
  /** Financial modelling is gated for clients until they complete the profile. */
  canSeeEstimates: boolean;
};

const STORAGE_KEY = "loqal.session.v1";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoqalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as LoqalUser);
    } catch {
      /* ignore corrupted session */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: LoqalUser | null) => {
    setUser(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const privileged = user?.role === "admin" || user?.role === "partner";
    return {
      user,
      ready,
      signIn: (u) => persist(u),
      signOut: () => persist(null),
      updateUser: (patch) => persist(user ? { ...user, ...patch } : null),
      saveMortgageProfile: (profile) =>
        persist(user ? { ...user, mortgageProfile: profile } : null),
      canSeeEstimates: Boolean(user) && (privileged || Boolean(user?.mortgageProfile)),
    };
  }, [user, ready, persist]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function fullName(user: LoqalUser) {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

export function initials(user: LoqalUser) {
  return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "L";
}

export function homeRouteFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "partner") return "/partner";
  return "/";
}
