// Serves the theme extension's stylesheet to the admin so the live previews use the real storefront CSS.
// (The Vite dev server only serves files from app/, so it can't be imported directly.)
import { readFile } from "node:fs/promises";
import path from "node:path";

export const loader = async () => {
  // The app runs from the project root (dev server, react-router-serve and the Dockerfile).
  const css = await readFile(path.join(process.cwd(), "extensions", "cartkit-theme", "assets", "cartkit.css"), "utf8");
  return new Response(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": process.env.NODE_ENV === "production" ? "public, max-age=300" : "no-cache",
    },
  });
};
