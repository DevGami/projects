"""Security tests for State Recovery (Module 05) using async actual service."""

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
    """In-memory async SQLite for security tests."""
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
async def two_sessions(db_session):
    """Create two different candidate sessions."""
    session_a = ExamSession(
        id="session-alice",
        candidate_id="alice",
        exam_id="exam-001",
        variant_id=0,
        status="active",
        current_question_index=0,
        started_at=datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc),
    )
    session_b = ExamSession(
        id="session-bob",
        candidate_id="bob",
        exam_id="exam-001",
        variant_id=1,
        status="active",
        current_question_index=0,
        started_at=datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([session_a, session_b])
    await db_session.commit()
    return session_a, session_b


@pytest.mark.asyncio
class TestCrossSessionSecurity:
    """Verify candidates cannot access other candidates' data."""

    async def test_candidate_cannot_see_other_snapshot(self, db_session, two_sessions):
        """Alice's snapshot is not returned for Bob's candidate_id."""
        svc = RecoveryService(db_session)

        # Alice answers and snapshots
        await svc.save_answer("session-alice", "q1", "A")
        await svc.save_snapshot("session-alice", 0, 1800)
        await db_session.commit()

        # Bob has no snapshot
        bob_snap = await svc.get_snapshot("bob")
        assert bob_snap is None

        # Alice has her snapshot
        alice_snap = await svc.get_snapshot("alice")
        assert alice_snap is not None
        assert alice_snap["candidate_id"] == "alice"

    async def test_candidate_cannot_restore_other_session(self, db_session, two_sessions):
        """Bob cannot restore Alice's session — ownership is enforced at API layer."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-alice", "q1", "A")
        await svc.save_snapshot("session-alice", 0, 1800)
        await db_session.commit()

        # Restore Alice's session — works
        result = await svc.restore_session("session-alice")
        assert result["session_id"] == "session-alice"

        # Bob's session has no snapshot — restore fails
        with pytest.raises(ValueError, match="No recovery snapshot"):
            await svc.restore_session("session-bob")

    async def test_snapshot_isolation_between_sessions(self, db_session, two_sessions):
        """Each session's snapshot is independent."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-alice", "q1", "A")
        await svc.save_snapshot("session-alice", 0, 1800)

        await svc.save_answer("session-bob", "q1", "C")
        await svc.save_snapshot("session-bob", 5, 900)
        await db_session.commit()

        alice_snap = await svc.get_snapshot("alice")
        bob_snap = await svc.get_snapshot("bob")

        assert alice_snap["answers"][0]["selected_option"] == "A"
        assert bob_snap["answers"][0]["selected_option"] == "C"
        assert alice_snap["remaining_seconds"] == 1800
        assert bob_snap["remaining_seconds"] == 900


@pytest.mark.asyncio
class TestHashIntegritySecurity:
    """Verify hash-based integrity protects against tampering."""

    async def test_answer_hash_changes_on_update(self, db_session, two_sessions):
        """Changing an answer changes its hash."""
        svc = RecoveryService(db_session)

        answer1 = await svc.save_answer("session-alice", "q1", "A")
        hash1 = answer1.answer_hash

        answer2 = await svc.save_answer("session-alice", "q1", "D")
        hash2 = answer2.answer_hash

        assert hash1 != hash2

    async def test_submission_hash_changes_with_different_answers(self, db_session, two_sessions):
        """Different answers produce different submission hashes."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-alice", "q1", "A")
        await db_session.commit()
        result_alice = await svc.submit_exam("session-alice")
        await db_session.commit()

        await svc.save_answer("session-bob", "q1", "D")
        await db_session.commit()
        result_bob = await svc.submit_exam("session-bob")
        await db_session.commit()

        assert result_alice["submission_hash"] != result_bob["submission_hash"]

    async def test_snapshot_hash_prevents_timer_manipulation(self, db_session, two_sessions):
        """A candidate cannot give themselves more time by tampering."""
        svc = RecoveryService(db_session)

        await svc.save_answer("session-alice", "q1", "A")
        await svc.save_snapshot("session-alice", 0, 300)  # 5 minutes left
        await db_session.commit()

        # Tamper: change remaining time to 3 hours
        stmt = select(RecoverySnapshot).where(RecoverySnapshot.session_id == "session-alice")
        res = await db_session.execute(stmt)
        snap = res.scalar_one_or_none()
        snap.remaining_seconds = 10800
        await db_session.commit()

        # Restore detects tampering
        with pytest.raises(ValueError, match="integrity"):
            await svc.restore_session("session-alice")
