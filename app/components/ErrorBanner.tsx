import { useEffect, useRef } from "react";

// Critical banner for errors that must stay visible until the merchant acts (BFS 4.2.4: errors are red and
// don't disappear on their own). The dismiss event is bound with addEventListener, like the fields in fields.tsx.
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const ref = useRef<any>(null);
  const cb = useRef(onDismiss);
  useEffect(() => {
    cb.current = onDismiss;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => cb.current();
    el.addEventListener("dismiss", handler);
    return () => el.removeEventListener("dismiss", handler);
  }, []);

  return (
    <s-banner ref={ref} tone="critical" heading="Something went wrong" dismissible>
      <s-paragraph>{message}</s-paragraph>
    </s-banner>
  );
}
