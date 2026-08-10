import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  icon: string;
  to?: string;
  items?: { label: string; icon: string; to?: string }[];
};

const NAV: NavItem[] = [
  { label: "Home", icon: "🏠", to: "/" },
  { label: "Properties", icon: "🏢", to: "/properties" },
  {
    label: "Services",
    icon: "🔧",
    items: [
      { label: "All Services", icon: "📋" },
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
    label: "My Portfolio",
    icon: "📁",
    items: [
      { label: "My Properties", icon: "🏘️" },
      { label: "My Services", icon: "📋" },
      { label: "My Financials", icon: "💳" },
      { label: "Analytics", icon: "📈" },
      { label: "Documents", icon: "📋" },
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

export function AppHeader({ active = "Home" }: { active?: string }) {
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
          {NAV.map((item) => {
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
                    {item.label}
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
                    {item.label}
                  </Link>
                )}

                {item.items && open === item.label ? (
                  <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                    {item.items.map((sub) => (
                      <button
                        key={sub.label}
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
                      >
                        <span aria-hidden>{sub.icon}</span>
                        {sub.label}
                      </button>
                    ))}
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
                placeholder="Search..."
                aria-label="Search"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            ) : null}
          </div>

          <div className="relative hidden sm:block">
            <button
              type="button"
              aria-label="Help"
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
                    {i}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Settings"
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-tint sm:flex"
          >
            ⚙️
          </button>

          <button
            type="button"
            aria-label="Account"
            className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-soft text-sm font-semibold text-primary-foreground"
          >
            A
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
        {NAV.map((item) => (
          <span
            key={item.label}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
              item.label === active ? "bg-brand-tint text-brand" : "text-muted-foreground"
            }`}
          >
            {item.icon} {item.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
