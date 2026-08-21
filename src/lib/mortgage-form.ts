/**
 * Shared types + math for the multi-step mortgage pre-approval questionnaire.
 * Dates are stored ISO (yyyy-mm-dd / yyyy-mm); the UI always shows mm/dd/yyyy.
 */

export const uid = () => Math.random().toString(36).slice(2, 9);

/* ------------------------------------------------------------- marital */

export type MaritalStatus = "married" | "unmarried" | "separated";

export const MARITAL_LABEL: Record<MaritalStatus, string> = {
  married: "Married",
  unmarried: "Unmarried",
  separated: "Separated",
};

export type UnmarriedRelationship =
  "civil_union" | "domestic_partnership" | "registered_reciprocal" | "other";

export const UNMARRIED_RELATIONSHIP_LABEL: Record<UnmarriedRelationship, string> = {
  civil_union: "Civil union",
  domestic_partnership: "Domestic partnership",
  registered_reciprocal: "Registered reciprocal beneficiary relationship",
  other: "Other",
};

/** URLA "Unmarried Addendum" — only asked when marital status is Unmarried. */
export type UnmarriedAddendum = {
  /** Is there a person with real-property rights similar to a legal spouse? */
  hasSpousalEquivalent: boolean;
  relationship?: UnmarriedRelationship;
  otherRelationship?: string;
  /** USPS code of the state the relationship was formed in. */
  stateFormed?: string;
};

export type Dependent = { id: string; age: string };

/* ----------------------------------------------------------- US status */

export type UsStatus =
  | "citizen"
  | "green_card"
  | "work_visa"
  | "student_visa"
  | "protected_status"
  | "refugee"
  | "u4u"
  | "other"
  | "none";

export const US_STATUS_LABEL: Record<UsStatus, string> = {
  citizen: "US citizen",
  green_card: "Green card holder",
  work_visa: "Work visa",
  student_visa: "Student visa",
  protected_status: "Protected status",
  refugee: "Refugee status",
  u4u: "U4U (Uniting for Ukraine)",
  other: "Other visa / status",
  none: "No US status",
};

/** Visa options offered to non-US persons who hold an active US visa/status. */
export const VISA_STATUS_OPTIONS: UsStatus[] = [
  "work_visa",
  "student_visa",
  "protected_status",
  "refugee",
  "u4u",
  "other",
];

/* -------------------------------------------------------------- income */

export type IncomeType = "w2" | "self_employed" | "seasonal";

export const INCOME_TYPE_LABEL: Record<IncomeType, string> = {
  w2: "Base / W2 employee income",
  self_employed: "Business owner / self-employed",
  seasonal: "Seasonal / variable income",
};

export type PayType = "salary" | "hourly";

export type RelatedParty =
  "none" | "family_member" | "property_seller" | "real_estate_agent" | "other";

export const RELATED_PARTY_LABEL: Record<RelatedParty, string> = {
  none: "No — unrelated employer",
  family_member: "Yes — family member",
  property_seller: "Yes — the property seller",
  real_estate_agent: "Yes — the real estate agent",
  other: "Yes — another party to the transaction",
};

export type IncomeAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type IncomeSource = {
  id: string;
  type: IncomeType;

  /** Employer / business / payer name. */
  employer: string;
  title: string;
  address: IncomeAddress;
  from: string;
  to: string;
  current: boolean;

  /** W2 employee */
  payType: PayType;
  /** Annual gross salary (monthly is derived). */
  annualSalary: string;
  hourlyRate: string;
  monthlyHours: string;
  relatedParty: RelatedParty;
  relatedPartyDetail: string;

  /** Self-employed */
  ownershipPct: string;
  businessType: string;
  /** Annual income — last year (US persons only, optional). */
  annualIncomeLastYear: string;
  /** Estimated annual income for the current year. */
  estimatedAnnualIncome: string;

  /** Seasonal */
  seasonMonthlyGross: string;
  monthsPerYear: string;

  /** Set automatically when the employer address is outside the US. */
  currency: string;
  /** Units of USD per 1 unit of `currency`. */
  fxRate: string;
};

export const emptyIncomeAddress = (): IncomeAddress => ({
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
});

export const emptyIncome = (type: IncomeType = "w2"): IncomeSource => ({
  id: uid(),
  type,
  employer: "",
  title: "",
  address: emptyIncomeAddress(),
  from: "",
  to: "",
  current: true,
  payType: "salary",
  annualSalary: "",
  hourlyRate: "",
  monthlyHours: "",
  relatedParty: "none",
  relatedPartyDetail: "",
  ownershipPct: "",
  businessType: "",
  annualIncomeLastYear: "",
  estimatedAnnualIncome: "",
  seasonMonthlyGross: "",
  monthsPerYear: "",
  currency: "",
  fxRate: "",
});

export const num = (v?: string) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

/** Income earned outside the US (employer/business address is not US). */
export function isForeignIncome(s: IncomeSource): boolean {
  return Boolean(s.address.country) && s.address.country !== "US";
}

export function hasForeignIncome(sources: IncomeSource[]): boolean {
  return sources.some(isForeignIncome);
}

/** Monthly gross in the source's own currency (before FX). */
export function monthlyNativeForIncome(s: IncomeSource): number {
  switch (s.type) {
    case "w2":
      return s.payType === "hourly"
        ? num(s.hourlyRate) * num(s.monthlyHours)
        : num(s.annualSalary) / 12;
    case "self_employed": {
      const years = [num(s.annualIncomeLastYear), num(s.estimatedAnnualIncome)].filter(
        (n) => n > 0,
      );
      if (!years.length) return 0;
      return years.reduce((a, b) => a + b, 0) / years.length / 12;
    }
    case "seasonal": {
      const months = Math.min(12, num(s.monthsPerYear));
      return (num(s.seasonMonthlyGross) * months) / 12;
    }
    default:
      return 0;
  }
}

/** Averaged monthly gross for one income source, normalized to USD. */
export function monthlyForIncome(s: IncomeSource): number {
  const native = monthlyNativeForIncome(s);
  if (!isForeignIncome(s)) return native;
  return native * (num(s.fxRate) || 1);
}

export function totalMonthlyIncome(sources: IncomeSource[]): number {
  return sources.reduce((sum, s) => sum + monthlyForIncome(s), 0);
}

/* -------------------------------------------------------- declarations */

export type Declarations = {
  primaryResidence: boolean;
  ownershipInterestLast3Years: boolean;
  priorPropertyType: string;
  priorTitleHeld: string;
  familyOrBusinessWithSeller: boolean;
  borrowingOtherMoney: boolean;
  borrowingOtherAmount: string;
  applyingOtherMortgage: boolean;
  applyingNewCredit: boolean;
  priorityLien: boolean;
  coSignerOrGuarantor: boolean;
  outstandingJudgments: boolean;
  delinquentFederalDebt: boolean;
  partyToLawsuit: boolean;
  conveyedTitleInLieu: boolean;
  preForeclosureOrShortSale: boolean;
  propertyForeclosed: boolean;
  bankruptcy: boolean;
  bankruptcyChapters: string[];
};

export const emptyDeclarations = (): Declarations => ({
  primaryResidence: false,
  ownershipInterestLast3Years: false,
  priorPropertyType: "",
  priorTitleHeld: "",
  familyOrBusinessWithSeller: false,
  borrowingOtherMoney: false,
  borrowingOtherAmount: "",
  applyingOtherMortgage: false,
  applyingNewCredit: false,
  priorityLien: false,
  coSignerOrGuarantor: false,
  outstandingJudgments: false,
  delinquentFederalDebt: false,
  partyToLawsuit: false,
  conveyedTitleInLieu: false,
  preForeclosureOrShortSale: false,
  propertyForeclosed: false,
  bankruptcy: false,
  bankruptcyChapters: [],
});

export type MilitaryService = {
  served: boolean;
  activeDuty: boolean;
  activeDutyExpiration: string;
  retiredOrDischarged: boolean;
  reserveOrNationalGuardOnly: boolean;
  survivingSpouse: boolean;
};

export const emptyMilitary = (): MilitaryService => ({
  served: false,
  activeDuty: false,
  activeDutyExpiration: "",
  retiredOrDischarged: false,
  reserveOrNationalGuardOnly: false,
  survivingSpouse: false,
});

/* -------------------------------------------------------- demographics */

export const ETHNICITY_OPTIONS = [
  "Hispanic or Latino",
  "Mexican",
  "Puerto Rican",
  "Cuban",
  "Other Hispanic or Latino",
  "Not Hispanic or Latino",
] as const;

export const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Asian Indian",
  "Chinese",
  "Filipino",
  "Japanese",
  "Korean",
  "Vietnamese",
  "Other Asian",
  "Black or African American",
  "Native Hawaiian or Other Pacific Islander",
  "Native Hawaiian",
  "Guamanian or Chamorro",
  "Samoan",
  "Other Pacific Islander",
  "White",
] as const;

export type Demographics = {
  ethnicity: string[];
  ethnicityOther: string;
  ethnicityDeclined: boolean;
  race: string[];
  raceOther: string;
  raceDeclined: boolean;
  sex: "female" | "male" | "declined" | "";
};

export const emptyDemographics = (): Demographics => ({
  ethnicity: [],
  ethnicityOther: "",
  ethnicityDeclined: false,
  race: [],
  raceOther: "",
  raceDeclined: false,
  sex: "",
});

/* --------------------------------------------------------------- assets */

export type AssetType =
  "checking" | "savings" | "safety_deposit" | "cash_liquid" | "investments" | "other";

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  checking: "Checking account",
  savings: "Savings account",
  safety_deposit: "Safety deposit account",
  cash_liquid: "Liquid cash",
  investments: "Investments / securities",
  other: "Other asset",
};

export type FinancialAsset = {
  id: string;
  type: AssetType;
  institution: string;
  country: string;
  currency: string;
  value: string;
  description: string;
};

export type PropertyAsset = {
  id: string;
  address: string;
  country: string;
  estimatedValue: string;
  currency: string;
};

export type Assets = {
  financial: FinancialAsset[];
  properties: PropertyAsset[];
};

export const emptyFinancialAsset = (): FinancialAsset => ({
  id: uid(),
  type: "checking",
  institution: "",
  country: "US",
  currency: "USD",
  value: "",
  description: "",
});

export const emptyPropertyAsset = (): PropertyAsset => ({
  id: uid(),
  address: "",
  country: "US",
  estimatedValue: "",
  currency: "USD",
});

export const emptyAssets = (): Assets => ({ financial: [emptyFinancialAsset()], properties: [] });

export function totalAssets(a?: Assets): number {
  if (!a) return 0;
  return (
    a.financial.reduce((sum, x) => sum + num(x.value), 0) +
    a.properties.reduce((sum, x) => sum + num(x.estimatedValue), 0)
  );
}

/* ---------------------------------------------------------- liabilities */

export type OtherLiability = { id: string; label: string; amount: string };

export type Liabilities = {
  propertyLoans: string;
  vehicleLoans: string;
  creditCards: string;
  studentLoans: string;
  other: OtherLiability[];
};

export const emptyLiabilities = (): Liabilities => ({
  propertyLoans: "",
  vehicleLoans: "",
  creditCards: "",
  studentLoans: "",
  other: [],
});

export function totalLiabilities(l: Liabilities): number {
  return (
    num(l.propertyLoans) +
    num(l.vehicleLoans) +
    num(l.creditCards) +
    num(l.studentLoans) +
    l.other.reduce((sum, o) => sum + num(o.amount), 0)
  );
}

/* ---------------------------------------------------------------- steps */

export const QUESTIONNAIRE_STEPS = [
  { id: 1, title: "Personal, citizenship & addresses" },
  { id: 2, title: "Work, income & identification" },
  { id: 3, title: "Assets & liabilities" },
  { id: 4, title: "Declarations & military service" },
  { id: 5, title: "Demographic information" },
] as const;

/* ------------------------------------------------------------ us status */

/** Derive the US status shown to lending partners from a mortgage profile. */
export function usStatusOf(
  profile: { usStatus?: UsStatus; visaType?: UsStatus; usVisaActive?: boolean } | undefined,
  usPerson: boolean,
): UsStatus {
  if (profile?.usStatus) return profile.usStatus;
  if (usPerson) return "citizen";
  if (profile?.usVisaActive && profile.visaType) return profile.visaType;
  return "none";
}
