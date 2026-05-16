from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class TransactionKind(StrEnum):
    ACCRUAL = "accrual"
    REDEEM = "redeem"


class StaffRole(StrEnum):
    CASHIER = "cashier"
    MANAGER = "manager"


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("restaurant_id", "phone", name="uq_customer_phone_tenant"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    tier: Mapped[str] = mapped_column(String(80), default="Maisonero")
    stamps: Mapped[int] = mapped_column(Integer, default=0)
    lifetime_stamps: Mapped[int] = mapped_column(Integer, default=0)
    redemptions: Mapped[int] = mapped_column(Integer, default=0)
    threshold: Mapped[int] = mapped_column(Integer, default=10)
    # stamps_required values of the reward tiers already claimed in the current card cycle.
    redeemed_tiers: Mapped[list[int]] = mapped_column(JSON, default=list)
    member_since: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="customer")


class StaffUser(Base):
    __tablename__ = "staff_users"
    __table_args__ = (UniqueConstraint("restaurant_id", "email", name="uq_staff_email_tenant"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(80), index=True)
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(32), default=StaffRole.CASHIER.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="staff_user")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    staff_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("staff_users.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(32))
    stamps_delta: Mapped[int] = mapped_column(Integer)
    qr_jti: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    customer: Mapped[Customer] = relationship(back_populates="transactions")
    staff_user: Mapped[Optional[StaffUser]] = relationship(back_populates="transactions")


class RevokedJti(Base):
    __tablename__ = "revoked_jtis"

    jti: Mapped[str] = mapped_column(String(80), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class PendingOtp(Base):
    __tablename__ = "pending_otps"

    phone: Mapped[str] = mapped_column(String(40), primary_key=True)
    code: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RestaurantConfig(Base):
    __tablename__ = "restaurant_configs"

    restaurant_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    threshold: Mapped[int] = mapped_column(Integer, default=10)
    reward_name: Mapped[str] = mapped_column(String(200), default="Papas fritas gratis")
    tier_name: Mapped[str] = mapped_column(String(80), default="Maisonero")
    # The customizable word for the per-card progression system. "Nivel" by default,
    # but the admin can rename it ("Rango", "Categoría", etc.).
    level_label: Mapped[str] = mapped_column(String(40), default="Nivel")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CardLevel(Base):
    """A membership tier reached once a customer's lifetime_stamps crosses
    `stamps_required`. Levels never demote (lifetime_stamps only grows)."""

    __tablename__ = "card_levels"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(80))
    stamps_required: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RewardTier(Base):
    """A milestone on the loyalty card: at `stamps_required` stamps the customer
    unlocks `reward_name`. The tier with the highest `stamps_required` is the card
    size — redeeming it resets the customer's stamps to 0."""

    __tablename__ = "reward_tiers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(80), index=True)
    stamps_required: Mapped[int] = mapped_column(Integer)
    reward_name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
