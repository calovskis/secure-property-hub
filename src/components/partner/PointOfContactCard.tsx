/**
 * "Your point of contact" — every partner gets a Loqal manager assigned when
 * their registration is picked up for review. The card surfaces that person on
 * the partner dashboard with a direct way to reach them.
 */
import { Link } from "@tanstack/react-router";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useStaff } from "@/lib/staff";
import { useAuth } from "@/lib/auth";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function PointOfContactCard() {
  const { user } = useAuth();
  const { requests } = usePartnerRequests();
  const { members } = useStaff();

  if (!user) return null;

  const registration = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const member = members.find((m) => m.id === registration?.reviewerId);
  const name = member?.name ?? registration?.reviewerName ?? null;
  const title = member?.title ?? "Loqal partner manager";
  const email = member?.email;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-base"
          >
            🎧
          </span>
          <h2 className="text-lg font-semibold text-foreground">Your point of contact</h2>
        </div>
        <Link
          to="/profile"
          search={{ focus: "correspondence" }}
          className="rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-brand-tint"
        >
          Go to communication center
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-border px-4 py-3">
        {name ? (
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand">
              {initials(name)}
            </span>
            <div>
              <div className="text-base font-semibold text-foreground">{name}</div>
              <div className="text-sm text-muted-foreground">{title}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            A Loqal manager is being assigned to your account. Until then, our team answers every
            request from the communication center.
          </div>
        )}
      </div>

      <a
        href={`mailto:${email ?? "it@loqal.global"}?subject=${encodeURIComponent(
          `Loqal partner — ${registration?.companyName || user.email}`,
        )}`}
        className="mt-3 block rounded-md bg-muted px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-brand-tint"
      >
        Get in touch
      </a>
    </section>
  );
}
