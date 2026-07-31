"""Integration tests for Graph subsystem end-to-end pipeline."""

import pytest

from shared.graph.graph_builder import GraphBuilder
from shared.graph.coloring import GraphColoring
from shared.graph.variant_generator import VariantGenerator
from shared.audit.event_logger import EventLogger


class TestEndToEndGraphPipeline:
    """End-to-end integration tests for Graph Randomization (Module 04)."""

    @pytest.fixture
    def sample_questions(self):
        return [
            {"id": "q1", "options": ["A", "B", "C", "D"], "correct_option": 0},
            {"id": "q2", "options": ["True", "False"], "correct_option": 1},
            {"id": "q3", "options": ["1", "2", "3", "4"], "correct_option": 2},
            {"id": "q4", "options": ["W", "X", "Y", "Z"], "correct_option": 3},
            {"id": "q5", "options": ["Yes", "No"], "correct_option": 0},
        ]

    def test_full_pipeline_grid(self, sample_questions):
        """End-to-end test of the graph pipeline using a grid layout."""
        # 1. Build graph
        graph = GraphBuilder.from_grid(3, 2)
        assert GraphBuilder.validate(graph)["is_valid"]
        
        # 2. Color graph
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        assert GraphColoring.validate_coloring(graph["edges"], coloring)["is_valid"]
        
        # 3. Generate variants
        num_variants = max(coloring.values()) + 1
        variants = VariantGenerator.generate_variants(sample_questions, num_variants, seed=123)
        assert VariantGenerator.validate_variants(variants, sample_questions)["is_valid"]
        
        # 4. Assign variants to seats
        seat_variants = VariantGenerator.assign_variants(coloring, variants)
        assert len(seat_variants) == len(graph["nodes"])
        for seat in graph["nodes"]:
            assert seat in seat_variants
            assert "questions" in seat_variants[seat]

    def test_full_pipeline_coordinates(self, sample_questions):
        """End-to-end test of the graph pipeline using coordinate layout."""
        seats = [
            {"id": "S1", "x": 0.0, "y": 0.0},
            {"id": "S2", "x": 1.0, "y": 0.0},
            {"id": "S3", "x": 0.0, "y": 1.0},
            {"id": "S4", "x": 2.0, "y": 2.0},
        ]
        
        graph = GraphBuilder.from_coordinates(seats, radius=1.5)
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        
        num_variants = max(coloring.values()) + 1
        variants = VariantGenerator.generate_variants(sample_questions, num_variants, seed=456)
        
        seat_variants = VariantGenerator.assign_variants(coloring, variants)
        assert len(seat_variants) == len(seats)

    def test_pipeline_with_audit_logging(self, sample_questions):
        """Full pipeline with audit events logged AND chained."""
        from shared.audit.hash_chain import HashChain

        logger = EventLogger()
        chain = HashChain()
        events = []

        # 1. Build graph
        graph = GraphBuilder.from_grid(2, 2)
        ev = logger.create_event(
            EventLogger.GRAPH_CONSTRUCTED, "system", {"nodes": len(graph["nodes"])}
        )
        chain_hash_0 = chain.append(0, ev["payload_hash"])
        events.append(ev)

        # 2. Color graph
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        ev = logger.create_event(
            EventLogger.GRAPH_COLORED, "system", {"colors": len(set(coloring.values()))}
        )
        chain_hash_1 = chain.append(1, ev["payload_hash"])
        events.append(ev)

        # 3. Generate variants
        num_variants = max(coloring.values()) + 1
        variants = VariantGenerator.generate_variants(sample_questions, num_variants)
        ev = logger.create_event(
            EventLogger.VARIANTS_GENERATED, "system", {"variants": num_variants}
        )
        chain_hash_2 = chain.append(2, ev["payload_hash"])
        events.append(ev)

        # Verify event structure
        assert len(events) == 3
        assert events[0]["event_type"] == "GRAPH_CONSTRUCTED"
        assert events[1]["event_type"] == "GRAPH_COLORED"
        assert events[2]["event_type"] == "VARIANTS_GENERATED"
        for ev in events:
            assert "payload_hash" in ev
            assert len(ev["payload_hash"]) == 64  # SHA-256 hex

        # Verify chain integrity
        assert chain.length == 3
        assert chain_hash_0 != chain_hash_1  # Each event produces a unique hash
        assert chain_hash_1 != chain_hash_2
        assert chain.previous_hash == chain_hash_2  # Chain head is the last event

    def test_pipeline_deterministic_reproducibility(self, sample_questions):
        """Same inputs + same seed -> identical end-to-end output."""
        def run_pipeline(seed):
            graph = GraphBuilder.from_grid(4, 4)
            # Use deterministic coloring strategy to ensure coloring is identical
            coloring = GraphColoring.color(graph["nodes"], graph["edges"], strategy="largest_first")
            num_variants = max(coloring.values()) + 1
            variants = VariantGenerator.generate_variants(sample_questions, num_variants, seed=seed)
            return VariantGenerator.assign_variants(coloring, variants)
            
        run1 = run_pipeline(999)
        run2 = run_pipeline(999)
        run3 = run_pipeline(888)
        
        assert run1 == run2
        assert run1 != run3

    def test_adjacent_seats_never_share_variant_content(self, sample_questions):
        """For every edge, compare question order at position N — must differ."""
        # Use more questions to reduce chance of random collision
        qs = [{"id": f"q{i}", "options": ["A","B","C","D"], "correct_option": 0} for i in range(10)]
        
        graph = GraphBuilder.from_grid(3, 3)
        coloring = GraphColoring.color(graph["nodes"], graph["edges"])
        num_variants = max(coloring.values()) + 1
        variants = VariantGenerator.generate_variants(qs, num_variants, seed=10)
        seat_variants = VariantGenerator.assign_variants(coloring, variants)
        
        for u, v in graph["edges"]:
            variant_u = seat_variants[u]
            variant_v = seat_variants[v]
            
            # Since adjacent seats MUST have different colors,
            # their variant IDs must differ
            assert variant_u["variant_id"] != variant_v["variant_id"]
            
            # Their question orders should almost certainly differ
            order_u = [q["id"] for q in variant_u["questions"]]
            order_v = [q["id"] for q in variant_v["questions"]]
            assert order_u != order_v
