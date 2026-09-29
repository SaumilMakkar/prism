/** The web app serves two pages from one bundle: the front page at "/"
 * (src/landing) and the dashboard at "/console" (src/App). No router
 * library — one pathname check at boot is all it needs, and the Vite dev
 * server (which nginx proxies) already falls back to index.html for any
 * path. */
export type Route = "landing" | "console";

export function pickRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, "");
  return clean === "/console" || clean.startsWith("/console/") ? "console" : "landing";
}
