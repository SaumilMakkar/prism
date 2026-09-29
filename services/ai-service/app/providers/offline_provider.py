"""Deterministic, dependency-free provider — no network, no API key.

Used as `AI_MODE=offline`, the default: it implements the same JSON
contracts as the real OpenAI models (decompose.py / synthesize.py prompts)
with plain heuristics instead of a language model, so `make up` and
`make eval` work out of the box with zero setup. Its outputs are recorded
to `trajectories/` exactly like `record` mode's, tagged `source: offline`
so they are never confused with a genuine API recording (see
AI_Disclosure_DRAFT.md's "Other" line — recorded trajectories must be real
recordings, never hand-written; this provider's *logic* is hand-written,
same as any other piece of the pipeline, but each trajectory file is a
faithful record of what this deterministic function actually returned, not
an invented example).

The algorithm is generic — driven by the input text alone, never by
memorized eval content — so it cannot violate the hardcode-grep rule in
SECURITY.md T8.
"""
from __future__ import annotations

import json
import re

_SPLIT_RE = re.compile(r",?\s+and\s+|;\s*|\?\s*")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"[A-Za-z0-9]+")
_STOPWORDS = {
    "the", "a", "an", "is", "it", "to", "in", "on", "of", "for", "and", "or",
    "with", "at", "my", "i", "you", "your", "this", "that", "does", "do",
    "how", "what", "when", "where", "why", "will", "not", "be", "am", "are",
}


_MIN_RELEVANCE_RATIO = 0.4
_FILLER_FRAGMENTS = {"oh", "um", "uh", "well", "so", "ok", "okay", "hmm", "right", "yeah", "yes", "no"}


def _tokenize(text: str) -> set[str]:
    return {t.lower() for t in _WORD_RE.findall(text) if t.lower() not in _STOPWORDS}


class OfflineProvider:
    def complete(self, system: str, user: str, _model: str) -> str:
        if "sub_queries" in system:
            return self._decompose(user)
        if "claims" in system:
            return self._synthesize(system, user)
        return json.dumps({})

    @staticmethod
    def _decompose(user_text: str) -> str:
        raw_parts = [p.strip(" .") for p in _SPLIT_RE.split(user_text) if p.strip(" .")]
        # Splitting on "," / "and" / ";" can strand a bare filler word as its
        # own fragment ("Oh, and I bought it abroad..." -> "Oh", "I bought
        # it abroad..."); a filler isn't an independent sub-question, so it
        # is only kept when it's the ONLY thing the model got.
        parts = [
            p for p in raw_parts
            if p.lower().strip("?") not in _FILLER_FRAGMENTS
        ] or raw_parts
        if not parts:
            parts = [user_text.strip()]
        return json.dumps({"sub_queries": parts[:4]})

    @staticmethod
    def _synthesize(system: str, user_text: str) -> str:
        # user_text is "Evidence:\n[ID]\ntext\n\n[ID2]\ntext2\n\nQuestion: ..."
        evidence_block, _, question = user_text.partition("Question:")
        evidence_block = evidence_block.split("Evidence:", 1)[-1]
        chunks: list[tuple[str, str]] = []
        for block in evidence_block.split("\n\n"):
            block = block.strip()
            if not block.startswith("["):
                continue
            citation_id, _, text = block.partition("]")
            chunks.append((citation_id.lstrip("["), text.strip()))

        if not chunks:
            return json.dumps({"claims": []})

        question_tokens = _tokenize(question)
        if not question_tokens:
            return json.dumps({"claims": []})

        best_id, best_text, best_overlap = None, None, -1
        for citation_id, text in chunks:
            overlap = len(_tokenize(text) & question_tokens)
            if overlap > best_overlap:
                best_id, best_text, best_overlap = citation_id, text, overlap

        # Overlap is measured as a fraction of the QUESTION's own content
        # words, not the (usually much longer) chunk's — a chunk that only
        # shares one incidental word with a four-word question ("camera" in
        # a question about lens-glass replacement cost, matching an
        # unrelated repair-SLA chunk that happens to also mention cameras)
        # must not read as "relevant" just because raw overlap is nonzero.
        # This is what actually implements the synthesis prompt's "if no
        # evidence answers the sub-question, return an empty list" rule
        # (prompts/synthesize.md) for this deterministic fallback provider.
        if best_text is None or (best_overlap / len(question_tokens)) < _MIN_RELEVANCE_RATIO:
            return json.dumps({"claims": []})

        sentences = [s.strip() for s in _SENTENCE_RE.split(best_text) if s.strip()]
        best_sentence = max(
            sentences, key=lambda s: len(_tokenize(s) & question_tokens), default=best_text
        )

        return json.dumps(
            {
                "claims": [
                    {"text": best_sentence, "citation_id": best_id, "quote": best_sentence}
                ]
            }
        )
