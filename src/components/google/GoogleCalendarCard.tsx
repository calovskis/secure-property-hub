import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  completeGoogleConnect,
  disconnectGoogle,
  getGoogleStatus,
  startGoogleConnect,
} from "@/lib/google-calendar.functions";
import { runGoogleConnectPopup } from "@/lib/google-oauth-popup";

/**
 * Lets a Loqal partner connect their own Google account. Once connected,
 * clients see the partner's real free/busy availability and every booking
 * lands in their Google Calendar with a Google Meet link.
 */
export function GoogleCalendarCard({
  agentRef,
  agentEmail,
}: {
  agentRef?: string | undefined;
  agentEmail?: string | undefined;
}) {
  const status = useServerFn(getGoogleStatus);
  const start = useServerFn(startGoogleConnect);
  const complete = useServerFn(completeGoogleConnect);
  const disconnect = useServerFn(disconnectGoogle);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await status();
      setConnected(res.connected);
      setAccountEmail(res.accountEmail);
    } catch {
      setConnected(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onConnect() {
    setError(null);
    setBusy(true);
    try {
      const code = await runGoogleConnectPopup(() => start());
      if (code) {
        const res = await complete({
          data: {
            code,
            ...(agentRef ? { agentRef } : {}),
            ...(agentEmail ? { agentEmail } : {}),
          },
        });
        setConnected(res.connected);
        setAccountEmail(res.accountEmail);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnect();
      setConnected(false);
      setAccountEmail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Google Calendar & Google Meet</h3>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Connect your Google account so clients only see the times you are actually free. Every
            confirmed call is created in your calendar with a Google Meet link and an invite for
            both sides.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            connected
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {connected === null ? "Checking…" : connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {connected && accountEmail ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Calendar: <span className="font-medium text-foreground">{accountEmail}</span>
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConnect()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? "Working…" : connected ? "Reconnect Google" : "Connect Google Calendar"}
        </button>
        {connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDisconnect()}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint disabled:opacity-50"
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </section>
  );
}
