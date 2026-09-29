/** Turns one finalized utterance into the short chunks the controller is
 * designed to see (evaluation/streams/ are 2-8 words each). Web Speech
 * hands back a whole sentence at once; posting it as a single chunk gives
 * the ruler one tick and hides the clause boundary the controller fires
 * on. Splits at punctuation and spoken connectives, then caps the length,
 * and keeps the original words verbatim — nothing is rewritten. */

const CONNECTIVES = new Set(["and", "but", "so", "because", "actually", "then", "also", "although"]);
const SPOKEN_PUNCTUATION: Record<string, string> = {
  dot: ".",
  period: ".",
  "full stop": ".",
  comma: ",",
  "question mark": "?",
};

/** "my phone died dot" -> "my phone died." (only a trailing spoken mark). */
export function normalizeSpokenPunctuation(text: string): string {
  const trimmed = text.trim();
  for (const [spoken, mark] of Object.entries(SPOKEN_PUNCTUATION)) {
    const re = new RegExp(`\\s+${spoken}$`, "i");
    if (re.test(trimmed)) return trimmed.replace(re, mark);
  }
  return trimmed;
}

export interface ChunkOptions {
  maxWords?: number;
  /** A finalized speech result ends where the speaker paused — that pause
   * is a clause boundary even though the recognizer emits no punctuation.
   * When true, the last chunk is given a terminal "." if it has none, so the
   * controller can see the boundary it fires on. */
  endOfUtterance?: boolean;
}

export function chunkUtterance(text: string, options: ChunkOptions | number = {}): string[] {
  const { maxWords = 6, endOfUtterance = false } = typeof options === "number" ? { maxWords: options } : options;
  let normalized = normalizeSpokenPunctuation(text);
  if (!normalized) return [];
  if (endOfUtterance && !/[.?!]$/.test(normalized)) normalized += ".";

  // 1. split after punctuation, keeping the mark on the preceding piece
  const pieces = normalized.split(/(?<=[.,;!?])\s+/);

  // 2. split each piece before a connective, then cap by word count
  const chunks: string[] = [];
  for (const piece of pieces) {
    const words = piece.split(/\s+/).filter(Boolean);
    let current: string[] = [];
    for (const word of words) {
      const bare = word.toLowerCase().replace(/[.,;!?]+$/, "");
      const startsClause = CONNECTIVES.has(bare) && current.length >= 2;
      if ((startsClause || current.length >= maxWords) && current.length > 0) {
        chunks.push(current.join(" "));
        current = [];
      }
      current.push(word);
    }
    if (current.length > 0) chunks.push(current.join(" "));
  }

  // 3. a dangling one-word tail ("dot." already merged; "you?") joins the previous chunk
  const merged: string[] = [];
  for (const c of chunks) {
    if (merged.length > 0 && c.split(/\s+/).length === 1) merged[merged.length - 1] += ` ${c}`;
    else merged.push(c);
  }
  return merged;
}
