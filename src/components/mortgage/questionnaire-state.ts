import type { AddressEntry } from "@/lib/auth";
import {
  emptyDeclarations,
  emptyDemographics,
  emptyIncome,
  emptyLiabilities,
  emptyMilitary,
  uid,
  type Declarations,
  type Demographics,
  type Dependent,
  type IncomeSource,
  type Liabilities,
  type MaritalStatus,
  type MilitaryService,
  type UnmarriedAddendum,
  type UsStatus,
} from "@/lib/mortgage-form";

export const emptyAddress = (): AddressEntry => ({
  id: uid(),
  country: "US",
  street: "",
  city: "",
  state: "",
  zip: "",
  from: "",
  to: "",
  present: false,
});

export type QuestionnaireData = {
  /* step 1 */
  dob: string;
  maritalStatus: MaritalStatus | "";
  unmarried: UnmarriedAddendum;
  dependents: Dependent[];
  hasItin: boolean;
  itin: string;
  countryOfResidence: string;
  citizenship: string;
  secondCitizenship: string;
  visaActive: boolean;
  visaType: UsStatus | "";
  visaIssued: string;
  visaValidUntil: string;
  propertyUse: "vacation" | "investment" | "";
  usBankAccount: boolean;
  addresses: AddressEntry[];
  /* step 2 */
  ssn: string;
  ssnAccepted: boolean;
  incomes: IncomeSource[];
  /* step 3 */
  liabilities: Liabilities;
  /* step 4 */
  declarations: Declarations;
  military: MilitaryService;
  /* step 5 */
  demographics: Demographics;
};

export const emptyQuestionnaire = (): QuestionnaireData => ({
  dob: "",
  maritalStatus: "",
  unmarried: { hasSpousalEquivalent: false },
  dependents: [],
  hasItin: false,
  itin: "",
  countryOfResidence: "",
  citizenship: "",
  secondCitizenship: "",
  visaActive: false,
  visaType: "",
  visaIssued: "",
  visaValidUntil: "",
  propertyUse: "",
  usBankAccount: false,
  addresses: [emptyAddress()],
  ssn: "",
  ssnAccepted: false,
  incomes: [emptyIncome("w2")],
  liabilities: emptyLiabilities(),
  declarations: emptyDeclarations(),
  military: emptyMilitary(),
  demographics: emptyDemographics(),
});

/** Non-US persons without an ITIN and without US citizenship/green card skip liabilities. */
export function isNonUsWithoutTaxId(data: QuestionnaireData, usPerson: boolean): boolean {
  return !usPerson && !data.hasItin;
}

export type StepProps = {
  data: QuestionnaireData;
  patch: (patch: Partial<QuestionnaireData>) => void;
  usPerson: boolean;
};
