/**
 * Storage of the actual licence copy files partners attach.
 *
 * The licence rows themselves only carry the file name; the bytes live here so
 * a Loqal admin can download and look at the copy while verifying the state
 * licence. Files are kept per partner + state.
 */

const KEY = "loqal.licence-files.v1";

export type StoredLicenceFile = {
  name: string;
  type: string;
  /** Data URL with the file contents. */
  dataUrl: string;
  savedAt: string;
};

type Store = Record<string, StoredLicenceFile>;

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

export function licenceFileKey(ownerEmail: string, state: string) {
  return `${ownerEmail.toLowerCase()}::${state.toUpperCase()}`;
}

/** Read a file input selection and keep it for the given partner + state. */
export async function storeLicenceFile(ownerEmail: string, state: string, file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const store = read();
  store[licenceFileKey(ownerEmail, state)] = {
    name: file.name,
    type: file.type || "application/octet-stream",
    dataUrl,
    savedAt: new Date().toISOString(),
  };
  write(store);
}

export function getLicenceFile(ownerEmail: string, state: string): StoredLicenceFile | undefined {
  return read()[licenceFileKey(ownerEmail, state)];
}

/** Trigger a browser download of the stored copy. Returns false when absent. */
export function downloadLicenceFile(ownerEmail: string, state: string) {
  const stored = getLicenceFile(ownerEmail, state);
  if (!stored) return false;
  const a = document.createElement("a");
  a.href = stored.dataUrl;
  a.download = stored.name || `${state}-licence`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
