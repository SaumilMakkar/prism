import { useEffect, useRef, useState } from "react";

/** Appearance switcher. Each theme is a set of CSS variables in
 * src/tokens.css selected by data-theme on <html>; nothing else changes.
 * The choice is a per-viewer convenience kept in localStorage (guarded —
 * private windows may throw), never sent anywhere. */
export interface Theme {
  id: string;
  label: string;
  swatch: [string, string]; // [background, accent] for the little icon
}

export const THEMES: Theme[] = [
  { id: "mission-control", label: "Mission Control", swatch: ["#0b0e13", "#3ecf8e"] },
  { id: "vscode-dark", label: "VS Code Dark", swatch: ["#1e1e1e", "#3794ff"] },
  { id: "github-dark", label: "GitHub Dark", swatch: ["#0d1117", "#58a6ff"] },
  { id: "light", label: "Light", swatch: ["#f3f4f2", "#2f6bff"] },
  { id: "paper", label: "Paper", swatch: ["#f4efe4", "#9a6f12"] },
  { id: "blueprint", label: "Blueprint", swatch: ["#0a1628", "#60a5fa"] },
  { id: "catppuccin", label: "Catppuccin", swatch: ["#1e1e2e", "#cba6f7"] },
];

const STORAGE_KEY = "prelude_theme";
export const DEFAULT_THEME = THEMES[0].id;

export function readStoredTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    // storage blocked — fall through to the default
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort
  }
}

function Swatch({ theme }: { theme: Theme }) {
  return (
    <span className="theme-swatch" aria-hidden="true" style={{ background: theme.swatch[0] }}>
      <span style={{ background: theme.swatch[1] }} />
    </span>
  );
}

export function ThemeMenu() {
  const [current, setCurrent] = useState<string>(readStoredTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(current);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div className="theme-menu" ref={rootRef}>
      <button
        className="btn-quiet theme-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Appearance"
      >
        <Swatch theme={active} />
        {active.label}
        <span className="theme-caret" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="theme-popover card" role="listbox" aria-label="Appearance">
          <div className="theme-popover-title">Appearance</div>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="option"
                aria-selected={t.id === current}
                className={`theme-option ${t.id === current ? "theme-option-active" : ""}`}
                onClick={() => {
                  setCurrent(t.id);
                  setOpen(false);
                }}
              >
                <Swatch theme={t} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
