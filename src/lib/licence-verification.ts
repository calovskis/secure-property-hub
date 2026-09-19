/**
 * Loqal verification of partner state licences.
 *
 * Whenever a partner (mortgage lender or realtor) changes a state licence or
 * uploads a new copy, the entry is flagged as awaiting Loqal verification. A
 * Loqal admin either confirms it or asks for more information. Until a state
 * licence is verified the partner cannot work in that state — no cases are
 * assigned there.
 */
import type { PartnerRequest, RealtorLicenseDoc } from "./partner-requests";

/** The licence rows on file: declared at registration, overlaid with uploads. */
export function licenceRows(request: PartnerRequest | undefined): RealtorLicenseDoc[] {
  if (!request) return [];
  const stored = request.realtorVerification?.licenseDocs ?? [];
  const declared = [...(request.realtorLicenses ?? []), ...(request.lenderLicenses ?? [])];
  const merged: RealtorLicenseDoc[] = [];
  for (const l of declared) {
    if (merged.some((m) => m.state === l.state)) continue;
    const hit = stored.find((s) => s.state === l.state);
    merged.push(hit ?? { state: l.state, number: l.number, validUntil: l.validUntil });
  }
  for (const s of stored) if (!merged.some((m) => m.state === s.state)) merged.push(s);
  return merged;
}

/** Loqal confirmed this licence and nothing changed since. */
export function isLicenceVerified(l: RealtorLicenseDoc) {
  return Boolean(l.verifiedAt) && !l.pendingSince;
}

/** The partner submitted something a Loqal admin still has to check. */
export function awaitsVerification(l: RealtorLicenseDoc) {
  return Boolean(l.pendingSince) && !l.verifiedAt;
}

/** Rows a Loqal admin still has to verify. */
export function pendingVerifications(request: PartnerRequest | undefined) {
  return licenceRows(request).filter(awaitsVerification);
}

/** States the partner is cleared to work in. */
export function verifiedStates(request: PartnerRequest | undefined) {
  return licenceRows(request).filter(isLicenceVerified).map((l) => l.state);
}

/** States declared but not (yet) cleared by Loqal — no cases are assigned there. */
export function unverifiedStates(request: PartnerRequest | undefined) {
  return licenceRows(request)
    .filter((l) => !isLicenceVerified(l))
    .map((l) => l.state);
}

/**
 * Whether a partner may be assigned a case located in `state`.
 * Requires a Loqal-verified licence for that state.
 */
export function partnerCoversState(request: PartnerRequest | undefined, state: string) {
  if (!request || !state) return false;
  return verifiedStates(request).includes(state);
}
