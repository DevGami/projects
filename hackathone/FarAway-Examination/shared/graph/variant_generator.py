"""
Variant Generator — creates distinct question/option orderings per variant.

Each variant has a unique permutation of question order and option order.
The number of variants equals the chromatic number of the seating graph.

Supports deterministic seed for reproducible exam generation.
"""

from __future__ import annotations

import copy
import hashlib
import random
from typing import Any


class VariantGenerator:
    """Generate exam variants with shuffled question and option orders."""

    @staticmethod
    def generate_variants(
        questions: list[dict[str, Any]],
        num_variants: int,
        seed: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Generate N distinct variants of the exam.

        Each variant has:
          - Shuffled question order
          - Shuffled option order per question
          - correct_option index updated to reflect new option position

        Args:
            questions: [{
                "id": str,
                "options": [str, ...],
                "correct_option": int  (index into options)
            }, ...]
            num_variants: Number of distinct variants to generate (must be >= 1)
            seed: Base seed for deterministic generation (None = random)

        Returns:
            [{
                "variant_id": int,
                "questions": [{
                    "id": str,
                    "options": [str, ...],
                    "correct_option": int
                }, ...]
            }, ...]

        Raises:
            ValueError: If questions is empty, num_variants < 1, or question
                        structure is invalid
        """
        if not questions:
            raise ValueError("Cannot generate variants from an empty question list")
        if num_variants < 1:
            raise ValueError(f"num_variants must be >= 1, got {num_variants}")

        # Validate question structure
        for i, q in enumerate(questions):
            if "id" not in q or "options" not in q or "correct_option" not in q:
                raise ValueError(
                    f"Each question must have 'id', 'options', 'correct_option'. "
                    f"Got keys: {list(q.keys())}"
                )
            if not q["options"]:
                raise ValueError(f"Question '{q['id']}' has an empty options list")
            if not (0 <= q["correct_option"] < len(q["options"])):
                raise ValueError(
                    f"Question '{q['id']}': correct_option {q['correct_option']} "
                    f"out of bounds (options length: {len(q['options'])})"
                )

        variants = []

        for variant_id in range(num_variants):
            # Deterministic seed per variant — collision-resistant hash derivation
            if seed is not None:
                variant_seed = _derive_seed(seed, "variant", variant_id)
            else:
                variant_seed = None

            # Shuffle question order
            rng_q = random.Random(variant_seed)
            question_indices = list(range(len(questions)))
            rng_q.shuffle(question_indices)

            # Build variant questions with shuffled options
            variant_questions = []
            for q_pos, q_idx in enumerate(question_indices):
                original_q = questions[q_idx]

                # Deterministic seed for option shuffle — collision-resistant
                if seed is not None:
                    option_seed = _derive_seed(seed, "options", variant_id, q_pos)
                else:
                    option_seed = None

                shuffled_q = _shuffle_options(original_q, option_seed)
                variant_questions.append(shuffled_q)

            variants.append({
                "variant_id": variant_id,
                "questions": variant_questions,
            })

        return variants

    @staticmethod
    def assign_variants(
        coloring: dict[str, int],
        variants: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        """
        Map seat assignments to variants using graph coloring output.

        Each seat receives a deep copy of its variant to prevent aliasing bugs
        when downstream code mutates per-seat variant data.

        Args:
            coloring: { seat_id: color_index } from GraphColoring
            variants: List of variant dicts from generate_variants

        Returns:
            { seat_id: variant_dict }

        Raises:
            ValueError: If a color_index has no corresponding variant
        """
        if not coloring:
            raise ValueError("Coloring map is empty")
        if not variants:
            raise ValueError("Variants list is empty")

        # Build color → variant lookup
        variant_lookup = {v["variant_id"]: v for v in variants}

        seat_variants = {}
        for seat_id, color_index in coloring.items():
            if color_index not in variant_lookup:
                raise ValueError(
                    f"Seat {seat_id} has color {color_index} but no variant exists "
                    f"for that color. Available variant IDs: {list(variant_lookup.keys())}"
                )
            # Deep copy to prevent aliasing — each seat gets its own variant dict
            seat_variants[seat_id] = copy.deepcopy(variant_lookup[color_index])

        return seat_variants

    @staticmethod
    def validate_variants(
        variants: list[dict[str, Any]],
        original_questions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Verify all variants contain all questions with valid option reordering.

        Checks:
          - Each variant has the correct number of questions
          - Each variant contains all original question IDs
          - correct_option index is within bounds
          - The correct answer content matches the original

        Returns:
            {
                "is_valid": bool,
                "errors": [str],
                "variant_count": int,
                "questions_per_variant": int
            }
        """
        errors = []
        original_ids = {q["id"] for q in original_questions}
        original_lookup = {q["id"]: q for q in original_questions}
        expected_count = len(original_questions)

        for variant in variants:
            vid = variant.get("variant_id", "?")
            vqs = variant.get("questions", [])

            # Check question count
            if len(vqs) != expected_count:
                errors.append(
                    f"Variant {vid}: expected {expected_count} questions, got {len(vqs)}"
                )

            # Check all question IDs present
            variant_ids = {q["id"] for q in vqs}
            missing = original_ids - variant_ids
            if missing:
                errors.append(f"Variant {vid}: missing question IDs: {missing}")

            # Validate each question
            for vq in vqs:
                qid = vq["id"]
                options = vq.get("options", [])
                correct_idx = vq.get("correct_option", -1)

                # Check correct_option bounds
                if not (0 <= correct_idx < len(options)):
                    errors.append(
                        f"Variant {vid}, Q {qid}: correct_option {correct_idx} out of bounds "
                        f"(options length: {len(options)})"
                    )
                    continue

                # Check correct answer content matches original
                if qid in original_lookup:
                    orig = original_lookup[qid]
                    orig_answer = orig["options"][orig["correct_option"]]
                    variant_answer = options[correct_idx]
                    if orig_answer != variant_answer:
                        errors.append(
                            f"Variant {vid}, Q {qid}: correct answer mismatch. "
                            f"Expected '{orig_answer}', got '{variant_answer}'"
                        )

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "variant_count": len(variants),
            "questions_per_variant": expected_count,
        }


def _derive_seed(base_seed: int, *components: str | int) -> int:
    """
    Derive a deterministic, collision-resistant seed from a base seed and components.

    Uses SHA-256 truncated to 31 bits to produce a non-negative integer seed.
    This avoids the collision problem of simple arithmetic (seed * 10000 + id).

    Args:
        base_seed: The user-provided base seed
        *components: Additional components to differentiate seeds (e.g., "variant", 0)

    Returns:
        Deterministic integer seed
    """
    data = f"{base_seed}:{':'.join(str(c) for c in components)}"
    return int(hashlib.sha256(data.encode("utf-8")).hexdigest()[:8], 16)


def _shuffle_options(question: dict[str, Any], seed: int | None = None) -> dict[str, Any]:
    """
    Shuffle options for a single question, remapping correct_option.

    Uses index-tracking through the permutation to correctly remap the
    correct answer position. This is safe even when multiple options have
    identical text (unlike the .index() approach).

    Args:
        question: { "id", "options": [...], "correct_option": int }
        seed: Random seed for deterministic shuffling

    Returns:
        New question dict with shuffled options and updated correct_option
    """
    options = list(question["options"])
    correct_idx = question["correct_option"]

    # Build a permutation: indices[new_pos] = old_pos
    indices = list(range(len(options)))
    rng = random.Random(seed)
    rng.shuffle(indices)

    # Apply shuffle
    shuffled_options = [options[i] for i in indices]

    # Find correct answer's new position by tracking through the permutation.
    # indices[new_pos] = old_pos, so we need new_pos where indices[new_pos] == correct_idx
    inverse = {old_idx: new_idx for new_idx, old_idx in enumerate(indices)}
    new_correct_idx = inverse[correct_idx]

    result = copy.deepcopy(question)
    result["options"] = shuffled_options
    result["correct_option"] = new_correct_idx

    return result
