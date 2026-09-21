import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { OTHER_TABS, useLenderTabs, type LenderTabId } from "@/components/lender/LenderPortal";

/**
 * The Mortgage Lender heading navigation (Home, Mortgages, Analytics,
 * Accounting, Other ▾). Shared between the lender workspace and the
 * standalone mortgage-case tab so the heading follows the file everywhere.
 *
 * Inside the workspace `onTabChange` switches tabs in place; on standalone
 * pages the tabs navigate back to the workspace with the chosen tab open.
 */
export function LenderNavSlot({
  current,
  onTabChange,
}: {
  /** Active tab id; standalone pages pass the tab matching the open file. */
  current: LenderTabId;
  /** Provide to switch tabs in place (workspace); omit to navigate to /partner. */
  onTabChange?: (tab: LenderTabId) => void;
}) {
  const tabs = useLenderTabs();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<"other" | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-lender-menu]")) setMenu(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const otherTabs = tabs.filter((t) => (OTHER_TABS as string[]).includes(t.id));
  const mainTabs = tabs.filter((t) => !(OTHER_TABS as string[]).includes(t.id));

  const itemCls = (active: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-brand-tint text-brand" : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
    }`;

  const openTab = (t: LenderTabId) => {
    setMenu(null);
    if (onTabChange) onTabChange(t);
    else navigate({ to: "/partner", search: { tab: t } });
  };

  return (
    <>
      {mainTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => openTab(t.id)}
          className={itemCls(current === t.id)}
        >
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </button>
      ))}
      <div className="relative" data-lender-menu>
        <button
          type="button"
          onClick={() => setMenu(menu === "other" ? null : "other")}
          className={itemCls((OTHER_TABS as string[]).includes(current))}
        >
          <span aria-hidden>⚙️</span> Other
          <span className="text-[9px] opacity-60">▼</span>
        </button>
        {menu === "other" ? (
          <div className="absolute left-0 top-[calc(100%+8px)] w-52 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            {otherTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTab(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-brand-tint hover:text-brand ${
                  current === t.id ? "font-semibold text-brand" : "text-foreground"
                }`}
              >
                <span aria-hidden>{t.icon}</span> {t.label}
              </button>
            ))}
            <Link
              to="/profile"
              onClick={() => setMenu(null)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
            >
              <span aria-hidden>👤</span> My profile
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
