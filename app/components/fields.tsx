// Thin controlled wrappers around Polaris web components. Events are bound with
// addEventListener so they work regardless of React's custom-element event support.
import { useEffect, useRef, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ProductRef } from "../lib/defaults";

function useBoundElement<T>(
  value: T,
  onChange: (value: T) => void,
  read: (el: any) => T,
  prop: "value" | "checked" = "value",
) {
  const ref = useRef<any>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => cb.current(read(el));
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    return () => {
      el.removeEventListener("input", handler);
      el.removeEventListener("change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A property set before the Polaris script defines the element becomes an own property that hides
  // the component's setter forever (fields stay empty, presets don't apply). Wait for the definition
  // and drop any such shadowing property before writing the value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = true;
    const apply = () => {
      if (!active) return;
      if (Object.prototype.hasOwnProperty.call(el, prop)) delete el[prop];
      if (el[prop] !== value) el[prop] = value;
    };
    if (customElements.get(el.localName)) apply();
    else customElements.whenDefined(el.localName).then(apply);
    return () => {
      active = false;
    };
  }, [value, prop]);

  return ref;
}

type Base<T> = { label: string; value: T; onChange: (v: T) => void; details?: string };

export function TextField(props: Base<string> & { placeholder?: string; multiline?: number; error?: string; maxLength?: number }) {
  const ref = useBoundElement(props.value ?? "", props.onChange, (el) => el.value ?? "");
  if (props.multiline) {
    return (
      <s-text-area
        ref={ref}
        label={props.label}
        details={props.details}
        placeholder={props.placeholder}
        rows={props.multiline}
        error={props.error}
        maxLength={props.maxLength}
      />
    );
  }
  return (
    <s-text-field
      ref={ref}
      label={props.label}
      details={props.details}
      placeholder={props.placeholder}
      error={props.error}
      maxLength={props.maxLength}
    />
  );
}

export function NumberField(props: Base<number> & { min?: number; max?: number; step?: number; suffix?: string; prefix?: string }) {
  const ref = useBoundElement(String(props.value ?? ""), (v) => props.onChange(v === "" ? 0 : Number(v)), (el) => el.value ?? "");
  return (
    <s-number-field
      ref={ref}
      label={props.label}
      details={props.details}
      min={props.min}
      max={props.max}
      step={props.step}
      suffix={props.suffix}
      prefix={props.prefix}
    />
  );
}

export function Checkbox(props: Base<boolean>) {
  const ref = useBoundElement(!!props.value, props.onChange, (el) => !!el.checked, "checked");
  return <s-checkbox ref={ref} label={props.label} details={props.details} />;
}

export function Switch(props: Base<boolean>) {
  const ref = useBoundElement(!!props.value, props.onChange, (el) => !!el.checked, "checked");
  return <s-switch ref={ref} label={props.label} details={props.details} />;
}

export function Select(props: Base<string> & { options: { label: string; value: string }[] }) {
  const ref = useBoundElement(props.value, props.onChange, (el) => el.value);
  return (
    <s-select ref={ref} label={props.label} details={props.details}>
      {props.options.map((o) => (
        <s-option key={o.value} value={o.value}>
          {o.label}
        </s-option>
      ))}
    </s-select>
  );
}

export function ColorField(props: Base<string>) {
  const ref = useBoundElement(props.value, props.onChange, (el) => el.value);
  return <s-color-field ref={ref} label={props.label} details={props.details} />;
}

// datetime-local works in every browser; Polaris has no combined date+time field.
export function DateTimeField(props: Base<string | null>) {
  const local = props.value ? toLocalInput(props.value) : "";
  return (
    <s-stack gap="small-200">
      <s-text>{props.label}</s-text>
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => props.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        style={{ padding: "6px 8px", border: "1px solid #8a8a8a", borderRadius: 8, font: "inherit" }}
      />
      {props.details && <s-text color="subdued">{props.details}</s-text>}
    </s-stack>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Grid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${columns > 2 ? 160 : 220}px, 1fr))`, gap: 12 }}>
      {children}
    </div>
  );
}

// Product picker backed by the App Bridge resource picker.
export function ProductPicker(props: {
  label: string;
  value: ProductRef[];
  onChange: (v: ProductRef[]) => void;
  multiple?: boolean;
  variants?: boolean; // ask merchant to choose a specific variant
  details?: string;
}) {
  const shopify = useAppBridge();

  const pick = async () => {
    const selection: any = await shopify.resourcePicker({
      type: "product",
      multiple: props.multiple ?? true,
      action: "select",
      filter: { variants: !!props.variants },
      selectionIds: props.value.map((p) =>
        props.variants && p.variantId
          ? { id: p.productId, variants: [{ id: p.variantId }] }
          : { id: p.productId },
      ),
    } as any);
    if (!selection) return;
    const refs: ProductRef[] = [];
    for (const product of selection) {
      const variants = product.variants?.length ? product.variants : [null];
      const chosen = props.variants ? variants : [variants[0]];
      for (const v of chosen) {
        refs.push({
          productId: product.id,
          variantId: v?.id,
          handle: product.handle,
          title: props.variants && v && v.title !== "Default Title" ? `${product.title} – ${v.title}` : product.title,
          image: v?.image?.originalSrc || product.images?.[0]?.originalSrc || "",
        });
      }
    }
    props.onChange(props.multiple === false ? refs.slice(0, 1) : refs);
  };

  return (
    <s-stack gap="small-200">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text type="strong">{props.label}</s-text>
        <s-button onClick={pick} variant="secondary">
          {props.value.length ? "Change" : "Select products"}
        </s-button>
      </s-stack>
      {props.details && <s-text color="subdued">{props.details}</s-text>}
      {props.value.map((p, i) => (
        <s-stack key={p.productId + (p.variantId || "") + i} direction="inline" gap="small-200" alignItems="center">
          {p.image ? (
            <img src={p.image} alt="" width={32} height={32} style={{ objectFit: "cover", borderRadius: 4 }} />
          ) : null}
          <s-text>{p.title}</s-text>
          <s-button
            variant="tertiary"
            icon="x"
            accessibilityLabel="Remove"
            onClick={() => props.onChange(props.value.filter((_, j) => j !== i))}
          />
        </s-stack>
      ))}
    </s-stack>
  );
}
