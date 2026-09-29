/** The Prelude mark: a rounded square holding four waveform bars — the
 * "retrieval that starts before the question ends" glyph. Shared by the
 * front page's nav and footer and the dashboard header so both pages
 * carry the same signature. Colours come from CSS so each surface tints it. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <span className="l-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <rect x="1" y="1" width="22" height="22" rx="4" className="l-mark-box" />
        <rect x="6" y="10" width="2.5" height="5" className="l-mark-bar" />
        <rect x="10" y="6" width="2.5" height="12" className="l-mark-bar" />
        <rect x="14" y="8" width="2.5" height="8" className="l-mark-bar" />
        <rect x="18" y="11" width="2" height="3" className="l-mark-bar" />
      </svg>
    </span>
  );
}
