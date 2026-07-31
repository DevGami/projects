"""Candidate model — exam candidate with pre-computed face embedding."""

from sqlalchemy import Column, String, LargeBinary, DateTime, func

from server.app.db.database import Base


class Candidate(Base):
    """Exam candidate with pre-loaded face embedding for verification."""

    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    name = Column(String(255), nullable=False)
    roll_number = Column(String(50), unique=True, nullable=False)
    center_id = Column(String(36), nullable=False)  # FK to centers.id
    exam_id = Column(String(36), nullable=False)  # FK to exams.id
    seat_number = Column(String(10), nullable=True)
    photo_embedding = Column(LargeBinary, nullable=True)  # 512-dim face embedding
    created_at = Column(DateTime, server_default=func.now())
