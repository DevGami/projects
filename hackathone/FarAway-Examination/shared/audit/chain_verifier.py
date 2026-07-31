"""
Chain Verifier — validates integrity of hash-chained audit trail.

Walks the chain sequentially, recomputing each hash and comparing.
Any mismatch indicates tampering. Three checks are performed per event:
  1. payload_hash == SHA-256(canonical JSON of payload)
  2. previous_hash == prior event's event_hash (or "0"*64 for genesis)
  3. event_hash == SHA-256(str(sequence) + payload_hash + previous_hash)

This mirrors exactly the formula in hash_chain.HashChain.append().
"""

import hashlib
import json

GENESIS_HASH = "0" * 64


class ChainVerifier:
    """Verify integrity of a hash-chained audit trail."""

    @staticmethod
    def _recompute_payload_hash(payload: dict | str) -> str:
        """
        Recompute SHA-256 of canonical JSON payload.

        Handles both dict payloads (from DB JSON parsing) and
        pre-serialized string payloads.
        """
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except (json.JSONDecodeError, TypeError):
                # If payload is a raw string, hash it directly
                return hashlib.sha256(payload.encode("utf-8")).hexdigest()
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _recompute_event_hash(sequence: int, payload_hash: str, previous_hash: str) -> str:
        """
        Recompute event hash using the canonical chain formula.

        Formula: SHA-256(str(sequence) + payload_hash + previous_hash)
        This mirrors HashChain.append() exactly.
        """
        data = f"{sequence}{payload_hash}{previous_hash}"
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    @staticmethod
    def verify(events: list[dict]) -> dict:
        """
        Verify hash chain integrity by walking and recomputing each link.

        Args:
            events: Ordered list of audit events. Each event dict must have:
                    - sequence (int): monotonic counter
                    - payload (dict|str): event payload
                    - payload_hash (str): stored payload hash
                    - previous_hash (str): stored link to prior event
                    - event_hash (str): stored event hash

        Returns:
            {
                "is_valid": bool,
                "total_events": int,
                "verified_events": int,
                "first_broken_at_sequence": int | None,
                "broken_event_id": str | None,
                "failure_reason": str | None,
                "message": str
            }
        """
        if not events:
            return {
                "is_valid": True,
                "total_events": 0,
                "verified_events": 0,
                "first_broken_at_sequence": None,
                "broken_event_id": None,
                "failure_reason": None,
                "message": "Chain is empty — nothing to verify",
            }

        # Sort events by sequence to ensure correct order
        try:
            sorted_events = sorted(events, key=lambda e: int(e["sequence"]))
        except (KeyError, TypeError, ValueError) as exc:
            return {
                "is_valid": False,
                "total_events": len(events),
                "verified_events": 0,
                "first_broken_at_sequence": None,
                "broken_event_id": None,
                "failure_reason": "malformed_event_structure",
                "message": f"Chain verification failed — malformed event structure: {exc}",
            }

        expected_previous_hash = GENESIS_HASH

        for i, event in enumerate(sorted_events):
            sequence = event.get("sequence")
            stored_payload_hash = event.get("payload_hash", "")
            stored_previous_hash = event.get("previous_hash", "")
            stored_event_hash = event.get("event_hash", "")
            event_id = event.get("id", f"index-{i}")
            payload = event.get("payload", {})

            # Check 1: payload_hash integrity
            recomputed_payload_hash = ChainVerifier._recompute_payload_hash(payload)
            if recomputed_payload_hash != stored_payload_hash:
                return {
                    "is_valid": False,
                    "total_events": len(sorted_events),
                    "verified_events": i,
                    "first_broken_at_sequence": sequence,
                    "broken_event_id": event_id,
                    "failure_reason": "payload_hash_mismatch",
                    "message": (
                        f"Chain BROKEN at sequence {sequence} — "
                        f"payload hash mismatch (event id: {event_id})"
                    ),
                }

            # Check 2: previous_hash chain link
            if stored_previous_hash != expected_previous_hash:
                return {
                    "is_valid": False,
                    "total_events": len(sorted_events),
                    "verified_events": i,
                    "first_broken_at_sequence": sequence,
                    "broken_event_id": event_id,
                    "failure_reason": "previous_hash_mismatch",
                    "message": (
                        f"Chain BROKEN at sequence {sequence} — "
                        f"previous_hash does not match prior event "
                        f"(event id: {event_id})"
                    ),
                }

            # Check 3: event_hash integrity
            recomputed_event_hash = ChainVerifier._recompute_event_hash(
                sequence, stored_payload_hash, stored_previous_hash
            )
            if recomputed_event_hash != stored_event_hash:
                return {
                    "is_valid": False,
                    "total_events": len(sorted_events),
                    "verified_events": i,
                    "first_broken_at_sequence": sequence,
                    "broken_event_id": event_id,
                    "failure_reason": "event_hash_mismatch",
                    "message": (
                        f"Chain BROKEN at sequence {sequence} — "
                        f"event hash mismatch, possible tampering "
                        f"(event id: {event_id})"
                    ),
                }

            # Advance chain: this event's hash is the next event's expected previous_hash
            expected_previous_hash = stored_event_hash

        total = len(sorted_events)
        return {
            "is_valid": True,
            "total_events": total,
            "verified_events": total,
            "first_broken_at_sequence": None,
            "broken_event_id": None,
            "failure_reason": None,
            "message": f"Chain intact — {total} event{'s' if total != 1 else ''} verified",
        }

    @staticmethod
    def verify_single_event(
        event: dict,
        expected_previous_hash: str,
    ) -> tuple[bool, str]:
        """
        Verify a single event in isolation.

        Args:
            event: Single audit event dict
            expected_previous_hash: The expected previous_hash for this event

        Returns:
            (is_valid: bool, failure_reason: str | "")
        """
        payload = event.get("payload", {})
        stored_payload_hash = event.get("payload_hash", "")
        stored_previous_hash = event.get("previous_hash", "")
        stored_event_hash = event.get("event_hash", "")
        sequence = event.get("sequence")

        recomputed_payload_hash = ChainVerifier._recompute_payload_hash(payload)
        if recomputed_payload_hash != stored_payload_hash:
            return False, "payload_hash_mismatch"

        if stored_previous_hash != expected_previous_hash:
            return False, "previous_hash_mismatch"

        recomputed_event_hash = ChainVerifier._recompute_event_hash(
            sequence, stored_payload_hash, stored_previous_hash
        )
        if recomputed_event_hash != stored_event_hash:
            return False, "event_hash_mismatch"

        return True, ""
