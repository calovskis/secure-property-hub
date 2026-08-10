export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
  "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming",
] as const;

export type USState = (typeof US_STATES)[number];

/** USPS two-letter codes, aligned with US_STATES ordering. */
export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT",
  "DE", "DC", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV",
  "NH", "NJ", "NM", "NY", "NC", "ND",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
] as const;

export type USStateCode = (typeof US_STATE_CODES)[number];

export const US_STATE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  US_STATE_CODES.map((c, i) => [c, US_STATES[i] as string]),
);
