# ADR-0002: Hybrid retrieval

**Status:** Accepted

## Context

Retrieval quality directly gates G2 (early retrieval ≥ 80%) and G4 (citation support ≥ 85%, zero fabricated IDs): if the wrong chunk is retrieved, no amount of verification downstream can produce a correctly cited claim. Support-KB queries mix exact-match needs (model numbers, error codes, policy clause references — "SM-G991B", "warranty clause 4.2") with paraphrastic needs ("phone won't charge" vs. "device not powering on"). Dense-only retrieval is weak on the former; lexical-only is weak on the latter. The theme's demo corpus (Section 1 of `prelude.md`) is explicitly designed with a superseded-policy pair and a no-coverage section, both of which stress retrieval precision.

## Decision

Hybrid retrieval: BM25 (lexical) and dense (bge-small, ≈ 33M params, chosen for the on-device story in Section 1) run in parallel over the same section-chunked corpus, fused with Reciprocal Rank Fusion (RRF), then re-ranked with a cross-encoder (MiniLM, ≈ 22M params) over the fused top-N before dedupe and truncation to top-k.

Pipeline: `query → {BM25 top-N, dense top-N} → RRF fuse → cross-encoder rerank top-N → dedupe (by Doc_ID §Section) → top-k`.

A `hybrid`/`dense-only` flag is kept in `vector-service` config specifically so this can be toggled without a code change — this is **ablation 1** (F3, Section 9 of `prelude.md`): the eval report shows retrieval quality (NDCG@5, recall@k) and G4 with hybrid on vs. off, over the labelled streams.

Chunking is section-aware (`[Doc_ID §Section]`), not fixed-window, so that citation IDs stay stable across corpus versions and a chunk boundary never splits a clause that a citation needs to quote verbatim (required by ADR-0005).

## Consequences

- Two indexes to keep in sync (BM25 term index + Qdrant HNSW dense index) — both are rebuilt together on ingestion (F4); there is no incremental-update path in v1, which is acceptable because ingestion is one-time and batched per `prelude.md` Section 5.
- Qdrant's HNSW index is sub-linear, so the 10 000-document question in judge Q&A (Section 5) is answered by index choice, not by scale testing we don't have time to run.
- Rerank only touches the fused top-N (not the full corpus), bounding the ≈ 60 ms rerank latency figure quoted in Section 5 regardless of corpus size.
- Cross-encoder rerank adds a real latency cost (the single largest line item in the latency breakdown); it is kept because G4's citation-support bar is high enough that retrieval precision cannot be sacrificed for the ~30–40 ms it would save.
- Dense-only mode (the ablation) is expected to score lower on exact-identifier queries (model numbers, clause references) and comparable-or-better on paraphrastic queries — the eval report states the actual measured gap, not an assumed one.
