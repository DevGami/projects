"""
Generate RSA-2048 key pairs for FortisExam demo.

Writes to:
  keys/private.pem       — Server (cloud) RSA private key
  keys/public.pem        — Server (cloud) RSA public key
  keys/center_private.pem — Exam center RSA private key (simulated edge node)
  keys/center_public.pem  — Exam center RSA public key (used for key wrapping)

Run:
  python scripts/generate_keys.py

Safe to re-run: only generates keys that don't already exist.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.crypto.rsa import RSASigner

KEYS_DIR = Path(__file__).parent.parent / "keys"

KEY_PAIRS = [
    ("private.pem", "public.pem", "Server (cloud)"),
    ("center_private.pem", "center_public.pem", "Exam center (edge simulation)"),
]


def generate_if_missing(private_path: Path, public_path: Path, label: str) -> None:
    """Generate a key pair only if both files don't already exist."""
    if private_path.exists() and public_path.exists():
        print(f"  [{label}] Keys already exist — skipping.")
        return

    print(f"  [{label}] Generating RSA-2048 key pair...", end=" ", flush=True)
    private_pem, public_pem = RSASigner.generate_key_pair()
    private_path.write_bytes(private_pem)
    public_path.write_bytes(public_pem)
    print("done.")
    print(f"    -> {private_path}")
    print(f"    -> {public_path}")


def main() -> None:
    KEYS_DIR.mkdir(exist_ok=True)

    print("FortisExam — RSA Key Generation")
    print("=" * 40)
    for priv_name, pub_name, label in KEY_PAIRS:
        generate_if_missing(
            KEYS_DIR / priv_name,
            KEYS_DIR / pub_name,
            label,
        )
    print("=" * 40)
    print("Done. Keys stored in:", KEYS_DIR.resolve())


if __name__ == "__main__":
    main()
