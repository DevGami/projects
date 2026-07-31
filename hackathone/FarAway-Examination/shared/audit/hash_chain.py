"""
Hash Chain — cryptographic event chain for tamper-evident audit trail.

Each event hash = SHA-256(sequence || payload_hash || previous_hash).
Tampering with any event breaks the chain from that point forward.
"""

import hashlib


class HashChain:
    """Linear hash chain for audit events."""

    def __init__(self, genesis_hash: str = "0" * 64):
        """Initialize chain with genesis hash."""
        self._previous_hash = genesis_hash
        self._length = 0

    def append(self, sequence: int, payload_hash: str) -> str:
        """
        Compute hash for next event in chain.

        Args:
            sequence: Monotonic event counter
            payload_hash: SHA-256 of event payload

        Returns:
            event_hash: SHA-256(sequence + payload_hash + previous_hash)
        """
        data = f"{sequence}{payload_hash}{self._previous_hash}"
        event_hash = hashlib.sha256(data.encode("utf-8")).hexdigest()
        self._previous_hash = event_hash
        self._length += 1
        return event_hash

    @property
    def previous_hash(self) -> str:
        """Get the hash of the most recent event (chain head)."""
        return self._previous_hash

    @property
    def length(self) -> int:
        """Get the number of events in the chain."""
        return self._length
