// Shopify Markets info for the admin: the store's published languages and the countries it sells to.
type Admin = { graphql: (query: string, options?: any) => Promise<Response> };

export type MarketsInfo = {
  locales: { locale: string; name: string; primary: boolean }[];
  countries: { code: string; name: string }[];
};

async function query(admin: Admin, q: string) {
  try {
    const json: any = await (await admin.graphql(q)).json();
    return json.errors ? null : json.data;
  } catch {
    return null; // e.g. read_locales not granted yet: the UI falls back to manual language codes
  }
}

export async function getMarketsInfo(admin: Admin): Promise<MarketsInfo> {
  const [locales, shop] = await Promise.all([
    query(admin, `#graphql
      query { shopLocales(published: true) { locale name primary } }`),
    query(admin, `#graphql
      query { shop { shipsToCountries } }`),
  ]);
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const countryName = (code: string) => {
    try {
      return names.of(code) || code;
    } catch {
      return code;
    }
  };
  return {
    locales: (locales?.shopLocales || []).map((l: any) => ({ locale: String(l.locale).toLowerCase(), name: l.name, primary: !!l.primary })),
    countries: ((shop?.shop?.shipsToCountries || []) as string[])
      .filter((c) => /^[A-Z]{2}$/.test(c))
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
