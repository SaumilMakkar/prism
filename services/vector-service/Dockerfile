FROM python:3.11-slim

WORKDIR /app

COPY packages/core /packages/core
COPY services/vector-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/vector-service/app ./app
COPY corpus /corpus

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
