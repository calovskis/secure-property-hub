/**
 * World-language multi-select with type-ahead: start typing and matching
 * languages pre-show for one-click selection; chips can be removed.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { WORLD_LANGUAGES } from "@/lib/languages";

export function LanguageMultiSelect({
  values,
  onChange,
  placeholder = "Type a language…",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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
    const pool = WORLD_LANGUAGES.filter((l) => !values.includes(l));
    if (!q) return pool.slice(0, 40);
    return pool
      .filter((l) => l.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.localeCompare(b);
      })
      .slice(0, 40);
  }, [query, values]);

  function add(lang: string) {
    const v = lang.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {values.map((l) => (
          <span
            key={l}
            className="flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand"
          >
            {l}
            <button
              type="button"
              aria-label={`Remove ${l}`}
              onClick={() => onChange(values.filter((x) => x !== l))}
              className="text-brand hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          placeholder={values.length ? "" : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(matches[0] ?? query);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && matches.length ? (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {matches.map((l) => (
            <li key={l}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(l)}
                className="flex w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand-tint"
              >
                {l}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
