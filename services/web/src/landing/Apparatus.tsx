/** The apparatus diagram: four inputs converge on the gateway, one turn
 * runs decompose → retrieve → synthesize → verify, and an answer ships
 * only after the verifier passes. The measured outcome on the right is
 * the same quantity the console's ruler shows: headroom between the safe
 * chunk and the fired chunk. Flow lines animate with a dash offset and a
 * single dot travels the "ships" line (SMIL animateMotion, which browsers
 * still support and which needs no script). */

const INPUTS: { index: string; label: string; y: number; glyph: "chunks" | "features" | "retrieval" | "claims" }[] = [
  { index: "00-1", label: "Speech chunks", y: 150, glyph: "chunks" },
  { index: "00-2", label: "Controller features", y: 250, glyph: "features" },
  { index: "00-3", label: "Hybrid retrieval", y: 350, glyph: "retrieval" },
  { index: "00-4", label: "Claim store", y: 450, glyph: "claims" },
];

function Glyph({ kind }: { kind: (typeof INPUTS)[number]["glyph"] }) {
  switch (kind) {
    case "chunks":
      return (
        <g className="ap-glyph">
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={i * 16} y={-5} width={11} height={10} rx="1" />
          ))}
          <circle cx="92" cy="0" r="3" className="ap-glyph-dot" />
        </g>
      );
    case "features":
      return (
        <g className="ap-glyph">
          <polyline points="0,6 14,-2 28,4 42,-8 56,2 70,-4 84,0" />
          <circle cx="84" cy="0" r="3" className="ap-glyph-dot" />
        </g>
      );
    case "retrieval":
      return (
        <g className="ap-glyph">
          {[14, 8, 18, 4, 12, 16].map((h, i) => (
            <rect key={i} x={i * 14} y={-h / 2} width={8} height={h} />
          ))}
          <circle cx="92" cy="0" r="3" className="ap-glyph-dot" />
        </g>
      );
    case "claims":
      return (
        <g className="ap-glyph">
          <line x1="0" y1="-8" x2="72" y2="-8" />
          <line x1="0" y1="0" x2="54" y2="0" />
          <line x1="0" y1="8" x2="64" y2="8" />
          <circle cx="92" cy="0" r="3" className="ap-glyph-dot" />
        </g>
      );
  }
}

export function Apparatus() {
  const cx = 720;
  const cy = 300;
  return (
    <svg viewBox="0 0 1200 600" className="ap" role="img" aria-label="Diagram: speech chunks, controller features, hybrid retrieval and the claim store feed the gateway; one turn runs decompose, retrieve, synthesize, verify; the answer ships only after the verifier passes, and the outcome is measured as headroom between the safe and the fired chunk">
      <defs>
        <pattern id="ap-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="ap-hatch-line" />
        </pattern>
        <marker id="ap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="ap-arrowhead" />
        </marker>
      </defs>

      {/* dashed field */}
      <rect x="60" y="100" width="1080" height="440" className="ap-field" />

      {/* inputs */}
      <g className="ap-inputs">
        <line x1="60" y1="120" x2="60" y2="520" className="ap-axis" />
        <polyline points="55,128 60,118 65,128" className="ap-axis" />
        {INPUTS.map((inp) => (
          <g key={inp.index} transform={`translate(0, ${inp.y})`}>
            <line x1="60" y1="0" x2="80" y2="0" className="ap-axis" />
            <circle cx="80" cy="0" r="3" className="ap-node" />
            <text x="96" y="-16" className="ap-mono ap-dim">
              {inp.index}
            </text>
            <text x="96" y="8" className="ap-input-label">
              {inp.label}
            </text>
            <g transform="translate(330, 0)">
              <Glyph kind={inp.glyph} />
            </g>
            {/* curved flow to the collector */}
            <path
              d={`M 424 0 C 470 0, 470 ${cy - inp.y}, 520 ${cy - inp.y}`}
              className="ap-flow"
            />
          </g>
        ))}
      </g>

      {/* collector: the gateway controller */}
      <g transform={`translate(520, ${cy})`}>
        <rect x="0" y="-26" width="56" height="52" rx="6" className="ap-box" />
        <line x1="12" y1="-8" x2="44" y2="-8" className="ap-box-line" />
        <line x1="12" y1="0" x2="44" y2="0" className="ap-box-line" />
        <line x1="12" y1="8" x2="44" y2="8" className="ap-box-line" />
        <circle cx="34" cy="-8" r="3" className="ap-node" />
        <circle cx="20" cy="0" r="3" className="ap-node" />
        <circle cx="28" cy="8" r="3" className="ap-node" />
        <text x="28" y="44" textAnchor="middle" className="ap-mono ap-dim">
          CONTROLLER
        </text>
      </g>
      <line x1="576" y1={cy} x2={cx - 130} y2={cy} className="ap-flow" />

      {/* the turn ring */}
      <g transform={`translate(${cx}, ${cy})`}>
        <circle r="128" className="ap-ring ap-ring-outer" />
        <g className="ap-ring-spin">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x = Math.cos(a) * 128;
            const y = Math.sin(a) * 128;
            return <polygon key={i} points="0,-4 4,0 0,4 -4,0" transform={`translate(${x}, ${y})`} className="ap-diamond" />;
          })}
        </g>
        <circle r="92" className="ap-ring" />
        <circle r="58" className="ap-ring ap-ring-gold" />
        <g className="ap-mark">
          <rect x="-16" y="-4" width="6" height="12" />
          <rect x="-6" y="-14" width="6" height="28" />
          <rect x="4" y="-8" width="6" height="18" />
          <rect x="14" y="-2" width="6" height="8" />
        </g>
        <line x1="-128" y1="0" x2="-140" y2="0" className="ap-ring" />
        <line x1="128" y1="0" x2="140" y2="0" className="ap-ring" />
        <line x1="0" y1="-128" x2="0" y2="-140" className="ap-ring" />
        <line x1="0" y1="128" x2="0" y2="140" className="ap-ring" />
      </g>
      <text x={cx} y={cy - 170} textAnchor="middle" className="ap-mono ap-dim">
        ONE TURN
      </text>
      <text x={cx} y={cy - 152} textAnchor="middle" className="ap-mono ap-dim">
        Verifier pass <tspan className="ap-gold-text">04</tspan>/04
      </text>
      <text x={cx - 210} y={cy - 110} className="ap-stage">
        <tspan className="ap-gold-text">01</tspan> DECOMPOSE
      </text>
      <text x={cx + 80} y={cy - 110} className="ap-stage">
        <tspan className="ap-gold-text">02</tspan> RETRIEVE
      </text>
      <text x={cx + 80} y={cy + 124} className="ap-stage">
        <tspan className="ap-gold-text">03</tspan> SYNTHESIZE
      </text>
      <text x={cx - 210} y={cy + 124} className="ap-stage">
        <tspan className="ap-gold-text">04</tspan> VERIFY
      </text>

      {/* ships line */}
      <line x1={cx + 140} y1={cy} x2="1000" y2={cy} className="ap-flow ap-flow-gold" markerEnd="url(#ap-arrow)" />
      <circle r="4" className="ap-traveller">
        <animateMotion dur="3.2s" repeatCount="indefinite" path={`M ${cx + 140} ${cy} L 998 ${cy}`} />
      </circle>
      <text x={(cx + 140 + 1000) / 2} y={cy - 22} textAnchor="middle" className="ap-mono ap-gold-text">
        SHIPS ONLY AFTER THE
      </text>
      <text x={(cx + 140 + 1000) / 2} y={cy - 8} textAnchor="middle" className="ap-mono ap-gold-text">
        VERIFIER PASSES
      </text>

      {/* measured outcome */}
      <text x="1070" y="140" textAnchor="middle" className="ap-mono ap-dim">
        MEASURED OUTCOME
      </text>
      <g className="ap-corner">
        <path d="M 1000 160 h 12 M 1000 160 v 12" />
        <path d="M 1140 160 h -12 M 1140 160 v 12" />
        <path d="M 1000 480 h 12 M 1000 480 v -12" />
        <path d="M 1140 480 h -12 M 1140 480 v -12" />
      </g>
      <line x1="1020" y1="200" x2="1020" y2="440" className="ap-axis" />
      <polyline points="1015,208 1020,198 1025,208" className="ap-axis" />
      <rect x="1020" y="250" width="90" height="150" fill="url(#ap-hatch)" className="ap-outcome" />
      <line x1="1020" y1="250" x2="1110" y2="250" className="ap-outcome-edge" />
      <circle cx="1110" cy="250" r="5" className="ap-node ap-node-gold" />
      <rect x="1106" y="396" width="8" height="8" className="ap-node-hollow" />
      <text x="1026" y="240" className="ap-mono ap-gold-text">
        FIRED
      </text>
      <text x="1026" y="420" className="ap-mono ap-dim">
        SAFE
      </text>
      <text x="1026" y="434" className="ap-mono ap-dim">
        OFFLINE LABEL
      </text>
      <path d="M 1120 250 h 12 v 150 h -12" className="ap-bracket" />
      <text x="1150" y="320" className="ap-delta">
        Δ
      </text>
      <text x="1136" y="345" className="ap-mono ap-gold-text ap-small">
        HEADROOM
      </text>

      {/* the loop back */}
      <path d="M 1070 480 V 520 H 140" className="ap-flow ap-flow-dim" markerEnd="url(#ap-arrow)" />
      <text x="600" y="565" textAnchor="middle" className="ap-mono ap-dim">
        LATE DETAIL SURFACES → TARGETED SUB-QUERY → CLAIM DIFF
      </text>
    </svg>
  );
}
