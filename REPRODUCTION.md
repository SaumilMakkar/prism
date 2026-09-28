# Reproduction

Every command needed to go from a clean machine to a running, evaluated system.

## 1. Clone and configure

```
git clone <this repo>
cd prism
cp .env.example .env
```

Defaults in `.env.example` require no API key: `AI_MODE=replay`, `ML_BACKEND=hash`.

## 2. Bring the system up

```
make up
```

This runs `docker compose up --build -d` for nginx, gateway, ml-service, vector-service, qdrant, ai-service, redis, and web, then calls `POST /ingest` on vector-service to index `corpus/`. Target: ≤ 90 s total on a clean machine with images already pulled (see `.github/workflows/images.yml` for the GHCR publish that makes pre-pulling possible).

Verify:

```
curl http://localhost/api/healthz
```

## 3. Open the dashboard

http://localhost — send transcript chunks one at a time to see the controller lamp, reason codes, and the claim graph render live.

## 4. Run the evaluation suite

```
make eval
```

Runs every stream under `evaluation/streams/` against the live gateway in `replay` mode (no API key needed — [ADR-0007](documentation/adr/0007-llm-choice-and-replay.md)), scores G1–G6, and writes `evaluation/results/scorecard.md`.

To run in `live` mode against the real OpenAI API (requires `OPENAI_API_KEY` in `.env`):

```
make eval MODE=live
```

## 5. Run unit tests

```
make test
```

Runs `pytest` across `packages/core` and all four Python services (67+ tests as of this writing — controller policy, fusion, claim graph, hashchain, chunking, hybrid retrieval, features, rerank, NLI heuristics, decompose/synthesize parsing, replay/cost, security, claims store, verifier, telemetry, and evaluation scoring).

## 6. Recording new LLM trajectories

To exercise the real OpenAI models and commit new replayable trajectories:

```
AI_MODE=record OPENAI_API_KEY=sk-... docker compose up ai-service
# drive real turns through the dashboard or evaluation streams
# trajectories land in trajectories/*.json — commit them
```

`replay` mode fails loudly (HTTP 424) on a cache miss rather than silently falling back to `live` — see `services/ai-service/app/replay/replay.py`.

## 7. Tear down

```
make down
```

Removes containers and the `telemetry` volume. `corpus/` and `evaluation/` are host-mounted and untouched.

## Known gaps in this environment

- `trajectories/` ships empty — no LLM calls have been recorded yet, so `make eval` (replay mode) will surface `424 Replay Miss` until a `record` pass populates it. This is expected for a freshly scaffolded build, not a bug.
- `ML_BACKEND=hash` (the default) uses a dependency-free deterministic embedder/reranker/NLI heuristic so `make up` works fully offline; set `ML_BACKEND=transformer` to use the real bge-small/MiniLM/NLI models described in the ADRs (requires a model download on first run).
