"""
Cloud API — Question Management

CRUD endpoints for encrypted questions.
Protected by Clerk JWT middleware.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.middleware.clerk_auth import require_role
from server.app.schemas.question import QuestionCreate, QuestionListResponse, QuestionMeta, QuestionResponse
from server.app.services.question_service import QuestionService

router = APIRouter(prefix="/questions", tags=["Questions"])

# Demo master AES key (32 bytes) for encrypting all questions
# In production, this would be managed by an HSM or KMS
DEMO_MASTER_AES_KEY = b"12345678901234567890123456789012"


def get_question_service(db: AsyncSession = Depends(get_db)) -> QuestionService:
    return QuestionService(db, DEMO_MASTER_AES_KEY)


@router.post("/", status_code=201)
async def create_question(
    data: QuestionCreate,
    auth: dict = Depends(require_role("admin", "expert")),
    svc: QuestionService = Depends(get_question_service),
):
    """Create a new question. Content is AES-256-GCM encrypted before storage."""
    q = await svc.create(
        subject=data.subject,
        difficulty=data.difficulty,
        content=data.content,
        options=data.options_as_list(),          # {A,B,C,D} → list
        correct_option=data.correct_option_as_int(),  # letter → 0-indexed int
        author_id=auth["clerk_user_id"],
    )
    return {"id": str(q.id), "status": "created"}


@router.get("/", response_model=QuestionListResponse)
async def list_questions(
    page: int = 1,
    page_size: int = 20,
    subject: str = "",
    difficulty: str = "",
    auth: dict = Depends(require_role("admin", "expert")),
    svc: QuestionService = Depends(get_question_service),
):
    """List all questions (metadata only — encrypted content not returned)."""
    raw = await svc.list_all(page=page, page_size=page_size)
    now = datetime.now(timezone.utc).isoformat()

    items = [
        QuestionMeta(
            id=q["id"],
            subject=q["subject"],
            difficulty=q["difficulty"],
            is_encrypted=True,
            content_hash=q.get("content_hash", ""),
            created_by=q.get("created_by", ""),
            created_at=q.get("created_at", now),
            updated_at=q.get("updated_at", now),
        )
        for q in raw
        if (not subject or q.get("subject", "").lower() == subject.lower())
        and (not difficulty or q.get("difficulty", "").lower() == difficulty.lower())
    ]

    return QuestionListResponse(items=items, total=len(items), page=page, page_size=page_size)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    auth: dict = Depends(require_role("admin", "expert")),
    svc: QuestionService = Depends(get_question_service),
):
    """Get question details by ID (returns decrypted content)."""
    try:
        q = await svc.get(question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Convert internal list-form options → {A,B,C,D} dict
    opts = q.get("options", [])
    if isinstance(opts, list):
        opts_dict = {k: (opts[i] if i < len(opts) else "") for i, k in enumerate("ABCD")}
    else:
        opts_dict = opts

    # Convert int correct_option → letter
    ci = q.get("correct_option", 0)
    correct_letter = "ABCD"[ci] if isinstance(ci, int) and 0 <= ci <= 3 else str(ci)

    now = datetime.now(timezone.utc).isoformat()
    return QuestionResponse(
        id=q["id"],
        subject=q["subject"],
        difficulty=q["difficulty"],
        content=q["content"],
        options=opts_dict,
        correct_option=correct_letter,
        content_hash=q["content_hash"],
        created_by=q["created_by"],
        is_encrypted=True,
        created_at=now,
        updated_at=now,
    )


@router.put("/{question_id}")
async def update_question(
    question_id: str,
    data: QuestionCreate,
    auth: dict = Depends(require_role("admin", "expert")),
    svc: QuestionService = Depends(get_question_service),
):
    """Update a question. Re-encrypts content on save."""
    try:
        return await svc.update(
            question_id=question_id,
            subject=data.subject,
            difficulty=data.difficulty,
            content=data.content,
            options=data.options_as_list(),
            correct_option=data.correct_option_as_int(),
            editor_id=auth["clerk_user_id"],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    auth: dict = Depends(require_role("admin")),
    svc: QuestionService = Depends(get_question_service),
):
    """Soft-delete a question."""
    try:
        await svc.delete(question_id, deleter_id=auth["clerk_user_id"])
        return {"id": question_id, "status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
