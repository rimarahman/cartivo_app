// The manual "Shop domain" login form is for local development only. App Store requirement 2.3.1:
// merchants must never be asked to type a myshopify.com domain. Set ALLOW_MANUAL_LOGIN=true to show it
// on a non-production deployment.
export const manualLoginAllowed = () =>
  process.env.NODE_ENV !== "production" || process.env.ALLOW_MANUAL_LOGIN === "true";
