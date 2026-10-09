/**
 * Inspection partners — services they offer and how US licensing works.
 *
 * Licensing is per state and per service. Home inspection is licensed by most
 * states (e.g. Texas TREC, Florida DBPR, New York Department of State), while
 * a handful have no state licence. Specialist services follow their own rules:
 * wood-destroying-organism (termite) reports need a state pest-control licence,
 * lead and asbestos need EPA / state certification, structural opinions need a
 * Professional Engineer (PE) licence, radon and mold are licensed only in some
 * states. Rules below are a working guide pending Loqal legal confirmation.
 */

export type InspectionServiceId =
  | "home"
  | "commercial"
  | "new_construction"
  | "wdo"
  | "radon"
  | "mold"
  | "sewer"
  | "septic"
  | "well"
  | "roof"
  | "pool"
  | "chimney"
  | "hvac"
  | "structural"
  | "lead"
  | "asbestos"
  | "four_point";

export type InspectionService = {
  id: InspectionServiceId;
  label: string;
  hint: string;
  /** Which properties it applies to. */
  propertyTypes: ("house" | "apartment" | "commercial" | "land")[];
};

export const INSPECTION_SERVICES: InspectionService[] = [
  { id: "home", label: "General home inspection", hint: "Full residential inspection (ASHI / InterNACHI standards)", propertyTypes: ["house", "apartment"] },
  { id: "commercial", label: "Commercial property condition assessment", hint: "PCA to ASTM E2018 — retail, office, garages", propertyTypes: ["commercial"] },
  { id: "new_construction", label: "New construction / phase inspections", hint: "Pre-pour, pre-drywall, final walk-through", propertyTypes: ["house"] },
  { id: "wdo", label: "Termite / wood-destroying organism (WDO)", hint: "WDI report often required by lenders", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "radon", label: "Radon testing", hint: "Continuous radon monitor or test kits", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "mold", label: "Mold assessment", hint: "Visual assessment, air / surface sampling", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "sewer", label: "Sewer line camera scope", hint: "Main lateral line to the street", propertyTypes: ["house", "commercial"] },
  { id: "septic", label: "Septic system inspection", hint: "Tank, distribution box and drain field", propertyTypes: ["house", "land"] },
  { id: "well", label: "Well water testing", hint: "Flow, bacteria and potability tests", propertyTypes: ["house", "land"] },
  { id: "roof", label: "Roof inspection / certification", hint: "Condition and remaining life", propertyTypes: ["house", "commercial"] },
  { id: "pool", label: "Pool & spa inspection", hint: "Equipment, structure and safety", propertyTypes: ["house"] },
  { id: "chimney", label: "Chimney inspection (Level 1–2)", hint: "CSIA-certified sweep inspection", propertyTypes: ["house"] },
  { id: "hvac", label: "HVAC evaluation", hint: "Heating and cooling system review", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "structural", label: "Structural engineering report", hint: "Foundation and framing — signed by a PE", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "lead", label: "Lead-based paint inspection", hint: "Homes built before 1978", propertyTypes: ["house", "apartment"] },
  { id: "asbestos", label: "Asbestos survey", hint: "Sampling before renovation", propertyTypes: ["house", "apartment", "commercial"] },
  { id: "four_point", label: "4-point & wind mitigation (insurance)", hint: "Florida insurance inspections", propertyTypes: ["house"] },
  
];

export const SERVICE_LABEL = Object.fromEntries(INSPECTION_SERVICES.map((s) => [s.id, s.label])) as Record<InspectionServiceId, string>;

/** States without a state home-inspector licence. */
const HOME_UNLICENSED = new Set(["CA", "CO", "DC", "GA", "HI", "ID", "IA", "KS", "ME", "MI", "MN", "MO", "MT", "NE", "NM", "UT", "WY"]);
/** States that license radon measurement professionals. */
const RADON_LICENSED = new Set(["FL", "IL", "IA", "KS", "KY", "ME", "NE", "NJ", "NY", "OH", "PA", "WV"]);
/** States that license mold assessors. */
const MOLD_LICENSED = new Set(["FL", "LA", "MD", "NY", "TX"]);

export type LicenceRule = {
  /** A licence / certification number is mandatory for this service here. */
  required: boolean;
  /** Field label, e.g. "State home inspector licence №". */
  label: string;
  /** One-line explanation of who issues it. */
  note: string;
};

export function licenceRule(service: InspectionServiceId, state: string): LicenceRule {
  switch (service) {
    case "home":
    case "new_construction":
      return HOME_UNLICENSED.has(state)
        ? { required: false, label: "Certification / membership №", note: `${state} has no state home-inspector licence — add your ASHI or InterNACHI number if you have one.` }
        : { required: true, label: "State home inspector licence №", note: `${state} licenses home inspectors through its state board.` };
    case "four_point":
      return state === "FL"
        ? { required: true, label: "Florida licence №", note: "Licensed home inspector, contractor, architect or engineer (DBPR)." }
        : { required: false, label: "Certification №", note: "Mostly requested by Florida insurers." };
    case "wdo":
      return { required: true, label: "Pest control / WDO licence №", note: "Issued by the state department of agriculture or structural pest control board." };
    case "radon":
      return RADON_LICENSED.has(state)
        ? { required: true, label: "State radon licence №", note: `${state} licenses radon measurement professionals.` }
        : { required: false, label: "NRPP / NRSB certification №", note: "No state licence — national certification is recommended." };
    case "mold":
      return MOLD_LICENSED.has(state)
        ? { required: true, label: "State mold assessor licence №", note: `${state} licenses mold assessors.` }
        : { required: false, label: "Certification №", note: "No state licence — add any industry certification." };
    case "septic":
      return { required: true, label: "Septic inspector certification №", note: "State or county certification for onsite wastewater systems." };
    case "structural":
      return { required: true, label: "Professional Engineer (PE) licence №", note: "Structural opinions must be signed by a state-licensed PE." };
    case "lead":
      return { required: true, label: "EPA / state lead inspector certification №", note: "Lead-based paint inspections need EPA or state-authorised certification." };
    case "asbestos":
      return { required: true, label: "Asbestos inspector accreditation №", note: "AHERA / state accreditation for asbestos inspectors." };
    case "commercial":
      return { required: false, label: "Certification №", note: "No state licence for PCAs — ASTM E2018 practice; add any certification." };
    default:
      return { required: false, label: "Certification №", note: "No state licence — add any certification you hold." };
  }
}

export type InspectorServiceLicence = {
  service: InspectionServiceId;
  number: string;
  validUntil: string;
};

export type InspectorStateCoverage = {
  state: string;
  services: InspectorServiceLicence[];
};

export type InspectorPerson = {
  id: string;
  firstName: string;
  lastName: string;
  languages: string[];
};

export type InspectorProfile = {
  legalName: string;
  dba?: string | undefined;
  entityType: "llc" | "corporation" | "sole_proprietor" | "partnership";
  ein?: string | undefined;
  mailingSameAsBusiness: boolean;
  mailingAddress?: { country: string; state: string; city: string; street: string; zip: string } | undefined;
  website?: string | undefined;
  mainPhone: string;
  operationsEmail: string;
  yearsInOperation: number;
  inspectorCount: number;
  companyLanguages: string[];
  inspectors: InspectorPerson[];
  coverage: InspectorStateCoverage[];
};

export const ENTITY_TYPE_LABEL: Record<InspectorProfile["entityType"], string> = {
  llc: "LLC",
  corporation: "Corporation",
  sole_proprietor: "Individual / sole proprietor",
  partnership: "Partnership",
};
