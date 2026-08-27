/**
 * Google Calendar / Google Meet server functions.
 *
 * Thin wrappers only — every runtime helper lives in server-only modules that
 * are imported inside the handlers, so nothing server-side leaks into the
 * browser bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoogleConnectionStatus = {
  connected: boolean;
  accountEmail: string | null;
};

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleConnectionStatus> => {
    const { getConnectionForUser } = await import("@/server/appUserConnections.server");
    const conn = await getConnectionForUser(context.userId, "google_calendar");
    return { connected: Boolean(conn), accountEmail: conn?.accountEmail ?? null };
  });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientAPIKey) {
      throw new Error(
        "Google Calendar is not configured yet — the workspace connector client is missing.",
      );
    }
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, GOOGLE_CALENDAR_SCOPES } = await import(
      "@/server/googleCalendar.server"
    );
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const existing = await getConnectionKeyForUser(context.userId, "google_calendar");

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: "google_calendar",
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_CALENDAR_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; agentRef?: string; agentEmail?: string }) => input)
  .handler(async ({ data, context }): Promise<GoogleConnectionStatus> => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, fetchAccountEmail } = await import(
      "@/server/googleCalendar.server"
    );
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== "google_calendar") {
      throw new Error("OAuth completion returned the wrong connector");
    }
    const accountEmail = await fetchAccountEmail(connectionAPIKey);
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey, {
      agentRef: data.agentRef ?? null,
      agentEmail: data.agentEmail ?? null,
      accountEmail,
    });
    return { connected: true, accountEmail };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, "google_calendar");
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      const { GATEWAY_BASE_URL } = await import("@/server/googleCalendar.server");
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: "google_calendar",
      });
      await deleteConnectionForUser(context.userId, "google_calendar");
    }
    return { connected: false };
  });

/** Real free/busy availability of a Loqal buyer's agent, for the slot picker. */
export const getAgentAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentRef?: string; agentEmail?: string }) => input)
  .handler(async ({ data }) => {
    const { getConnectionForAgent } = await import("@/server/appUserConnections.server");
    const conn = await getConnectionForAgent("google_calendar", {
      agentRef: data.agentRef,
      agentEmail: data.agentEmail,
    });
    if (!conn) return { connected: false as const, days: [] };
    const { buildAvailability } = await import("@/server/googleCalendar.server");
    return { connected: true as const, days: await buildAvailability(conn.connectionAPIKey) };
  });

/** Creates the appointment in the agent's Google Calendar with a Meet link. */
export const bookAgentMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      agentRef?: string;
      agentEmail?: string;
      startAt: string;
      durationMin?: number;
      summary: string;
      description?: string;
      location?: string;
      attendeeEmails?: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { getConnectionForAgent } = await import("@/server/appUserConnections.server");
    const conn = await getConnectionForAgent("google_calendar", {
      agentRef: data.agentRef,
      agentEmail: data.agentEmail,
    });
    if (!conn) throw new Error("This agent has not connected their Google Calendar yet.");
    const { createMeetEvent } = await import("@/server/googleCalendar.server");
    return createMeetEvent(conn.connectionAPIKey, {
      startAt: data.startAt,
      durationMin: data.durationMin ?? 60,
      summary: data.summary,
      description: data.description ?? "",
      location: data.location ?? "",
      attendeeEmails: data.attendeeEmails ?? [],
    });
  });

export const cancelAgentMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { agentRef?: string; agentEmail?: string; eventId: string }) => input)
  .handler(async ({ data }) => {
    const { getConnectionForAgent } = await import("@/server/appUserConnections.server");
    const conn = await getConnectionForAgent("google_calendar", {
      agentRef: data.agentRef,
      agentEmail: data.agentEmail,
    });
    if (!conn) return { cancelled: false };
    const { cancelMeetEvent } = await import("@/server/googleCalendar.server");
    await cancelMeetEvent(conn.connectionAPIKey, data.eventId);
    return { cancelled: true };
  });
