import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/my-properties")({
  component: MyPropertiesPage,
  head: () => ({
    meta: [
      { title: "LOQAL - My Properties" },
      {
        name: "description",
        content: "Manage and monitor all your rental properties with LOQAL",
      },
      { property: "og:title", content: "LOQAL - My Properties" },
      {
        property: "og:description",
        content: "Manage and monitor all your rental properties with LOQAL",
      },
    ],
  }),
});

type PropertyType = "single" | "apartment" | "commercial";
type PropertyStatus = "occupied" | "vacant" | "maintenance";

type Property = {
  id: number;
  type: PropertyType;
  status: PropertyStatus;
  icon: string;
  badge: string;
  title: string;
  location: string;
  statusLevel: "ok" | "warning" | "critical";
  statusText: string;
  units: number;
  unitsLabel: string;
  occupied: number;
  revenue: string;
};

const PROPERTIES: Property[] = [
  {
    id: 1,
    type: "apartment",
    status: "occupied",
    icon: "🏢",
    badge: "Occupied",
    title: "Downtown Plaza",
    location: "Downtown District",
    statusLevel: "ok",
    statusText: "Fully Operational",
    units: 42,
    unitsLabel: "Units",
    occupied: 40,
    revenue: "$18.5K",
  },
  {
    id: 2,
    type: "apartment",
    status: "occupied",
    icon: "🏢",
    badge: "Occupied",
    title: "Riverside Apartments",
    location: "Riverside District",
    statusLevel: "ok",
    statusText: "Fully Operational",
    units: 28,
    unitsLabel: "Units",
    occupied: 27,
    revenue: "$9.5K",
  },
  {
    id: 3,
    type: "apartment",
    status: "occupied",
    icon: "🏢",
    badge: "Occupied",
    title: "Oak Street Complex",
    location: "Midtown",
    statusLevel: "warning",
    statusText: "Needs Attention",
    units: 15,
    unitsLabel: "Units",
    occupied: 13,
    revenue: "$4.2K",
  },
  {
    id: 4,
    type: "single",
    status: "occupied",
    icon: "🏠",
    badge: "Occupied",
    title: "Cedar House",
    location: "Suburban Area",
    statusLevel: "ok",
    statusText: "Fully Operational",
    units: 1,
    unitsLabel: "Unit",
    occupied: 1,
    revenue: "$1.8K",
  },
  {
    id: 5,
    type: "single",
    status: "vacant",
    icon: "🏠",
    badge: "Vacant",
    title: "Pine Street House",
    location: "Suburban Area",
    statusLevel: "warning",
    statusText: "Vacant - Marketing",
    units: 1,
    unitsLabel: "Unit",
    occupied: 0,
    revenue: "$0",
  },
  {
    id: 6,
    type: "commercial",
    status: "occupied",
    icon: "🏪",
    badge: "Occupied",
    title: "Commerce Plaza",
    location: "Business District",
    statusLevel: "ok",
    statusText: "Fully Operational",
    units: 8,
    unitsLabel: "Units",
    occupied: 8,
    revenue: "$4.2K",
  },
  {
    id: 7,
    type: "single",
    status: "maintenance",
    icon: "🏠",
    badge: "Maintenance",
    title: "Birch Avenue",
    location: "Suburban Area",
    statusLevel: "critical",
    statusText: "Under Maintenance",
    units: 1,
    unitsLabel: "Unit",
    occupied: 0,
    revenue: "$0",
  },
  {
    id: 8,
    type: "apartment",
    status: "occupied",
    icon: "🏢",
    badge: "Occupied",
    title: "Maple Tower",
    location: "Downtown District",
    statusLevel: "ok",
    statusText: "Fully Operational",
    units: 20,
    unitsLabel: "Units",
    occupied: 19,
    revenue: "$5.5K",
  },
];

const STATS = [
  { icon: "🏘️", label: "Total Properties", value: "8" },
  { icon: "👥", label: "Total Tenants", value: "31" },
  { icon: "💰", label: "Monthly Revenue", value: "$18,500" },
  { icon: "📊", label: "Occupancy Rate", value: "96.8%" },
];

function statusDotClass(level: Property["statusLevel"]) {
  if (level === "warning") return "bg-warning";
  if (level === "critical") return "bg-destructive";
  return "bg-success";
}

function MyPropertiesPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    return PROPERTIES.filter((p) => {
      const typeMatch = !typeFilter || p.type === typeFilter;
      const statusMatch = !statusFilter || p.status === statusFilter;
      return typeMatch && statusMatch;
    });
  }, [typeFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My Loqal" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        {/* PAGE HEADER */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="flex-1">
            <h1 className="mb-2 text-2xl font-bold text-foreground md:text-[32px]">
              My Properties
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage and monitor all your rental properties with LOQAL
            </p>
          </div>
          <button
            type="button"
            className="whitespace-nowrap rounded-md bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-soft"
          >
            + Add Property
          </button>
        </div>

        {/* STATS BAR */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex size-[60px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-tint to-gold-tint text-3xl">
                <span aria-hidden>{stat.icon}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </div>
                <div className="text-2xl font-bold text-brand">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="cursor-pointer rounded-md border border-border px-3 py-2 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
            >
              <option value="">All Property Types</option>
              <option value="single">Single-Family Home</option>
              <option value="apartment">Apartment Building</option>
              <option value="commercial">Commercial</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cursor-pointer rounded-md border border-border px-3 py-2 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
            >
              <option value="">All Status</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
              <option value="maintenance">Under Maintenance</option>
            </select>
          </div>

          <div className="flex gap-2 rounded-md bg-brand-tint p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                view === "grid"
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                view === "list"
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              ≡ List
            </button>
          </div>
        </div>

        {/* PROPERTIES GRID */}
        <div
          className={`mb-8 grid gap-6 ${
            view === "list"
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {filtered.map((property) => (
            <div
              key={property.id}
              className={`overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:border-brand-soft hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] ${
                view === "list" ? "flex flex-col sm:flex-row" : ""
              }`}
            >
              <div
                className={`relative flex items-center justify-center bg-gradient-to-br from-brand-tint to-gold-tint text-6xl ${
                  view === "list" ? "h-40 sm:w-56 sm:shrink-0" : "h-44"
                }`}
              >
                <span aria-hidden>{property.icon}</span>
                <div className="absolute right-3 top-3 rounded-full bg-card px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                  {property.badge}
                </div>
              </div>
              <div
                className={`flex flex-1 flex-col justify-between gap-4 p-5 ${
                  view === "list" ? "sm:flex-row sm:items-center" : ""
                }`}
              >
                <div>
                  <div className="mb-1 text-lg font-bold text-foreground">
                    {property.title}
                  </div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    <span aria-hidden>📍</span> {property.location}
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${statusDotClass(
                        property.statusLevel,
                      )}`}
                    />
                    <span>{property.statusText}</span>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-start">
                      <div className="text-lg font-bold text-brand">
                        {property.units}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {property.unitsLabel}
                      </div>
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="text-lg font-bold text-brand">
                        {property.occupied}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Occupied
                      </div>
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="text-lg font-bold text-brand">
                        {property.revenue}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Revenue
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-soft"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
              <div className="text-5xl" aria-hidden>
                🏘️
              </div>
              <div className="text-lg font-bold text-foreground">
                No properties found
              </div>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters to see more results.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
