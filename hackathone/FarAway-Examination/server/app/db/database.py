"""
FortisExam — Database Engine

Async SQLAlchemy engine that switches between PostgreSQL and SQLite
based on DATABASE_URL from configuration.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from server.app.config import settings

# asyncpg does not support sslmode=require, it uses ssl=require
safe_url = settings.database_url.replace("sslmode=require", "ssl=require")

engine = create_async_engine(safe_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency injection for database sessions."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
