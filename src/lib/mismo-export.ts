/**
 * Loqal loan-origination export.
 *
 * Mortgage lender partners transfer a client file from Loqal's internal loan
 * origination system into their own LOS instead of retyping it. The XML follows
 * the MISMO v3.4 residential reference model (the ULAD/URLA mapping used by
 * Fannie Mae's DU and Freddie Mac's LPA, and accepted by Encompass, Calyx
 * Point, Byte and friends): MESSAGE > DEAL_SETS > DEAL_SET > DEALS > DEAL with
 * ASSETS, COLLATERALS, LIABILITIES, LOANS and PARTIES.
 *
 * Everything Loqal-specific (LQ client number, assigned partners, purchase
 * stage, deadlines) is carried in an EXTENSION/OTHER block so a standard MISMO
 * parser ignores it while a Loqal-aware one can read it.
 */

import type { MortgageLead } from "@/lib/leads";
import {
  US_STATUS_LABEL,
  isForeignIncome,
  monthlyForIncome,
  normalizeAssets,
  num,
  totalLiabilities,
  totalMonthlyIncome,
  usStatusOf,
  type AssetEntry,
  type Declarations,
  type IncomeSource,
} from "@/lib/mortgage-form";
import { loqalNumber } from "@/lib/user-id";
import { PURCHASE_STAGE_LABEL, type PurchaseProgress } from "@/lib/purchase-stage";

export const MISMO_VERSION = "3.4.032420160128";
export const LOQAL_LOS_NAME = "Loqal Loan Origination System";
export const LOQAL_LOS_VERSION = "1.0";

export type ExportOptions = { progress?: PurchaseProgress | undefined };

/* ------------------------------------------------------------- utilities */

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const amount = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** MISMO dates are ISO yyyy-mm-dd. Accepts yyyy-mm or ISO datetimes too. */
function isoDate(v?: string): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return "";
}

type Node = string;

function el(tag: string, value?: string | number | boolean): Node {
  if (value === undefined || value === null || value === "") return "";
  return `<${tag}>${esc(String(value))}</${tag}>`;
}

function group(tag: string, children: Node[], attrs = ""): Node {
  const body = children.filter(Boolean);
  if (!body.length) return "";
  return `<${tag}${attrs ? ` ${attrs}` : ""}>${body.join("")}</${tag}>`;
}

/** Pretty-print the single-line XML with tab indentation. */
function indent(xml: string): string {
  const parts = xml.replace(/></g, ">\n<").split("\n");
  let depth = 0;
  return parts
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const out = `${"\t".repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/^<[^>]+>.*<\/[^>]+>$/.test(line)) depth += 1;
      return out;
    })
    .join("\n");
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() ?? "";
  const last = parts.pop() ?? "";
  return { first, middle: parts.join(" "), last };
}

/* ----------------------------------------------------------- MISMO enums */

const ASSET_TYPE: Record<string, string> = {
  checking: "CheckingAccount",
  savings: "SavingsAccount",
  safety_deposit: "TrustAccount",
  cash_liquid: "CashOnHand",
};

function assetNode(a: AssetEntry, seq: number): Node {
  const label = `ASSET_${seq}`;
  if (a.type === "real_estate") {
    return group(
      "ASSET",
      [
        group("ASSET_DETAIL", [
          el("AssetCashOrMarketValueAmount", amount(num(a.value))),
          el("AssetType", "NetEquity"),
          el("AssetTypeOtherDescription", a.address || "Real estate owned"),
        ]),
      ],
      `SequenceNumber="${seq}" xlink:label="${label}"`,
    );
  }
  const type =
    a.type === "investment_account"
      ? "Stock"
      : a.type === "other"
        ? "OtherLiquidAssets"
        : (ASSET_TYPE[a.kind] ?? "CheckingAccount");
  return group(
    "ASSET",
    [
      group("ASSET_DETAIL", [
        el("AssetCashOrMarketValueAmount", amount(num(a.value))),
        el("AssetType", type),
        el("AssetTypeOtherDescription", a.description),
      ]),
      a.institution
        ? group("ASSET_HOLDER", [group("NAME", [el("FullName", a.institution)])])
        : "",
    ],
    `SequenceNumber="${seq}" xlink:label="${label}"`,
  );
}

function liabilityNode(type: string, monthly: number, seq: number, holder?: string): Node {
  if (monthly <= 0) return "";
  return group(
    "LIABILITY",
    [
      group("LIABILITY_DETAIL", [
        el("LiabilityExclusionIndicator", false),
        el("LiabilityMonthlyPaymentAmount", amount(monthly)),
        el("LiabilityType", type),
      ]),
      holder ? group("LIABILITY_HOLDER", [group("NAME", [el("FullName", holder)])]) : "",
    ],
    `SequenceNumber="${seq}" xlink:label="LIABILITY_${seq}"`,
  );
}

function employerNode(s: IncomeSource, seq: number): Node {
  const monthly = monthlyForIncome(s);
  return group(
    "EMPLOYER",
    [
      group("LEGAL_ENTITY", [
        group("LEGAL_ENTITY_DETAIL", [el("FullName", s.employer || "Not stated")]),
      ]),
      group("ADDRESS", [
        el("AddressLineText", s.address.street),
        el("CityName", s.address.city),
        el("CountryCode", s.address.country || "US"),
        el("PostalCode", s.address.zip),
        el("StateCode", s.address.state),
      ]),
      group("EMPLOYMENT", [
        el("EmploymentBorrowerSelfEmployedIndicator", s.type === "self_employed"),
        el("EmploymentClassificationType", s.type === "seasonal" ? "Seasonal" : "Primary"),
        el("EmploymentPositionDescription", s.title),
        el("EmploymentStartDate", isoDate(s.from)),
        s.current ? "" : el("EmploymentEndDate", isoDate(s.to)),
        el("EmploymentStatusType", s.current ? "Current" : "Previous"),
        el("EmploymentMonthlyIncomeAmount", amount(monthly)),
        el("SpecialBorrowerEmployerRelationshipIndicator", s.relatedParty !== "none"),
        s.ownershipPct ? el("EmploymentOwnershipInterestPercent", s.ownershipPct) : "",
        isForeignIncome(s) ? el("EmploymentIncomeCurrencyType", s.currency) : "",
      ]),
    ],
    `SequenceNumber="${seq}" xlink:label="EMPLOYER_${seq}"`,
  );
}

function declarationNodes(d?: Declarations): Node {
  if (!d) return "";
  return group("DECLARATION", [
    group("DECLARATION_DETAIL", [
      el("BankruptcyIndicator", d.bankruptcy),
      el("BorrowedDownPaymentIndicator", d.borrowingOtherMoney),
      el("CitizenshipResidencyType", ""),
      el("CoMakerEndorserOfNoteIndicator", d.coSignerOrGuarantor),
      el("HomeownerPastThreeYearsType", d.ownershipInterestLast3Years ? "Yes" : "No"),
      el("IntentToOccupyType", d.primaryResidence ? "Yes" : "No"),
      el("OutstandingJudgmentsIndicator", d.outstandingJudgments),
      el("PartyToLawsuitIndicator", d.partyToLawsuit),
      el("PresentlyDelinquentIndicator", d.delinquentFederalDebt),
      el("PriorForeclosureCompletedIndicator", d.propertyForeclosed),
      el("PriorityLienIndicator", d.priorityLien),
      el("PropertyDeedInLieuConveyedIndicator", d.conveyedTitleInLieu),
      el("PropertyShortSaleCompletedIndicator", d.preForeclosureOrShortSale),
      el("UndisclosedBorrowedFundsIndicator", d.borrowingOtherMoney),
      d.borrowingOtherAmount
        ? el("UndisclosedBorrowedFundsAmount", amount(num(d.borrowingOtherAmount)))
        : "",
      el("UndisclosedMortgageApplicationIndicator", d.applyingOtherMortgage),
      el("UndisclosedCreditApplicationIndicator", d.applyingNewCredit),
    ]),
    d.bankruptcy
      ? group("DECLARATION_DETAILS", [
          group("BANKRUPTCIES", [
            group("BANKRUPTCY", [
              group("BANKRUPTCY_DETAIL", [
                el("BankruptcyChaptersTypeOtherDescription", d.bankruptcyChapters.join(", ")),
              ]),
            ]),
          ]),
        ])
      : "",
  ]);
}

/* ------------------------------------------------------------------ main */

export function buildMismoXml(lead: MortgageLead, opts: ExportOptions = {}): string {
  const p = lead.profile;
  const t = lead.terms;
  const progress = opts.progress;
  const name = splitName(lead.clientName);
  const incomes = p.incomes ?? [];
  const monthlyIncome = incomes.length ? totalMonthlyIncome(incomes) : p.monthlyGross;
  const assets = normalizeAssets(p.assets).entries.filter(
    (a) => a.value || a.institution || a.address || a.description,
  );
  const liab = p.liabilities;
  const loanAmount = t ? lead.propertyPrice * (1 - t.downPaymentPct / 100) : 0;
  const status = usStatusOf(p, lead.usPerson);
  const closing = progress?.closingDate ? isoDate(progress.closingDate) : "";

  const subjectState =
    p.addresses.find((a) => a.present)?.state ?? p.addresses[0]?.state ?? "";

  const deal = group("DEAL", [
    group(
      "ASSETS",
      assets.map((a, i) => assetNode(a, i + 1)),
    ),
    group("COLLATERALS", [
      group("COLLATERAL", [
        group("SUBJECT_PROPERTY", [
          group("ADDRESS", [
            el("AddressLineText", lead.propertyLabel),
            el("CountryCode", "US"),
            el("StateCode", subjectState),
          ]),
          group("PROPERTY_DETAIL", [
            el("FinancedUnitCount", 1),
            el("PropertyEstateType", "FeeSimple"),
            el(
              "PropertyUsageType",
              p.propertyUse === "investment"
                ? "Investment"
                : p.propertyUse === "vacation"
                  ? "SecondHome"
                  : "PrimaryResidence",
            ),
          ]),
          group("PROPERTY_VALUATIONS", [
            group("PROPERTY_VALUATION", [
              group("PROPERTY_VALUATION_DETAIL", [
                el("PropertyValuationAmount", amount(lead.propertyPrice)),
              ]),
            ]),
          ]),
          group("SALES_CONTRACTS", [
            group("SALES_CONTRACT", [
              group("SALES_CONTRACT_DETAIL", [
                el(
                  "SalesContractAmount",
                  amount(progress?.agreedPrice ?? lead.propertyPrice),
                ),
                closing ? el("RealEstatePurchaseContractDate", closing) : "",
              ]),
            ]),
          ]),
        ]),
      ]),
    ]),
    group(
      "LIABILITIES",
      [
        liabilityNode("MortgageLoan", num(liab?.propertyLoans), 1),
        liabilityNode("Installment", num(liab?.vehicleLoans), 2, "Vehicle loans"),
        liabilityNode("Revolving", num(liab?.creditCards), 3, "Credit cards"),
        liabilityNode("Installment", num(liab?.studentLoans), 4, "Student loans"),
        ...(liab?.other ?? []).map((o, i) =>
          liabilityNode("Open30DayChargeAccount", num(o.amount), 10 + i, o.label),
        ),
      ].filter(Boolean),
    ),
    group("LOANS", [
      group(
        "LOAN",
        [
          t
            ? group("AMORTIZATION", [
                group("AMORTIZATION_RULE", [
                  el("AmortizationType", "Fixed"),
                  el("LoanAmortizationPeriodCount", t.termYears * 12),
                  el("LoanAmortizationPeriodType", "Month"),
                ]),
              ])
            : "",
          t
            ? group("DOCUMENT_SPECIFIC_DATA_SETS", [
                group("DOCUMENT_SPECIFIC_DATA_SET", [
                  group("URLA", [
                    group("URLA_DETAIL", [
                      el("BorrowerRequestedLoanAmount", amount(loanAmount)),
                      el(
                        "EstimatedClosingCostsAmount",
                        amount((lead.propertyPrice * t.closingCostPct) / 100),
                      ),
                    ]),
                  ]),
                ]),
              ])
            : "",
          group("LOAN_DETAIL", [
            el("ApplicationReceivedDate", isoDate(lead.submittedAt)),
            el("BorrowerCount", 1),
            el("ConstructionLoanIndicator", false),
            el("InterestOnlyIndicator", false),
            el("PrepaymentPenaltyIndicator", false),
          ]),
          group("LOAN_IDENTIFIERS", [
            group("LOAN_IDENTIFIER", [
              el("LoanIdentifier", `${loqalNumber(lead.clientEmail)}-${lead.id}`),
              el("LoanIdentifierType", "LenderLoan"),
            ]),
          ]),
          group("ORIGINATION_SYSTEMS", [
            group("ORIGINATION_SYSTEM", [
              el("LoanOriginationSystemName", LOQAL_LOS_NAME),
              el("LoanOriginationSystemVendorIdentifier", "LOQAL"),
              el("LoanOriginationSystemVersionIdentifier", LOQAL_LOS_VERSION),
            ]),
          ]),
          t
            ? group("QUALIFICATION", [
                group("QUALIFICATION_DETAIL", [
                  el("TotalDebtExpenseRatioPercent", (lead.dtiLimit * 100).toFixed(2)),
                ]),
              ])
            : "",
          t
            ? group("TERMS_OF_LOAN", [
                el("BaseLoanAmount", amount(loanAmount)),
                el("LienPriorityType", "FirstLien"),
                el("LoanPurposeType", "Purchase"),
                el("MortgageType", "Conventional"),
                el("NoteRatePercent", t.ratePct),
              ])
            : "",
        ],
        'LoanRoleType="SubjectLoan" xlink:label="LOAN_1"',
      ),
    ]),
    group("PARTIES", [
      group(
        "PARTY",
        [
          group("INDIVIDUAL", [
            group("CONTACT_POINTS", [
              lead.clientEmail
                ? group("CONTACT_POINT", [
                    group("CONTACT_POINT_EMAIL", [el("ContactPointEmailValue", lead.clientEmail)]),
                    group("CONTACT_POINT_DETAIL", [el("ContactPointRoleType", "Home")]),
                  ])
                : "",
            ]),
            group("NAME", [
              el("FirstName", name.first),
              el("LastName", name.last),
              el("MiddleName", name.middle),
            ]),
          ]),
          group("ROLES", [
            group(
              "ROLE",
              [
                group("BORROWER", [
                  group("BORROWER_DETAIL", [
                    el("BorrowerBirthDate", isoDate(p.dateOfBirth)),
                    el("BorrowerClassificationType", "Primary"),
                    el("DependentCount", (p.dependents ?? []).length),
                    el(
                      "DependentsAgesDescription",
                      (p.dependents ?? []).map((d) => d.age).filter(Boolean).join(", "),
                    ),
                    el(
                      "MaritalStatusType",
                      p.maritalStatus === "married"
                        ? "Married"
                        : p.maritalStatus === "separated"
                          ? "Separated"
                          : "Unmarried",
                    ),
                  ]),
                  group("DECLARATIONS", [declarationNodes(p.declarations)]),
                  group(
                    "EMPLOYERS",
                    incomes.map((s, i) => employerNode(s, 100 + i + 1)),
                  ),
                  group("CURRENT_INCOME", [
                    group("CURRENT_INCOME_ITEMS", [
                      group("CURRENT_INCOME_ITEM", [
                        group("CURRENT_INCOME_ITEM_DETAIL", [
                          el("CurrentIncomeMonthlyTotalAmount", amount(monthlyIncome)),
                          el("IncomeType", "Base"),
                        ]),
                      ]),
                    ]),
                  ]),
                  p.military
                    ? group("MILITARY_SERVICES", [
                        group("MILITARY_SERVICE", [
                          group("MILITARY_SERVICE_DETAIL", [
                            el("MilitaryStatusType", p.military.activeDuty ? "ActiveDuty" : ""),
                            el("MilitaryServiceExpectedCompletionDate", isoDate(p.military.activeDutyExpiration)),
                            el("VeteranIndicator", p.military.retiredOrDischarged),
                            el("SpouseVeteranIndicator", p.military.survivingSpouse),
                          ]),
                        ]),
                      ])
                    : "",
                  group(
                    "RESIDENCES",
                    p.addresses.map((a, i) =>
                      group(
                        "RESIDENCE",
                        [
                          group("ADDRESS", [
                            el("AddressLineText", a.street),
                            el("CityName", a.city),
                            el("CountryCode", a.country || "US"),
                            el("PostalCode", a.zip),
                            el("StateCode", a.state),
                          ]),
                          group("RESIDENCE_DETAIL", [
                            el("BorrowerResidencyBasisType", "Rent"),
                            el("BorrowerResidencyStartDate", isoDate(a.from)),
                            a.present ? "" : el("BorrowerResidencyEndDate", isoDate(a.to)),
                            el("BorrowerResidencyType", a.present ? "Current" : "Prior"),
                          ]),
                        ],
                        `SequenceNumber="${i + 1}" xlink:label="RESIDENCE_${i + 1}"`,
                      ),
                    ),
                  ),
                  group("GOVERNMENT_MONITORING", [
                    group("GOVERNMENT_MONITORING_DETAIL", [
                      el(
                        "GenderType",
                        p.demographics?.sex === "female"
                          ? "Female"
                          : p.demographics?.sex === "male"
                            ? "Male"
                            : "InformationNotProvided",
                      ),
                      el("HMDAEthnicityRefusalIndicator", Boolean(p.demographics?.ethnicityDeclined)),
                      el("HMDARaceRefusalIndicator", Boolean(p.demographics?.raceDeclined)),
                      el("RaceNationalOriginRefusalIndicator", Boolean(p.demographics?.raceDeclined)),
                    ]),
                  ]),
                ]),
                group("ROLE_DETAIL", [el("PartyRoleType", "Borrower")]),
                group("TAXPAYER_IDENTIFIERS", [
                  group("TAXPAYER_IDENTIFIER", [
                    el(
                      "TaxpayerIdentifierType",
                      lead.usPerson ? "SocialSecurityNumber" : p.hasItin ? "IndividualTaxpayerIdentificationNumber" : "",
                    ),
                    el("TaxpayerIdentifierValue", lead.usPerson ? p.ssn : p.itin),
                  ]),
                ]),
              ],
              'SequenceNumber="1" xlink:label="BORROWER_1"',
            ),
          ]),
        ],
        'SequenceNumber="1" xlink:label="PARTY_1"',
      ),
      lead.lenderPartnerName
        ? group(
            "PARTY",
            [
              group("LEGAL_ENTITY", [
                group("LEGAL_ENTITY_DETAIL", [el("FullName", lead.lenderPartnerName)]),
              ]),
              group("ROLES", [
                group("ROLE", [group("ROLE_DETAIL", [el("PartyRoleType", "LoanOriginationCompany")])]),
              ]),
            ],
            'SequenceNumber="2" xlink:label="PARTY_2"',
          )
        : "",
    ]),
    /* Loqal-specific payload — ignored by standard MISMO parsers. */
    group("EXTENSION", [
      group("OTHER", [
        group("LOQAL_CLIENT_FILE", [
          el("LoqalClientIdentifier", loqalNumber(lead.clientEmail)),
          el("LoqalFileIdentifier", lead.id),
          el("LoqalUsStatus", US_STATUS_LABEL[status]),
          el("LoqalVisaValidUntil", isoDate(p.visaValidUntil)),
          el("LoqalSoftCreditScore", lead.creditScore),
          el("LoqalDebtToIncomeCeilingPercent", (lead.dtiLimit * 100).toFixed(2)),
          el("LoqalTotalAssetsAmount", amount(assets.reduce((s, a) => s + num(a.value), 0))),
          el(
            "LoqalMonthlyLiabilitiesAmount",
            liab ? amount(totalLiabilities(liab)) : "",
          ),
          el("LoqalLendingPartnerName", lead.lenderPartnerName),
          el("LoqalBuyerAgentName", lead.buyerAgent?.agentName),
          progress ? el("LoqalPurchaseStage", PURCHASE_STAGE_LABEL[progress.stage]) : "",
          progress?.agreedPrice ? el("LoqalAgreedPurchasePrice", amount(progress.agreedPrice)) : "",
          progress?.signedAt ? el("LoqalAgreementSignedDate", isoDate(progress.signedAt)) : "",
          closing ? el("LoqalClosingDate", closing) : "",
          progress?.approvalDueDate
            ? el("LoqalMortgageApprovalDueDate", isoDate(progress.approvalDueDate))
            : "",
          el("LoqalExportDatetime", new Date().toISOString()),
        ]),
      ]),
    ]),
  ]);

  const body = group(
    "MESSAGE",
    [
      group("ABOUT_VERSIONS", [
        group("ABOUT_VERSION", [
          el("AboutVersionIdentifier", `${LOQAL_LOS_NAME} ${LOQAL_LOS_VERSION}`),
          el("CreatedDatetime", new Date().toISOString().replace(/\.\d+Z$/, "Z")),
        ]),
      ]),
      group("DEAL_SETS", [group("DEAL_SET", [group("DEALS", [deal])])]),
    ],
    [
      `MISMOReferenceModelIdentifier="${MISMO_VERSION}"`,
      'xmlns="http://www.mismo.org/residential/2009/schemas"',
      'xmlns:ULAD="http://www.datamodelextension.org/Schema/ULAD"',
      'xmlns:xlink="http://www.w3.org/1999/xlink"',
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    ].join(" "),
  );

  return `<?xml version="1.0" encoding="utf-8"?>\n${indent(body)}\n`;
}

/** loqal-client-file-LQ-123456-2026-09-19.xml */
export function exportFileName(lead: MortgageLead, ext: "xml" | "pdf"): string {
  const day = new Date().toISOString().slice(0, 10);
  return `loqal-client-file-${loqalNumber(lead.clientEmail)}-${day}.${ext}`;
}

export function downloadTextFile(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
