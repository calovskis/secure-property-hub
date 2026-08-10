import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryLabel } from "@/data/countries";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

type Props = {
  /** ISO 3166-1 alpha-2 code, or "" when nothing is selected. */
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  allowClear?: boolean;
};

/**
 * Type-ahead country picker: the user types freely, but only values from the
 * ISO country base can be committed.
 */
export function CountryCombobox({
  value,
  onChange,
  placeholder = "Start typing a country…",
  allowClear = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedLabel = countryLabel(value);

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
      ? COUNTRIES.filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
        ).sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name);
        })
      : COUNTRIES;
    return list.slice(0, 60);
  }, [query]);

  function commit(code: string) {
    onChange(code);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className={inputClass}
        placeholder={selectedLabel || placeholder}
        value={open ? query : selectedLabel}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (open && matches[active]) {
              e.preventDefault();
              commit(matches[active].code);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => {
          // Free text is never accepted: fall back to the current selection.
          setTimeout(() => setQuery(""), 0);
        }}
      />

      {value && allowClear && !open ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Clear selection"
        >
          ✕
        </button>
      ) : null}

      {open ? (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching country</li>
          ) : (
            matches.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(c.code)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                    i === active ? "bg-brand-tint text-brand" : "text-foreground"
                  } ${c.code === value ? "font-semibold" : ""}`}
                >
                  <span>{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">{c.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
