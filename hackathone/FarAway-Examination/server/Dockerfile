# FortisExam Server
# Mode-switchable: SERVER_MODE=cloud (PostgreSQL) | SERVER_MODE=edge (SQLite)

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy shared library first (dependency)
COPY shared/ /app/shared/

# Copy server code
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt

COPY server/ /app/server/

# Set Python path for imports
ENV PYTHONPATH=/app

# Default to cloud mode
ENV SERVER_MODE=cloud

EXPOSE 8000

CMD ["uvicorn", "server.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
