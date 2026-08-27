import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google/return")({
  component: OAuthReturn,
  head: () => ({
    meta: [
      { title: "Finishing Google connection — Loqal" },
      {
        name: "description",
        content: "Completing the secure Google Calendar connection for your Loqal workspace.",
      },
      { property: "og:title", content: "Finishing Google connection" },
      {
        property: "og:description",
        content: "Completing the secure Google Calendar connection for your Loqal workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/**
 * Landing page of the Google consent popup. It only forwards the one-time
 * code to the opener — the connection key is exchanged and stored server-side.
 */
function OAuthReturn() {
  const [message, setMessage] = useState("Finishing the Google connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google did not complete the connection.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google completed without an exchange code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
