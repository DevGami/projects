"""Edge case unit tests for Graph subsystem."""

import pytest

from shared.graph.graph_builder import GraphBuilder, _row_label
from shared.graph.coloring import GraphColoring
from shared.graph.variant_generator import VariantGenerator


class TestEdgeCases:
    """Edge cases for graph construction, coloring, and variant generation."""

    def test_single_seat_center(self):
        """1x1 grid -> 1 variant, no shuffling needed."""
        graph = GraphBuilder.from_grid(1, 1)
        assert len(graph["nodes"]) == 1
        assert len(graph["edges"]) == 0

        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        assert coloring == {"A1": 0}

    def test_large_grid_10x10(self):
        """100 seats colored correctly, no conflicts."""
        graph = GraphBuilder.from_grid(10, 10)
        assert len(graph["nodes"]) == 100
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])

        val = GraphColoring.validate_coloring(graph["edges"], coloring)
        assert val["is_valid"] is True
        assert val["num_colors"] <= 4

    def test_zero_radius_no_edges(self):
        """Radius=0 -> every seat is isolated -> 1 variant needed."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 1.0, "y": 0.0},
        ]
        graph = GraphBuilder.from_coordinates(seats, radius=0.0)
        assert len(graph["edges"]) == 0
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        assert coloring == {"S1": 0, "S2": 0}

    def test_very_large_radius_full_graph(self):
        """Radius=inf -> complete graph -> max colors needed."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 1.0, "y": 0.0},
            {"id": "S3", "x": 0.0, "y": 1.0},
        ]
        graph = GraphBuilder.from_coordinates(seats, radius=100.0)
        assert len(graph["edges"]) == 3  # 3 nodes = 3 edges in complete graph
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        assert len(set(coloring.values())) == 3

    def test_duplicate_coordinates_adjacency(self):
        """Two seats at same position with radius > 0 -> adjacent."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 0.0, "y": 0.0},
        ]
        graph = GraphBuilder.from_coordinates(seats, radius=0.5)
        assert ("S1", "S2") in graph["edges"] or ("S2", "S1") in graph["edges"]

    def test_negative_coordinates(self):
        """Negative x/y coordinates work correctly."""
        seats = [
            {"id": "S1", "x": -1.0, "y": -1.0},
            {"id": "S2", "x": 1.0, "y": 1.0},  # Distance is sqrt(8) ~ 2.82
        ]
        graph = GraphBuilder.from_coordinates(seats, radius=3.0)
        assert len(graph["edges"]) == 1

    def test_single_question_variants(self):
        """1 question -> options still shuffled, question order trivially same."""
        qs = [{"id": "q1", "options": ["A", "B", "C"], "correct_option": 0}]
        variants = VariantGenerator.generate_variants(qs, 3, seed=42)

        assert len(variants) == 3
        # Options should still be shuffled
        option_orders = [tuple(v["questions"][0]["options"]) for v in variants]
        assert len(set(option_orders)) > 1

    def test_questions_with_two_options(self):
        """Binary options (T/F) still produce valid shuffles."""
        qs = [{"id": "q1", "options": ["True", "False"], "correct_option": 1}]
        variants = VariantGenerator.generate_variants(qs, 5, seed=42)

        for v in variants:
            assert v["questions"][0]["options"][v["questions"][0]["correct_option"]] == "False"

    def test_no_questions_raises_error(self):
        """Empty question list raises ValueError."""
        with pytest.raises(ValueError):
            VariantGenerator.generate_variants([], 2)

    def test_zero_variants_raises_error(self):
        """num_variants=0 raises ValueError."""
        qs = [{"id": "q1", "options": ["A", "B"], "correct_option": 0}]
        with pytest.raises(ValueError):
            VariantGenerator.generate_variants(qs, 0)

    def test_grid_with_zero_rows_raises_error(self):
        """rows=0 raises ValueError."""
        with pytest.raises(ValueError):
            GraphBuilder.from_grid(0, 5)

    def test_non_square_grid_5x2(self):
        """Non-square layouts work correctly."""
        graph = GraphBuilder.from_grid(5, 2)
        assert len(graph["nodes"]) == 10
        val = GraphBuilder.validate(graph)
        assert val["is_valid"] is True

    def test_coloring_strategy_options(self):
        """Different strategies all produce valid colorings."""
        graph = GraphBuilder.from_grid(4, 4)
        for strategy in [
            GraphColoring.LARGEST_FIRST,
            GraphColoring.SMALLEST_LAST,
            GraphColoring.RANDOM_SEQUENTIAL,
        ]:
            coloring = GraphColoring.color(
                graph["nodes"], graph["edges"], strategy=strategy
            )
            val = GraphColoring.validate_coloring(graph["edges"], coloring)
            assert val["is_valid"] is True

    # --- New tests for review findings ---

    def test_duplicate_option_text_correct_answer_tracked(self):
        """Bug #6 regression: duplicate option text must not corrupt correct answer.

        When options contain duplicate text (e.g. ["Yes", "No", "Yes"]),
        the correct_option must be tracked through permutation indices,
        not by content matching (.index()).
        """
        qs = [
            {"id": "q1", "options": ["Yes", "No", "Yes"], "correct_option": 2},
        ]
        variants = VariantGenerator.generate_variants(qs, 10, seed=42)

        for v in variants:
            q = v["questions"][0]
            # The correct answer is the THIRD option (index 2), which is "Yes"
            # We can't just check q["options"][q["correct_option"]] == "Yes"
            # because that would pass even with .index() bug.
            # Instead we validate through the full pipeline.
            assert 0 <= q["correct_option"] < len(q["options"])

        # The true test: validate_variants must confirm correctness
        val = VariantGenerator.validate_variants(variants, qs)
        assert val["is_valid"] is True

    def test_row_label_beyond_26(self):
        """_row_label should produce AA, AB, etc. for indices >= 26."""
        assert _row_label(0) == "A"
        assert _row_label(25) == "Z"
        assert _row_label(26) == "AA"
        assert _row_label(27) == "AB"
        assert _row_label(51) == "AZ"
        assert _row_label(52) == "BA"

    def test_grid_beyond_26_rows(self):
        """Grid with 28 rows should use AA, AB labels for rows 27-28."""
        graph = GraphBuilder.from_grid(28, 1)
        assert len(graph["nodes"]) == 28
        assert "A1" in graph["nodes"]
        assert "Z1" in graph["nodes"]
        assert "AA1" in graph["nodes"]
        assert "AB1" in graph["nodes"]

    def test_duplicate_seat_ids_raises_error(self):
        """from_coordinates with duplicate seat IDs should raise ValueError."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S1", "x": 1.0, "y": 1.0},  # duplicate ID
        ]
        with pytest.raises(ValueError, match="Duplicate seat IDs"):
            GraphBuilder.from_coordinates(seats, radius=2.0)

    def test_from_coordinates_empty_seats(self):
        """from_coordinates with empty list returns empty graph."""
        graph = GraphBuilder.from_coordinates([], radius=1.0)
        assert graph == {"nodes": [], "edges": []}

    def test_invalid_coloring_strategy_raises(self):
        """Invalid strategy name should raise an error from NetworkX."""
        graph = GraphBuilder.from_grid(2, 2)
        with pytest.raises(Exception):
            GraphColoring.color(graph["nodes"], graph["edges"], strategy="INVALID_STRATEGY")

    def test_correct_option_out_of_bounds_raises(self):
        """Question with correct_option out of bounds should raise ValueError."""
        qs = [{"id": "q1", "options": ["A", "B"], "correct_option": 5}]
        with pytest.raises(ValueError, match="out of bounds"):
            VariantGenerator.generate_variants(qs, 2)

    def test_empty_options_raises(self):
        """Question with empty options list should raise ValueError."""
        qs = [{"id": "q1", "options": [], "correct_option": 0}]
        with pytest.raises(ValueError, match="empty options"):
            VariantGenerator.generate_variants(qs, 2)

    def test_num_colors_used_replaces_chromatic_number(self):
        """num_colors_used returns correct count (renamed from chromatic_number)."""
        graph = GraphBuilder.from_grid(3, 3)
        num = GraphColoring.num_colors_used(graph["nodes"], graph["edges"])
        assert num == 4  # King's graph on 3x3 requires exactly 4

    def test_num_colors_used_empty_graph(self):
        """num_colors_used returns 0 for empty graph."""
        assert GraphColoring.num_colors_used([], []) == 0

    def test_assign_variants_returns_independent_copies(self):
        """Bug #8 regression: seats with same color get independent dict copies."""
        qs = [{"id": "q1", "options": ["A", "B"], "correct_option": 0}]
        coloring = {"Seat1": 0, "Seat2": 0}
        variants = VariantGenerator.generate_variants(qs, 1, seed=42)

        mapping = VariantGenerator.assign_variants(coloring, variants)

        # Mutate one seat's variant
        mapping["Seat1"]["extra_field"] = "mutated"

        # Other seat should NOT be affected
        assert "extra_field" not in mapping["Seat2"]
