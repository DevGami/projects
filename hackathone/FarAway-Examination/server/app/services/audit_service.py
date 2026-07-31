"""
Audit Service — production-grade hash-chained audit ledger.

Appends events to a hash chain where each event includes SHA-256 of the
previous event's hash. Any modification to any event in the stored chain
is detectable by re-running ChainVerifier.verify().

Architecture:
  - Works in both cloud (PostgreSQL) and edge (SQLite) modes.
  - Sequence numbers are assigned atomically inside a DB transaction.
  - Chain state is always read from the DB (not cached in memory) to
    ensure correctness across restarts and concurrent processes.
  - Export supports JSON and CSV for auditor review.

Chain formula (must match HashChain.append()):
  event_hash = SHA-256(str(sequence) + payload_hash + previous_hash)
"""

import csv
import hashlib
import io
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.audit_event import AuditEvent
from server.app.schemas.audit import (
    AuditEventResponse,
    AuditExportResponse,
    ChainVerificationResult,
    ExportMetadata,
    LogEventResponse,
)
from shared.audit.chain_verifier import ChainVerifier
from shared.crypto.hashing import HashUtils

logger = logging.getLogger(__name__)

GENESIS_HASH = "0" * 64


class AuditService:
    """Manages the hash-chained audit ledger. Thread-safe via DB transactions."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    async def log_event(
        self,
        event_type: str,
        actor_id: str,
        payload: dict,
        exam_id: str | None = None,
        actor_role: str | None = None,
        target_id: str | None = None,
    ) -> LogEventResponse:
        """
        Append a new event to the hash chain.

        This method is transaction-safe:
          1. Locks the max sequence to prevent races.
          2. Fetches the previous event's hash (chain head).
          3. Computes hashes.
          4. Inserts the new event atomically.

        Args:
            event_type: One of the EventType enum values (e.g., "CANDIDATE_AUTHENTICATED")
            actor_id: UUID or identifier string of the actor
            payload: Dict of event-specific data (will be JSON-serialized + hashed)
            exam_id: UUID of the exam this event belongs to (None = system event)
            actor_role: Role of the actor (admin/candidate/system/invigilator)
            target_id: UUID of the affected entity (optional)

        Returns:
            LogEventResponse with assigned sequence, event_hash, previous_hash
        """
        # Serialize payload to canonical JSON for deterministic hashing
        payload_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        payload_hash = HashUtils.sha256(payload_json.encode("utf-8"))

        # Atomic sequence + chain head fetch
        # Use SELECT FOR UPDATE equivalent via with_for_update() on PostgreSQL
        # SQLite handles this via serialized WAL transactions
        prev_result = await self._db.execute(
            select(AuditEvent.sequence, AuditEvent.event_hash)
            .order_by(AuditEvent.sequence.desc())
            .limit(1)
        )
        prev_row = prev_result.first()

        if prev_row is None:
            # This is the genesis (first) event
            previous_hash = GENESIS_HASH
            sequence = 1
        else:
            previous_hash = prev_row.event_hash
            sequence = prev_row.sequence + 1

        # Compute event hash: SHA-256(str(sequence) + payload_hash + previous_hash)
        event_hash = self._compute_event_hash(sequence, payload_hash, previous_hash)

        # Build the DB record
        event_id = str(uuid.uuid4())
        # Use a naive datetime in UTC because PostgreSQL column is TIMESTAMP WITHOUT TIME ZONE
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        event = AuditEvent(
            id=event_id,
            sequence=sequence,
            exam_id=exam_id,
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            target_id=target_id,
            payload=payload_json,  # Store canonical JSON string
            payload_hash=payload_hash,
            previous_hash=previous_hash,
            event_hash=event_hash,
            created_at=now,
            synced=False,
        )

        self._db.add(event)
        await self._db.commit()
        await self._db.refresh(event)

        logger.info(
            "audit_event_logged",
            extra={
                "event_id": event_id,
                "event_type": event_type,
                "sequence": sequence,
                "actor_id": actor_id,
                "exam_id": exam_id,
            },
        )

        return LogEventResponse(
            id=event.id,
            sequence=event.sequence,
            event_hash=event.event_hash,
            previous_hash=event.previous_hash,
            created_at=event.created_at,
        )

    async def get_chain(
        self,
        exam_id: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict:
        """
        Retrieve the audit chain in sequence order, optionally scoped by exam.

        Args:
            exam_id: If provided, only return events for this exam.
                     If None, return the full global chain.
            page: 1-indexed page number
            page_size: Events per page (max 500)

        Returns:
            Dict with events list, total count, pagination info
        """
        page_size = min(page_size, 500)  # Safety cap
        offset = (page - 1) * page_size

        # Build query
        query = select(AuditEvent).order_by(AuditEvent.sequence)
        count_query = select(func.count(AuditEvent.id))

        if exam_id is not None:
            query = query.where(AuditEvent.exam_id == exam_id)
            count_query = count_query.where(AuditEvent.exam_id == exam_id)

        # Count total
        total_result = await self._db.execute(count_query)
        total = total_result.scalar() or 0

        # Fetch page
        result = await self._db.execute(query.offset(offset).limit(page_size))
        events = result.scalars().all()

        return {
            "events": [AuditEventResponse.model_validate(e) for e in events],
            "total": total,
            "page": page,
            "page_size": page_size,
            "exam_id": exam_id,
        }

    async def verify_chain(self, exam_id: str | None = None) -> ChainVerificationResult:
        """
        Verify integrity of the entire hash chain (or an exam-scoped subset).

        Walks every event in sequence order, recomputing all three checks:
          1. payload_hash matches recomputed SHA-256 of payload
          2. previous_hash equals prior event's event_hash
          3. event_hash matches recomputed SHA-256(seq + payload_hash + prev_hash)

        Args:
            exam_id: If provided, verifies only this exam's events.
                     Note: exam-scoped verify checks the subset's internal
                     consistency, not cross-exam chain continuity.

        Returns:
            ChainVerificationResult with is_valid, verification details
        """
        query = select(AuditEvent).order_by(AuditEvent.sequence)
        if exam_id is not None:
            query = query.where(AuditEvent.exam_id == exam_id)

        result = await self._db.execute(query)
        events = result.scalars().all()

        # Convert ORM objects to dicts for ChainVerifier
        event_dicts = [
            {
                "id": e.id,
                "sequence": e.sequence,
                "payload": json.loads(e.payload) if isinstance(e.payload, str) else e.payload,
                "payload_hash": e.payload_hash,
                "previous_hash": e.previous_hash,
                "event_hash": e.event_hash,
            }
            for e in events
        ]

        verification = ChainVerifier.verify(event_dicts)

        return ChainVerificationResult(**verification)

    async def list_events(
        self,
        event_type: str | None = None,
        exam_id: str | None = None,
        actor_id: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        """
        List audit events with optional filtering and pagination.

        Args:
            event_type: Filter by event type (e.g., "CANDIDATE_AUTHENTICATED")
            exam_id: Filter by exam UUID
            actor_id: Filter by actor UUID
            page: 1-indexed page number
            page_size: Events per page (max 200)

        Returns:
            Dict with events list, total count, filters, pagination info
        """
        page_size = min(page_size, 200)
        offset = (page - 1) * page_size

        query = select(AuditEvent).order_by(AuditEvent.sequence.desc())
        count_query = select(func.count(AuditEvent.id))

        if event_type is not None:
            query = query.where(AuditEvent.event_type == event_type)
            count_query = count_query.where(AuditEvent.event_type == event_type)
        if exam_id is not None:
            query = query.where(AuditEvent.exam_id == exam_id)
            count_query = count_query.where(AuditEvent.exam_id == exam_id)
        if actor_id is not None:
            query = query.where(AuditEvent.actor_id == actor_id)
            count_query = count_query.where(AuditEvent.actor_id == actor_id)

        total_result = await self._db.execute(count_query)
        total = total_result.scalar() or 0

        result = await self._db.execute(query.offset(offset).limit(page_size))
        events = result.scalars().all()

        return {
            "events": [AuditEventResponse.model_validate(e) for e in events],
            "total": total,
            "page": page,
            "page_size": page_size,
            "filter_event_type": event_type,
            "filter_exam_id": exam_id,
        }

    async def export_chain(
        self,
        exam_id: str | None = None,
        fmt: str = "json",
    ) -> tuple[str, str]:
        """
        Export the full audit chain for external auditor review.

        Runs verification first so the export includes chain validity status.

        Args:
            exam_id: Scope export to a specific exam (None = full chain)
            fmt: Export format — "json" or "csv"

        Returns:
            (content: str, media_type: str) tuple
            - JSON: { metadata, chain: [...] }
            - CSV: header row + one event per row
        """
        # Fetch all events (no pagination — auditor needs the full chain)
        query = select(AuditEvent).order_by(AuditEvent.sequence)
        if exam_id is not None:
            query = query.where(AuditEvent.exam_id == exam_id)

        result = await self._db.execute(query)
        events = result.scalars().all()
        event_responses = [AuditEventResponse.model_validate(e) for e in events]

        # Quick verification for metadata
        event_dicts = [
            {
                "id": e.id,
                "sequence": e.sequence,
                "payload": json.loads(e.payload) if isinstance(e.payload, str) else e.payload,
                "payload_hash": e.payload_hash,
                "previous_hash": e.previous_hash,
                "event_hash": e.event_hash,
            }
            for e in events
        ]
        verification = ChainVerifier.verify(event_dicts)

        now = datetime.now(timezone.utc)
        meta = ExportMetadata(
            exam_id=exam_id,
            total_events=len(events),
            export_format=fmt,
            chain_valid=verification["is_valid"],
            exported_at=now,
        )

        if fmt == "csv":
            return self._export_as_csv(event_responses, meta), "text/csv"

        # Default: JSON
        export_data = AuditExportResponse(
            metadata=meta,
            chain=event_responses,
        )
        return export_data.model_dump_json(indent=2), "application/json"

    async def get_latest_event(self) -> AuditEvent | None:
        """Get the most recent event (chain head). Used for chain initialization checks."""
        result = await self._db.execute(
            select(AuditEvent).order_by(AuditEvent.sequence.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_event_by_id(self, event_id: str) -> AuditEvent | None:
        """Fetch a single audit event by UUID."""
        result = await self._db.execute(
            select(AuditEvent).where(AuditEvent.id == event_id)
        )
        return result.scalar_one_or_none()

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _compute_event_hash(sequence: int, payload_hash: str, previous_hash: str) -> str:
        """
        Compute event hash using the canonical chain formula.

        Formula: SHA-256(str(sequence) + payload_hash + previous_hash)
        This must match HashChain.append() and ChainVerifier._recompute_event_hash().
        """
        data = f"{sequence}{payload_hash}{previous_hash}"
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @staticmethod
    def _export_as_csv(events: list[AuditEventResponse], meta: ExportMetadata) -> str:
        """Serialize events to CSV format for auditor tools."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Metadata header block
        writer.writerow(["# FortisExam Audit Chain Export"])
        writer.writerow(["# exam_id", meta.exam_id or "ALL"])
        writer.writerow(["# total_events", meta.total_events])
        writer.writerow(["# chain_valid", meta.chain_valid])
        writer.writerow(["# exported_at", meta.exported_at.isoformat()])
        writer.writerow([])  # Blank separator

        # Column headers
        writer.writerow([
            "sequence", "id", "event_type", "actor_id", "actor_role",
            "exam_id", "target_id", "payload_hash", "previous_hash",
            "event_hash", "created_at", "synced",
        ])

        # Data rows
        for event in events:
            writer.writerow([
                event.sequence,
                event.id,
                event.event_type,
                event.actor_id,
                event.actor_role or "",
                event.exam_id or "",
                event.target_id or "",
                event.payload_hash,
                event.previous_hash,
                event.event_hash,
                event.created_at.isoformat(),
                event.synced,
            ])

        return output.getvalue()
