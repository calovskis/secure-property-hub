/**
 * Printable client file (URLA-style summary) for mortgage lender partners.
 *
 * Mirrors the data Loqal hands over in the MISMO 3.4 XML so a lender can read
 * the file on paper and import the XML into their loan origination system.
 */

import type { MortgageLead } from "@/lib/leads";
import { LEAD_STATUS_LABEL } from "@/lib/leads";
import { formatDate, formatDateTime, isoToUsMonth } from "@/lib/dates";
import { countryLabel } from "@/data/countries";
import {
  ASSET_TYPE_LABEL,
  BANK_ACCOUNT_KIND_LABEL,
  INCOME_TYPE_LABEL,
  MARITAL_LABEL,
  RELATED_PARTY_LABEL,
  US_STATUS_LABEL,
  isForeignIncome,
  monthlyForIncome,
  normalizeAssets,
  num,
  totalLiabilities,
  totalMonthlyIncome,
  usStatusOf,
} from "@/lib/mortgage-form";
import { loqalNumber } from "@/lib/user-id";
import { PURCHASE_STAGE_LABEL, type PurchaseProgress } from "@/lib/purchase-stage";
import { LOQAL_LOS_NAME, exportFileName } from "@/lib/mismo-export";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const yesNo = (v?: boolean) => (v ? "Yes" : "No");

type Row = [string, string];
type Section = { title: string; rows: Row[]; note?: string | undefined };

function sections(lead: MortgageLead, progress?: PurchaseProgress): Section[] {
  const p = lead.profile;
  const t = lead.terms;
  const incomes = p.incomes ?? [];
  const monthly = incomes.length ? totalMonthlyIncome(incomes) : p.monthlyGross;
  const assets = normalizeAssets(p.assets).entries.filter(
    (a) => a.value || a.institution || a.address || a.description,
  );
  const liab = p.liabilities;
  const status = usStatusOf(p, lead.usPerson);
  const out: Section[] = [];

  out.push({
    title: "Borrower",
    rows: [
      ["Name", lead.clientName],
      ["Loqal client ID", loqalNumber(lead.clientEmail)],
      ["Date of birth", p.dateOfBirth ? formatDate(p.dateOfBirth) : "—"],
      ["Marital status", p.maritalStatus ? MARITAL_LABEL[p.maritalStatus] : "—"],
      [
        "Dependents",
        p.dependents?.length
          ? `${p.dependents.length} (ages ${p.dependents.map((d) => d.age || "—").join(", ")})`
          : "None",
      ],
      ["US status", US_STATUS_LABEL[status]],
      [
        lead.usPerson ? "SSN" : "ITIN",
        lead.usPerson ? p.ssn || "Not provided" : p.hasItin ? p.itin || "Provided" : "No ITIN",
      ],
      ...(lead.usPerson
        ? []
        : ([
            ["Country of residence", countryLabel(p.countryOfResidence) || "—"],
            [
              "Citizenship",
              [countryLabel(p.citizenship), countryLabel(p.secondCitizenship)]
                .filter(Boolean)
                .join(" / ") || "—",
            ],
            [
              "US visa",
              p.usVisaActive
                ? `Active · ${formatDate(p.visaIssued)} - ${formatDate(p.visaValidUntil)}`
                : "Not active",
            ],
            ["US bank account", yesNo(p.usBankAccount)],
          ] as Row[])),
    ],
  });

  out.push({
    title: "Subject property & loan request",
    rows: [
      ["Property", lead.propertyLabel],
      ["Purchase price requested", money(lead.propertyPrice)],
      ["Intended use", p.propertyUse ?? "Primary residence"],
      ["File submitted", formatDateTime(lead.submittedAt)],
      ["File status", LEAD_STATUS_LABEL[lead.status]],
      ["Soft credit score", lead.creditScore ? String(lead.creditScore) : "—"],
      ["DTI ceiling", `${Math.round(lead.dtiLimit * 100)}%`],
    ],
  });

  if (t) {
    out.push({
      title: "Pre-approval terms issued",
      rows: [
        ["Lending company", t.lenderName ?? lead.lenderPartnerName ?? "—"],
        ["Company NMLS", t.lenderNmls ?? "—"],
        ["Loan amount", money(lead.propertyPrice * (1 - t.downPaymentPct / 100))],
        ["Interest rate", `${t.ratePct}%`],
        ["Term", `${t.termYears} years`],
        ["Down payment", `${t.downPaymentPct}%`],
        ["Closing costs", `${t.closingCostPct}%`],
        [
          "Taxes + insurance",
          `${money(Math.round((lead.propertyPrice * t.taxInsurancePct) / 100))} / yr`,
        ],
        ["Issued", formatDate(t.issuedAt)],
      ],
    });
  }

  if (progress) {
    out.push({
      title: "Purchase progress",
      rows: [
        ["Stage", PURCHASE_STAGE_LABEL[progress.stage]],
        ["Agreed purchase price", progress.agreedPrice ? money(progress.agreedPrice) : "—"],
        ["Agreement signed", progress.signedAt ? formatDateTime(progress.signedAt) : "—"],
        ["Closing date", progress.closingDate ? formatDate(progress.closingDate) : "—"],
        [
          "Mortgage approval due",
          progress.approvalDueDate ? formatDate(progress.approvalDueDate) : "—",
        ],
        ["Buyer's agent", lead.buyerAgent?.agentName ?? "—"],
      ],
    });
  }

  out.push({
    title: "Address history (2 years)",
    rows: p.addresses.length
      ? p.addresses.map(
          (a) =>
            [
              `${isoToUsMonth(a.from) || "—"} - ${a.present ? "Present" : isoToUsMonth(a.to) || "—"}`,
              [a.street, a.city, a.state, a.zip, a.country ? countryLabel(a.country) : ""]
                .filter(Boolean)
                .join(", "),
            ] as Row,
        )
      : [["—", "No addresses provided"]],
  });

  out.push({
    title: "Employment & income",
    note: `Qualifying monthly income ${money(monthly)} · annual ${money(monthly * 12)}`,
    rows: incomes.length
      ? incomes.flatMap((s) => {
          const head: Row = [
            `${s.employer || "—"}${s.title ? ` · ${s.title}` : ""}`,
            `${INCOME_TYPE_LABEL[s.type]}${isForeignIncome(s) ? " · foreign income" : ""}`,
          ];
          const period: Row = [
            "Period",
            `${isoToUsMonth(s.from) || "—"} - ${s.current ? "Present" : isoToUsMonth(s.to) || "—"}`,
          ];
          const addr: Row = [
            "Employer address",
            [s.address.street, s.address.city, s.address.state, s.address.zip,
              s.address.country ? countryLabel(s.address.country) : ""]
              .filter(Boolean)
              .join(", ") || "—",
          ];
          const rows: Row[] = [head, period, addr];
          if (s.type === "w2") {
            rows.push([
              "Pay",
              s.payType === "hourly"
                ? `$${s.hourlyRate || "—"} × ${s.monthlyHours || "—"} h / month`
                : `${money(num(s.annualSalary))} annual salary`,
            ]);
            rows.push(["Related party", RELATED_PARTY_LABEL[s.relatedParty]]);
          }
          if (s.type === "self_employed") {
            rows.push(["Ownership", s.ownershipPct ? `${s.ownershipPct}%` : "—"]);
            rows.push(["Business type", s.businessType || "—"]);
            rows.push(["Income last year", money(num(s.annualIncomeLastYear))]);
            rows.push(["Estimated this year", money(num(s.estimatedAnnualIncome))]);
          }
          if (s.type === "seasonal") {
            rows.push(["Gross per working month", money(num(s.seasonMonthlyGross))]);
            rows.push(["Working months per year", s.monthsPerYear || "—"]);
          }
          if (isForeignIncome(s)) {
            rows.push(["Currency / FX rate", `${s.currency || "—"} · ${s.fxRate || "—"}`]);
          }
          rows.push(["Qualifying monthly (USD)", money(monthlyForIncome(s))]);
          return rows;
        })
      : p.employment.length
        ? p.employment.map(
            (e) =>
              [
                `${e.title} — ${e.employer}`,
                `${isoToUsMonth(e.from) || "—"} - ${e.current ? "Present" : isoToUsMonth(e.to) || "—"}`,
              ] as Row,
          )
        : [["—", "No income or employment on file"]],
  });

  out.push({
    title: "Assets",
    rows: assets.length
      ? assets.map((a) => {
          const label =
            a.type === "bank_account" && a.kind
              ? `${ASSET_TYPE_LABEL[a.type]} · ${BANK_ACCOUNT_KIND_LABEL[a.kind] ?? a.kind}`
              : ASSET_TYPE_LABEL[a.type];
          const value = [
            `${a.value || "0"} ${a.currency}`,
            a.institution,
            a.address,
            a.description,
            countryLabel(a.country),
          ]
            .filter(Boolean)
            .join(" · ");
          return [label, value] as Row;
        })
      : [["—", "No assets declared"]],
  });

  out.push({
    title: "Monthly liabilities",
    note: liab ? `Total ${money(totalLiabilities(liab))} / month` : undefined,
    rows: liab
      ? [
          ["Property loans", money(num(liab.propertyLoans))],
          ["Vehicle loans", money(num(liab.vehicleLoans))],
          ["Credit cards", money(num(liab.creditCards))],
          ["Student loans", money(num(liab.studentLoans))],
          ...liab.other.map((o) => [o.label || "Other", money(num(o.amount))] as Row),
        ]
      : [["—", "Not submitted"]],
  });

  const d = p.declarations;
  out.push({
    title: "Declarations & military service",
    rows: d
      ? [
          ["Will occupy as primary residence", yesNo(d.primaryResidence)],
          ["Ownership interest last 3 years", yesNo(d.ownershipInterestLast3Years)],
          ["Affiliation with the seller", yesNo(d.familyOrBusinessWithSeller)],
          ["Borrowing other money", yesNo(d.borrowingOtherMoney)],
          ["Applying for another mortgage", yesNo(d.applyingOtherMortgage)],
          ["Applying for new credit", yesNo(d.applyingNewCredit)],
          ["Outstanding judgments", yesNo(d.outstandingJudgments)],
          ["Delinquent federal debt", yesNo(d.delinquentFederalDebt)],
          ["Party to a lawsuit", yesNo(d.partyToLawsuit)],
          ["Foreclosure / short sale / deed in lieu",
            yesNo(d.propertyForeclosed || d.preForeclosureOrShortSale || d.conveyedTitleInLieu)],
          [
            "Bankruptcy",
            d.bankruptcy
              ? `Yes${d.bankruptcyChapters.length ? ` · ${d.bankruptcyChapters.join(", ")}` : ""}${
                  d.bankruptcyDischargeDate ? ` · discharged ${d.bankruptcyDischargeDate}` : ""
                }`
              : "No",
          ],
          ["Military service", yesNo(p.military?.served)],
        ]
      : [["—", "Not submitted"]],
  });

  const documents: Row[] = [];
  for (const doc of p.idDocuments ?? [])
    documents.push([`ID document — ${doc.name}`, formatDateTime(doc.uploadedAt)]);
  for (const doc of p.visaDocuments ?? [])
    documents.push([`Visa document — ${doc.name}`, formatDateTime(doc.uploadedAt)]);
  for (const doc of p.bankruptcyDocuments ?? [])
    documents.push([`Bankruptcy papers — ${doc.name}`, formatDateTime(doc.uploadedAt)]);
  for (const r of lead.infoRequests)
    for (const doc of r.documents) documents.push([doc.name, formatDateTime(doc.uploadedAt)]);
  out.push({
    title: "Documents on file",
    rows: documents.length ? documents : [["—", "No documents uploaded"]],
  });

  if (lead.infoRequests.length) {
    out.push({
      title: "Information requests",
      rows: lead.infoRequests.map(
        (r) =>
          [r.question, r.answeredAt ? `Answered: ${r.answer ?? "see documents"}` : "Open"] as Row,
      ),
    });
  }

  return out;
}

export async function buildClientFilePdf(lead: MortgageLead, progress?: PurchaseProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const labelW = 210;
  let y = M;

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130);
    doc.text(
      `${LOQAL_LOS_NAME} · confidential client file · ${loqalNumber(lead.clientEmail)} · page ${page}`,
      M,
      pageH - 22,
    );
    doc.setTextColor(30);
  };

  const newPage = () => {
    footer();
    doc.addPage();
    y = M;
  };

  const need = (h: number) => {
    if (y + h > pageH - 48) newPage();
  };

  /* Header */
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20);
  doc.text("Loqal client file", M, y + 6);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  y += 24;
  doc.text(
    `Uniform Residential Loan Application summary · exported ${formatDateTime(new Date().toISOString())}`,
    M,
    y,
  );
  y += 14;
  doc.text(
    `Machine-readable transfer: MISMO v3.4 (ULAD/URLA) XML accompanies this document.`,
    M,
    y,
  );
  y += 18;
  doc.setDrawColor(200).line(M, y, pageW - M, y);
  y += 22;

  for (const s of sections(lead, progress)) {
    need(60);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
    doc.text(s.title, M, y);
    y += s.note ? 13 : 8;
    if (s.note) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(110);
      doc.text(s.note, M, y);
      y += 8;
    }
    doc.setDrawColor(225).line(M, y, pageW - M, y);
    y += 14;

    for (const [label, value] of s.rows) {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
      const labelLines = doc.splitTextToSize(label, labelW - 12) as string[];
      doc.setFont("helvetica", "bold").setTextColor(25);
      const valueLines = doc.splitTextToSize(String(value || "—"), pageW - M * 2 - labelW) as string[];
      const h = Math.max(labelLines.length, valueLines.length) * 12 + 4;
      need(h);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
      doc.text(labelLines, M, y);
      doc.setFont("helvetica", "bold").setTextColor(25);
      doc.text(valueLines, M + labelW, y);
      y += h;
    }
    y += 12;
  }

  footer();
  return doc;
}

export async function downloadClientFilePdf(lead: MortgageLead, progress?: PurchaseProgress) {
  const doc = await buildClientFilePdf(lead, progress);
  doc.save(exportFileName(lead, "pdf"));
}
