import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { PARTNER_LABEL, fullName, useAuth, type PartnerType } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { PartnerRequestDialog } from "@/components/admin/PartnerRequestDialog";
import { PersonDetail } from "@/components/admin/PersonDetail";
import { useAdminPeople } from "@/components/admin/people-model";
import { US_STATES, US_STATE_CODES } from "@/data/us-states";
import { uid } from "@/lib/mortgage-form";
import { useRealtors } from "@/lib/realtors";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { toast } from "sonner";

/**
 * Open partner registration requests, opened from the admin dashboard in a
 * new tab. Pending requests are listed oldest → newest so nothing sits in
 * the queue too long, and can be filtered by partner type.
 */
export const Route = createFileRoute("/admin-partner-requests")({
  component: AdminPartnerRequestsPage,
  head: () => ({
    meta: [
      { title: "Open Partner Requests — Loqal Admin" },
      {
        name: "description",
        content: "Pending partner and corporate registrations awaiting Loqal approval.",
      },
      { property: "og:title", content: "Open Partner Requests — Loqal Admin" },
      {
        property: "og:description",
        content: "Pending partner and corporate registrations awaiting Loqal approval.",
      },
    ],
  }),
});

type TypeFilter = "all" | PartnerType | "corporate";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "realtor", label: PARTNER_LABEL.realtor },
  { id: "lender", label: PARTNER_LABEL.lender },
  { id: "cleaning", label: PARTNER_LABEL.cleaning },
  { id: "other", label: PARTNER_LABEL.other },
  { id: "corporate", label: "Corporate" },
];

function typeOf(r: PartnerRequest): TypeFilter {
  return r.kind === "corporate" ? "corporate" : (r.partnerType ?? "other");
}

/** Two-letter USPS code for a state stored either as a name or a code. */
function stateAbbr(s: string): string {
  if (s.length === 2) return s.toUpperCase();
  const i = US_STATES.findIndex((n) => n.toLowerCase() === s.trim().toLowerCase());
  return i >= 0 ? (US_STATE_CODES[i] as string) : s;
}

/**
 * Compact coverage summary: state-code bubbles instead of full licence rows.
 * "All states" covers everything; more than 40 states reads as
 * "All states, except …" listing only where the partner has no presence.
 */
function CoverageBubbles({ r }: { r: PartnerRequest }) {
  if (r.allStates) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Licences:</span>
        <span className="rounded bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
          All states
        </span>
      </div>
    );
  }
  const codes = [
    ...new Set((r.realtorLicenses ?? []).map((l) => stateAbbr(l.state)).filter(Boolean)),
  ];
  if (!codes.length) return null;

  if (codes.length > 40) {
    const missing = US_STATE_CODES.filter((c) => !codes.includes(c));
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Licences:</span>
        <span className="rounded bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
          All states{missing.length ? `, except ${missing.join(", ")}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground">Licences:</span>
      {codes.map((c) => (
        <span
          key={c}
          className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function AdminPartnerRequestsPage() {
  const { user, ready } = useAuth();
  const { requests, setStatus, updateRequest } = usePartnerRequests();
  const [ask, setAsk] = useState<{ request: PartnerRequest; kind: "info" | "call" } | null>(null);
  const { addRealtor } = useRealtors();
  const [filter, setFilter] = useState<TypeFilter>("all");
  const people = useAdminPeople();
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const profilePerson = profileKey ? people.find((p) => p.key === profileKey) : undefined;

  const pending = useMemo(
    () =>
      requests
        .filter((r) => r.status === "pending")
        .filter((r) => filter === "all" || typeOf(r) === filter)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)), // oldest first
    [requests, filter],
  );

  if (!ready) return <div className="min-h-screen bg-background" />;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Home" />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is limited to Loqal employees.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background"
          >
            Go to sign in
          </Link>
        </main>
      </div>
    );
  }

  function approve(r: PartnerRequest) {
    setStatus(r.id, "approved");
    logActivity("Loqal admin", "approved a partner registration", r.companyName);
    toast("Partner approved", { description: r.companyName });
    if (r.partnerType === "realtor") {
      addRealtor({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        address: { street: r.street, city: r.city, state: r.state, zip: r.zip, country: r.country },
        licenses: r.realtorLicenses ?? [],
        languages: r.languages ?? ["English"],
        approvedAt: new Date().toISOString(),
      });
    }
  }

  function sendAdminRequest(r: PartnerRequest, kind: "info" | "call", message: string, requiresDocument: boolean) {
    updateRequest(r.id, {
      adminRequests: [
        ...(r.adminRequests ?? []),
        {
          id: uid(),
          kind,
          message,
          ...(kind === "info" ? { requiresDocument } : {}),
          requestedAt: new Date().toISOString(),
          requestedBy: fullName(user!),
        },
      ],
    });
    notify({
      id: `partner-admin-request-${r.id}-${Date.now()}`,
      to: r.email.toLowerCase(),
      title: kind === "info" ? "Loqal requested more information" : "Loqal requested a video call",
      body: message,
      href: "/profile",
      severity: "warning",
    });
    logActivity(
      "Loqal admin",
      kind === "info" ? "requested more information from a partner" : "requested a video call with a partner",
      r.companyName,
    );
    toast(kind === "info" ? "Information requested" : "Video call requested", {
      description: `${r.companyName} will see it in their Loqal profile.`,
    });
  }

  function decline(r: PartnerRequest) {
    setStatus(r.id, "declined");
    logActivity("Loqal admin", "declined a partner registration", r.companyName);
    toast("Partner declined", { description: r.companyName });
  }

  function decideChange(r: PartnerRequest, changeId: string, approved: boolean) {
    const change = r.profileChangeRequests.find((c) => c.id === changeId);
    if (!change) return;
    const decidedAt = new Date().toISOString();
    updateRequest(r.id, {
      profileChangeRequests: r.profileChangeRequests.map((c) =>
        c.id === changeId ? { ...c, status: approved ? "approved" : "declined", decidedAt } : c,
      ),
      ...(approved ? { [change.field]: change.requestedValue } : {}),
    });
    notify({
      id: `partner-change-${changeId}`,
      to: r.email.toLowerCase(),
      title: approved ? "Loqal approved your profile change" : "Loqal declined your profile change",
      body: `${change.label}: ${change.currentValue || "—"} → ${change.requestedValue}`,
      href: "/profile",
      severity: approved ? "info" : "warning",
    });
    logActivity(
      "Loqal admin",
      approved ? "approved a partner profile change" : "declined a partner profile change",
      `${r.companyName} · ${change.label}`,
    );
    toast(approved ? "Change approved" : "Change declined", { description: r.companyName });
  }

  const pendingChanges = requests.flatMap((r) =>
    (r.profileChangeRequests ?? [])
      .filter((c) => c.status === "pending")
      .map((c) => ({ request: r, change: c })),
  );

  const counts = new Map<TypeFilter, number>();
  for (const r of requests.filter((x) => x.status === "pending")) {
    counts.set(typeOf(r), (counts.get(typeOf(r)) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader navSlot={<AdminNav tab={"partners"} />} />
      <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-7">
        <div className="mb-6">
          <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
            {pending.length} open
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
            Open partner requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending registrations, oldest first — {fullName(user)}, approve or decline each request.
          </p>
        </div>

        {pendingChanges.length ? (
          <section className="mb-6 rounded-lg border border-gold/40 bg-gold-tint/30 p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Profile change requests · {pendingChanges.length} awaiting approval
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Name, surname and company name appear on the Loqal agreement, so partners cannot
              change them on their own.
            </p>
            <ul className="mt-3 space-y-2">
              {pendingChanges.map(({ request: r, change: c }) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
                >
                  <div className="text-xs text-muted-foreground">
                    <span className="text-sm font-semibold text-foreground">{r.companyName}</span> ·{" "}
                    {c.label}: {c.currentValue || "—"} →{" "}
                    <strong className="text-foreground">{c.requestedValue}</strong> · requested{" "}
                    {formatDateTime(c.requestedAt)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideChange(r, c.id, true)}
                      className="rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decideChange(r, c.id, false)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => {
            const n = f.id === "all" ? [...counts.values()].reduce((s, v) => s + v, 0) : (counts.get(f.id) ?? 0);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f.id
                    ? "bg-brand text-background"
                    : "border border-border bg-card text-muted-foreground hover:bg-brand-tint hover:text-brand"
                }`}
              >
                {f.label}
                <span className={filter === f.id ? "opacity-80" : "text-muted-foreground/70"}>{n}</span>
              </button>
            );
          })}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No open partner requests{filter === "all" ? "" : ` in “${TYPE_FILTERS.find((f) => f.id === filter)?.label}”`}.
          </div>
        ) : (
          <ul className="space-y-4">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {r.companyName}{" "}
                      <span className="ml-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                        {r.kind === "partner" ? PARTNER_LABEL[r.partnerType ?? "other"] : "Corporate"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.firstName} {r.lastName} · {r.position} · {r.email} · {r.phone}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.street}, {r.city}
                      {r.state ? `, ${r.state}` : ""} {r.zip}, {r.country} · Reg №{" "}
                      {r.registrationNumber}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-gold">
                      Submitted {formatDateTime(r.submittedAt)} · waiting since{" "}
                      {formatDate(r.submittedAt)}
                    </div>
                    {r.allStates || r.realtorLicenses?.length ? <CoverageBubbles r={r} /> : null}
                    {r.languages?.length ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Languages: {r.languages.join(", ")}
                      </div>
                    ) : null}
                    {r.lenderLicence ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Licence: {r.lenderLicence}
                      </div>
                    ) : null}
                    {r.companyLicence ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Company licence: {r.companyLicence}
                        {r.companyPhone ? ` · Company phone: ${r.companyPhone}` : ""}
                      </div>
                    ) : null}
                    {r.adminRequests?.length ? (
                      <div className="mt-2 space-y-1.5">
                        {r.adminRequests.map((a) =>
                          a.kind === "call" && a.scheduledAt ? (
                            <div
                              key={a.id}
                              className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs"
                            >
                              <span className="font-semibold text-success">
                                ● Video call confirmed by the partner
                              </span>
                              <div className="mt-0.5 text-foreground">
                                {formatDateTime(a.scheduledAt)}
                                {a.meetUrl ? (
                                  <>
                                    {" · "}
                                    <a
                                      href={a.meetUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-semibold text-brand underline"
                                    >
                                      Join Google Meet
                                    </a>
                                  </>
                                ) : null}
                              </div>
                              <div className="mt-0.5 text-muted-foreground">
                                Requested {formatDateTime(a.requestedAt)} by {a.requestedBy}
                              </div>
                            </div>
                          ) : (
                            <div key={a.id} className="text-xs text-muted-foreground">
                              <span className="font-semibold text-brand">
                                {a.kind === "info" ? "Info requested" : "Video call requested"}
                              </span>{" "}
                              {formatDateTime(a.requestedAt)} —{" "}
                              {a.kind === "info"
                                ? a.answeredAt
                                  ? `answered ${formatDateTime(a.answeredAt)}: ${a.answer}${
                                      a.answerDocs?.length ? ` (${a.answerDocs.join(", ")})` : ""
                                    }`
                                  : "awaiting the partner's answer"
                                : "awaiting the partner to book a slot"}
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                    {r.verificationDocs.length ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Verification docs: {r.verificationDocs.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileKey(`${r.kind}-${r.id}`)}
                      className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Full profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsk({ request: r, kind: "info" })}
                      className="rounded-md border border-brand/50 bg-brand-tint px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-tint/70"
                    >
                      Request information
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsk({ request: r, kind: "call" })}
                      className="rounded-md border border-brand/50 bg-brand-tint px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-tint/70"
                    >
                      Request video call
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(r)}
                      className="rounded-md bg-success px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(r)}
                      className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {profilePerson ? (
        <PersonDetail
          person={profilePerson}
          onClose={() => setProfileKey(null)}
          onMessage={() =>
            toast("Messaging lives in People", {
              description: "Open this partner from the People section to send a message.",
            })
          }
        />
      ) : null}

      {ask ? (
        <PartnerRequestDialog
          request={ask.request}
          kind={ask.kind}
          open
          onOpenChange={(next) => {
            if (!next) setAsk(null);
          }}
          onSend={(message, requiresDocument) =>
            sendAdminRequest(ask.request, ask.kind, message, requiresDocument)
          }
        />
      ) : null}
    </div>
  );
}
