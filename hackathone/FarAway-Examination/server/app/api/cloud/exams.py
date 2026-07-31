"""
Cloud API — Exam Management

Exam configuration, compilation, and key release endpoints.
Protected by Clerk JWT middleware.

Routes:
  POST /exams/                      — Create exam
  GET  /exams/                      — List all exams
  GET  /exams/{exam_id}             — Get exam details
  POST /exams/{exam_id}/compile     — Compile exam into package
  POST /exams/{exam_id}/release-key — D-012: Admin-triggered AES key release
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.middleware.clerk_auth import require_role
from server.app.schemas.exam import ExamCreate, ExamResponse
from server.app.schemas.packages import ReleaseKeyRequest, ReleaseKeyResponse
from server.app.services.distribution_service import DistributionService
from server.app.services.exam_service import ExamService

router = APIRouter(prefix="/exams")


def _get_exam_service(db: AsyncSession = Depends(get_db)) -> ExamService:
    return ExamService(db)


@router.post("/", status_code=201)
async def create_exam(
    data: ExamCreate,
    auth: dict = Depends(require_role("admin")),
    svc: ExamService = Depends(_get_exam_service),
):
    """Create a new exam definition with blueprint."""
    blueprint_input = (
        [r.model_dump() for r in data.blueprint]
        if isinstance(data.blueprint, list)
        else data.blueprint
    )
    exam = await svc.create(
        name=data.name,
        duration_minutes=data.duration_minutes,
        blueprint=blueprint_input,
        author_id=auth["clerk_user_id"],
        exam_date=data.exam_date,
    )
    await svc.db.commit()
    return {"id": str(exam.id), "status": "created", "name": exam.name}


@router.get("/")
async def list_exams(
    page: int = 1,
    page_size: int = 50,
    auth: dict = Depends(require_role("admin", "expert")),
    svc: ExamService = Depends(_get_exam_service),
):
    """List all exams with status."""
    return await svc.list_all(page=page, page_size=page_size)


@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    auth: dict = Depends(require_role("admin", "expert")),
    svc: ExamService = Depends(_get_exam_service),
):
    """Get exam details."""
    try:
        return await svc.get(exam_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{exam_id}/compile")
async def compile_exam(
    exam_id: str,
    auth: dict = Depends(require_role("admin")),
    svc: ExamService = Depends(_get_exam_service),
):
    """
    Compile exam: select questions per blueprint, generate variants via
    graph coloring, create signed+encrypted package.
    """
    from server.app.api.cloud.packages import _load_server_private_key
    from server.app.services.package_service import PackageService
    
    try:
        result = await svc.compile(exam_id)
        
        # Automatically generate the package during compile step
        private_key = _load_server_private_key()
        pkg_svc = PackageService(svc.db)
        await pkg_svc.generate(exam_id=exam_id, private_key_pem=private_key)
        
        await svc.db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{exam_id}/release-key", response_model=ReleaseKeyResponse)
async def release_key(
    exam_id: str,
    request: ReleaseKeyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-triggered key release (D-012).

    The admin clicks this button at exam start time. The server wraps the
    package AES key with the center's RSA public key and returns it. Only
    the center's private key can unwrap it to decrypt the exam package.

    This is the hackathon simplification of "time-locked keys". In production,
    this would use TEE-enforced time verification (AWS Nitro Enclaves / HSM).
    """
    svc = DistributionService(db)

    try:
        result = await svc.release_key(
            exam_id=exam_id,
            center_public_key_pem=request.center_public_key_pem,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return ReleaseKeyResponse(
        exam_id=result["exam_id"],
        package_id=result["package_id"],
        wrapped_key_b64=result["wrapped_key_b64"],
        released_at=result["released_at"],
    )
