"""Question model — content stored encrypted (AES-256-GCM)."""

from sqlalchemy import Column, String, Text, DateTime, Boolean, func

from server.app.db.database import Base


class Question(Base):
    """Exam question. Content is AES-256-GCM encrypted at rest."""

    __tablename__ = "questions"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(20), nullable=False)  # easy, medium, hard
    encrypted_content = Column(Text, nullable=False)  # AES-256-GCM ciphertext
    encryption_iv = Column(String(64), nullable=False)  # GCM nonce
    content_hash = Column(String(64), nullable=False)  # SHA-256 of plaintext
    created_by = Column(String(255), nullable=False)  # clerk_user_id
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
