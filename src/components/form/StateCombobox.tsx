import { useEffect, useMemo, useRef, useState } from "react";
import { US_STATE_CODES, US_STATE_NAME_BY_CODE } from "@/data/us-states";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

export function stateLabel(code: string) {
  if (!code) return "";
  const name = US_STATE_NAME_BY_CODE[code];
  return name ? `${code} — ${name}` : code;
}

type BaseProps = {
  /** Codes hidden from the suggestion list (already applied). */
  exclude?: string[];
  placeholder?: string;
  disabled?: boolean;
};

function useMatches(query: string, exclude: string[]) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = US_STATE_CODES.filter((c) => !exclude.includes(c));
    const list = q
      ? pool
          .filter(
            (c) =>
              c.toLowerCase().startsWith(q) ||
              (US_STATE_NAME_BY_CODE[c] ?? "").toLowerCase().includes(q),
          )
          .sort((a, b) => {
            const an = (US_STATE_NAME_BY_CODE[a] ?? "").toLowerCase();
            const bn = (US_STATE_NAME_BY_CODE[b] ?? "").toLowerCase();
            const aStarts = an.startsWith(q) || a.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts = bn.startsWith(q) || b.toLowerCase().startsWith(q) ? 0 : 1;
            return aStarts - bStarts || an.localeCompare(bn);
          })
      : [...pool];
    return list.slice(0, 60);
  }, [query, exclude]);
}

/** Type-ahead single-state picker: free typing, only real states commit. */
export function StateCombobox({
  value,
  onChange,
  exclude = [],
  placeholder = "Start typing a state…",
  disabled = false,
}: BaseProps & { value: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const matches = useMatches(query, exclude);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
        disabled={disabled}
        className={inputClass}
        placeholder={stateLabel(value) || placeholder}
        value={open ? query : stateLabel(value)}
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
              commit(matches[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setQuery(""), 0)}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching state</li>
          ) : (
            matches.map((c, i) => (
              <li key={c}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(c)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                    i === active ? "bg-brand-tint text-brand" : "text-foreground"
                  } ${c === value ? "font-semibold" : ""}`}
                >
                  <span>{US_STATE_NAME_BY_CODE[c]}</span>
                  <span className="text-[11px] text-muted-foreground">{c}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Chips of the applied states plus a type-ahead picker to add more. */
export function StateMultiSelect({
  values,
  onAdd,
  onRemove,
  disabled = false,
  placeholder = "Add a state — type to search…",
  emptyLabel = "No states applied yet.",
}: {
  values: string[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  return (
    <div>
      {values.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((c) => (
            <li
              key={c}
              className="flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand"
              title={US_STATE_NAME_BY_CODE[c]}
            >
              {c}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() => onRemove(c)}
                  className="text-destructive"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">{emptyLabel}</p>
      )}
      {!disabled ? (
        <StateCombobox
          value=""
          exclude={values}
          placeholder={placeholder}
          onChange={(code) => code && onAdd(code)}
        />
      ) : null}
    </div>
  );
}
