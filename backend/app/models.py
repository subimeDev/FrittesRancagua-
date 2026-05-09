from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
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
