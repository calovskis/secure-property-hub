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
  | "civil_union"
  | "domestic_partnership"
  | "registered_reciprocal"
  | "other";

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

/* -------------------------------------------------------------- income */

export type IncomeType = "w2" | "self_employed" | "foreign" | "seasonal";

export const INCOME_TYPE_LABEL: Record<IncomeType, string> = {
  w2: "Base / W-2 employee income",
  self_employed: "Business owner / self-employed",
  foreign: "Foreign income",
  seasonal: "Seasonal / variable income",
};

export type PayType = "salary" | "hourly";

export type RelatedParty = "none" | "family_member" | "property_seller" | "real_estate_agent" | "other";

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

  /** W-2 employee */
  payType: PayType;
  salaryMonthly: string;
  hourlyRate: string;
  monthlyHours: string;
  relatedParty: RelatedParty;
  relatedPartyDetail: string;

  /** Self-employed */
  ownershipPct: string;
  businessType: string;
  netIncomeYear1: string;
  netIncomeYear2: string;

  /** Seasonal */
  seasonMonthlyGross: string;
  monthsPerYear: string;

  /** Foreign */
  currency: string;
  monthlyGrossForeign: string;
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
  salaryMonthly: "",
  hourlyRate: "",
  monthlyHours: "",
  relatedParty: "none",
  relatedPartyDetail: "",
  ownershipPct: "",
  businessType: "",
  netIncomeYear1: "",
  netIncomeYear2: "",
  seasonMonthlyGross: "",
  monthsPerYear: "",
  currency: "",
  monthlyGrossForeign: "",
  fxRate: "",
});

export const num = (v?: string) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

/** Averaged monthly gross for one income source, normalized to USD. */
export function monthlyForIncome(s: IncomeSource): number {
  switch (s.type) {
    case "w2":
      return s.payType === "hourly" ? num(s.hourlyRate) * num(s.monthlyHours) : num(s.salaryMonthly);
    case "self_employed": {
      const years = [num(s.netIncomeYear1), num(s.netIncomeYear2)].filter((n) => n > 0);
      if (!years.length) return 0;
      return years.reduce((a, b) => a + b, 0) / years.length / 12;
    }
    case "seasonal": {
      const months = Math.min(12, num(s.monthsPerYear));
      return (num(s.seasonMonthlyGross) * months) / 12;
    }
    case "foreign":
      return num(s.monthlyGrossForeign) * (num(s.fxRate) || 1);
    default:
      return 0;
  }
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

/* ---------------------------------------------------------- liabilities */

export type OtherLiability = { id: string; label: string; amount: string };

export type Liabilities = {
  propertyLoans: string;
  vehicleLoans: string;
  creditCards: string;
  studentLoans: string;
  alimonyChildSupport: string;
  insurance: string;
  other: OtherLiability[];
};

export const emptyLiabilities = (): Liabilities => ({
  propertyLoans: "",
  vehicleLoans: "",
  creditCards: "",
  studentLoans: "",
  alimonyChildSupport: "",
  insurance: "",
  other: [],
});

export function totalLiabilities(l: Liabilities): number {
  return (
    num(l.propertyLoans) +
    num(l.vehicleLoans) +
    num(l.creditCards) +
    num(l.studentLoans) +
    num(l.alimonyChildSupport) +
    num(l.insurance) +
    l.other.reduce((sum, o) => sum + num(o.amount), 0)
  );
}

/* ---------------------------------------------------------------- steps */

export const QUESTIONNAIRE_STEPS = [
  { id: 1, title: "Personal, citizenship & addresses" },
  { id: 2, title: "Work, income & identification" },
  { id: 3, title: "Monthly liabilities & declarations" },
  { id: 4, title: "Demographic information" },
] as const;
