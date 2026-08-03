FROM python:3.11-slim

WORKDIR /app

# Install system deps for faiss
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 bysrag

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY main.py movie_rag.py ./

# FAISS index persisted via volume
RUN mkdir -p /app/faiss_store && chown bysrag:bysrag /app/faiss_store

USER bysrag

EXPOSE 8001

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
