import { Link } from "@tanstack/react-router";
import { Home, ClipboardCheck, Building2, ChartNoAxesCombined, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InspectorNav({ current = "" }: { current?: string }) {
  const tabs = [{ id: "home", label: "Home", icon: Home }, { id: "cases", label: "Inspection cases", icon: ClipboardCheck }, { id: "metrics", label: "Metrics", icon: ChartNoAxesCombined }];
  return <div className="flex flex-wrap items-center gap-1">
    {tabs.map((t) => <Button key={t.id} size="sm" variant="ghost" asChild className={current === t.id ? "bg-brand-tint text-brand" : "text-muted-foreground"}><Link to="/partner" search={{ tab: t.id }}><t.icon/>{t.label}</Link></Button>)}
    <Button size="sm" variant="ghost" asChild className={current === "profile" ? "bg-brand-tint text-brand" : "text-muted-foreground"}><Link to="/profile"><Building2/>Company profile</Link></Button>
    <Button size="sm" variant="ghost" asChild className={current === "settings" ? "bg-brand-tint text-brand" : "text-muted-foreground"}><Link to="/settings"><Settings/>Organisation settings</Link></Button>
  </div>;
}