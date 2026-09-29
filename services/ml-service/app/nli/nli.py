"""NLI entailment — the third and final step of the grounding verifier
(ADR-0005): claim text must be entailed by the cited chunk, not merely
quote-adjacent.
"""
from __future__ import annotations

from typing import Protocol


class NliChecker(Protocol):
    def entails(self, premise: str, hypothesis: str) -> bool: ...


class TransformerNliChecker:
    MODEL_NAME = "cross-encoder/nli-MiniLM2-L6-H768"

    def __init__(self, model_name: str | None = None) -> None:
        from sentence_transformers import CrossEncoder

        self._model = CrossEncoder(model_name or self.MODEL_NAME)
        # Standard 3-way NLI label order for this checkpoint: contradiction, entailment, neutral
        self._entailment_index = 1

    def entails(self, premise: str, hypothesis: str) -> bool:
        scores = self._model.predict([(premise, hypothesis)])
        label = scores[0].argmax()
        return int(label) == self._entailment_index


class LexicalEntailmentHeuristic:
    """Dependency-free fallback used in unit tests: a hypothesis is
    considered entailed if a majority of its content tokens appear in the
    premise. Conservative on purpose — the verifier can only subtract
    (ADR-0005), so a heuristic that over-rejects is safer than one that
    over-accepts.
    """

    def entails(self, premise: str, hypothesis: str) -> bool:
        premise_tokens = set(premise.lower().split())
        hyp_tokens = [t for t in hypothesis.lower().split() if len(t) > 3]
        if not hyp_tokens:
            return False
        matched = sum(1 for t in hyp_tokens if t in premise_tokens)
        return matched / len(hyp_tokens) >= 0.6
