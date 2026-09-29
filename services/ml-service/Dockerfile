FROM python:3.11-slim

WORKDIR /app

COPY packages/core /packages/core
COPY services/ml-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm || true

COPY services/ml-service/app ./app

ENV ML_BACKEND=transformer
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
