"""add pending_otps table

Revision ID: 0002_pending_otps
Revises: 0001_initial
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_pending_otps"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_otps",
        sa.Column("phone", sa.String(40), primary_key=True),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pending_otps")
