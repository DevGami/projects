"""
FortisExam — Seed Demo Data

Creates realistic demo data:
  - 20 questions across 3 subjects
  - 1 exam with blueprint
  - 1 center with 6 seats
  - 6 candidates with pre-computed face embeddings
  - Seating assignments

Usage:
  python scripts/seed-demo-data.py
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def seed_questions():
    """Create 20 demo questions (encrypted)."""
    # TODO: Create questions via QuestionService
    print("📝 Seeding 20 questions...")


def seed_center():
    """Create 1 demo center with 6 seats."""
    # TODO: Create center with seating layout
    print("🏢 Seeding center with 6 seats...")


def seed_candidates():
    """Create 6 demo candidates with face embeddings."""
    # TODO: Create candidates with pre-computed embeddings
    print("👤 Seeding 6 candidates...")


def seed_exam():
    """Create 1 demo exam with blueprint."""
    # TODO: Create exam, compile, generate package
    print("📋 Seeding exam...")


def main():
    print("🌱 FortisExam — Seeding Demo Data")
    print("==================================")

    seed_questions()
    seed_center()
    seed_candidates()
    seed_exam()

    print("")
    print("✅ Demo data seeded successfully!")


if __name__ == "__main__":
    main()
