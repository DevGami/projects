"""Integration tests for State Recovery (Module 05) — full DB pipeline.

Uses the actual async RecoveryService.
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.app.db.database import Base
from server.app.models.answer import Answer
from server.app.models.recovery_snapshot import RecoverySnapshot
from server.app.models.session import ExamSession
from server.app.services.recovery_service import RecoveryService


# ---------------------------------------------------------------------------
# Fixtures — async SQLite for integration tests
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_session():
    """Create an in-memory async SQLite database with WAL-like behavior."""
    # Note: sqlite+aiosqlite is needed for async sqlite
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def active_session(db_session):
    """Create an active exam session in the DB."""
    session = ExamSession(
        id="session-001",
        candidate_id="candidate-001",
        exam_id="exam-001",
        variant_id=0,
        status="active",
        current_question_index=0,
        started_at=datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add(session)
    await db_session.commit()
    return session


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestAnswerPipeline:
    """Answer save → snapshot → restore pipeline."""

    async def test_save_answer_creates_record(self, db_session, active_session):
        """Saving an answer creates a record in the answers table."""
        svc = RecoveryService(db_session)
        answer = await svc.save_answer("session-001", "q1", "A")
        await db_session.commit()

        assert answer.session_id == "session-001"
        assert answer.question_id == "q1"
        assert answer.selected_option == "A"
        assert len(answer.answer_hash) == 64

    async def test_save_answer_upsert(self, db_session, active_session):
        """Updating an answer overwrites the existing record."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await db_session.commit()

        await svc.save_answer("session-001", "q1", "C")
        await db_session.commit()

        answers = await svc._get_all_answers("session-001")
        assert len(answers) == 1
        assert answers[0].selected_option == "C"

    async def test_save_multiple_answers(self, db_session, active_session):
        """Multiple answers for different questions are saved separately."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_answer("session-001", "q2", "B")
        await svc.save_answer("session-001", "q3", "C")
        await db_session.commit()

        answers = await svc._get_all_answers("session-001")
        assert len(answers) == 3


@pytest.mark.asyncio
class TestSnapshotPipeline:
    """Snapshot save and retrieval pipeline."""

    async def test_snapshot_saved_on_answer(self, db_session, active_session):
        """Snapshot is created after saving an answer."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)
        await db_session.commit()

        snap = await svc.get_snapshot("candidate-001")
        assert snap is not None
        assert snap["remaining_seconds"] == 1800
        assert len(snap["snapshot_hash"]) == 64

    async def test_snapshot_accumulates_answers(self, db_session, active_session):
        """Snapshot contains all answers submitted so far."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)

        await svc.save_answer("session-001", "q2", "B")
        await svc.save_snapshot("session-001", 1, 1750)
        await db_session.commit()

        snap = await svc.get_snapshot("candidate-001")
        assert snap is not None
        assert len(snap["answers"]) == 2
        assert snap["current_question_index"] == 1
        assert snap["remaining_seconds"] == 1750

    async def test_snapshot_upsert_single_row(self, db_session, active_session):
        """Only one snapshot row per session (UPSERT)."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)

        await svc.save_answer("session-001", "q2", "B")
        await svc.save_snapshot("session-001", 1, 1750)
        await db_session.commit()

        from sqlalchemy import select
        stmt = select(RecoverySnapshot).where(RecoverySnapshot.session_id == "session-001")
        result = await db_session.execute(stmt)
        count = len(result.scalars().all())
        assert count == 1

    async def test_snapshot_integrity_verified(self, db_session, active_session):
        """Snapshot integrity is verified on retrieval."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)
        await db_session.commit()

        snap = await svc.get_snapshot("candidate-001")
        assert snap["integrity_verified"] is True


@pytest.mark.asyncio
class TestRecoveryPipeline:
    """Full crash recovery pipeline."""

    async def test_full_crash_recovery(self, db_session, active_session):
        """Submit answers → crash → restore → all answers present."""
        svc = RecoveryService(db_session)

        # Submit 3 answers with snapshots
        for i, opt in enumerate(["A", "B", "D"]):
            await svc.save_answer("session-001", f"q{i+1}", opt)
            await svc.save_snapshot("session-001", i, 1800 - i * 50)
        await db_session.commit()

        # === SIMULATED CRASH ===

        # Restore session
        result = await svc.restore_session("session-001")
        await db_session.commit()

        assert result["restored"] is True
        assert result["status"] == "recovered"
        assert len(result["answers"]) == 3
        assert result["current_question_index"] == 2
        assert result["remaining_seconds"] == 1700

    async def test_restore_updates_session_status(self, db_session, active_session):
        """Session status changes from 'active' to 'recovered'."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)
        await db_session.commit()

        await svc.restore_session("session-001")
        await db_session.commit()

        from sqlalchemy import select
        stmt = select(ExamSession).where(ExamSession.id == "session-001")
        result = await db_session.execute(stmt)
        session = result.scalar_one_or_none()
        assert session.status == "recovered"

    async def test_restore_already_recovered_session(self, db_session, active_session):
        """Restoring an already-recovered session works (second crash)."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_snapshot("session-001", 0, 1800)
        await db_session.commit()

        await svc.restore_session("session-001")
        await db_session.commit()

        # Second crash and restore should still work
        result = await svc.restore_session("session-001")
        await db_session.commit()
        assert result["restored"] is True


@pytest.mark.asyncio
class TestExamSubmission:
    """Final exam submission tests."""

    async def test_submit_exam(self, db_session, active_session):
        """Final submission freezes session and generates hash."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await svc.save_answer("session-001", "q2", "B")
        await db_session.commit()

        result = await svc.submit_exam("session-001")
        await db_session.commit()

        assert result["submitted"] is True
        assert result["total_answers"] == 2
        assert len(result["submission_hash"]) == 64

    async def test_submit_changes_status(self, db_session, active_session):
        """Submitted session has status 'submitted'."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await db_session.commit()

        await svc.submit_exam("session-001")
        await db_session.commit()

        from sqlalchemy import select
        stmt = select(ExamSession).where(ExamSession.id == "session-001")
        result = await db_session.execute(stmt)
        session = result.scalar_one_or_none()
        assert session.status == "submitted"

    async def test_submit_hash_deterministic(self, db_session, active_session):
        """Same answers produce same submission hash."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-001", "q1", "A")
        await db_session.commit()

        # Read the hash before submission
        from shared.crypto.hashing import HashUtils
        answers = await svc._get_all_answers("session-001")
        payload = {
            "session_id": "session-001",
            "candidate_id": "candidate-001",
            "exam_id": "exam-001",
            "answers": [
                {"question_id": a.question_id, "selected_option": a.selected_option, "answer_hash": a.answer_hash}
                for a in answers
            ],
        }
        expected_hash = HashUtils.sha256_json(payload)

        result = await svc.submit_exam("session-001")
        assert result["submission_hash"] == expected_hash
