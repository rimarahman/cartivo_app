// Save / Discard for settings pages: header buttons plus the App Bridge contextual save bar,
// which appears while there are unsaved changes (and warns before leaving the page).
import { SaveBar } from "@shopify/app-bridge-react";

// JSON with sorted keys, so two equal objects compare equal regardless of key order.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const isDirty = (current: unknown, saved: unknown) => stableStringify(current) !== stableStringify(saved);

// The save bar's <button>s take App Bridge attributes that aren't in React's button types.
const primary = { variant: "primary" } as Record<string, string>;

// canSave: allow saving without changes (e.g. a new campaign with its defaults). Defaults to dirty.
export function SaveActions(props: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; canSave?: boolean }) {
  const { dirty, saving, onSave, onDiscard, canSave = dirty } = props;
  return (
    <>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={onSave}
        {...(saving ? { loading: true } : {})}
        {...(!canSave && !saving ? { disabled: true } : {})}
      >
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onDiscard} {...(!dirty || saving ? { disabled: true } : {})}>
        Discard
      </s-button>
      <SaveBar id="ckx-save-bar" open={dirty}>
        <button {...primary} {...(saving ? { loading: "" } : {})} onClick={onSave}>
          Save
        </button>
        <button onClick={onDiscard} {...(saving ? { disabled: true } : {})}>
          Discard
        </button>
      </SaveBar>
    </>
  );
}

// Always-visible Save / Discard on the page itself (the title bar can fold buttons into its "…" menu).
export function SaveCard(props: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; canSave?: boolean }) {
  const { dirty, saving, onSave, onDiscard, canSave = dirty } = props;
  return (
    <div className={`ckx-card ckx-savecard${dirty ? " ckx-dirty" : ""}`}>
      <span className="ckx-savecard-status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
      <s-stack direction="inline" gap="small-200">
        <s-button onClick={onDiscard} {...(!dirty || saving ? { disabled: true } : {})}>
          Discard
        </s-button>
        <s-button
          variant="primary"
          onClick={onSave}
          {...(saving ? { loading: true } : {})}
          {...(!canSave && !saving ? { disabled: true } : {})}
        >
          Save
        </s-button>
      </s-stack>
    </div>
  );
}
