"""
Face Verification Service — Cosine similarity on pre-computed embeddings.

The candidate's photo embedding (512-dim numpy vector) is stored in the
Candidate model as raw bytes (LargeBinary). At authentication time, the
edge node captures a new photo, extracts its embedding, and compares
against the stored one using cosine similarity.

For the hackathon demo, if no face image is provided, the service
operates in QR-only mode (face check skipped — logged as such).
"""

from __future__ import annotations


import numpy as np


class FaceVerificationService:
    """Compares face embeddings using cosine similarity."""

    DEFAULT_THRESHOLD = 0.6  # Configurable via settings
    EMBEDDING_DIM = 512

    def __init__(self, threshold: float | None = None) -> None:
        self._threshold = threshold if threshold is not None else self.DEFAULT_THRESHOLD

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compare(
        self,
        stored_embedding_bytes: bytes,
        live_embedding: list[float] | np.ndarray,
    ) -> tuple[bool, float]:
        """
        Compare stored and live face embeddings using cosine similarity.

        Args:
            stored_embedding_bytes: Raw bytes from Candidate.photo_embedding (LargeBinary)
            live_embedding:         512-dim vector from the live capture

        Returns:
            (passed: bool, score: float)
            passed = True if score >= threshold
        """
        stored_vec = self._bytes_to_embedding(stored_embedding_bytes)
        live_vec = np.asarray(live_embedding, dtype=np.float32)

        if stored_vec.shape != (self.EMBEDDING_DIM,):
            raise ValueError(
                f"Stored embedding has wrong shape {stored_vec.shape}, "
                f"expected ({self.EMBEDDING_DIM},)"
            )
        if live_vec.shape != (self.EMBEDDING_DIM,):
            raise ValueError(
                f"Live embedding has wrong shape {live_vec.shape}, "
                f"expected ({self.EMBEDDING_DIM},)"
            )

        score = self._cosine_similarity(stored_vec, live_vec)
        passed = score >= self._threshold
        return passed, float(score)

    def compare_raw(
        self,
        vec_a: list[float] | np.ndarray,
        vec_b: list[float] | np.ndarray,
    ) -> tuple[bool, float]:
        """
        Compare two numpy-ready embedding vectors directly.

        Useful in tests where bytes serialization is not needed.
        """
        a = np.asarray(vec_a, dtype=np.float32)
        b = np.asarray(vec_b, dtype=np.float32)
        score = self._cosine_similarity(a, b)
        return score >= self._threshold, float(score)

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------

    @staticmethod
    def embedding_to_bytes(embedding: list[float] | np.ndarray) -> bytes:
        """
        Serialize a 512-dim float32 embedding to raw bytes for DB storage.

        Uses IEEE-754 float32 (4 bytes per dimension) = 2048 bytes total.
        """
        vec = np.asarray(embedding, dtype=np.float32)
        return vec.tobytes()

    @staticmethod
    def _bytes_to_embedding(raw: bytes) -> np.ndarray:
        """Deserialize raw bytes from DB back to float32 numpy array."""
        expected_bytes = FaceVerificationService.EMBEDDING_DIM * 4  # float32
        if len(raw) != expected_bytes:
            raise ValueError(
                f"Stored embedding has {len(raw)} bytes, "
                f"expected {expected_bytes} (512 x float32)"
            )
        return np.frombuffer(raw, dtype=np.float32).copy()

    # ------------------------------------------------------------------
    # Math
    # ------------------------------------------------------------------

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """
        Compute cosine similarity between two vectors.

        Returns value in [-1.0, 1.0].
        Returns 0.0 if either vector has zero magnitude.
        """
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def make_random_embedding() -> np.ndarray:
        """
        Generate a random normalized 512-dim embedding.

        Useful for seeding test candidates without a real face encoder.
        """
        vec = np.random.randn(FaceVerificationService.EMBEDDING_DIM).astype(np.float32)
        vec /= np.linalg.norm(vec)
        return vec
