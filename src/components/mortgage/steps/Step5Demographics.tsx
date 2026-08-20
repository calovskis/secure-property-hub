import { CheckboxList, Field, Note, Section, inputClass } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import { ETHNICITY_OPTIONS, RACE_OPTIONS, type Demographics } from "@/lib/mortgage-form";

export function Step5Demographics({ data, patch }: StepProps) {
  const g = data.demographics;
  const patchG = (p: Partial<Demographics>) => patch({ demographics: { ...g, ...p } });

  const toggle = (key: "ethnicity" | "race", option: string) =>
    patchG({
      [key]: g[key].includes(option)
        ? g[key].filter((x) => x !== option)
        : [...g[key], option],
    } as Partial<Demographics>);

  return (
    <div className="space-y-6">
      <Note>
        This information is requested by the federal government under the Equal Credit
        Opportunity Act, in order to monitor compliance with equal credit opportunity and fair
        housing laws. You are not required to provide it, and it does not affect your pre-approval
        decision.{" "}
        <a
          href="https://www.justice.gov/crt/equal-credit-opportunity-act-3"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline"
        >
          Learn more
        </a>
        .
      </Note>

      <Section title="Ethnicity" subtitle="Select all that apply.">
        <CheckboxList
          options={ETHNICITY_OPTIONS}
          selected={g.ethnicity}
          onToggle={(o) => toggle("ethnicity", o)}
          disabled={g.ethnicityDeclined}
        />
        {g.ethnicity.includes("Other Hispanic or Latino") && !g.ethnicityDeclined ? (
          <div className="mt-3 max-w-sm">
            <Field label="Please specify origin">
              <input
                value={g.ethnicityOther}
                onChange={(e) => patchG({ ethnicityOther: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={g.ethnicityDeclined}
            onChange={(e) =>
              patchG({
                ethnicityDeclined: e.target.checked,
                ...(e.target.checked ? { ethnicity: [], ethnicityOther: "" } : {}),
              })
            }
          />
          I do not wish to provide this information
        </label>
      </Section>

      <Section title="Race" subtitle="Select all that apply.">
        <CheckboxList
          options={RACE_OPTIONS}
          selected={g.race}
          onToggle={(o) => toggle("race", o)}
          disabled={g.raceDeclined}
        />
        {(g.race.includes("Other Asian") ||
          g.race.includes("Other Pacific Islander") ||
          g.race.includes("American Indian or Alaska Native")) &&
        !g.raceDeclined ? (
          <div className="mt-3 max-w-sm">
            <Field label="Please specify (enrolled or principal tribe / origin)">
              <input
                value={g.raceOther}
                onChange={(e) => patchG({ raceOther: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={g.raceDeclined}
            onChange={(e) =>
              patchG({
                raceDeclined: e.target.checked,
                ...(e.target.checked ? { race: [], raceOther: "" } : {}),
              })
            }
          />
          I do not wish to provide this information
        </label>
      </Section>

      <Section title="Sex">
        <div className="flex flex-wrap gap-5 text-sm text-foreground">
          {(
            [
              ["female", "Female"],
              ["male", "Male"],
              ["declined", "I do not wish to provide this information"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="sex"
                checked={g.sex === value}
                onChange={() => patchG({ sex: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
