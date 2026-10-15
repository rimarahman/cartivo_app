// Reads the live theme to tell whether the CartKit app embed is turned on.
type Admin = { graphql: (query: string, options?: any) => Promise<Response> };

export const EMBED_HANDLE = "cartkit-embed";

// true / false, or null when it can't be determined (e.g. the theme file couldn't be read).
export async function embedEnabled(admin: Admin) {
  try {
    const res = await admin.graphql(`#graphql
      query {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            files(filenames: ["config/settings_data.json"]) {
              nodes { body { ... on OnlineStoreThemeFileBodyText { content } } }
            }
          }
        }
      }`);
    const json: any = await res.json();
    const content: string | undefined =
      json.data?.themes?.nodes?.[0]?.files?.nodes?.[0]?.body?.content;
    if (!content) return null;
    const data = JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\//, ""));
    const blocks = data.current?.blocks || {};
    return Object.values<any>(blocks).some(
      (b) =>
        String(b.type).includes(`/blocks/${EMBED_HANDLE}/`) &&
        b.disabled !== true,
    );
  } catch {
    return null;
  }
}
