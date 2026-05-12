"""restaurant_configs table

Revision ID: 0003_restaurant_config
Revises: 0002_pending_otps
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_restaurant_config"
down_revision = "0002_pending_otps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "restaurant_configs",
        sa.Column("restaurant_id", sa.String(length=80), primary_key=True),
        sa.Column("threshold", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("reward_name", sa.String(length=200), nullable=False, server_default="Papas fritas gratis"),
        sa.Column("tier_name", sa.String(length=80), nullable=False, server_default="Maisonero"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("restaurant_configs")
