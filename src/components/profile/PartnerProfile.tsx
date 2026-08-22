import { PARTNER_LABEL, fullName, type LoqalUser } from "@/lib/auth";
import { getTeamSnapshot, LENDER_ROLE_LABEL } from "@/lib/lender-team";
import { useLeads } from "@/lib/leads";
import { RealtorProfileCard } from "@/components/profile/RealtorProfileCard";

function avgResponseHours(items: { submittedAt: string; decidedAt?: string }[]) {
  const done = items.filter((l) => l.decidedAt);
  if (!done.length) return null;
  const totalMs = done.reduce(
    (sum, l) => sum + (new Date(l.decidedAt!).getTime() - new Date(l.submittedAt).getTime()),
    0,
  );
  return totalMs / done.length / 3600000;
}

export function PartnerProfile({ user }: { user: LoqalUser }) {
  if (user.partnerType === "realtor") return <RealtorProfileCard user={user} />;
  return <LenderPartnerProfile user={user} />;
}

function LenderPartnerProfile({ user }: { user: LoqalUser }) {
  const { leads } = useLeads();
  const snapshot = getTeamSnapshot();
  const member = snapshot.members.find((m) => m.email === user.email) ?? snapshot.members[0];

  const mine = member ? leads.filter((l) => l.assignedToId === member.id) : [];
  const completed = mine.filter(
    (l) => (l.status === "qualified" || l.status === "not_qualified") && l.decidedAt,
  );
  const open = mine.filter((l) => l.status === "new" || l.status === "info_required");
  const avgHours = avgResponseHours(mine);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Partner details</h2>
        <div className="mt-3">
          <Row label="Company" value={user.companyName} />
          <Row label="Partner type" value={user.partnerType ? PARTNER_LABEL[user.partnerType] : undefined} />
          {member ? (
            <>
              <Row label="Role" value={LENDER_ROLE_LABEL[member.role]} />
              <Row
                label="Licensed states"
                value={
                  member.allStates
                    ? "All states"
                    : member.licenses.map((l) => `${l.state} (${l.number})`).join(", ") || "None on file"
                }
              />
              <Row label="Vacation mode" value={member.vacationFrom && member.vacationUntil ? "Active" : "Off"} />
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">My work stats</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Assigned" value={mine.length} />
          <Stat label="Open / in process" value={open.length} />
          <Stat label="Completed" value={completed.length} />
          <Stat label="Avg. response" value={avgHours !== null ? `${avgHours.toFixed(1)}h` : "—"} />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <div className="text-lg font-bold text-brand">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
