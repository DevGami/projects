"""Recovery snapshot model — crash recovery state for exam sessions.

One snapshot per session (UPSERT semantics via unique session_id).
Updated on every answer submission. Contains full answer state,
timer position, and question index for crash recovery.
"""

from sqlalchemy import Column, String, Text, DateTime, Integer, func

from server.app.db.database import Base


class RecoverySnapshot(Base):
    """Recovery snapshot saved on every answer submission for crash recovery."""

    __tablename__ = "recovery_snapshots"

    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False, unique=True, index=True)
    candidate_id = Column(String(36), nullable=False, index=True)
    answers_json = Column(Text, nullable=False)  # JSON array of answer dicts
    current_question_index = Column(Integer, nullable=False)
    remaining_seconds = Column(Integer, nullable=False)
    snapshot_hash = Column(String(64), nullable=False)  # SHA-256 for integrity
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
