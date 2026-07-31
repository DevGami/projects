"""
Exam Service — CRUD + compilation lifecycle.

Manages exam definitions: create, list, get, compile (stub for graph coloring),
and key release delegation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.exam import Exam


class ExamService:
    """Manages exam lifecycle from creation to compilation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        name: str,
        duration_minutes: int,
        blueprint: list | dict,
        author_id: str,
        exam_date: str = "",
        subject: str = "",
    ) -> Exam:
        """Create an exam definition.

        Blueprint can be either:
        - A list of {subject, difficulty, count} rows (from the UI)
        - A legacy dict format {difficulty_distribution: {...}}
        
        Subject is derived from the first blueprint row if not explicitly provided.
        exam_date is stored inside the blueprint dict for portability.
        """
        # Normalise blueprint to a serialisable dict
        if isinstance(blueprint, list):
            rows = [r if isinstance(r, dict) else r.model_dump() for r in blueprint]
            # Derive subject from the subjects in the blueprint rows
            if not subject:
                subjects = list(dict.fromkeys(r["subject"] for r in rows))
                subject = ", ".join(subjects) if subjects else "Mixed"
            blueprint_dict = {
                "rows": rows,
                "exam_date": exam_date,
                "total_questions": sum(r["count"] for r in rows),
            }
        else:
            blueprint_dict = dict(blueprint)
            blueprint_dict.setdefault("exam_date", exam_date)
            if not subject:
                subject = "Mixed"

        exam = Exam(
            id=str(uuid.uuid4()),
            name=name,
            subject=subject,
            blueprint=blueprint_dict,
            status="draft",
            duration_minutes=str(duration_minutes),
            created_by=author_id,
        )
        self.db.add(exam)
        await self.db.flush()
        return exam

    async def compile(self, exam_id: str) -> dict:
        """
        Compile exam: mark as compiled.

        In production, this would:
        1. Select questions per blueprint difficulty distribution
        2. Run graph coloring to generate variant mappings
        3. Create a signed + encrypted package via PackageService
        
        For now, we just flip the status.
        """
        stmt = select(Exam).where(Exam.id == exam_id)
        result = await self.db.execute(stmt)
        exam = result.scalar_one_or_none()

        if not exam:
            raise ValueError(f"Exam not found: {exam_id}")

        if exam.status != "draft":
            raise ValueError(f"Exam is not in draft status (current: {exam.status})")

        exam.status = "compiled"
        exam.compiled_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.flush()

        return {
            "exam_id": str(exam.id),
            "status": exam.status,
            "compiled_at": exam.compiled_at.isoformat(),
        }

    async def release_key(self, exam_id: str, center_id: str) -> dict:
        """Admin-triggered key release. Delegates to DistributionService."""
        # This is handled directly in the cloud exams route via DistributionService
        raise NotImplementedError("Use DistributionService.release_key() directly")

    async def get(self, exam_id: str) -> dict:
        """Get exam details."""
        stmt = select(Exam).where(Exam.id == exam_id)
        result = await self.db.execute(stmt)
        exam = result.scalar_one_or_none()

        if not exam:
            raise ValueError(f"Exam not found: {exam_id}")

        blueprint_dict = exam.blueprint or {}
        return {
            "id": str(exam.id),
            "name": exam.name,
            "subject": exam.subject,
            "status": exam.status,
            "duration_minutes": exam.duration_minutes,
            "blueprint": blueprint_dict,
            "exam_date": blueprint_dict.get("exam_date", ""),
            "question_count": blueprint_dict.get("total_questions", 0),
            "created_by": exam.created_by,
            "created_at": exam.created_at.isoformat() if exam.created_at else "",
            "compiled_at": exam.compiled_at.isoformat() if exam.compiled_at else None,
        }

    async def list_all(self, page: int = 1, page_size: int = 50) -> dict:
        """List all exams with pagination."""
        # Count
        count_stmt = select(sa_func.count()).select_from(Exam)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        # Fetch
        stmt = (
            select(Exam)
            .order_by(Exam.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(stmt)
        exams = result.scalars().all()

        items = []
        for e in exams:
            b_dict = e.blueprint or {}
            items.append({
                "id": str(e.id),
                "name": e.name,
                "subject": e.subject,
                "status": e.status,
                "duration_minutes": e.duration_minutes,
                "blueprint": b_dict,
                "exam_date": b_dict.get("exam_date", ""),
                "question_count": b_dict.get("total_questions", 0),
                "created_by": e.created_by,
                "created_at": e.created_at.isoformat() if e.created_at else "",
                "compiled_at": e.compiled_at.isoformat() if e.compiled_at else None,
            })

        return {"items": items, "total": total, "page": page, "page_size": page_size}
