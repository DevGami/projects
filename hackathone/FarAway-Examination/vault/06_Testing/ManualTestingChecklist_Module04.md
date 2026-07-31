# Module 04 — Manual Testing Checklist

Follow these steps to manually verify the Graph Randomization subsystem using the Python REPL.

## Prerequisites

1. Activate your virtual environment
2. Start the Python REPL from the project root (`d:\DelhiHackathon`):
   ```bash
   $env:PYTHONPATH="d:\DelhiHackathon"
   python
   ```

## Imports

Run these imports first:
```python
import json
from shared.graph import GraphBuilder, GraphColoring, VariantGenerator
from shared.audit.event_logger import EventLogger
```

---

## 1. Graph Construction (Grid)

**Action:** Build a 3x3 grid graph and validate it.
```python
graph = GraphBuilder.from_grid(3, 3)
val = GraphBuilder.validate(graph)
print(f"Valid: {val['is_valid']}, Nodes: {val['node_count']}, Edges: {val['edge_count']}")
```

**Expected Output:**
- `Valid: True`
- `Nodes: 9`
- `Edges: 20` (in a 3x3 king's graph, 4 corners have 3, 4 edges have 5, 1 center has 8: `(4*3 + 4*5 + 1*8) / 2 = 20`)

---

## 2. Graph Construction (Coordinates)

**Action:** Build a radius-based graph.
```python
seats = [
    {"id": "S1", "x": 0.0, "y": 0.0},
    {"id": "S2", "x": 1.0, "y": 0.0},
    {"id": "S3", "x": 0.0, "y": 2.0}
]
graph_coord = GraphBuilder.from_coordinates(seats, radius=1.5)
print(f"Edges: {graph_coord['edges']}")
```

**Expected Output:**
- `Edges: [('S1', 'S2')]` (S3 is distance 2.0 from S1, distance ~2.23 from S2, so no edges to S3)

---

## 3. Graph Coloring

**Action:** Color the 3x3 grid graph and validate.
```python
coloring = GraphColoring.color(graph["nodes"], graph["edges"])
num_colors = max(coloring.values()) + 1
val_color = GraphColoring.validate_coloring(graph["edges"], coloring)
print(f"Valid: {val_color['is_valid']}, Colors used: {num_colors}")
```

**Expected Output:**
- `Valid: True`
- `Colors used: 4` (A king's graph requires exactly 4 colors)

---

## 4. Variant Generation

**Action:** Generate exam variants deterministically.
```python
questions = [
    {"id": "q1", "options": ["A", "B", "C", "D"], "correct_option": 0},
    {"id": "q2", "options": ["True", "False"], "correct_option": 1}
]
variants = VariantGenerator.generate_variants(questions, num_variants=num_colors, seed=42)
val_vars = VariantGenerator.validate_variants(variants, questions)
print(f"Valid: {val_vars['is_valid']}, Variants: {val_vars['variant_count']}")
```

**Expected Output:**
- `Valid: True`
- `Variants: 4`

**Action:** Check that the correct option was remapped correctly in the first variant.
```python
v0_q1 = variants[0]["questions"][0]
print(f"Options: {v0_q1['options']}, Correct Idx: {v0_q1['correct_option']}, Correct Answer: {v0_q1['options'][v0_q1['correct_option']]}")
```

**Expected Output:**
- `Correct Answer: A` (or `False` if Q2 is first, but the value should match the original correct answer regardless of index)

---

## 5. Seat Assignment

**Action:** Map the variants back to the original seats.
```python
assignment = VariantGenerator.assign_variants(coloring, variants)
print(f"Seat A1 gets Variant ID: {assignment['A1']['variant_id']}")
print(f"Seat A2 gets Variant ID: {assignment['A2']['variant_id']}")
```

**Expected Output:**
- The two variant IDs printed MUST be different (since A1 and A2 are adjacent in the grid).

---

## 6. Audit Logging Integration

**Action:** Verify the event logger creates deterministic hashes for graph events.
```python
logger = EventLogger()
ev = logger.create_event(EventLogger.GRAPH_COLORED, "system", {"nodes": 9, "colors": num_colors})
print(json.dumps(ev, indent=2))
```

**Expected Output:**
- JSON output containing `event_type: "GRAPH_COLORED"`
- `actor_id: "system"`
- A valid ISO-8601 `timestamp`
- A 64-character SHA-256 `payload_hash`
