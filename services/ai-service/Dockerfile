# Use a standard python slim image and copy uv into it
FROM python:3.12-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    git \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
# Use the cpu-only torch index to keep image size small
ENV UV_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

# Install dependencies directly into the system environment for simplicity in multi-stage
COPY requirements.txt .
# Ensure requirements.txt doesn't have redundant index-url lines that might conflict with uv env vars
RUN sed -i '/--extra-index-url/d' requirements.txt && \
    uv pip install --no-cache --system --index-strategy unsafe-best-match -r requirements.txt

# Bake the model into the image
# We set cache paths so the model is saved in a specific location we can copy
ENV HF_HOME=/app/model-cache \
    SENTENCE_TRANSFORMERS_HOME=/app/model-cache/sentence-transformers
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Final runtime stage
FROM python:3.12-slim-bookworm

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/model-cache \
    SENTENCE_TRANSFORMERS_HOME=/app/model-cache/sentence-transformers

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
# Copy the baked model
COPY --from=builder /app/model-cache /app/model-cache

# Copy application code
COPY main.py .
COPY parsers ./parsers
COPY pipelines ./pipelines
COPY routers ./routers
COPY schemas ./schemas

EXPOSE 8000

# Use uvicorn to serve the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
