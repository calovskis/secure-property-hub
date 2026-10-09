import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Building2, CheckCircle2, FileText, LockKeyhole, MapPin, Pencil, ShieldCheck, Users, Wrench } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { InspectorNav } from "@/components/partner/InspectorNav";
import { InspectorProfile } from "@/components/profile/InspectorProfile";
import { PartnerAccountCard } from "@/components/profile/PartnerAccountCard";
import { AgreementCard } from "@/components/profile/AgreementCard";
import { KybCard } from "@/components/profile/KybCard";
import { InfoRequestsList } from "@/components/profile/InfoRequestsList";
import { CorrespondenceCard } from "@/components/profile/CorrespondenceCard";
import { DeleteMyAccountCard } from "@/components/profile/DeleteMyAccountCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useNotifications } from "@/lib/notifications";
import { formatDateTime } from "@/lib/dates";
import { fullName, type LoqalUser } from "@/lib/auth";
import { US_STATE_NAME_BY_CODE } from "@/data/us-states";
import { SERVICE_LABEL } from "@/lib/inspection-licensing";

export const MY_LOQAL_SECTIONS = ["profile", "team", "areas", "services", "notifications", "security", "compliance"] as const;
export type MyLoqalSection = typeof MY_LOQAL_SECTIONS[number];
const menu = [
  { id: "profile", label: "Company profile", icon: Building2, group: "Organization" },
  { id: "team", label: "Team members", icon: Users },
  { id: "areas", label: "Service areas", icon: MapPin },
  { id: "services", label: "Inspection services", icon: Wrench },
  { id: "notifications", label: "Notifications", icon: Bell, group: "Preferences" },
  { id: "security", label: "Security & access", icon: LockKeyhole },
  { id: "compliance", label: "Documents & compliance", icon: FileText, group: "Legal" },
] as const;

export function InspectorMyLoqal({ user, section }: { user: LoqalUser; section: MyLoqalSection }) {
  const { requests, ready } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const profile = request?.inspectorProfile;
  const { notifications, unread, markRead, markAllRead } = useNotifications(user.email);
  const [accountOpen, setAccountOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const company = profile?.legalName || request?.companyName || user.companyName || fullName(user);
  const initials = company.split(/\s+/).slice(0, 2).map((s) => s[0]).join("");
  const title = menu.find((item) => item.id === section)?.label || "Company profile";
  const descriptions: Record<MyLoqalSection, string> = {
    profile: "Company identity, business details and primary contact.",
    team: "Registered inspectors and company languages.",
    areas: "Registered locations and state-specific inspection coverage.",
    services: "Inspection services, licences and supporting copies.",
    notifications: "Your Loqal updates and inspection notifications.",
    security: "Your account and access to confidential information.",
    compliance: "Partnership documents, verification and licence copies.",
  };
  return <div className="min-h-screen bg-background">
    <AppHeader navSlot={<InspectorNav current="my-loqal"/>}/>
    <main className="mx-auto max-w-[1170px] px-4 py-8 md:px-7">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">My Loqal</h1><p className="mt-2 text-sm text-muted-foreground">Manage your inspection company’s organization, services and compliance information.</p></div><Button size="sm" variant="outline" disabled={!request} onClick={() => setAgreementOpen(true)}><FileText/>View partner agreement</Button></header>
      <div className="grid items-start gap-5 lg:grid-cols-[238px_minmax(0,1fr)]">
        <nav aria-label="My Loqal sections" className="border-y border-border bg-card p-2 lg:border-l lg:border-r lg:rounded-lg">
          {menu.map((item) => <div key={item.id}>{"group" in item ? <p className="px-3 pb-1.5 pt-3 text-[9px] font-semibold uppercase text-muted-foreground">{item.group}</p> : null}<Button size="sm" variant="ghost" asChild className={`h-auto w-full justify-start gap-2 px-3 py-2.5 text-xs ${section === item.id ? "bg-brand-tint text-brand" : "text-muted-foreground"}`}><Link to="/inspection-my-loqal" search={{ section: item.id }} aria-current={section === item.id ? "page" : undefined}><item.icon className="size-4 shrink-0"/>{item.label}</Link></Button></div>)}
        </nav>
        <div className="min-w-0 space-y-5">
          {section === "profile" ? <div className="flex flex-wrap items-center gap-3 border-y border-border bg-card px-5 py-5"><span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-lg font-bold text-brand">{initials}</span><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{company}</h2><p className="mt-1 text-xs text-muted-foreground">Inspection Partner{request?.states.length ? ` · ${request.states.join(", ")}` : ""}</p></div><span className={`rounded px-2 py-1 text-[10px] font-semibold ${request?.agreementCountersignedAt ? "bg-success/10 text-success" : "bg-brand-tint text-brand"}`}>{request?.agreementCountersignedAt ? "PARTNERSHIP ACTIVE" : request?.status === "approved" ? "REGISTRATION APPROVED" : "REGISTRATION IN REVIEW"}</span></div> : null}
          <section className="bg-card">
            <header className="flex flex-wrap items-start justify-between gap-3 border-y border-border px-5 py-4"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-[11px] text-muted-foreground">{descriptions[section]}</p></div>{section === "profile" ? <Button size="sm" variant="outline" disabled={!request} onClick={() => setAccountOpen(true)}><Pencil/>Edit name / company</Button> : null}{section === "notifications" ? <Button size="sm" variant="outline" disabled={!unread} onClick={markAllRead}><CheckCircle2/>Mark all read</Button> : null}</header>
            <div className="px-5 py-5">
              {!ready ? <p className="text-xs text-muted-foreground">Loading company information…</p> : section === "profile" ? <><div className="mb-5 flex items-start gap-2.5 rounded-md bg-brand-tint px-3 py-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand"/><p><strong className="text-brand">Company information:</strong> registered name changes are reviewed by Loqal before they appear on your agreement.</p></div><InspectorProfile user={user} section="profile"/></> : section === "team" ? <><div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4"><div><p className="text-xs font-semibold">{request ? `${request.firstName} ${request.lastName}` : fullName(user)}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{request?.email || user.email} · Primary account</p></div><span className="rounded bg-brand-tint px-2 py-1 text-[10px] font-semibold text-brand">Account owner</span></div><InspectorProfile user={user} section="team"/><p className="mt-5 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">Registered inspectors are company contacts, not additional sign-in accounts. Team invitations and delegated permissions are not enabled.</p></> : section === "areas" ? <><div className="grid gap-3 sm:grid-cols-2">{profile?.coverage.map((area) => <div key={area.state} className="rounded-lg border border-border p-4"><MapPin className="mb-3 size-4 text-brand"/><h3 className="text-xs font-semibold">{US_STATE_NAME_BY_CODE[area.state] || area.state}</h3><p className="mt-1 text-[11px] text-muted-foreground">{area.services.length} registered service{area.services.length === 1 ? "" : "s"}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{area.services.map((s) => SERVICE_LABEL[s.service]).join(" · ")}</p></div>)}</div>{!profile?.coverage.length ? <p className="text-xs text-muted-foreground">No service areas on file.</p> : null}<Button size="sm" variant="outline" asChild className="mt-5"><Link to="/inspection-my-loqal" search={{ section: "services" }}><Pencil/>Edit coverage & services</Link></Button></> : section === "services" ? <InspectorProfile user={user} section="coverage"/> : section === "notifications" ? <><p className="mb-3 text-[11px] text-muted-foreground">{unread} unread notification{unread === 1 ? "" : "s"}</p><div className="divide-y divide-border">{notifications.map((n) => <div key={n.id} className="flex items-start gap-3 py-4"><Bell className={`mt-0.5 size-4 shrink-0 ${n.readAt ? "text-muted-foreground" : "text-brand"}`}/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{n.title}</p>{n.body ? <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{n.body}</p> : null}<p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(n.createdAt)}</p></div>{!n.readAt ? <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button> : <span className="text-[10px] text-muted-foreground">Read</span>}</div>)}</div>{!notifications.length ? <p className="py-8 text-center text-xs text-muted-foreground">No notifications yet.</p> : null}<p className="mt-4 border-t border-border pt-4 text-[11px] text-muted-foreground">Email delivery and reminder preferences are not configurable here yet.</p></> : section === "security" ? <><div className="flex items-start gap-2.5 rounded-md bg-brand-tint px-3 py-3 text-[11px] leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand"/><p>Account access is restricted to your signed-in identity. Registered team contacts do not automatically receive access to inspection cases or financial records.</p></div><dl className="mt-4 divide-y divide-border">{[["Account", user.email], ["Access", "Inspection partner"], ["Multi-factor authentication", "Not managed in this section"], ["Active sessions & access log", "Not available in this section"]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-3 py-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}</dl><Button size="sm" variant="outline" asChild className="mt-4"><Link to="/auth"><LockKeyhole/>Password & sign-in</Link></Button></> : <div className="space-y-6"><InspectorProfile user={user} section="coverage"/><div className="border-t border-border pt-4"><InfoRequestsList user={user}/></div></div>}
            </div>
          </section>
          {section === "compliance" ? <><KybCard user={user}/><AgreementCard user={user}/><CorrespondenceCard user={user}/></> : null}
          {section === "security" ? <DeleteMyAccountCard email={user.email} name={fullName(user)} roleLabel="Inspection partner"/> : null}
        </div>
      </div>
    </main>
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Registered account details</DialogTitle><DialogDescription>Changes to your registered identity are reviewed by Loqal.</DialogDescription></DialogHeader><PartnerAccountCard user={user}/></DialogContent></Dialog>
    <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Inspection partner agreement</DialogTitle><DialogDescription>Your registration-specific agreement and signature status.</DialogDescription></DialogHeader><AgreementCard user={user}/></DialogContent></Dialog>
  </div>;
}