"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("tier", sa.String(length=80), nullable=False),
        sa.Column("stamps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lifetime_stamps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("redemptions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("threshold", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("member_since", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("restaurant_id", "phone", name="uq_customer_phone_tenant"),
    )
    op.create_index("ix_customers_restaurant_id", "customers", ["restaurant_id"], unique=False)

    op.create_table(
        "staff_users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=80), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("restaurant_id", "email", name="uq_staff_email_tenant"),
    )
    op.create_index("ix_staff_users_restaurant_id", "staff_users", ["restaurant_id"], unique=False)

    op.create_table(
        "revoked_jtis",
        sa.Column("jti", sa.String(length=80), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_revoked_jtis_expires_at", "revoked_jtis", ["expires_at"], unique=False)

    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("customer_id", sa.String(length=64), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("staff_user_id", sa.String(length=64), sa.ForeignKey("staff_users.id"), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("stamps_delta", sa.Integer(), nullable=False),
        sa.Column("qr_jti", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("qr_jti"),
    )
    op.create_index("ix_transactions_customer_id", "transactions", ["customer_id"], unique=False)
    op.create_index("ix_transactions_staff_user_id", "transactions", ["staff_user_id"], unique=False)
    op.create_index("ix_transactions_qr_jti", "transactions", ["qr_jti"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_transactions_qr_jti", table_name="transactions")
    op.drop_index("ix_transactions_staff_user_id", table_name="transactions")
    op.drop_index("ix_transactions_customer_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("ix_revoked_jtis_expires_at", table_name="revoked_jtis")
    op.drop_table("revoked_jtis")
    op.drop_index("ix_staff_users_restaurant_id", table_name="staff_users")
    op.drop_table("staff_users")
    op.drop_index("ix_customers_restaurant_id", table_name="customers")
    op.drop_table("customers")
