import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PartnerType } from "@/lib/auth";
import { OTHER_TABS, useLenderTabs } from "@/components/lender/LenderPortal";
import { REALTOR_TABS } from "@/components/realtor/RealtorPortal";

const linkCls =
  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-tint hover:text-brand";

function LenderLinks() {
  const tabs = useLenderTabs();
  const [open, setOpen] = useState(false);
  const mainTabs = tabs.filter((t) => !(OTHER_TABS as string[]).includes(t.id));
  const otherTabs = tabs.filter((t) => (OTHER_TABS as string[]).includes(t.id));
  return (
    <>
      {mainTabs.map((t) => (
        <Link key={t.id} to="/partner" search={{ tab: t.id }} className={linkCls}>
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
      <div className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} className={linkCls}>
          <span aria-hidden>⚙️</span> Other
          <span className="text-[9px] opacity-60">▼</span>
        </button>
        {open ? (
          <div className="absolute left-0 top-[calc(100%+8px)] w-52 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            {otherTabs.map((t) => (
              <Link
                key={t.id}
                to="/partner"
                search={{ tab: t.id }}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
              >
                <span aria-hidden>{t.icon}</span> {t.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
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
