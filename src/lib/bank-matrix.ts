/**
 * Bank eligibility — which bank the loan can be sold to.
 *
 * A Loqal mortgage lender partner does not keep the loan: before it confirms
 * the terms for the loan submission it needs to know which bank (investor)
 * will buy the loan afterwards, and on which matrix. This module holds the
 * published bank matrices we work with and matches a client file against them.
 *
 * Two tracks, exactly as the banks separate them:
 *
 *  - "conventional"      — borrowers with an SSN: US citizens, green card
 *                          holders and non-permanent residents with US credit;
 *  - "foreign_national"  — everybody else (no SSN / no US credit file).
 *
 * Every rule below is taken from the matrices supplied by the banks. Nothing is
 * invented: where a matrix says "per AUS" or "refer to guidelines" the check is
 * reported as a judgement call instead of a pass/fail.
 */
import { totalMonthlyObligations, type MortgageLead } from "@/lib/leads";
import { normalizeAssets, usStatusOf, type UsStatus } from "@/lib/mortgage-form";

export type BorrowerTrack = "conventional" | "itin" | "foreign_national";

export const TRACK_LABEL: Record<BorrowerTrack, string> = {
  conventional: "Conventional (SSN / US credit)",
  itin: "ITIN borrower",
  foreign_national: "Foreign national",
};

export type Occupancy = "primary" | "second" | "investment";

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  primary: "Primary residence",
  second: "Second home",
  investment: "Investment property",
};

/** Loan-amount band with its own maximum LTV (Champions-style matrices). */
export type LtvTier = {
  upTo: number;
  purchaseLtv: number;
  cashOutLtv?: number;
};

export type BankProgram = {
  id: string;
  bank: string;
  bankNmls?: string;
  program: string;
  track: BorrowerTrack;
  blurb: string;
  occupancy: Occupancy[];
  minLoan?: number;
  maxLoan: number;
  /** Loan must also exceed this amount (high-balance programs). */
  minLoanAbove?: number;
  maxPurchaseLtv: number;
  tiers?: LtvTier[];
  /** Minimum FICO, when the matrix states one. */
  minFico?: number;
  /** The matrix accepts a borrower with no US score (foreign credit). */
  noScoreAllowed: boolean;
  /** Maximum DTI; omitted where the matrix says "per AUS". */
  maxDti?: number;
  /** Income is not used at all (DSCR programs). */
  incomeNotRequired?: boolean;
  reservesMonths: number;
  /** A valid, unexpired US visa (or passport + I-797/I-94) is required. */
  visaRequired?: boolean;
  /** Qualifying assets must sit in US or Canadian institutions. */
  assetsUsCanadaOnly?: boolean;
  /** OFAC-sanctioned citizenships (incl. Russia and Belarus) are ineligible. */
  sanctionedCountriesExcluded?: boolean;
  /** Property ownership in the last N months required. */
  ownershipHistoryMonths?: number;
  /** Months out of a credit event (bankruptcy, foreclosure, short sale). */
  creditEventMonths?: number;
  /** States / locations the matrix excludes. */
  ineligibleLocations?: string[];
  /** Reserves by loan size (overrides reservesMonths). */
  reserveTiers?: { upTo: number; months: number }[];
  /**
   * Shared loan type — programmes with the same family follow the same
   * agency/product guideline at different banks, so the lender can choose.
   */
  family: string;
  /** Refinance-only programmes are kept in the catalogue but not matched to purchases. */
  refinanceOnly?: boolean;
  /** Guideline documents the programme is read from. */
  guidelines?: string[];
  /** The matrix terms shown to the lender, verbatim in substance. */
  terms: string[];
  source: string;
};

/** Human label for each shared loan type. */
export const FAMILY_LABEL: Record<string, string> = {
  "fannie-conforming": "Fannie Mae conforming",
  "fannie-high-balance": "Fannie Mae high balance",
  "freddie-conforming": "Freddie Mac conforming & high balance",
  "fannie-refinow": "Fannie Mae RefiNow (refinance)",
  jumbo: "Jumbo (above conforming limits)",
  "non-qm-full-doc": "Non-QM full documentation",
  "fn-full-doc": "Foreign national full doc",
  "fn-dscr": "Foreign national DSCR",
  "fn-asset": "Foreign national asset utilization",
};

/** Citizenships excluded by OFAC-sensitive matrices. */
const SANCTIONED = ["russia", "belarus", "iran", "north korea", "syria", "cuba"];

const CONFORMING_LIMIT = 832_750;
const HIGH_BALANCE_LIMIT = 1_249_125;

export const BANK_PROGRAMS: BankProgram[] = [
  /* ---------------------------------------------------- A&D — conventional */
  {
    id: "ad-fannie-mae",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Fannie Mae (standard & HomeReady)",
    family: "fannie-conforming",
    track: "conventional",
    blurb: "Agency conforming loan per DU findings. From 3% down on a primary home; second homes and investment allowed.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: CONFORMING_LIMIT,
    maxPurchaseLtv: 97,
    noScoreAllowed: false,
    reservesMonths: 0,
    ineligibleLocations: ["MD"],
    terms: [
      "Loan amount up to the conforming limit (high-cost county limits via the high balance option)",
      "Primary 1 unit: fixed 97%, ARM 95% · 2–4 units 95% · cash-out 80% (1 unit) / 75% (2–4)",
      "Second home: 90% purchase · 75% cash-out",
      "Investment: 85% purchase 1 unit, 75% 2–4 units · cash-out 75% / 70%",
      "Credit score, DTI, reserves and mortgage history evaluated by DU · scores below 580 ineligible with past-due debt",
      "Residency: US citizen, permanent and non-permanent resident",
      "Mortgage insurance required above 80% LTV · LPMI and split MI not allowed · no interest-only",
      "Property: SFR, warrantable condo, PUD, manufactured, 1–4 units · title individual, joint or trust",
      "Maryland: Baltimore County and Baltimore City investment excluded · docs max 4 months old",
    ],
    guidelines: ["A&D Conventional Underwriting Guidelines (09/24/2026)"],
    source: "A&D Mortgage — Fannie Mae Product Matrix (08/28/2026)",
  },
  {
    id: "ad-fannie-high-balance",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Fannie Mae High Balance",
    family: "fannie-high-balance",
    track: "conventional",
    blurb: "Fannie Mae loan above the baseline conforming limit, within the county high-cost limit.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: HIGH_BALANCE_LIMIT,
    minLoanAbove: CONFORMING_LIMIT,
    maxPurchaseLtv: 95,
    noScoreAllowed: false,
    reservesMonths: 0,
    ineligibleLocations: ["MD"],
    terms: [
      "Loan above the conforming limit up to the FHFA county limit",
      "Primary: 95% 1 unit · 85% 2 units · 75% 3–4 units",
      "Second home 90% · investment 85% (1 unit) per the Fannie Mae matrix",
      "Credit score, DTI and reserves per DU",
      "Residency: US citizen, permanent and non-permanent resident",
    ],
    guidelines: ["A&D Conventional Underwriting Guidelines (09/24/2026)"],
    source: "A&D Mortgage — Fannie Mae Product Matrix (08/28/2026)",
  },
  {
    id: "ad-freddie-mac",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Freddie Mac (standard & high balance)",
    family: "freddie-conforming",
    track: "conventional",
    blurb: "Agency conforming loan per LPA findings, including high-cost county limits.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: HIGH_BALANCE_LIMIT,
    maxPurchaseLtv: 95,
    noScoreAllowed: false,
    reservesMonths: 0,
    ineligibleLocations: ["MD"],
    terms: [
      "Loan amount up to conforming limits including high-cost area limits",
      "Primary purchase: 95% (1–4 units) · high balance 85% (2 units), 80% (3–4 units)",
      "Condominium 90% · manufactured home 95% · cash-out lower per matrix",
      "Credit score, DTI and reserves evaluated by LPA · scores below 580 ineligible with past-due debt",
      "Residency: US citizen, permanent and non-permanent resident",
      "Mortgage insurance required above 80% LTV · docs max 120 days old",
    ],
    guidelines: ["A&D Conventional Underwriting Guidelines (09/24/2026)"],
    source: "A&D Mortgage — Freddie Mac Product Matrix (08/28/2026)",
  },
  {
    id: "ad-fannie-refinow",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Fannie Mae RefiNow",
    family: "fannie-refinow",
    refinanceOnly: true,
    track: "conventional",
    blurb: "Limited cash-out refinance of an existing Fannie Mae loan on a primary residence.",
    occupancy: ["primary"],
    maxLoan: CONFORMING_LIMIT,
    maxPurchaseLtv: 97,
    noScoreAllowed: false,
    reservesMonths: 0,
    terms: ["Primary residence, 1 unit, limited cash-out refinance · fixed up to 97%, condo 90%"],
    source: "A&D Mortgage — Fannie Mae Product Matrix (08/28/2026)",
  },
  {
    id: "ad-power-jumbo",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Power Jumbo",
    family: "jumbo",
    track: "conventional",
    blurb: "Jumbo loans from the conforming limit + $1 up to $5M, AUS-evaluated with jumbo overlays.",
    occupancy: ["primary", "second", "investment"],
    minLoanAbove: CONFORMING_LIMIT,
    maxLoan: 5_000_000,
    maxPurchaseLtv: 89.99,
    tiers: [
      { upTo: 2_000_000, purchaseLtv: 89.99 },
      { upTo: 3_500_000, purchaseLtv: 80 },
      { upTo: 5_000_000, purchaseLtv: 75 },
    ],
    minFico: 660,
    noScoreAllowed: false,
    maxDti: 50,
    reservesMonths: 0,
    reserveTiers: [
      { upTo: 2_000_000, months: 0 },
      { upTo: 3_000_000, months: 12 },
      { upTo: Infinity, months: 24 },
    ],
    ineligibleLocations: ["HI", "MD", "PA", "VI"],
    terms: [
      "Loan amount: conforming limit + $1 to $5,000,000",
      "Max HCLTV 89.99% to $2M (primary, 680+) · 80% to $3.5M · 75% to $5M · lower for 660–679 and investment",
      "DTI per AUS, max 50% · max 45% for loans over $3.5M",
      "Reserves: per AUS to $2M · 12 months $2M–$3M · 24 months above $3M · FTHB 12 months",
      "Residency: US citizen, permanent and non-permanent resident with valid SSN",
      "Second appraisal above $2M · max points and fees 3% · prepayment penalty on investment only",
      "Excluded: HI, Baltimore County & City MD, Philadelphia PA (investment), VI",
    ],
    guidelines: ["AD Power Jumbo Underwriting Guidelines (08/19/2026)"],
    source: "A&D Mortgage — Power Jumbo Product Matrix (08/28/2026)",
  },
  {
    id: "ad-apex-prime",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "APEX Prime",
    family: "non-qm-full-doc",
    track: "conventional",
    blurb: "Prime non-QM full documentation, $75,000 to $5M, credit score 680+.",
    occupancy: ["primary", "second", "investment"],
    minLoan: 75_000,
    maxLoan: 5_000_000,
    maxPurchaseLtv: 80,
    tiers: [
      { upTo: 1_000_000, purchaseLtv: 80 },
      { upTo: 3_000_000, purchaseLtv: 75 },
      { upTo: 5_000_000, purchaseLtv: 65 },
    ],
    minFico: 680,
    noScoreAllowed: false,
    maxDti: 45,
    reservesMonths: 6,
    reserveTiers: [
      { upTo: 2_000_000, months: 6 },
      { upTo: 4_000_000, months: 12 },
      { upTo: Infinity, months: 24 },
    ],
    ineligibleLocations: ["MD", "PA"],
    terms: [
      "Loan amount $75,000 – $5,000,000 · max HCLTV 80% (740+, primary) decreasing by FICO and loan size",
      "Min FICO 680 · non-permanent residents min FICO 700 · DTI max 45%",
      "Reserves: 12 months $2M–$4M · 24 months above $4M",
      "Residency: US citizen, permanent and non-permanent resident",
      "2–4 units not allowed on second homes · FL PUD max CLTV 80% (OO/2nd), 75% (investment)",
      "Cash in hand: unlimited below 55% CLTV · $1M to 65% · $500k above 65% with FICO below 700",
      "Interested party contribution 6% (CLTV ≤80%) · investment 4% · vesting individual, joint, trust, LLC/Corp",
    ],
    guidelines: ["APEX Prime Eligibility Guidelines (09/24/2026)"],
    source: "A&D Mortgage — APEX Prime Product Matrix (08/28/2026)",
  },
  {
    id: "ad-prime",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Prime",
    family: "non-qm-full-doc",
    track: "conventional",
    blurb: "Non-QM prime, $75,000 to $1.5M. Accepts FICO from 620 and no-FICO borrowers at lower LTV.",
    occupancy: ["primary", "second", "investment"],
    minLoan: 75_000,
    maxLoan: 1_500_000,
    maxPurchaseLtv: 80,
    tiers: [
      { upTo: 1_000_000, purchaseLtv: 80 },
      { upTo: 1_500_000, purchaseLtv: 75 },
    ],
    minFico: 620,
    noScoreAllowed: true,
    maxDti: 50,
    reservesMonths: 3,
    reserveTiers: [
      { upTo: 1_000_000, months: 3 },
      { upTo: 2_000_000, months: 6 },
      { upTo: Infinity, months: 12 },
    ],
    creditEventMonths: 12,
    ineligibleLocations: ["AZ", "CA", "DC", "HI", "ID", "MD"],
    terms: [
      "Loan amount $75,000 – $1,500,000 · max HCLTV 80% (720+) decreasing by FICO",
      "Min FICO 620 · no FICO allowed at 55–70% LTV up to $750,000",
      "DTI max 50% · 50.01–55% only purchase/rate-term OO/2nd with FICO 680 and CLTV 80%",
      "Reserves: 3 months to $1M · 6 months $1M–$2M · 12 months above $2M",
      "12-month waiting period after a credit event · interest-only 120 months available",
      "Investment without a licence restricted in AZ, CA, DC, HI, ID and Baltimore MD",
    ],
    source: "A&D Mortgage — Prime Product Matrix (08/28/2026)",
  },
  {
    id: "ad-super-prime",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Super Prime",
    family: "non-qm-full-doc",
    track: "conventional",
    blurb: "Non-QM super prime, $75,000 to $4M, up to 90% LTV for strong credit.",
    occupancy: ["primary", "second", "investment"],
    minLoan: 75_000,
    maxLoan: 4_000_000,
    maxPurchaseLtv: 90,
    tiers: [
      { upTo: 1_500_000, purchaseLtv: 90 },
      { upTo: 2_000_000, purchaseLtv: 85 },
      { upTo: 2_500_000, purchaseLtv: 80 },
      { upTo: 3_000_000, purchaseLtv: 75 },
      { upTo: 4_000_000, purchaseLtv: 70 },
    ],
    minFico: 620,
    noScoreAllowed: false,
    maxDti: 50,
    reservesMonths: 3,
    reserveTiers: [
      { upTo: 1_000_000, months: 3 },
      { upTo: 2_000_000, months: 6 },
      { upTo: Infinity, months: 12 },
    ],
    creditEventMonths: 48,
    terms: [
      "Loan amount $75,000 – $4,000,000",
      "Primary 720+: 90% to $1.5M · 85% to $2M · 80% to $2.5M · 75% to $3M · 70% to $4M (lower by FICO/occupancy)",
      "Min FICO 620 · non-permanent residents min FICO 700 · DTI max 50%",
      "Reserves: 6 months $1M–$2M · 12 months above $2M",
      "48-month waiting period after a credit event · interest-only 120 months available",
      "2–4 units not available on second homes · see guidelines for visa restrictions",
    ],
    source: "A&D Mortgage — Super Prime Product Matrix (08/28/2026)",
  },
  /* ---------------------------------------------- HomeXpress — conventional */
  {
    id: "homexpress-fnma-high-balance",
    bank: "HomeXpress Mortgage",
    program: "FNMA High Balance",
    family: "fannie-high-balance",
    track: "conventional",
    blurb: "Fannie Mae high balance with HomeXpress overlays — DU approval, minimum credit score 580.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: HIGH_BALANCE_LIMIT,
    minLoanAbove: CONFORMING_LIMIT,
    maxPurchaseLtv: 95,
    minFico: 580,
    noScoreAllowed: false,
    reservesMonths: 0,
    terms: [
      "Loan above the conforming limit by at least $1, up to the FHFA county limit",
      "Primary: 95% 1 unit · 85% 2 units · 75% 3–4 units · manufactured 95% · cash-out 80% / 75%",
      "Second home: 90% purchase · 75% cash-out",
      "Investment: 85% 1 unit · 75% 2–4 units · cash-out 75% / 70%",
      "Min credit score 580 · DTI per DU · at least one borrower with a score, no manual underwriting",
      "Reserves per DU · 6 months on cash-out when DTI above 45%",
      "Mortgage insurance above 80% LTV · ACE appraisal waivers permitted",
    ],
    source: "HomeXpress Mortgage — FNMA High Balance Product Matrix (06/30/2026)",
  },
  {
    id: "homexpress-agency-noo-xpress",
    bank: "HomeXpress Mortgage",
    program: "Agency Non-Owner Xpress",
    family: "fannie-conforming",
    track: "conventional",
    blurb: "Fannie Mae conforming (DU only) for second homes and investment properties.",
    occupancy: ["second", "investment"],
    maxLoan: CONFORMING_LIMIT,
    maxPurchaseLtv: 90,
    minFico: 660,
    noScoreAllowed: false,
    reservesMonths: 0,
    terms: [
      "Conforming only, DU only, fixed rate",
      "Second home 1 unit: 90% purchase · 75% cash-out",
      "Investment: 85% purchase 1 unit · 75% 2–4 units and limited cash-out · cash-out 75% / 70%",
      "Min FICO 660 (1 unit) · 680 (2–4 units) · DTI and reserves per DU",
      "Residency: US citizen; non-US citizens per Fannie Mae guidelines",
    ],
    source: "HomeXpress Mortgage — Agency Non-Owner Xpress Matrix",
  },
  {
    id: "homexpress-fnma-refinow",
    bank: "HomeXpress Mortgage",
    program: "FNMA RefiNow",
    family: "fannie-refinow",
    refinanceOnly: true,
    track: "conventional",
    blurb: "Limited cash-out refinance of an existing Fannie Mae loan on a primary residence.",
    occupancy: ["primary"],
    maxLoan: CONFORMING_LIMIT,
    maxPurchaseLtv: 97,
    noScoreAllowed: false,
    reservesMonths: 0,
    terms: ["Primary residence limited cash-out refinance · DU approval required · reserves per DU"],
    source: "HomeXpress Mortgage — FNMA RefiNow Product Matrix",
  },
  /* ------------------------------------------ Champions — conventional */
  {
    id: "champions-accelerator-activator",
    bank: "Champions Funding",
    program: "Accelerator (investor) / Activator (primary & 2nd home) — Full Doc",
    family: "non-qm-full-doc",
    track: "conventional",
    blurb: "Full doc (W-2, tax returns, retirement), $150,000 to $3M, up to 90% LTV for 740+.",
    occupancy: ["primary", "second", "investment"],
    minLoan: 150_000,
    maxLoan: 3_000_000,
    maxPurchaseLtv: 90,
    tiers: [
      { upTo: 1_000_000, purchaseLtv: 90 },
      { upTo: 2_500_000, purchaseLtv: 80 },
      { upTo: 3_000_000, purchaseLtv: 75 },
    ],
    minFico: 640,
    noScoreAllowed: false,
    maxDti: 50,
    reservesMonths: 3,
    reserveTiers: [
      { upTo: 1_000_000, months: 3 },
      { upTo: 1_500_000, months: 6 },
      { upTo: Infinity, months: 9 },
    ],
    terms: [
      "Loan amount $150,000 – $3,000,000",
      "Primary/2nd: 90% (740+) · 85% (720) · 80% (700) · lower for 680–640 · investment max 85%",
      "DTI max 50% · 55% with $3,000 residual income · 45% when LTV above 80%",
      "Reserves: 3 months below $1M · 6 months to $1.5M · 9 months above (cash-out can satisfy)",
      "Citizenship: US citizen, permanent resident, non-permanent resident with US credit and acceptable visa",
      "Gift funds allowed for 100% of down payment, not for reserves · 2 appraisals from $2M",
      "Ineligible states per Champions state licensing",
    ],
    source: "Champions Funding — Accelerator / Activator Full Doc matrix",
  },
  {
    id: "ad-fn-full-doc",
    family: "fn-full-doc",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Foreign National Full Doc",
    track: "foreign_national",
    blurb:
      "Documented foreign income: bank reference letter plus a foreign CPA letter for two years and YTD.",
    occupancy: ["investment"],
    minLoan: 100_000,
    maxLoan: 3_000_000,
    maxPurchaseLtv: 75,
    minFico: 660,
    noScoreAllowed: true,
    maxDti: 43,
    reservesMonths: 12,
    visaRequired: true,
    creditEventMonths: 48,
    terms: [
      "Loan amount $100,000 – $3,000,000",
      "CLTV up to 75% purchase · 70% cash-out",
      "Min FICO 660 or no score · DTI up to 43%",
      "Investment properties only · SFR, 2–4 units, condo/condotel, PUD, short-term rentals, leasehold",
      "Citizenship: foreign nationals, valid US visa required",
      "One bank reference letter + foreign CPA letter (2 years and YTD)",
      "Minimum 12 months reserves · overseas assets allowed as reserves",
      "Minimum 48 months out of a credit event · mortgage history 0x30x12 and 0x90x24",
      "30/40-year fixed, 5/6 and 7/6 ARM · interest-only available · RON closing allowed",
      "Gift funds allowed with 10% own contribution",
    ],
    source: "A&D Mortgage — Foreign National Full Doc matrix",
  },
  {
    id: "ad-fn-dscr",
    family: "fn-dscr",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Foreign National DSCR",
    track: "foreign_national",
    blurb:
      "Qualifies on the property's cash flow — no borrower income used. Property ownership in the last 36 months required.",
    occupancy: ["investment"],
    minLoan: 100_000,
    maxLoan: 3_000_000,
    maxPurchaseLtv: 75,
    minFico: 660,
    noScoreAllowed: true,
    incomeNotRequired: true,
    reservesMonths: 12,
    visaRequired: true,
    ownershipHistoryMonths: 36,
    creditEventMonths: 48,
    terms: [
      "Loan amount $100,000 – $3,000,000",
      "CLTV up to 75% purchase · 70% cash-out",
      "Min FICO 660 or no score · 680 when DSCR below 1",
      "DSCR = gross rent / proposed PITIA — borrower income not required",
      "Investment properties only · short-term rentals and condotels eligible",
      "Citizenship: foreign nationals, valid US visa required",
      "Any property ownership within the past 36 months required",
      "Minimum 12 months reserves · overseas assets allowed as reserves",
      "Minimum 48 months out of a credit event · 0x30x12 and 0x90x24",
      "30/40-year fixed, 5/6 and 7/6 ARM · interest-only 120 months",
    ],
    source: "A&D Mortgage — Foreign National DSCR matrix",
  },
  {
    id: "ad-fn-asset-utilization",
    family: "fn-asset",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Foreign National Asset Utilization",
    track: "foreign_national",
    blurb:
      "Qualifies on assets held in US or Canadian institutions, divided by 60 months — ideal for entrepreneurs and retirees.",
    occupancy: ["second", "investment"],
    maxLoan: 3_000_000,
    maxPurchaseLtv: 75,
    minFico: 660,
    noScoreAllowed: true,
    maxDti: 43,
    reservesMonths: 12,
    assetsUsCanadaOnly: true,
    creditEventMonths: 24,
    terms: [
      "Max loan amount $3,000,000",
      "CLTV up to 75% purchase · 65% cash-out · DTI up to 43%",
      "No score or FICO 660",
      "Second home and investment properties",
      "Qualifying income = eligible assets / 60 months (100% checking, savings, stocks, bonds; 80% retirement)",
      "Eligible assets must be held in US or Canadian financial institutions",
      "12 months reserves · overseas assets allowed as reserves",
      "Foreign CPA letter (2 years and YTD) required",
      "Minimum 24 months out of a credit event · 0x30x12 and 0x90x24",
      "Gift funds allowed with 20% own contribution · RON closing allowed",
    ],
    source: "A&D Mortgage — Foreign National Asset Utilization matrix",
  },
  {
    id: "champions-fn-ambassador",
    family: "fn-full-doc",
    bank: "Champions Funding",
    program: "Ambassador Investment — Foreign National (second home & investment)",
    track: "foreign_national",
    blurb:
      "Tiered LTV by loan size, foreign credit accepted with reference letters. Sanctioned countries excluded.",
    occupancy: ["second", "investment"],
    minLoan: 125_000,
    maxLoan: 3_000_000,
    maxPurchaseLtv: 75,
    tiers: [
      { upTo: 1_000_000, purchaseLtv: 75, cashOutLtv: 65 },
      { upTo: 1_500_000, purchaseLtv: 70, cashOutLtv: 60 },
      { upTo: 2_000_000, purchaseLtv: 65, cashOutLtv: 55 },
      { upTo: 2_500_000, purchaseLtv: 60 },
      { upTo: 3_000_000, purchaseLtv: 55 },
    ],
    minFico: 680,
    noScoreAllowed: true,
    maxDti: 50,
    reservesMonths: 12,
    visaRequired: true,
    sanctionedCountriesExcluded: true,
    creditEventMonths: 36,
    ineligibleLocations: ["HI", "PR", "GU", "VI", "MD", "PA"],
    terms: [
      "Loan amount $125,000 – $3,000,000 · LTV by loan size: 75% ≤$1M, 70% to $1.5M, 65% to $2M, 60% to $2.5M, 55% to $3M",
      "Cash-out 10% below the purchase LTV of each tier",
      "Second home and investment only · 2–4 units investment only · rural not eligible",
      "DTI max 50% · 12 months reserves (cash-out may satisfy the requirement)",
      "US credit: min FICO 680 with 1 tradeline 24 months or 2 tradelines 12 months",
      "Alternative credit: minimum 1 credit reference letter (foreign credit accepted)",
      "Credit events (BK/FC/SS/DIL) seasoned at least 36 months · housing history 0x30x12",
      "Valid unexpired passport plus unexpired visa, or I-797 with I-94 (Canadians exempt)",
      "Citizens of OFAC sanctioned countries, including Russia and Belarus, are not eligible",
      "Ineligible locations: Hawaii lava zones 1 & 2, Puerto Rico, Guam, US Virgin Islands, Baltimore MD, Philadelphia PA (investment)",
      "Loans ≥$2,000,000 require two appraisals · declining markets take a 5% LTV reduction",
      "Gift funds permitted with 10% own funds · prepayment penalty on investment properties",
    ],
    source: "Champions Funding — FN Ambassador 2nd/Investment matrix",
  },
];

/* ------------------------------------------------------- client snapshot */

export type ApplicantSnapshot = {
  clientName: string;
  usStatus: UsStatus;
  hasSsn: boolean;
  hasItin: boolean;
  citizenship: string;
  residence: string;
  visaValidUntil?: string;
  visaActive: boolean;
  fico?: number;
  monthlyGross: number;
  monthlyObligations: number;
  /** Debt-to-income from the file, in percent. */
  dti?: number;
  propertyPrice: number;
  loanAmount: number;
  ltv: number;
  downPaymentPct: number;
  occupancy: Occupancy;
  /** Buyer answered "vacation home" — sorted as primary, second-home matrices also fit. */
  vacationHome: boolean;
  state: string;
  /** Declared assets, face value, all currencies added up. */
  totalAssets: number;
  /** Declared liquid assets used for the reserves test. */
  liquidAssets: number;
  /** Declared assets held in US or Canadian institutions. */
  usCanadaAssets: number;
  /** Estimated monthly payment used for the reserves test. */
  monthlyPayment: number;
  reservesMonths?: number;
  ownsPropertyAlready: boolean;
  /** A disclosed bankruptcy, foreclosure, short sale or deed in lieu. */
  hasCreditEvent: boolean;
  /** Months since bankruptcy discharge, when the file provides a usable date. */
  creditEventMonthsAgo?: number;
};

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Monthly principal + interest for a loan. */
export function monthlyPrincipalInterest(loan: number, ratePct: number, years: number) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (!loan || !n) return 0;
  if (!r) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

/** Everything the matrices need, read off the client file. */
export function applicantSnapshot(lead: MortgageLead): ApplicantSnapshot {
  const p = lead.profile;
  const status = usStatusOf(p, lead.usPerson);
  const terms = lead.terms;
  const downPaymentPct = terms?.downPaymentPct ?? 20;
  const loanAmount = Math.round(lead.propertyPrice * (1 - downPaymentPct / 100));
  const entries = normalizeAssets(p.assets).entries;
  const liquid = entries.filter((a) => a.type !== "real_estate");
  const isUsCanada = (c: string) =>
    ["us", "usa", "united states", "united states of america", "canada"].includes(
      (c || "").trim().toLowerCase(),
    );
  const monthlyObligations = lead.debts ? totalMonthlyObligations(lead.debts) : 0;
  const monthlyGross = p.monthlyGross || 0;
  const taxInsuranceMonthly = terms
    ? (lead.propertyPrice * terms.taxInsurancePct) / 100 / 12
    : 0;
  const monthlyPayment =
    monthlyPrincipalInterest(loanAmount, terms?.ratePct ?? 7, terms?.termYears ?? 30) +
    taxInsuranceMonthly;
  const liquidTotal = liquid.reduce((s, a) => s + num(a.value), 0);
  const declarations = p.declarations;
  const hasCreditEvent = Boolean(
    declarations?.bankruptcy ||
      declarations?.propertyForeclosed ||
      declarations?.preForeclosureOrShortSale ||
      declarations?.conveyedTitleInLieu,
  );
  let creditEventMonthsAgo: number | undefined;
  if (declarations?.bankruptcy && declarations.bankruptcyDischargeDate) {
    const parts = declarations.bankruptcyDischargeDate.split("/");
    const date =
      parts.length === 3
        ? new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]))
        : new Date(declarations.bankruptcyDischargeDate);
    if (!Number.isNaN(date.getTime())) {
      const now = new Date();
      creditEventMonthsAgo = Math.max(
        0,
        (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth(),
      );
    }
  }

  return {
    clientName: lead.clientName,
    usStatus: status,
    hasSsn: Boolean(p.ssn),
    hasItin: Boolean(p.hasItin || p.itin),
    citizenship: p.citizenship ?? "",
    residence: p.countryOfResidence ?? "",
    ...(p.visaValidUntil ? { visaValidUntil: p.visaValidUntil } : {}),
    visaActive: Boolean(
      p.usVisaActive &&
        (!p.visaValidUntil || new Date(p.visaValidUntil).getTime() > Date.now()),
    ),
    ...(lead.creditScore ? { fico: lead.creditScore } : {}),
    monthlyGross,
    monthlyObligations,
    ...(monthlyGross
      ? { dti: Math.round(((monthlyObligations + monthlyPayment) / monthlyGross) * 100) }
      : {}),
    propertyPrice: lead.propertyPrice,
    loanAmount,
    ltv: Math.round(100 - downPaymentPct),
    downPaymentPct,
    // A vacation home is treated as the primary residence (FHA and agency sorting).
    occupancy: p.propertyUse === "vacation" ? "primary" : "investment",
    vacationHome: p.propertyUse === "vacation",
    state: (lead.propertyLabel.match(/\b([A-Z]{2})\b/)?.[1] ?? "").toUpperCase(),
    totalAssets: entries.reduce((s, a) => s + num(a.value), 0),
    liquidAssets: liquidTotal,
    usCanadaAssets: liquid
      .filter((a) => isUsCanada(a.country))
      .reduce((s, a) => s + num(a.value), 0),
    monthlyPayment: Math.round(monthlyPayment),
    ...(monthlyPayment
      ? { reservesMonths: Math.floor(liquidTotal / monthlyPayment) }
      : {}),
    ownsPropertyAlready: entries.some((a) => a.type === "real_estate"),
    hasCreditEvent,
    ...(creditEventMonthsAgo !== undefined ? { creditEventMonthsAgo } : {}),
  };
}

/** Which matrix family the borrower belongs to. */
export function trackOf(snap: ApplicantSnapshot): BorrowerTrack {
  const conventional =
    snap.hasSsn && (snap.usStatus === "citizen" || snap.usStatus === "green_card");
  if (conventional) return "conventional";
  if (snap.hasItin && !snap.hasSsn) return "itin";
  return "foreign_national";
}

/** ITIN borrowers see ITIN matrices and, as a fallback, foreign-national ones. */
function trackFits(program: BankProgram, track: BorrowerTrack) {
  return program.track === track || (track === "itin" && program.track === "foreign_national");
}

function occupancyFits(program: BankProgram, snap: ApplicantSnapshot) {
  return (
    program.occupancy.includes(snap.occupancy) ||
    (snap.vacationHome && program.occupancy.includes("second"))
  );
}

/* ------------------------------------------------------------- matching */

export type CheckResult = "pass" | "fail" | "review";
export type Check = { label: string; result: CheckResult; detail: string };
export type Eligibility = "eligible" | "review" | "ineligible";

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  eligible: "Eligible",
  review: "Eligible with conditions",
  ineligible: "Not eligible",
};

export const ELIGIBILITY_TONE: Record<Eligibility, string> = {
  eligible: "bg-success/10 text-success",
  review: "bg-gold-tint text-gold",
  ineligible: "bg-destructive/10 text-destructive",
};

export type ProgramMatch = {
  program: BankProgram;
  eligibility: Eligibility;
  checks: Check[];
  /** Maximum LTV for this loan size under the matrix. */
  maxLtv: number;
  /** Largest loan this matrix supports at the file's purchase price. */
  maxLoanForFile: number;
  /** Practical file changes or documents that could move this programme to eligible. */
  recommendations: string[];
  /** A known, non-curable matrix exclusion; these programmes stay out of the UI. */
  hiddenReason?: string | undefined;
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function ltvForLoan(program: BankProgram, loan: number) {
  if (!program.tiers) return program.maxPurchaseLtv;
  const tier = program.tiers.find((t) => loan <= t.upTo);
  return tier?.purchaseLtv ?? program.tiers[program.tiers.length - 1]!.purchaseLtv;
}

/** Match one client file against one bank matrix. */
export function matchProgram(program: BankProgram, snap: ApplicantSnapshot): ProgramMatch {
  const checks: Check[] = [];
  const recommendations: string[] = [];
  const add = (label: string, result: CheckResult, detail: string) =>
    checks.push({ label, result, detail });

  const track = trackOf(snap);
  add(
    "Borrower track",
    trackFits(program, track) ? "pass" : "fail",
    trackFits(program, track)
      ? `${TRACK_LABEL[program.track]} — matches the borrower`
      : `This matrix is ${TRACK_LABEL[program.track].toLowerCase()}; the borrower is ${TRACK_LABEL[track].toLowerCase()}`,
  );
  if (!occupancyFits(program, snap)) {
    recommendations.push(
      `This programme only supports ${program.occupancy.map((o) => OCCUPANCY_LABEL[o].toLowerCase()).join(" or ")}; only change occupancy if that is the borrower's genuine intended use.`,
    );
  }

  add(
    "Occupancy",
    occupancyFits(program, snap) ? "pass" : "fail",
    `${snap.vacationHome ? "Vacation home (primary residence)" : OCCUPANCY_LABEL[snap.occupancy]} · matrix allows ${program.occupancy
      .map((o) => OCCUPANCY_LABEL[o].toLowerCase())
      .join(", ")}`,
  );
  const maxLtv = ltvForLoan(program, snap.loanAmount);
  const tooSmall = program.minLoan ? snap.loanAmount < program.minLoan : false;
  const tooBig = snap.loanAmount > program.maxLoan;
  const belowBaseline = program.minLoanAbove ? snap.loanAmount <= program.minLoanAbove : false;
  add(
    "Loan amount",
    tooSmall || tooBig || belowBaseline ? "fail" : "pass",
    `${money(snap.loanAmount)} · matrix ${program.minLoan ? `${money(program.minLoan)} – ` : "up to "}${money(program.maxLoan)}${
      program.minLoanAbove ? ` (only above ${money(program.minLoanAbove)})` : ""
    }`,
  );
  if (tooSmall) {
    recommendations.push(`Increase the requested loan to at least ${money(program.minLoan ?? 0)}, or use a programme with a lower minimum.`);
  } else if (tooBig) {
    recommendations.push(`Reduce the loan to ${money(program.maxLoan)} or less by increasing the down payment by at least ${money(snap.loanAmount - program.maxLoan)}.`);
  } else if (belowBaseline) {
    recommendations.push(`This high-balance programme starts above ${money(program.minLoanAbove ?? 0)}; use the standard conventional programme at the current loan size.`);
  }
  if (snap.ltv > maxLtv) {
    const requiredDown = Math.ceil(snap.propertyPrice * (1 - maxLtv / 100));
    recommendations.push(`Increase the down payment to at least ${money(requiredDown)} (${100 - maxLtv}%) to meet the ${maxLtv}% maximum LTV.`);
  }

  add(
    "LTV",
    snap.ltv <= maxLtv ? "pass" : "fail",
    `${snap.ltv}% requested (${snap.downPaymentPct}% down) · matrix maximum ${maxLtv}% at this loan size`,
  );

  if (program.minFico !== undefined) {
    const result: CheckResult = snap.fico
      ? snap.fico >= program.minFico
        ? "pass"
        : "fail"
      : program.noScoreAllowed
        ? "pass"
        : "review";
    add(
      "Credit score",
      result,
      snap.fico
        ? `FICO ${snap.fico} · matrix minimum ${program.minFico}`
        : program.noScoreAllowed
          ? `No US score on file · matrix accepts no score / foreign credit (minimum ${program.minFico} when scored)`
          : `No US score on file · matrix needs a score of at least ${program.minFico}`,
    );
    if (result === "fail" && snap.fico) {
      recommendations.push(`Improve or correct the credit file by at least ${program.minFico - snap.fico} points to reach FICO ${program.minFico}.`);
    } else if (result === "review") {
      recommendations.push(`Add the borrower's credit report, then confirm a score of at least ${program.minFico}.`);
    }
  } else {
    add(
      "Credit score",
      snap.fico ? "pass" : "review",
      snap.fico
        ? `FICO ${snap.fico} · matrix uses automated underwriting, no hard minimum`
        : "No score on file · automated underwriting decides",
    );
    if (!snap.fico) recommendations.push("Complete the credit file and run automated underwriting (AUS).");
  }

  if (program.incomeNotRequired) {
    add(
      "Income / DSCR",
      "review",
      "Borrower income not used — qualify on gross rent divided by the proposed PITIA",
    );
    recommendations.push("Add the appraiser's market rent and proposed PITIA so the DSCR can be calculated.");
  } else if (program.maxDti !== undefined) {
    const result: CheckResult = snap.dti ? (snap.dti <= program.maxDti ? "pass" : "fail") : "review";
    add(
      "DTI",
      result,
      snap.dti
        ? `${snap.dti}% with the proposed payment · matrix maximum ${program.maxDti}%`
        : `No income or obligations on file yet · matrix maximum ${program.maxDti}%`,
    );
    if (result === "fail" && snap.dti) {
      const maximumObligations = Math.max(0, (snap.monthlyGross * program.maxDti) / 100 - snap.monthlyPayment);
      recommendations.push(`Reduce monthly obligations to about ${money(maximumObligations)} or document enough additional qualifying income to bring DTI to ${program.maxDti}% or below.`);
    } else if (result === "review") {
      recommendations.push("Complete income and monthly-obligation details so DTI can be calculated.");
    }
  } else {
    add("DTI", "review", "Per automated underwriting (AUS)");
    recommendations.push("Complete income and liability documents, then run automated underwriting (AUS).");
  }

  const reservesNeeded = program.reserveTiers
    ? (program.reserveTiers.find((t) => snap.loanAmount <= t.upTo) ??
        program.reserveTiers[program.reserveTiers.length - 1]!).months
    : program.reservesMonths;
  if (reservesNeeded) {
    const result: CheckResult =
      snap.reservesMonths === undefined
        ? "review"
        : snap.reservesMonths >= reservesNeeded
          ? "pass"
          : "fail";
    add(
      "Reserves",
      result,
      snap.reservesMonths === undefined
        ? `${reservesNeeded} months required at this loan size`
        : `${snap.reservesMonths} months of declared liquid assets (payment ${money(snap.monthlyPayment)}) · ${reservesNeeded} months required at this loan size`,
    );
    if (result === "fail") {
      const needed = Math.max(0, reservesNeeded * snap.monthlyPayment - snap.liquidAssets);
      recommendations.push(`Document at least ${money(needed)} more in eligible liquid reserves to reach ${reservesNeeded} months.`);
    } else if (result === "review") {
      recommendations.push(`Add statements proving at least ${reservesNeeded} months of reserves.`);
    }
  }

  if (program.visaRequired) {
    const canadian = snap.citizenship.trim().toLowerCase() === "canada";
    const result: CheckResult = snap.visaActive || canadian ? "pass" : "fail";
    add(
      "US visa",
      result,
      canadian
        ? "Canadian citizens do not need a non-immigrant visa"
        : snap.visaActive
          ? `Valid US visa on file${snap.visaValidUntil ? ` until ${snap.visaValidUntil}` : ""}`
          : "No valid, unexpired US visa on file — the matrix requires one",
    );
    if (result === "fail") recommendations.push("Add valid, unexpired US visa or qualifying I-797/I-94 evidence to the file.");
  }

  if (program.assetsUsCanadaOnly) {
    const result: CheckResult = snap.usCanadaAssets > 0 ? "pass" : "fail";
    add(
      "Assets in US / Canada",
      result,
      snap.usCanadaAssets > 0
        ? `${money(snap.usCanadaAssets)} held in US or Canadian institutions · qualifying income = assets / 60 months`
        : "No assets held in US or Canadian institutions — this matrix only counts those",
    );
    if (result === "fail") recommendations.push("Document sufficient qualifying assets held with US or Canadian financial institutions.");
  }

  if (program.sanctionedCountriesExcluded) {
    const hit = SANCTIONED.find((c) =>
      [snap.citizenship, snap.residence].some((v) => (v || "").toLowerCase().includes(c)),
    );
    add(
      "Sanctions screening",
      hit ? "fail" : "pass",
      hit
        ? `Citizenship / residence "${hit}" is on the matrix exclusion list (OFAC sanctioned countries)`
        : "No OFAC sanctioned country on the file",
    );
  }

  if (program.ownershipHistoryMonths) {
    add(
      "Ownership history",
      snap.ownsPropertyAlready ? "pass" : "review",
      snap.ownsPropertyAlready
        ? "Real estate declared on the file"
        : `Any property ownership within ${program.ownershipHistoryMonths} months required — not evidenced on the file`,
    );
    if (!snap.ownsPropertyAlready) recommendations.push(`Add evidence of property ownership within the last ${program.ownershipHistoryMonths} months.`);
  }

  if (program.ineligibleLocations?.length && snap.state) {
    const restricted = program.ineligibleLocations.includes(snap.state);
    add(
      "Location",
      restricted ? "review" : "pass",
      restricted
        ? `${snap.state} has location restrictions on this matrix — check the excluded cities and zones`
        : `${snap.state} is not on the matrix exclusion list`,
    );
  }

  if (program.creditEventMonths) {
    const knownTooRecent =
      snap.hasCreditEvent &&
      snap.creditEventMonthsAgo !== undefined &&
      snap.creditEventMonthsAgo < program.creditEventMonths;
    const seasoned =
      snap.hasCreditEvent &&
      snap.creditEventMonthsAgo !== undefined &&
      snap.creditEventMonthsAgo >= program.creditEventMonths;
    add(
      "Credit events",
      knownTooRecent ? "fail" : seasoned || !snap.hasCreditEvent ? "pass" : "review",
      knownTooRecent
        ? `${snap.creditEventMonthsAgo} months since the disclosed bankruptcy discharge · ${program.creditEventMonths} months required`
        : seasoned
          ? `${snap.creditEventMonthsAgo} months since the disclosed bankruptcy discharge · seasoning requirement met`
          : !snap.hasCreditEvent
            ? "No bankruptcy, foreclosure, short sale or deed in lieu declared"
            : `At least ${program.creditEventMonths} months out of the disclosed credit event — exact completion date needs verification`,
    );
    if (snap.hasCreditEvent && !knownTooRecent && !seasoned) {
      recommendations.push(`Add discharge or completion documents showing at least ${program.creditEventMonths} months of seasoning.`);
    }
  }

  const sanctionedFailure = checks.find((c) => c.label === "Sanctions screening" && c.result === "fail");
  const creditEventFailure = checks.find((c) => c.label === "Credit events" && c.result === "fail");

  const eligibility: Eligibility = checks.some((c) => c.result === "fail")
    ? "ineligible"
    : checks.some((c) => c.result === "review")
      ? "review"
      : "eligible";

  return {
    program,
    eligibility,
    checks,
    maxLtv,
    maxLoanForFile: Math.round((snap.propertyPrice * maxLtv) / 100),
    recommendations: Array.from(new Set(recommendations)),
    ...(sanctionedFailure
      ? { hiddenReason: sanctionedFailure.detail }
      : creditEventFailure
        ? { hiddenReason: creditEventFailure.detail }
        : {}),
  };
}

/** Relevant, potentially usable matrices only, best fit first. */
export function matchBanks(snap: ApplicantSnapshot): ProgramMatch[] {
  const order: Record<Eligibility, number> = { eligible: 0, review: 1, ineligible: 2 };
  const track = trackOf(snap);
  return BANK_PROGRAMS.filter((program) => trackFits(program, track) && !program.refinanceOnly)
    .map((program) => matchProgram(program, snap))
    .filter((match) => !match.hiddenReason)
    .sort(
    (a, b) =>
      order[a.eligibility] - order[b.eligibility] ||
      a.program.bank.localeCompare(b.program.bank),
  );
}

/** Other banks offering the same loan type, for the lender's choice. */
export function sameTypeElsewhere(program: BankProgram, matches: ProgramMatch[]) {
  return matches.filter((m) => m.program.family === program.family && m.program.bank !== program.bank);
}
