"""reward_tiers table + customers.redeemed_tiers

Revision ID: 0004_reward_tiers
Revises: 0003_restaurant_config
Create Date: 2026-05-14
"""

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0004_reward_tiers"
down_revision = "0003_restaurant_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reward_tiers",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("stamps_required", sa.Integer(), nullable=False),
        sa.Column("reward_name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reward_tiers_restaurant_id", "reward_tiers", ["restaurant_id"])

    op.add_column(
        "customers",
        sa.Column("redeemed_tiers", sa.JSON(), nullable=False, server_default="[]"),
    )

    # Seed one tier per existing restaurant config so current installs keep working.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT restaurant_id, threshold, reward_name FROM restaurant_configs")
    ).fetchall()
    now = datetime.now(timezone.utc)
    for restaurant_id, threshold, reward_name in rows:
        conn.execute(
            sa.text(
                "INSERT INTO reward_tiers (id, restaurant_id, stamps_required, reward_name, created_at) "
                "VALUES (:id, :rid, :st, :rn, :ts)"
            ),
            {
                "id": f"tier_{uuid4().hex[:12]}",
                "rid": restaurant_id,
                "st": threshold,
                "rn": reward_name,
                "ts": now,
            },
        )


def downgrade() -> None:
    op.drop_column("customers", "redeemed_tiers")
    op.drop_index("ix_reward_tiers_restaurant_id", table_name="reward_tiers")
    op.drop_table("reward_tiers")
