from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.loyalty.exceptions import CustomerNotFoundError, InsufficientStampsError, QrTokenAlreadyUsedError
from app.models import Customer, StaffUser, Transaction, TransactionKind
from app.schemas import CustomerResponse, StaffPublic
from app.security import (
    create_token,
    decode_token,
    is_jti_revoked,
    revoke_jti,
    verify_password,
)

_otp_store: dict[str, tuple[str, datetime]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def customer_to_response(customer: Customer) -> CustomerResponse:
    return CustomerResponse(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        stamps=customer.stamps,
        threshold=customer.threshold,
        lifetime_stamps=customer.lifetime_stamps,
        redemptions=customer.redemptions,
        tier=customer.tier,
        member_since=customer.member_since,
    )


def staff_to_public(staff: StaffUser) -> StaffPublic:
    return StaffPublic(id=staff.id, email=staff.email, name=staff.name, role=staff.role)  # type: ignore[arg-type]


def create_customer_session(customer: Customer) -> tuple[str, datetime]:
    settings = get_settings()
    return create_token(
        subject=customer.id,
        scope="session",
        audience=settings.restaurant_id,
        ttl_seconds=settings.session_ttl_minutes * 60,
    )


def create_staff_session(staff: StaffUser) -> tuple[str, datetime]:
    settings = get_settings()
    return create_token(
        subject=staff.id,
        scope="staff",
        audience=settings.restaurant_id,
        ttl_seconds=settings.staff_session_ttl_minutes * 60,
    )


def create_qr_token(customer: Customer) -> tuple[str, datetime]:
    settings = get_settings()
    return create_token(
        subject=customer.id,
        scope="qr",
        audience=settings.restaurant_id,
        ttl_seconds=settings.qr_ttl_seconds,
    )


async def register_or_login_customer(
    db: AsyncSession,
    *,
    restaurant_id: str,
    name: str,
    phone: str,
    email: str | None,
) -> Customer:
    stmt = select(Customer).where(Customer.restaurant_id == restaurant_id, Customer.phone == phone)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if customer:
        if name and customer.name != name:
            customer.name = name
        if email is not None:
            customer.email = email
        return customer
    customer = Customer(
        id=f"frt_{uuid4().hex[:12]}",
        restaurant_id=restaurant_id,
        name=name,
        phone=phone,
        email=email,
        tier="Maisonero",
        threshold=10,
    )
    db.add(customer)
    await db.flush()
    return customer


async def complete_profile_for_phone(
    db: AsyncSession,
    *,
    restaurant_id: str,
    phone: str,
    name: str,
    email: str | None,
) -> Customer:
    stmt = select(Customer).where(Customer.restaurant_id == restaurant_id, Customer.phone == phone)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if customer is None:
        customer = Customer(
            id=f"frt_{uuid4().hex[:12]}",
            restaurant_id=restaurant_id,
            name=name,
            phone=phone,
            email=email,
            tier="Maisonero",
            threshold=10,
        )
        db.add(customer)
    else:
        customer.name = name
        customer.email = email
    await db.flush()
    return customer


async def request_otp(phone: str) -> None:
    expires = _now() + timedelta(minutes=5)
    _otp_store[phone] = ("123456", expires)


async def verify_otp(phone: str, code: str) -> bool:
    if phone not in _otp_store:
        return False
    otp_code, expires = _otp_store[phone]
    if _now() > expires:
        _otp_store.pop(phone, None)
        return False
    return code == otp_code


async def staff_login(
    db: AsyncSession,
    *,
    restaurant_id: str,
    email: str,
    password: str,
) -> StaffUser | None:
    stmt = select(StaffUser).where(
        StaffUser.restaurant_id == restaurant_id, StaffUser.email == email, StaffUser.is_active.is_(True)
    )
    staff = (await db.execute(stmt)).scalar_one_or_none()
    if not staff:
        return None
    if not verify_password(password, staff.password_hash):
        return None
    return staff


async def accrue_transaction(
    db: AsyncSession,
    *,
    staff_user: StaffUser,
    claims: dict[str, Any],
    restaurant_id: str,
) -> tuple[Customer, str]:
    """Apply one stamp accrual. `claims` must already be JWT-validated by the caller."""
    jti = str(claims["jti"])
    exp = datetime.fromtimestamp(int(claims["exp"]), tz=timezone.utc)
    customer_id = str(claims["sub"])

    if await is_jti_revoked(db, jti):
        raise QrTokenAlreadyUsedError("token already used")

    stmt = select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise CustomerNotFoundError("customer not found")

    customer.stamps += 1
    customer.lifetime_stamps += 1
    tx = Transaction(
        id=str(uuid4()),
        customer_id=customer.id,
        staff_user_id=staff_user.id,
        kind=TransactionKind.ACCRUAL.value,
        stamps_delta=1,
        qr_jti=jti,
    )
    db.add(tx)
    await revoke_jti(db, jti=jti, expires_at=exp)
    await db.flush()
    return customer, tx.kind


async def redeem_transaction(
    db: AsyncSession,
    *,
    staff_user: StaffUser,
    claims: dict[str, Any],
    restaurant_id: str,
) -> tuple[Customer, str]:
    """Apply one reward redemption. `claims` must already be JWT-validated by the caller."""
    jti = str(claims["jti"])
    exp = datetime.fromtimestamp(int(claims["exp"]), tz=timezone.utc)
    customer_id = str(claims["sub"])

    if await is_jti_revoked(db, jti):
        raise QrTokenAlreadyUsedError("token already used")

    stmt = select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    customer = (await db.execute(stmt)).scalar_one_or_none()
    if not customer:
        raise CustomerNotFoundError("customer not found")

    if customer.stamps < customer.threshold:
        raise InsufficientStampsError("not enough stamps")

    customer.stamps -= customer.threshold
    customer.redemptions += 1
    tx = Transaction(
        id=str(uuid4()),
        customer_id=customer.id,
        staff_user_id=staff_user.id,
        kind=TransactionKind.REDEEM.value,
        stamps_delta=-(customer.threshold),
        qr_jti=jti,
    )
    db.add(tx)
    await revoke_jti(db, jti=jti, expires_at=exp)
    await db.flush()
    return customer, tx.kind
