"""User model — synced from Clerk (D-014). No password stored locally."""

from sqlalchemy import Column, String, DateTime, func

from server.app.db.database import Base


class User(Base):
    """Admin portal user (synced from Clerk). Stores role mapping only."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    clerk_user_id = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), nullable=False)  # admin, expert, center_admin, invigilator, auditor
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
