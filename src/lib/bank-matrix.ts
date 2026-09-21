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

export type BorrowerTrack = "conventional" | "foreign_national";

export const TRACK_LABEL: Record<BorrowerTrack, string> = {
  conventional: "Conventional (SSN / US credit)",
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
  /** The matrix terms shown to the lender, verbatim in substance. */
  terms: string[];
  source: string;
};

/** Citizenships excluded by OFAC-sensitive matrices. */
const SANCTIONED = ["russia", "belarus", "iran", "north korea", "syria", "cuba"];

export const BANK_PROGRAMS: BankProgram[] = [
  {
    id: "ad-conventional-standard",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Conventional Standard",
    track: "conventional",
    blurb:
      "Fully compliant with Fannie Mae and Freddie Mac. Traditional pricing, down payment from 3%.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: 832_750,
    maxPurchaseLtv: 97,
    noScoreAllowed: false,
    reservesMonths: 0,
    creditEventMonths: 24,
    terms: [
      "Max loan amount $832,750",
      "CLTV up to 97% · minimum down payment 3%",
      "FICO and DTI per automated underwriting (AUS), no hard minimum",
      "Citizenship: US citizens, permanent and non-permanent residents",
      "At least two consecutive years of stable income and employment",
      "At least 2 years out of any credit event · reserves per AUS",
      "Fixed 15/20/25/30 years · ARM 5/6, 7/6, 10/6 · gift funds allowed",
      "Private mortgage insurance required below 20% down payment",
    ],
    source: "A&D Mortgage — Conventional Standard matrix",
  },
  {
    id: "ad-conventional-high-balance",
    bank: "A&D Mortgage",
    bankNmls: "958660",
    program: "Conventional High Balance",
    track: "conventional",
    blurb:
      "For loans above the national baseline limit but within the county's high-cost conforming limit.",
    occupancy: ["primary", "second", "investment"],
    maxLoan: 1_249_125,
    minLoanAbove: 832_750,
    maxPurchaseLtv: 97,
    noScoreAllowed: false,
    reservesMonths: 0,
    creditEventMonths: 24,
    terms: [
      "Max loan amount $1,249,125 (county specific)",
      "CLTV up to 97% · minimum down payment 3%",
      "FICO and DTI per AUS",
      "Citizenship: US citizens, permanent and non-permanent residents",
      "Two consecutive years of stable income and employment · reserves per AUS",
      "Fixed 15/30 years · ARM 5/6, 7/6, 10/6 · gift funds allowed · cash-out allowed",
      "Private mortgage insurance required below 20% down payment",
    ],
    source: "A&D Mortgage — Conventional High Balance matrix",
  },
  {
    id: "ad-fn-full-doc",
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
    occupancy: p.propertyUse === "vacation" ? "second" : "investment",
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
  return conventional ? "conventional" : "foreign_national";
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
    program.track === track ? "pass" : "fail",
    program.track === track
      ? `${TRACK_LABEL[program.track]} — matches the borrower`
      : `This matrix is ${TRACK_LABEL[program.track].toLowerCase()}; the borrower is ${TRACK_LABEL[track].toLowerCase()}`,
  );
  if (!program.occupancy.includes(snap.occupancy)) {
    recommendations.push(
      `This programme only supports ${program.occupancy.map((o) => OCCUPANCY_LABEL[o].toLowerCase()).join(" or ")}; only change occupancy if that is the borrower's genuine intended use.`,
    );
  }

  add(
    "Occupancy",
    program.occupancy.includes(snap.occupancy) ? "pass" : "fail",
    `${OCCUPANCY_LABEL[snap.occupancy]} · matrix allows ${program.occupancy
      .map((o) => OCCUPANCY_LABEL[o].toLowerCase())
      .join(", ")}`,
  );
  if (tooSmall) {
    recommendations.push(`Increase the requested loan to at least ${money(program.minLoan ?? 0)}, or use a programme with a lower minimum.`);
  } else if (tooBig) {
    recommendations.push(`Reduce the loan to ${money(program.maxLoan)} or less by increasing the down payment by at least ${money(snap.loanAmount - program.maxLoan)}.`);
  } else if (belowBaseline) {
    recommendations.push(`This high-balance programme starts above ${money(program.minLoanAbove ?? 0)}; use the standard conventional programme at the current loan size.`);
  }

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

  if (program.reservesMonths) {
    const result: CheckResult =
      snap.reservesMonths === undefined
        ? "review"
        : snap.reservesMonths >= program.reservesMonths
          ? "pass"
          : "fail";
    add(
      "Reserves",
      result,
      snap.reservesMonths === undefined
        ? `${program.reservesMonths} months required`
        : `${snap.reservesMonths} months of declared liquid assets (payment ${money(snap.monthlyPayment)}) · ${program.reservesMonths} months required`,
    );
    if (result === "fail") {
      const needed = Math.max(0, program.reservesMonths * snap.monthlyPayment - snap.liquidAssets);
      recommendations.push(`Document at least ${money(needed)} more in eligible liquid reserves to reach ${program.reservesMonths} months.`);
    } else if (result === "review") {
      recommendations.push(`Add statements proving at least ${program.reservesMonths} months of reserves.`);
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
    add(
      "Credit events",
      knownTooRecent ? "fail" : "review",
      knownTooRecent
        ? `${snap.creditEventMonthsAgo} months since the disclosed bankruptcy discharge · ${program.creditEventMonths} months required`
        : `At least ${program.creditEventMonths} months out of any bankruptcy, foreclosure or short sale`,
    );
    if (!knownTooRecent) recommendations.push(`Verify credit-event dates and provide discharge or completion documents showing at least ${program.creditEventMonths} months of seasoning.`);
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
  return BANK_PROGRAMS.filter((program) => program.track === track)
    .map((program) => matchProgram(program, snap))
    .filter((match) => !match.hiddenReason)
    .sort(
    (a, b) =>
      order[a.eligibility] - order[b.eligibility] ||
      a.program.bank.localeCompare(b.program.bank),
  );
}
