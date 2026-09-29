.PHONY: up down ingest eval eval-ablation bench demo test docs lint

up:
	docker compose up --build -d
	@echo "Waiting for gateway healthcheck..."
	@docker compose exec -T gateway python -c "import urllib.request,time; \
	[urllib.request.urlopen('http://localhost:8000/healthz') and exit(0) for _ in [1]]" || true
	$(MAKE) ingest

down:
	docker compose down -v

ingest:
	curl -sf -X POST http://localhost:8002/ingest || true

# `make eval` (offline, default) | `make eval MODE=replay` | `make eval MODE=live`.
# ai-service is recreated with the requested AI_MODE before each run, since
# it's a long-lived container started by `make up`, not something the
# eval-runner itself controls.
MODE ?= offline

eval:
	AI_MODE=$(MODE) docker compose up -d --no-deps ai-service
	docker compose --profile eval run --rm eval-runner

# Ablation 1 (ADR-0002): dense-only retrieval. Writes its own scorecard
# next to the main one so the README's numbers (synced from scorecard.md)
# are never overwritten by an ablation run. gateway is recreated with
# HYBRID_ENABLED=false for the run and restored afterwards.
eval-ablation:
	HYBRID_ENABLED=false docker compose up -d --no-deps gateway
	docker compose --profile eval run --rm eval-runner python run_eval.py 		--gateway-url http://nginx:80/api 		--output /evaluation/results/scorecard_dense_only.md 		--label "ablation: dense-only retrieval"
	docker compose up -d --no-deps gateway

bench:
	@echo "Per-stage latency benchmark — see documentation/Architecture_Brief.md Section 6."
	docker compose --profile eval run --rm eval-runner python run_eval.py --gateway-url http://nginx:80/api

demo:
	@echo "Open the dashboard at http://localhost and press 'Tour' (F14): it plays the seven committed"
	@echo "evaluation/streams/ through real /turn calls with captions and the telemetry pane open."
	@echo "Or drive turns manually via the mic/typing input."

test:
	cd packages/core && python -m pip install -e ".[dev]" -q && python -m pytest -q
	cd services/gateway && python -m pytest -q
	cd services/ml-service && python -m pytest -q
	cd services/vector-service && python -m pytest -q
	cd services/ai-service && python -m pytest -q
	cd services/mcp-adapter && python -m pytest -q
	cd evaluation/harness && python -m pytest -q

docs:
	@echo "PDF rendering not wired up in this environment — see documentation/*.md as the hand-written source of truth."

lint:
	@echo "CI hardcode-grep: no eval query/answer/adversarial-Doc_ID literals allowed under services/"
	python scripts/check_no_eval_hardcode.py
