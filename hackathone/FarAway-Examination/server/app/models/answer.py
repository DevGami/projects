"""Answer model — candidate answers with upsert semantics (session_id + question_id unique)."""

from sqlalchemy import Column, String, DateTime, UniqueConstraint, func

from server.app.db.database import Base


class Answer(Base):
    """Candidate answer. Uses composite unique constraint for upsert (T-020)."""

    __tablename__ = "answers"

    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    question_id = Column(String(36), nullable=False)
    selected_option = Column(String(10), nullable=True)  # A, B, C, D or null
    answer_hash = Column(String(64), nullable=False)  # SHA-256 of answer content
    answered_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_question"),
    )
