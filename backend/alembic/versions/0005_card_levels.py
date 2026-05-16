"""card_levels table + restaurant_configs.level_label

Revision ID: 0005_card_levels
Revises: 0004_reward_tiers
Create Date: 2026-05-15
"""

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0005_card_levels"
down_revision = "0004_reward_tiers"
branch_labels = None
depends_on = None


# Seeded so that the moment an admin enables the feature, customers already see
# a working progression. Admin can edit/extend/rename via the POS Config tab.
DEFAULT_LEVELS = [
    ("Iniciado", 0),
    ("Habitual", 10),
    ("Frittero", 25),
    ("Maestro", 50),
]


def upgrade() -> None:
    op.create_table(
        "card_levels",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("stamps_required", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_card_levels_restaurant_id", "card_levels", ["restaurant_id"])

    op.add_column(
        "restaurant_configs",
        sa.Column("level_label", sa.String(length=40), nullable=False, server_default="Nivel"),
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT restaurant_id FROM restaurant_configs")).fetchall()
    now = datetime.now(timezone.utc)
    for (restaurant_id,) in rows:
        for name, stamps in DEFAULT_LEVELS:
            conn.execute(
                sa.text(
                    "INSERT INTO card_levels (id, restaurant_id, name, stamps_required, created_at) "
                    "VALUES (:id, :rid, :nm, :st, :ts)"
                ),
                {
                    "id": f"lvl_{uuid4().hex[:12]}",
                    "rid": restaurant_id,
                    "nm": name,
                    "st": stamps,
                    "ts": now,
                },
            )


def downgrade() -> None:
    op.drop_column("restaurant_configs", "level_label")
    op.drop_index("ix_card_levels_restaurant_id", table_name="card_levels")
    op.drop_table("card_levels")
