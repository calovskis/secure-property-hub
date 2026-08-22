/**
 * Contact privacy: partners (realtors, lenders) never see a client's direct
 * e-mail or phone — only Loqal admins do. These helpers render the masked
 * form shown on partner surfaces.
 */
export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return "•••";
  const head = name.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, Math.min(5, name.length - 1)))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `••• ••• ${digits.slice(-4)}`;
}

/** Short masked row used on partner-facing file views. */
export function maskedContact(email: string, phone: string): string {
  return `${maskEmail(email)} · ${maskPhone(phone)}`;
}
