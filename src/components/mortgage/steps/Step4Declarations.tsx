import { DateInput } from "@/components/form/DateInput";
import { Field, QuestionRow, Section, inputClass } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import type { Declarations, MilitaryService } from "@/lib/mortgage-form";

export function Step4Declarations({ data, patch }: StepProps) {
  const d = data.declarations;
  const patchD = (p: Partial<Declarations>) => patch({ declarations: { ...d, ...p } });
  const m = data.military;
  const patchM = (p: Partial<MilitaryService>) => patch({ military: { ...m, ...p } });

  const toggleChapter = (c: string) =>
    patchD({
      bankruptcyChapters: d.bankruptcyChapters.includes(c)
        ? d.bankruptcyChapters.filter((x) => x !== c)
        : [...d.bankruptcyChapters, c],
    });

  return (
    <div className="space-y-6">
      <Section title="Military service" subtitle="US Armed Forces service history.">
        <QuestionRow
          question="Did you (or your deceased spouse) ever serve, or are you currently serving, in the United States Armed Forces?"
          name="served"
          value={m.served}
          onChange={(v) => patch({ military: { ...m, served: v } })}
        >
          <div className="space-y-3 rounded-md bg-brand-tint/40 p-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={m.activeDuty}
                onChange={(e) => patchM({ activeDuty: e.target.checked })}
              />
              Currently serving on active duty
            </label>
            {m.activeDuty ? (
              <Field label="Projected expiration date of service / tour" required>
                <DateInput
                  value={m.activeDutyExpiration}
                  onChange={(v) => patchM({ activeDutyExpiration: v })}
                  className={inputClass}
                />
              </Field>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={m.retiredOrDischarged}
                onChange={(e) => patchM({ retiredOrDischarged: e.target.checked })}
              />
              Currently retired, discharged or separated from service
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={m.reserveOrNationalGuardOnly}
                onChange={(e) => patchM({ reserveOrNationalGuardOnly: e.target.checked })}
              />
              Only period of service was as a non-activated member of the Reserve or National Guard
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={m.survivingSpouse}
                onChange={(e) => patchM({ survivingSpouse: e.target.checked })}
              />
              Surviving spouse
            </label>
          </div>
        </QuestionRow>
      </Section>

      <Section title="Declarations — about this property and your money">
        <QuestionRow
          question="Have you had an ownership interest in another property in the last three years?"
          name="ownership3y"
          value={d.ownershipInterestLast3Years}
          onChange={(v) => patchD({ ownershipInterestLast3Years: v })}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type of property" required hint="Primary residence, second home, investment">
              <input
                value={d.priorPropertyType}
                onChange={(e) => patchD({ priorPropertyType: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="How did you hold title?" required hint="Solely, jointly with spouse, jointly with another person">
              <input
                value={d.priorTitleHeld}
                onChange={(e) => patchD({ priorTitleHeld: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        </QuestionRow>
        <QuestionRow
          question="Are you borrowing any money for this transaction that is not disclosed on this application?"
          name="otherMoney"
          value={d.borrowingOtherMoney}
          onChange={(v) => patchD({ borrowingOtherMoney: v })}
        >
          <Field label="Amount" required>
            <input
              inputMode="decimal"
              value={d.borrowingOtherAmount}
              onChange={(e) => patchD({ borrowingOtherAmount: e.target.value })}
              className={`${inputClass} max-w-[220px]`}
            />
          </Field>
        </QuestionRow>
        <QuestionRow
          question="Have you or will you apply for a mortgage on another property before closing this transaction?"
          name="otherMortgage"
          value={d.applyingOtherMortgage}
          onChange={(v) => patchD({ applyingOtherMortgage: v })}
        />
        <QuestionRow
          question="Have you or will you apply for any new credit before closing this transaction?"
          name="newCredit"
          value={d.applyingNewCredit}
          onChange={(v) => patchD({ applyingNewCredit: v })}
        />
        <QuestionRow
          question="Will this property be subject to a lien that could take priority over the first mortgage lien (e.g. a clean energy lien)?"
          name="priorityLien"
          value={d.priorityLien}
          onChange={(v) => patchD({ priorityLien: v })}
        />
      </Section>

      <Section title="Declarations — about your finances">
        <QuestionRow
          question="Are you a co-signer or guarantor on any debt or loan that is not disclosed on this application?"
          name="coSigner"
          value={d.coSignerOrGuarantor}
          onChange={(v) => patchD({ coSignerOrGuarantor: v })}
        />
        <QuestionRow
          question="Are there any outstanding judgments against you?"
          name="judgments"
          value={d.outstandingJudgments}
          onChange={(v) => patchD({ outstandingJudgments: v })}
        />
        <QuestionRow
          question="Are you currently delinquent or in default on a federal debt?"
          name="federalDebt"
          value={d.delinquentFederalDebt}
          onChange={(v) => patchD({ delinquentFederalDebt: v })}
        />
        <QuestionRow
          question="Are you a party to a lawsuit in which you potentially have any personal financial liability?"
          name="lawsuit"
          value={d.partyToLawsuit}
          onChange={(v) => patchD({ partyToLawsuit: v })}
        />
        <QuestionRow
          question="Have you conveyed title to any property in lieu of foreclosure in the past 7 years?"
          name="deedInLieu"
          value={d.conveyedTitleInLieu}
          onChange={(v) => patchD({ conveyedTitleInLieu: v })}
        />
        <QuestionRow
          question="Within the past 7 years, have you completed a pre-foreclosure sale or short sale?"
          name="shortSale"
          value={d.preForeclosureOrShortSale}
          onChange={(v) => patchD({ preForeclosureOrShortSale: v })}
        />
        <QuestionRow
          question="Have you had property foreclosed upon in the last 7 years?"
          name="foreclosed"
          value={d.propertyForeclosed}
          onChange={(v) => patchD({ propertyForeclosed: v })}
        />
        <QuestionRow
          question="Have you declared bankruptcy within the past 7 years?"
          name="bankruptcy"
          value={d.bankruptcy}
          onChange={(v) => patchD({ bankruptcy: v })}
        >
          <div className="flex flex-wrap gap-4 rounded-md bg-brand-tint/40 p-3">
            {["Chapter 7", "Chapter 11", "Chapter 12", "Chapter 13"].map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={d.bankruptcyChapters.includes(c)}
                  onChange={() => toggleChapter(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </QuestionRow>
      </Section>
    </div>
  );
}
