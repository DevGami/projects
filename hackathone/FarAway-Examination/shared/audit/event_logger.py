"""
Event Logger — structured audit event creation.

Creates audit events with deterministic JSON serialization,
computes payload hashes, and feeds to hash chain.
"""

from datetime import datetime, timezone

from shared.crypto.hashing import HashUtils


class EventLogger:
    """Creates structured audit events for the hash chain."""

    # Event types — examination lifecycle
    QUESTION_CREATED = "QUESTION_CREATED"
    QUESTION_MODIFIED = "QUESTION_MODIFIED"
    PACKAGE_GENERATED = "PACKAGE_GENERATED"
    PACKAGE_DISTRIBUTED = "PACKAGE_DISTRIBUTED"
    KEY_RELEASED = "KEY_RELEASED"
    CANDIDATE_AUTHENTICATED = "CANDIDATE_AUTHENTICATED"
    ANSWER_SUBMITTED = "ANSWER_SUBMITTED"
    EXAM_SUBMITTED = "EXAM_SUBMITTED"
    SESSION_RECOVERED = "SESSION_RECOVERED"
    ANOMALY_DETECTED = "ANOMALY_DETECTED"

    # Event types — graph randomization (Module 04)
    GRAPH_CONSTRUCTED = "GRAPH_CONSTRUCTED"
    GRAPH_COLORED = "GRAPH_COLORED"
    VARIANTS_GENERATED = "VARIANTS_GENERATED"

    def create_event(self, event_type: str, actor_id: str, payload: dict) -> dict:
        """
        Create a structured audit event.

        Args:
            event_type: One of the event type constants
            actor_id: ID of the actor performing the action
            payload: Event-specific data dict

        Returns:
            { event_type, actor_id, payload, payload_hash, timestamp }
        """
        payload_hash = HashUtils.sha256_json(payload)
        timestamp = datetime.now(timezone.utc).isoformat()

        return {
            "event_type": event_type,
            "actor_id": actor_id,
            "payload": payload,
            "payload_hash": payload_hash,
            "timestamp": timestamp,
        }
