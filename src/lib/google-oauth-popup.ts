/**
 * Browser-side popup helper for the Google Calendar app-user OAuth flow.
 * Secret-free: it only shuttles the one-time code back to the opener, which
 * hands it to an authenticated server function.
 */
const CONNECTOR_ID = "google_calendar";

function waitForCompletion(popup: Window): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (event.data as { connectorId?: string } | null)?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) {
        return;
      }
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        const code = (event.data as { code?: string | null }).code;
        resolve(typeof code === "string" ? code : null);
        return;
      }
      popup.close();
      reject(new Error("Google connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window was closed before the connection finished."));
    }, 500);
  });
}

/**
 * Opens the Google consent popup and resolves with the one-time exchange code
 * (or null when the workspace client issues no offline key).
 */
export async function runGoogleConnectPopup(
  start: () => Promise<{ authorizationUrl: string }>,
): Promise<string | null> {
  const popup = window.open("", "loqal-google-oauth", "width=600,height=720");
  if (!popup) throw new Error("Popup blocked. Allow popups for Loqal and try again.");
  try {
    const { authorizationUrl } = await start();
    const completion = waitForCompletion(popup);
    popup.location.href = authorizationUrl;
    return await completion;
  } catch (error) {
    popup.close();
    throw error;
  }
}
