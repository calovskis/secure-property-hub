import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PARTNER_LABEL, ROLE_LABEL, fullName, homeRouteFor, initials, useAuth } from "@/lib/auth";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function LanguageMenu() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Language"
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-brand-tint hover:text-brand"
      >
        🌐 {current.short}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-40 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-brand-tint hover:text-brand ${
                l.code === lang ? "font-semibold text-brand" : "text-foreground"
              }`}
            >
              {l.label}
              {l.code === lang ? <span aria-hidden>✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu() {
  const { user, ready, signOut } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!ready) return <div className="size-9 rounded-full bg-muted" />;

  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
      >
        {t("Log in")}
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("Account")}
        onClick={() => setOpen(!open)}
        className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-sm font-semibold text-primary-foreground"
      >
        {initials(user)}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <div className="border-b border-border px-2 pb-2">
            <div className="text-sm font-semibold text-foreground">{fullName(user)}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <span className="mt-2 inline-flex rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
              {t(ROLE_LABEL[user.role])}
              {user.partnerType ? ` · ${t(PARTNER_LABEL[user.partnerType])}` : ""}
            </span>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint hover:text-brand"
          >
            {t("My profile")}
          </Link>
          <Link
            to={homeRouteFor(user.role)}
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint hover:text-brand"
          >
            {t("My workspace")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
              navigate({ to: "/" });
            }}
            className="flex w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-brand-tint hover:text-brand"
          >
            {t("Sign out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type SubItem = { label: string; icon: string; to?: string };
type NavItem = {
  label: string;
  icon: string;
  to?: string;
  items?: SubItem[];
};

const NAV: NavItem[] = [
  { label: "Home", icon: "🏠", to: "/" },
  { label: "Properties", icon: "🏢", to: "/marketplace" },
  {
    label: "Services",
    icon: "🔧",
    items: [
      { label: "All Services", icon: "📋", to: "/my-services" },
      { label: "Maintenance", icon: "🔨" },
      { label: "Cleaning", icon: "🧹" },
      { label: "Security", icon: "🔐" },
      { label: "Landscaping", icon: "🌿" },
      { label: "Financial Services", icon: "💰" },
      { label: "Tenant Management", icon: "👥" },
      { label: "Service Requests", icon: "📊" },
    ],
  },
  {
    label: "My Loqal",
    icon: "📁",
    items: [
      { label: "My Profile", icon: "👤", to: "/profile" },
      { label: "My Properties", icon: "🏘️", to: "/my-properties" },
      { label: "My Services", icon: "📋", to: "/my-services" },
      { label: "My Financials", icon: "💳", to: "/financials" },
      { label: "Analytics", icon: "📈", to: "/analytics" },
      { label: "Documents", icon: "📋", to: "/documents" },
    ],
  },
  {
    label: "Other",
    icon: "⚡",
    items: [
      { label: "Help & Support", icon: "❓" },
      { label: "Documentation", icon: "📚" },
      { label: "Notifications", icon: "🔔" },
      { label: "Resources & Academy", icon: "🎓" },
      { label: "Community", icon: "🤝" },
      { label: "Feedback", icon: "💬" },
    ],
  },
];

export function AppHeader({
  active = "Home",
  navItems,
  navSlot,
}: {
  active?: string;
  /** Replace the default client navigation (e.g. partner workspaces). */
  navItems?: NavItem[];
  /** Fully custom nav content rendered instead of any nav items. */
  navSlot?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  // The logo always returns the person to the dashboard of the portal they are
  // signed into (admin, partner, or client) — never to another role's home.
  const homeTo = user ? homeRouteFor(user.role) : "/";
  const nav = navItems ?? NAV;
  const [open, setOpen] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!headerRef.current?.contains(e.target as Node)) {
        setOpen(null);
        setHelpOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
    >
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-3 px-4 md:px-7">
        <Link to="/" className="flex shrink-0 items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-gold to-gold/70 text-[13px] font-bold text-primary-foreground">
            LQ
          </span>
          <span className="bg-gradient-to-br from-brand to-brand-soft bg-clip-text text-[22px] font-bold tracking-tight text-transparent md:text-[28px]">
            LOQAL
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navSlot}
          {(navSlot ? [] : nav).map((item) => {
            const isActive = item.label === active;
            return (
              <div key={item.label} className="relative">
                {item.items ? (
                  <button
                    type="button"
                    onClick={() => setOpen(open === item.label ? null : item.label)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-tint text-brand"
                        : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {t(item.label)}
                    <span className="text-[9px] opacity-60">▼</span>
                  </button>
                ) : (
                  <Link
                    to={item.to ?? "/"}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-tint text-brand"
                        : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {t(item.label)}
                  </Link>
                )}

                {item.items && open === item.label ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                    {item.items.map((sub) => {
                      const cls =
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand-tint hover:text-brand";
                      return sub.to ? (
                        <Link
                          key={sub.label}
                          to={sub.to}
                          className={cls}
                          onClick={() => setOpen(null)}
                        >
                          <span aria-hidden>{sub.icon}</span>
                          {t(sub.label)}
                        </Link>
                      ) : (
                        <button key={sub.label} type="button" className={cls}>
                          <span aria-hidden>{sub.icon}</span>
                          {t(sub.label)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 transition-all ${
              searchOpen ? "w-44 md:w-56" : "w-10 cursor-pointer justify-center"
            }`}
            onClick={() => setSearchOpen(true)}
          >
            <span aria-hidden className="text-sm">
              🔍
            </span>
            {searchOpen ? (
              <input
                autoFocus
                type="text"
                placeholder={t("Search...")}
                aria-label={t("Search")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            ) : null}
          </div>

          <div className="relative hidden sm:block">
            <button
              type="button"
              aria-label={t("Help")}
              onClick={() => setHelpOpen(!helpOpen)}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-tint"
            >
              ❓
            </button>
            {helpOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                {["📖 Help Center", "☎️ Contact Us", "❔ FAQ", "💬 Send us Feedback"].map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-brand-tint hover:text-brand"
                  >
                    {t(i)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <Link
            to="/settings"
            aria-label={t("Settings")}
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-tint sm:flex"
          >
            ⚙️
          </Link>


          <NotificationBell />

          <LanguageMenu />

          <AccountMenu />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
        {navSlot}
        {(navSlot ? [] : nav).flatMap((item) => {
          const direct = item.to ? [{ label: item.label, icon: item.icon, to: item.to }] : [];
          const children = item.items?.filter((sub) => sub.to) ?? [];
          return [...direct, ...children].map((entry) => (
            <Link
              key={`${item.label}-${entry.label}`}
              to={entry.to ?? "/"}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                entry.label.toLowerCase() === active.toLowerCase()
                  ? "bg-brand-tint text-brand"
                  : "text-muted-foreground"
              }`}
            >
              {entry.icon} {t(entry.label)}
            </Link>
          ));
        })}
      </nav>
    </header>
  );
}
