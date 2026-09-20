import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { MortgageLead } from "@/lib/leads";
import { buildMismoXml, downloadTextFile, exportFileName } from "@/lib/mismo-export";
import { downloadClientFilePdf } from "@/lib/client-file-pdf";
import { usePurchaseProgress } from "@/lib/purchase-stage";

/**
 * Hands the whole client file to a lending partner's loan origination system:
 * a printable PDF summary and a MISMO v3.4 (ULAD/URLA) XML import file.
 * Only lending partners and Loqal admins see it.
 */
export function ClientFileTransfer({ lead }: { lead: MortgageLead }) {
  const { user } = useAuth();
  const { progressOf } = usePurchaseProgress();
  const [busy, setBusy] = useState<"pdf" | "xml" | null>(null);

  const allowed =
    user?.role === "admin" || (user?.role === "partner" && user.partnerType === "lender");
  if (!allowed) return null;

  const progress = progressOf(lead.id);

  async function pdf() {
    setBusy("pdf");
    try {
      await downloadClientFilePdf(lead, progress);
    } catch (e) {
      console.error("Client file PDF failed", e);
      toast.error("The client file could not be prepared — please try again or contact Loqal support.");
    } finally {
      setBusy(null);
    }
  }

  function xml() {
    setBusy("xml");
    try {
      downloadTextFile(
        exportFileName(lead, "xml"),
        buildMismoXml(lead, { progress }),
        "application/xml",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-brand/40 bg-brand-tint/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">Download the full client file</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Transfer the file straight into your loan origination system instead of retyping it. The XML
        follows the MISMO v3.4 (ULAD/URLA) standard used by Encompass, Calyx Point, Byte and the
        agency automated underwriting systems; the PDF is the same file for reading and your credit
        folder. Both include the borrower, address and employment history, income, assets,
        liabilities, declarations, documents, the issued terms and the Loqal client ID.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={pdf}
          disabled={busy !== null}
          className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          {busy === "pdf" ? "Preparing…" : "Download client file (PDF)"}
        </button>
        <button
          type="button"
          onClick={xml}
          disabled={busy !== null}
          className="rounded-md border border-brand px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-tint disabled:opacity-50"
        >
          {busy === "xml" ? "Preparing…" : "Download MISMO 3.4 file (XML)"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Confidential — the downloaded file carries the borrower's personal and financial data and
        must stay inside your company's secure systems.
      </p>
    </section>
  );
}
