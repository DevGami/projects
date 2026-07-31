"""Edge case and failure tests for State Recovery (Module 05) using async actual service."""

import json
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.app.db.database import Base
from server.app.models.answer import Answer
from server.app.models.recovery_snapshot import RecoverySnapshot
from server.app.models.session import ExamSession
from server.app.services.recovery_service import RecoveryService


@pytest_asyncio.fixture
async def db_session():
    """In-memory async SQLite for edge case tests."""
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
    """Active exam session."""
    session = ExamSession(
        id="session-edge",
        candidate_id="candidate-edge",
        exam_id="exam-edge",
        variant_id=1,
        status="active",
        current_question_index=0,
        started_at=datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add(session)
    await db_session.commit()
    return session


@pytest_asyncio.fixture
async def submitted_session(db_session):
    """Already-submitted exam session."""
    session = ExamSession(
        id="session-submitted",
        candidate_id="candidate-submitted",
        exam_id="exam-edge",
        variant_id=1,
        status="submitted",
        current_question_index=10,
        started_at=datetime(2026, 6, 9, 10, 0, 0, tzinfo=timezone.utc),
        submitted_at=datetime(2026, 6, 9, 11, 30, 0, tzinfo=timezone.utc),
    )
    db_session.add(session)
    await db_session.commit()
    return session


@pytest.mark.asyncio
class TestEdgeCaseRecovery:
    """Edge cases for recovery operations."""

    async def test_restore_no_snapshot(self, db_session, active_session):
        """Restore with no snapshot raises ValueError."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="No recovery snapshot"):
            await svc.restore_session("session-edge")

    async def test_restore_submitted_session(self, db_session, submitted_session):
        """Cannot restore a submitted session."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="Cannot restore submitted"):
            await svc.restore_session("session-submitted")

    async def test_restore_nonexistent_session(self, db_session):
        """Cannot restore a non-existent session."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="Session not found"):
            await svc.restore_session("session-does-not-exist")

    async def test_get_snapshot_nonexistent_candidate(self, db_session):
        """No snapshot for non-existent candidate returns None."""
        svc = RecoveryService(db_session)
        result = await svc.get_snapshot("candidate-does-not-exist")
        assert result is None

    async def test_get_snapshot_submitted_session_excluded(self, db_session, submitted_session):
        """get_snapshot excludes submitted sessions."""
        svc = RecoveryService(db_session)
        result = await svc.get_snapshot("candidate-submitted")
        assert result is None

    async def test_save_answer_submitted_session_raises(self, db_session, submitted_session):
        """Cannot save answer to submitted session."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="No active session found"):
            await svc.save_answer("session-submitted", "q1", "A")

    async def test_save_answer_nonexistent_session_raises(self, db_session):
        """Cannot save answer to non-existent session."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="No active session found"):
            await svc.save_answer("session-nope", "q1", "A")

    async def test_submit_already_submitted_raises(self, db_session, submitted_session):
        """Cannot submit an already-submitted exam."""
        svc = RecoveryService(db_session)
        with pytest.raises(ValueError, match="No active session found"):
            await svc.submit_exam("session-submitted")

    async def test_answer_clear_option(self, db_session, active_session):
        """Clearing an answer (setting to None) works."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-edge", "q1", "A")
        await svc.save_answer("session-edge", "q1", None)
        await db_session.commit()

        stmt = select(Answer).where(Answer.session_id == "session-edge", Answer.question_id == "q1")
        res = await db_session.execute(stmt)
        answer = res.scalar_one_or_none()
        assert answer.selected_option is None

    async def test_snapshot_with_many_answers(self, db_session, active_session):
        """Snapshot handles a large number of answers (100)."""
        svc = RecoveryService(db_session)

        for i in range(100):
            await svc.save_answer("session-edge", f"q{i}", chr(65 + (i % 4)))

        await svc.save_snapshot("session-edge", 99, 600)
        await db_session.commit()

        snap = await svc.get_snapshot("candidate-edge")
        assert snap is not None
        assert len(snap["answers"]) == 100
        assert snap["integrity_verified"] is True

    async def test_submit_with_no_answers(self, db_session, active_session):
        """Submitting exam with no answers is allowed (all unanswered)."""
        svc = RecoveryService(db_session)
        result = await svc.submit_exam("session-edge")
        await db_session.commit()

        assert result["submitted"] is True
        assert result["total_answers"] == 0

    async def test_snapshot_overwrite_preserves_answer_history(self, db_session, active_session):
        """Overwriting a snapshot doesn't lose answer changes."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-edge", "q1", "A")
        await svc.save_snapshot("session-edge", 0, 1800)
        await db_session.commit()

        # Change answer
        await svc.save_answer("session-edge", "q1", "D")
        await svc.save_snapshot("session-edge", 0, 1750)
        await db_session.commit()

        snap = await svc.get_snapshot("candidate-edge")
        assert len(snap["answers"]) == 1
        assert snap["answers"][0]["selected_option"] == "D"
        assert snap["remaining_seconds"] == 1750


@pytest.mark.asyncio
class TestCorruptedSnapshot:
    """Tests for corrupted snapshot detection."""

    async def test_tampered_answers_detected(self, db_session, active_session):
        """Tampered answers_json is detected during restore."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-edge", "q1", "A")
        await svc.save_snapshot("session-edge", 0, 1800)
        await db_session.commit()

        # Tamper with the snapshot directly in DB
        stmt = select(RecoverySnapshot).where(RecoverySnapshot.session_id == "session-edge")
        res = await db_session.execute(stmt)
        snap = res.scalar_one_or_none()
        snap.answers_json = '[{"question_id":"q1","selected_option":"HACKED","answered_at":null}]'
        await db_session.commit()

        with pytest.raises(ValueError, match="integrity"):
            await svc.restore_session("session-edge")

    async def test_tampered_timer_detected(self, db_session, active_session):
        """Tampered remaining_seconds is detected during restore."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-edge", "q1", "A")
        await svc.save_snapshot("session-edge", 0, 1800)
        await db_session.commit()

        stmt = select(RecoverySnapshot).where(RecoverySnapshot.session_id == "session-edge")
        res = await db_session.execute(stmt)
        snap = res.scalar_one_or_none()
        snap.remaining_seconds = 99999  # give yourself more time
        await db_session.commit()

        with pytest.raises(ValueError, match="integrity"):
            await svc.restore_session("session-edge")

    async def test_tampered_hash_detected(self, db_session, active_session):
        """Tampered snapshot_hash is detected during restore."""
        svc = RecoveryService(db_session)
        await svc.save_answer("session-edge", "q1", "A")
        await svc.save_snapshot("session-edge", 0, 1800)
        await db_session.commit()

        stmt = select(RecoverySnapshot).where(RecoverySnapshot.session_id == "session-edge")
        res = await db_session.execute(stmt)
        snap = res.scalar_one_or_none()
        snap.snapshot_hash = "0" * 64  # fake hash
        await db_session.commit()

        with pytest.raises(ValueError, match="integrity"):
            await svc.restore_session("session-edge")
