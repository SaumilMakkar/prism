FROM python:3.11-slim

WORKDIR /app

COPY evaluation/harness/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY evaluation/harness ./harness
COPY evaluation/streams /evaluation/streams
COPY evaluation/results /evaluation/results

WORKDIR /app/harness
# --output targets the bind mount (docker-compose.yml: ./evaluation/results),
# so the scorecard lands in the repo, not in the container's own copy.
CMD ["python", "run_eval.py", "--gateway-url", "http://nginx:80/api", "--output", "/evaluation/results/scorecard.md"]
