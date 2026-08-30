/**
 * Unified people directory model for the admin console: every individual
 * client (from their mortgage files), every corporate client and every
 * partner registration, merged with admin profile overrides.
 */
import { useMemo } from "react";
import { PARTNER_LABEL, type PartnerType } from "@/lib/auth";
import { useLeads, type MortgageLead } from "@/lib/leads";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useDirectory } from "@/lib/directory";
import { engagementFor, usePresence } from "@/lib/presence";

export type PeopleScope = "all" | "clients" | "partners";
export type PersonGroup = "individual" | "corporate" | "partner";

export type AdminPerson = {
  key: string;
  email: string;
  name: string;
  roleLabel: string;
  group: PersonGroup;
  partnerType?: PartnerType | undefined;
  company?: string | undefined;
  phone?: string | undefined;
  note?: string | undefined;
  since: string;
  /** Registration status for partners/corporates, file status for clients. */
  status: string;
  state?: string | undefined;
  country?: string | undefined;
  usPerson?: boolean | undefined;
  languages?: string[] | undefined;
  leads: MortgageLead[];
  request?: PartnerRequest | undefined;
  lastSeen?: string | undefined;
};

export const CLIENT_SUBS: { id: "all" | PersonGroup; label: string }[] = [
  { id: "all", label: "All clients" },
  { id: "individual", label: "Individual" },
  { id: "corporate", label: "Corporate" },
];

export const PARTNER_SUBS: { id: "all" | PartnerType; label: string }[] = [
  { id: "all", label: "All partners" },
  { id: "realtor", label: PARTNER_LABEL.realtor },
  { id: "lender", label: PARTNER_LABEL.lender },
  { id: "cleaning", label: PARTNER_LABEL.cleaning },
  { id: "other", label: PARTNER_LABEL.other },
];

export function useAdminPeople(): AdminPerson[] {
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const { overrides } = useDirectory();
  const presence = usePresence();

  return useMemo(() => {
    const out: AdminPerson[] = [];

    const byClient = new Map<string, MortgageLead[]>();
    for (const l of leads) {
      const key = l.clientEmail.toLowerCase();
      byClient.set(key, [...(byClient.get(key) ?? []), l]);
    }

    for (const [key, own] of byClient) {
      const sorted = [...own].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const latest = sorted[0]!;
      const o = overrides[key];
      const home = latest.profile.addresses.find((a) => a.present) ?? latest.profile.addresses[0];
      out.push({
        key: `client-${key}`,
        email: latest.clientEmail,
        name: o?.displayName ?? latest.clientName,
        roleLabel: "Client",
        group: "individual",
        phone: o?.phone,
        company: o?.company,
        note: o?.note,
        since: sorted[sorted.length - 1]!.submittedAt,
        status: latest.status,
        state: home?.state,
        country: home?.country ?? latest.profile.countryOfResidence,
        usPerson: latest.usPerson,
        leads: sorted,
        lastSeen: engagementFor(presence, key).lastSeen,
      });
    }

    for (const r of requests) {
      const key = r.email.toLowerCase();
      const o = overrides[key];
      const isCorporate = r.kind === "corporate";
      out.push({
        key: `${r.kind}-${r.id}`,
        email: r.email,
        name: o?.displayName ?? `${r.firstName} ${r.lastName}`.trim(),
        roleLabel: isCorporate
          ? "Corporate client"
          : `Partner · ${PARTNER_LABEL[r.partnerType ?? "other"]}`,
        group: isCorporate ? "corporate" : "partner",
        partnerType: isCorporate ? undefined : (r.partnerType ?? "other"),
        company: o?.company ?? r.companyName,
        phone: o?.phone ?? r.phone,
        note: o?.note,
        since: r.submittedAt,
        status: r.status,
        state: r.state,
        country: r.country,
        languages: r.languages,
        leads: leads
          .filter((l) => l.clientEmail.toLowerCase() === key)
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
        request: r,
        lastSeen: engagementFor(presence, key).lastSeen,
      });
    }

    return out.sort((a, b) => b.since.localeCompare(a.since));
  }, [leads, requests, overrides, presence]);
}

/** People list plus a ready flag — false until partner registrations have
 *  loaded from the database, so pages don't judge "not found" too early. */
export function useAdminPeopleReady(): { people: AdminPerson[]; ready: boolean } {
  const people = useAdminPeople();
  const { ready } = usePartnerRequests();
  return { people, ready };
}

/** States a partner covers, used by the coverage filter. */
export function coverageStates(p: AdminPerson): string[] {
  const r = p.request;
  if (!r) return p.state ? [p.state] : [];
  if (r.allStates) return ["ALL"];
  const licensed = (r.realtorLicenses ?? []).map((l) => l.state);
  return [...new Set([...r.states, ...licensed, r.state].filter(Boolean))];
}
