/**
 * KYB questionnaire pop-up for partner and corporate accounts — the partner
 * equivalent of the client mortgage pre-approval questionnaire: a step-by-step
 * window with a stepper, draft saving and a final review before submission.
 *
 * Step 1: your role (director or authorised representative, with documents)
 * Step 2: the director's details and ID document
 * Step 3: shareholders owning 25% or more, each with an ID document
 * Step 4: review and submit
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fullName, type LoqalUser } from "@/lib/auth";
import type { KycPerson, PartnerRequest } from "@/lib/partner-requests";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { countryLabel } from "@/data/countries";
import { searchAddress, type AddressSuggestion } from "@/lib/geo";

const ADDRESS_DEBOUNCE_MS = 350;

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const STEPS = [
  { id: 1, title: "Your role" },
  { id: 2, title: "Director" },
  { id: 3, title: "Shareholders" },
  { id: 4, title: "Review & submit" },
] as const;

export type KybDraft = {
  directorIsCreator: boolean;
  director: KycPerson;
  shareholders: KycPerson[];
  creatorAuthorized: boolean;
  creatorIdDoc: string;
  authorizationDoc: string;
  /** The person filling the form is also a 25%+ shareholder. */
  creatorIsShareholder: boolean;
  creatorSharePct?: number;
  /** Creator details when the creator is a shareholder but NOT the director. */
  creatorShareholder: KycPerson;
};

export const emptyKycPerson = (): KycPerson => ({
  fullName: "",
  address: "",
  citizenship: "",
  countryOfResidence: "",
});

const emptyDraft = (): KybDraft => ({
  directorIsCreator: true,
  director: emptyKycPerson(),
  shareholders: [],
  creatorAuthorized: false,
  creatorIdDoc: "",
  authorizationDoc: "",
  creatorIsShareholder: false,
  creatorShareholder: emptyKycPerson(),
});

const draftKey = (requestId: string) => `loqal-kyb-draft-${requestId}`;

function FilePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5 text-sm hover:border-brand">
        <input
          type="file"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
        />
        <span className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">
          Choose file
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {value || "No file selected"}
        </span>
      </label>
    </div>
  );
}

/**
 * Home-address field with worldwide autocomplete — the same address search the
 * client mortgage questionnaire uses. Suggestions are scoped to the person's
 * country of residence when it's picked; typing free text always works.
 */
function HomeAddressField({
  value,
  country,
  onChange,
}: {
  value: string;
  /** ISO country code used to bias suggestions ("" = worldwide). */
  country: string;
  onChange: (address: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void searchAddress(q, country || undefined, controller.signal).then((list) => {
        if (!controller.signal.aborted) {
          setSuggestions(list);
          setOpen(list.length > 0);
        }
      });
    }, ADDRESS_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value, country]);

  return (
    <div ref={wrapRef} className="relative">
      <span className={labelClass}>Home address</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Start typing the street address…"
        autoComplete="off"
        className={inputClass}
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-tint"
                onClick={() => {
                  onChange(s.label);
                  setOpen(false);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PersonFields({
  person,
  onChange,
  showShare,
  lockName,
}: {
  person: KycPerson;
  onChange: (p: KycPerson) => void;
  showShare?: boolean;
  lockName?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Full name</span>
        <input
          value={person.fullName}
          readOnly={lockName}
          onChange={(e) => onChange({ ...person, fullName: e.target.value })}
          className={`${inputClass} ${lockName ? "bg-muted/40 text-muted-foreground" : ""}`}
        />
      </label>
      {showShare ? (
        <label className="block">
          <span className={labelClass}>Ownership share, %</span>
          <input
            type="number"
            min={0}
            max={100}
            value={person.sharePct ?? ""}
            onChange={(e) =>
              onChange(
                (() => {
                  const next = { ...person };
                  if (e.target.value === "") delete next.sharePct;
                  else next.sharePct = Number(e.target.value);
                  return next;
                })(),
              )
            }
            className={inputClass}
          />
        </label>
      ) : null}
      <div className="sm:col-span-2">
        <HomeAddressField
          value={person.address}
          country={person.countryOfResidence}
          onChange={(address) => onChange({ ...person, address })}
        />
      </div>
      <div>
        <span className={labelClass}>Citizenship</span>
        <CountryCombobox
          value={person.citizenship}
          onChange={(code) => onChange({ ...person, citizenship: code })}
        />
      </div>
      <div>
        <span className={labelClass}>Country of residence</span>
        <CountryCombobox
          value={person.countryOfResidence}
          onChange={(code) => onChange({ ...person, countryOfResidence: code })}
        />
      </div>
      <div className="sm:col-span-2">
        <FilePick
          label="ID document (passport / ID card)"
          value={person.idDoc ?? ""}
          onChange={(name) =>
            onChange(
              (() => {
                const next = { ...person };
                if (name) next.idDoc = name;
                else delete next.idDoc;
                return next;
              })(),
            )
          }
        />
      </div>
    </div>
  );
}

export function KybQuestionnaireDialog({
  open,
  onOpenChange,
  user,
  request,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: LoqalUser;
  request: PartnerRequest;
  onSubmit: (draft: KybDraft) => void;
}) {
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);
  const [data, setData] = useState<KybDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // Restore any saved draft when the window opens.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(draftKey(request.id));
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; data?: KybDraft };
        if (parsed.data) setData({ ...emptyDraft(), ...parsed.data });
        if (parsed.step) {
          setStep(parsed.step);
          setFurthest(parsed.step);
        }
      }
    } catch {
      /* ignore an unreadable draft */
    }
  }, [open, request.id]);

  function persist(nextStep: number, next: KybDraft) {
    try {
      localStorage.setItem(draftKey(request.id), JSON.stringify({ step: nextStep, data: next }));
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2000);
    } catch {
      /* storage unavailable */
    }
  }

  const director: KycPerson = data.directorIsCreator
    ? { ...data.director, fullName: fullName(user) }
    : data.director;

  /**
   * The creator as a shareholder. When the creator is also the director, their
   * details are already collected in step 2 — only the share % is asked again.
   * Otherwise the creator fills their own details once (name locked).
   */
  const creatorAsShareholder: KycPerson | null = data.creatorIsShareholder
    ? data.directorIsCreator
      ? { ...director, sharePct: data.creatorSharePct, idDoc: director.idDoc }
      : {
          ...data.creatorShareholder,
          fullName: fullName(user),
          sharePct: data.creatorSharePct,
        }
    : null;

  const allShareholders: KycPerson[] = creatorAsShareholder
    ? [creatorAsShareholder, ...data.shareholders]
    : data.shareholders;

  function validate(s: number): string | null {
    if (s === 1) {
      if (!data.directorIsCreator) {
        if (!data.creatorAuthorized)
          return "Confirm you hold a written authorization (power of attorney) to act for the company.";
        if (!data.creatorIdDoc || !data.authorizationDoc)
          return "Upload your ID document and the authorization (PoA) document.";
      }
    }
    if (s === 2) {
      if (
        !director.fullName.trim() ||
        !director.address.trim() ||
        !director.citizenship ||
        !director.countryOfResidence
      )
        return "Complete the director's name, address, citizenship and residence.";
      if (!data.directorIsCreator && !director.idDoc)
        return "Upload the director's ID document.";
    }
    if (s === 3) {
      for (const [idx, sh] of allShareholders.entries()) {
        if (!sh.fullName.trim() || !sh.sharePct || sh.sharePct <= 0)
          return "Every declared shareholder needs a name and an ownership share.";
        if (!sh.address.trim() || !sh.citizenship || !sh.countryOfResidence)
          return `Complete the address, citizenship and residence for ${sh.fullName || "the shareholder"}.`;
        // The director-creator's ID is already on file from their registration.
        const idOnFile = idx === 0 && creatorAsShareholder !== null && data.directorIsCreator;
        if (!idOnFile && !sh.idDoc)
          return `Upload the ID document for ${sh.fullName || "the shareholder"}.`;
      }
    }
    return null;
  }

  function goTo(next: number) {
    if (next > step) {
      const problem = validate(step);
      if (problem) return setError(problem);
    }
    setError(null);
    setStep(next);
    setFurthest((f) => Math.max(f, next));
    persist(next, data);
  }

  function update(patch: Partial<KybDraft>) {
    setData((d) => ({ ...d, ...patch }));
  }

  function submit() {
    for (const s of [1, 2, 3]) {
      const problem = validate(s);
      if (problem) {
        setStep(s);
        return setError(problem);
      }
    }
    setError(null);
    onSubmit({ ...data, director, shareholders: allShareholders });
    try {
      localStorage.removeItem(draftKey(request.id));
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYB questionnaire — {request.companyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STEPS.map((s) => {
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

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tell us who directs and owns {request.companyName}. Loqal compliance reviews the
                answers and may ask for additional documents.
              </p>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={data.directorIsCreator}
                  onChange={(e) => update({ directorIsCreator: e.target.checked })}
                  className="mt-0.5"
                />
                I am the director of the company
              </label>
              {!data.directorIsCreator ? (
                <div className="space-y-3 rounded-md bg-brand-tint/40 p-3">
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={data.creatorAuthorized}
                      onChange={(e) => update({ creatorAuthorized: e.target.checked })}
                      className="mt-0.5"
                    />
                    I hold a written authorization (power of attorney) to act for the company
                  </label>
                  {data.creatorAuthorized ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FilePick
                        label="Your ID document"
                        value={data.creatorIdDoc}
                        onChange={(creatorIdDoc) => update({ creatorIdDoc })}
                      />
                      <FilePick
                        label="Authorization / PoA document"
                        value={data.authorizationDoc}
                        onChange={(authorizationDoc) => update({ authorizationDoc })}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Director {data.directorIsCreator ? `(you — ${fullName(user)})` : ""}
              </h3>
              <PersonFields
                person={director}
                lockName={data.directorIsCreator}
                onChange={(p) => update({ director: p })}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <div className="mb-3 rounded-md border border-border p-3">
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={data.creatorIsShareholder}
                    onChange={(e) => update({ creatorIsShareholder: e.target.checked })}
                    className="mt-0.5"
                  />
                  I am also a shareholder with 25% or more
                </label>
                {data.creatorIsShareholder ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {data.directorIsCreator
                        ? "Your details are already on file from step 2 — only your ownership share is needed."
                        : "Tell us your ownership share and your details."}
                    </p>
                    <label className="block sm:max-w-xs">
                      <span className={labelClass}>Your ownership share, %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={data.creatorSharePct ?? ""}
                        onChange={(e) =>
                          update(
                            e.target.value === ""
                              ? (() => {
                                  const patch: Partial<KybDraft> = {};
                                  delete patch.creatorSharePct;
                                  return patch;
                                })()
                              : { creatorSharePct: Number(e.target.value) },
                          )
                        }
                        className={inputClass}
                      />
                    </label>
                    {!data.directorIsCreator ? (
                      <PersonFields
                        person={{ ...data.creatorShareholder, fullName: fullName(user) }}
                        lockName
                        onChange={(p) =>
                          update({
                            creatorShareholder: (() => {
                              const next = { ...p };
                              delete next.sharePct;
                              return next;
                            })(),
                          })
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Other shareholders with 25% or more
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    update({ shareholders: [...data.shareholders, emptyKycPerson()] })
                  }
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                >
                  + Add shareholder
                </button>
              </div>
              {data.shareholders.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No shareholders with 25%+ ownership — or add them here.
                </p>
              ) : (
                <div className="space-y-4">
                  {data.shareholders.map((s, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Shareholder {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            update({
                              shareholders: data.shareholders.filter((_, j) => j !== i),
                            })
                          }
                          className="text-xs font-semibold text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <PersonFields
                        person={s}
                        showShare
                        onChange={(p) =>
                          update({
                            shareholders: data.shareholders.map((x, j) => (j === i ? p : x)),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Director</h3>
                <p className="mt-1 text-muted-foreground">
                  {director.fullName || "—"}
                  {data.directorIsCreator ? " (you)" : ""} · {director.address || "—"} ·{" "}
                  {director.citizenship ? countryLabel(director.citizenship) : "—"} / residing in{" "}
                  {director.countryOfResidence ? countryLabel(director.countryOfResidence) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ID document: {director.idDoc || (data.directorIsCreator ? "on file" : "—")}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Shareholders with 25% or more
                </h3>
                {allShareholders.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">None declared.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {allShareholders.map((s, i) => (
                      <li key={i}>
                        {s.fullName}
                        {i === 0 && creatorAsShareholder ? " (you)" : ""} — {s.sharePct}% · ID:{" "}
                        {s.idDoc || (i === 0 && creatorAsShareholder && data.directorIsCreator ? "on file" : "—")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!data.directorIsCreator ? (
                <div className="rounded-md border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">Your authorization</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {data.creatorIdDoc || "—"} · Authorization: {data.authorizationDoc || "—"}
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                By submitting you confirm the information is accurate and complete. Loqal
                compliance reviews it and comes back if anything else is needed.
              </p>
            </div>
          ) : null}

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
                  onClick={() => goTo(step - 1)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  persist(step, data);
                  onOpenChange(false);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                Save &amp; finish later
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => goTo(step + 1)}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
                >
                  Submit KYB questionnaire
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
