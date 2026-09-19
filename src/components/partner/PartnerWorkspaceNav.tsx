import { Link } from "@tanstack/react-router";
import type { PartnerType } from "@/lib/auth";
import { useLenderTabs } from "@/components/lender/LenderPortal";
import { REALTOR_TABS } from "@/components/realtor/RealtorPortal";

const linkCls =
  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-tint hover:text-brand";

function LenderLinks() {
  const tabs = useLenderTabs();
  return (
    <>
      {tabs.map((t) => (
        <Link key={t.id} to="/partner" search={{ tab: t.id }} className={linkCls}>
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </>
  );
}

/**
 * The partner workspace navigation, shown on shared pages (Settings, My
 * Profile) so a partner's heading stays their own workspace instead of
 * falling back to the client navigation.
 */
export function PartnerWorkspaceNav({ partnerType }: { partnerType?: PartnerType | undefined }) {
  if (partnerType === "lender") return <LenderLinks />;
  if (partnerType === "realtor") {
    return (
      <>
        {REALTOR_TABS.map((t) => (
          <Link key={t.id} to="/partner" search={{ tab: t.id }} className={linkCls}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </>
    );
  }
  return (
    <Link to="/partner" className={linkCls}>
      <span aria-hidden>🏠</span>
      Partner workspace
    </Link>
  );
}
