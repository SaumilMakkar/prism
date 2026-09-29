import React from "react";
import ReactDOM from "react-dom/client";
// Self-hosted fonts (frontend_prompt.md: no runtime CDN; the demo may run
// offline). Vite bundles the woff2 files from node_modules/@fontsource.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
// The front page's display face (regular + italic only — it is used for
// headlines, never for body text).
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import App from "./App";
import { Landing } from "./landing/Landing";
import { pickRoute } from "./route";
import "./styles.css";

const Page = pickRoute(window.location.pathname) === "console" ? App : Landing;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
