"""
Monitoring Service — security event management (edge only).

Receives anomaly events from desktop kiosk and alerts proctor.
Integrates with the RuleEngine for detection logic and AuditService
for hash-chained event logging.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.models.security_event import SecurityEvent
from server.app.services.audit_service import AuditService
from shared.monitoring.rule_engine import (
    AlertType,
    DetectionFrame,
    RuleEngine,
    SecurityAlert,
)

logger = logging.getLogger(__name__)


class MonitoringService:
    """Security event ingestion, persistence, and proctor notification."""

    def __init__(self, db: AsyncSession, rule_engine: RuleEngine | None = None) -> None:
        self._db = db
        self._rule_engine = rule_engine or RuleEngine()
        self._audit = AuditService(db)

    async def process_frame(self, frame: DetectionFrame) -> list[SecurityAlert]:
        """
        Process a detection frame: evaluate rules, persist alerts, log audit events.

        Args:
            frame: Pre-processed detection data from the Electron kiosk.

        Returns:
            List of SecurityAlert objects generated (empty if no rules triggered).
        """
        alerts = self._rule_engine.evaluate(frame)

        for alert in alerts:
            # Persist to security_events table
            event = SecurityEvent(
                id=str(uuid.uuid4()),
                session_id=frame.session_id,
                candidate_id=frame.candidate_id,
                event_type=alert.alert_type.value,
                severity=alert.severity.value,
                details=json.dumps(alert.details, sort_keys=True, separators=(",", ":")),
                evidence_hash=alert.evidence_hash,
                acknowledged=False,
                created_at=datetime.now(timezone.utc),
            )
            self._db.add(event)

            # Log to audit chain
            try:
                await self._audit.log_event(
                    event_type="ANOMALY_DETECTED",
                    actor_id="monitoring_system",
                    actor_role="system",
                    target_id=frame.candidate_id,
                    payload={
                        "alert_type": alert.alert_type.value,
                        "severity": alert.severity.value,
                        "session_id": frame.session_id,
                        "evidence_hash": alert.evidence_hash,
                    },
                )
            except Exception:
                logger.warning(
                    "Failed to log anomaly audit event for session %s",
                    frame.session_id,
                    exc_info=True,
                )

        if alerts:
            await self._db.commit()
            logger.info(
                "Processed %d alerts for session %s",
                len(alerts),
                frame.session_id,
            )

        return alerts

    async def list_events(
        self,
        session_id: str | None = None,
        severity: str | None = None,
        event_type: str | None = None,
        acknowledged: bool | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        """
        List security events with optional filtering and pagination.

        Args:
            session_id:   Filter to a single session (proctor drill-down).
            severity:     Filter by severity level (LOW, MEDIUM, HIGH, CRITICAL).
            event_type:   Filter by alert type (MULTIPLE_FACES, GAZE_DEVIATION, etc.)
            acknowledged: If True/False, filter by acknowledged status.
                          If None (default), returns all events.
            page:         Page number (1-indexed).
            page_size:    Events per page (max 200).

        Returns:
            Dict with events list, total count, and pagination info.
        """
        page_size = min(page_size, 200)
        offset = (page - 1) * page_size

        query = select(SecurityEvent).order_by(SecurityEvent.created_at.desc())
        count_query = select(func.count(SecurityEvent.id))

        if session_id is not None:
            query = query.where(SecurityEvent.session_id == session_id)
            count_query = count_query.where(SecurityEvent.session_id == session_id)
        if severity is not None:
            query = query.where(SecurityEvent.severity == severity.upper())
            count_query = count_query.where(SecurityEvent.severity == severity.upper())
        if event_type is not None:
            query = query.where(SecurityEvent.event_type == event_type)
            count_query = count_query.where(SecurityEvent.event_type == event_type)
        if acknowledged is not None:
            query = query.where(SecurityEvent.acknowledged == acknowledged)
            count_query = count_query.where(SecurityEvent.acknowledged == acknowledged)

        total_result = await self._db.execute(count_query)
        total = total_result.scalar() or 0

        result = await self._db.execute(query.offset(offset).limit(page_size))
        events = result.scalars().all()

        return {
            "events": [
                {
                    "id": e.id,
                    "session_id": e.session_id,
                    "candidate_id": e.candidate_id,
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "details": e.details,
                    "evidence_hash": e.evidence_hash,
                    "acknowledged": e.acknowledged,
                    "created_at": str(e.created_at),
                }
                for e in events
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }


    async def get_session_summary(self, session_id: str) -> dict:
        """
        Get anomaly summary for a specific session.

        Returns counts by severity and by event type.
        """
        query = select(SecurityEvent).where(SecurityEvent.session_id == session_id)
        result = await self._db.execute(query)
        events = result.scalars().all()

        severity_counter = Counter(e.severity for e in events)
        type_counter = Counter(e.event_type for e in events)

        return {
            "session_id": session_id,
            "total_events": len(events),
            "high_count": severity_counter.get("HIGH", 0),
            "medium_count": severity_counter.get("MEDIUM", 0),
            "low_count": severity_counter.get("LOW", 0),
            "event_types": dict(type_counter),
        }

    async def acknowledge_event(self, event_id: str) -> bool:
        """Mark a security event as acknowledged by proctor."""
        result = await self._db.execute(
            select(SecurityEvent).where(SecurityEvent.id == event_id)
        )
        event = result.scalar_one_or_none()
        if event is None:
            return False

        event.acknowledged = True
        await self._db.commit()
        return True

    async def get_event(self, event_id: str) -> SecurityEvent | None:
        """
        Fetch a single security event by ID.

        Returns:
            SecurityEvent ORM object or None if not found.
        """
        result = await self._db.execute(
            select(SecurityEvent).where(SecurityEvent.id == event_id)
        )
        return result.scalar_one_or_none()

