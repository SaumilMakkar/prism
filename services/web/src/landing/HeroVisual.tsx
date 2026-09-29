/** The hero "film": a looping, hand-drawn SVG of what the console does in
 * one turn. Transcript text arrives in chunks, the controller fires one
 * chunk after it would have been safe, claims form with citations, a late
 * detail supersedes one claim and adds another. All timing lives in
 * landing.css (`lv-*` keyframes) so `prefers-reduced-motion` can freeze it
 * on the final frame. The transcript and claims are synthetic and the
 * document ids are public corpus fixtures; nothing here is eval content. */
export function HeroVisual() {
  const ticks = [0, 1, 2, 3, 4, 5];
  return (
    <figure className="hero-visual" aria-label="Illustration of one console turn: chunks arrive, the controller fires, claims form and refine">
      <svg viewBox="0 0 640 420" className="lv" role="img" aria-hidden="true">
        <defs>
          <clipPath id="lv-clip-1">
            <rect className="lv-type lv-type-1" x="0" y="0" width="330" height="40" />
          </clipPath>
          <clipPath id="lv-clip-2">
            <rect className="lv-type lv-type-2" x="0" y="24" width="330" height="30" />
          </clipPath>
        </defs>

        {/* frame */}
        <rect x="0.5" y="0.5" width="639" height="419" rx="10" className="lv-frame" />
        <line x1="0" y1="34" x2="640" y2="34" className="lv-rule" />
        <text x="18" y="22" className="lv-label">
          PRELUDE CONSOLE
        </text>
        <text x="622" y="22" className="lv-label" textAnchor="end">
          ONE TURN · ILLUSTRATION
        </text>
        <circle cx="596" cy="18" r="3" className="lv-live" />

        {/* transcript */}
        <text x="18" y="60" className="lv-label">
          TRANSCRIPT
        </text>
        <g transform="translate(18, 70)">
          <text y="20" className="lv-transcript" clipPath="url(#lv-clip-1)">
            the device keeps restarting after the update, and I bought it overseas
          </text>
          <text y="42" className="lv-transcript lv-transcript-late" clipPath="url(#lv-clip-2)">
            — last week, from a retailer, not from us
          </text>
          <rect x="0" y="6" width="2" height="18" className="lv-caret lv-s22" />
        </g>

        {/* ruler */}
        <text x="18" y="136" className="lv-label">
          CHUNK ARRIVALS · MS
        </text>
        <line x1="18" y1="160" x2="622" y2="160" className="lv-rule" />
        {ticks.map((i) => (
          <g key={i} className={`lv-tick lv-s${6 + i * 4}`} transform={`translate(${40 + i * 62}, 160)`}>
            <line x1="0" y1="-6" x2="0" y2="6" />
            <text y="22" textAnchor="middle" className="lv-mono">
              {(i + 1) * 800}
            </text>
          </g>
        ))}
        <g className="lv-tick lv-s50" transform="translate(412, 160)">
          <line x1="0" y1="-6" x2="0" y2="6" />
          <text y="22" textAnchor="middle" className="lv-mono">
            5600
          </text>
        </g>
        <g className="lv-tick lv-s54" transform="translate(474, 160)">
          <line x1="0" y1="-6" x2="0" y2="6" />
          <text y="22" textAnchor="middle" className="lv-mono">
            6400
          </text>
        </g>
        {/* safe (hollow) at chunk 3, fired (filled) at chunk 4 */}
        <g className="lv-safe lv-s14" transform="translate(164, 160)">
          <polygon points="0,-9 7,0 0,9 -7,0" />
          <text x="-12" y="-14" textAnchor="end" className="lv-mono lv-dim">
            safe
          </text>
        </g>
        <g className="lv-fired lv-s18" transform="translate(226, 160)">
          <circle r="6" />
          <text x="12" y="-14" className="lv-mono lv-gold">
            RETRIEVE · clause_boundary
          </text>
        </g>
        <text x="195" y="197" textAnchor="middle" className="lv-mono lv-dim lv-s22">
          1 chunk of headroom
        </text>
        <g className="lv-fired lv-s56" transform="translate(474, 160)">
          <circle r="6" />
          <text x="-12" y="-14" textAnchor="end" className="lv-mono lv-gold">
            RETRIEVE · new_anchor
          </text>
        </g>

        {/* answer */}
        <line x1="0" y1="200" x2="640" y2="200" className="lv-rule" />
        <text x="18" y="226" className="lv-label">
          ANSWER
        </text>
        <text x="622" y="226" className="lv-label" textAnchor="end">
          <tspan className="lv-s26">v1</tspan>
          <tspan className="lv-s66"> → v2 · 1 targeted query</tspan>
        </text>

        <g className="lv-claim lv-s26" transform="translate(18, 250)">
          <text className="lv-check">✔</text>
          <text x="18" className="lv-cite">
            KB_004 §2
          </text>
          <text x="112" className="lv-claimtext">
            Restart loops after an update are a known, covered fault
          </text>
        </g>
        <g className="lv-claim lv-s31" transform="translate(18, 284)">
          <text className="lv-check">✔</text>
          <text x="18" className="lv-cite">
            POL_002 §1
          </text>
          <text x="112" className="lv-claimtext">
            Standard warranty applies to units bought in-country
          </text>
          <line x1="112" y1="-5" x2="470" y2="-5" className="lv-strike lv-k62" />
        </g>
        <g className="lv-claim lv-s36" transform="translate(18, 318)">
          <text className="lv-uncertain">?</text>
          <text x="18" className="lv-cite lv-dim">
            uncertainty
          </text>
          <text x="112" className="lv-claimtext lv-dim">
            Service-centre turnaround: not in the corpus
          </text>
        </g>
        <g className="lv-claim lv-added lv-s66" transform="translate(18, 352)">
          <text className="lv-plus">+</text>
          <text x="18" className="lv-cite">
            POL_002 §4
          </text>
          <text x="112" className="lv-claimtext">
            Overseas units: 14-day inspection before a repair is booked
          </text>
        </g>

        <text x="18" y="400" className="lv-mono lv-dim lv-s66">
          diff: 1 superseded · 1 added · citations preserved · verifier 3/3
        </text>
      </svg>
      <figcaption className="hero-visual-caption">
        Illustration. The console at <a href="/console">/console</a> runs the real thing.
      </figcaption>
    </figure>
  );
}
