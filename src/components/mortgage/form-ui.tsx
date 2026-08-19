import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : "(optional)"}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-4 pt-1 text-sm text-foreground">
      <label className="flex items-center gap-2">
        <input type="radio" name={name} checked={value} onChange={() => onChange(true)} />
        Yes
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" name={name} checked={!value} onChange={() => onChange(false)} />
        No
      </label>
    </div>
  );
}

export function QuestionRow({
  question,
  name,
  value,
  onChange,
  children,
}: {
  question: string;
  name: string;
  value: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-foreground">{question}</p>
        <div className="shrink-0">
          <YesNo name={name} value={value} onChange={onChange} />
        </div>
      </div>
      {value && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CheckboxList({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o}
          className={`flex items-center gap-2 text-sm text-foreground ${
            disabled ? "opacity-50" : ""
          }`}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={selected.includes(o)}
            onChange={() => onToggle(o)}
          />
          {o}
        </label>
      ))}
    </div>
  );
}

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
