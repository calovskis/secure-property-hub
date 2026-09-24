/**
 * Purchase agreement files uploaded by the buyer's agent.
 * Stored in private backend file storage under `<leadId>/current`, so the
 * buyer (on any device) can download the copy the agent uploaded.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "purchase-agreements";
const pathFor = (leadId: string) => `${leadId}/current`;

/** Upload the selected file as the current agreement copy for this lead. */
export async function storeAgreementFile(leadId: string, file: File) {
  const { error } = await supabase.storage.from(BUCKET).upload(pathFor(leadId), file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
    metadata: { name: file.name },
  });
  if (error) throw error;
}

/** Download the stored copy. Returns false when it cannot be found. */
export async function downloadAgreementFile(leadId: string, fileName = "purchase-agreement") {
  const { data, error } = await supabase.storage.from(BUCKET).download(pathFor(leadId));
  if (error || !data) return false;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
