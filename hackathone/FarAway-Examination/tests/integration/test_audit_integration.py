"""
Integration Tests — Module 07: Audit Ledger (SQLite in-memory)

Tests AuditService against a real SQLite database (in-memory).
Verifies:
  - DB round-trips: log → fetch → verify
  - Chain state is persisted (not memory-only)
  - Tampered DB rows are detected by verify
  - Exam-scoped queries
  - Pagination
  - Export correctness

Uses pytest-asyncio for async test support.
"""

import json

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.app.db.database import Base
from server.app.models.audit_event import AuditEvent
from server.app.services.audit_service import AuditService


# ---------------------------------------------------------------------------
# Fixtures — in-memory SQLite engine
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_engine():
    """Create a fresh in-memory SQLite engine for each test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Provide an AsyncSession for testing."""
    async_session = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def audit_svc(db_session):
    """AuditService instance wired to in-memory SQLite."""
    return AuditService(db_session)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def log_n_events(audit_svc: AuditService, n: int, exam_id: str = "exam-1") -> list:
    """Log n events and return their LogEventResponse objects."""
    results = []
    for i in range(n):
        result = await audit_svc.log_event(
            event_type="QUESTION_CREATED",
            actor_id=f"user-{i}",
            payload={"question_index": i, "content": f"Question {i}"},
            exam_id=exam_id,
            actor_role="admin",
        )
        results.append(result)
    return results


# ---------------------------------------------------------------------------
# Basic DB round-trip tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestLogAndRetrieve:
    """Verify events are persisted correctly to the DB."""

    async def test_log_event_returns_sequence_1_for_first_event(self, audit_svc):
        """First event in an empty DB should get sequence 1."""
        result = await audit_svc.log_event(
            event_type="EXAM_COMPILED",
            actor_id="admin-1",
            payload={"exam_id": "e-1", "question_count": 20},
        )
        assert result.sequence == 1

    async def test_log_event_sequence_increments(self, audit_svc):
        """Sequence numbers must monotonically increase."""
        r1 = await audit_svc.log_event("QUESTION_CREATED", "user-1", {"q": 1})
        r2 = await audit_svc.log_event("QUESTION_CREATED", "user-1", {"q": 2})
        r3 = await audit_svc.log_event("QUESTION_CREATED", "user-1", {"q": 3})

        assert r1.sequence == 1
        assert r2.sequence == 2
        assert r3.sequence == 3

    async def test_log_event_genesis_previous_hash_is_zeros(self, audit_svc):
        """First event's previous_hash must be 64 zeros."""
        result = await audit_svc.log_event("EXAM_STARTED", "system", {"session_id": "s-1"})
        assert result.previous_hash == "0" * 64

    async def test_log_event_chained_previous_hash(self, audit_svc):
        """Second event's previous_hash must equal first event's event_hash."""
        r1 = await audit_svc.log_event("QUESTION_CREATED", "admin-1", {"q": 1})
        r2 = await audit_svc.log_event("QUESTION_CREATED", "admin-1", {"q": 2})

        assert r2.previous_hash == r1.event_hash

    async def test_event_persisted_to_db(self, audit_svc, db_session):
        """Logged event should be retrievable from DB by ID."""
        result = await audit_svc.log_event(
            event_type="CANDIDATE_AUTHENTICATED",
            actor_id="candidate-42",
            payload={"method": "qr", "score": 0.97},
            exam_id="exam-1",
            actor_role="candidate",
            target_id="candidate-42",
        )

        fetched = await audit_svc.get_event_by_id(result.id)
        assert fetched is not None
        assert fetched.id == result.id
        assert fetched.event_type == "CANDIDATE_AUTHENTICATED"
        assert fetched.actor_id == "candidate-42"
        assert fetched.actor_role == "candidate"
        assert fetched.exam_id == "exam-1"
        assert fetched.target_id == "candidate-42"

    async def test_payload_stored_as_canonical_json(self, audit_svc):
        """Payload in DB should be stored as canonical JSON string."""
        payload = {"b": 2, "a": 1}  # Unordered keys
        result = await audit_svc.log_event("QUESTION_CREATED", "admin-1", payload)

        event = await audit_svc.get_event_by_id(result.id)
        stored_payload = json.loads(event.payload)

        # Keys should be normalized after round-trip
        assert stored_payload == {"a": 1, "b": 2} or stored_payload == payload

    async def test_event_hash_is_64_char_hex(self, audit_svc):
        """event_hash should be a 64-character lowercase hex string."""
        result = await audit_svc.log_event("QUESTION_CREATED", "admin-1", {"x": 1})
        assert len(result.event_hash) == 64
        assert all(c in "0123456789abcdef" for c in result.event_hash)


# ---------------------------------------------------------------------------
# Chain retrieval tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestGetChain:
    """Test get_chain() DB queries."""

    async def test_get_chain_returns_ordered_events(self, audit_svc):
        """get_chain() must return events in sequence order."""
        await log_n_events(audit_svc, 5)
        chain = await audit_svc.get_chain()

        sequences = [e.sequence for e in chain["events"]]
        assert sequences == sorted(sequences)

    async def test_get_chain_total_count(self, audit_svc):
        """get_chain() must return correct total count."""
        await log_n_events(audit_svc, 10)
        chain = await audit_svc.get_chain()
        assert chain["total"] == 10

    async def test_get_chain_exam_scoped(self, audit_svc):
        """get_chain(exam_id=X) must return only events for that exam."""
        await log_n_events(audit_svc, 3, exam_id="exam-A")
        await log_n_events(audit_svc, 2, exam_id="exam-B")

        chain_a = await audit_svc.get_chain(exam_id="exam-A")
        chain_b = await audit_svc.get_chain(exam_id="exam-B")
        chain_all = await audit_svc.get_chain()

        assert chain_a["total"] == 3
        assert chain_b["total"] == 2
        assert chain_all["total"] == 5

    async def test_get_chain_pagination(self, audit_svc):
        """Pagination should return correct page slices."""
        await log_n_events(audit_svc, 10)

        page1 = await audit_svc.get_chain(page=1, page_size=4)
        page2 = await audit_svc.get_chain(page=2, page_size=4)
        page3 = await audit_svc.get_chain(page=3, page_size=4)

        assert len(page1["events"]) == 4
        assert len(page2["events"]) == 4
        assert len(page3["events"]) == 2  # Remaining

        # Ensure no overlap
        p1_ids = {e.id for e in page1["events"]}
        p2_ids = {e.id for e in page2["events"]}
        assert p1_ids.isdisjoint(p2_ids)

    async def test_get_chain_empty_db(self, audit_svc):
        """get_chain() on empty DB should return empty list, total=0."""
        chain = await audit_svc.get_chain()
        assert chain["total"] == 0
        assert chain["events"] == []


# ---------------------------------------------------------------------------
# Chain verification with real DB
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestVerifyChainIntegration:
    """Verify chain integrity against real persisted data."""

    async def test_persisted_chain_verifies_correctly(self, audit_svc):
        """A chain built by AuditService should verify correctly."""
        await log_n_events(audit_svc, 20)
        result = await audit_svc.verify_chain()

        assert result.is_valid is True
        assert result.total_events == 20
        assert result.verified_events == 20

    async def test_empty_chain_verifies(self, audit_svc):
        """verify_chain() on empty DB should return is_valid=True."""
        result = await audit_svc.verify_chain()
        assert result.is_valid is True
        assert result.total_events == 0

    async def test_tampered_db_row_detected(self, audit_svc, db_session):
        """Directly modifying a DB row should cause verification to fail."""
        await log_n_events(audit_svc, 5)

        # Directly tamper with the payload_hash of event at sequence 3
        from sqlalchemy import update
        await db_session.execute(
            update(AuditEvent)
            .where(AuditEvent.sequence == 3)
            .values(payload_hash="tampered" * 8)
        )
        await db_session.commit()

        result = await audit_svc.verify_chain()
        assert result.is_valid is False
        assert result.first_broken_at_sequence == 3

    async def test_exam_scoped_verify(self, audit_svc):
        """verify_chain(exam_id=X) should only check events for that exam."""
        await log_n_events(audit_svc, 3, exam_id="exam-clean")
        await log_n_events(audit_svc, 3, exam_id="exam-other")

        result = await audit_svc.verify_chain(exam_id="exam-clean")
        assert result.is_valid is True

    async def test_verify_multiple_event_types(self, audit_svc):
        """Chain with diverse event types should verify correctly."""
        event_types = [
            "QUESTION_CREATED", "EXAM_COMPILED", "KEY_RELEASED",
            "CANDIDATE_AUTHENTICATED", "EXAM_STARTED", "ANSWER_SUBMITTED",
            "EXAM_SUBMITTED",
        ]
        for et in event_types:
            await audit_svc.log_event(et, "actor-1", {"type": et}, exam_id="exam-1")

        result = await audit_svc.verify_chain()
        assert result.is_valid is True
        assert result.total_events == len(event_types)


# ---------------------------------------------------------------------------
# List events tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestListEvents:
    """Test list_events() with filtering and pagination."""

    async def test_list_events_by_type(self, audit_svc):
        """list_events(event_type=X) should return only matching events."""
        await audit_svc.log_event("QUESTION_CREATED", "admin", {"q": 1})
        await audit_svc.log_event("EXAM_COMPILED", "admin", {"e": 1})
        await audit_svc.log_event("QUESTION_CREATED", "admin", {"q": 2})

        result = await audit_svc.list_events(event_type="QUESTION_CREATED")
        assert result["total"] == 2
        for event in result["events"]:
            assert event.event_type == "QUESTION_CREATED"

    async def test_list_events_by_exam(self, audit_svc):
        """list_events(exam_id=X) should return only events for that exam."""
        await log_n_events(audit_svc, 4, exam_id="exam-1")
        await log_n_events(audit_svc, 3, exam_id="exam-2")

        result = await audit_svc.list_events(exam_id="exam-1")
        assert result["total"] == 4

    async def test_list_events_pagination(self, audit_svc):
        """list_events() pagination should work correctly."""
        await log_n_events(audit_svc, 15)

        page1 = await audit_svc.list_events(page=1, page_size=5)
        page2 = await audit_svc.list_events(page=2, page_size=5)

        assert len(page1["events"]) == 5
        assert len(page2["events"]) == 5

    async def test_list_events_empty_filter_returns_all(self, audit_svc):
        """list_events() with no filters returns all events."""
        await log_n_events(audit_svc, 6)
        result = await audit_svc.list_events()
        assert result["total"] == 6


# ---------------------------------------------------------------------------
# Export tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestExportChain:
    """Test export_chain() for JSON and CSV formats."""

    async def test_export_json_structure(self, audit_svc):
        """JSON export should have metadata and chain fields."""
        await log_n_events(audit_svc, 5, exam_id="exam-export")

        content, media_type = await audit_svc.export_chain(exam_id="exam-export", fmt="json")

        assert media_type == "application/json"
        data = json.loads(content)
        assert "metadata" in data
        assert "chain" in data
        assert data["metadata"]["total_events"] == 5
        assert data["metadata"]["exam_id"] == "exam-export"
        assert len(data["chain"]) == 5

    async def test_export_json_includes_chain_validity(self, audit_svc):
        """JSON export metadata should include chain_valid field."""
        await log_n_events(audit_svc, 3, exam_id="exam-valid")

        content, _ = await audit_svc.export_chain(exam_id="exam-valid", fmt="json")
        data = json.loads(content)

        assert "chain_valid" in data["metadata"]
        assert data["metadata"]["chain_valid"] is True

    async def test_export_csv_returns_csv_media_type(self, audit_svc):
        """CSV export should return text/csv media type."""
        await log_n_events(audit_svc, 3, exam_id="exam-csv")
        content, media_type = await audit_svc.export_chain(exam_id="exam-csv", fmt="csv")
        assert media_type == "text/csv"

    async def test_export_csv_has_required_columns(self, audit_svc):
        """CSV export should include all required columns in header."""
        await log_n_events(audit_svc, 2, exam_id="exam-cols")
        content, _ = await audit_svc.export_chain(exam_id="exam-cols", fmt="csv")

        lines = content.strip().split("\n")
        # Skip metadata comment lines (start with #)
        header_line = next(
            line for line in lines if not line.startswith("#") and line.strip()
        )
        assert "sequence" in header_line
        assert "event_type" in header_line
        assert "event_hash" in header_line
        assert "previous_hash" in header_line

    async def test_export_csv_event_count_matches(self, audit_svc):
        """CSV export should have correct number of data rows."""
        n = 5
        await log_n_events(audit_svc, n, exam_id="exam-rows")
        content, _ = await audit_svc.export_chain(exam_id="exam-rows", fmt="csv")

        # Handle Windows CRLF and strip trailing whitespace per line
        lines = [
            line.strip() for line in content.split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]
        # First non-comment, non-empty line is the header; rest are data
        data_rows = lines[1:]  # Skip header
        assert len(data_rows) == n

    async def test_export_chain_ordered_by_sequence(self, audit_svc):
        """Exported chain events must be in sequence order."""
        await log_n_events(audit_svc, 10, exam_id="exam-ordered")
        content, _ = await audit_svc.export_chain(exam_id="exam-ordered", fmt="json")

        data = json.loads(content)
        sequences = [e["sequence"] for e in data["chain"]]
        assert sequences == sorted(sequences)
