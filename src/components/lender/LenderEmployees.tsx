import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { isMemberOnVacation, LENDER_ROLE_LABEL, useLenderTeam, type LenderMember } from "@/lib/lender-team";
import { isOpenRequest, useLeads, type MortgageLead } from "@/lib/leads";
import { formatDate } from "@/lib/dates";
import { memberStats } from "@/components/lender/LenderAnalytics";

function MemberBadges({ member }: { member: LenderMember }) {
  const onVacation = isMemberOnVacation(member);
  return (
    <div className="flex flex-wrap gap-1.5">
      {onVacation ? (
        <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[11px] font-semibold text-gold">
          On vacation
        </span>
      ) : (
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
          Active
        </span>
      )}
      {member.allStates ? (
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
          All states
        </span>
      ) : (
        member.states.map((s) => (
          <span key={s} className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
            {s}
          </span>
        ))
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function MemberDetail({
  member,
  leads,
  canSeeLeads,
}: {
  member: LenderMember;
  leads: MortgageLead[];
  canSeeLeads: boolean;
}) {
  const stats = memberStats(leads, member.id);
  const mine = leads.filter((l) => l.assignedToId === member.id);
  const openFiles = mine.filter(isOpenRequest);
  const closedFiles = mine.filter((l) => !isOpenRequest(l));

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">{member.name}</h2>
        <p className="text-sm text-muted-foreground">{member.email}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {LENDER_ROLE_LABEL[member.role]}
        </p>
      </div>

      <MemberBadges member={member} />

      {member.licenses.length ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Licences
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {member.licenses.map((l, i) => (
              <li
                key={`${l.state}-${i}`}
                className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand"
              >
                {l.state} · {l.number}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Performance (all time)
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Open files" value={String(openFiles.length)} />
          <StatPill label="Completed files" value={String(closedFiles.length)} />
          <StatPill label="Qualified" value={String(stats.qualified)} />
          <StatPill label="Disqualified" value={String(stats.notQualified)} />
          <StatPill label="Info requested" value={String(stats.infoRequested)} />
          <StatPill label="In process" value={String(stats.inProcess)} />
          <StatPill label="Pre-approvals" value={String(stats.preApprovals)} />
          <StatPill
            label="Avg. response"
            value={stats.avgResponse ? `${stats.avgResponse.toFixed(1)}h` : "—"}
          />
        </div>
      </div>

      {canSeeLeads ? (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assigned leads ({mine.length})
          </div>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads assigned yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {mine.map((l) => (
                <li key={l.id}>
                  <Link
                    to="/lender/file/$leadId"
                    params={{ leadId: l.id }}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-brand-tint/40"
                  >
                    <span className="font-semibold text-foreground">{l.clientName}</span>
                    <span className="text-xs text-muted-foreground">{l.propertyLabel}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(l.submittedAt)}</span>
                    <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                      {l.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Lead-level detail is only visible to company admins and the assigned member.
        </p>
      )}
    </div>
  );
}

export function LenderEmployees() {
  const { members, active } = useLenderTeam();
  const { leads } = useLeads();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isAdmin = active?.role === "admin";
  const selected = members.find((m) => m.id === selectedId) ?? null;

  const rows = useMemo(
    () =>
      members.map((m) => {
        const mine = leads.filter((l) => l.assignedToId === m.id);
        const open = mine.filter(isOpenRequest);
        const closed = mine.filter((l) => !isOpenRequest(l));
        const stats = memberStats(leads, m.id);
        return { member: m, open: open.length, closed: closed.length, avgResponse: stats.avgResponse };
      }),
    [members, leads],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Full roster with individual performance for every seat in your company."
            : "Your team roster. Detailed statistics and assigned files are visible for your own seat."}
        </p>
      </div>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Licensed states</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Open files</th>
              <th className="px-4 py-2.5">Completed</th>
              <th className="px-4 py-2.5">Avg. response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ member, open, closed, avgResponse }) => (
              <tr
                key={member.id}
                className={`cursor-pointer transition-colors hover:bg-brand-tint/40 ${
                  active?.id === member.id ? "bg-gold-tint/30" : ""
                }`}
                onClick={() => setSelectedId(member.id)}
              >
                <td className="px-4 py-2.5 font-semibold text-foreground">
                  {member.name}
                  {active?.id === member.id ? (
                    <span className="ml-1.5 text-[11px] font-semibold text-gold">You</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {LENDER_ROLE_LABEL[member.role]}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {member.allStates
                    ? "All states"
                    : member.licenses.length
                      ? member.licenses.map((l) => `${l.state} (${l.number})`).join(", ")
                      : member.states.join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5">
                  {isMemberOnVacation(member) ? (
                    <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[11px] font-semibold text-gold">
                      On vacation
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-foreground">{open}</td>
                <td className="px-4 py-2.5 text-foreground">{closed}</td>
                <td className="px-4 py-2.5 text-foreground">
                  {avgResponse ? `${avgResponse.toFixed(1)}h` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No team members configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {selected ? (
        <MemberDetail
          member={selected}
          leads={leads}
          canSeeLeads={isAdmin || active?.id === selected.id}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Select a team member above to view their full profile and statistics.
        </p>
      )}
    </div>
  );
}
