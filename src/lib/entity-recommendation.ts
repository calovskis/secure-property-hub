/**
 * Options, defaults and the plain-language summary of a Loqal entity
 * recommendation (holding structure for a US property purchase). Shared by the
 * admin recommendation pop-up and the client's review.
 */
import type { EntityRecommendation } from "@/lib/entity-setup";

export const ENTITY_TYPES = [
  { id: "Single-member LLC", hint: "One owner. Most common for one investor and one property; simple and inexpensive." },
  { id: "Multi-member LLC", hint: "Two or more owners (spouses, partners). Taxed as a partnership unless elected otherwise." },
  { id: "Series LLC", hint: "One LLC with separate 'series' per property — only in states that allow it (e.g. DE, TX, WY, IL, NV)." },
  { id: "LLC owned by a holding LLC", hint: "Parent holding company owns one property LLC per asset — keeps each property's liability separate." },
  { id: "Limited partnership (LP)", hint: "General partner manages, limited partners invest — used for larger pooled investments." },
  { id: "C-Corporation", hint: "Entity-level tax (21%). Sometimes used by foreign investors to avoid US estate tax and personal filings." },
  { id: "Revocable trust + LLC", hint: "Estate-planning layer on top of an LLC — privacy and avoiding US probate." },
] as const;

export const FORMATION_STATES = [
  { id: "Delaware", hint: "Established case law, courts used to business disputes; $300 annual franchise tax for LLCs." },
  { id: "Wyoming", hint: "Low fees (~$60/yr annual report), strong privacy and charging-order protection." },
  { id: "Florida", hint: "Common when the property is in Florida — avoids a second 'foreign' registration." },
  { id: "Texas", hint: "No annual fee for most LLCs, series LLCs allowed; public information report required." },
  { id: "Nevada", hint: "No state income tax; higher annual fees (~$350+)." },
  { id: "New York", hint: "Publication requirement for new LLCs (can cost $1,000+)." },
  { id: "California", hint: "$800 minimum annual franchise tax; required if the property is in California." },
  { id: "Property state (same as the property)", hint: "Simplest when there is one property — one registration and one annual report." },
] as const;

export const TAX_ITEMS = [
  "EIN application (IRS Form SS-4) — foreign owners without SSN apply by fax/phone",
  "Form 5472 + pro-forma 1120 each year (foreign-owned single-member LLC)",
  "US tax return on rental income (Form 1040-NR / 1065 / 1120)",
  "Election to treat rental income as effectively connected (net-basis taxation)",
  "FIRPTA — 15% withholding on a future sale by a foreign owner",
  "W-8BEN / W-8BEN-E for the property manager and bank",
  "ITIN for owners without an SSN",
  "US estate tax planning for foreign owners (exemption only $60,000)",
  "State income tax and local rental / occupancy taxes",
  "Home-country tax treaty and reporting of the US entity",
];

export const LEGAL_ITEMS = [
  "Operating agreement drafted and signed",
  "Title to be taken in the entity's name at closing",
  "Lender confirms it accepts entity vesting (personal guarantee may be required)",
  "Business bank account opened in the entity's name",
  "Beneficial ownership information for the bank (KYC) — owners of 25%+",
  "Foreign qualification in the property state",
  "Annual report and franchise tax calendar with the state",
  "Landlord / liability insurance in the entity's name",
  "Registered agent retained and service address set",
  "Corporate Transparency Act / BOI reporting check (currently foreign-formed companies only)",
];

export const emptyRecommendation = (): EntityRecommendation => ({
  entityType: "",
  formationState: "",
  entityName: "",
  foreignQualification: false,
  foreignQualificationState: "",
  whyThisStructure: "",
  registeredAgent: "",
  registeredAgentState: "",
  registeredAgentFee: "",
  owners: [{ name: "", percent: "100", role: "Member" }],
  management: "",
  managers: "",
  operatingAgreement: "",
  separateHolding: "",
  holdingStructure: "",
  holdingReason: "",
  vesting: "",
  lenderNote: "",
  tax: [],
  legal: [],
  taxNotes: "",
  formationCost: "",
  annualCost: "",
  timeline: "",
  documentsNeeded: "",
  additionalNotes: "",
});

export type RecRow = { key: string; group: string; label: string; value: string };

const MGMT = { member_managed: "Member-managed (owners run the company)", manager_managed: "Manager-managed (appointed manager runs the company)", "": "—" };

export function recommendationRows(r: EntityRecommendation): RecRow[] {
  const rows: RecRow[] = [
    { key: "entityType", group: "Entity", label: "Entity type", value: r.entityType || "—" },
    { key: "formationState", group: "Entity", label: "State of formation", value: r.formationState || "—" },
    { key: "entityName", group: "Entity", label: "Proposed name", value: r.entityName || "To be agreed" },
    {
      key: "foreignQualification",
      group: "Entity",
      label: "Registration in the property state",
      value: r.foreignQualification ? `Yes — foreign qualification in ${r.foreignQualificationState || "the property state"}` : "Not needed",
    },
    { key: "whyThisStructure", group: "Entity", label: "Why this structure", value: r.whyThisStructure || "—" },
    {
      key: "registeredAgent",
      group: "Registered agent",
      label: "Registered agent",
      value: [r.registeredAgent, r.registeredAgentState && `in ${r.registeredAgentState}`, r.registeredAgentFee && `${r.registeredAgentFee}/year`].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "owners",
      group: "Ownership & management",
      label: "Ownership",
      value: r.owners.filter((o) => o.name.trim()).map((o) => `${o.name} — ${o.percent}% (${o.role})`).join("; ") || "—",
    },
    { key: "management", group: "Ownership & management", label: "Manager structure", value: `${MGMT[r.management]}${r.managers ? ` — ${r.managers}` : ""}` },
    { key: "operatingAgreement", group: "Ownership & management", label: "Operating agreement", value: r.operatingAgreement || "Standard Loqal operating agreement" },
    {
      key: "separateHolding",
      group: "Holding structure",
      label: "Separate property-holding entity",
      value: r.separateHolding === "yes" ? `Recommended — ${r.holdingStructure || "details below"}` : r.separateHolding === "no" ? "Not needed" : "—",
    },
    { key: "holdingReason", group: "Holding structure", label: "Reasoning", value: r.holdingReason || "—" },
    { key: "vesting", group: "Holding structure", label: "How title is taken", value: r.vesting || "—" },
    { key: "lenderNote", group: "Holding structure", label: "Mortgage lender", value: r.lenderNote || "—" },
    { key: "tax", group: "Tax & legal coordination", label: "Tax coordination", value: r.tax.join("; ") || "—" },
    { key: "legal", group: "Tax & legal coordination", label: "Legal coordination", value: r.legal.join("; ") || "—" },
    { key: "taxNotes", group: "Tax & legal coordination", label: "Advisor notes", value: r.taxNotes || "—" },
    { key: "formationCost", group: "Costs & timeline", label: "One-time formation costs", value: r.formationCost || "—" },
    { key: "annualCost", group: "Costs & timeline", label: "Yearly running costs", value: r.annualCost || "—" },
    { key: "timeline", group: "Costs & timeline", label: "Timeline", value: r.timeline || "—" },
    { key: "documentsNeeded", group: "Costs & timeline", label: "What we need from you", value: r.documentsNeeded || "—" },
  ];
  if (r.additionalNotes) rows.push({ key: "additionalNotes", group: "Costs & timeline", label: "Additional notes", value: r.additionalNotes });
  return rows;
}

export function recommendationComplete(r: EntityRecommendation) {
  const missing: string[] = [];
  if (!r.entityType) missing.push("entity type");
  if (!r.formationState) missing.push("state of formation");
  if (!r.registeredAgent) missing.push("registered agent");
  if (!r.owners.some((o) => o.name.trim())) missing.push("ownership");
  if (!r.management) missing.push("manager structure");
  if (!r.separateHolding) missing.push("separate holding entity decision");
  return missing;
}
