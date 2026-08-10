import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MortgageQuestionnaire } from "@/components/mortgage/MortgageQuestionnaire";
import { useAuth } from "@/lib/auth";
import { buildInvestmentModel, formatPrice, getProperty } from "@/data/properties";


export const Route = createFileRoute("/property/$propertyId")({
  component: PropertyDetailPage,
  loader: ({ params }) => {
    const property = getProperty(Number(params.propertyId));
    if (!property) throw notFound();
    return { property };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Property unavailable — LOQAL" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { property } = loaderData;
    const title = `${property.address}, ${property.location} — LOQAL`;
    const description = `${property.type} listing at ${property.address}, ${property.location}. ${formatPrice(
      property.price,
    )} — investment analysis, cash-flow scenarios and acquisition summary on LOQAL.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
});

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className}`}>
      <div className="p-6">
        {title && (
          <div className="mb-4">
            <div className="text-base font-semibold text-foreground">{title}</div>
            {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between py-2.5 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <strong className="font-semibold text-foreground">{value}</strong>
        </div>
      ))}
    </div>
  );
}

const SCENARIO_KEYS = ["airbnb", "longterm", "hybrid"] as const;

function Gated({
  locked,
  onProvide,
  children,
}: {
  locked: boolean;
  onProvide: () => void;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-[6px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/55 p-6 text-center">
        <p className="max-w-xs text-xs font-medium text-muted-foreground">
          To view — to get access to information we need additional information from you.
        </p>
        <button
          type="button"
          onClick={onProvide}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
        >
          Provide information
        </button>
      </div>
    </div>
  );
}

function PropertyDetailPage() {
  const { property } = Route.useLoaderData();
  const model = buildInvestmentModel(property);
  const [scenarioKey, setScenarioKey] = useState<(typeof SCENARIO_KEYS)[number]>("airbnb");
  const scenario = model.scenarios[scenarioKey];
  const { user, canSeeEstimates } = useAuth();
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const locked = !canSeeEstimates;
  const openQuestionnaire = () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setQuestionnaireOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Properties" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <Link
          to="/marketplace"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          ← Back to Properties
        </Link>

        {/* HEADER */}
        <section className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-[32px]">
              {property.address}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{property.location}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                ● {property.featured ? "Featured" : "Active"}
              </span>
              <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">
                Foreign Buyer Friendly
              </span>
              <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
                Income Potential
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-tint">
              Edit Property
            </button>
            <button
              type="button"
              onClick={openQuestionnaire}
              className="rounded-md border border-gold/30 bg-gold-tint px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold/20"
            >
              Request Mortgage Info
            </button>
            <button className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft">
              Open Deal
            </button>
          </div>
        </section>

        {/* TOP METRICS */}
        <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Price
            </div>
            <div className="mt-2 text-4xl font-bold text-brand">{formatPrice(property.price)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Target acquisition price from listing feed
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </div>
            <div className="mt-2 text-3xl font-bold text-foreground">{property.type}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              {property.beds > 0
                ? `${property.beds} bed / ${property.baths} bath · investor-ready layout`
                : "Investor-ready commercial layout"}
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Size
            </div>
            <div className="mt-2 text-3xl font-bold text-foreground">
              {property.sqft.toLocaleString()} {property.type === "Land" ? "acres" : "sqft"}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Efficient plan with balcony and parking
            </div>
          </Card>
        </section>

        {/* PHOTOS */}
        <Card
          title="🖼️ Photos"
          subtitle="Investor-relevant visual overview of the asset and surroundings"
          className="mb-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative flex h-[280px] items-center justify-center rounded-lg bg-gradient-to-br from-brand-tint to-gold-tint text-7xl md:col-span-2">
              <span aria-hidden="true">{property.icon}</span>
              <span className="absolute bottom-3 left-3 rounded bg-card/80 px-2 py-1 text-[11px] font-semibold text-foreground">
                Living area · Best lifestyle shot
              </span>
            </div>
            <div className="grid grid-rows-2 gap-4">
              {["Kitchen + finishes", "Building / neighborhood context"].map((label) => (
                <div
                  key={label}
                  className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-gold-tint to-brand-tint text-4xl"
                >
                  <span aria-hidden="true">{property.icon}</span>
                  <span className="absolute bottom-3 left-3 rounded bg-card/80 px-2 py-1 text-[11px] font-semibold text-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* DESCRIPTION + QUICK INFO */}
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card
            title="📝 Description"
            subtitle="Narrative focused on owner and income potential"
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bright, fully updateable {property.type.toLowerCase()} asset positioned for both
              lifestyle ownership and income generation. The layout supports long-term tenancy,
              while the location in {property.location} near business districts improves
              furnished-rental and short-term demand potential. For LOQAL users, the key value is
              not only acquisition but also the ability to route financing, setup, tenanting,
              servicing, and financial oversight through one operating layer.
            </p>
          </Card>
          <Card title="ℹ️ Quick Info" subtitle="Acquisition-ready snapshot">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Bedrooms", property.beds > 0 ? String(property.beds) : "—"],
                ["Bathrooms", property.baths > 0 ? property.baths.toFixed(1) : "—"],
                ["Year Built", "2018"],
                ["Parking", "1 secured"],
                ["Country", "US"],
                ["Property ID", `#LQ-${20800 + property.id}`],
                ["Status", property.featured ? "Featured" : "Active"],
                ["Added", "07/09/2026"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-brand-tint/60 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* VALUE / PAYMENT / HISTORY */}
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="📈 Home Value Estimate" subtitle="Illustrative value and appreciation outlook">
            <div className="text-3xl font-bold text-brand">{formatPrice(model.estimate)}</div>
            <div className="mt-2 text-xs font-semibold text-success">
              ↑ ~4.9% projected annual growth
            </div>
          </Card>

          <Card
            title="💳 Mortgage Estimate"
            subtitle="Based on 20% down · 6.5% rate · 30yr fixed"
            className="ring-2 ring-brand/10"
          >
            <Gated locked={locked} onProvide={openQuestionnaire}>
              <div className="mb-3 text-3xl font-bold text-brand">{money(model.mortgage)}/mo</div>
              <Rows
                rows={[
                  ["Down payment", money(model.downPayment)],
                  ["Loan amount", money(model.loanAmount)],
                  ["Estimated closing costs", money(model.closingCosts)],
                ]}
              />
            </Gated>
            <button
              type="button"
              onClick={openQuestionnaire}
              className="mt-4 w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Request Mortgage
            </button>
          </Card>
          <Card title="🗂️ Property History" subtitle="Platform and record timeline">
            <Rows
              rows={[
                ["Listed on LOQAL", "July 9, 2026"],
                ["Last updated", "July 12, 2026"],
                ["Market history", "MLS + public data sync pending"],
              ]}
            />
          </Card>
        </section>

        {/* INVESTMENT SNAPSHOT */}
        <Card
          title="📊 Investment Decision Snapshot"
          subtitle="Compare passive-income strategies for the same asset"
          className="mb-6"
        >
          <Gated locked={locked} onProvide={openQuestionnaire}>
          <div className="mb-5 flex flex-wrap gap-2 border-b border-border pb-3">
            {SCENARIO_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setScenarioKey(key)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  scenarioKey === key
                    ? "bg-brand text-background"
                    : "bg-brand-tint text-brand hover:bg-brand/15"
                }`}
              >
                {model.scenarios[key].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg bg-brand-tint/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estimated monthly net cash flow
              </div>
              <div
                className={`mt-2 text-3xl font-bold ${
                  scenario.cashFlow >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {money(scenario.cashFlow)}/mo
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{scenario.blurb}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {scenario.mini.map((m) => (
                  <div key={m.label} className="rounded-md bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-gold-tint/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Return profile
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["Annual gross revenue", money(scenario.annualGross)],
                  ["Cap rate", `${(scenario.capRate * 100).toFixed(1)}%`],
                  ["Cash-on-cash return", `${(scenario.coc * 100).toFixed(1)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Rows rows={scenario.left.map(([l, v]) => [l, `${money(v)}/mo`])} />
            <Rows
              rows={[
                ...scenario.right.map(([l, v]) => [l, `${money(v)}/mo`] as [string, string]),
                scenario.footNote,
              ]}
            />
          </div>
          </Gated>
        </Card>

        {/* ACQUISITION + RISK */}
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            title="🧾 Acquisition Summary"
            subtitle="Useful for remote and foreign buyers evaluating readiness"
          >
            <Rows
              rows={[
                ["Purchase price", money(model.price)],
                ["Down payment", money(model.downPayment)],
                ["Estimated closing costs", money(model.closingCosts)],
                ["Suggested furnishing budget", money(model.furnishing)],
                ["Total cash needed (short-term ready)", money(model.cashInvestedStr)],
                ["Total cash needed (long-term ready)", money(model.cashInvestedLt)],
              ]}
            />
          </Card>
          <Card
            title="⚠️ Risk & Remote Ownership Flags"
            subtitle="Especially important for foreign investors"
          >
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                "Short-term rentals allowed subject to city registration and association confirmation.",
                "HOA review recommended before underwriting short-term rental assumptions.",
                "Foreign buyer should confirm lender eligibility, entity structure, and tax withholding.",
                "Remote ownership requires a management, maintenance, and payments layer.",
              ].map((text) => (
                <li key={text} className="flex gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* NEXT STEP */}
        <Card
          title="📌 Recommended next step"
          subtitle="Action-oriented decision block after the analysis"
          className="mb-6"
        >
          <Rows
            rows={[
              ["Best cash-flow strategy", "Short-Term Rental"],
              ["Lowest-effort strategy", "Long-Term Rental"],
              ["Balanced strategy", "Hybrid / Medium-Term"],
              ["Recommended follow-up", "Confirm HOA + local STR rules"],
              ["LOQAL service trigger", "Mortgage + Setup + Management"],
            ]}
          />
        </Card>

        {/* ACTIONS */}
        <Card
          title="⚙️ Actions"
          subtitle="Connected to LOQAL's service workflows"
          className="mb-10"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["View Requests", "See property-specific service or support requests."],
              [
                "Request Service",
                "Launch setup, furnishing, cleaning, legal, or maintenance support.",
              ],
              ["View Documents", "Review due diligence files, disclosures, and ownership docs."],
              [
                "Deals + New Deal",
                "Open acquisition, mortgage, or management workflows for this listing.",
              ],
            ].map(([title, text]) => (
              <button
                key={title}
                className="rounded-lg border border-border bg-brand-tint/40 p-4 text-left transition-colors hover:border-brand-soft hover:bg-brand-tint"
              >
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{text}</div>
              </button>
            ))}
          </div>
        </Card>
      </main>
      <MortgageQuestionnaire
        open={questionnaireOpen}
        onOpenChange={setQuestionnaireOpen}
        propertyLabel={`${property.address}, ${property.location}`}
      />
    </div>
  );
}
