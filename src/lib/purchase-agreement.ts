/**
 * Purchase and Sale Agreement template.
 *
 * The agreement text is the same in every state and only the variables change.
 * Most variables Loqal already knows — the buyer's legal name and address (from
 * registration / the mortgage profile), the property, the agreed price, the
 * buyer's agent and the holding company once it exists. The rest are choices we
 * put to the buyer (deposit, closing date, contingencies, assignability).
 *
 * `buildAgreement()` renders the numbered sections for the on-screen draft, and
 * `agreementWordHtml()` produces the Word document the buyer can download.
 */
import { formatPrice } from "@/data/properties";
import { formatDate } from "@/lib/dates";

export type PaymentMode = "cash" | "financed" | "seller_finance";

/** Everything the buyer can decide before signing. */
export type AgreementChoices = {
  /** Earnest money as a share of the price. */
  depositPct: number;
  /** Business days after execution to pay the deposit. */
  depositDays: number;
  escrowAgent: string;
  /** Target closing date, ISO. */
  closingDate: string;
  closingAgent: string;
  attorneyReviewDays: number;
  paymentMode: PaymentMode;
  inspection: boolean;
  inspectionDays: number;
  defectThreshold: number;
  appraisal: boolean;
  financing: boolean;
  financingDays: number;
  assignable: boolean;
  /** Buyer's broker commission, paid by the seller by default. */
  commissionPct: number;
  includedItems: string;
  excludedItems: string;
};

export function defaultChoices(price: number, financed: boolean): AgreementChoices {
  const closing = new Date();
  closing.setDate(closing.getDate() + 60);
  return {
    depositPct: 10,
    depositDays: 5,
    escrowAgent: "Loqal-appointed New York escrow attorney",
    closingDate: closing.toISOString().slice(0, 10),
    closingAgent: "Loqal-appointed closing attorney / title company",
    attorneyReviewDays: 3,
    paymentMode: financed ? "financed" : "cash",
    inspection: true,
    inspectionDays: 12,
    defectThreshold: Math.max(2500, Math.round((price * 0.005) / 500) * 500),
    appraisal: financed,
    financing: financed,
    financingDays: 45,
    assignable: false,
    commissionPct: 3,
    includedItems: "all fixtures, permanently attached systems, kitchen appliances and HVAC",
    excludedItems: "none",
  };
}

/** What Loqal already knows about the parties and the property. */
export type AgreementFacts = {
  /** Buyer as it will appear on the deed — person or holding company. */
  buyerLegalName: string;
  buyerAddress: string;
  buyerJurisdiction: string;
  buyerIsEntity: boolean;
  buyerIsForeign: boolean;
  sellerLegalName: string;
  sellerAddress: string;
  propertyStreet: string;
  propertyCity: string;
  propertyCounty: string;
  propertyState: string;
  propertyStateName: string;
  propertyZip: string;
  purchasePrice: number;
  buyerBrokerName: string;
  buyerBrokerFirm: string;
  buyerBrokerLicence: string;
  listingBrokerName: string;
};

export type AgreementSection = { n: string; title: string; body: string[] };

const money = (n: number) => formatPrice(Math.round(n));

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string {
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]!;
    return n % 10 ? `${t}-${ONES[n % 10]}` : t;
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${under1000(rest)}` : ""}`;
}

/** Price in words, as the agreement requires next to the figure. */
export function priceInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "zero";
  const parts: string[] = [];
  const scales: [number, string][] = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];
  for (const [value, name] of scales) {
    if (n >= value) {
      parts.push(`${under1000(Math.floor(n / value))} ${name}`);
      n %= value;
    }
  }
  if (n > 0) parts.push(under1000(n));
  const words = parts.join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildAgreement(
  facts: AgreementFacts,
  c: AgreementChoices,
  signedAt?: string,
): { heading: string; preamble: string[]; sections: AgreementSection[]; execution: string[] } {
  const deposit = Math.round((facts.purchasePrice * c.depositPct) / 100);
  const dateLine = signedAt ? formatDate(signedAt) : formatDate(new Date().toISOString());
  const state = facts.propertyStateName;

  const preamble = [
    `This PURCHASE AND SALE AGREEMENT (“Agreement”) is made as of ${dateLine} by and between:`,
    `SELLER: ${facts.sellerLegalName}, ${facts.sellerAddress}.`,
    `BUYER: ${facts.buyerLegalName}, ${facts.buyerAddress}${
      facts.buyerIsEntity ? `, organised under the laws of ${facts.buyerJurisdiction}` : ""
    }${facts.buyerIsEntity ? "" : ` (country of residence: ${facts.buyerJurisdiction})`}.`,
    ...(facts.buyerIsForeign ? ["(Buyer is a foreign national / foreign entity.)"] : []),
    "The Seller and Buyer are sometimes referred to individually as a “Party” and collectively as the “Parties.”",
  ];

  const sections: AgreementSection[] = [
    {
      n: "1",
      title: "PROPERTY",
      body: [
        `1.1 Description. Seller agrees to sell and Buyer agrees to purchase, upon the terms and conditions of this Agreement, the real property commonly known as: ${facts.propertyStreet}, ${facts.propertyCity}, County of ${facts.propertyCounty}, State of ${state}, ZIP ${facts.propertyZip}.`,
        "1.2 Legal Description. The property consists of the land and all improvements thereon, together with all appurtenant rights, as more particularly described in EXHIBIT A (the “Property”).",
        `1.3 Included Items. All fixtures and permanently attached systems and equipment, including ${c.includedItems}.`,
        `1.4 Excluded Items. The following items are specifically excluded from the sale: ${c.excludedItems || "none"}.`,
      ],
    },
    {
      n: "2",
      title: "PURCHASE PRICE AND PAYMENT TERMS",
      body: [
        `2.1 Purchase Price. The total purchase price for the Property (the “Purchase Price”) is US$ ${Math.round(
          facts.purchasePrice,
        ).toLocaleString()} (${priceInWords(facts.purchasePrice)} U.S. Dollars).`,
        `2.2 Deposit / Earnest Money. Buyer shall pay an initial deposit of US$ ${Math.round(
          deposit,
        ).toLocaleString()} (${c.depositPct}% of the Purchase Price, the “Deposit”) within ${
          c.depositDays
        } business days after full execution of this Agreement. The Deposit shall be held in escrow by ${
          c.escrowAgent
        } (the “Escrow Agent”).`,
        c.paymentMode === "cash"
          ? "2.3 Payment of Balance — All-cash transaction. Buyer shall pay the balance of the Purchase Price, after crediting the Deposit, in immediately available funds by wire transfer, certified check or cashier's check at Closing."
          : c.paymentMode === "financed"
            ? "2.3 Payment of Balance — Financed transaction. Buyer shall pay the balance of the Purchase Price using institutional mortgage financing as described in Section 8, with any shortfall paid in immediately available funds at Closing."
            : "2.3 Payment of Balance — Seller financing. Buyer shall pay part of the balance by executing a promissory note and mortgage in favour of Seller on the terms attached as EXHIBIT B, and the remainder in immediately available funds at Closing.",
        "2.4 Allocation of Closing Costs. Unless otherwise agreed in writing: (a) Buyer shall pay lender fees, recording taxes on any Buyer mortgage, Buyer's title insurance premiums (if elected), Buyer's attorney fees and Buyer's transfer/registration costs; (b) Seller shall pay state and local transfer taxes, Seller's attorney fees, payoff and recording fees for Seller's existing liens, and brokerage commissions as provided in Section 11.",
      ],
    },
    {
      n: "3",
      title: "CLOSING",
      body: [
        `3.1 Closing Date. The closing of the transaction (“Closing”) shall occur on or about ${formatDate(
          c.closingDate,
        )}, or such other date as the Parties may mutually agree in writing.`,
        `3.2 Closing Location. Closing shall take place at the offices of ${c.closingAgent} in ${facts.propertyCity}, ${state}, or another mutually agreed location, or may be conducted remotely via escrow and electronic signature to the extent permitted by applicable law.`,
        "3.3 Deliveries at Closing. (a) Seller shall deliver a duly executed bargain and sale deed with covenants (or other deed type agreed by the Parties) conveying good and marketable fee simple title to Buyer subject only to Permitted Exceptions; all keys, access codes and documents necessary for possession; and any required tax forms and certifications, including FIRPTA certificates if applicable. (b) Buyer shall deliver the balance of the Purchase Price in the manner specified in Section 2.3, executed loan documents (if financed), and any additional closing documents required by the title company or governmental authorities.",
      ],
    },
    {
      n: "4",
      title: "ATTORNEY REVIEW",
      body: [
        `4.1 Attorney Review Period. This Agreement is subject to review by the Parties' respective ${state}-licensed attorneys. Each Party shall have ${c.attorneyReviewDays} business days after the date of full execution of this Agreement (the “Attorney Review Period”) to have counsel review and approve this Agreement.`,
        `4.2 Modification or Cancellation. During the Attorney Review Period either Party's attorney may propose modifications by written notice. If the Parties cannot agree on modifications within ${c.attorneyReviewDays} business days after such notice, either Party may cancel this Agreement, whereupon the Deposit shall be returned to Buyer and neither Party shall have further obligations except those expressly stated to survive termination.`,
      ],
    },
    {
      n: "5",
      title: "PROPERTY CONDITION AND DISCLOSURES",
      body: [
        `5.1 Property Condition Disclosure Statement. To the extent required by applicable ${state} law, Seller shall deliver to Buyer a Property Condition Disclosure Statement in the statutory form prior to Buyer's execution of this Agreement, unless a statutory exemption applies.`,
        `5.2 Condition of Property; “As Is” Sale. Buyer acknowledges having the opportunity to inspect the Property and agrees to purchase the Property “AS IS” in its present condition as of Closing, subject to reasonable wear and tear and natural deterioration, except as otherwise provided in ${
          c.inspection ? "the inspection contingency in Section 6" : "this Agreement"
        }.`,
        "5.3 Access for Inspections and Appraisal. Seller shall provide reasonable access to the Property, with all utilities in service, for Buyer's inspections, appraisals and lender visits.",
      ],
    },
    {
      n: "6",
      title: "INSPECTION CONTINGENCY",
      body: c.inspection
        ? [
            `6.1 Inspection Period. Buyer shall have ${c.inspectionDays} calendar days after the Effective Date to obtain inspections of the Property by a ${state}-licensed home inspector, engineer, architect or other qualified professional chosen by Buyer.`,
            "6.2 Scope of Inspection. Inspections may include structural, mechanical, electrical, plumbing, roof, environmental, pest/termite, radon, water and septic (if applicable) and any other reasonable investigations of the Property condition.",
            `6.3 Material Defects and Remedies. If inspections disclose material defects and the estimated cost to correct any individual defect exceeds US$ ${Math.round(
              c.defectThreshold,
            ).toLocaleString()} or the aggregate estimated repair cost exceeds US$ ${Math.round(
              c.defectThreshold * 2,
            ).toLocaleString()}, Buyer may, by written notice before expiry of the Inspection Period, (a) terminate this Agreement and receive a prompt refund of the Deposit, (b) request that Seller repair such defects or provide a closing credit, or (c) waive such defects and proceed to Closing “as is”.`,
            "6.4 Failure to Timely Notify. If Buyer fails to deliver written notice under Section 6.3 by the end of the Inspection Period, the inspection contingency shall be deemed satisfied and waived by Buyer.",
          ]
        : ["6.1 No inspection contingency. Buyer waives any inspection contingency and accepts the Property “AS IS”."],
    },
    {
      n: "7",
      title: "APPRAISAL CONTINGENCY",
      body: c.appraisal
        ? [
            "7.1 Appraisal Requirement. Buyer's obligation to purchase the Property is contingent upon the Property appraising at an amount equal to or greater than the Purchase Price.",
            "7.2 Appraiser and Timing. The appraisal shall be performed by a state-certified real estate appraiser selected by Buyer or Buyer's lender within 30 days after the Effective Date.",
            "7.3 Consequences of Low Appraisal. If the appraisal is less than the Purchase Price, Buyer may, by written notice, (a) terminate this Agreement and receive a refund of the Deposit, (b) request a reduction of the Purchase Price or a closing credit, or (c) proceed at the existing Purchase Price and pay any appraisal gap in cash.",
            "7.4 Failure to Timely Notify. If Buyer does not give written notice under Section 7.3 within the appraisal period, the appraisal contingency shall be deemed satisfied and waived.",
          ]
        : ["7.1 No appraisal contingency. Buyer waives any appraisal contingency."],
    },
    {
      n: "8",
      title: "FINANCING (MORTGAGE) CONTINGENCY",
      body: c.financing
        ? [
            "8.1 Mortgage Application. Buyer shall apply in good faith for a mortgage loan on the terms of Buyer's pre-approval obtained through Loqal.",
            `8.2 Commitment Deadline. Buyer shall obtain a written mortgage commitment from an institutional lender on or before ${c.financingDays} days after the Effective Date.`,
            "8.3 Failure to Obtain Commitment. If Buyer, despite good-faith efforts, does not obtain a mortgage commitment by the deadline, Buyer may (a) terminate this Agreement by written notice, whereupon the Deposit shall be refunded, or (b) waive the financing contingency and proceed to Closing on an all-cash basis or using alternative financing acceptable to Buyer.",
            "8.4 Lender Conditions. Buyer's obligations are further subject to satisfaction of lender requirements, including satisfactory appraisal, title insurance and review of the Property.",
          ]
        : ["8.1 No financing contingency. This is not conditioned upon Buyer obtaining mortgage financing."],
    },
    {
      n: "9",
      title: "TITLE AND PERMITTED EXCEPTIONS",
      body: [
        "9.1 Title Report. Within 15 days after the Effective Date, Buyer (or Buyer's attorney) shall order a title search and/or title insurance commitment for the Property.",
        "9.2 Marketable Title. Seller shall convey good and marketable fee simple title to Buyer at Closing, free and clear of all liens, encumbrances and adverse claims, except real estate taxes not yet due and payable, standard utility easements and other matters accepted in writing by Buyer (“Permitted Exceptions”).",
        "9.3 Title Defects. If the title search reveals defects that render title unmarketable, Seller shall have 30 days to cure such defects. If Seller cannot cure within that period, Buyer may terminate this Agreement and receive a refund of the Deposit, or waive such defects and accept title “as is”.",
      ],
    },
    {
      n: "10",
      title: "FOREIGN BUYER AND TAX COMPLIANCE",
      body: [
        `10.1 Buyer Representations. Buyer represents that Buyer is a ${
          facts.buyerIsForeign ? "foreign national or foreign entity" : "U.S. person or U.S. entity"
        } and agrees to provide any information reasonably required by the title company or governmental authorities to comply with U.S. and ${state} law, including any tax reporting or identification requirements.`,
        "10.2 Tax Withholding and Forms. The Parties shall cooperate to execute any tax forms and certifications required at Closing, including Internal Revenue Service and state forms related to withholding or reporting, to the extent applicable.",
      ],
    },
    {
      n: "11",
      title: "BROKERAGE COMMISSION AND BUYER'S BROKER",
      body: [
        `11.1 Brokers. Listing Broker: ${facts.listingBrokerName}. Buyer's Broker: ${facts.buyerBrokerName}${
          facts.buyerBrokerLicence ? `, licence ${facts.buyerBrokerLicence}` : ""
        }${facts.buyerBrokerFirm ? `, ${facts.buyerBrokerFirm}` : ""}.`,
        `11.2 Seller Payment of Buyer's Commission. At Closing, Seller shall pay to Buyer's Broker a commission equal to ${c.commissionPct}% of the Purchase Price from Seller's proceeds, in consideration of Buyer's Broker's services in procuring the Buyer and assisting with the transaction.`,
        "11.3 Modifiable Commission Structure. The Parties acknowledge that commission percentages and payor arrangements are negotiable and may vary by agreement and market practice. Any different structure shall be stated in a separate written brokerage agreement and/or an amendment to this Section 11.",
        "11.4 No Other Broker Claims. Each Party represents that no other broker, agent or finder has a claim to a commission in connection with this transaction other than those identified in Section 11.1.",
      ],
    },
    {
      n: "12",
      title: "DEFAULT AND REMEDIES",
      body: [
        "12.1 Buyer Default. If Buyer fails to perform Buyer's obligations and such failure is not cured within 10 days after written notice from Seller, Seller may retain the Deposit as liquidated damages, which shall be Seller's sole and exclusive remedy except for rights that expressly survive. The Parties acknowledge that actual damages would be difficult to ascertain and that the Deposit is a reasonable estimate of Seller's damages.",
        `12.2 Seller Default. If Seller fails to perform Seller's obligations and such failure is not cured within 10 days after written notice from Buyer, Buyer may elect either (i) termination of this Agreement and return of the Deposit, or (ii) specific performance to the extent available under ${state} law.`,
      ],
    },
    {
      n: "13",
      title: "MISCELLANEOUS",
      body: [
        "13.1 Effective Date. The “Effective Date” of this Agreement is the date on which the last Party signs and delivers the fully executed Agreement.",
        `13.2 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of ${state}, without regard to its conflicts-of-law principles.`,
        "13.3 Entire Agreement. This Agreement, together with its exhibits and any written amendments, constitutes the entire agreement between the Parties regarding the Property and supersedes all prior negotiations and understandings.",
        "13.4 Amendments. Any amendment or modification to this Agreement must be in writing and signed by both Parties.",
        `13.5 Assignability. Buyer ${
          c.assignable ? "may" : "may not"
        } assign Buyer's rights under this Agreement to another party. Any permitted assignment shall not relieve Buyer of Buyer's obligations unless Seller expressly agrees in writing.`,
        "13.6 Notices. All notices shall be in writing and delivered personally, by recognised overnight courier, or by email with confirmation, to the Parties at the addresses stated above.",
        "13.7 Counterparts and Electronic Signatures. This Agreement may be executed in counterparts, each of which shall be deemed an original, and electronic signatures shall be deemed valid to the fullest extent permitted by law.",
        "13.8 Further Assurances. Each Party agrees to execute and deliver such additional documents and take such further actions as may reasonably be necessary to carry out the intent of this Agreement.",
      ],
    },
  ];

  const execution = [
    "IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.",
    `SELLER: ____________________________   Date: ____________   ${facts.sellerLegalName}`,
    signedAt
      ? `BUYER: /s/ ${facts.buyerLegalName}   Date: ${formatDate(signedAt)}   (signed electronically via Loqal)`
      : `BUYER: ____________________________   Date: ____________   ${facts.buyerLegalName}`,
  ];

  return {
    heading: `PURCHASE AND SALE AGREEMENT (${state.toUpperCase()} RESIDENTIAL PROPERTY)`,
    preamble,
    sections,
    execution,
  };
}

/** Short summary of the buyer's choices, shown above the draft. */
export function choiceSummary(facts: AgreementFacts, c: AgreementChoices): string[] {
  const deposit = (facts.purchasePrice * c.depositPct) / 100;
  return [
    `Purchase price ${money(facts.purchasePrice)}`,
    `Deposit ${money(deposit)} (${c.depositPct}%) within ${c.depositDays} business days`,
    `Closing on or about ${formatDate(c.closingDate)}`,
    c.paymentMode === "cash"
      ? "All-cash purchase"
      : c.paymentMode === "financed"
        ? "Financed with a mortgage"
        : "Part seller financing",
    c.inspection ? `Inspection contingency — ${c.inspectionDays} days` : "No inspection contingency",
    c.appraisal ? "Appraisal contingency included" : "No appraisal contingency",
    c.financing ? `Financing contingency — ${c.financingDays} days` : "No financing contingency",
    `Buyer's broker commission ${c.commissionPct}%, paid by the seller`,
  ];
}

/** Word-compatible HTML of the full agreement, for download. */
export function agreementWordHtml(
  facts: AgreementFacts,
  c: AgreementChoices,
  signedAt?: string,
): string {
  const doc = buildAgreement(facts, c, signedAt);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = [
    `<h1>${esc(doc.heading)}</h1>`,
    ...doc.preamble.map((p) => `<p>${esc(p)}</p>`),
    ...doc.sections.flatMap((s) => [
      `<h2>${esc(`${s.n}. ${s.title}`)}</h2>`,
      ...s.body.map((p) => `<p>${esc(p)}</p>`),
    ]),
    `<h2>EXECUTION</h2>`,
    ...doc.execution.map((p) => `<p>${esc(p)}</p>`),
  ].join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(
    doc.heading,
  )}</title><style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.5;}
  h1{font-size:15pt;text-align:center;}
  h2{font-size:12pt;margin-top:18pt;}
  p{margin:6pt 0;}
  </style></head><body>${body}</body></html>`;
}

/** Trigger a .doc download of the agreement in the browser. */
export function downloadAgreementWord(
  facts: AgreementFacts,
  c: AgreementChoices,
  signedAt?: string,
) {
  const html = agreementWordHtml(facts, c, signedAt);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Purchase-agreement-${facts.propertyStreet.replace(/[^\w]+/g, "-")}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
