"""SecurityEvent model — anomaly detection events stored on edge (SQLite)."""

from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from server.app.db.database import Base


class SecurityEvent(Base):
    """Persisted security alert from anomaly detection pipeline."""

    __tablename__ = "security_events"

    id = Column(String(36), primary_key=True)              # UUID
    session_id = Column(String(36), nullable=False, index=True)
    candidate_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)        # AlertType value
    severity = Column(String(10), nullable=False)          # HIGH / MEDIUM / LOW
    details = Column(Text, nullable=False)                 # JSON blob
    evidence_hash = Column(String(64), nullable=False)     # SHA-256
    acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
