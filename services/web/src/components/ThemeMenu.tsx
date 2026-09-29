import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "../motion";

/** Appearance switcher. Each theme is a set of CSS variables in
 * src/tokens.css selected by data-theme on <html>; nothing else changes.
 * The choice is a per-viewer convenience kept in localStorage (guarded —
 * private windows may throw), never sent anywhere.
 *
 * Two of the themes, Paper (light) and Obsidian (dark), are the front
 * page's palettes; the sun/moon toggle flips between exactly those two,
 * and the front page's own toggle writes the same key, so the pair of
 * pages always opens in the mode the viewer last chose. */
export interface Theme {
  id: string;
  label: string;
  swatch: [string, string]; // [background, accent] for the little icon
  dark: boolean;
}

export const THEMES: Theme[] = [
  { id: "paper", label: "Paper", swatch: ["#f4efe4", "#9a6f12"], dark: false },
  { id: "obsidian", label: "Obsidian", swatch: ["#0f0e0b", "#d9a93a"], dark: true },
  { id: "light", label: "Light", swatch: ["#f3f4f2", "#2f6bff"], dark: false },
  { id: "mission-control", label: "Mission Control", swatch: ["#0b0e13", "#3ecf8e"], dark: true },
  { id: "vscode-dark", label: "VS Code Dark", swatch: ["#1e1e1e", "#3794ff"], dark: true },
  { id: "github-dark", label: "GitHub Dark", swatch: ["#0d1117", "#58a6ff"], dark: true },
  { id: "blueprint", label: "Blueprint", swatch: ["#0a1628", "#60a5fa"], dark: true },
  { id: "catppuccin", label: "Catppuccin", swatch: ["#1e1e2e", "#cba6f7"], dark: true },
];

const STORAGE_KEY = "prelude_theme";
const LANDING_KEY = "prelude_landing_mode";
const EVENT = "prelude-theme";
export const DEFAULT_THEME = THEMES[0].id; // paper

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
    // Keep the front page in step when the choice is one of its two modes.
    if (id === "paper" || id === "obsidian") localStorage.setItem(LANDING_KEY, id);
  } catch {
    // best-effort
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Current theme id, shared by every control that shows or sets it. */
export function useTheme(): [string, (id: string) => void] {
  const [current, setCurrent] = useState<string>(readStoredTheme);
  useEffect(() => {
    applyTheme(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    function onChange(e: Event) {
      setCurrent((e as CustomEvent<string>).detail);
    }
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return [current, applyTheme];
}

export function isDark(id: string): boolean {
  return THEMES.find((t) => t.id === id)?.dark ?? false;
}

function Swatch({ theme }: { theme: Theme }) {
  return (
    <span className="theme-swatch" aria-hidden="true" style={{ background: theme.swatch[0] }}>
      <span style={{ background: theme.swatch[1] }} />
    </span>
  );
}

/** Sun/moon: flips between Paper and Obsidian, whatever theme is active. */
export function ModeToggle() {
  const [current, setTheme] = useTheme();
  const dark = isDark(current);
  const next = dark ? "paper" : "obsidian";
  return (
    <button
      className="mode-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          aria-hidden="true"
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22 }}
          style={{ display: "inline-flex" }}
        >
          {dark ? "☀" : "☾"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function ThemeMenu() {
  const [current, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-popover card"
            role="listbox"
            aria-label="Appearance"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2 }}
          >
            <div className="theme-popover-title">Appearance</div>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={t.id === current}
                  className={`theme-option ${t.id === current ? "theme-option-active" : ""}`}
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                >
                  <Swatch theme={t} />
                  {t.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
