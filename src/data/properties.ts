export type Property = {
  id: number;
  featured: boolean;
  type: string;
  price: number;
  address: string;
  location: string;
  beds: number;
  baths: number;
  sqft: number;
  icon: string;
};

export const allProperties: Property[] = [
  { id: 1, featured: true, type: "Residential", price: 850000, address: "255 Park Avenue", location: "New York, NY", beds: 3, baths: 2, sqft: 2450, icon: "🏢" },
  { id: 2, featured: false, type: "Commercial", price: 1200000, address: "500 5th Avenue", location: "Los Angeles, CA", beds: 8, baths: 6, sqft: 12000, icon: "🏪" },
  { id: 3, featured: false, type: "Residential", price: 750000, address: "1825 Oak Street", location: "Chicago, IL", beds: 4, baths: 3, sqft: 3200, icon: "🏠" },
  { id: 4, featured: true, type: "Multi-Family", price: 2500000, address: "3030 Valley Road", location: "Houston, TX", beds: 24, baths: 18, sqft: 45000, icon: "🏘️" },
  { id: 5, featured: false, type: "Residential", price: 520000, address: "450 Bay Street", location: "Miami, FL", beds: 2, baths: 2, sqft: 1750, icon: "🏢" },
  { id: 6, featured: true, type: "Commercial", price: 3800000, address: "101 Market Street", location: "San Francisco, CA", beds: 0, baths: 0, sqft: 85000, icon: "🏢" },
  { id: 7, featured: false, type: "Residential", price: 1950000, address: "2001 Ocean Drive", location: "Miami Beach, FL", beds: 5, baths: 4, sqft: 5800, icon: "🏖️" },
  { id: 8, featured: false, type: "Industrial", price: 1400000, address: "5000 Industrial Way", location: "Dallas, TX", beds: 0, baths: 0, sqft: 50000, icon: "🏭" },
  { id: 9, featured: false, type: "Land", price: 425000, address: "Lot 45 Green Hills", location: "Austin, TX", beds: 0, baths: 0, sqft: 2.5, icon: "🌳" },
  { id: 10, featured: false, type: "Residential", price: 2200000, address: "1 Central Park South", location: "New York, NY", beds: 4, baths: 3, sqft: 4100, icon: "🏢" },
  { id: 11, featured: false, type: "Commercial", price: 900000, address: "2400 Shopping Center Drive", location: "Phoenix, AZ", beds: 6, baths: 6, sqft: 18000, icon: "🏪" },
  { id: 12, featured: true, type: "Multi-Family", price: 1750000, address: "450 Residential Lane", location: "Denver, CO", beds: 12, baths: 10, sqft: 20000, icon: "🏘️" },
];

export function formatPrice(price: number) {
  return "$" + Math.round(price).toLocaleString();
}

export function getProperty(id: number) {
  return allProperties.find((p) => p.id === id);
}

/** Illustrative investment model derived from the listing price. */
export function buildInvestmentModel(prop: Property) {
  const price = prop.price;
  const downPayment = price * 0.2;
  const loanAmount = price - downPayment;
  const monthlyRate = 0.065 / 12;
  const n = 360;
  const mortgage =
    (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const closingCosts = price * 0.025;
  const furnishing = 18000;
  const taxInsurance = (price * 0.0145) / 12;
  const hoa = Math.round((prop.sqft > 0 ? Math.min(prop.sqft, 3000) : 1000) * 0.3);

  // Short-term rental
  const nightly = Math.round((price * 0.00044) / 1) ;
  const occupancy = 0.71;
  const strGross = nightly * 30.4 * occupancy;
  const strFees = strGross * 0.04;
  const strMgmt = strGross * 0.18;
  const strUtilities = 260;
  const strCleaning = 310;
  const strMaintenance = 160;
  const strNoi =
    strGross - strFees - strMgmt - strUtilities - strCleaning - strMaintenance - taxInsurance - hoa;
  const strCashFlow = strNoi - mortgage;

  // Long-term rental
  const rent = price * 0.0068;
  const ltVacancy = rent * 0.05;
  const ltMgmt = rent * 0.08;
  const ltMaintenance = rent * 0.04;
  const ltLeasing = rent * 0.02;
  const ltNoi = rent - ltVacancy - ltMgmt - ltMaintenance - ltLeasing - taxInsurance - hoa;
  const ltCashFlow = ltNoi - mortgage;

  // Hybrid / medium-term
  const furnishedRent = rent * 1.14;
  const hyVacancy = furnishedRent * 0.045;
  const hyMgmt = furnishedRent * 0.1;
  const hyUtilities = 220;
  const hyCleaning = 90;
  const hyNoi = furnishedRent - hyVacancy - hyMgmt - hyUtilities - hyCleaning - taxInsurance - hoa;
  const hyCashFlow = hyNoi - mortgage;

  const cashInvestedStr = downPayment + closingCosts + furnishing;
  const cashInvestedLt = downPayment + closingCosts;

  return {
    price,
    downPayment,
    loanAmount,
    mortgage,
    closingCosts,
    furnishing,
    taxInsurance,
    hoa,
    estimate: price * 1.049,
    cashInvestedStr,
    cashInvestedLt,
    scenarios: {
      airbnb: {
        label: "Short-Term Rental",
        cashFlow: strCashFlow,
        blurb:
          "After assumed platform fees, management, utilities, maintenance reserve, cleaning turnover reserve, taxes, insurance, HOA, and mortgage.",
        mini: [
          { label: "Avg. nightly rate", value: formatPrice(nightly) },
          { label: "Occupancy", value: "71%" },
          { label: "Booked nights", value: "21.3" },
        ],
        annualGross: strGross * 12,
        capRate: ((strNoi + mortgage - mortgage) * 12) / price,
        coc: (strCashFlow * 12) / cashInvestedStr,
        left: [
          ["Gross booking revenue", strGross],
          ["Platform + payment fees", -strFees],
          ["Short-term rental management", -strMgmt],
          ["Utilities + internet", -strUtilities],
          ["Cleaning / turnover reserve", -strCleaning],
          ["Maintenance reserve", -strMaintenance],
        ] as [string, number][],
        right: [
          ["Property tax + insurance", -taxInsurance],
          ["HOA / condo fees", -hoa],
          ["Net operating income", strNoi],
          ["Mortgage payment", -mortgage],
          ["Estimated monthly cash flow", strCashFlow],
        ] as [string, number][],
        footNote: ["Break-even occupancy", "51%"] as [string, string],
      },
      longterm: {
        label: "Long-Term Rental",
        cashFlow: ltCashFlow,
        blurb:
          "Best for lower operational complexity, more predictable tenancy, and lighter management burden for remote ownership.",
        mini: [
          { label: "Market rent", value: formatPrice(rent) },
          { label: "Vacancy reserve", value: "5%" },
          { label: "Lease term", value: "12 mo" },
        ],
        annualGross: rent * 12,
        capRate: (ltNoi * 12) / price,
        coc: (ltCashFlow * 12) / cashInvestedLt,
        left: [
          ["Scheduled monthly rent", rent],
          ["Vacancy reserve", -ltVacancy],
          ["Long-term management", -ltMgmt],
          ["Maintenance reserve", -ltMaintenance],
          ["Leasing reserve", -ltLeasing],
        ] as [string, number][],
        right: [
          ["Property tax + insurance", -taxInsurance],
          ["HOA / condo fees", -hoa],
          ["Net operating income", ltNoi],
          ["Mortgage payment", -mortgage],
          ["Estimated monthly cash flow", ltCashFlow],
        ] as [string, number][],
        footNote: [
          "Debt service coverage",
          (ltNoi / mortgage).toFixed(2) + "x",
        ] as [string, string],
      },
      hybrid: {
        label: "Hybrid / Medium-Term",
        cashFlow: hyCashFlow,
        blurb:
          "Assumes a medium-term rental profile aimed at relocations, executives, or 30+ day stays with fewer turnovers than short-term rentals.",
        mini: [
          { label: "Monthly furnished rent", value: formatPrice(furnishedRent) },
          { label: "Occupancy", value: "88%" },
          { label: "Avg. stay", value: "47 days" },
        ],
        annualGross: furnishedRent * 12,
        capRate: (hyNoi * 12) / price,
        coc: (hyCashFlow * 12) / cashInvestedStr,
        left: [
          ["Furnished rental revenue", furnishedRent],
          ["Vacancy / gap reserve", -hyVacancy],
          ["Management", -hyMgmt],
          ["Utilities + internet", -hyUtilities],
          ["Cleaning reserve", -hyCleaning],
        ] as [string, number][],
        right: [
          ["Property tax + insurance", -taxInsurance],
          ["HOA / condo fees", -hoa],
          ["Net operating income", hyNoi],
          ["Mortgage payment", -mortgage],
          ["Estimated monthly cash flow", hyCashFlow],
        ] as [string, number][],
        footNote: ["Operational intensity", "Moderate"] as [string, string],
      },
    },
  };
}
