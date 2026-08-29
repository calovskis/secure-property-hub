import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { PARTNER_LABEL, fullName, useAuth, type PartnerType } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { PartnerRequestDialog } from "@/components/admin/PartnerRequestDialog";
import { uid } from "@/lib/mortgage-form";
import { useRealtors } from "@/lib/realtors";
import { logActivity } from "@/lib/activity";
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

function AdminPartnerRequestsPage() {
  const { user, ready } = useAuth();
  const { requests, setStatus, updateRequest } = usePartnerRequests();
  const [ask, setAsk] = useState<{ request: PartnerRequest; kind: "info" | "call" } | null>(null);
  const { addRealtor } = useRealtors();
  const [filter, setFilter] = useState<TypeFilter>("all");

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
                    {r.realtorLicenses?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.realtorLicenses.map((l) => (
                          <span
                            key={l.state}
                            className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                          >
                            {l.state} · {l.number} · valid till {formatDate(l.validUntil)}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                      <div className="mt-2 space-y-1">
                        {r.adminRequests.map((a) => (
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
                              : a.scheduledAt
                                ? `booked ${formatDateTime(a.scheduledAt)}`
                                : "awaiting the partner to book a slot"}
                          </div>
                        ))}
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
