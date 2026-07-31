#!/bin/bash
# FortisExam â€” Demo Reset Script
# Resets everything to a clean demo-ready state.
# Must complete in < 30 seconds.

set -e

echo "ðŸ”„ FortisExam â€” Demo Reset"
echo "=========================="

# 1. Stop all containers
echo "ðŸ›‘ Stopping containers..."
docker compose -f docker/docker-compose.yml down -v 2>/dev/null || true

# 2. Remove edge SQLite database
echo "ðŸ—ƒï¸ Removing edge database..."
rm -f data/edge.db data/edge.db-wal data/edge.db-shm

# 3. Restart containers
echo "ðŸ³ Starting fresh containers..."
docker compose -f docker/docker-compose.yml up -d

# 4. Wait for PostgreSQL
echo "â³ Waiting for PostgreSQL..."
sleep 3

# 5. Run migrations
echo "ðŸ—ƒï¸ Running migrations..."
# TODO: alembic upgrade head

# 6. Re-generate keys
echo "ðŸ”‘ Regenerating keys..."
rm -rf keys/
bash scripts/generate-keys.sh

# 7. Re-seed data
echo "ðŸŒ± Re-seeding demo data..."
python scripts/seed-demo-data.py

echo ""
echo "âœ… Demo reset complete! Ready for presentation."
echo "   Cloud: http://localhost:8000/health"
echo "   Edge:  http://localhost:8001/health"
