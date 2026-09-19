/**
 * KYB (Know Your Business) summary card for partners and corporate accounts.
 * The questionnaire itself opens as a step-by-step pop-up window
 * (KybQuestionnaireDialog). While a registration is still pending, the partner
 * can also upload verification documents (ID / licences) here.
 */
import { useState } from "react";
import { fullName, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";
import { toast } from "sonner";
import { KybQuestionnaireDialog, type KybDraft } from "./KybQuestionnaireDialog";

export function KybCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const [open, setOpen] = useState(false);

  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  if (!request) return null;
  const kyc = request.kyc;

  function submitKyc(draft: KybDraft) {
    if (!request) return;
    updateRequest(request.id, {
      kyc: {
        director: draft.director,
        directorIsCreator: draft.directorIsCreator,
        shareholders: draft.shareholders,
        creatorAuthorized: draft.creatorAuthorized,
        ...(draft.creatorIdDoc ? { creatorIdDoc: draft.creatorIdDoc } : {}),
        ...(draft.authorizationDoc ? { authorizationDoc: draft.authorizationDoc } : {}),
        submittedAt: new Date().toISOString(),
      },
    });
    logActivity(fullName(user), "submitted the KYB questionnaire", request.companyName);
    toast("KYB questionnaire submitted", {
      description: "Loqal compliance will review the director and shareholder information.",
    });
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
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Tell us who directs and owns {request.companyName}: the director and every shareholder
            with 25% or more, each with an ID document. The questionnaire opens in a window and
            takes four short steps — your answers are saved as you go.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Complete the KYB questionnaire
          </button>
        </div>
      )}

      <KybQuestionnaireDialog
        open={open}
        onOpenChange={setOpen}
        user={user}
        request={request}
        onSubmit={submitKyc}
      />

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
