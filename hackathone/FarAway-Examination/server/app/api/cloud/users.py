"""
Cloud API — User Management

Clerk-synced user profiles and role management.
All routes are Clerk-JWT protected.

Endpoints:
  GET  /users/me       — Current user profile
  POST /users/sync     — Sync/upsert a Clerk user into local DB (admin only)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.app.db.database import get_db
from server.app.middleware.clerk_auth import require_role, verify_clerk_jwt
from server.app.models.user import User
from server.app.schemas.auth import UserMeResponse, UserSyncRequest, UserSyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users")

VALID_ROLES = {"admin", "expert", "center_admin", "invigilator", "auditor"}


@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get Current User Profile",
    description="Returns the authenticated user's profile from Clerk claims and local DB.",
)
async def get_me(
    claims: dict = Depends(verify_clerk_jwt),
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    """
    Return the current user's profile.

    Combines Clerk JWT claims (email, sub) with the local DB role mapping.
    """
    clerk_user_id = claims.get("clerk_user_id", "")

    # Try to find the user in local DB (may not exist yet if not synced)
    stmt = select(User).where(User.clerk_user_id == clerk_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is not None:
        return UserMeResponse(
            clerk_user_id=user.clerk_user_id,
            name=user.name,
            role=user.role,
            email=claims.get("email", ""),
        )

    # User not in local DB — return from Clerk claims only
    return UserMeResponse(
        clerk_user_id=clerk_user_id,
        name=claims.get("email", clerk_user_id),
        role=claims.get("role", "expert"),
        email=claims.get("email", ""),
    )


@router.post(
    "/sync",
    response_model=UserSyncResponse,
    summary="Sync Clerk User to Local DB",
    description=(
        "Upsert a Clerk user record into the local users table. "
        "Called after role assignment in Clerk dashboard. Admin only."
    ),
    dependencies=[Depends(require_role("admin"))],
)
async def sync_user(
    request: UserSyncRequest,
    db: AsyncSession = Depends(get_db),
) -> UserSyncResponse:
    """
    Create or update a user's role mapping in the local DB.

    This is called:
    - After a new admin/expert is added via Clerk dashboard
    - When a user's role changes

    The clerk_user_id is the source of truth — if it already exists,
    the name and role are updated.
    """
    if request.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{request.role}'. Must be one of: {sorted(VALID_ROLES)}",
        )

    # Check if user already exists
    stmt = select(User).where(User.clerk_user_id == request.clerk_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is not None:
        # Update existing
        user.name = request.name
        user.role = request.role
        await db.flush()
        logger.info("User synced (updated): %s → role=%s", request.clerk_user_id, request.role)
        return UserSyncResponse(
            clerk_user_id=user.clerk_user_id,
            name=user.name,
            role=user.role,
            created=False,
        )

    # Create new
    new_user = User(
        clerk_user_id=request.clerk_user_id,
        name=request.name,
        role=request.role,
    )
    db.add(new_user)
    await db.flush()
    logger.info("User synced (created): %s → role=%s", request.clerk_user_id, request.role)
    return UserSyncResponse(
        clerk_user_id=new_user.clerk_user_id,
        name=new_user.name,
        role=new_user.role,
        created=True,
    )
