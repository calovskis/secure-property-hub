import { useEffect, useState } from "react";
import {
  DATE_PLACEHOLDER,
  MONTH_PLACEHOLDER,
  isoToUsDate,
  isoToUsMonth,
  maskUsDate,
  maskUsMonth,
  usDateToIso,
  usMonthToIso,
} from "@/lib/dates";

type BaseProps = {
  /** ISO value: yyyy-mm-dd for DateInput, yyyy-mm for MonthInput. */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
};

/** Text input that always requests dates as mm/dd/yyyy, emits ISO yyyy-mm-dd. */
export function DateInput({ value, onChange, className, disabled, id, required }: BaseProps) {
  const [text, setText] = useState(() => isoToUsDate(value));

  useEffect(() => {
    const next = isoToUsDate(value);
    setText((prev) => (usDateToIso(prev) === value ? prev : next));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      placeholder={DATE_PLACEHOLDER}
      value={text}
      onChange={(e) => {
        const masked = maskUsDate(e.target.value);
        setText(masked);
        onChange(usDateToIso(masked));
      }}
      className={className}
    />
  );
}

/** Text input that always requests months as mm/yyyy, emits ISO yyyy-mm. */
export function MonthInput({ value, onChange, className, disabled, id, required }: BaseProps) {
  const [text, setText] = useState(() => isoToUsMonth(value));

  useEffect(() => {
    const next = isoToUsMonth(value);
    setText((prev) => (usMonthToIso(prev) === value ? prev : next));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      placeholder={MONTH_PLACEHOLDER}
      value={text}
      onChange={(e) => {
        const masked = maskUsMonth(e.target.value);
        setText(masked);
        onChange(usMonthToIso(masked));
      }}
      className={className}
    />
  );
}
