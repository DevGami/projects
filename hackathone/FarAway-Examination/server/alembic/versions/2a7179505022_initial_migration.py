"""Initial migration

Revision ID: 2a7179505022
Revises: 
Create Date: 2026-06-11 00:05:48.459075

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a7179505022'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('clerk_user_id', sa.String(length=255), unique=True, nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    )

    # Questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('difficulty', sa.String(length=20), nullable=False),
        sa.Column('encrypted_content', sa.Text(), nullable=False),
        sa.Column('encryption_iv', sa.String(length=64), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('questions')
    op.drop_table('users')
