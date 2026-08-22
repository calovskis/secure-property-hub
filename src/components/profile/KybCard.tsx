/**
 * KYB (Know Your Business) questionnaire for partners and corporate accounts,
 * completed after registration: director and every shareholder owning 25% or
 * more (with ID documents), plus an authorization check when the account
 * creator is neither. While a registration is still pending, the partner can
 * also upload verification documents (ID / licenses) here.
 */
import { useState } from "react";
import { fullName, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type KycPerson } from "@/lib/partner-requests";
import { logActivity } from "@/lib/activity";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { formatDateTime } from "@/lib/dates";
import { toast } from "sonner";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const emptyPerson = (): KycPerson => ({
  fullName: "",
  address: "",
  citizenship: "",
  countryOfResidence: "",
});

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

function PersonFields({
  person,
  onChange,
  showShare,
}: {
  person: KycPerson;
  onChange: (p: KycPerson) => void;
  showShare?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Full name</span>
        <input
          value={person.fullName}
          onChange={(e) => onChange({ ...person, fullName: e.target.value })}
          className={inputClass}
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
      <label className="block sm:col-span-2">
        <span className={labelClass}>Home address</span>
        <input
          value={person.address}
          onChange={(e) => onChange({ ...person, address: e.target.value })}
          className={inputClass}
        />
      </label>
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

export function KybCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const [open, setOpen] = useState(false);
  const [directorIsCreator, setDirectorIsCreator] = useState(true);
  const [director, setDirector] = useState<KycPerson>(emptyPerson());
  const [shareholders, setShareholders] = useState<KycPerson[]>([]);
  const [creatorAuthorized, setCreatorAuthorized] = useState(false);
  const [creatorIdDoc, setCreatorIdDoc] = useState("");
  const [authorizationDoc, setAuthorizationDoc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  if (!request) return null;
  const kyc = request.kyc;

  function submitKyc() {
    if (!request) return;
    const d: KycPerson = directorIsCreator
      ? {
          ...director,
          fullName: fullName(user),
        }
      : director;
    if (!d.fullName.trim() || !d.address.trim() || !d.citizenship || !d.countryOfResidence)
      return setError("Complete the director's name, address, citizenship and residence.");
    if (!directorIsCreator && !d.idDoc) return setError("Upload the director's ID document.");
    for (const s of shareholders) {
      if (!s.fullName.trim() || !s.sharePct || s.sharePct <= 0)
        return setError("Every declared shareholder needs a name and an ownership share.");
      if (!s.idDoc) return setError(`Upload the ID document for ${s.fullName || "the shareholder"}.`);
    }
    if (!directorIsCreator && !creatorAuthorized)
      return setError(
        "If you are not the director, confirm you hold a written authorization to act for the company.",
      );
    if (!directorIsCreator && creatorAuthorized && (!creatorIdDoc || !authorizationDoc))
      return setError("Upload your ID and the authorization (PoA) document.");

    setError(null);
    updateRequest(request.id, {
      kyc: {
        director: d,
        directorIsCreator,
        shareholders,
        creatorAuthorized,
        ...(creatorIdDoc ? { creatorIdDoc } : {}),
        ...(authorizationDoc ? { authorizationDoc } : {}),
        submittedAt: new Date().toISOString(),
      },
    });
    logActivity(fullName(user), "submitted the KYB questionnaire", request.companyName);
    toast("KYB questionnaire submitted", {
      description: "Loqal compliance will review the director and shareholder information.",
    });
    setOpen(false);
  }

  function addDocs(names: string[]) {
    if (!request || !names.length) return;
    updateRequest(request.id, {
      verificationDocs: [...request.verificationDocs, ...names],
    });
    logActivity(fullName(user), "uploaded verification documents", names.join(", "));
    toast("Documents added", { description: "Loqal will review them with your registration." });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">KYB &amp; verification</h2>
        {kyc ? (
          <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
            Submitted {formatDateTime(kyc.submittedAt)}
          </span>
        ) : (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            Questionnaire required
          </span>
        )}
      </div>

      {kyc ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            Director: <strong className="text-foreground">{kyc.director.fullName}</strong>
            {kyc.directorIsCreator ? " (you)" : ""} · {kyc.shareholders.length} declared
            shareholder{kyc.shareholders.length === 1 ? "" : "s"} with ≥25% ownership.
          </p>
          <p className="mt-1 text-xs">
            Loqal compliance reviews the information and may ask for additional documents.
          </p>
        </div>
      ) : !open ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Tell us who directs and owns {request.companyName}: the director and every shareholder
            with 25% or more, each with an ID document.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Complete the KYB questionnaire
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-5 rounded-lg border border-border p-4">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={directorIsCreator}
              onChange={(e) => setDirectorIsCreator(e.target.checked)}
              className="mt-0.5"
            />
            I am the director of the company
          </label>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Director {directorIsCreator ? `(you — ${fullName(user)})` : ""}
            </h3>
            <PersonFields
              person={
                directorIsCreator ? { ...director, fullName: fullName(user) } : director
              }
              onChange={setDirector}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Shareholders with 25% or more
              </h3>
              <button
                type="button"
                onClick={() => setShareholders((s) => [...s, emptyPerson()])}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
              >
                + Add shareholder
              </button>
            </div>
            {shareholders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No shareholders with 25%+ ownership — or add them here.
              </p>
            ) : (
              <div className="space-y-4">
                {shareholders.map((s, i) => (
                  <div key={i} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Shareholder {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShareholders((arr) => arr.filter((_, j) => j !== i))}
                        className="text-xs font-semibold text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <PersonFields
                      person={s}
                      showShare
                      onChange={(p) =>
                        setShareholders((arr) => arr.map((x, j) => (j === i ? p : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {!directorIsCreator ? (
            <div className="space-y-3 rounded-md bg-brand-tint/40 p-3">
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={creatorAuthorized}
                  onChange={(e) => setCreatorAuthorized(e.target.checked)}
                  className="mt-0.5"
                />
                I hold a written authorization (power of attorney) to act for the company
              </label>
              {creatorAuthorized ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FilePick label="Your ID document" value={creatorIdDoc} onChange={setCreatorIdDoc} />
                  <FilePick
                    label="Authorization / PoA document"
                    value={authorizationDoc}
                    onChange={setAuthorizationDoc}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitKyc}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Submit KYB questionnaire
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Verification documents while the registration is pending */}
      {request.status === "pending" ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Verification documents</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {request.partnerType === "realtor"
              ? "Upload your personal ID document and copies of the personal real estate licences you listed (not the company licence) to speed up the review of your registration."
              : "Upload your ID and license documents to speed up the review of your registration."}
          </p>
          {request.verificationDocs.length ? (
            <ul className="mt-2 space-y-1">
              {request.verificationDocs.map((d) => (
                <li key={d} className="text-xs text-foreground">
                  📎 {d}
                </li>
              ))}
            </ul>
          ) : null}
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-brand">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                addDocs(names);
                e.target.value = "";
              }}
            />
            + Upload documents
          </label>
        </div>
      ) : null}
    </section>
  );
}
