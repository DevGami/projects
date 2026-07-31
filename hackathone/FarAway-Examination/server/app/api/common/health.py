"""
Common API — Health Check

Available in both cloud and edge modes.
Used for Docker health checks and demo troubleshooting.
"""

from fastapi import APIRouter

from server.app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "mode": settings.server_mode,
        "version": "0.1.0",
        # TODO: Add database connection check
    }
