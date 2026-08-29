/**
 * The Loqal admin navigation. It is rendered inside the app header on the
 * admin console itself (where it switches tabs in place) and on every admin
 * sub-page opened in its own tab — partner requests, a person profile — so an
 * admin always keeps the admin headings and can jump straight back to any
 * console section.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSupportInbox } from "@/lib/chat";

export type AdminTab =
  | "overview"
  | "cases"
  | "partners"
  | "people"
  | "people_clients"
  | "people_partners"
  | "accounting"
  | "support"
  | "employees"
  | "activity"
  | "settings";

const itemCls = (active: boolean) =>
  `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-brand-tint text-brand" : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
  }`;
const subCls = (active: boolean) =>
  `flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-brand-tint hover:text-brand ${
    active ? "font-semibold text-brand" : "text-foreground"
  }`;

export function AdminNav({
  tab,
  onSelect,
}: {
  /** Active tab on the console; sub-pages pass their closest section. */
  tab: AdminTab | null;
  /** Present on the console itself — switches tab in place instead of navigating. */
  onSelect?: (tab: AdminTab) => void;
}) {
  const [teamMenu, setTeamMenu] = useState(false);
  const [peopleMenu, setPeopleMenu] = useState(false);
  const { unreadTotal } = useSupportInbox();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-admin-menu]")) {
        setTeamMenu(false);
        setPeopleMenu(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const close = () => {
    setTeamMenu(false);
    setPeopleMenu(false);
  };

  /** Either an in-place tab button (console) or a link back to the console. */
  function Item({
    target,
    active,
    className,
    children,
  }: {
    target: AdminTab;
    active: boolean;
    className?: string;
    children: React.ReactNode;
  }) {
    const cls = `${className ?? itemCls(active)}`;
    if (onSelect) {
      return (
        <button
          type="button"
          onClick={() => {
            onSelect(target);
            close();
          }}
          className={cls}
        >
          {children}
        </button>
      );
    }
    return (
      <Link to="/admin" search={{ tab: target }} className={cls} onClick={close}>
        {children}
      </Link>
    );
  }

  const peopleActive = tab === "people" || tab === "people_clients" || tab === "people_partners";
  const teamActive = tab === "employees" || tab === "activity" || tab === "settings";

  return (
    <>
      <Item target="overview" active={tab === "overview"}>
        <span aria-hidden>🏠</span> Home
      </Item>
      <Item target="cases" active={tab === "cases"}>
        <span aria-hidden>🗂</span> Cases
      </Item>

      <div className="relative" data-admin-menu>
        <button
          type="button"
          onClick={() => setPeopleMenu(!peopleMenu)}
          className={itemCls(peopleActive)}
        >
          <span aria-hidden>👥</span> People
          <span className="text-[9px] opacity-60">▼</span>
        </button>
        {peopleMenu ? (
          <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            <Item target="people" active={tab === "people"} className={subCls(tab === "people")}>
              <span aria-hidden>📇</span> All
            </Item>
            <Item
              target="people_clients"
              active={tab === "people_clients"}
              className={subCls(tab === "people_clients")}
            >
              <span aria-hidden>🙋</span> Clients
            </Item>
            <Item
              target="people_partners"
              active={tab === "people_partners"}
              className={subCls(tab === "people_partners")}
            >
              <span aria-hidden>🤝</span> Partners
            </Item>
          </div>
        ) : null}
      </div>

      <Item target="accounting" active={tab === "accounting"}>
        <span aria-hidden>💳</span> Accounting
      </Item>

      <Item target="support" active={tab === "support"}>
        <span aria-hidden>💬</span> Support
        {unreadTotal ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-background">
            {unreadTotal}
          </span>
        ) : null}
      </Item>

      <div className="relative hidden lg:block" data-admin-menu>
        <button type="button" onClick={() => setTeamMenu(!teamMenu)} className={itemCls(teamActive)}>
          <span aria-hidden>🛠</span> Team
          <span className="text-[9px] opacity-60">▼</span>
        </button>
        {teamMenu ? (
          <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            <Item target="employees" active={tab === "employees"} className={subCls(tab === "employees")}>
              <span aria-hidden>🧑‍💼</span> Employees
            </Item>
            <Item target="activity" active={tab === "activity"} className={subCls(tab === "activity")}>
              <span aria-hidden>📈</span> Activity log
            </Item>
            <Item target="settings" active={tab === "settings"} className={subCls(tab === "settings")}>
              <span aria-hidden>⚙️</span> Platform settings
            </Item>
          </div>
        ) : null}
      </div>

      {/* Mobile fallback for the Team items */}
      <Item
        target="employees"
        active={tab === "employees"}
        className={`${itemCls(tab === "employees")} lg:hidden`}
      >
        <span aria-hidden>🧑‍💼</span> Team
      </Item>
    </>
  );
}
