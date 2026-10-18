import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

type RepublishResult = { ok: boolean; error: string | null };

// Publishes the saved configuration to the storefront again (app.republish.tsx). Success is a toast;
// `error` is the merchant-facing message when it failed, for the caller to show in a banner.
export function useRepublish() {
  const fetcher = useFetcher<RepublishResult>();
  const shopify = useAppBridge();
  const done = fetcher.state === "idle" ? fetcher.data : undefined;

  useEffect(() => {
    if (done?.ok) shopify.toast.show("Published to your store");
  }, [done, shopify]);

  return {
    republish: () => fetcher.submit({}, { method: "post", action: "/app/republish" }),
    republishing: fetcher.state !== "idle",
    result: done,
    error: done && !done.ok ? `Publishing to your store failed: ${done.error}. Try again in a minute.` : null,
  };
}
