"""
Graph Builder — constructs adjacency graph from seating layout.

Supports three construction modes:
  1. from_grid(rows, cols)         — King's graph (8-directional adjacency)
  2. from_coordinates(seats, radius) — Radius-based Euclidean adjacency
  3. from_layout(layout)           — Explicit custom adjacency
"""

from __future__ import annotations

import math
import string
from typing import Any


class GraphBuilder:
    """Build adjacency graph from seating layout."""

    @staticmethod
    def from_grid(rows: int, cols: int) -> dict[str, Any]:
        """
        Create adjacency graph from a grid seating layout.

        Uses King's graph model: each seat is adjacent to all 8 surrounding
        seats (horizontal, vertical, and diagonal neighbors).

        Args:
            rows: Number of rows (must be >= 1)
            cols: Number of columns (must be >= 1)

        Returns:
            { "nodes": [seat_ids], "edges": [(seat_a, seat_b)] }

        Raises:
            ValueError: If rows or cols < 1
        """
        if rows < 1 or cols < 1:
            raise ValueError(f"Grid dimensions must be >= 1, got rows={rows}, cols={cols}")

        # Generate seat IDs: A1, A2, ..., B1, B2, ...
        nodes = []
        grid = {}
        for r in range(rows):
            row_letter = _row_label(r)
            for c in range(cols):
                seat_id = f"{row_letter}{c + 1}"
                nodes.append(seat_id)
                grid[(r, c)] = seat_id

        # Build edges — 8-directional (king's graph)
        edges = set()
        directions = [
            (-1, -1), (-1, 0), (-1, 1),
            (0, -1),           (0, 1),
            (1, -1),  (1, 0),  (1, 1),
        ]
        for r in range(rows):
            for c in range(cols):
                for dr, dc in directions:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        a = grid[(r, c)]
                        b = grid[(nr, nc)]
                        edge = tuple(sorted((a, b)))
                        edges.add(edge)

        return {
            "nodes": nodes,
            "edges": sorted(edges),
        }

    @staticmethod
    def from_coordinates(
        seats: list[dict[str, Any]],
        radius: float,
    ) -> dict[str, Any]:
        """
        Create adjacency graph from seat coordinates with radius-based adjacency.

        Two seats are adjacent if their Euclidean distance is <= radius.

        Args:
            seats: [{ "id": "A1", "x": 0.0, "y": 0.0 }, ...]
            radius: Maximum Euclidean distance for adjacency (must be >= 0)

        Returns:
            { "nodes": [seat_ids], "edges": [(seat_a, seat_b)] }

        Raises:
            ValueError: If radius < 0 or seats list is empty with invalid entries
        """
        if radius < 0:
            raise ValueError(f"Radius must be >= 0, got {radius}")

        if not seats:
            return {"nodes": [], "edges": []}

        # Validate seat entries
        for seat in seats:
            if "id" not in seat or "x" not in seat or "y" not in seat:
                raise ValueError(f"Each seat must have 'id', 'x', 'y' keys, got: {seat}")

        nodes = [s["id"] for s in seats]

        # Validate no duplicate seat IDs
        if len(set(nodes)) != len(nodes):
            seen = set()
            dupes = [sid for sid in nodes if sid in seen or seen.add(sid)]
            raise ValueError(f"Duplicate seat IDs found: {dupes}")

        # Pairwise Euclidean distance — add edge if distance <= radius
        edges = set()
        for i in range(len(seats)):
            for j in range(i + 1, len(seats)):
                dx = seats[i]["x"] - seats[j]["x"]
                dy = seats[i]["y"] - seats[j]["y"]
                distance = math.sqrt(dx * dx + dy * dy)
                if distance <= radius:
                    edge = tuple(sorted((seats[i]["id"], seats[j]["id"])))
                    edges.add(edge)

        return {
            "nodes": nodes,
            "edges": sorted(edges),
        }

    @staticmethod
    def from_layout(layout: dict[str, Any]) -> dict[str, Any]:
        """
        Create adjacency graph from custom layout with explicit adjacency.

        Args:
            layout: {
                "seats": [{ "id": str, "row": int, "col": int }],
                "adjacency": [(id_a, id_b)]
            }

        Returns:
            { "nodes": [seat_ids], "edges": [(seat_a, seat_b)] }

        Raises:
            ValueError: If seat IDs in adjacency don't exist in seats list
        """
        if "seats" not in layout or "adjacency" not in layout:
            raise ValueError("Layout must have 'seats' and 'adjacency' keys")

        seat_ids = {s["id"] for s in layout["seats"]}
        nodes = [s["id"] for s in layout["seats"]]

        # Validate adjacency references
        edges = set()
        for a, b in layout["adjacency"]:
            if a not in seat_ids:
                raise ValueError(f"Adjacency references unknown seat: {a}")
            if b not in seat_ids:
                raise ValueError(f"Adjacency references unknown seat: {b}")
            edge = tuple(sorted((a, b)))
            edges.add(edge)

        return {
            "nodes": nodes,
            "edges": sorted(edges),
        }

    @staticmethod
    def validate(graph: dict[str, Any]) -> dict[str, Any]:
        """
        Validate graph structure.

        Checks:
          - nodes list exists and contains strings
          - edges list exists and contains valid pairs
          - edge endpoints reference existing nodes

        Returns:
            { "is_valid": bool, "node_count": int, "edge_count": int, "errors": [] }
        """
        errors = []

        if "nodes" not in graph:
            errors.append("Missing 'nodes' key")
        if "edges" not in graph:
            errors.append("Missing 'edges' key")

        if errors:
            return {
                "is_valid": False,
                "node_count": 0,
                "edge_count": 0,
                "errors": errors,
            }

        nodes = graph["nodes"]
        edges = graph["edges"]
        node_set = set(nodes)

        # Check for duplicate node IDs
        if len(nodes) != len(node_set):
            errors.append("Duplicate node IDs found")

        # Validate edges reference existing nodes
        for edge in edges:
            if len(edge) != 2:
                errors.append(f"Edge must be a pair, got: {edge}")
                continue
            a, b = edge
            if a not in node_set:
                errors.append(f"Edge references unknown node: {a}")
            if b not in node_set:
                errors.append(f"Edge references unknown node: {b}")
            if a == b:
                errors.append(f"Self-loop detected: {a}")

        return {
            "is_valid": len(errors) == 0,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "errors": errors,
        }


def _row_label(index: int) -> str:
    """Convert row index to letter label: 0→A, 1→B, ..., 25→Z, 26→AA, ..."""
    result = ""
    i = index
    while True:
        result = string.ascii_uppercase[i % 26] + result
        i = i // 26 - 1
        if i < 0:
            break
    return result
