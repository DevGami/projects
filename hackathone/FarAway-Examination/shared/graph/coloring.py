"""
Graph Coloring — assigns variants to seats using chromatic coloring.

Ensures no two adjacent seats share the same exam variant.
Uses NetworkX greedy coloring algorithm.
"""

from __future__ import annotations

from typing import Any

import networkx as nx


class GraphColoring:
    """Assign distinct variants to adjacent seats via graph coloring."""

    # Available coloring strategies (NetworkX greedy_color)
    LARGEST_FIRST = "largest_first"
    SMALLEST_LAST = "smallest_last"
    RANDOM_SEQUENTIAL = "random_sequential"
    INDEPENDENT_SET = "independent_set"
    CONNECTED_SEQUENTIAL_BFS = "connected_sequential_bfs"
    CONNECTED_SEQUENTIAL_DFS = "connected_sequential_dfs"

    @staticmethod
    def color(
        nodes: list[str],
        edges: list[tuple[str, str]],
        strategy: str = "largest_first",
    ) -> dict[str, int]:
        """
        Apply graph coloring to seating adjacency graph.

        Args:
            nodes: List of seat IDs
            edges: List of (seat_a, seat_b) adjacency pairs
            strategy: NetworkX coloring strategy name

        Returns:
            { seat_id: color_index }  (color_index maps to variant_id)

        Raises:
            ValueError: If nodes list is empty
        """
        if not nodes:
            raise ValueError("Cannot color an empty graph (no nodes)")

        # Build NetworkX graph
        g = nx.Graph()
        g.add_nodes_from(nodes)
        g.add_edges_from(edges)

        # Apply greedy graph coloring
        coloring = nx.coloring.greedy_color(g, strategy=strategy)

        return coloring

    @staticmethod
    def num_colors_used(nodes: list[str], edges: list[tuple[str, str]]) -> int:
        """
        Compute the number of colors used by greedy coloring.

        This is an upper bound on the true chromatic number, not the
        exact minimum. Greedy coloring may use more colors than necessary
        depending on the strategy and node ordering.

        Args:
            nodes: List of seat IDs
            edges: List of adjacency pairs

        Returns:
            Number of distinct colors used (0 for empty graph)
        """
        if not nodes:
            return 0

        coloring = GraphColoring.color(nodes, edges)
        return max(coloring.values()) + 1

    @staticmethod
    def validate_coloring(
        edges: list[tuple[str, str]],
        coloring: dict[str, int],
    ) -> dict[str, Any]:
        """
        Verify no two adjacent nodes share a color.

        Args:
            edges: List of adjacency pairs
            coloring: { seat_id: color_index } mapping

        Returns:
            {
                "is_valid": bool,
                "conflicts": [(seat_a, seat_b, shared_color)],
                "num_colors": int
            }
        """
        conflicts = []

        for a, b in edges:
            color_a = coloring.get(a)
            color_b = coloring.get(b)
            if color_a is not None and color_b is not None and color_a == color_b:
                conflicts.append((a, b, color_a))

        num_colors = len(set(coloring.values())) if coloring else 0

        return {
            "is_valid": len(conflicts) == 0,
            "conflicts": conflicts,
            "num_colors": num_colors,
        }
