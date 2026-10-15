import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

// Submits `payload` as JSON to the current route action and toasts the result.
export function useSave<T>() {
  const fetcher = useFetcher<{ saved?: boolean; syncError?: string | null; error?: string }>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.error) shopify.toast.show(fetcher.data.error, { isError: true });
    else if (fetcher.data.syncError)
      shopify.toast.show(`Saved, but publishing to the store failed: ${fetcher.data.syncError}`, { isError: true, duration: 8000 });
    else if (fetcher.data.saved) shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const save = (payload: T, extra: Record<string, string> = {}) =>
    fetcher.submit({ payload: JSON.stringify(payload), ...extra }, { method: "post" });

  return { save, saving: fetcher.state !== "idle", fetcher };
}
