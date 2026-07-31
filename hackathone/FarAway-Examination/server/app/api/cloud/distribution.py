"""
Cloud API — Distribution Management

Package delivery management and admin-triggered key release (D-012).
Protected by Clerk JWT middleware (cloud mode only).

Routes:
  GET  /distribution/packages         — List all packages
  GET  /distribution/status/{id}      — Single package delivery status
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.schemas.packages import (
    PackageListResponse,
    PackageStatusResponse,
)
from server.app.services.distribution_service import DistributionService

router = APIRouter(prefix="/distribution")


@router.get("/packages", response_model=PackageListResponse)
async def list_packages(
    db: AsyncSession = Depends(get_db),
):
    """
    List all exam packages with their delivery status.

    Status values:
    - generated: Package created, not yet delivered
    - distributed: Package sent to center (future: delivery tracking)
    - activated: Key released, exam is live
    """
    svc = DistributionService(db)
    packages = await svc.list_packages()

    return PackageListResponse(
        packages=[
            PackageStatusResponse(
                package_id=p["package_id"],
                exam_id=p["exam_id"],
                status=p["status"],
                created_at=p["created_at"] or "",
            )
            for p in packages
        ],
        total=len(packages),
    )


@router.get("/status/{package_id}", response_model=PackageStatusResponse)
async def get_delivery_status(
    package_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get delivery status for a specific package."""
    svc = DistributionService(db)

    try:
        status = await svc.get_delivery_status(package_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return PackageStatusResponse(
        package_id=status["package_id"],
        exam_id=status["exam_id"],
        status=status["status"],
        created_at=status["created_at"] or "",
    )
