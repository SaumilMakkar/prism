# ADR-0001: Service boundaries

**Status:** Accepted

## Context

The guide penalises architecture that looks like a distributed monolith — services that exist for their own sake with no measured cost. At the same time, a single-process design cannot show the controller decision, the retrieval hop, the verifier and the LLM call as separate, inspectable stages, which is the core of the demo (Section 2 of `prelude.md`: "Every controller decision visible with its reason"). We need boundaries that are individually justifiable, each with a one-line reason and a measured hop cost, not a default "microservices are modern" choice.

Candidates considered: (a) one monolithic FastAPI app, (b) two services (edge + everything else), (c) five services split by responsibility, (d) full per-feature microservices (8+).

## Decision

Five services behind an nginx edge, plus Qdrant and Redis as managed dependencies:

| Service | Owns | One-line justification |
|---|---|---|
| `gateway` | Controller (trigger policy), orchestration, claim graph, session state, telemetry aggregation | The only service that needs to see every request in a session — it is the natural place for stateful, per-turn decisions. Splitting controller from orchestration would add a hop with no independent scaling reason. |
| `ml-service` | Embedding, feature extraction (entities/drift/clause boundary), rerank, NLI | CPU-bound, model-loaded-once workloads that are stateless per call and benefit from being scaled/replaced independently of the gateway (e.g. swapped for an on-device path later, Section 1 of `prelude.md`). |
| `vector-service` | Ingestion, chunking, hybrid search (BM25 + dense via Qdrant), fusion | Owns the only stateful data store besides Redis; keeping ingestion and search in the same service avoids a second network hop between index-write and index-read paths. |
| `ai-service` | LLM provider adapter (decompose, synthesize), record/replay, cost metering | Isolates the only external network dependency (OpenAI) and the only non-deterministic component behind a boundary that can be fully replayed in CI/eval without a key. |
| `eval-runner` | Stream playback, scorecard generation | Runs only in the `eval` compose profile; kept out of the request path entirely so evaluation can never affect production latency numbers. |

Each inter-service hop is measured and reported in `make bench` (target: 1–3 ms per hop on localhost/Docker bridge network); this number is quoted verbatim in the Architecture Brief and in judge Q&A (Section 5 of `prelude.md`).

## Consequences

- Five services is defensible only as long as the hop-cost table stays in the brief and stays small — if any hop exceeds ~5 ms consistently, that boundary must be re-justified or merged.
- `docker compose up` must bring up all five plus Qdrant and Redis with healthchecks in ≤ 90 s (Section 2); this is a hard constraint on image size and startup order, not a nice-to-have.
- The controller (in `gateway`) never calls an LLM (ADR-0003) and never calls `ai-service` directly for trigger decisions — only `ml-service` for features. This keeps the hot per-chunk path inside two services.
- Splitting further (e.g. separate `controller` and `orchestrator` services) was rejected: no independent scaling or replacement reason, and it would add a hop to the path judges watch most closely.
- `packages/core` holds boundary-independent logic (schemas, fusion math, claim-graph data structure, hashchain) so it can be unit-tested without any service running, and so `ml-service`/`vector-service`/`gateway` share one source of truth for shapes.
