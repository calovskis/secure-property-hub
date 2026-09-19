/**
 * Keeps the browser's realtor directory in step with the approved realtor
 * partners in the database, then repairs any buyer file that still points at
 * an agent who is not (or no longer) an approved Loqal realtor partner.
 */
import { useActiveLeads } from "@/lib/leads";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useLeads, leadState } from "@/lib/leads";
import { listApprovedRealtors } from "@/lib/realtors.functions";
import { pickRealtor, replaceApprovedRealtors, getRealtorSnapshot } from "@/lib/realtors";

export function RealtorDirectorySync() {
  const { user, ready } = useAuth();
  const { leads, updateLead } = useActiveLeads();
  const fetchRealtors = useServerFn(listApprovedRealtors);
  const done = useRef(false);
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  useEffect(() => {
    if (!ready || !user || done.current) return;
    done.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchRealtors();
        if (cancelled) return;
        replaceApprovedRealtors(rows);

        // Repair stale assignments (agents that no longer exist).
        const snapshot = getRealtorSnapshot();
        const valid = new Set(snapshot.realtors.filter((r) => r.approvedAt).map((r) => r.id));
        const counts: Record<string, number> = {};
        for (const l of leadsRef.current) {
          const id = l.buyerAgent?.agentId;
          if (id && valid.has(id) && l.clientDecision === "accepted")
            counts[id] = (counts[id] ?? 0) + 1;
        }
        for (const l of leadsRef.current) {
          const ba = l.buyerAgent;
          if (!ba?.agentId || valid.has(ba.agentId)) continue;
          const picked = pickRealtor(
            { state: leadState(l), languages: ["English"], price: l.propertyPrice },
            counts,
            snapshot,
          );
          const { agentId: _id, agentName: _name, assignedAt: _at, ...rest } = ba;
          updateLead(l.id, {
            buyerAgent: picked
              ? {
                  ...rest,
                  agentId: picked.id,
                  agentName: `${picked.firstName} ${picked.lastName}`.trim(),
                  assignedAt: new Date().toISOString(),
                }
              : rest,
          });
          if (picked) counts[picked.id] = (counts[picked.id] ?? 0) + 1;
        }
      } catch {
        /* offline or unauthenticated — keep whatever we have */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, fetchRealtors, updateLead]);

  return null;
}
