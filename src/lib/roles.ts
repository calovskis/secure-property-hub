/**
 * Loqal-specific roles and permissions. A Full Admin assigns one or more roles
 * to each employee (Admin panel → Employees → open employee → Roles &
 * permissions); every role carries a fixed set of permissions and an employee's
 * effective permissions are the union of their roles.
 *
 * Account deletion is deliberately split in two permissions — requesting and
 * confirming — so no single mistake can remove a profile. An employee holding
 * both may complete a deletion alone.
 */

export type Permission =
  | "people.view"
  | "people.edit"
  | "partners.review"
  | "partners.approve"
  | "cases.manage"
  | "entity.assign"
  | "accounting.manage"
  | "support.manage"
  | "activity.view"
  | "employees.manage"
  | "settings.manage"
  | "users.delete.request"
  | "users.delete.confirm"
  | "users.restore";

export const PERMISSION_LABEL: Record<Permission, string> = {
  "people.view": "View client & partner profiles",
  "people.edit": "Edit registration and profile data",
  "partners.review": "Review partner registrations & documents",
  "partners.approve": "Approve or decline partners, countersign agreements",
  "cases.manage": "Work on mortgage and purchase cases",
  "entity.assign": "Assign entity set-up managers to company set-up cases",
  "accounting.manage": "Issue invoices and manage billing",
  "support.manage": "Answer the support inbox",
  "activity.view": "See the platform activity log",
  "employees.manage": "Manage employees, roles and permissions",
  "settings.manage": "Change platform settings",
  "users.delete.request": "Request deletion of a user profile",
  "users.delete.confirm": "Confirm and execute a requested deletion",
  "users.restore": "Restore a deleted profile within 90 days",
};

export const PERMISSION_ORDER: Permission[] = Object.keys(PERMISSION_LABEL) as Permission[];

export type LoqalRoleId =
  | "full_admin"
  | "ops_manager"
  | "partner_onboarding"
  | "compliance_officer"
  | "mortgage_coordinator"
  | "accounting_admin"
  | "support_specialist"
  | "auditor"
  | "deletion_requester"
  | "deletion_approver";

export type LoqalRole = {
  id: LoqalRoleId;
  name: string;
  description: string;
  permissions: Permission[];
};

export const LOQAL_ROLES: LoqalRole[] = [
  {
    id: "full_admin",
    name: "Loqal Full Admin",
    description:
      "Complete access to the console: people, cases, partners, accounting, support, employees and platform settings — including requesting and confirming deletions.",
    permissions: [...PERMISSION_ORDER],
  },
  {
    id: "ops_manager",
    name: "Client Operations Manager",
    description:
      "Runs day-to-day client work: profiles, cases and correspondence. May request a profile deletion, but cannot confirm one.",
    permissions: [
      "people.view",
      "people.edit",
      "cases.manage",
      "entity.assign",
      "support.manage",
      "activity.view",
      "users.delete.request",
    ],
  },
  {
    id: "partner_onboarding",
    name: "Partner Onboarding Reviewer",
    description:
      "Reviews partner registrations, identity documents and state licences, and approves or declines them.",
    permissions: ["people.view", "partners.review", "partners.approve", "activity.view"],
  },
  {
    id: "compliance_officer",
    name: "Compliance & KYB Officer",
    description:
      "Owns verification and compliance review, and acts as the second pair of eyes on deletions — confirming and restoring profiles.",
    permissions: [
      "people.view",
      "partners.review",
      "activity.view",
      "users.delete.confirm",
      "users.restore",
    ],
  },
  {
    id: "mortgage_coordinator",
    name: "Mortgage Case Coordinator",
    description: "Coordinates pre-approvals, lender feedback and purchase files.",
    permissions: ["people.view", "cases.manage"],
  },
  {
    id: "accounting_admin",
    name: "Accounting & Billing Admin",
    description: "Issues invoices, tracks platform fees and manages billing.",
    permissions: ["people.view", "accounting.manage"],
  },
  {
    id: "support_specialist",
    name: "Client Support Specialist",
    description: "Answers client and partner messages in the support inbox.",
    permissions: ["people.view", "support.manage"],
  },
  {
    id: "auditor",
    name: "Read-only Auditor",
    description: "Can look at profiles and the activity log, but change nothing.",
    permissions: ["people.view", "activity.view"],
  },
  {
    id: "deletion_requester",
    name: "Account Deletion Requester",
    description:
      "May start a deletion with a written reason. Someone with the approver role has to confirm it.",
    permissions: ["users.delete.request"],
  },
  {
    id: "deletion_approver",
    name: "Account Deletion Approver",
    description:
      "Confirms requested deletions and can restore a profile during the 90-day recovery window.",
    permissions: ["users.delete.confirm", "users.restore"],
  },
];

export const ROLE_BY_ID: Record<LoqalRoleId, LoqalRole> = Object.fromEntries(
  LOQAL_ROLES.map((r) => [r.id, r]),
) as Record<LoqalRoleId, LoqalRole>;

/** Union of the permissions granted by a set of roles. */
export function permissionsOfRoles(roles: LoqalRoleId[]): Permission[] {
  const set = new Set<Permission>();
  for (const id of roles) for (const p of ROLE_BY_ID[id]?.permissions ?? []) set.add(p);
  return PERMISSION_ORDER.filter((p) => set.has(p));
}

/** Days a deleted profile stays recoverable. */
export const RECOVERY_DAYS = 90;
