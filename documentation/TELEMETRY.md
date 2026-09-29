# Telemetry

<!-- Event types, trace_id flow, sample JSONL, and explanation of schemas/. -->

Full decision record for the mechanism this feeds: [ADR-0005](adr/0005-grounding-verifier.md) (verifier reason codes), [ADR-0003](adr/0003-rule-based-controller.md) (controller reason codes). Schema source of truth: `schemas/telemetry.schema.json` and `schemas/events.schema.json` — this document explains them, it does not duplicate them; CI validates that this file's examples pass against the committed schema.

## Why telemetry is a first-class feature (F10)

Every controller and verifier decision must be visible with its reason (`prelude.md` Section 2). Telemetry is the mechanism: one event schema, a `trace_id` that threads a single user turn across all five services, written both to JSONL (for `make eval` / replay analysis) and a Redis stream (for the live dashboard).

## trace_id flow

```
mic chunk arrives at gateway
  → trace_id minted (uuid4), attached to every downstream call for this turn
  → gateway.controller emits `controller_decision` {trace_id, decision, reason_code}
  → ml-service emits `feature_extracted` {trace_id, features}
  → vector-service emits `retrieval_completed` {trace_id, doc_ids, hybrid_flag}
  → ai-service emits `decompose_completed` / `synthesis_completed` {trace_id, sub_queries | claims}
  → gateway.verifier emits `claim_verified` {trace_id, claim_id, status, reason_code}
  → gateway.telemetry appends all of the above to JSONL + Redis stream, session id hashed
  → dashboard subscribes to the Redis stream, renders live by trace_id
```

A single utterance can span multiple `trace_id`s if the controller Waits across several chunks before firing Retrieve — the dashboard groups by session id and shows the Wait chain leading up to the fired trace.

## Event types (see `schemas/events.schema.json` for the authoritative field list)

| Event | Emitted by | Key fields |
|---|---|---|
| `controller_decision` | gateway | trace_id, decision (`wait`/`retrieve`/`no_retrieval`), reason_code, chunk_index, features (entities, embedding_drift, clause_boundary, content_tokens, is_presentation_turn), latency_ms |
| `feature_extracted` | ml-service | trace_id, entities, drift_score, clause_boundary, content_tokens |
| `retrieval_completed` | gateway (orchestrator) | trace_id, sub_query, doc_ids, hybrid_flag, cache_hit, cache_similarity (F9), latency_ms |
| `decompose_completed` | ai-service | trace_id, sub_queries, source (`live`/`replay`) |
| `synthesis_completed` | ai-service | trace_id, claim_ids, source |
| `claim_verified` | gateway (verifier) | trace_id, claim_id, status (`verified`/`uncertainty`), reason_code |
| `claim_graph_updated` | gateway (claims) | trace_id, session_id_hash, added, superseded, unchanged |
| `cost_metered` | ai-service | trace_id, tokens, usd_estimate, cumulative_session_usd |
| `hashchain_link` | gateway (telemetry) | event_id, prev_hash, hash |

## Hash-chained observability

Each JSONL line's hash includes the previous line's hash (`hashchain_link`), so `/telemetry/verify` can detect any after-the-fact edit to the trace log — this is what makes the telemetry trustworthy as evidence during the AI-code-check / Q&A portion of judging, not just a debugging aid.

## Sample JSONL (illustrative — real output is produced by `make eval` / `make demo`)

```jsonl
{"event":"controller_decision","trace_id":"7c1f...","session_id_hash":"a91e...","decision":"wait","reason_code":"CONTENT_TOKENS_BELOW_MIN","chunk_index":1,"ts":"2026-09-28T10:00:01.120Z"}
{"event":"controller_decision","trace_id":"7c1f...","session_id_hash":"a91e...","decision":"retrieve","reason_code":"ENTITY_STABLE_CLAUSE_END","chunk_index":3,"ts":"2026-09-28T10:00:01.980Z"}
{"event":"retrieval_completed","trace_id":"7c1f...","doc_ids":["KB_042§3.1","KB_042§3.2"],"hybrid_flag":true,"latency_ms":31,"ts":"2026-09-28T10:00:02.010Z"}
{"event":"claim_verified","trace_id":"7c1f...","claim_id":"c1","status":"verified","reason_code":"QUOTE_MATCH_AND_ENTAILED","ts":"2026-09-28T10:00:02.410Z"}
{"event":"claim_verified","trace_id":"7c1f...","claim_id":"c2","status":"uncertainty","reason_code":"ID_NOT_IN_RETRIEVAL_SET","ts":"2026-09-28T10:00:02.415Z"}
{"event":"hashchain_link","event_id":"e00042","prev_hash":"3fa9...","hash":"9be2...","ts":"2026-09-28T10:00:02.420Z"}
```

## Cost meter

`cost_metered` events accumulate per session (`cumulative_session_usd`) and per run; the dashboard's cost meter (F12) reads this stream directly — the "≈ $5–10 for the whole hackathon" claim in `prelude.md` Section 6 should be substantiated by summing this event type across the build, not estimated after the fact.
