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
  declarations: Declarations;
  military: MilitaryService;
  /* step 4 */
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

export type StepProps = {
  data: QuestionnaireData;
  patch: (patch: Partial<QuestionnaireData>) => void;
  usPerson: boolean;
};
