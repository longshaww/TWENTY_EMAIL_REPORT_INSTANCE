// Shared option sets for the NorthPeak reporting dimensions. Used both to
// declare the SELECT fields (src/fields/*) and to generate consistent seed data
// (scripts/seed-northpeak.ts), so labels/values never drift apart.

export type SelectOption = { value: string; label: string; color: string };

export const INDUSTRY_OPTIONS: SelectOption[] = [
  { value: 'SAAS', label: 'SaaS', color: 'blue' },
  { value: 'FINTECH', label: 'Fintech', color: 'green' },
  { value: 'HEALTHCARE', label: 'Healthcare', color: 'turquoise' },
  { value: 'MANUFACTURING', label: 'Manufacturing', color: 'orange' },
  { value: 'RETAIL', label: 'Retail', color: 'pink' },
  { value: 'EDUCATION', label: 'Education', color: 'purple' },
];

export const REGION_OPTIONS: SelectOption[] = [
  { value: 'NORTH_AMERICA', label: 'North America', color: 'blue' },
  { value: 'EMEA', label: 'EMEA', color: 'green' },
  { value: 'APAC', label: 'APAC', color: 'orange' },
  { value: 'LATAM', label: 'LATAM', color: 'purple' },
];

export const LEAD_SOURCE_OPTIONS: SelectOption[] = [
  { value: 'INBOUND', label: 'Inbound', color: 'green' },
  { value: 'OUTBOUND', label: 'Outbound', color: 'blue' },
  { value: 'PARTNER', label: 'Partner', color: 'purple' },
  { value: 'EVENT', label: 'Event', color: 'orange' },
  { value: 'REFERRAL', label: 'Referral', color: 'pink' },
];

// NorthPeak sells a sales-enablement / LMS platform across five product tiers.
export const PRODUCT_TIER_OPTIONS: SelectOption[] = [
  { value: 'STARTER', label: 'Starter', color: 'gray' },
  { value: 'GROWTH', label: 'Growth', color: 'blue' },
  { value: 'PRO', label: 'Pro', color: 'green' },
  { value: 'ENTERPRISE', label: 'Enterprise', color: 'purple' },
  { value: 'PLATFORM', label: 'Platform', color: 'red' },
];

// Standard Twenty Opportunity stages (from OpportunityStageEnum). CUSTOMER = won.
export const OPPORTUNITY_STAGES = ['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'] as const;
