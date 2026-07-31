"""Center service — CRUD operations for exam centers."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.center import Center


class CenterService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_all(self, page: int = 1, page_size: int = 50) -> dict:
        """Return paginated list of centers."""
        total = await self._db.scalar(select(func.count()).select_from(Center))
        offset = (page - 1) * page_size
        result = await self._db.execute(
            select(Center).order_by(Center.created_at.desc()).limit(page_size).offset(offset)
        )
        centers = result.scalars().all()
        return {
            "items": centers,
            "total": total or 0,
            "page": page,
            "page_size": page_size,
        }

    async def get(self, center_id: str) -> Center:
        """Fetch a single center by ID."""
        center = await self._db.scalar(select(Center).where(Center.id == center_id))
        if center is None:
            raise ValueError(f"Center not found: {center_id}")
        return center

    async def create(self, data: dict) -> Center:
        """Create a new center."""
        code = data.get("code")
        if not code:
            code = f"CTR-{str(uuid.uuid4())[:8].upper()}"
            
        center = Center(
            id=str(uuid.uuid4()),
            name=data["name"],
            code=code,
            city=data.get("city", ""),
            state=data.get("state", ""),
            address=data.get("address", ""),
            seat_count=data["seat_count"],
            seating_layout=data.get("seating_layout"),
            status=data.get("status", "active"),
            rsa_public_key=data.get("rsa_public_key"),
        )
        self._db.add(center)
        await self._db.commit()
        await self._db.refresh(center)
        return center

    async def update(self, center_id: str, data: dict) -> Center:
        """Update mutable fields on a center."""
        center = await self.get(center_id)
        for field, value in data.items():
            if value is not None and hasattr(center, field):
                setattr(center, field, value)
        await self._db.commit()
        await self._db.refresh(center)
        return center

    async def delete(self, center_id: str) -> None:
        """Delete a center by ID."""
        center = await self.get(center_id)
        await self._db.delete(center)
        await self._db.commit()
