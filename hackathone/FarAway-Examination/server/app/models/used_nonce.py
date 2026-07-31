"""UsedNonce — anti-replay store for QR tokens (SQLite, edge only)."""

from sqlalchemy import Column, DateTime, String, func

from server.app.db.database import Base


class UsedNonce(Base):
    """
    Tracks consumed QR token nonces to prevent replay attacks.

    Each QR token carries a single-use random nonce.
    Once a nonce is recorded here, the same QR token cannot be re-used.
    """

    __tablename__ = "used_nonces"

    id = Column(String(64), primary_key=True)  # The nonce value itself (hex)
    used_at = Column(DateTime, server_default=func.now(), nullable=False)
