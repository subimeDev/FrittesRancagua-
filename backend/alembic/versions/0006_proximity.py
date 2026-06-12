"""ubicación + proximity_message en restaurant_configs

Revision ID: 0006_proximity
Revises: 0005_card_levels
Create Date: 2026-06-11

Geofence de Google Wallet: latitude/longitude del local + el mensaje de la
oferta de proximidad. Se configura desde el apartado oculto del admin. Nullable:
sin coordenadas el pase se emite sin geofence.
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_proximity"
down_revision = "0005_card_levels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("restaurant_configs", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("restaurant_configs", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column(
        "restaurant_configs",
        sa.Column("proximity_message", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("restaurant_configs", "proximity_message")
    op.drop_column("restaurant_configs", "longitude")
    op.drop_column("restaurant_configs", "latitude")
