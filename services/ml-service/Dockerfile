FROM python:3.11-slim

WORKDIR /app

# ML_BACKEND=hash (default): dependency-free fallbacks, no torch, builds in
# seconds. ML_BACKEND=transformer: bge-small / MiniLM / spaCy — a multi-GB
# layer, only worth pulling when the real models are actually wanted.
ARG ML_BACKEND=hash

COPY packages/core /packages/core
COPY services/ml-service/requirements.txt services/ml-service/requirements-transformer.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$ML_BACKEND" = "transformer" ]; then \
         pip install --no-cache-dir -r requirements-transformer.txt \
         && python -m spacy download en_core_web_sm; \
       fi

COPY services/ml-service/app ./app

ENV ML_BACKEND=${ML_BACKEND}
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
