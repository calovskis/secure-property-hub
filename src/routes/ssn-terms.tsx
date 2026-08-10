import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/ssn-terms")({
  component: SsnTermsPage,
  head: () => ({
    meta: [
      { title: "SSN Processing Terms — Loqal" },
      {
        name: "description",
        content:
          "How Loqal collects, encrypts, shares and retains Social Security Numbers provided for mortgage pre-qualification.",
      },
      { property: "og:title", content: "SSN Processing Terms — Loqal" },
      {
        property: "og:description",
        content:
          "Read how Loqal handles Social Security Numbers submitted during mortgage pre-qualification.",
      },
    ],
  }),
});

const SECTIONS: [string, string][] = [
  [
    "Why we ask",
    "Your Social Security Number is requested only to allow Loqal's licensed mortgage lending partners to obtain a credit report and assess your eligibility for financing. It is never used for marketing.",
  ],
  [
    "Consent",
    "By entering your SSN and submitting the mortgage questionnaire you provide written consent for Loqal and its lending partners to process the number for the purpose described above.",
  ],
  [
    "Who receives it",
    "The number is shared only with the lending partner assigned to your request and with credit bureaus required to complete the assessment. It is never sold or shared with realtors, service providers or other clients.",
  ],
  [
    "Storage and security",
    "SSNs are stored encrypted at rest, masked in every interface, and accessible only to Loqal staff whose role requires it. Access is logged.",
  ],
  [
    "Retention",
    "The number is retained for the duration of the financing process and for the period required by applicable lending regulation, after which it is permanently deleted.",
  ],
  [
    "Your rights",
    "You may withdraw consent, request a copy of the data we hold, or request deletion at any time by contacting privacy@loqal.com. Withdrawal may prevent us from completing a mortgage request.",
  ],
];

function SsnTermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <main className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-medium text-brand hover:underline">
          ← Back to Loqal
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-foreground">SSN Processing Terms</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: August 10, 2026 · Applies to Social Security Numbers submitted through the
          Loqal mortgage questionnaire.
        </p>
        <div className="mt-8 space-y-6">
          {SECTIONS.map(([title, body]) => (
            <section key={title} className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
