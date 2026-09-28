.PHONY: up down ingest eval eval-replay bench demo test docs lint

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

eval:
	docker compose --profile eval run --rm eval-runner

eval-replay:
	AI_MODE=replay docker compose --profile eval run --rm eval-runner

bench:
	@echo "Per-stage latency benchmark — see documentation/Architecture_Brief.md Section 6."
	docker compose --profile eval run --rm eval-runner python run_eval.py --gateway-url http://nginx:80/api

demo:
	@echo "Open the dashboard at http://localhost — Guided Demo Tour (F14) not yet implemented; drive turns manually via the UI or evaluation/streams/*.json."

test:
	cd packages/core && python -m pip install -e ".[dev]" -q && python -m pytest -q
	cd services/gateway && python -m pytest -q
	cd services/ml-service && python -m pytest -q
	cd services/vector-service && python -m pytest -q
	cd services/ai-service && python -m pytest -q
	cd evaluation/harness && python -m pytest -q

docs:
	@echo "PDF rendering not wired up in this environment — see documentation/*.md as the hand-written source of truth."

lint:
	@echo "CI hardcode-grep: no eval query/answer/Doc_ID literals allowed under services/"
	! grep -rEn "camera lens glass|Doc_999.*ignore evidence" services/ --include="*.py"
