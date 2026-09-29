import React from "react";
import ReactDOM from "react-dom/client";
// Self-hosted IBM Plex (frontend_prompt.md: no runtime CDN; the demo may
// run offline). Vite bundles the woff2 files from node_modules/@fontsource.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
