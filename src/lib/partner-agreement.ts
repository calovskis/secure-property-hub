/**
 * Loqal partner agreements.
 *
 * The agreement a partner signs in the portal is generated from their own
 * registration record, so every variable (legal company name, entity type,
 * registration number, address, licensed states, NMLS numbers, signatory name
 * and title, effective date) is filled in automatically — no placeholders are
 * ever shown to the partner.
 *
 * Mortgage lenders receive the full Mortgage Lender Partner Agreement; other
 * partner types receive the shorter general partner agreement until their own
 * long-form text is provided.
 */
import type { PartnerRequest } from "@/lib/partner-requests";
import { formatDate } from "@/lib/dates";

/** Loqal's own contracting details — one place to keep them. */
export const LOQAL_PARTY = {
  legalName: "Loqal Inc.",
  state: "Delaware",
  address: "1209 Orange Street, Wilmington, DE 19801, United States",
  serviceLevelsUrl: "https://loqal.global/partners/service-levels",
  venue: "New Castle County, Delaware",
  signatoryName: "Eleonora Pole",
  signatoryTitle: "Chief Executive Officer",
} as const;

export type AgreementVariable = { label: string; value: string };

export type PartnerAgreement = {
  title: string;
  /** Effective date (ISO) — the day Loqal approved the registration. */
  effectiveDate: string;
  /** The filled-in variables, shown to the partner before they sign. */
  variables: AgreementVariable[];
  /** Full agreement text, every variable resolved. */
  body: string;
  /** Suggested download file name (without extension). */
  fileBase: string;
};

function signatoryName(r: PartnerRequest) {
  return `${r.firstName} ${r.lastName}`.trim();
}

function addressOf(r: PartnerRequest) {
  const parts = [r.street, r.city, [r.state, r.zip].filter(Boolean).join(" "), r.country];
  return parts.filter((p) => p && p.trim()).join(", ");
}

function statesOf(r: PartnerRequest) {
  if (r.allStates) return "all states in which Lender is duly licensed";
  return r.states.length ? r.states.join(", ") : "the states declared in Lender's registration";
}

function licenceLines(r: PartnerRequest) {
  const rows = (r.lenderLicenses ?? []).filter((l) => l.number);
  if (!rows.length) {
    return r.lenderLicence
      ? `- NMLS number: ${r.lenderLicence}`
      : "- State licence details as recorded in Lender's Loqal partner profile";
  }
  return rows
    .map(
      (l) =>
        `- ${l.state}: NMLS № ${l.number}${l.validUntil ? ` · valid until ${formatDate(l.validUntil)}` : ""}`,
    )
    .join("\n");
}

export function agreementVariables(r: PartnerRequest, effectiveDate: string): AgreementVariable[] {
  const vars: AgreementVariable[] = [
    { label: "Effective date", value: formatDate(effectiveDate) },
    { label: "Partner legal name", value: r.companyName },
    { label: "Entity type", value: r.companyType || "—" },
    { label: "State / country of registration", value: [r.state, r.country].filter(Boolean).join(", ") },
    { label: "Company registration number", value: r.registrationNumber || "—" },
    { label: "Principal place of business", value: addressOf(r) },
    { label: "Authorized signatory", value: signatoryName(r) },
    { label: "Signatory title", value: r.position || "Authorized representative" },
    { label: "Notices email", value: r.email },
  ];
  if (r.partnerType === "lender") {
    vars.push(
      { label: "General NMLS number", value: r.lenderLicence || "—" },
      { label: "Licensed states", value: statesOf(r) },
    );
  }
  return vars;
}

/* ------------------------------------------------------------------ */
/* Mortgage lender partner agreement                                   */
/* ------------------------------------------------------------------ */

function lenderBody(r: PartnerRequest, effectiveDate: string) {
  const lender = r.companyName;
  const signatory = signatoryName(r);
  const title = r.position || "Authorized representative";
  const date = formatDate(effectiveDate);
  const L = LOQAL_PARTY;

  return `MORTGAGE LENDER PARTNER AGREEMENT (LOQAL PLATFORM)

This Mortgage Lender Partner Agreement (the "Agreement") is entered into as of ${date} (the "Effective Date") by and between:

${L.legalName}, a ${L.state} corporation, with principal place of business at ${L.address} ("Loqal" or "Platform"); and

${lender}, a ${[r.state, r.country].filter(Boolean).join(", ")} ${r.companyType || "entity"}, company registration number ${r.registrationNumber || "as recorded with Loqal"}, with principal place of business at ${addressOf(r)} ("Lender" or "Mortgage Lender Partner").

Loqal and Lender may be referred to individually as a "Party" and collectively as the "Parties."

LENDER LICENSING DETAILS OF RECORD
General NMLS number: ${r.lenderLicence || "as recorded in Lender's Loqal partner profile"}
Licensed states covered by this Agreement: ${statesOf(r)}
State licences:
${licenceLines(r)}

1. PURPOSE AND SCOPE

1.1 Platform Role. Loqal operates an online platform ("Loqal Platform" or "Platform") that connects property investors and owners with third-party service providers, including mortgage lenders, for purposes of facilitating real estate transactions in the United States.

1.2 Lender Role. Lender is a licensed mortgage lender (or mortgage broker, as applicable) that offers mortgage lending products and services to consumers in the United States. Lender shall be solely responsible for all mortgage-related activities, including underwriting, disclosures, compliance with federal and state lending laws, and loan servicing (if applicable).

1.3 No Lending Role by Loqal. Loqal is not a mortgage lender, mortgage broker, loan originator, or settlement service provider under the Real Estate Settlement Procedures Act ("RESPA"), 12 U.S.C. § 2601 et seq., and Regulation X (12 C.F.R. Part 1024). Loqal does not: (i) take mortgage applications; (ii) make credit decisions; (iii) negotiate loan terms; or (iv) receive compensation from borrowers for mortgage-related services. Loqal's role is limited to providing technology, marketing, and matching services between users and Lender.

2. DEFINITIONS

For purposes of this Agreement:

- "Client" or "Loqal User" means any individual or entity that uses the Loqal Platform and is matched with or introduced to Lender.
- "Lead" means information about a Loqal User that Loqal shares with Lender for potential mortgage lending opportunities.
- "Confidential Information" has the meaning set forth in Section 6.
- "Personal Data" means any information relating to an identified or identifiable natural person, including but not limited to name, contact information, financial data, credit information, and property details.
- "Service Levels" means the response-time and servicing standards published by Loqal at ${L.serviceLevelsUrl}, as may be updated from time to time with reasonable notice to Lender.
- "Marketing & Technology Services" means the services described in Section 4.1, including platform access, lead routing, analytics, co-marketing, and related technology services.

3. APPOINTMENT AND RELATIONSHIP

3.1 Non-Exclusive Appointment. Loqal appoints Lender as a non-exclusive mortgage lender partner on the Loqal Platform. Loqal may engage other lenders and service providers at its sole discretion.

3.2 Independent Contractors. The Parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, agency, or employment relationship. Lender has no authority to bind Loqal or incur obligations on Loqal's behalf.

3.3 Compliance with Laws. Each Party represents that it is in compliance with all applicable federal, state, and local laws and regulations in performing its obligations under this Agreement, including but not limited to RESPA, Regulation X, the Truth in Lending Act (TILA), the Equal Credit Opportunity Act (ECOA), the Fair Credit Reporting Act (FCRA), the Gramm-Leach-Bliley Act (GLBA), and applicable state licensing and consumer protection laws.

4. SERVICES PROVIDED BY LOQAL

4.1 Marketing & Technology Services. Loqal shall provide Lender with:
- Access to the Loqal Platform partner portal;
- Lead routing and matching based on Loqal's algorithms and parameters (e.g., loan type, geography, borrower profile);
- Basic analytics and reporting on lead status and outcomes;
- Co-marketing opportunities and brand exposure on the Platform;
- Technical support for Platform-related issues.

4.2 No Guarantee of Volume. Loqal does not guarantee any minimum number of Leads, loan volume, or conversion rates. All Leads are provided on an "as available" basis.

4.3 Algorithmic Matching. Lender acknowledges that Loqal uses proprietary algorithms and parameters to match Clients with Lenders. Loqal makes no representation or warranty regarding the quality, creditworthiness, or suitability of any Lead.

5. SERVICES AND OBLIGATIONS OF LENDER

5.1 Licensing and Authorization. Lender represents and warrants that it:
- Is duly organized, validly existing, and in good standing under the laws of its jurisdiction;
- Holds all licenses, registrations, and approvals required to originate, underwrite, and close mortgage loans in each state where it will serve Loqal Clients, including those listed above;
- Will maintain such licenses and approvals throughout the Term and keep the licence details and copies in its Loqal partner profile current and verified by Loqal.

5.2 Compliance with Service Levels. Lender agrees to adhere to Loqal's Service Levels, including but not limited to:
- Responding to new Leads within the timeframes specified at ${L.serviceLevelsUrl};
- Providing status updates on Leads in the Platform within required intervals;
- Meeting agreed turnaround times for pre-approval, underwriting decisions, and closing coordination.

Failure to meet Service Levels may result in reduced Lead allocation, suspension, or termination, at Loqal's discretion.

5.3 Accurate and Lawful Information. Lender shall ensure that all information, rates, terms, and representations provided to Loqal or Loqal Clients are:
- Accurate, complete, and not misleading;
- Provided in good faith and in compliance with all applicable laws;
- Updated promptly when changed.

Lender shall be solely liable for any inaccuracies, misrepresentations, or illegal conduct in its lending activities. Loqal may report Lender's misconduct to regulators, industry bodies, or affected Clients, as Loqal deems appropriate.

5.4 No Unauthorized Use of Loqal Brand. Lender shall not use Loqal's name, logos, or trademarks except as expressly authorized in writing by Loqal and in accordance with Loqal's brand guidelines.

6. CONFIDENTIALITY AND DATA PROTECTION

6.1 Definition of Confidential Information. "Confidential Information" means all non-public information disclosed by one Party ("Disclosing Party") to the other ("Receiving Party"), whether orally, in writing, or electronically, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. Confidential Information includes, without limitation:
- Personal Data of Loqal Clients;
- Lead data, borrower financials, credit information, and property details;
- Business plans, algorithms, pricing, strategies, and technical information of Loqal;
- Terms of this Agreement.

6.2 Obligations of Receiving Party. The Receiving Party shall:
- Use Confidential Information solely for purposes of performing its obligations under this Agreement (for Lender, limited to evaluating and originating mortgage loans for Loqal Clients);
- Not disclose Confidential Information to any third party except to its employees, contractors, or affiliates who have a need to know and are bound by confidentiality obligations at least as protective as this Section;
- Protect Confidential Information using at least the same degree of care it uses to protect its own confidential information, but no less than reasonable care.

6.3 Client Data Use Restrictions. Lender acknowledges that Client data shared by Loqal is highly sensitive and discreet. Lender shall:
- Use such data only for mortgage lending evaluation, origination, and servicing for the specific Client and transaction for which it was provided;
- Not use Client data for any other marketing, cross-selling, data brokering, profiling, or secondary purposes without the Client's explicit consent and Loqal's prior written approval;
- Not sell, rent, or otherwise transfer Client data to any third party, except as necessary to process the loan (e.g., credit bureaus, investors, insurers) and only in compliance with GLBA and other privacy laws.

6.4 Data Security. Lender shall implement and maintain administrative, physical, and technical safeguards reasonably designed to protect the security, confidentiality, and integrity of Personal Data, consistent with applicable law and industry standards.

6.5 Breach Notification. Lender shall notify Loqal in writing within seventy-two (72) hours of discovering any actual or suspected unauthorized access, acquisition, or disclosure of Client data provided by Loqal. Lender shall cooperate fully with Loqal in investigating and mitigating such breaches and shall bear all costs arising from Lender's breach of this Section.

6.6 Return or Destruction. Upon termination or expiration of this Agreement, or upon Loqal's request, Lender shall promptly return or securely destroy all Confidential Information and Client data provided by Loqal, except as required by law or regulatory record-keeping obligations.

6.7 Exceptions. Confidentiality obligations do not apply to information that: (i) is or becomes publicly known through no fault of the Receiving Party; (ii) was lawfully known to the Receiving Party prior to disclosure; (iii) is independently developed without use of Confidential Information; or (iv) is required to be disclosed by law, regulation, or court order (with prior notice to the Disclosing Party, where permitted).

7. NON-CIRCUMVENTION AND ANTI-AVOIDANCE

7.1 Non-Circumvention. Lender agrees that, for a period of twenty-four (24) months from the date a Loqal Client is first introduced to Lender via the Platform, Lender shall not, directly or indirectly:
- Bypass, circumvent, or avoid Loqal to engage such Client for mortgage lending services arising from or related to the introduction;
- Solicit or accept business from such Client for mortgage lending in a manner designed to avoid payment of fees due to Loqal under this Agreement;
- Encourage or assist any third party to do any of the foregoing.

This includes situations where Lender or its affiliates subsequently deal directly with the Client, or through another broker, affiliate, or entity, for transactions that are substantially related to the original introduction.

7.2 Fee Obligation on Circumvention. If Lender (or any affiliate, successor, or related entity) enters into a mortgage transaction with a Loqal Client introduced via the Platform, whether directly or indirectly, and such transaction would have been subject to fees under this Agreement, then Lender shall still owe Loqal the full fees as if the transaction had been processed through the Platform. Loqal may estimate such fees based on available data, and such estimate shall be binding absent clear and convincing evidence to the contrary.

7.3 Audit and Verification. Loqal may, upon reasonable notice and no more than twice per year, audit Lender's records reasonably related to Loqal-introduced Clients to verify compliance with this Section. Lender shall cooperate fully and provide relevant, non-privileged documentation.

8. FEES AND PAYMENT TERMS (RESPA-AWARE STRUCTURE)

The following fee structure is intended to be consistent with RESPA Section 8 by compensating Loqal for bona fide marketing and technology services at fair market value, rather than paying for referrals per se.

8.1 Marketing & Technology Services Fee. In consideration for the Marketing & Technology Services described in Section 4, Lender shall pay Loqal a fee (the "Fee") calculated as one percent (1%) of the principal amount of each mortgage loan originated to a Loqal Client introduced via the Platform, provided that:
- The Fee is compensation for actual marketing, technology, and platform services rendered by Loqal;
- The amount is determined based on a good-faith assessment of fair market value for such services;
- The Fee is not structured as a payment for the referral itself, but for ongoing platform access, lead management, analytics, co-marketing, and technology infrastructure.

The Parties acknowledge that the correlation between Fee and loan amount reflects the scale of services (e.g., higher loan amounts may involve more complex coordination and marketing exposure), and not a prohibited "per-referral" kickback.

8.2 Payment Timing. The Fee shall be payable within three (3) business days after the closing of each qualifying mortgage loan to a Loqal Client. Lender shall provide Loqal with a brief statement indicating loan amount, closing date, and Client identifier (as permitted by privacy laws).

8.3 Taxes. All fees are exclusive of taxes. Each Party is responsible for its own income taxes. If withholding is required by law, the paying Party may withhold such amounts and provide appropriate documentation.

8.4 Late Payments. Any Fee not paid when due shall accrue interest at the rate of one and one-half percent (1.5%) per month (or the maximum rate permitted by law, if lower) from the due date until paid in full. Loqal may suspend Lead referrals and/or terminate this Agreement for material payment delays.

8.5 RESPA Compliance Representation. Each Party represents that, to the best of its knowledge after consultation with counsel, the fee arrangement set forth in this Section is structured to comply with RESPA Section 8 and Regulation X, and is compensation for actual services rendered at fair market value, not a prohibited referral fee or kickback.

8.6 Adjustment for Legal Requirements. If either Party's counsel reasonably determines that the Fee structure poses a material risk of violating RESPA or other applicable laws, the Parties shall promptly negotiate in good faith to modify the fee structure (e.g., flat monthly platform fee, tiered service-based pricing) to achieve compliance while preserving the economic intent to the extent legally permissible.

9. DISCLAIMERS AND LIMITATION OF LIABILITY

9.1 No Lending Responsibility. Loqal does not:
- Guarantee loan approval, rates, terms, or closing timelines;
- Control Lender's underwriting, pricing, or servicing practices;
- Assume any liability for Lender's acts, omissions, or compliance failures.

All mortgage-related decisions and obligations rest solely with Lender.

9.2 "As Is" Platform. The Loqal Platform is provided "as is" and "as available." Loqal disclaims all warranties, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement, to the fullest extent permitted by law.

9.3 Limitation of Liability. Except for (i) Lender's payment obligations, (ii) breaches of confidentiality or data protection obligations, (iii) gross negligence or willful misconduct, or (iv) indemnification obligations under Section 10, neither Party shall be liable to the other for any indirect, incidental, consequential, special, or punitive damages, even if advised of the possibility thereof. Loqal's aggregate liability under this Agreement shall not exceed the total Fees paid by Lender to Loqal in the twelve (12) months preceding the claim.

10. INDEMNIFICATION

10.1 Indemnity by Lender. Lender shall indemnify, defend, and hold harmless Loqal, its affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, losses, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:
- Lender's mortgage lending activities, including any violation of federal, state, or local laws;
- Any misrepresentation, fraud, negligence, or willful misconduct by Lender;
- Any breach of this Agreement by Lender, including confidentiality and data protection obligations;
- Any claim by a Client or third party that Lender's actions caused harm, loss, or regulatory violation.

10.2 Indemnity by Loqal. Loqal shall indemnify, defend, and hold harmless Lender from and against claims arising out of Loqal's gross negligence or willful misconduct in providing the Platform, or material breach of this Agreement by Loqal.

10.3 Procedures. The indemnified Party shall provide prompt notice of any claim, cooperate in the defense, and allow the indemnifying Party to control the defense and settlement, provided that no settlement may impose liability or obligations on the indemnified Party without its written consent.

11. TERM AND TERMINATION

11.1 Initial Term. This Agreement shall commence on the Effective Date and continue for an initial term of two (2) years (the "Initial Term"), unless earlier terminated in accordance with this Section.

11.2 Renewal. This Agreement shall automatically renew for successive one (1) year periods (each a "Renewal Term") unless either Party gives written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.

11.3 Termination for Cause. Either Party may terminate this Agreement immediately upon written notice if the other Party:
- Materially breaches any provision of this Agreement and fails to cure such breach within ten (10) business days of written notice (or immediately for breaches of confidentiality, data protection, non-circumvention, or payment obligations);
- Becomes insolvent, files for bankruptcy, or ceases to conduct business in the ordinary course.

11.4 Termination for Convenience. Loqal may terminate this Agreement for convenience upon thirty (30) days' written notice to Lender. Lender may terminate for convenience upon sixty (60) days' written notice, subject to payment of all accrued Fees for closed loans.

11.5 Effect of Termination. Upon termination:
- Lender shall immediately pay all outstanding Fees;
- Sections 6 (Confidentiality), 7 (Non-Circumvention), 8 (Fees for already-introduced Clients as applicable), 9 (Disclaimers), 10 (Indemnification), and 12 (Governing Law) shall survive;
- Lender shall cease using Loqal's trademarks and Platform access, except as necessary to service existing loans.

12. GOVERNING LAW; DISPUTE RESOLUTION

12.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of ${L.state}, without regard to its conflict-of-law principles.

12.2 Venue. Any action or proceeding arising out of or relating to this Agreement shall be brought exclusively in the federal or state courts located in ${L.venue}, and each Party consents to the personal jurisdiction of such courts.

12.3 Waiver of Jury Trial. TO THE EXTENT PERMITTED BY LAW, EACH PARTY HEREBY IRREVOCABLY WAIVES ANY RIGHT TO TRIAL BY JURY IN ANY ACTION OR PROCEEDING ARISING OUT OF OR RELATING TO THIS AGREEMENT.

12.4 Attorneys' Fees. In any action to enforce this Agreement, the prevailing Party shall be entitled to recover its reasonable attorneys' fees and costs.

13. MISCELLANEOUS

13.1 Entire Agreement. This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior or contemporaneous agreements, understandings, and communications, whether written or oral.

13.2 Amendments. Any amendment or modification of this Agreement must be in writing and signed by authorized representatives of both Parties.

13.3 Assignment. Lender may not assign or transfer its rights or obligations under this Agreement without Loqal's prior written consent. Loqal may assign this Agreement in connection with a merger, acquisition, or sale of substantially all of its assets.

13.4 Notices. All notices shall be in writing and delivered by email, certified mail, or reputable overnight courier. Notices to Lender shall be sent to ${r.email}${r.phone ? ` (telephone ${r.phone})` : ""} and to the address stated above; notices to Loqal shall be sent to partners@loqal.global and to ${L.address}.

13.5 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it enforceable.

13.6 Waiver. No failure or delay by either Party in exercising any right under this Agreement shall constitute a waiver of that right unless expressly stated in writing.

13.7 Counterparts; Electronic Signatures. This Agreement may be executed in counterparts, including via electronic signatures applied in the Loqal partner portal, each of which shall be deemed an original and all of which together constitute one instrument. The Parties consent to the use of electronic signatures under the U.S. E-SIGN Act and applicable state law.

IN WITNESS WHEREOF, the Parties have executed this Mortgage Lender Partner Agreement as of the Effective Date.

LOQAL INC.
By: ${L.signatoryName}
Name: ${L.signatoryName}
Title: ${L.signatoryTitle}
Date: ______________________

${lender.toUpperCase()}
By: ${signatory}
Name: ${signatory}
Title: ${title}
Date: ______________________
`;
}

/* ------------------------------------------------------------------ */
/* General partner agreement (realtors and other partner types)        */
/* ------------------------------------------------------------------ */

function generalBody(r: PartnerRequest, effectiveDate: string) {
  const L = LOQAL_PARTY;
  const signatory = signatoryName(r);
  const title = r.position || "Authorized representative";
  return `LOQAL PARTNER AGREEMENT

This Partner Agreement (the "Agreement") is entered into as of ${formatDate(effectiveDate)} (the "Effective Date") by and between ${L.legalName}, a ${L.state} corporation, with principal place of business at ${L.address} ("Loqal"), and ${r.companyName}, a ${[r.state, r.country].filter(Boolean).join(", ")} ${r.companyType || "entity"}, company registration number ${r.registrationNumber || "as recorded with Loqal"}, with principal place of business at ${addressOf(r)} ("Partner").

1. APPOINTMENT. Loqal appoints Partner as a non-exclusive service partner on the Loqal Platform. The Parties are independent contractors; nothing creates a partnership, joint venture, agency, or employment relationship.

2. PARTNER OBLIGATIONS. Partner shall hold and maintain every licence, registration and approval required for its services in each state it serves Loqal clients, keep its Loqal profile and licence copies current for Loqal verification, meet Loqal's published service levels, and provide accurate, lawful and non-misleading information to Loqal and its clients.

3. FEES. Buyer's agent engagements are compensated at three percent (3%) of the purchase price, payable at closing; Loqal's platform fee is twenty percent (20%) of the partner commission, invoiced per file. Fees are payable within three (3) business days of closing.

4. CONFIDENTIALITY AND CLIENT DATA. Client personal data shared by Loqal is highly sensitive. Partner shall use it only for the specific client engagement for which it was provided, shall not use it for other marketing, profiling, brokering or secondary purposes, shall not transfer it to third parties except as necessary to complete the engagement, and shall apply appropriate safeguards. Partner shall notify Loqal within seventy-two (72) hours of any suspected unauthorized disclosure.

5. NON-CIRCUMVENTION. For twenty-four (24) months from the first introduction of a Loqal client, Partner shall not bypass Loqal to engage that client for services arising from the introduction, nor structure any transaction to avoid fees due to Loqal.

6. TERM AND TERMINATION. The Agreement runs for two (2) years and renews for successive one (1) year terms unless either Party gives sixty (60) days' notice. Either Party may terminate immediately for uncured material breach, and Loqal may terminate for convenience on thirty (30) days' notice.

7. LIABILITY AND INDEMNITY. Partner is solely responsible for its own services and shall indemnify Loqal against claims arising from its acts, omissions or breaches. Neither Party is liable for indirect or consequential damages.

8. GOVERNING LAW. This Agreement is governed by the laws of the State of ${L.state}, with exclusive venue in ${L.venue}.

9. ELECTRONIC SIGNATURES. This Agreement may be executed by electronic signature applied in the Loqal partner portal under the U.S. E-SIGN Act.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

LOQAL INC.
By: ${L.signatoryName}
Title: ${L.signatoryTitle}

${r.companyName.toUpperCase()}
By: ${signatory}
Title: ${title}
`;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function buildPartnerAgreement(r: PartnerRequest): PartnerAgreement {
  const effectiveDate = r.decidedAt ?? r.submittedAt;
  const isLender = r.partnerType === "lender";
  const slug = (r.companyName || "partner")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return {
    title: isLender
      ? "Mortgage Lender Partner Agreement (Loqal Platform)"
      : "Loqal Partner Agreement",
    effectiveDate,
    variables: agreementVariables(r, effectiveDate),
    body: isLender ? lenderBody(r, effectiveDate) : generalBody(r, effectiveDate),
    fileBase: `loqal-${isLender ? "mortgage-lender" : "partner"}-agreement-${slug}`,
  };
}

/** The text of the agreement including the executed signature block. */
export function executedAgreementText(
  agreement: PartnerAgreement,
  r: PartnerRequest,
): string {
  const lines = [agreement.body, "", "— EXECUTION RECORD (LOQAL PLATFORM E-SIGNATURE) —"];
  if (r.agreementSignedAt) {
    lines.push(
      `Signed electronically by ${r.agreementSignedBy ?? ""} for ${r.companyName} on ${formatDate(r.agreementSignedAt)} (${r.agreementSignedAt}).`,
    );
  }
  if (r.agreementCountersignedAt) {
    lines.push(
      `Countersigned by ${LOQAL_PARTY.legalName} (${LOQAL_PARTY.signatoryName}, ${LOQAL_PARTY.signatoryTitle}) on ${formatDate(r.agreementCountersignedAt)}.`,
    );
  } else {
    lines.push("Awaiting Loqal countersignature.");
  }
  lines.push(`Loqal reference: ${r.id}`);
  return lines.join("\n");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Turn the plain agreement text into a properly typeset document: the title as
 * a centred heading, ALL-CAPS lines as numbered section headings, "1.1 …"
 * paragraphs justified with the clause number in bold, dashed lines as bullet
 * lists and the execution record as a framed block.
 */
function agreementHtmlBody(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let bullets: string[] = [];
  let titleDone = false;

  const flush = () => {
    if (!bullets.length) return;
    out.push(`<ul class="b">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      bullets.push(esc(line.replace(/^[-•]\s+/, "")));
      continue;
    }
    flush();
    if (!titleDone) {
      out.push(`<h1>${esc(line)}</h1>`);
      titleDone = true;
      continue;
    }
    if (/^—.*—$/.test(line)) {
      out.push(`<p class="exec">${esc(line.replace(/—/g, "").trim())}</p>`);
      continue;
    }
    const section = line.match(/^(\d+)\.\s+(.+)$/);
    if (section && line === line.toUpperCase()) {
      out.push(`<h2>${esc(section[1]!)}. ${esc(section[2]!)}</h2>`);
      continue;
    }
    if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length < 90) {
      out.push(`<h2>${esc(line)}</h2>`);
      continue;
    }
    const clause = line.match(/^(\d+\.\d+)\s+(.+)$/);
    if (clause) {
      out.push(`<p class="c"><span class="n">${esc(clause[1]!)}</span> ${esc(clause[2]!)}</p>`);
      continue;
    }
    out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join("\n");
}

/** Download the agreement as a formatted .doc file (Word / Pages / Docs). */
export function downloadAgreementDoc(name: string, text: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(
    name,
  )}</title><style>
@page { size: 8.5in 11in; margin: 1in 1in 1in 1in; }
body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; line-height: 1.5; color: #14213d; }
h1 { font-size: 15pt; text-align: center; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 6pt; }
.sub { text-align: center; font-size: 9.5pt; color: #6b7280; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 18pt; }
hr { border: none; border-top: 1.5pt solid #14213d; margin: 0 0 18pt; }
h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: .04em; margin: 16pt 0 6pt; page-break-after: avoid; }
p { margin: 0 0 8pt; text-align: justify; }
p.c { margin: 0 0 8pt; }
p.c .n { font-weight: bold; }
ul.b { margin: 0 0 8pt 18pt; padding: 0; }
ul.b li { margin: 0 0 4pt; text-align: justify; }
p.exec { margin: 18pt 0 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; text-align: center; }
.foot { margin-top: 22pt; border-top: .75pt solid #c8ccd6; padding-top: 6pt; font-size: 8.5pt; color: #6b7280; text-align: center; }
</style></head><body>
<p class="sub">Loqal Platform · Partner agreement</p>
${agreementHtmlBody(text)}
<p class="foot">Loqal Inc. · Confidential partner document · Generated ${esc(
    new Date().toLocaleDateString("en-US"),
  )}</p>
</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

