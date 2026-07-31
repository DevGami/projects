# Module 04 — Spatial Graph Randomization

> **Last Updated:** 2026-06-08
> **Status:** 🟢 Complete

---

## Purpose

Prevent candidate-to-candidate copying by ensuring adjacent seats receive mathematically distinct exam variants. Uses graph coloring on the seating adjacency graph.

---

## Components

| Component | Responsibility |
|---|---|
| Layout Engine | Accept seating layout (rows × columns), generate seat positions |
| Graph Builder | Build adjacency graph from seat positions (including diagonals) |
| Graph Coloring | Apply graph coloring to assign variant IDs to seats |
| Variant Generator | Generate unique question/option ordering per variant |

---

## Algorithm

### Step 1: Build Adjacency Graph
```
Input: Seating layout (rows × columns)
    ↓
For each seat, connect to all adjacent seats:
    - Left, Right (horizontal neighbors)
    - Front, Back (vertical neighbors)
    - Diagonal neighbors (4 directions)
    ↓
Output: Graph G(V, E) where V = seats, E = adjacency
```

### Step 2: Graph Coloring
```
Input: Adjacency graph G
    ↓
Apply greedy graph coloring (NetworkX)
    ↓
Output: color_map { seat_id → variant_id }
    ↓
Guarantee: no two adjacent seats share the same variant_id
```

### Step 3: Generate Variants
```
For each unique variant_id:
    ↓
Derive variant_seed = SHA-256(base_seed : "variant" : variant_id)[:8] (collision-resistant)
    ↓
Shuffle question order using variant_seed
    ↓
For each question at position q_pos:
  Derive option_seed = SHA-256(base_seed : "options" : variant_id : q_pos)[:8]
  Shuffle option order using option_seed
  Remap correct_option index through inverse permutation
    ↓
Output: variant_map { variant_id → { question_order, option_orders } }
```

---

## Example (3×3 Grid)

```
Seat Layout:
  [A1] [A2] [A3]
  [B1] [B2] [B3]
  [C1] [C2] [C3]

Adjacency (A1): A2, B1, B2
Adjacency (B2): A1, A2, A3, B1, B3, C1, C2, C3  (center seat has 8 neighbors)

Graph coloring result (4 colors minimum for king's graph):
  [V1] [V2] [V3]
  [V3] [V4] [V1]
  [V1] [V2] [V3]

No adjacent seats (including diagonals) share a variant.
```

---

## Data Model

```json
{
  "examId": "uuid",
  "centerId": "uuid",
  "layout": { "rows": "int", "columns": "int" },
  "seatAssignments": [
    { "seatId": "A1", "candidateId": "uuid", "variantId": "int" }
  ],
  "variants": {
    "1": { "questionOrder": [3,1,5,2,4], "optionOrders": { "q1": [2,0,3,1], "q2": [1,3,0,2] } },
    "2": { "questionOrder": [5,3,2,4,1], "optionOrders": { "q1": [0,3,1,2], "q2": [3,1,2,0] } }
  }
}
```

---

## Dependencies

- NetworkX — graph construction and coloring
- Module 02 — provides question set for variant generation
- Compilation Service — triggers variant generation during exam compilation

---

## Testing Requirements

- Unit: Adjacency graph correctly connects all neighbors (including diagonals)
- Unit: Graph coloring produces valid coloring (no adjacent same color)
- Unit: Different variant IDs produce different question orders
- Unit: Different variant IDs produce different option orders
- Integration: End-to-end layout → graph → coloring → variant → rendering
- Property: For any two adjacent seats, question at position N differs

---

## Related Documents

- [[Module02_CryptoDelivery]] — Package compilation triggers randomization
- [[Module01_QuestionPool]] — Source of questions for variants
- [[Decisions]] — D-004: Graph coloring decision
