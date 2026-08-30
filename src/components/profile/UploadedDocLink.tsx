import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "partner-documents";

function displayName(path: string) {
  const base = path.split("/").pop() ?? path;
  // Paths are stored as `<uuid>-<originalFileName>`; strip the uuid prefix.
  if (base.length > 37 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base.slice(0, 36)) && base[36] === "-") {
    return base.slice(37);
  }
  return base;
}

export function UploadedDocLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isStorage = path.includes("/");
  const name = displayName(path);

  useEffect(() => {
    if (!isStorage) return;
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) setFailed(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path, isStorage]);

  if (!isStorage) {
    return <span className="text-xs text-muted-foreground">📎 {path}</span>;
  }
  if (failed) {
    return <span className="text-xs text-muted-foreground">📎 {name}</span>;
  }
  if (!url) {
    return <span className="text-xs text-muted-foreground">📎 {name} — preparing…</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
    >
      📎 {name}
    </a>
  );
}
