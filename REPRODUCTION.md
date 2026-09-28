# Reproduction

Every command needed to go from a clean machine to a running, evaluated system.

## 1. Clone and configure

```
git clone <this repo>
cd prism
cp .env.example .env
```

Defaults in `.env.example` require no API key: `AI_MODE=offline`, `ML_BACKEND=hash`.

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

Runs every stream under `evaluation/streams/` against the live gateway in `offline` mode by default (deterministic, no API key needed — [ADR-0007](documentation/adr/0007-llm-choice-and-replay.md)), scores G1–G6, and writes `evaluation/results/scorecard.md`. Set `AI_MODE=replay` to instead serve committed trajectories and fail loudly (HTTP 424) on any cache miss, for fully deterministic CI runs once `trajectories/` is populated.

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

Removes containers and the `telemetry` volume. `evaluation/` is host-mounted (for `eval-runner`'s results) and untouched; `corpus/` is baked into the `vector-service` image at build time (see `services/vector-service/Dockerfile`), so a corpus change needs `make up` to rebuild, not just a restart.

## Known gaps in this environment

- `ML_BACKEND=hash` (the default) uses a dependency-free deterministic embedder/reranker/NLI heuristic so `make up` works fully offline; set `ML_BACKEND=transformer` to use the real bge-small/MiniLM/NLI models described in the ADRs (requires a model download on first run).
- `docker compose up` itself has not been run against this exact working tree on the machine used for this round of local development (Docker Desktop isn't installed there) — verified instead by running all four Python services directly with `uvicorn` against the same code, same corpus, and `ML_BACKEND=hash`/`AI_MODE=offline`, which exercises every code path `docker compose` would except the container build and nginx routing. `.github/workflows/ci.yml`'s `compose-smoke` job now builds and starts the real compose stack (including nginx) and drives one full turn through it on every push — that job is what actually verifies `make up` works, not this write-up.
