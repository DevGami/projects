"""
Anomaly Detection Rule Engine — pure Python, no ML dependencies.

Evaluates detection frames from the desktop kiosk against configurable
rules. Supports debounce cooldowns to prevent alert flooding.

Processing pipeline (matches Module 06 spec):
    DetectionFrame → RuleEngine.evaluate() → list[SecurityAlert]

Each rule checks a specific condition (face count, gaze angle, camera
status, answer change rate) and produces a SecurityAlert with severity.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from enum import Enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AlertSeverity(str, Enum):
    """Severity levels for security alerts (Module 06 spec)."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AlertType(str, Enum):
    """Detection rule types (Module 06 spec, Section: Detection Rules)."""
    MULTIPLE_FACES = "MULTIPLE_FACES"
    NO_FACE = "NO_FACE"
    GAZE_DEVIATION = "GAZE_DEVIATION"
    CAMERA_BLOCKED = "CAMERA_BLOCKED"
    RAPID_ANSWER_CHANGES = "RAPID_ANSWER_CHANGES"


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------

@dataclass
class DetectionFrame:
    """
    A single detection frame sent from the desktop kiosk.

    The Electron app runs MediaPipe client-side and sends pre-processed
    results to the edge server for rule evaluation.
    """
    session_id: str
    candidate_id: str
    face_count: int = 1
    gaze_yaw: float | None = None       # degrees from center, None if no face
    gaze_pitch: float | None = None      # degrees from center, None if no face
    camera_active: bool = True
    answer_changes_last_30s: int = 0
    timestamp: str = ""                  # ISO 8601 from client


@dataclass
class SecurityAlert:
    """A generated security alert after rule evaluation."""
    alert_type: AlertType
    severity: AlertSeverity
    details: dict
    evidence_hash: str                   # SHA-256 of the evidence payload


# ---------------------------------------------------------------------------
# Rule Configuration
# ---------------------------------------------------------------------------

@dataclass
class RuleConfig:
    """
    Configurable thresholds and cooldowns for detection rules.

    Thresholds are taken from Module 06 spec:
      - Multiple faces: face_count > 1 for > 2s → HIGH
      - No face: face_count == 0 for > 5s → HIGH
      - Looking away: gaze > 30° for > 5s → MEDIUM
      - Camera blocked: no signal > 3s → HIGH
      - Rapid answer changes: > 10 in 30s → LOW
    """
    # Multiple faces
    multi_face_threshold: int = 2           # face_count >= this triggers
    multi_face_cooldown_s: float = 10.0     # suppress duplicates for N seconds

    # No face
    no_face_cooldown_s: float = 10.0

    # Gaze deviation
    gaze_angle_threshold: float = 30.0      # degrees from center
    gaze_cooldown_s: float = 10.0

    # Camera blocked
    camera_blocked_cooldown_s: float = 10.0

    # Rapid answer changes
    rapid_changes_threshold: int = 10       # changes in 30s window
    rapid_changes_cooldown_s: float = 30.0


# ---------------------------------------------------------------------------
# Rule Engine
# ---------------------------------------------------------------------------

class RuleEngine:
    """
    Stateful rule engine that evaluates detection frames and produces alerts.

    Maintains per-session, per-rule cooldown timers to prevent alert flooding.
    The debounce logic ensures that once an alert fires, the same alert type
    for the same session is suppressed for the configured cooldown period.
    """

    def __init__(self, config: RuleConfig | None = None) -> None:
        self._config = config or RuleConfig()
        # Cooldown state: {(session_id, alert_type): last_fire_timestamp}
        self._cooldowns: dict[tuple[str, str], float] = {}

    @property
    def config(self) -> RuleConfig:
        """Read-only access to the rule configuration."""
        return self._config

    def evaluate(self, frame: DetectionFrame) -> list[SecurityAlert]:
        """
        Evaluate a detection frame against all rules.

        Args:
            frame: Pre-processed detection data from the kiosk.

        Returns:
            List of SecurityAlert objects (may be empty if no rules triggered
            or all are within cooldown).
        """
        alerts: list[SecurityAlert] = []
        now = time.monotonic()

        # Rule 1: Multiple faces (HIGH)
        if frame.face_count >= self._config.multi_face_threshold:
            alert = self._try_fire(
                session_id=frame.session_id,
                alert_type=AlertType.MULTIPLE_FACES,
                severity=AlertSeverity.HIGH,
                cooldown=self._config.multi_face_cooldown_s,
                now=now,
                details={
                    "face_count": frame.face_count,
                    "candidate_id": frame.candidate_id,
                    "timestamp": frame.timestamp,
                },
            )
            if alert:
                alerts.append(alert)

        # Rule 2: No face (HIGH)
        if frame.face_count == 0:
            alert = self._try_fire(
                session_id=frame.session_id,
                alert_type=AlertType.NO_FACE,
                severity=AlertSeverity.HIGH,
                cooldown=self._config.no_face_cooldown_s,
                now=now,
                details={
                    "face_count": 0,
                    "candidate_id": frame.candidate_id,
                    "timestamp": frame.timestamp,
                },
            )
            if alert:
                alerts.append(alert)

        # Rule 3: Gaze deviation (MEDIUM)
        if (
            frame.face_count == 1
            and frame.gaze_yaw is not None
            and frame.gaze_pitch is not None
        ):
            max_deviation = max(abs(frame.gaze_yaw), abs(frame.gaze_pitch))
            if max_deviation > self._config.gaze_angle_threshold:
                alert = self._try_fire(
                    session_id=frame.session_id,
                    alert_type=AlertType.GAZE_DEVIATION,
                    severity=AlertSeverity.MEDIUM,
                    cooldown=self._config.gaze_cooldown_s,
                    now=now,
                    details={
                        "gaze_yaw": frame.gaze_yaw,
                        "gaze_pitch": frame.gaze_pitch,
                        "max_deviation": max_deviation,
                        "threshold": self._config.gaze_angle_threshold,
                        "candidate_id": frame.candidate_id,
                        "timestamp": frame.timestamp,
                    },
                )
                if alert:
                    alerts.append(alert)

        # Rule 4: Camera blocked (HIGH)
        if not frame.camera_active:
            alert = self._try_fire(
                session_id=frame.session_id,
                alert_type=AlertType.CAMERA_BLOCKED,
                severity=AlertSeverity.HIGH,
                cooldown=self._config.camera_blocked_cooldown_s,
                now=now,
                details={
                    "camera_active": False,
                    "candidate_id": frame.candidate_id,
                    "timestamp": frame.timestamp,
                },
            )
            if alert:
                alerts.append(alert)

        # Rule 5: Rapid answer changes (LOW)
        if frame.answer_changes_last_30s > self._config.rapid_changes_threshold:
            alert = self._try_fire(
                session_id=frame.session_id,
                alert_type=AlertType.RAPID_ANSWER_CHANGES,
                severity=AlertSeverity.LOW,
                cooldown=self._config.rapid_changes_cooldown_s,
                now=now,
                details={
                    "answer_changes": frame.answer_changes_last_30s,
                    "threshold": self._config.rapid_changes_threshold,
                    "candidate_id": frame.candidate_id,
                    "timestamp": frame.timestamp,
                },
            )
            if alert:
                alerts.append(alert)

        return alerts

    def reset_cooldowns(self, session_id: str | None = None) -> None:
        """
        Clear cooldown state. If session_id is given, clears only that session.
        Otherwise clears all sessions.
        """
        if session_id is None:
            self._cooldowns.clear()
        else:
            keys_to_remove = [
                k for k in self._cooldowns if k[0] == session_id
            ]
            for k in keys_to_remove:
                del self._cooldowns[k]

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    def _try_fire(
        self,
        session_id: str,
        alert_type: AlertType,
        severity: AlertSeverity,
        cooldown: float,
        now: float,
        details: dict,
    ) -> SecurityAlert | None:
        """
        Check cooldown and fire alert if allowed.

        Returns SecurityAlert if the rule fires, None if suppressed by cooldown.
        """
        key = (session_id, alert_type.value)
        last_fired = self._cooldowns.get(key, 0.0)

        if now - last_fired < cooldown:
            return None  # Still in cooldown — suppress

        # Fire the alert
        self._cooldowns[key] = now
        evidence_hash = compute_evidence_hash(details)

        return SecurityAlert(
            alert_type=alert_type,
            severity=severity,
            details=details,
            evidence_hash=evidence_hash,
        )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def compute_evidence_hash(details: dict) -> str:
    """
    Compute SHA-256 of the evidence payload for tamper detection.

    Uses canonical JSON serialization (sorted keys, compact separators)
    identical to the audit module's payload hashing.
    """
    canonical = json.dumps(details, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
