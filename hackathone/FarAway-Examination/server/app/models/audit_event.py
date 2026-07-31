"""Audit event model — hash-chained audit ledger entry.

Stores a single event in the tamper-evident audit chain.
Works with both PostgreSQL (cloud mode) and SQLite (edge mode)
via DB-agnostic SQLAlchemy column types.

Chain formula: event_hash = SHA-256(str(sequence) + payload_hash + previous_hash)
"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func


from server.app.db.database import Base


class AuditEvent(Base):
    """Single event in the hash-chained audit ledger."""

    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True)  # UUID as string (SQLite compat)

    # Chain position — monotonic, globally unique counter
    sequence = Column(Integer, nullable=False, unique=True, index=True)

    # Exam scope — nullable for system-level events (e.g., server startup)
    exam_id = Column(String(36), nullable=True, index=True)

    # Event classification
    event_type = Column(String(50), nullable=False, index=True)  # QUESTION_CREATED, etc.

    # Actor context
    actor_id = Column(String(255), nullable=False)         # UUID or "system"
    actor_role = Column(String(50), nullable=True)          # admin/candidate/system/invigilator

    # Affected entity (nullable — not all events have a target)
    target_id = Column(String(255), nullable=True)

    # Event data — JSON serialized
    payload = Column(Text, nullable=False)  # JSON string

    # Cryptographic chain fields
    payload_hash = Column(String(64), nullable=False)   # SHA-256(canonical JSON of payload)
    previous_hash = Column(String(64), nullable=False)  # SHA-256 hash of previous event (genesis = "0"*64)
    event_hash = Column(String(64), nullable=False, unique=True)  # SHA-256(seq + payload_hash + prev_hash)

    # Timestamp
    created_at = Column(DateTime, server_default=func.now())

    # Edge-only: sync flag for eventual upload to cloud
    synced = Column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<AuditEvent seq={self.sequence} type={self.event_type} "
            f"actor={self.actor_id} hash={self.event_hash[:8]}...>"
        )
