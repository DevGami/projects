"""Seed Neon cloud DB with full demo data for kiosk + admin panel."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DB_URL = "postgresql+asyncpg://neondb_owner:npg_2Yh7pKXoeUlk@ep-billowing-tree-ahmu1abo.c-3.us-east-1.aws.neon.tech/neondb?ssl=require"

# Patch seed_demo to use Neon DB instead of SQLite BEFORE importing it
os.environ["DATABASE_URL"] = DB_URL

import scripts.seed_demo as sd
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Override the engine/session in seed_demo
sd.engine = create_async_engine(DB_URL, echo=False)
sd.async_session = async_sessionmaker(sd.engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    # Run the full seed_demo (drops + creates tables + seeds everything)
    await sd.seed_all()

    # Also seed additional cloud-specific data (packages, admin user, extra audit events)
    from server.app.seed import seed_cloud
    engine = sd.engine
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        await seed_cloud(session)

    # Verify counts
    from sqlalchemy import text
    async with engine.connect() as c:
        for table in ["questions", "exams", "centers", "candidates", "packages", "audit_events"]:
            r = await c.execute(text(f"SELECT count(*) FROM {table}"))
            print(f"  {table}: {r.scalar()}")

    await engine.dispose()
    print("\n✅ Neon DB fully seeded!")

asyncio.run(main())
