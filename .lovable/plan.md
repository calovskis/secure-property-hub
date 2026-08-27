# Google Calendar + Google Meet for buyer-agent calls

Replace the simulated slot picker and in-platform video call with real Google
Calendar scheduling and Google Meet links, Deel-style: the agent connects their
own Google account once, clients book against that agent's real free/busy, and
every booking becomes a Google Calendar event with a Meet link and invites for
both sides.

## How it will work

1. **Agent connects Google** — in the Realtor portal a "Connect Google Calendar"
   card starts Google consent. Each partner connects their *own* account, so
   availability and events live in their real calendar.
2. **Real availability** — the client's slot picker (buyer-agent dialog, video
   tour and visit requests) asks Google for the agent's busy times over the next
   two weeks and only shows genuinely free 1-hour weekday slots.
3. **Booking creates a Google event** — confirming a slot creates a Calendar
   event on the agent's calendar with the client as attendee, a Google Meet
   conference link, the property address and the case reference. Both sides get
   the standard Google invite and reminders.
4. **Meet replaces the in-platform call** — the "Join the call" button opens the
   Google Meet link for intro calls and live video showcasing. The recording /
   AI-transcript notice stays, pointing at Meet recording.
5. **Changes sync back** — reschedules and cancellations made in Loqal update the
   Google event; the Loqal timeline shows the event link and status.
6. **Not connected yet** — if an agent has not connected Google, clients see the
   current Loqal slot picker as a fallback and the agent is prompted to connect.

## Prerequisites (important)

Two things must be in place before Google can work for real, because Google
consent has to be tied to a real, persistent user account:

- **Real accounts + login.** Today sign-in is a local demo (data lives in the
  browser). We enable Lovable Cloud and move sign-in to real accounts so each
  partner has a stable identity.
- **A Google OAuth client.** You (or a workspace admin) create a Google Cloud
  OAuth client and connect it to this project through Lovable's Google Calendar
  app-user connector. I will open that setup card during implementation. The
  redirect URI to register is
  `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.

If you would rather not move to real accounts yet, I can build the whole Google
layer against a single Loqal Google account instead — simpler, but all calls
land in one shared calendar rather than each agent's own.

## Technical outline

- Enable Lovable Cloud; auth via Supabase; `src/lib/auth.tsx` backed by real
  sessions instead of localStorage.
- Link the `google_calendar` app-user connector; scopes: `calendar.events`,
  `calendar.readonly`, `userinfo.email`, `userinfo.profile`.
- Server-only helpers: `src/server/appUserConnector.ts` (consent + gateway
  calls), `src/server/connectionKeyCrypto.ts` (AES-GCM using
  `APP_USER_CONNECTION_KEY_SECRET`), `app_user_connections` table storing each
  agent's encrypted connection key.
- Server functions in `src/lib/google-calendar.functions.ts`:
  `getAgentFreeBusy`, `createMeetEvent`, `updateEvent`, `cancelEvent`,
  `getGoogleConnectionStatus`, `disconnectGoogle` — all via the connector
  gateway (`/calendar/v3/...`, `conferenceDataVersion=1` for Meet links).
- `src/lib/buyer-process.ts`: `availableSlots` reads Google free/busy when the
  agent is connected; `CallBooking` gains `googleEventId`, `meetUrl`,
  `htmlLink`.
- UI: `CallScheduler.tsx` shows real slots + connection state;
  `BuyerAgentDialog.tsx` and the video-tour/visit flows show the Meet link;
  `VideoCallDialog.tsx` becomes a Meet launcher with the consent notice;
  Realtor portal gets a Google connection card.
