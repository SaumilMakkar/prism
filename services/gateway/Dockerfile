FROM python:3.11-slim

WORKDIR /app

COPY packages/core /packages/core
COPY services/gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/gateway/app ./app
COPY evaluation/streams /evaluation/streams

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
