"""Center model — exam center with seating layout for graph coloring."""

from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, func

from server.app.db.database import Base


class Center(Base):
    """Examination center with seating layout and RSA public key."""

    __tablename__ = "centers"

    id = Column(String(36), primary_key=True)  # UUID as string for SQLite compat
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    city = Column(String(100), default="")
    state = Column(String(100), default="")
    address = Column(String(500), default="")
    seating_layout = Column(JSON, nullable=True)  # { seats: [], adjacency: [] }
    seat_count = Column(Integer, nullable=False)
    risk_score = Column(Float, default=0.0)  # 0.0 = safe, 1.0 = high risk
    status = Column(String(20), default="active")  # active, inactive
    rsa_public_key = Column(String, nullable=True)  # Center's RSA-2048 public key (PEM)
    created_at = Column(DateTime, server_default=func.now())
