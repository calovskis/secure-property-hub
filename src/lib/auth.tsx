import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { joinName, nameInitials, namesFromEmail, normalizeName } from "@/lib/names";



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

import type {
  Declarations,
  Assets,
  Demographics,
  Dependent,
  IncomeSource,
  Liabilities,
  MaritalStatus,
  MilitaryService,
  UnmarriedAddendum,
  UsStatus,
} from "@/lib/mortgage-form";

export type AddressEntry = {
  id: string;
  /** ISO 3166-1 alpha-2 country code. */
  country?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  from: string;
  to: string;
  /** Ticked instead of a "to" date when this is where the applicant lives now. */
  present?: boolean;
};

export type EmploymentEntry = {
  id: string;
  employer: string;
  title: string;
  from: string;
  to: string;
  current: boolean;
};

/** A document the client uploaded and confirmed (name + optional data URL). */
export type StoredDocument = { id: string; name: string; uploadedAt: string; url?: string };

export type MortgageProfile = {
  dateOfBirth: string;
  ssn?: string;
  ssnTermsAccepted: boolean;
  /** Non-US persons only */
  hasItin?: boolean;
  itin?: string;
  countryOfResidence?: string;
  citizenship?: string;
  secondCitizenship?: string;
  usVisaActive?: boolean;
  visaIssued?: string;
  visaValidUntil?: string;
  /** Visa / status category when the applicant holds an active US visa. */
  visaType?: UsStatus;
  otherVisaType?: string;
  /** Overall US status shown to lending partners. */
  usStatus?: UsStatus;
  /** Uploaded copy of the visa document, when a visa was declared. */
  visaDocumentName?: string;
  visaDocumentUploadedAt?: string;
  visaDocuments?: StoredDocument[];
  /** US citizens / green card / ITIN holders: driver's license (front & back), green card or passport. */
  idDocuments?: StoredDocument[];
  /** Bankruptcy discharge papers — required when a bankruptcy was declared. */
  bankruptcyDocuments?: StoredDocument[];
  propertyUse?: "vacation" | "investment";
  usBankAccount?: boolean;
  /** Marital status + URLA unmarried addendum */
  maritalStatus?: MaritalStatus;
  unmarriedAddendum?: UnmarriedAddendum;
  dependents?: Dependent[];
  addresses: AddressEntry[];
  employment: EmploymentEntry[];
  /** Layered income sources (W2, self-employed, seasonal). */
  incomes?: IncomeSource[];
  liabilities?: Liabilities;
  assets?: Assets;
  declarations?: Declarations;
  military?: MilitaryService;
  demographics?: Demographics;
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
  /** Mortgage lender partners: company NMLS / licence number taken from registration. */
  lenderLicence?: string;
  mortgageProfile?: MortgageProfile;
};

type AuthContextValue = {
  user: LoqalUser | null;
  ready: boolean;
  /** Backend (Lovable Cloud) user id — present once a real session exists. */
  authUserId: string | null;
  signIn: (user: LoqalUser) => void;
  signOut: () => void;
  updateUser: (patch: Partial<LoqalUser>) => void;
  saveMortgageProfile: (profile: MortgageProfile) => void;
  /** Financial modelling is gated for clients until they complete the profile. */
  canSeeEstimates: boolean;
};

const STORAGE_KEY = "loqal.session.v1";
/** email → the name/phone last registered with, so logins keep proper names. */
const NAME_BOOK_KEY = "loqal.names.v1";

type KnownName = { firstName: string; middleName?: string; lastName: string; phone?: string };

function readNameBook(): Record<string, KnownName> {
  try {
    return JSON.parse(window.localStorage.getItem(NAME_BOOK_KEY) ?? "{}") as Record<
      string,
      KnownName
    >;
  } catch {
    return {};
  }
}

/** Remembers how a person spells their name, keyed by e-mail. */
export function rememberName(user: Pick<LoqalUser, "email" | "firstName" | "lastName"> & {
  middleName?: string;
  phone?: string;
}) {
  if (typeof window === "undefined" || !user.email) return;
  const key = user.email.trim().toLowerCase();
  const entry: KnownName = {
    firstName: normalizeName(user.firstName),
    lastName: normalizeName(user.lastName),
    ...(user.middleName ? { middleName: normalizeName(user.middleName) } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
  };
  if (!entry.firstName && !entry.lastName) return;
  try {
    window.localStorage.setItem(
      NAME_BOOK_KEY,
      JSON.stringify({ ...readNameBook(), [key]: entry }),
    );
  } catch {
    /* storage unavailable */
  }
}

/** The remembered name for an e-mail, if this browser has seen it before. */
export function knownName(email: string): KnownName | undefined {
  if (typeof window === "undefined" || !email) return undefined;
  return readNameBook()[email.trim().toLowerCase()];
}

/** Applies the platform-wide name rules to a session user. */
function normalizeUser(user: LoqalUser): LoqalUser {
  const fallback = namesFromEmail(user.email);
  const firstName = normalizeName(user.firstName) || fallback.firstName;
  const lastName = normalizeName(user.lastName) || (user.firstName ? "" : fallback.lastName);
  return {
    ...user,
    firstName,
    lastName,
    ...(user.middleName ? { middleName: normalizeName(user.middleName) } : {}),
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoqalUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(normalizeUser(JSON.parse(raw) as LoqalUser));
    } catch {
      /* ignore corrupted session */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setAuthUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const persist = useCallback((next: LoqalUser | null) => {
    const normalized = next ? normalizeUser(next) : null;
    setUser(normalized);
    if (normalized) rememberName(normalized);
    try {
      if (normalized) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  /**
   * Partners registered through /partner-access: the registration record is
   * the source of truth for their name, so the session adopts it.
   */
  useEffect(() => {
    if (!authUserId || !user) return;
    let active = true;
    void supabase
      .from("partner_requests")
      .select("first_name,last_name,company_name,phone")
      .eq("user_id", authUserId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const firstName = normalizeName(data.first_name);
        const lastName = normalizeName(data.last_name);
        if (!firstName && !lastName) return;
        if (firstName === user.firstName && lastName === user.lastName) return;
        persist({
          ...user,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(data.company_name && !user.companyName ? { companyName: data.company_name } : {}),
          ...(data.phone && !user.phone ? { phone: data.phone } : {}),
        });
      });
    return () => {
      active = false;
    };
  }, [authUserId, user, persist]);

  const value = useMemo<AuthContextValue>(() => {
    const privileged = user?.role === "admin" || user?.role === "partner";
    return {
      user,
      ready,
      authUserId,
      signIn: (u) => persist(u),
      signOut: () => {
        void supabase.auth.signOut();
        persist(null);
      },
      updateUser: (patch) => persist(user ? { ...user, ...patch } : null),
      saveMortgageProfile: (profile) =>
        persist(user ? { ...user, mortgageProfile: profile } : null),
      canSeeEstimates: Boolean(user) && (privileged || Boolean(user?.mortgageProfile)),
    };
  }, [user, ready, authUserId, persist]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function fullName(user: LoqalUser) {
  return joinName(user) || namesFromEmail(user.email).firstName;
}

export function initials(user: LoqalUser) {
  return nameInitials(user);
}

/** The first name to greet someone with. */
export function firstNameOf(user: Pick<LoqalUser, "firstName" | "email">) {
  return normalizeName(user.firstName) || namesFromEmail(user.email).firstName;
}

export function homeRouteFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "partner") return "/partner";
  return "/";
}

