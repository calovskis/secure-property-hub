import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function InspectorNav({ current = "" }: { current?: string }) {
  const tabs = [{ id: "home", label: "Home", icon: "🏠" }, { id: "cases", label: "Inspection cases", icon: "📋" }, { id: "metrics", label: "Metrics", icon: "📈" }];
  const navClass = (id: string) => `h-auto gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-medium ${current === id ? "bg-brand-tint text-brand" : "text-muted-foreground hover:bg-brand-tint hover:text-brand"}`;
  return <div className="flex items-center gap-1">
    {tabs.map((t) => <Button key={t.id} size="sm" variant="ghost" asChild className={navClass(t.id)}><Link to="/partner" search={{ tab: t.id }}><span aria-hidden>{t.icon}</span>{t.label}</Link></Button>)}
    <Button size="sm" variant="ghost" asChild className={navClass("profile")}><Link to="/profile"><span aria-hidden>👤</span>Company profile</Link></Button>
    <Button size="sm" variant="ghost" asChild className={navClass("settings")}><Link to="/settings"><span aria-hidden>⚙️</span>Organisation settings</Link></Button>
  </div>;
}