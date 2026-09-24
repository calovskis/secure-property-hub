/**
 * Storage of the actual purchase agreement files the buyer's agent uploads.
 *
 * The entity plan only carries the file name; the bytes live here so the buyer
 * (and anyone reviewing the file) can download the uploaded copy of the
 * agreement. Files are kept per lead (one per property purchase file).
 */

const KEY = "loqal.agreement-files.v1";

export type StoredAgreementFile = {
  name: string;
  type: string;
  /** Data URL with the file contents. */
  dataUrl: string;
  savedAt: string;
};

type Store = Record<string, StoredAgreementFile>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* Quota exceeded — the name still shows, only the download is unavailable. */
  }
}

/** Read a file input selection and keep the uploaded copy for this lead. */
export async function storeAgreementFile(leadId: string, file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const store = read();
  store[leadId] = {
    name: file.name,
    type: file.type || "application/octet-stream",
    dataUrl,
    savedAt: new Date().toISOString(),
  };
  write(store);
}

export function getAgreementFile(leadId: string): StoredAgreementFile | undefined {
  return read()[leadId];
}

/** Trigger a browser download of the stored copy. Returns false when absent. */
export function downloadAgreementFile(leadId: string, fallbackName = "purchase-agreement") {
  const stored = getAgreementFile(leadId);
  if (!stored) return false;
  const a = document.createElement("a");
  a.href = stored.dataUrl;
  a.download = stored.name || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
