import { createElement, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ErrorBanner } from "./ErrorBanner";

type SaveResult = { saved?: boolean; syncError?: string | null; error?: string };

// The merchant-facing error for an action result, if any.
export function saveErrorMessage(data: SaveResult | undefined) {
  if (!data) return null;
  if (data.error) return data.error;
  if (data.syncError)
    return `Your changes were saved, but publishing them to your store failed: ${data.syncError}. Try "Republish to store" on the Dashboard.`;
  return null;
}

// Submits `payload` as JSON to the current route action. Success is confirmed with a toast; errors stay on
// the page in a critical banner (render `errorBanner` at the top of the page) until the merchant dismisses
// them or saves again, since a toast would disappear on its own (BFS 4.2.4).
export function useSave<T>() {
  const fetcher = useFetcher<SaveResult>();
  const shopify = useAppBridge();
  // The result whose error the merchant dismissed; a new result brings the banner back.
  const [dismissed, setDismissed] = useState<SaveResult | null>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.saved && !saveErrorMessage(fetcher.data)) shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const save = (payload: T, extra: Record<string, string> = {}) =>
    fetcher.submit({ payload: JSON.stringify(payload), ...extra }, { method: "post" });

  const error = fetcher.state === "idle" && fetcher.data !== dismissed ? saveErrorMessage(fetcher.data) : null;
  const errorBanner = error
    ? createElement(ErrorBanner, { message: error, onDismiss: () => setDismissed(fetcher.data ?? null) })
    : null;

  return { save, saving: fetcher.state !== "idle", fetcher, error, errorBanner };
}
