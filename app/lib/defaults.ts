// Shared (client + server) shapes and defaults for settings and campaigns.

export type ProductRef = {
  productId: string; // gid://shopify/Product/1
  variantId?: string; // gid://shopify/ProductVariant/1
  handle: string;
  title: string;
  image?: string;
};

export const DEFAULT_SETTINGS = {
  drawer: {
    enabled: true,
    position: "right", // right | left
    width: 420,
    openOnAdd: true,
    interceptCartLinks: true,
    title: "Your cart",
    emptyText: "Your cart is empty",
    emptyButtonText: "Continue shopping",
    emptyButtonUrl: "/collections/all",
    checkoutText: "Checkout",
    showSubtotal: true,
    subtotalText: "Subtotal",
    showSavings: true,
    savingsText: "You save",
    showCompareAt: true,
    showVendor: false,
    showContinueShopping: true,
    continueShoppingText: "Continue shopping",
    showViewCart: false,
    viewCartText: "View cart",
    showNote: true,
    noteLabel: "Add order note",
    notePlaceholder: "Special instructions for your order",
    showDiscountField: true,
    discountPlaceholder: "Discount code",
    discountApplyText: "Apply",
    discountInvalidText: "This code isn't valid for your cart",
    showTerms: false,
    termsText:
      'I agree to the <a href="/policies/terms-of-service">terms and conditions</a>',
    termsError: "Please accept the terms and conditions to continue",
    taxesText: "Taxes and shipping calculated at checkout",
    showTaxesText: true,
  },
  design: {
    preset: "aurora",
    checkoutStyle: "gradient", // gradient | solid
    glass: false, // iOS-style translucent "liquid glass" drawer
    gradientFrom: "#4f46e5",
    gradientTo: "#db2777",
    checkoutTextColor: "#ffffff",
    accentColor: "#4f46e5",
    accentTextColor: "#ffffff",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    mutedColor: "#6b7280",
    borderColor: "#ececf1",
    progressColor: "#16a34a",
    progressBackground: "#ececf1",
    badgeColor: "#16a34a",
    borderRadius: 10,
    fontSize: 14,
    overlayOpacity: 45,
  },
  upsells: {
    enabled: true,
    mode: "auto", // auto (Shopify recommendations) | manual (upsell campaigns) | both
    intent: "related", // related | complementary
    title: "You may also like",
    limit: 3,
    layout: "carousel", // carousel | list
    buttonText: "Add",
  },
  sticky: {
    enabled: true,
    showOnDesktop: true,
    showOnMobile: true,
    position: "bottom", // bottom | top
    buttonText: "Add to cart",
    soldOutText: "Sold out",
    showImage: true,
    showPrice: true,
    showVariantPicker: true,
    showQuantity: true,
    backgroundColor: "#ffffff",
    textColor: "#111827",
    buttonColor: "#4f46e5",
    buttonTextColor: "#ffffff",
  },
  floating: {
    enabled: true,
    position: "bottom-right", // bottom-right | bottom-left | top-right | top-left
    hideWhenEmpty: false,
    showOnMobile: true,
    showOnDesktop: true,
    size: 56,
    backgroundColor: "#4f46e5",
    iconColor: "#ffffff",
    badgeColor: "#db2777",
    badgeTextColor: "#ffffff",
  },
  advanced: {
    customCss: "",
    customJs: "",
    customHtmlTop: "",
    customHtmlBottom: "",
    cartIconSelector: "",
    cartCountSelector: "",
    themeDrawerSelector: "",
    googleAnalytics: true,
    disableOnPaths: "",
  },
  // { "fr": { "drawer.title": "Votre panier", ... } }
  translations: {} as Record<string, Record<string, string>>,
};

export type Settings = typeof DEFAULT_SETTINGS;
export type Design = Settings["design"];

export type DesignTier = 0 | 1 | 2 | 3;

// One-click looks for the cart drawer. Each preset overrides the design colors only; the glass effect is its own
// switch that works with any look (only the Liquid glass look turns it on).
// `tier` is the lowest plan that includes the look: 0 Starter, 1 Essential, 2 Growth, 3 Premium.
export const DESIGN_PRESETS: { id: string; label: string; tier: DesignTier; design: Partial<Design> }[] = [
  {
    id: "aurora",
    label: "Aurora",
    tier: 3,
    design: {
      checkoutStyle: "gradient", gradientFrom: "#4f46e5", gradientTo: "#db2777", checkoutTextColor: "#ffffff", accentColor: "#4f46e5", accentTextColor: "#ffffff",
      backgroundColor: "#ffffff", textColor: "#111827", mutedColor: "#6b7280", borderColor: "#ececf1",
      progressColor: "#16a34a", progressBackground: "#ececf1", badgeColor: "#16a34a", borderRadius: 10,
    },
  },
  {
    id: "glass",
    label: "Liquid glass",
    tier: 3,
    design: {
      glass: true, checkoutStyle: "gradient", gradientFrom: "#0a84ff", gradientTo: "#bf5af2", checkoutTextColor: "#ffffff", accentColor: "#0a84ff", accentTextColor: "#ffffff",
      backgroundColor: "#f5f7ff", textColor: "#0b0b12", mutedColor: "#5b6070", borderColor: "#dfe3f0",
      progressColor: "#30d158", progressBackground: "#e4e7f2", badgeColor: "#1f9d4d", borderRadius: 16,
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    tier: 2,
    design: {
      checkoutStyle: "gradient", gradientFrom: "#f97316", gradientTo: "#e11d48", checkoutTextColor: "#ffffff", accentColor: "#ea580c", accentTextColor: "#ffffff",
      backgroundColor: "#fffaf5", textColor: "#1c1917", mutedColor: "#78716c", borderColor: "#f1e7dd",
      progressColor: "#ea580c", progressBackground: "#f1e7dd", badgeColor: "#c2410c", borderRadius: 12,
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    tier: 1,
    design: {
      checkoutStyle: "gradient", gradientFrom: "#0ea5e9", gradientTo: "#4f46e5", checkoutTextColor: "#ffffff", accentColor: "#0284c7", accentTextColor: "#ffffff",
      backgroundColor: "#ffffff", textColor: "#0f172a", mutedColor: "#64748b", borderColor: "#e2e8f0",
      progressColor: "#0ea5e9", progressBackground: "#e2e8f0", badgeColor: "#0284c7", borderRadius: 10,
    },
  },
  {
    id: "forest",
    label: "Forest",
    tier: 1,
    design: {
      checkoutStyle: "gradient", gradientFrom: "#059669", gradientTo: "#0e7490", checkoutTextColor: "#ffffff", accentColor: "#047857", accentTextColor: "#ffffff",
      backgroundColor: "#ffffff", textColor: "#052e16", mutedColor: "#5b6b62", borderColor: "#e3ece6",
      progressColor: "#10b981", progressBackground: "#e3ece6", badgeColor: "#047857", borderRadius: 8,
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    tier: 2,
    design: {
      checkoutStyle: "gradient", gradientFrom: "#8b5cf6", gradientTo: "#ec4899", checkoutTextColor: "#ffffff", accentColor: "#a78bfa", accentTextColor: "#0b0b12",
      backgroundColor: "#0f0f17", textColor: "#f4f4f5", mutedColor: "#a1a1aa", borderColor: "#262633",
      progressColor: "#a78bfa", progressBackground: "#262633", badgeColor: "#4ade80", borderRadius: 12,
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    tier: 0,
    design: {
      checkoutStyle: "solid", gradientFrom: "#111111", gradientTo: "#3f3f46", checkoutTextColor: "#ffffff", accentColor: "#111111", accentTextColor: "#ffffff",
      backgroundColor: "#ffffff", textColor: "#111111", mutedColor: "#6b7280", borderColor: "#e5e7eb",
      progressColor: "#111111", progressBackground: "#e5e7eb", badgeColor: "#15803d", borderRadius: 4,
    },
  },
];

// Storefront strings that can be translated per locale.
export const TRANSLATABLE_KEYS = [
  "drawer.title",
  "drawer.emptyText",
  "drawer.emptyButtonText",
  "drawer.checkoutText",
  "drawer.subtotalText",
  "drawer.savingsText",
  "drawer.continueShoppingText",
  "drawer.viewCartText",
  "drawer.noteLabel",
  "drawer.notePlaceholder",
  "drawer.discountPlaceholder",
  "drawer.discountApplyText",
  "drawer.discountInvalidText",
  "drawer.termsText",
  "drawer.termsError",
  "drawer.taxesText",
  "upsells.title",
  "upsells.buttonText",
  "sticky.buttonText",
  "sticky.soldOutText",
] as const;

export const CAMPAIGN_TYPES = {
  rewards: {
    label: "Cart goals & free gifts",
    description:
      "Multi-tier progress bar that unlocks free shipping, free gifts or discounts at cart value thresholds.",
  },
  bxgy: {
    label: "Buy X Get Y",
    description: "Buy a quantity of products and get other products free or discounted.",
  },
  volume: {
    label: "Volume discount",
    description: "Quantity breaks: buy more of a product, save more.",
  },
  announcement: {
    label: "Announcement & countdown timer",
    description: "Rotating announcements with an urgency countdown timer in the cart.",
  },
  upsell: {
    label: "In-cart upsell",
    description: "Recommend specific products when certain products are in the cart.",
  },
  addon: {
    label: "One-click add-on",
    description: "Checkbox add-on such as gift wrapping or shipping protection.",
  },
} as const;

export type CampaignType = keyof typeof CAMPAIGN_TYPES;

export type RewardTier = {
  id: string;
  threshold: number;
  type: "free_shipping" | "free_gift" | "percent_off" | "fixed_off";
  value: number;
  label: string;
  gifts: ProductRef[];
  currencyThresholds?: string; // Markets: "EUR 45, GBP 40"
};

export const DEFAULT_CAMPAIGN_CONFIG: Record<CampaignType, any> = {
  rewards: {
    basis: "subtotal", // subtotal | quantity
    progressText: "You're {{remaining}} away from {{reward}}",
    completeText: "🎉 Congrats! You've unlocked all rewards",
    giftPickerTitle: "Choose your free gift",
    tiers: [
      {
        id: "t1",
        threshold: 50,
        type: "free_shipping",
        value: 100,
        label: "Free shipping",
        gifts: [],
      },
    ] as RewardTier[],
  },
  bxgy: {
    buyProducts: [] as ProductRef[],
    buyQuantity: 1,
    getProducts: [] as ProductRef[],
    getQuantity: 1,
    percent: 100,
    autoAdd: true, // only applies while percent is 100 (free items)
    message: "Buy {{buyQuantity}}, get {{getQuantity}} {{discount}}!",
    unlockedMessage: "🎁 Your {{discount}} item has been added",
  },
  volume: {
    products: [] as ProductRef[], // empty = all products
    combineProducts: false,
    tiers: [
      { minQuantity: 2, percent: 10 },
      { minQuantity: 3, percent: 15 },
    ],
    tableTitle: "Buy more, save more",
    nextTierText: "Add {{quantity}} more to save {{percent}}%",
  },
  announcement: {
    messages: ["Free shipping on orders over $50"],
    rotateSeconds: 4,
    backgroundColor: "#111111",
    textColor: "#ffffff",
    timerEnabled: false,
    timerEnd: "", // empty = no timer
    timerText: "Offer ends in {{timer}}",
    expiredText: "Offer ended", // shown instead of 00:00:00 when the timer isn't hidden on expiry
    hideWhenExpired: true,
  },
  upsell: {
    triggerProducts: [] as ProductRef[], // empty = any cart
    upsellProducts: [] as ProductRef[],
    title: "Frequently bought together",
  },
  addon: {
    product: null as ProductRef | null,
    label: "Add gift wrapping for {{price}}",
    description: "",
  },
};

// Markets: "EUR 45, GBP 40" (or "EUR=45") -> { EUR: 45, GBP: 40 }. Invalid parts are ignored.
export function parseCurrencyAmounts(text: string | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of String(text || "").split(/[,;\n]/)) {
    const m = part.trim().match(/^([A-Za-z]{3})\s*[=:]?\s*([\d.]+)$/);
    if (m && Number(m[2]) >= 0) out[m[1].toUpperCase()] = Number(m[2]);
  }
  return out;
}

// Texts of each campaign type that can be translated per language (Markets).
// "tier.<id>.label" and "messages.<index>" keys are added per campaign.
export const CAMPAIGN_TEXT_KEYS: Record<CampaignType, { key: string; label: string }[]> = {
  rewards: [
    { key: "progressText", label: "Progress message" },
    { key: "completeText", label: "All rewards unlocked message" },
    { key: "giftPickerTitle", label: "Gift picker title" },
  ],
  bxgy: [
    { key: "message", label: "Promo message" },
    { key: "unlockedMessage", label: "Unlocked message" },
  ],
  volume: [
    { key: "tableTitle", label: "Product page table title" },
    { key: "nextTierText", label: "Cart upsell message" },
  ],
  announcement: [
    { key: "timerText", label: "Timer text" },
    { key: "expiredText", label: "Text after the offer ends" },
  ],
  upsell: [{ key: "title", label: "Section title" }],
  addon: [
    { key: "label", label: "Checkbox label" },
    { key: "description", label: "Description" },
  ],
};

export function deepMerge<T>(base: T, override: any): T {
  if (Array.isArray(base) || typeof base !== "object" || base === null) {
    return (override === undefined ? base : override) as T;
  }
  const out: any = { ...base };
  if (override && typeof override === "object") {
    for (const key of Object.keys(override)) {
      const b = (base as any)[key];
      out[key] =
        b && typeof b === "object" && !Array.isArray(b)
          ? deepMerge(b, override[key])
          : override[key];
    }
  }
  return out;
}

export function uid(prefix = "t") {
  return prefix + Math.random().toString(36).slice(2, 9);
}

// Each plan unlocks more one-click looks: Starter only Minimal, Premium all of them (BFS 4.3.7: locked in the
// editor, refused on save). The liquid glass effect is Premium, like the Liquid glass look. A look the merchant
// fine-tuned ("custom") stays theirs, without glass below Premium.
export const FREE_DESIGN_PRESET = "minimal";
export const GLASS_TIER: DesignTier = 3;
export const presetTier = (id: string): DesignTier => DESIGN_PRESETS.find((p) => p.id === id)?.tier ?? 0;
export function designForPlan(design: Design, tier: DesignTier): Design {
  const glass = design.glass && tier >= GLASS_TIER;
  if (design.preset === "custom" || presetTier(design.preset) <= tier) return { ...design, glass };
  const minimal = DESIGN_PRESETS.find((p) => p.id === FREE_DESIGN_PRESET)!;
  return { ...design, ...minimal.design, preset: FREE_DESIGN_PRESET, glass };
}
