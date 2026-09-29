FROM python:3.11-slim

WORKDIR /app

COPY packages/core /packages/core
COPY services/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai-service/app ./app
COPY trajectories /trajectories

ENV AI_MODE=replay
EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
