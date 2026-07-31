"""Exam model — exam definition with blueprint and compilation status."""

from sqlalchemy import Column, String, DateTime, JSON, func

from server.app.db.database import Base


class Exam(Base):
    """Exam definition including blueprint and compilation metadata."""

    __tablename__ = "exams"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    name = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=False)
    blueprint = Column(JSON, nullable=False)  # { difficulty_distribution, question_count, etc. }
    status = Column(String(50), default="draft")  # draft, compiled, distributed, active, completed
    duration_minutes = Column(String(10), nullable=False)
    created_by = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    compiled_at = Column(DateTime, nullable=True)
