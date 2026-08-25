import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

type Tab = "active" | "available" | "history";

const activeServices = [
  {
    icon: "📋",
    title: "Tenant Management - Professional Plan",
    property: "Downtown Plaza",
    status: "active" as const,
    info: [
      { label: "Monthly Cost", value: "$399" },
      { label: "Renewal Date", value: "02/01/2026" },
      { label: "Billing Cycle", value: "Monthly" },
      { label: "Contract", value: "Active (12mo)" },
    ],
    actions: ["View Details", "Billing", "Manage", "Pause"],
  },
  {
    icon: "🧹",
    title: "Cleaning Services - Monthly Package",
    property: "Riverside Apartments",
    status: "active" as const,
    info: [
      { label: "Monthly Cost", value: "$850" },
      { label: "Renewal Date", value: "02/15/2026" },
      { label: "Billing Cycle", value: "Monthly" },
      { label: "Contract", value: "Active (6mo)" },
    ],
    actions: ["View Details", "Billing", "Manage", "Pause"],
  },
  {
    icon: "🔧",
    title: "Maintenance Coordination - Premium Plan",
    property: "Oak Street Complex",
    status: "active" as const,
    info: [
      { label: "Monthly Cost", value: "$649" },
      { label: "Renewal Date", value: "03/01/2026" },
      { label: "Billing Cycle", value: "Monthly" },
      { label: "Contract", value: "Active (12mo)" },
    ],
    actions: ["View Details", "Billing", "Manage", "Pause"],
  },
  {
    icon: "🌿",
    title: "Landscaping Services - Quarterly",
    property: "Commerce Plaza",
    status: "active" as const,
    info: [
      { label: "Quarterly Cost", value: "$150" },
      { label: "Renewal Date", value: "04/01/2026" },
      { label: "Billing Cycle", value: "Quarterly" },
      { label: "Contract", value: "Active (12mo)" },
    ],
    actions: ["View Details", "Billing", "Manage", "Pause"],
  },
  {
    icon: "🔐",
    title: "Security Management - 24/7 Monitoring",
    property: "Cedar House",
    status: "active" as const,
    info: [
      { label: "Monthly Cost", value: "$299" },
      { label: "Renewal Date", value: "01/31/2026" },
      { label: "Billing Cycle", value: "Monthly" },
      { label: "Contract", value: "Active (24mo)" },
    ],
    actions: ["View Details", "Billing", "Manage", "Pause"],
  },
  {
    icon: "💰",
    title: "Financial Management - Monthly Reporting",
    property: "All Properties",
    status: "paused" as const,
    info: [
      { label: "Monthly Cost", value: "$500" },
      { label: "Paused Date", value: "01/15/2026" },
      { label: "Billing Cycle", value: "Monthly" },
      { label: "Contract", value: "Paused (12mo)" },
    ],
    actions: ["View Details", "Billing", "Resume", "Cancel"],
  },
];

const historyServices = [
  {
    icon: "👥",
    title: "Tenant Placement Service",
    property: "Pine Street House",
    info: [
      { label: "Total Cost", value: "$1,200" },
      { label: "Start Date", value: "10/15/2025" },
      { label: "End Date", value: "12/20/2025" },
      { label: "Status", value: "Successfully Completed" },
    ],
  },
  {
    icon: "🔨",
    title: "Roof Repair & Inspection",
    property: "Downtown Plaza",
    info: [
      { label: "Total Cost", value: "$4,200" },
      { label: "Start Date", value: "09/01/2025" },
      { label: "End Date", value: "10/15/2025" },
      { label: "Status", value: "Completed On Time" },
    ],
  },
  {
    icon: "🌿",
    title: "Full Property Landscaping",
    property: "Riverside Apartments",
    info: [
      { label: "Total Cost", value: "$2,500" },
      { label: "Start Date", value: "06/01/2025" },
      { label: "End Date", value: "08/30/2025" },
      { label: "Status", value: "Completed Successfully" },
    ],
  },
];

const plans = [
  {
    icon: "📋",
    property: "Tenant Mgmt",
    category: "tenant",
    price: "500to1000",
    name: "Essentials Plan",
    priceLabel: "$199",
    benefits: [
      "Tenant screening assistance",
      "Lease template & review",
      "Rent collection coordination",
      "Basic maintenance tracking",
    ],
  },
  {
    icon: "📋",
    property: "Tenant Mgmt",
    category: "tenant",
    price: "500to1000",
    name: "Professional Plan",
    priceLabel: "$399",
    benefits: [
      "Full tenant screening",
      "Complete lease management",
      "Maintenance coordination",
      "Compliance management",
    ],
  },
  {
    icon: "📋",
    property: "Tenant Mgmt",
    category: "tenant",
    price: "over1000",
    name: "Premium Plan",
    priceLabel: "$649",
    benefits: [
      "24/7 emergency support",
      "Vendor management",
      "Legal dispute resolution",
      "Dedicated property manager",
    ],
  },
  {
    icon: "🔧",
    property: "Maintenance",
    category: "maintenance",
    price: "500to1000",
    name: "Standard Maintenance",
    priceLabel: "$450",
    benefits: [
      "Regular inspections",
      "Basic repairs",
      "Vendor coordination",
      "Maintenance scheduling",
    ],
  },
  {
    icon: "🧹",
    property: "Cleaning",
    category: "cleaning",
    price: "under500",
    name: "Weekly Cleaning",
    priceLabel: "$350",
    benefits: [
      "Weekly service",
      "Common areas",
      "Trash removal",
      "Supply management",
    ],
  },
  {
    icon: "🔐",
    property: "Security",
    category: "security",
    price: "500to1000",
    name: "24/7 Monitoring",
    priceLabel: "$299",
    benefits: [
      "Round-the-clock monitoring",
      "Emergency response",
      "System maintenance",
      "Incident reporting",
    ],
  },
];

function StatusBadge({ status }: { status: "active" | "paused" | "ended" }) {
  const map = {
    active: "bg-success/10 text-success",
    paused: "bg-warning/10 text-warning",
    ended: "bg-muted-foreground/10 text-muted-foreground",
  } as const;
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Completed";
  const dot = status === "ended" ? "✓" : "●";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${map[status]}`}>
      <span>{dot}</span> {label}
    </div>
  );
}

function ServiceItem({
  icon,
  title,
  property,
  status,
  info,
  actions,
}: {
  icon: string;
  title: string;
  property: string;
  status: "active" | "paused" | "ended";
  info: { label: string; value: string }[];
  actions: string[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-all hover:border-brand-soft hover:shadow-md sm:flex-row sm:items-start">
      <div
        className="flex h-[70px] w-full flex-shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-tint to-gold-tint text-4xl sm:h-[70px] sm:w-[70px]"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-foreground">{title}</div>
            <div className="mt-1 inline-block rounded bg-brand-tint px-2.5 py-1 text-xs text-muted-foreground">
              {property}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
          {info.map((i) => (
            <div key={i.label} className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {i.label}
              </div>
              <div className="text-sm font-semibold text-foreground">{i.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              className={`rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors ${
                a === "Pause" || a === "Cancel"
                  ? "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15"
                  : "border-border bg-brand-tint text-brand hover:bg-brand/15"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/my-services")({
  head: () => ({
    meta: [
      { title: "My Services | LOQAL" },
      {
        name: "description",
        content: "Browse available services and manage your active service subscriptions.",
      },
      { property: "og:title", content: "My Services | LOQAL" },
      {
        property: "og:description",
        content: "Browse available services and manage your active service subscriptions.",
      },
    ],
  }),
  component: MyServicesPage,
});

function MyServicesPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  const filteredPlans = plans.filter(
    (p) => (!category || p.category === category) && (!price || p.price === price),
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My Loqal" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="mb-2 text-[32px] font-bold text-foreground">My Services</h1>
            <p className="text-sm text-muted-foreground">
              Browse available services and manage your active service subscriptions
            </p>
          </div>
        </div>

        <div className="mb-8 flex gap-3 overflow-x-auto border-b-2 border-border">
          {(
            [
              { id: "active", label: "Active Services" },
              { id: "available", label: "Available Services" },
              { id: "history", label: "Service History" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-[3px] px-5 py-3 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-brand"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "active" && (
          <div>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "✓", label: "Active Services", value: "6" },
                { icon: "💳", label: "Monthly Spend", value: "$2,847" },
                { icon: "📊", label: "Service Count", value: "8 Total" },
                { icon: "⏳", label: "Renewals Due", value: "2 Soon" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
                  <div
                    className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-tint to-gold-tint text-3xl"
                    aria-hidden="true"
                  >
                    {s.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="text-2xl font-bold text-brand">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-8 flex flex-col gap-4">
              {activeServices.map((s) => (
                <ServiceItem key={s.title} {...s} />
              ))}
            </div>
          </div>
        )}

        {tab === "available" && (
          <div>
            <div className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Service Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-md border border-border px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="">All Categories</option>
                  <option value="tenant">Tenant Management</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="security">Security</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="financial">Financial Services</option>
                </select>
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Price Range
                </label>
                <select
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="rounded-md border border-border px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="">All Prices</option>
                  <option value="under500">Under $500</option>
                  <option value="500to1000">$500 - $1,000</option>
                  <option value="over1000">Over $1,000</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategory("");
                  setPrice("");
                }}
                className="self-end rounded-md bg-brand px-5 py-2.5 text-[13px] font-semibold text-card hover:bg-brand-soft"
              >
                Reset Filters
              </button>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((p) => (
                <div
                  key={p.name}
                  className="overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:border-brand-soft hover:shadow-lg"
                >
                  <div className="flex items-center justify-between bg-gradient-to-br from-brand-tint to-gold-tint px-5 py-6">
                    <div className="text-4xl" aria-hidden="true">
                      {p.icon}
                    </div>
                    <div className="rounded bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                      {p.property}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-2 text-base font-bold text-foreground">{p.name}</div>
                    <div className="mb-1 text-xl font-bold text-brand">{p.priceLabel}</div>
                    <div className="mb-4 text-xs text-muted-foreground">per property/month</div>
                    <div className="mb-4 flex flex-col gap-2.5 border-b border-border pb-4">
                      {p.benefits.map((b) => (
                        <div key={b} className="flex items-center gap-2 text-[13px] text-foreground">
                          <span className="font-bold text-success" aria-hidden="true">
                            ✓
                          </span>
                          {b}
                        </div>
                      ))}
                    </div>
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-success">
                      <span>●</span> Available
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-brand px-2.5 py-2.5 text-xs font-semibold text-card hover:bg-brand-soft"
                      >
                        Add Service
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-md border border-border bg-brand-tint px-2.5 py-2.5 text-xs font-semibold text-brand hover:bg-brand/15"
                      >
                        Learn More
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-4">
            {historyServices.map((s) => (
              <ServiceItem
                key={s.title}
                icon={s.icon}
                title={s.title}
                property={s.property}
                status="ended"
                info={s.info}
                actions={["View Details", "Download Invoice"]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
