"""Unit tests — shared/graph (graph builder, coloring, variant generator)."""

import pytest

from shared.graph.graph_builder import GraphBuilder
from shared.graph.coloring import GraphColoring
from shared.graph.variant_generator import VariantGenerator


class TestGraphBuilder:
    """Adjacency graph construction tests."""

    def test_grid_layout_adjacency(self):
        """Grid layout should create correct adjacency edges."""
        graph = GraphBuilder.from_grid(3, 2)
        assert len(graph["nodes"]) == 6
        assert "A1" in graph["nodes"]
        assert "A2" in graph["nodes"]
        assert "B1" in graph["nodes"]
        assert "C2" in graph["nodes"]
        
        # In a 3x2 grid:
        # A1 A2
        # B1 B2
        # C1 C2
        # A1 neighbors: A2, B1, B2 (3 edges)
        # B1 neighbors: A1, A2, B2, C1, C2 (5 edges)
        # B2 neighbors: A1, A2, B1, C1, C2 (5 edges)
        
        edges = graph["edges"]
        assert ("A1", "A2") in edges or ("A2", "A1") in edges
        assert ("A1", "B1") in edges or ("B1", "A1") in edges
        assert ("A1", "B2") in edges or ("B2", "A1") in edges
        
        val = GraphBuilder.validate(graph)
        assert val["is_valid"] is True

    def test_corner_seats_have_fewer_neighbors(self):
        """Corner seats should have fewer adjacent seats than center seats."""
        graph = GraphBuilder.from_grid(3, 3)
        edges = graph["edges"]
        
        def count_neighbors(node):
            return sum(1 for u, v in edges if u == node or v == node)
            
        # A1 (corner) should have 3 neighbors
        assert count_neighbors("A1") == 3
        # B2 (center) should have 8 neighbors
        assert count_neighbors("B2") == 8

    def test_from_coordinates_radius(self):
        """Seats within radius are adjacent, beyond radius are not."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 1.0, "y": 0.0}, # Distance 1
            {"id": "S3", "x": 0.0, "y": 2.0}, # Distance 2
            {"id": "S4", "x": 3.0, "y": 3.0}, # Distance ~4.24
        ]
        
        graph = GraphBuilder.from_coordinates(seats, radius=1.5)
        edges = graph["edges"]
        
        assert ("S1", "S2") in edges or ("S2", "S1") in edges
        assert ("S1", "S3") not in edges and ("S3", "S1") not in edges
        assert ("S1", "S4") not in edges and ("S4", "S1") not in edges

    def test_from_coordinates_exact_radius(self):
        """Seat exactly at radius boundary IS included."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 2.0, "y": 0.0},
        ]
        graph = GraphBuilder.from_coordinates(seats, radius=2.0)
        edges = graph["edges"]
        assert len(edges) == 1
        assert ("S1", "S2") in edges or ("S2", "S1") in edges

    def test_from_layout_explicit(self):
        """Custom layout with explicit adjacency is preserved."""
        layout = {
            "seats": [
                {"id": "X1", "row": 1, "col": 1},
                {"id": "X2", "row": 1, "col": 2},
                {"id": "X3", "row": 1, "col": 3},
            ],
            "adjacency": [("X1", "X2"), ("X2", "X3")]
        }
        graph = GraphBuilder.from_layout(layout)
        assert len(graph["nodes"]) == 3
        assert len(graph["edges"]) == 2
        assert ("X1", "X2") in graph["edges"] or ("X2", "X1") in graph["edges"]
        assert ("X1", "X3") not in graph["edges"] and ("X3", "X1") not in graph["edges"]
        
        val = GraphBuilder.validate(graph)
        assert val["is_valid"] is True

    def test_validate_valid_graph(self):
        """Valid graph passes validation."""
        graph = {"nodes": ["1", "2"], "edges": [("1", "2")]}
        val = GraphBuilder.validate(graph)
        assert val["is_valid"] is True
        assert val["node_count"] == 2
        assert val["edge_count"] == 1

    def test_validate_empty_graph(self):
        """Empty graph (0 nodes) returns valid with 0 counts."""
        graph = {"nodes": [], "edges": []}
        val = GraphBuilder.validate(graph)
        assert val["is_valid"] is True
        assert val["node_count"] == 0

    def test_single_seat_no_edges(self):
        """1x1 grid has 1 node, 0 edges."""
        graph = GraphBuilder.from_grid(1, 1)
        assert len(graph["nodes"]) == 1
        assert len(graph["edges"]) == 0


class TestGraphColoring:
    """Graph coloring assignment tests."""

    def test_no_adjacent_seats_share_color(self):
        """No two adjacent seats should have the same variant."""
        graph = GraphBuilder.from_grid(5, 5)
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        
        val = GraphColoring.validate_coloring(graph["edges"], coloring)
        assert val["is_valid"] is True
        assert len(val["conflicts"]) == 0

    def test_minimum_colors_used(self):
        """Should use minimal number of colors (variants)."""
        graph = GraphBuilder.from_grid(3, 2)
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        # King's graph chromatic number is max 4
        num_colors = len(set(coloring.values()))
        assert num_colors <= 4

    def test_validate_coloring_valid(self):
        """Valid coloring passes validation with 0 conflicts."""
        edges = [("A", "B"), ("B", "C")]
        coloring = {"A": 1, "B": 2, "C": 1}
        val = GraphColoring.validate_coloring(edges, coloring)
        assert val["is_valid"] is True

    def test_validate_coloring_invalid(self):
        """Two adjacent same-color seats detected as conflict."""
        edges = [("A", "B")]
        coloring = {"A": 1, "B": 1}
        val = GraphColoring.validate_coloring(edges, coloring)
        assert val["is_valid"] is False
        assert len(val["conflicts"]) == 1
        assert val["conflicts"][0] == ("A", "B", 1)

    def test_linear_graph_two_colors(self):
        """1xN grid uses exactly 2 colors."""
        graph = GraphBuilder.from_grid(1, 5)
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        num_colors = len(set(coloring.values()))
        assert num_colors == 2

    def test_single_node_one_color(self):
        """Single seat gets a color."""
        coloring = GraphColoring.color(["A1"], [])
        assert len(set(coloring.values())) == 1

    def test_disconnected_nodes_one_color(self):
        """Nodes with no edges all get same color."""
        coloring = GraphColoring.color(["A", "B", "C"], [])
        assert len(set(coloring.values())) == 1


class TestVariantGenerator:
    """Variant generation tests."""

    @pytest.fixture
    def sample_questions(self):
        return [
            {"id": "q1", "options": ["A", "B", "C", "D"], "correct_option": 0},
            {"id": "q2", "options": ["True", "False"], "correct_option": 1},
            {"id": "q3", "options": ["1", "2", "3"], "correct_option": 2},
        ]

    def test_correct_number_of_variants(self, sample_questions):
        """Should generate exactly N variants."""
        variants = VariantGenerator.generate_variants(sample_questions, 4)
        assert len(variants) == 4

    def test_all_questions_present_in_each_variant(self, sample_questions):
        """Each variant should contain all questions."""
        variants = VariantGenerator.generate_variants(sample_questions, 2)
        for v in variants:
            q_ids = {q["id"] for q in v["questions"]}
            assert q_ids == {"q1", "q2", "q3"}

    def test_question_order_differs_between_variants(self, sample_questions):
        """Different variants should have different question orders."""
        # Using 5 questions to increase chance of permutation
        qs = [{"id": f"q{i}", "options": ["A","B"], "correct_option": 0} for i in range(5)]
        variants = VariantGenerator.generate_variants(qs, 5, seed=42)
        
        orders = [tuple(q["id"] for q in v["questions"]) for v in variants]
        # At least two orders should be different
        assert len(set(orders)) > 1

    def test_option_order_differs(self, sample_questions):
        """Options are shuffled differently across variants."""
        qs = [{"id": "q1", "options": ["A", "B", "C", "D", "E"], "correct_option": 0}]
        variants = VariantGenerator.generate_variants(qs, 5, seed=42)
        
        option_orders = [tuple(v["questions"][0]["options"]) for v in variants]
        assert len(set(option_orders)) > 1

    def test_correct_option_remapped(self, sample_questions):
        """After option shuffle, correct_option points to same answer."""
        variants = VariantGenerator.generate_variants(sample_questions, 5, seed=42)
        
        for v in variants:
            for q in v["questions"]:
                if q["id"] == "q1":
                    assert q["options"][q["correct_option"]] == "A"
                elif q["id"] == "q2":
                    assert q["options"][q["correct_option"]] == "False"
                elif q["id"] == "q3":
                    assert q["options"][q["correct_option"]] == "3"

    def test_deterministic_seed(self, sample_questions):
        """Same seed -> identical variants on repeated calls."""
        v1 = VariantGenerator.generate_variants(sample_questions, 3, seed=123)
        v2 = VariantGenerator.generate_variants(sample_questions, 3, seed=123)
        assert v1 == v2

    def test_different_seeds_differ(self, sample_questions):
        """Different seeds -> different variants."""
        # Add more questions to avoid accidental collision
        qs = [{"id": f"q{i}", "options": ["A","B","C","D"], "correct_option": 0} for i in range(10)]
        v1 = VariantGenerator.generate_variants(qs, 3, seed=123)
        v2 = VariantGenerator.generate_variants(qs, 3, seed=456)
        assert v1 != v2

    def test_assign_variants(self, sample_questions):
        """Coloring + variants -> correct seat->variant mapping."""
        coloring = {"Seat1": 0, "Seat2": 1, "Seat3": 0}
        variants = VariantGenerator.generate_variants(sample_questions, 2, seed=42)
        
        mapping = VariantGenerator.assign_variants(coloring, variants)
        assert len(mapping) == 3
        assert mapping["Seat1"]["variant_id"] == 0
        assert mapping["Seat2"]["variant_id"] == 1
        assert mapping["Seat3"]["variant_id"] == 0

    def test_validate_variants_valid(self, sample_questions):
        """Valid variants pass validation."""
        variants = VariantGenerator.generate_variants(sample_questions, 2, seed=42)
        val = VariantGenerator.validate_variants(variants, sample_questions)
        assert val["is_valid"] is True
        assert len(val["errors"]) == 0
