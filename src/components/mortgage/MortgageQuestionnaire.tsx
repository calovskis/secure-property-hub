import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, fullName, type MortgageProfile } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { useLeads } from "@/lib/leads";
import { useMortgageDrafts } from "@/lib/mortgage-draft";
import {
  QUESTIONNAIRE_STEPS,
  documentExpiryState,
  normalizeAssets,
  totalMonthlyIncome,
  usStatusOf,
  type MaritalStatus,
  type UsStatus,
} from "@/lib/mortgage-form";
import { DocumentUploadBox } from "@/components/mortgage/DocumentUploadBox";
import {
  emptyQuestionnaire,
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

/**
 * Prefill the wizard from the last saved mortgage profile. The profile is
 * also what My Profile edits write to, so the latest manual change always
 * wins over an older questionnaire submission.
 */
function profileToQuestionnaire(p?: MortgageProfile): QuestionnaireData | null {
  if (!p) return null;
  const d = emptyQuestionnaire();
  return {
    ...d,
    dob: p.dateOfBirth ?? "",
    maritalStatus: p.maritalStatus ?? "",
    unmarried: p.unmarriedAddendum ?? d.unmarried,
    dependents: p.dependents ?? [],
    hasItin: p.hasItin ?? false,
    itin: p.itin ?? "",
    countryOfResidence: p.countryOfResidence ?? "",
    citizenship: p.citizenship ?? "",
    secondCitizenship: p.secondCitizenship ?? "",
    visaActive: p.usVisaActive ?? false,
    visaType: p.visaType ?? "",
    otherVisaType: p.otherVisaType ?? "",
    visaIssued: p.visaIssued ?? "",
    visaValidUntil: p.visaValidUntil ?? "",
    propertyUse: p.propertyUse ?? "",
    usBankAccount: p.usBankAccount ?? false,
    addresses: p.addresses?.length ? p.addresses : d.addresses,
    ssn: p.ssn ?? "",
    ssnAccepted: p.ssnTermsAccepted ?? false,
    incomes: p.incomes?.length ? p.incomes : d.incomes,
    liabilities: p.liabilities ?? d.liabilities,
    assets: normalizeAssets(p.assets),
    declarations: p.declarations ?? d.declarations,
    military: p.military ?? d.military,
    demographics: p.demographics ?? d.demographics,
  };
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
  const { createLead, updateLead } = useLeads();
  const { getDraft, saveDraft, clearDraft } = useMortgageDrafts();

  const propertyId = property?.id ?? 0;
  const usPerson = Boolean(user?.usPerson);

  const initial = useMemo<{ data: QuestionnaireData; step: number }>(() => {
    const draft = user ? getDraft(user.email, propertyId) : undefined;
    if (draft && !draft.submitted) {
      const defaults = emptyQuestionnaire();
      const saved = draft.data as Partial<QuestionnaireData>;
      return {
        data: { ...defaults, ...saved, assets: normalizeAssets(saved.assets ?? defaults.assets) },
        step: Math.min(5, Math.max(1, draft.step)),
      };
    }
    /* No open draft — prefill from the last saved profile (which also
     * reflects manual edits made via My Profile). */
    const fromProfile = profileToQuestionnaire(user?.mortgageProfile);
    return { data: fromProfile ?? emptyQuestionnaire(), step: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, propertyId, open]);

  const [data, setData] = useState<QuestionnaireData>(initial.data);
  const [step, setStep] = useState(initial.step);
  const [furthest, setFurthest] = useState(initial.step);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [submittedProfile, setSubmittedProfile] = useState<MortgageProfile | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  /** Why a fresh visa document is required after submission (null = on file). */
  const [visaFollowUp, setVisaFollowUp] = useState<"changed" | "expired" | "new" | null>(null);

  /* Warn when the visa / status document on file expires within 3 days
   * (or has already expired) — the client is asked to upload a renewal. */
  const savedVisaValidUntil = user?.mortgageProfile?.visaValidUntil;
  useEffect(() => {
    if (!open) return;
    const state = documentExpiryState(savedVisaValidUntil);
    if (state === "expiring") {
      toast.warning(
        `Your US visa / status document expires ${formatDate(savedVisaValidUntil)} — please prepare a renewed document.`,
      );
    }
    if (state === "expired") {
      toast.error(
        "Your US visa / status document on file has expired — please upload an updated document.",
      );
    }
  }, [open, savedVisaValidUntil]);

  /** Merge confirmed documents into the submitted profile + lead snapshot. */
  function attachDocuments(
    key: "visaDocuments" | "idDocuments" | "bankruptcyDocuments",
    docs: { id: string; name: string; url: string }[],
  ) {
    if (!submittedProfile) return;
    const now = new Date().toISOString();
    const documents = docs.map((d) => ({ ...d, uploadedAt: now }));
    const next: MortgageProfile = {
      ...submittedProfile,
      [key]: documents,
      ...(key === "visaDocuments" && documents[0]?.name
        ? { visaDocumentName: documents[0].name, visaDocumentUploadedAt: now }
        : {}),
    };
    setSubmittedProfile(next);
    saveMortgageProfile(next);
    if (submittedLeadId) updateLead(submittedLeadId, { profile: next });
  }

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
      if (!usPerson && data.visaActive && data.visaType === "other" && !data.otherVisaType.trim())
        return "Please specify your visa or status.";
      if (
        !hasTwoYearCoverage(
          data.addresses.map((x) => ({ from: x.from, to: x.to, current: Boolean(x.present) })),
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
    if (s === 3) {
      const invalidAsset = normalizeAssets(data.assets).entries.some(
        (asset) =>
          !asset.country ||
          !asset.currency ||
          !asset.value ||
          (asset.type === "real_estate" && !asset.address.trim()) ||
          (asset.type === "other" && !asset.description.trim()) ||
          ((asset.type === "bank_account" || asset.type === "investment_account") &&
            !asset.institution.trim()),
      );
      if (invalidAsset)
        return "Please complete each asset: institution, country, currency and value (address for real estate, description for other).";
    }
    if (s === 4) {
      if (data.declarations.bankruptcy) {
        if (data.declarations.bankruptcyChapters.length === 0)
          return "Please select the bankruptcy chapter(s) that apply.";
        if (!data.declarations.bankruptcyDischargeDate)
          return "Please enter the bankruptcy discharge date (mm/dd/yyyy).";
      }
    }
    if (s === 5) {
      if (!data.demographics.ethnicityDeclined && data.demographics.ethnicity.length === 0)
        return "Please select an ethnicity option or choose not to provide it.";
      if (!data.demographics.raceDeclined && data.demographics.race.length === 0)
        return "Please select a race option or choose not to provide it.";
      if (!data.demographics.sex) return "Please select a sex option or choose not to provide it.";
    }
    return null;
  }

  const steps = QUESTIONNAIRE_STEPS;
  const lastStepId = steps[steps.length - 1]?.id ?? 5;

  /** Next/previous visible step id. */
  const shift = (from: number, dir: 1 | -1): number => {
    const ids: number[] = steps.map((s) => s.id);
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

    /* Previously confirmed documents stay on file across re-submissions —
     * unless the visa details changed or the visa expired, in which case a
     * fresh document is required to verify the new information. */
    const prevProfile = user?.mortgageProfile;
    const visaExpiry = data.visaActive ? documentExpiryState(data.visaValidUntil) : null;
    const visaChanged = Boolean(
      prevProfile &&
        (Boolean(prevProfile.usVisaActive) !== data.visaActive ||
          (data.visaActive &&
            ((prevProfile.visaType ?? "") !== (data.visaType || "") ||
              (prevProfile.visaIssued ?? "") !== data.visaIssued ||
              (prevProfile.visaValidUntil ?? "") !== data.visaValidUntil))),
    );
    const carriedVisaDocs =
      data.visaActive && !visaChanged && visaExpiry !== "expired"
        ? (prevProfile?.visaDocuments ?? [])
        : [];
    setVisaFollowUp(
      !data.visaActive
        ? null
        : visaChanged
          ? "changed"
          : visaExpiry === "expired"
            ? "expired"
            : carriedVisaDocs.length
              ? null
              : "new",
    );

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
                  ...(data.visaType === "other"
                    ? { otherVisaType: data.otherVisaType.trim() }
                    : {}),
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
      assets: data.assets,
      declarations: derivedDeclarations,
      military: data.military,
      demographics: data.demographics,
      ...(carriedVisaDocs.length
        ? {
            visaDocuments: carriedVisaDocs,
            visaDocumentName: carriedVisaDocs[0]!.name,
            visaDocumentUploadedAt: carriedVisaDocs[0]!.uploadedAt,
          }
        : {}),
      ...(prevProfile?.idDocuments?.length ? { idDocuments: prevProfile.idDocuments } : {}),
      ...(data.declarations.bankruptcy && prevProfile?.bankruptcyDocuments?.length
        ? { bankruptcyDocuments: prevProfile.bankruptcyDocuments }
        : {}),
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
    setSubmittedProfile(profile);
    if (user && property) {
      const lead = createLead({
        clientEmail: user.email,
        clientName: fullName(user),
        usPerson: user.usPerson,
        propertyId: property.id,
        propertyLabel: propertyLabel ?? `Property #${property.id}`,
        propertyPrice: property.price,
        profile,
      });
      setSubmittedLeadId(lead.id);
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
              submittedProfile?.visaDocuments?.length ? (
                <div className="rounded-lg border border-border bg-card p-5 text-left">
                  <div className="text-sm font-semibold text-foreground">
                    Visa document on file
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shared with the lending partner together with your application.
                  </p>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {submittedProfile.visaDocuments.map((doc) => (
                      <li key={doc.id}>📎 {doc.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <DocumentUploadBox
                  title="One more step: visa document verification"
                  description={
                    visaFollowUp === "changed"
                      ? "Your visa / status details changed since your last application — please upload the new valid visa document so the lending partner can verify it."
                      : visaFollowUp === "expired"
                        ? "The visa document we had on file has expired — please upload the renewed document."
                        : "Because you hold a US visa or status, please upload a copy or scan of your valid visa document so the lending partner can verify it."
                  }
                  onConfirm={(docs) => attachDocuments("visaDocuments", docs)}
                />
              )
            ) : null}

            {data.declarations.bankruptcy && !submittedProfile?.bankruptcyDocuments?.length ? (
              <DocumentUploadBox
                title="Bankruptcy discharge papers"
                description="You declared a bankruptcy within the last 7 years. Please upload the bankruptcy discharge papers so the lending partner can verify the discharge."
                onConfirm={(docs) => attachDocuments("bankruptcyDocuments", docs)}
              />
            ) : null}

            {!submittedProfile?.idDocuments?.length ? (
              <DocumentUploadBox
                title="Identification document"
                description={
                  usPerson || data.hasItin
                    ? "To verify the information for an accurate pre-approval, please upload your driver's license (front and back), green card, or passport."
                    : "To verify your identity for an accurate pre-approval, please upload your identity document — national ID card (front and back) or passport."
                }
                onConfirm={(docs) => attachDocuments("idDocuments", docs)}
              />
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
            {step === 3 ? <Step3Liabilities {...stepProps} /> : null}
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
