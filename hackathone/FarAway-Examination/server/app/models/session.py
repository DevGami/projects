"""Exam session model — active exam session on edge node (SQLite)."""

from sqlalchemy import Column, String, DateTime, Integer, func

from server.app.db.database import Base


class ExamSession(Base):
    """Active exam session on edge node."""

    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    candidate_id = Column(String(36), nullable=False)
    exam_id = Column(String(36), nullable=False)
    variant_id = Column(Integer, nullable=False)  # Graph-colored variant assignment
    status = Column(String(20), default="active")  # active, submitted, recovered
    current_question_index = Column(Integer, default=0)
    started_at = Column(DateTime, server_default=func.now())
    submitted_at = Column(DateTime, nullable=True)
