/**
 * Verification ownership & progress for one partner registration: which Loqal
 * employee is reviewing the case and how far the verification has moved. The
 * stage is deliberately coarse so employees without access to the partner's
 * file still see where the case stands.
 */
import {
  REVIEW_STAGES,
  REVIEW_STAGE_LABEL,
  REVIEW_STAGE_PROGRESS,
  type PartnerRequest,
  type ReviewStage,
} from "@/lib/partner-requests";
import { formatDateTime } from "@/lib/dates";
import { useStaff } from "@/lib/staff";

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Small "who is reviewing" chip, safe to show anywhere in the admin console. */
export function ReviewerMark({ r }: { r: PartnerRequest }) {
  const stage = r.reviewStage ?? "unassigned";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {r.reviewerName ? (
        <>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-background">
            {initialsOf(r.reviewerName)}
          </span>
          {r.reviewerName}
        </>
      ) : (
        <span className="text-gold">Unassigned</span>
      )}
      <span className="text-muted-foreground/60">·</span>
      <span className="text-foreground">{REVIEW_STAGE_LABEL[stage]}</span>
    </span>
  );
}

export function ReviewProgressBar({ stage }: { stage: ReviewStage }) {
  const pct = REVIEW_STAGE_PROGRESS[stage] ?? 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${stage === "on_hold" ? "bg-gold" : "bg-brand"}`}
        style={{ width: `${Math.max(pct, 4)}%` }}
      />
    </div>
  );
}

export function PartnerReviewBar({
  r,
  onChange,
}: {
  r: PartnerRequest;
  onChange: (patch: Partial<PartnerRequest>) => void;
}) {
  const { members } = useStaff();
  const stage = r.reviewStage ?? "unassigned";

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Verification owner
        </span>
        <select
          value={r.reviewerId ?? ""}
          onChange={(e) => {
            const member = members.find((m) => m.id === e.target.value);
            onChange({
              reviewerId: member?.id ?? undefined,
              reviewerName: member?.name ?? undefined,
              reviewStage: member && stage === "unassigned" ? "assigned" : stage,
              reviewUpdatedAt: new Date().toISOString(),
            });
          }}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground"
        >
          <option value="">Not assigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Progress
        </span>
        <select
          value={stage}
          onChange={(e) =>
            onChange({
              reviewStage: e.target.value as ReviewStage,
              reviewUpdatedAt: new Date().toISOString(),
            })
          }
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground"
        >
          {REVIEW_STAGES.map((s) => (
            <option key={s} value={s}>
              {REVIEW_STAGE_LABEL[s]}
            </option>
          ))}
        </select>

        {r.reviewUpdatedAt ? (
          <span className="text-[11px] text-muted-foreground">
            updated {formatDateTime(r.reviewUpdatedAt)}
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <ReviewProgressBar stage={stage} />
      </div>
    </div>
  );
}
