"""
FortisExam Server — Configuration

Environment-driven configuration using Pydantic BaseSettings.
SERVER_MODE determines which database and routes are loaded.
"""

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Server Mode ---
    server_mode: Literal["cloud", "edge"] = "cloud"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://fortis:password@localhost:5432/fortisexam"

    # --- Clerk (cloud mode only) ---
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""

    # --- RSA Keys ---
    rsa_private_key_path: str = "./keys/private.pem"
    rsa_public_key_path: str = "./keys/public.pem"

    # --- Face Verification (edge mode only) ---
    face_similarity_threshold: float = 0.6

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"]

    # --- General ---
    debug: bool = False
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
