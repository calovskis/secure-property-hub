import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  CORPORATE_STRUCTURE_GUIDE,
  SETUP_COST_LINES,
  LOQAL_SETUP_FEE_USD,
  RELATED_SERVICES_MAX_USD,
} from "@/lib/entity-structure";

export const Route = createFileRoute("/entity-structure-faq")({
  component: EntityFaqPage,
  head: () => ({
    meta: [
      { title: "Holding US property in an LLC or trust — Loqal FAQ" },
      {
        name: "description",
        content:
          "Why international buyers hold US property through an LLC or a trust, what Loqal does to structure it properly, and the transparent one-time set-up costs.",
      },
      { property: "og:title", content: "Holding US property in an LLC or trust — Loqal FAQ" },
      {
        property: "og:description",
        content:
          "Liability, estate tax, privacy, banking and financing — how a holding structure protects an international buyer, and what Loqal charges to set it up.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const WHAT_WE_DO: string[] = [
  "We review the property location, your tax residency and your plans for the property, and recommend the structure that fits — most often a state LLC, sometimes an LLC held by a trust.",
  "We form the company, obtain the federal tax number (EIN) and appoint the registered agent that US law requires as the company's address of record.",
  "We coordinate the US bank account so the deposit, the closing wire, rent and running costs move through the company, not through your personal accounts.",
  "We make sure the purchase agreement, the deed and the closing documents are all issued in the name of the entity that will hold the property.",
  "We hand you a single file with the formation documents, the EIN letter and the annual obligations, and stay your point of contact for the yearly filings.",
];

const TERMS: string[] = [
  `A one-time Loqal Managerial Set-up fee of $${LOQAL_SETUP_FEE_USD}. This covers the design of the structure, the coordination of every provider and the paperwork on your behalf.`,
  `All related third-party services — company formation and state filing fees, registered agent, EIN and the US bank account opening — are charged at cost and capped at $${RELATED_SERVICES_MAX_USD} in total. If anything unusual would exceed that, we ask you first.`,
  "The exact structure is proposed to you in writing before anything is filed, and nothing is charged until you approve it.",
  "A named Loqal entity manager is assigned to you and reaches out within three business days of your request.",
  "Loqal is not a law firm or a tax adviser. We coordinate licensed US providers, and you are free to use your own attorney or accountant at any point.",
  "You can stop the process at any time before filing; only third-party fees already paid to authorities or providers are non-refundable.",
];

function EntityFaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Home" />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-7">
        <Link to="/" className="text-sm font-medium text-brand">
          ← Back to your dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground md:text-[32px]">
          Holding US property in an LLC or a trust
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          In the United States it is standard practice — for local and international owners alike —
          to hold property assets in a company or a trust rather than in a personal name. Loqal
          recommends it to every client, and we set the structure up for you so it is done properly
          from the first day and protects your interests, not just the paperwork.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-foreground">Why owners do it</h2>
        <div className="mt-3 space-y-4">
          {CORPORATE_STRUCTURE_GUIDE.map((s) => (
            <section key={s.title} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-semibold text-foreground">What Loqal does for you</h2>
        <ul className="mt-3 space-y-2 rounded-lg border border-border bg-card p-5">
          {WHAT_WE_DO.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-foreground">What it costs</h2>
        <div className="mt-3 space-y-3 rounded-lg border border-gold/40 bg-gold-tint/40 p-5">
          {SETUP_COST_LINES.map((l) => (
            <div key={l.label}>
              <div className="text-sm font-semibold text-foreground">{l.label}</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{l.note}</p>
            </div>
          ))}
          <p className="border-t border-gold/40 pt-3 text-sm text-foreground">
            One-time Loqal Managerial Set-up of ${LOQAL_SETUP_FEE_USD}, plus all related services at
            cost, capped at ${RELATED_SERVICES_MAX_USD} in total. We choose the best set-up based on
            the property location and your profile.
          </p>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Loqal terms</h2>
        <ol className="mt-3 space-y-2 rounded-lg border border-border bg-card p-5">
          {TERMS.map((t, i) => (
            <li key={t} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-brand">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-xl border border-brand/40 bg-brand-tint/60 p-6">
          <h2 className="text-base font-semibold text-foreground">
            Would you like Loqal to manage the structure for you?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We will confirm the terms with you, assign a Loqal entity manager and take the paperwork
            off your hands.
          </p>
          <Link
            to="/"
            search={{ open: "entity-support" } as never}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Request Loqal to help manage the structure
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </main>
    </div>
  );
}
