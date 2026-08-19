import { useEffect, useMemo, useRef, useState } from "react";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand disabled:opacity-50";

export type TypeaheadOption = { value: string; label: string };

/**
 * Shared type-ahead picker. Suggestions come from `options`; when
 * `allowFreeText` is set the typed value can also be committed as-is (used for
 * cities and regions in countries we have no reference list for).
 */
export function Typeahead({
  value,
  displayValue,
  options,
  onChange,
  placeholder,
  disabled = false,
  allowFreeText = false,
  emptyHint,
}: {
  value: string;
  /** Label shown for the committed value (defaults to the value itself). */
  displayValue?: string;
  options: TypeaheadOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options
          .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase() === q)
          .sort((a, b) => {
            const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
            return aStarts - bStarts || a.label.localeCompare(b.label);
          })
      : options;
    return list.slice(0, 60);
  }, [query, options]);

  function commit(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  const shown = query || (open ? "" : (displayValue ?? value));

  return (
    <div ref={wrapRef} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        className={inputClass}
        placeholder={displayValue || value || placeholder}
        value={shown}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (allowFreeText) onChange(e.target.value);
        }}
        onBlur={() => {
          if (allowFreeText && query.trim()) onChange(query.trim());
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            const hit = matches[active];
            if (hit) {
              e.preventDefault();
              commit(hit.value);
            } else if (allowFreeText && query.trim()) {
              e.preventDefault();
              commit(query.trim());
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open && !disabled && matches.length ? (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {matches.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(o.value)}
                className={`flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-brand-tint text-brand" : "text-foreground hover:bg-brand-tint"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !disabled && !matches.length && emptyHint ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-3 text-xs text-muted-foreground shadow-lg">
          {emptyHint}
        </div>
      ) : null}
    </div>
  );
}
