import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
  head: () => ({
    meta: [
      { title: "LOQAL - Documents" },
      {
        name: "description",
        content:
          "Secure storage and management for all your property documents, contracts, and records.",
      },
      { property: "og:title", content: "LOQAL - Documents" },
      {
        property: "og:description",
        content:
          "Secure storage and management for all your property documents, contracts, and records.",
      },
    ],
  }),
});

type DocCategory = "leases" | "financial" | "legal" | "inspections" | "tax";

type Doc = {
  id: string;
  icon: string;
  name: string;
  meta: string;
  category: DocCategory;
  badgeLabel: string;
  date: string;
};

const BADGE_STYLES: Record<DocCategory, string> = {
  leases: "bg-brand/15 text-brand",
  financial: "bg-success/15 text-success",
  legal: "bg-brand-soft/15 text-brand-soft",
  inspections: "bg-warning/15 text-warning",
  tax: "bg-destructive/15 text-destructive",
};

const DOCUMENTS: Doc[] = [
  {
    id: "lease-dt-plaza-001",
    icon: "📄",
    name: "Downtown Plaza - Lease Agreement Unit 42A",
    meta: "PDF • 2.4 MB",
    category: "leases",
    badgeLabel: "Lease",
    date: "Modified: 03/10/2026",
  },
  {
    id: "financial-2026-q1",
    icon: "💰",
    name: "Q1 2026 Financial Summary - All Properties",
    meta: "XLSX • 1.8 MB",
    category: "financial",
    badgeLabel: "Financial",
    date: "Modified: 03/08/2026",
  },
  {
    id: "inspection-riverside-2026",
    icon: "🔍",
    name: "Riverside Apartments - Annual Inspection Report",
    meta: "PDF • 3.2 MB",
    category: "inspections",
    badgeLabel: "Inspection",
    date: "Modified: 03/05/2026",
  },
  {
    id: "tax-2025-form",
    icon: "📊",
    name: "2025 Tax Return - Schedule E Rental Income",
    meta: "PDF • 1.1 MB",
    category: "tax",
    badgeLabel: "Tax",
    date: "Modified: 02/28/2026",
  },
  {
    id: "legal-insurance-policy",
    icon: "⚖️",
    name: "Property Insurance Policy - 2026 Coverage",
    meta: "PDF • 890 KB",
    category: "legal",
    badgeLabel: "Legal",
    date: "Modified: 02/15/2026",
  },
  {
    id: "lease-maple-tower-12b",
    icon: "📄",
    name: "Maple Tower - Lease Agreement Unit 12B",
    meta: "PDF • 2.1 MB",
    category: "leases",
    badgeLabel: "Lease",
    date: "Modified: 02/12/2026",
  },
  {
    id: "financial-jan-2026",
    icon: "💰",
    name: "January 2026 Revenue Statement",
    meta: "PDF • 645 KB",
    category: "financial",
    badgeLabel: "Financial",
    date: "Modified: 02/01/2026",
  },
  {
    id: "inspection-commerce-plaza",
    icon: "🔍",
    name: "Commerce Plaza - Fire Safety Inspection",
    meta: "PDF • 1.5 MB",
    category: "inspections",
    badgeLabel: "Inspection",
    date: "Modified: 01/28/2026",
  },
  {
    id: "legal-deed-oak-street",
    icon: "⚖️",
    name: "Oak Street Complex - Property Deed",
    meta: "PDF • 2.8 MB",
    category: "legal",
    badgeLabel: "Legal",
    date: "Modified: 01/15/2026",
  },
];

const TABS: { key: "all" | DocCategory; label: string }[] = [
  { key: "all", label: "All Documents" },
  { key: "leases", label: "Lease Agreements" },
  { key: "financial", label: "Financial Records" },
  { key: "legal", label: "Legal Documents" },
  { key: "inspections", label: "Inspections" },
  { key: "tax", label: "Tax Documents" },
];

function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<"all" | DocCategory>("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("recent");

  const visibleDocs = useMemo(() => {
    const filtered =
      activeTab === "all"
        ? DOCUMENTS
        : DOCUMENTS.filter((d) => d.category === activeTab);
    const sorted = [...filtered];
    if (sortFilter === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortFilter === "type") {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    }
    return sorted;
  }, [activeTab, sortFilter]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My Loqal" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="flex-1">
            <h1 className="mb-2 text-[32px] font-bold text-foreground">
              Documents
            </h1>
            <p className="text-sm text-muted-foreground">
              Secure storage and management for all your property documents,
              contracts, and records
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="whitespace-nowrap rounded-md bg-brand px-5 py-2.5 text-[13px] font-semibold text-card transition-colors hover:bg-brand-soft"
            >
              <span aria-hidden="true">📤</span> Upload Document
            </button>
            <button
              type="button"
              className="whitespace-nowrap rounded-md border border-border bg-brand-tint px-5 py-2.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/15"
            >
              <span aria-hidden="true">📁</span> New Folder
            </button>
          </div>
        </div>

        {/* STORAGE INFO */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-base font-bold text-foreground">
              <span aria-hidden="true">💾</span> Storage Usage
            </div>
            <div className="text-sm text-muted-foreground">
              3.2 GB of 10 GB used
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-tint">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: "32%" }}
            />
          </div>
        </div>

        {/* TABS */}
        <div className="mb-8 flex gap-3 overflow-x-auto border-b-2 border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-[3px] px-5 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-brand"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FILTERS BAR */}
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 px-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Property
            </label>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="all">All Properties</option>
              <option value="downtown">Downtown Plaza</option>
              <option value="riverside">Riverside Apartments</option>
              <option value="maple">Maple Tower</option>
              <option value="commerce">Commerce Plaza</option>
              <option value="oak">Oak Street Complex</option>
              <option value="cedar">Cedar House</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="all">All Time</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sort By
            </label>
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name (A-Z)</option>
              <option value="size">File Size</option>
              <option value="type">Document Type</option>
            </select>
          </div>
        </div>

        {/* DOCUMENT GRID */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-all hover:border-brand-soft hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 text-3xl" aria-hidden="true">
                  {doc.icon}
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-sm font-semibold text-foreground">
                    {doc.name}
                  </div>
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    {doc.meta}
                  </div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${BADGE_STYLES[doc.category]}`}
                  >
                    {doc.badgeLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="text-[11px] text-muted-foreground">
                  {doc.date}
                </div>
                <div className="flex gap-2">
                  <span
                    className="cursor-pointer text-base text-muted-foreground transition-colors hover:text-brand"
                    aria-hidden="true"
                  >
                    ⬇️
                  </span>
                  <span
                    className="cursor-pointer text-base text-muted-foreground transition-colors hover:text-brand"
                    aria-hidden="true"
                  >
                    📤
                  </span>
                  <span
                    className="cursor-pointer text-base text-muted-foreground transition-colors hover:text-brand"
                    aria-hidden="true"
                  >
                    🗑️
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
