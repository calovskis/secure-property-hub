/**
 * The authoritative assignable realtor directory.
 *
 * Buyer's agents used to be read from a per-browser local directory, which
 * could hold stale test seats that no longer exist as approved partners. The
 * only source of truth is the `partner_requests` table: realtor registrations
 * a Loqal admin approved. Row level security hides those rows from clients, so
 * this server function returns the minimal, assignment-relevant fields to any
 * signed-in user.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Realtor, RealtorLicense } from "@/lib/realtors";

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  realtor_licenses: unknown;
  languages: string[] | null;
  decided_at: string | null;
  updated_at: string | null;
};

function licences(raw: unknown): RealtorLicense[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => l as Partial<RealtorLicense>)
    .filter((l) => typeof l?.state === "string" && typeof l?.validUntil === "string")
    .map((l) => ({
      state: String(l.state),
      number: String(l.number ?? ""),
      validUntil: String(l.validUntil),
      ...(l.issuedAt ? { issuedAt: String(l.issuedAt) } : {}),
    }));
}

export const listApprovedRealtors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Realtor[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("partner_requests")
      .select(
        "id, first_name, last_name, email, phone, street, city, state, zip, country, realtor_licenses, languages, decided_at, updated_at",
      )
      .eq("partner_type", "realtor")
      .eq("status", "approved");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      firstName: r.first_name ?? "",
      lastName: r.last_name ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      address: {
        street: r.street ?? "",
        city: r.city ?? "",
        state: r.state ?? "",
        zip: r.zip ?? "",
        country: r.country ?? "US",
      },
      licenses: licences(r.realtor_licenses),
      languages: r.languages?.length ? r.languages : ["English"],
      approvedAt: r.decided_at ?? r.updated_at ?? new Date().toISOString(),
    }));
  });
