"""Package model — encrypted, signed exam package for distribution."""

from sqlalchemy import Column, String, Text, DateTime, func

from server.app.db.database import Base


class Package(Base):
    """Encrypted exam package containing questions, variants, and seating mapping."""

    __tablename__ = "packages"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    exam_id = Column(String(36), nullable=False)  # FK to exams.id (string UUID)
    encrypted_payload = Column(Text, nullable=False)  # AES-256-GCM encrypted content
    encryption_iv = Column(String(64), nullable=False)
    package_hash = Column(String(64), nullable=False)  # SHA-256 of encrypted payload
    signature = Column(Text, nullable=False)  # RSA-2048 signature of package_hash
    variant_mapping = Column(Text, nullable=True)  # Pre-computed seat → variant mapping (JSON)
    status = Column(String(50), default="generated")  # generated, distributed, activated
    created_at = Column(DateTime, server_default=func.now())
