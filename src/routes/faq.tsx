import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: "FAQ — How buyer's agents work in the USA — Loqal" },
      {
        name: "description",
        content:
          "What a buyer's agent does, how the 3% fee works, how they differ from the listing agent, and what to expect from offer to closing.",
      },
      { property: "og:title", content: "FAQ — How buyer's agents work in the USA — Loqal" },
      {
        property: "og:description",
        content:
          "Buyer's agents explained: representation, fees, negotiations, inspections and closing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What is a buyer's agent?",
    body: [
      "A buyer's agent is a licensed real estate professional who represents you — the buyer — in a purchase. They owe you fiduciary duties: loyalty, confidentiality, full disclosure, obedience to your lawful instructions, reasonable care and accounting for funds.",
      "The listing agent, by contrast, works for the seller and is paid to get the seller the highest price on the best terms. Anything you tell a listing agent can be used in the seller's interest — one of the main reasons buyers engage their own agent.",
    ],
  },
  {
    title: "How is the buyer's agent paid?",
    body: [
      "Buyer agent compensation is always negotiable and is agreed in a written buyer agreement before you tour homes. On Loqal, partner buyer's agents charge 3% of the purchase price, due at closing.",
      "Depending on the deal, the fee can be covered in different ways: paid by you directly, negotiated as a seller concession in the purchase contract, or offered by the seller as part of the deal. Your agent walks you through the options for each property before you sign anything.",
    ],
  },
  {
    title: "What does a buyer's agent actually do for me?",
    body: [
      "Search & shortlist: finds properties that match your criteria — including off-market and coming-soon inventory — and screens out poor fits.",
      "Price analysis: prepares a comparative market analysis so you know what a property is actually worth before offering.",
      "Negotiation: works to bring the price down as much as possible and negotiates terms (closing date, contingencies, included items, repairs or credits).",
      "Inspections: advises which inspections are necessary (general, roof, termite, sewer, etc.), orders them with licensed inspectors and negotiates repairs or price reductions based on the findings.",
      "Property change: if an inspection, appraisal or your own change of heart calls for it, the agent proposes alternative properties and re-runs the numbers with you.",
      "Contract to closing: coordinates the purchase contract, earnest money, title work, appraisal, final walkthrough and closing with the lender, title company and attorneys.",
    ],
  },
  {
    title: "How does this connect to my Loqal mortgage pre-approval?",
    body: [
      "Your lender's pre-approval terms are preliminary estimates until a formal mortgage proposal is issued after the prepurchase contract is signed.",
      "After you accept the terms and until the prepurchase agreement is signed, you can request a property change at any point within 3 months under the same pre-approval, within the same purchase price. Once you decide on a property, the lender re-checks your qualification and the potential mortgage terms for that specific property.",
    ],
  },
  {
    title: "What is dual agency and should I avoid it?",
    body: [
      "Dual agency means one agent (or brokerage) represents both buyer and seller in the same transaction. It limits the advocacy either side can receive and is restricted or prohibited in several states.",
      "With Loqal your buyer's agent represents only you, so their incentive stays aligned with getting you the lowest price and the safest terms.",
    ],
  },
  {
    title: "Do I have to work with the agent after I confirm?",
    body: [
      "Confirming the buyer's agent agreement starts the representation for your purchase on Loqal. If the fit is not right, contact Loqal support — we can re-assign a different licensed partner agent for your state.",
    ],
  },
];

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Home" />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-7">
        <Link to="/" className="text-sm font-medium text-brand">
          ← Back to Loqal
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground md:text-[32px]">
          How buyer's agents work in the USA
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The essentials before you confirm your buyer's agent agreement on Loqal.
        </p>

        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
              <div className="mt-3 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
