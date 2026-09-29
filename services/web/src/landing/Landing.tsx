import { useEffect, useRef, useState } from "react";
import { Mark } from "../components/Mark";
import { AnimatePresence, EASE, PageShell, Reveal, TransitionLink, motion } from "../motion";
import { Apparatus } from "./Apparatus";
import { HeroVisual } from "./HeroVisual";
import { MARQUEE, NAV, PILLARS, STATS, TABS, Pillar } from "./content";
import "./landing.css";

/** The front page at "/". Light ("paper") by default, with a dark
 * ("obsidian") flip kept per viewer in localStorage. The palette is the
 * same one the dashboard's "Paper" appearance uses; see DESIGN.md. */
export type LandingMode = "paper" | "obsidian";

const MODE_KEY = "prelude_landing_mode";
const THEME_KEY = "prelude_theme"; // the dashboard's key — kept in step so /console opens in the same mode

export function readLandingMode(): LandingMode {
  try {
    const stored = localStorage.getItem(MODE_KEY) ?? localStorage.getItem(THEME_KEY);
    if (stored === "paper" || stored === "obsidian") return stored;
  } catch {
    // storage blocked — fall through
  }
  return "paper";
}

function storeLandingMode(mode: LandingMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // best-effort
  }
  document.documentElement.dataset.theme = mode;
}

function ConsoleLink({ className = "" }: { className?: string }) {
  return (
    <TransitionLink className={`l-cta ${className}`} href="/console">
      <span className="l-eyebrow">Open the console</span>
      <span className="l-cta-path">/console</span>
      <span className="l-cta-arrow" aria-hidden="true">
        →
      </span>
    </TransitionLink>
  );
}

function PillarGlyph({ kind }: { kind: Pillar["glyph"] }) {
  switch (kind) {
    case "ruler":
      return (
        <svg viewBox="0 0 160 48" className="pillar-glyph" aria-hidden="true">
          <line x1="4" y1="30" x2="150" y2="30" />
          {[20, 44, 68, 92, 116, 140].map((x) => (
            <line key={x} x1={x} y1="25" x2={x} y2="35" />
          ))}
          <polygon points="68,20 74,26 68,32 62,26" className="pillar-glyph-hollow" />
          <circle cx="92" cy="30" r="5" className="pillar-glyph-gold" />
          <path d="M 68 12 H 92" className="pillar-glyph-gold" />
        </svg>
      );
    case "seal":
      return (
        <svg viewBox="0 0 160 48" className="pillar-glyph" aria-hidden="true">
          <rect x="6" y="8" width="90" height="32" rx="3" />
          <line x1="14" y1="18" x2="70" y2="18" />
          <line x1="14" y1="26" x2="56" y2="26" />
          <line x1="14" y1="34" x2="64" y2="34" />
          <circle cx="128" cy="24" r="14" className="pillar-glyph-gold" />
          <polyline points="121,24 126,29 136,19" className="pillar-glyph-gold" />
        </svg>
      );
    case "diff":
      return (
        <svg viewBox="0 0 160 48" className="pillar-glyph" aria-hidden="true">
          <line x1="20" y1="12" x2="120" y2="12" />
          <line x1="20" y1="24" x2="100" y2="24" />
          <line x1="16" y1="24" x2="104" y2="24" className="pillar-glyph-strike" />
          <line x1="20" y1="36" x2="130" y2="36" className="pillar-glyph-green" />
          <text x="4" y="40" className="pillar-glyph-text">
            +
          </text>
          <circle cx="150" cy="36" r="3" className="pillar-glyph-gold" />
        </svg>
      );
    case "limit":
      return (
        <svg viewBox="0 0 160 48" className="pillar-glyph" aria-hidden="true">
          <line x1="4" y1="40" x2="100" y2="40" />
          <line x1="100" y1="40" x2="100" y2="8" className="pillar-glyph-dashed" />
          <text x="112" y="30" className="pillar-glyph-text pillar-glyph-text-big">
            ?
          </text>
          <circle cx="150" cy="10" r="3" className="pillar-glyph-gold" />
          <line x1="104" y1="8" x2="150" y2="10" className="pillar-glyph-dashed" />
        </svg>
      );
  }
}

const POINT_GLYPHS = [
  <svg viewBox="0 0 16 16" key="a">
    <circle cx="8" cy="8" r="5" />
  </svg>,
  <svg viewBox="0 0 16 16" key="b">
    <rect x="3" y="3" width="10" height="10" rx="1" />
  </svg>,
  <svg viewBox="0 0 16 16" key="c">
    <polygon points="8,2 14,13 2,13" />
  </svg>,
];

function Pillars() {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !sectionRef.current) return;
    const section = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "-30% 0px -30% 0px" });
    section.observe(sectionRef.current);
    return () => section.disconnect();
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = refs.current.indexOf(e.target as HTMLElement);
            if (idx >= 0) setActive(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={`l-section pillars ${inView ? "in-view" : ""}`} id="pillars" ref={sectionRef}>
      <div className="l-wrap">
        <Reveal>
          <div className="l-eyebrow">Our differentiator</div>
          <h2 className="l-h2">
            Foundational pillars
            <span className="l-h2-italic">that a judge can verify</span>
          </h2>
        </Reveal>
        <div className="pillar-stack">
          {PILLARS.map((p, i) => (
            <article
              key={p.id}
              id={`pillar-${p.id}`}
              className="pillar-card"
              style={{ ["--i" as string]: i }}
              ref={(el) => {
                refs.current[i] = el;
              }}
            >
              <header className="pillar-head">
                <h3 className="pillar-title">{p.title}</h3>
                <PillarGlyph kind={p.glyph} />
              </header>
              <div className="pillar-body">
                <div className="pillar-lead">
                  <p className="pillar-headline">
                    {p.headline[0]}
                    <em>{p.headline[1]}</em>
                    {p.headline[2]}
                  </p>
                  <p className="pillar-sub">{p.sub}</p>
                </div>
                <ul className="pillar-points">
                  {p.points.map((pt, j) => (
                    <li key={pt}>
                      <span className="point-glyph" aria-hidden="true">
                        {POINT_GLYPHS[j % POINT_GLYPHS.length]}
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <nav className="pillar-stepper" aria-label="Pillars">
          {PILLARS.map((p, i) => (
            <a key={p.id} href={`#pillar-${p.id}`} className={i === active ? "is-active" : ""} aria-label={p.title}>
              {i + 1}
            </a>
          ))}
        </nav>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="marquee-chip">
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Engineering() {
  const [tab, setTab] = useState(0);
  const t = TABS[tab];
  return (
    <section className="l-section engineering" id="engineering">
      <div className="l-wrap">
        <Reveal>
          <div className="l-eyebrow">Engineering</div>
          <h2 className="l-h2">
            Where the work went
            <span className="l-h2-italic">and what each part refuses to do</span>
          </h2>
        </Reveal>
        <div className="eng-panel">
          <div className="eng-tabs" role="tablist" aria-label="Engineering areas">
            {TABS.map((x, i) => (
              <button
                key={x.id}
                role="tab"
                id={`eng-tab-${x.id}`}
                aria-selected={i === tab}
                aria-controls="eng-tabpanel"
                className={`eng-tab ${i === tab ? "is-active" : ""}`}
                onClick={() => setTab(i)}
              >
                <span className="eng-tab-index">{x.index}</span>
                <span className="eng-tab-label">{x.label}</span>
              </button>
            ))}
          </div>
          <div className="eng-content" role="tabpanel" id="eng-tabpanel" aria-labelledby={`eng-tab-${t.id}`}>
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={t.id}
              className="eng-main"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <h3 className="eng-title">{t.title}</h3>
              <p className="eng-lede">{t.lede}</p>
              <svg viewBox="0 0 520 240" className="eng-art" aria-hidden="true">
                <rect x="40" y="60" width="260" height="150" rx="6" className="eng-art-ghost" />
                <rect x="70" y="40" width="260" height="150" rx="6" className="eng-art-ghost" />
                <rect x="100" y="20" width="260" height="150" rx="6" className="eng-art-card" />
                <circle cx="116" cy="36" r="4" className="eng-art-dot" />
                <line x1="116" y1="54" x2="300" y2="54" />
                <line x1="116" y1="74" x2="260" y2="74" />
                <line x1="116" y1="94" x2="320" y2="94" />
                <line x1="116" y1="114" x2="240" y2="114" />
                <line x1="116" y1="134" x2="290" y2="134" />
                <rect x="330" y="128" width="8" height="10" className="eng-art-dot-fill" />
                <path d="M 360 95 H 440 V 200 H 520" className="eng-art-wire" />
                <path d="M 0 150 H 40" className="eng-art-wire" />
              </svg>
            </motion.div>
            </AnimatePresence>
            <ul className="eng-chips">
              <AnimatePresence mode="popLayout" initial={false}>
                {t.chips.map((c, i) => (
                  <motion.li
                    key={c}
                    className="eng-chip"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }}
                  >
                    {c}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  const [mode, setMode] = useState<LandingMode>(readLandingMode);

  useEffect(() => {
    storeLandingMode(mode);
  }, [mode]);

  const next: LandingMode = mode === "paper" ? "obsidian" : "paper";

  return (
    <PageShell>
    <div className="landing" data-mode={mode}>
      <div className="l-strip">
        <span className="l-strip-inner">
          <span aria-hidden="true">◇</span> Samsung PRISM Gen AI Hackathon 3.0 · Theme 4 · <b>Streaming Live RAG</b>{" "}
          <span aria-hidden="true">◇</span>
        </span>
      </div>

      <header className="l-nav">
        <div className="l-wrap l-nav-inner">
          <a className="l-logo" href="/">
            <Mark />
            Prelude
          </a>
          <nav className="l-nav-links" aria-label="Sections">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="l-nav-right">
            <TransitionLink className="l-nav-console" href="/console">
              <span className="l-eyebrow">Open the console</span>
              <span className="l-nav-path">/console</span>
            </TransitionLink>
            <button
              className="l-mode"
              onClick={() => setMode(next)}
              aria-label={`Switch to ${next === "obsidian" ? "dark" : "light"} mode`}
              title={`Switch to ${next === "obsidian" ? "dark" : "light"} mode`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mode}
                  aria-hidden="true"
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.22 }}
                  style={{ display: "inline-flex" }}
                >
                  {mode === "paper" ? "☾" : "☀"}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="l-section hero">
          <div className="l-wrap hero-grid">
            <div className="hero-left">
              <motion.div
                className="l-eyebrow hero-eyebrow"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
              >
                <span className="hero-eyebrow-dot" aria-hidden="true" />
                Streaming · Verifiable · Refine-not-restart · Live Agent Assist
              </motion.div>
              <h1 className="hero-title">
                <motion.span
                  className="hero-title-sans"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
                >
                  Retrieval that starts,
                </motion.span>
                <motion.span
                  className="hero-title-serif"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
                >
                  before the question ends
                </motion.span>
              </h1>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
              >
                <ConsoleLink className="hero-cta" />
              </motion.div>
            </div>
            <motion.dl
              className="hero-facts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            >
              <div className="hero-fact">
                <dt className="l-eyebrow">01 · Mission</dt>
                <dd className="hero-fact-serif">
                  A cited answer forms
                  <em>while the customer speaks</em>
                </dd>
              </div>
              <div className="hero-fact">
                <dt className="l-eyebrow">02 · Problem</dt>
                <dd>
                  Speech-to-text, text-to-speech and first-token latency are all under about 200 ms now.{" "}
                  <span className="l-gold">Retrieval is the last latency wall.</span> We move it earlier.
                </dd>
              </div>
              <div className="hero-fact">
                <dt className="l-eyebrow">03 · Apparatus</dt>
                <dd>
                  A rules-only controller decides when to fire, sub-queries fan out in parallel, a verifier that can only
                  subtract, and a claim graph that refines instead of restarting. We are the{" "}
                  <span className="l-gold">apparatus</span> that makes early retrieval safe.
                </dd>
              </div>
            </motion.dl>
          </div>
          <div className="l-wrap">
            <Reveal>
              <HeroVisual />
            </Reveal>
          </div>
        </section>

        <section className="stats" aria-label="Measured facts">
          <div className="l-wrap stats-grid">
            {STATS.map((s, i) => (
              <Reveal key={s.label} className="stat" delay={i * 0.08}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">
                  {s.label}
                  {s.note && (
                    <span className="stat-note" title={s.note} tabIndex={0} aria-label={s.note}>
                      i
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Pillars />

        <section className="l-section apparatus" id="apparatus">
          <div className="l-wrap">
            <Reveal>
              <div className="apparatus-frame">
                <Apparatus />
              </div>
              <div className="apparatus-caption l-eyebrow">Prelude · Measured headroom · The apparatus</div>
            </Reveal>
          </div>
        </section>

        <section className="l-section recording" id="recording">
          <div className="l-wrap">
            <Reveal>
              <div className="l-eyebrow">Recording</div>
              <h2 className="l-h2">
                The console, running
                <span className="l-h2-italic">on synthetic input, nothing scripted</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="recording-frame">
                <video
                  src="/media/console-demo.webm"
                  poster="/media/console-demo.png"
                  muted
                  autoPlay
                  loop
                  playsInline
                  controls
                  preload="metadata"
                  aria-label="Screen recording of the console: chunks typed in, the controller fires, claims form with citations, a late detail refines the answer"
                />
                <figcaption className="hero-visual-caption">
                  Screen recording of /console in Paper mode. The input is synthetic; every decision, retrieval and
                  verifier verdict on screen is the engine's own.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        <Engineering />

        <section className="l-section closer">
          <div className="l-wrap">
            <Reveal>
            <div className="closer-art">
              <svg viewBox="0 0 1000 400" className="closer-svg" aria-hidden="true">
                <polygon points="20,140 980,20 980,380 20,380" className="closer-box" />
                <line x1="20" y1="150" x2="980" y2="30" className="closer-line" />
                <circle cx="980" cy="20" r="9" className="closer-dot" />
              </svg>
              <div className="closer-words">
                <span className="closer-serif">proven</span>
                <span className="closer-sans">headroom</span>
              </div>
            </div>
            <p className="closer-line-text">
              Every claim ships with a citation and a verbatim quote, or it is filed under uncertainty.
            </p>
            <div className="closer-cta">
              <ConsoleLink />
            </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-wrap l-footer-row">
          <a className="l-logo" href="/">
            <Mark />
            Prelude
          </a>
          <nav className="l-footer-links" aria-label="Footer">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <TransitionLink href="/console">Console</TransitionLink>
          </nav>
        </div>
        <div className="l-wrap l-footer-copy l-eyebrow">© 2026 Prelude · Samsung PRISM Gen AI Hackathon 3.0 · Theme 4</div>
      </footer>
    </div>
    </PageShell>
  );
}
