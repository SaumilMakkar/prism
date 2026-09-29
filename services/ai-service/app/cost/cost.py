"""Cost meter — T10 in SECURITY.md. Per-session ceiling on live/record calls.
Replay calls are free by definition (no network) and are never metered.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Illustrative per-1K-token rates; override via env in a real deployment.
USD_PER_1K_INPUT_TOKENS = 0.002
USD_PER_1K_OUTPUT_TOKENS = 0.006


@dataclass
class CostMeter:
    per_session_ceiling_usd: float = 0.50
    _session_totals: dict[str, float] = field(default_factory=dict)

    def estimate(self, input_tokens: int, output_tokens: int) -> float:
        return (
            input_tokens / 1000 * USD_PER_1K_INPUT_TOKENS
            + output_tokens / 1000 * USD_PER_1K_OUTPUT_TOKENS
        )

    def charge(self, session_id: str, input_tokens: int, output_tokens: int) -> float:
        cost = self.estimate(input_tokens, output_tokens)
        total = self._session_totals.get(session_id, 0.0) + cost
        if total > self.per_session_ceiling_usd:
            raise CostCeilingExceeded(
                f"session {session_id} would exceed ceiling: "
                f"{total:.4f} > {self.per_session_ceiling_usd}"
            )
        self._session_totals[session_id] = total
        return total

    def session_total(self, session_id: str) -> float:
        return self._session_totals.get(session_id, 0.0)


class CostCeilingExceeded(RuntimeError):
    pass
