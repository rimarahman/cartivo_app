// Shared by the Help page, the support inbox and the server.
export const SUPPORT_CATEGORIES = {
  setup: "Setup & installation",
  theme: "Theme compatibility",
  campaigns: "Campaigns & discounts",
  billing: "Billing & plans",
  feature: "Feature request",
  other: "Something else",
} as const;
export type SupportCategory = keyof typeof SUPPORT_CATEGORIES;
