import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PropertiesInAction } from "@/components/property/PropertiesInAction";
import { useClientPropertyActivity } from "@/lib/property-activity";
import { useAuth } from "@/lib/auth";
import { recordSearch } from "@/lib/presence";
import { allProperties, formatPrice, type Property } from "@/data/properties";



export const Route = createFileRoute("/marketplace")({
  component: MarketplacePage,
  head: () => ({
    meta: [
      { title: "LOQAL - Properties Marketplace" },
      {
        name: "description",
        content:
          "Discover residential and commercial properties available for purchase or investment on LOQAL.",
      },
      { property: "og:title", content: "LOQAL - Properties Marketplace" },
      {
        property: "og:description",
        content:
          "Discover residential and commercial properties available for purchase or investment on LOQAL.",
      },
    ],
  }),
});

const PROPERTIES_PER_PAGE = 6;


function MarketplacePage() {
  const navigate = useNavigate();
  const [locationInput, setLocationInput] = useState("");

  const [priceRange, setPriceRange] = useState("");
  const [propType, setPropType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqftMin, setSqftMin] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState<"search" | "action">("search");

  /** Properties this client already has an active process on. */
  const activity = useClientPropertyActivity();
  const activeIds = useMemo(() => new Set(activity.map((a) => a.propertyId)), [activity]);
  const awaitingTotal = activity.reduce((sum, a) => sum + a.awaitingClient, 0);

  const [appliedFilters, setAppliedFilters] = useState({
    location: "",
    priceRange: "",
    type: "",
    beds: "",
    baths: "",
  });

  const filteredProperties = useMemo(() => {
    const filtered = allProperties.filter((prop) => {
      if (
        appliedFilters.location &&
        !prop.location.toLowerCase().includes(appliedFilters.location.toLowerCase())
      )
        return false;
      if (appliedFilters.type && prop.type !== appliedFilters.type) return false;
      if (appliedFilters.beds && prop.beds < parseInt(appliedFilters.beds)) return false;
      if (appliedFilters.baths && prop.baths < parseInt(appliedFilters.baths)) return false;

      if (appliedFilters.priceRange) {
        const [minStr, maxStr] = appliedFilters.priceRange.split("-");
        const min = parseInt(minStr ?? "0");
        const max = !maxStr || maxStr === "+" ? Infinity : parseInt(maxStr);
        if (prop.price < min || prop.price > max) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case "price-low":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "featured":
        sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => b.id - a.id);
    }

    return sorted;
  }, [appliedFilters, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE));
  const start = (currentPage - 1) * PROPERTIES_PER_PAGE;
  const pagingProperties = filteredProperties.slice(start, start + PROPERTIES_PER_PAGE);

  const handleSearch = () => {
    setAppliedFilters({
      location: locationInput,
      priceRange,
      type: propType,
      beds,
      baths,
    });
    const [minStr, maxStr] = priceRange ? priceRange.split("-") : [];
    recordSearch(user?.email, {
      query: [propType, beds ? `${beds}+ beds` : "", baths ? `${baths}+ baths` : ""]
        .filter(Boolean)
        .join(" · "),
      area: locationInput,
      priceMin: minStr ? Number(minStr) : undefined,
      priceMax: maxStr ? Number(maxStr) : undefined,
    });
    setCurrentPage(1);
  };


  const handleReset = () => {
    setLocationInput("");
    setPriceRange("");
    setPropType("");
    setBeds("");
    setBaths("");
    setSqftMin("");
    setAppliedFilters({ location: "", priceRange: "", type: "", beds: "", baths: "" });
    setCurrentPage(1);
  };

  const saveProperty = (id: number) => {
    alert(`Property ${id} saved to your favorites!`);
  };

  const openProperty = (id: number) => {
    navigate({ to: "/property/$propertyId", params: { propertyId: String(id) } });
  };


  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Properties" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-[32px]">
            Property Marketplace
          </h1>
          <p className="text-sm text-muted-foreground">
            Discover residential and commercial properties available for purchase or investment
          </p>
        </div>

        {/* TABS: search vs properties with active processes */}
        {activity.length > 0 ? (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              className={`rounded-md border px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === "search"
                  ? "border-brand bg-brand text-background"
                  : "border-border bg-card text-foreground hover:bg-brand-tint"
              }`}
              onClick={() => setTab("search")}
            >
              All properties
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === "action"
                  ? "border-brand bg-brand text-background"
                  : "border-brand/40 bg-brand-tint text-brand hover:bg-brand/15"
              }`}
              onClick={() => setTab("action")}
            >
              Properties in action
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                  tab === "action" ? "bg-background/20" : "bg-brand/15"
                }`}
              >
                {activity.length}
              </span>
              {awaitingTotal > 0 ? (
                <span className="rounded border border-gold/40 bg-gold-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gold">
                  {awaitingTotal} to answer
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        {tab === "action" ? (
          <PropertiesInAction items={activity} />
        ) : (
          <>
        {/* FILTER SECTION */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-5 text-base font-semibold text-foreground">
            <span aria-hidden="true">🔍</span> Search & Filter Properties
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location (City/State)
              </label>
              <input
                type="text"
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="e.g., New York, NY"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Price Range
              </label>
              <select
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
              >
                <option value="">All Prices</option>
                <option value="0-250000">$0 - $250K</option>
                <option value="250000-500000">$250K - $500K</option>
                <option value="500000-1000000">$500K - $1M</option>
                <option value="1000000-2000000">$1M - $2M</option>
                <option value="2000000-+">$2M+</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Property Type
              </label>
              <select
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={propType}
                onChange={(e) => setPropType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Multi-Family">Multi-Family</option>
                <option value="Industrial">Industrial</option>
                <option value="Land">Land</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bedrooms
              </label>
              <select
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
              >
                <option value="">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bathrooms
              </label>
              <select
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
              >
                <option value="">Any</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Square Footage
              </label>
              <input
                type="text"
                className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="Min Sqft"
                value={sqftMin}
                onChange={(e) => setSqftMin(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
              onClick={handleSearch}
            >
              <span aria-hidden="true">🔍</span> Search
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-border bg-brand-tint px-5 py-2.5 text-sm font-semibold text-brand hover:bg-gold-tint"
              onClick={handleReset}
            >
              <span aria-hidden="true">↺</span> Reset
            </button>
          </div>
        </div>

        {/* RESULTS HEADER */}
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="text-sm text-muted-foreground">
            Showing <strong className="font-semibold text-brand">{filteredProperties.length}</strong> of{" "}
            <strong className="font-semibold text-brand">147</strong> properties
          </div>
          <select
            className="cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="newest">Newest Listings</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="featured">Featured First</option>
          </select>
        </div>

        {/* PROPERTIES GRID */}
        {pagingProperties.length === 0 ? (
          <div className="mt-8 rounded-lg border border-border bg-card px-10 py-20 text-center">
            <div className="mb-4 text-6xl" aria-hidden="true">
              🔍
            </div>
            <div className="mb-2 text-xl font-semibold text-foreground">No properties found</div>
            <div className="text-sm text-muted-foreground">
              Try adjusting your filters to find more properties
            </div>
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {pagingProperties.map((prop) => (
              <div
                key={prop.id}
                onClick={() => openProperty(prop.id)}
                className={`cursor-pointer overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md ${
                  activeIds.has(prop.id)
                    ? "border-brand ring-2 ring-brand/25"
                    : "border-border hover:border-brand-soft"
                }`}
              >
                {activeIds.has(prop.id) ? (
                  <div className="flex items-center justify-between gap-2 border-b border-brand/20 bg-brand-tint px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                      In action
                    </span>
                    <button
                      className="text-[11px] font-semibold text-brand underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTab("action");
                        window.scrollTo(0, 0);
                      }}
                    >
                      See what is ongoing
                    </button>
                  </div>
                ) : null}

                <div className="relative flex h-[220px] items-center justify-center bg-gradient-to-br from-brand-tint to-gold-tint text-7xl">
                  <span aria-hidden="true">{prop.icon}</span>
                  {prop.featured ? (
                    <div className="absolute right-3 top-3 rounded border border-gold/40 bg-gold-tint px-3 py-1.5 text-[11px] font-semibold uppercase text-gold">
                      Featured
                    </div>
                  ) : (
                    <div className="absolute right-3 top-3 rounded bg-brand/10 px-3 py-1.5 text-[11px] font-semibold uppercase text-brand">
                      Active
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="mb-2 text-2xl font-bold text-brand">{formatPrice(prop.price)}</div>
                  <div className="mb-1 text-sm font-semibold text-foreground">{prop.address}</div>
                  <div className="mb-4 text-xs text-muted-foreground">{prop.location}</div>
                  <div className="mb-3">
                    <span className="inline-block rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">
                      {prop.type}
                    </span>
                  </div>
                  <div className="mb-4 flex gap-4 border-b border-border pb-4">
                    {prop.beds > 0 && (
                      <div className="flex flex-1 flex-col items-center">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Beds
                        </div>
                        <div className="text-sm font-semibold text-foreground">{prop.beds}</div>
                      </div>
                    )}
                    {prop.baths > 0 && (
                      <div className="flex flex-1 flex-col items-center">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Baths
                        </div>
                        <div className="text-sm font-semibold text-foreground">{prop.baths}</div>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col items-center">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sqft
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {prop.sqft.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">

                    <button
                      className="flex-1 rounded-md border border-gold/30 bg-gold-tint px-2.5 py-2.5 text-xs font-semibold text-gold hover:bg-gold/20"
                      onClick={() => saveProperty(prop.id)}
                    >
                      <span aria-hidden="true">★</span> Save
                    </button>
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: String(prop.id) }}
                      className="flex-1 rounded-md bg-brand-tint px-2.5 py-2.5 text-center text-xs font-semibold text-brand hover:bg-brand/15"
                    >
                      <span aria-hidden="true">ℹ️</span> Details
                    </Link>
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: String(prop.id) }}
                      className="flex-1 rounded-md bg-brand px-2.5 py-2.5 text-center text-xs font-semibold text-background hover:bg-brand-soft"
                    >
                      → Proceed
                    </Link>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        <div className="mt-10 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`rounded-md border px-3 py-2.5 text-sm transition-all ${
                page === currentPage
                  ? "border-brand bg-brand text-background"
                  : "border-border bg-card text-foreground hover:border-brand hover:bg-brand-tint"
              }`}
              onClick={() => {
                setCurrentPage(page);
                window.scrollTo(0, 0);
              }}
            >
              {page}
            </button>
          ))}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
