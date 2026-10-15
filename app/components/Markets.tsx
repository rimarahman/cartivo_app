// Shopify Markets UI: limit a campaign to countries, and translate its texts per language.
import { useState } from "react";
import { Checkbox, Grid, Switch, TextField } from "./fields";
import { CAMPAIGN_TEXT_KEYS, type CampaignType } from "../lib/defaults";
import type { MarketsInfo } from "../models/markets.server";

export function CountryTargeting(props: {
  countries: MarketsInfo["countries"];
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const { countries, value, onChange } = props;
  const [search, setSearch] = useState("");
  const all = value.length === 0;
  const q = search.trim().toLowerCase();
  // Selected countries first, then search matches; long lists stay short.
  const shown = countries
    .filter((c) => value.includes(c.code) || !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
    .slice(0, q ? 60 : 30);

  return (
    <s-stack gap="base">
      <Switch
        label="Show in every country"
        details="Turn off to run this campaign only for shoppers in selected countries (Shopify Markets)."
        value={all}
        onChange={(v) => onChange(v ? [] : countries.slice(0, 1).map((c) => c.code))}
      />
      {!all && (
        <>
          <s-text color="subdued">
            Selected: {value.map((code) => countries.find((c) => c.code === code)?.name || code).join(", ")}
          </s-text>
          {countries.length > 0 ? (
            <>
              <TextField label="Search countries" placeholder="Germany, FR …" value={search} onChange={setSearch} />
              <Grid columns={3}>
                {shown.map((c) => (
                  <Checkbox
                    key={c.code}
                    label={`${c.name} (${c.code})`}
                    value={value.includes(c.code)}
                    onChange={(on) => {
                      const next = on ? [...value, c.code] : value.filter((x) => x !== c.code);
                      // Unchecking the last country would silently mean "every country": keep one.
                      if (next.length) onChange(next);
                    }}
                  />
                ))}
              </Grid>
            </>
          ) : (
            <TextField
              label="Country codes"
              details="Comma separated ISO codes, e.g. US, CA, GB"
              value={value.join(", ")}
              onChange={(v) => {
                const codes = v.toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c));
                if (codes.length) onChange(codes);
              }}
            />
          )}
        </>
      )}
    </s-stack>
  );
}

type Translations = Record<string, Record<string, string>>;

// Every translatable text of a campaign, with its default (store language) value.
function textFields(type: CampaignType, config: any) {
  const fields = CAMPAIGN_TEXT_KEYS[type].map((f) => ({ ...f, fallback: String(config[f.key] ?? "") }));
  if (type === "rewards") {
    (config.tiers || []).forEach((t: any, i: number) =>
      fields.push({ key: `tier.${t.id}.label`, label: `Tier ${i + 1} reward name`, fallback: t.label || "" }),
    );
  }
  if (type === "announcement") {
    (config.messages || []).forEach((m: string, i: number) =>
      fields.push({ key: `messages.${i}`, label: `Message ${i + 1}`, fallback: m || "" }),
    );
  }
  return fields;
}

export function CampaignTranslations(props: {
  type: CampaignType;
  config: any;
  locales: MarketsInfo["locales"];
  onChange: (translations: Translations) => void;
}) {
  const { type, config, locales, onChange } = props;
  const translations: Translations = config.translations || {};
  // Store languages (Markets) plus any language added by hand; the primary language uses the main texts.
  const codes = Array.from(
    new Set([...locales.filter((l) => !l.primary).map((l) => l.locale), ...Object.keys(translations)]),
  );
  const [active, setActive] = useState(codes[0] || "");
  const [newCode, setNewCode] = useState("");
  const current = codes.includes(active) ? active : codes[0] || "";
  const name = (code: string) => locales.find((l) => l.locale === code)?.name || code;

  const set = (key: string, v: string) => {
    const own = { ...(translations[current] || {}) };
    if (v) own[key] = v;
    else delete own[key];
    onChange({ ...translations, [current]: own });
  };

  return (
    <s-stack gap="base">
      <s-paragraph>
        Shoppers see these texts in their store language. Empty fields use your main text.
        {locales.length === 0 && " Add a language code (e.g. fr, de, pt-br) to start."}
      </s-paragraph>
      <s-stack direction="inline" gap="small-200" alignItems="end">
        {codes.map((code) => (
          <s-button key={code} variant={code === current ? "primary" : "secondary"} onClick={() => setActive(code)}>
            {name(code)}
          </s-button>
        ))}
        <TextField label="Add language" placeholder="fr" value={newCode} onChange={setNewCode} />
        <s-button
          onClick={() => {
            const code = newCode.trim().toLowerCase();
            if (!/^[a-z]{2}(-[a-z0-9]{2,4})?$/.test(code)) return;
            if (!translations[code]) onChange({ ...translations, [code]: {} });
            setActive(code);
            setNewCode("");
          }}
        >
          Add
        </s-button>
      </s-stack>
      {current && (
        <Grid>
          {textFields(type, config).map((f) => (
            <TextField
              key={current + f.key}
              label={f.label}
              placeholder={f.fallback}
              value={translations[current]?.[f.key] || ""}
              onChange={(v) => set(f.key, v)}
            />
          ))}
        </Grid>
      )}
    </s-stack>
  );
}
