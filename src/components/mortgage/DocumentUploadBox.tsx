import { useState } from "react";
import { uid } from "@/lib/mortgage-form";

export type PendingDocument = { id: string; name: string; url: string };

/**
 * Staged multi-file upload used after the questionnaire is submitted: the
 * client can add, remove and re-add files, and nothing is shared with the
 * lending partner until they explicitly confirm.
 */
export function DocumentUploadBox({
  title,
  description,
  confirmLabel = "Confirm and share documents",
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: (docs: PendingDocument[]) => void;
}) {
  const [docs, setDocs] = useState<PendingDocument[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="rounded-lg border border-brand/40 bg-brand-tint/50 p-5 text-left">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {confirmed ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-success">Documents confirmed and shared.</p>
          <ul className="mt-1 text-xs text-muted-foreground">
            {docs.map((doc) => (
              <li key={doc.id}>📎 {doc.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint">
            {docs.length ? "Add more documents" : "Choose documents"}
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const selected = Array.from(e.target.files ?? []);
                const next = await Promise.all(
                  selected.map(async (file) => ({
                    id: uid(),
                    name: file.name,
                    url: await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve(typeof reader.result === "string" ? reader.result : "");
                      reader.readAsDataURL(file);
                    }),
                  })),
                );
                setDocs((current) => [...current, ...next]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {docs.length ? (
            <>
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs"
                  >
                    <span className="text-foreground">📎 {doc.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocs((d) => d.filter((item) => item.id !== doc.id))}
                      className="font-semibold text-destructive"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Review the files above. They are not shared until you confirm.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfirm(docs);
                  setConfirmed(true);
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                {confirmLabel}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
