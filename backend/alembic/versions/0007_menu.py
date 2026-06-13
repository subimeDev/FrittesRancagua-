"""carta (menu_categories + menu_items)

Revision ID: 0007_menu
Revises: 0006_proximity
Create Date: 2026-06-12

Carta QR de Frittes: categorías + platos. La carta se reemplaza completa en
cada guardado del editor (bulk-replace), así que no hay updates parciales.
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_menu"
down_revision = "0006_proximity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "menu_categories",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_menu_categories_restaurant_id", "menu_categories", ["restaurant_id"])
    op.create_table(
        "menu_items",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("category_id", sa.String(length=64), sa.ForeignKey("menu_categories.id"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("badge", sa.String(length=40), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_menu_items_restaurant_id", "menu_items", ["restaurant_id"])
    op.create_index("ix_menu_items_category_id", "menu_items", ["category_id"])


def downgrade() -> None:
    op.drop_table("menu_items")
    op.drop_table("menu_categories")
