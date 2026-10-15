import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export const EMBED_HANDLE = "cartkit-embed";

// Whether the Cartivo app embed is on in the live theme, from App Bridge's app.extensions() (the API the
// Built for Shopify homepage requirement 4.2.3 points to; it reads the published theme, so no theme-file
// access or read_themes scope is needed). null while loading or when it can't be determined.
// `when` = false skips the lookup.
export function useEmbedStatus(when = true) {
  const shopify = useAppBridge();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!when) return;
    let active = true;
    shopify.app
      .extensions()
      .then((extensions) => {
        const embed = extensions
          .filter((e) => e.type === "theme_app_extension")
          .flatMap((e) => e.activations as { handle: string; status: string }[])
          .find((a) => a.handle === EMBED_HANDLE);
        if (active) setEnabled(embed ? embed.status === "active" : false);
      })
      .catch(() => {
        if (active) setEnabled(null);
      });
    return () => {
      active = false;
    };
  }, [shopify, when]);

  return enabled;
}
