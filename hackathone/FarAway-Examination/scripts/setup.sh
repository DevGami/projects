#!/bin/bash
# FortisExam â€” First-Time Setup Script
# Run once after cloning the repository.

set -e

echo "ðŸ”§ FortisExam â€” Setup"
echo "====================="

# 1. Check prerequisites
echo "ðŸ“‹ Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || { echo "âŒ Python 3.11+ required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "âŒ Node.js 18+ required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "âŒ Docker required"; exit 1; }
echo "âœ… All prerequisites found"

# 2. Create environment file
echo "ðŸ“„ Creating .env file..."
if [ ! -f .env ]; then
    cp docker/.env.example .env
    echo "âœ… .env created â€” EDIT IT with your Clerk keys!"
else
    echo "âš ï¸ .env already exists, skipping"
fi

# 3. Generate RSA key pairs
echo "ðŸ”‘ Generating RSA keys..."
bash scripts/generate-keys.sh

# 4. Install Python dependencies
echo "ðŸ Installing server dependencies..."
pip install -r server/requirements.txt

# 5. Install web dependencies
echo "ðŸ“¦ Installing web dependencies..."
cd web && npm install && cd ..

# 6. Install desktop dependencies
echo "ðŸ“¦ Installing desktop dependencies..."
cd desktop && npm install && cd ..

# 7. Start Docker services
echo "ðŸ³ Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d

# 8. Wait for PostgreSQL
echo "â³ Waiting for PostgreSQL..."
sleep 5

# 9. Run migrations
echo "ðŸ—ƒï¸ Running database migrations..."
# TODO: alembic upgrade head

# 10. Seed demo data
echo "ðŸŒ± Seeding demo data..."
python scripts/seed-demo-data.py

echo ""
echo "âœ… Setup complete!"
echo "   Cloud server: http://localhost:8000"
echo "   Edge server:  http://localhost:8001"
echo "   Admin portal: cd web && npm run dev"
echo "   Desktop app:  cd desktop && npm run dev"
