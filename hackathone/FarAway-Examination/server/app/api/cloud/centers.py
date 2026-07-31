"""
Cloud API — Center Management (GAP-2)

CRUD routes for exam centers.

Endpoints:
  GET  /centers/          — list all centers
  POST /centers/          — create a new center
  GET  /centers/{id}      — get center detail
  PUT  /centers/{id}      — update center
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.middleware.clerk_auth import require_role
from server.app.schemas.center import (
    CenterCreate,
    CenterListResponse,
    CenterResponse,
    CenterUpdate,
)
from server.app.services.center_service import CenterService

router = APIRouter(prefix="/centers", tags=["Centers"])


def get_center_service(db: AsyncSession = Depends(get_db)) -> CenterService:
    return CenterService(db)


@router.get("/", response_model=CenterListResponse)
async def list_centers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    auth: dict = Depends(require_role("admin", "expert", "auditor", "center_admin")),
    svc: CenterService = Depends(get_center_service),
) -> CenterListResponse:
    """List all exam centers, paginated."""
    result = await svc.list_all(page=page, page_size=page_size)
    return CenterListResponse(**result)


@router.post("/", response_model=CenterResponse, status_code=status.HTTP_201_CREATED)
async def create_center(
    body: CenterCreate,
    auth: dict = Depends(require_role("admin")),
    svc: CenterService = Depends(get_center_service),
) -> CenterResponse:
    """Create a new exam center."""
    try:
        center = await svc.create(body.model_dump())
        return CenterResponse.model_validate(center)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "create_failed", "message": str(exc)},
        ) from exc


@router.get("/{center_id}", response_model=CenterResponse)
async def get_center(
    center_id: str,
    auth: dict = Depends(require_role("admin", "expert", "auditor", "center_admin")),
    svc: CenterService = Depends(get_center_service),
) -> CenterResponse:
    """Get a single exam center by ID."""
    try:
        center = await svc.get(center_id)
        return CenterResponse.model_validate(center)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{center_id}", response_model=CenterResponse)
async def update_center(
    center_id: str,
    body: CenterUpdate,
    auth: dict = Depends(require_role("admin")),
    svc: CenterService = Depends(get_center_service),
) -> CenterResponse:
    """Update mutable fields on an exam center."""
    try:
        center = await svc.update(center_id, body.model_dump(exclude_unset=True))
        return CenterResponse.model_validate(center)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{center_id}", status_code=status.HTTP_200_OK)
async def delete_center(
    center_id: str,
    auth: dict = Depends(require_role("admin")),
    svc: CenterService = Depends(get_center_service),
) -> dict:
    """Delete an exam center."""
    try:
        await svc.delete(center_id)
        return {"status": "deleted"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
