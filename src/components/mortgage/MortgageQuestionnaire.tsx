import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, fullName, type MortgageProfile } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { useMortgageDrafts } from "@/lib/mortgage-draft";
import {
  QUESTIONNAIRE_STEPS,
  totalMonthlyIncome,
  usStatusOf,
  type MaritalStatus,
  type UsStatus,
} from "@/lib/mortgage-form";
import {
  emptyQuestionnaire,
  isNonUsWithoutTaxId,
  type QuestionnaireData,
} from "@/components/mortgage/questionnaire-state";
import { hasTwoYearCoverage } from "@/components/mortgage/history-coverage";
import { Step1Personal } from "@/components/mortgage/steps/Step1Personal";
import { Step2Income } from "@/components/mortgage/steps/Step2Income";
import { Step3Liabilities } from "@/components/mortgage/steps/Step3Liabilities";
import { Step4Declarations } from "@/components/mortgage/steps/Step4Declarations";
import { Step5Demographics } from "@/components/mortgage/steps/Step5Demographics";

/** Rough completion signal used for draft reminders. */
function completionOf(data: QuestionnaireData, usPerson: boolean): number {
  const checks = [
    Boolean(data.dob),
    Boolean(data.maritalStatus),
    Boolean(data.addresses[0]?.street && data.addresses[0]?.city && data.addresses[0]?.state),
    Boolean(data.incomes[0]?.employer),
    totalMonthlyIncome(data.incomes) > 0,
    usPerson ? true : Boolean(data.countryOfResidence && data.citizenship),
    Boolean(data.demographics.sex),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function MortgageQuestionnaire({
  open,
  onOpenChange,
  propertyLabel,
  property,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyLabel?: string;
  property?: { id: number; price: number };
}) {
  const { user, saveMortgageProfile } = useAuth();
  const { createLead } = useLeads();
  const { getDraft, saveDraft, clearDraft } = useMortgageDrafts();

  const propertyId = property?.id ?? 0;
  const usPerson = Boolean(user?.usPerson);

  const initial = useMemo<{ data: QuestionnaireData; step: number }>(() => {
    const draft = user ? getDraft(user.email, propertyId) : undefined;
    if (draft && !draft.submitted) {
      return {
        data: { ...emptyQuestionnaire(), ...(draft.data as Partial<QuestionnaireData>) },
        step: draft.step,
      };
    }
    return { data: emptyQuestionnaire(), step: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, propertyId, open]);

  const [data, setData] = useState<QuestionnaireData>(initial.data);
  const [step, setStep] = useState(initial.step);
  const [furthest, setFurthest] = useState(initial.step);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const patch = (p: Partial<QuestionnaireData>) => {
    setData((prev) => ({ ...prev, ...p }));
    setError(null);
  };

  const persistDraft = (nextStep: number, nextData: QuestionnaireData) => {
    if (!user) return;
    saveDraft(user.email, {
      propertyId,
      ...(propertyLabel ? { propertyLabel } : {}),
      step: nextStep,
      furthestStep: Math.max(furthest, nextStep),
      data: nextData as unknown as Record<string, unknown>,
      completion: completionOf(nextData, usPerson),
    });
    setSavedNote(true);
    window.setTimeout(() => setSavedNote(false), 2000);
  };

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!data.dob) return "Date of birth is required.";
      if (!data.maritalStatus) return "Please select your marital status.";
      if (data.maritalStatus === "unmarried" && data.unmarried.hasSpousalEquivalent) {
        if (!data.unmarried.relationship) return "Please select the type of relationship.";
        if (!data.unmarried.stateFormed)
          return "Please select the state the relationship was formed in.";
      }
      if (!usPerson) {
        if (data.hasItin && !data.itin.trim()) return "Please provide your ITIN number.";
        if (!data.countryOfResidence) return "Country of residence is required.";
        if (!data.citizenship) return "Citizenship is required.";
        if (data.visaActive && (!data.visaIssued || !data.visaValidUntil))
          return "Please provide the visa issue and expiry dates.";
        if (!data.propertyUse) return "Please tell us how you will use the property.";
      }
      const a = data.addresses[0];
      if (!a?.street || !a.city || !a.state)
        return "At least one full address (street, city, state) is required.";
      if (!usPerson && data.visaActive && !data.visaType)
        return "Please select which visa or status you hold.";
      if (
        !hasTwoYearCoverage(
          data.addresses.map((x) => ({ from: x.from, to: x.to, current: x.present })),
        )
      )
        return "Less than 2 years of address history provided — please add earlier addresses covering at least the last 2 years.";
      return null;
    }
    if (s === 2) {
      if (usPerson && data.ssn && !data.ssnAccepted)
        return "Please confirm you have read the SSN processing terms.";
      if (!data.incomes[0]?.employer)
        return "At least one employer or business in your 2-year history is required.";
      if (totalMonthlyIncome(data.incomes) <= 0)
        return "Please provide the income details for at least one source.";
      if (
        !hasTwoYearCoverage(
          data.incomes.map((x) => ({ from: x.from, to: x.to, current: x.current })),
        )
      )
        return "Less than 2 years of employment history provided — please add earlier employment covering at least the last 2 years.";
      return null;
    }
    return null;
  }

  const skipLiabilities = isNonUsWithoutTaxId(data, usPerson);
  const steps = QUESTIONNAIRE_STEPS.filter((s) => !(skipLiabilities && s.id === 3));
  const lastStepId = steps[steps.length - 1]?.id ?? 5;

  /** Next/previous visible step id. */
  const shift = (from: number, dir: 1 | -1) => {
    const ids = steps.map((s) => s.id);
    const i = ids.indexOf(from);
    return ids[Math.min(ids.length - 1, Math.max(0, i + dir))] ?? from;
  };

  function goTo(next: number) {
    if (next > step) {
      const problem = validateStep(step);
      if (problem) return setError(problem);
    }
    setError(null);
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    persistDraft(next, data);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const s of steps.map((x) => x.id)) {
      const problem = validateStep(s);
      if (problem) {
        setStep(s);
        return setError(problem);
      }
    }

    const monthly = totalMonthlyIncome(data.incomes);
    /* Answers we derive instead of asking the client twice. */
    const derivedDeclarations = {
      ...data.declarations,
      primaryResidence: usPerson
        ? data.declarations.primaryResidence
        : data.propertyUse === "vacation",
      familyOrBusinessWithSeller: data.incomes.some(
        (s) => s.relatedParty === "property_seller" || s.relatedParty === "real_estate_agent",
      ),
    };
    const profile: MortgageProfile = {
      dateOfBirth: data.dob,
      ...(usPerson && data.ssn ? { ssn: data.ssn } : {}),
      ssnTermsAccepted: data.ssnAccepted,
      ...(usPerson
        ? {}
        : {
            hasItin: data.hasItin,
            ...(data.hasItin ? { itin: data.itin.trim() } : {}),
            countryOfResidence: data.countryOfResidence,
            citizenship: data.citizenship,
            ...(data.secondCitizenship ? { secondCitizenship: data.secondCitizenship } : {}),
            usVisaActive: data.visaActive,
            ...(data.visaActive
              ? {
                  visaIssued: data.visaIssued,
                  visaValidUntil: data.visaValidUntil,
                  visaType: data.visaType as UsStatus,
                }
              : {}),
            propertyUse: data.propertyUse as "vacation" | "investment",
            usBankAccount: data.usBankAccount,
          }),
      maritalStatus: data.maritalStatus as MaritalStatus,
      unmarriedAddendum: data.unmarried,
      dependents: data.dependents,
      addresses: data.addresses,
      employment: data.incomes.map((s) => ({
        id: s.id,
        employer: s.employer,
        title: s.title,
        from: s.from,
        to: s.to,
        current: s.current,
      })),
      incomes: data.incomes,
      liabilities: data.liabilities,
      declarations: derivedDeclarations,
      military: data.military,
      demographics: data.demographics,
      monthlyGross: monthly,
      usStatus: usStatusOf(
        {
          ...(data.visaType ? { visaType: data.visaType as UsStatus } : {}),
          usVisaActive: data.visaActive,
        },
        usPerson,
      ),
      submittedAt: new Date().toISOString(),
    };

    setError(null);
    saveMortgageProfile(profile);
    if (user && property) {
      createLead({
        clientEmail: user.email,
        clientName: fullName(user),
        usPerson: user.usPerson,
        propertyId: property.id,
        propertyLabel: propertyLabel ?? `Property #${property.id}`,
        propertyPrice: property.price,
        profile,
      });
    }
    if (user) clearDraft(user.email, propertyId);
    setDone(true);
  }

  const stepProps = { data, patch, usPerson };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Mortgage pre-qualification</DialogTitle>
          <DialogDescription>
            {propertyLabel
              ? `A few details so a Loqal lending partner can price ${propertyLabel}.`
              : "A few details so a Loqal lending partner can price your financing."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-6 text-center">
              <div className="text-3xl">✅</div>
              <div className="mt-2 text-base font-semibold text-foreground">
                Information received
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Your pre-approval application has been sent to a Loqal mortgage lending partner. You
                will be notified here as soon as they respond.
              </p>
            </div>

            {data.visaActive ? (
              <div className="rounded-lg border border-brand/40 bg-brand-tint/50 p-5 text-left">
                <div className="text-sm font-semibold text-foreground">
                  One more step: visa document verification
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Because you hold a US visa or status, please upload a copy or scan of your valid
                  visa document so the lending partner can verify it.
                </p>
                {visaDoc ? (
                  <p className="mt-3 text-sm text-success">Uploaded: {visaDoc}</p>
                ) : (
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint">
                    Upload a copy/scan of your valid visa
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setVisaDoc(file.name);
                        saveMortgageProfile({
                          visaDocumentName: file.name,
                          visaDocumentUploadedAt: new Date().toISOString(),
                        } as Partial<MortgageProfile> as MortgageProfile);
                      }}
                    />
                  </label>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Back to the property
            </button>
          </div>

        ) : (
          <form onSubmit={submit} className="space-y-6">
            {/* STEPPER */}
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {steps.map((s) => {
                const reachable = s.id <= furthest;
                const active = s.id === step;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => goTo(s.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
                        active
                          ? "border-brand bg-brand-tint text-brand"
                          : reachable
                            ? "border-border text-muted-foreground hover:bg-brand-tint/50"
                            : "border-border/60 text-muted-foreground/50"
                      }`}
                    >
                      <span className="block">Step {s.id}</span>
                      <span className="block font-medium">{s.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {step === 1 ? <Step1Personal {...stepProps} /> : null}
            {step === 2 ? <Step2Income {...stepProps} /> : null}
            {step === 3 && !skipLiabilities ? <Step3Liabilities {...stepProps} /> : null}
            {step === 4 ? <Step4Declarations {...stepProps} /> : null}
            {step === 5 ? <Step5Demographics {...stepProps} /> : null}

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="text-[11px] text-muted-foreground">
                {savedNote ? "Draft saved ✓" : "Answers are saved automatically as a draft."}
              </div>
              <div className="flex gap-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => goTo(shift(step, -1))}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => persistDraft(step, data)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                >
                  Save & finish later
                </button>
                {step < lastStepId ? (
                  <button
                    type="button"
                    onClick={() => goTo(shift(step, 1))}
                    className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
                  >
                    Save & continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
                  >
                    Submit application
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
