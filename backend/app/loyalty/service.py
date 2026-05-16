from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.loyalty.exceptions import (
    CustomerNotFoundError,
    InsufficientStampsError,
    QrTokenAlreadyUsedError,
    RewardTierNotFoundError,
)
from app.models import (
    CardLevel,
    Customer,
    PendingOtp,
    RestaurantConfig,
    RewardTier,
    StaffUser,
    Transaction,
    TransactionKind,
)
from app.schemas import CardLevelView, CustomerResponse, StaffPublic
from app.security import (
    create_token,
    decode_token,
    is_jti_revoked,
    revoke_jti,
    verify_password,
)

def _now() -> datetime:
    return datetime.now(timezone.utc)


def customer_to_response(
    customer: Customer,
    *,
    level_label: str = "Nivel",
    current_level: CardLevelView | None = None,
    next_level: CardLevelView | None = None,
) -> CustomerResponse:
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
        level_label=level_label,
        current_level=current_level,
        next_level=next_level,
    )


async def build_customer_response(
    db: AsyncSession, customer: Customer, restaurant_id: str
) -> CustomerResponse:
    """Customer DTO including the level state derived from lifetime_stamps."""
    level_label, current, nxt = await customer_level_state(db, customer, restaurant_id)
    return customer_to_response(
        customer, level_label=level_label, current_level=current, next_level=nxt
    )


async def resolve_card_levels(db: AsyncSession, restaurant_id: str) -> list[CardLevel]:
    rows = (
        await db.execute(
            select(CardLevel)
            .where(CardLevel.restaurant_id == restaurant_id)
            .order_by(CardLevel.stamps_required)
        )
    ).scalars().all()
    return list(rows)


async def levels_payload(db: AsyncSession, restaurant_id: str) -> list[dict[str, object]]:
    rows = await resolve_card_levels(db, restaurant_id)
    return [
        {"number": i + 1, "name": r.name, "stamps_required": r.stamps_required}
        for i, r in enumerate(rows)
    ]


async def customer_level_state(
    db: AsyncSession, customer: Customer, restaurant_id: str
) -> tuple[str, CardLevelView | None, CardLevelView | None]:
    """Return (level_label, current_level, next_level) for a customer based on
    lifetime_stamps. Current is the highest level whose threshold is reached;
    next is the immediately higher one (None if already maxed)."""
    rows = await resolve_card_levels(db, restaurant_id)
    config = await db.get(RestaurantConfig, restaurant_id)
    level_label = config.level_label if config else "Nivel"
    if not rows:
        return level_label, None, None
    current_idx: int | None = None
    for i, lvl in enumerate(rows):
        if customer.lifetime_stamps >= lvl.stamps_required:
            current_idx = i
    current = (
        CardLevelView(
            number=current_idx + 1,
            name=rows[current_idx].name,
            stamps_required=rows[current_idx].stamps_required,
        )
        if current_idx is not None
        else None
    )
    next_idx = (current_idx + 1) if current_idx is not None else 0
    nxt = (
        CardLevelView(
            number=next_idx + 1,
            name=rows[next_idx].name,
            stamps_required=rows[next_idx].stamps_required,
        )
        if next_idx < len(rows)
        else None
    )
    return level_label, current, nxt


def staff_to_public(staff: StaffUser) -> StaffPublic:
    return StaffPublic(id=staff.id, email=staff.email, name=staff.name, role=staff.role)  # type: ignore[arg-type]


async def resolve_tiers(db: AsyncSession, restaurant_id: str) -> list[tuple[int, str]]:
    """Reward milestones for a restaurant, sorted ascending by stamps_required.

    Falls back to a single tier derived from RestaurantConfig (or a sane default)
    when no explicit tiers have been configured yet."""
    rows = (
        await db.execute(
            select(RewardTier)
            .where(RewardTier.restaurant_id == restaurant_id)
            .order_by(RewardTier.stamps_required)
        )
    ).scalars().all()
    if rows:
        return [(r.stamps_required, r.reward_name) for r in rows]
    config = await db.get(RestaurantConfig, restaurant_id)
    if config:
        return [(config.threshold, config.reward_name)]
    return [(10, "Papas fritas gratis")]


async def tiers_payload(db: AsyncSession, restaurant_id: str) -> list[dict[str, object]]:
    tiers = await resolve_tiers(db, restaurant_id)
    return [{"stamps_required": stamps, "reward_name": name} for stamps, name in tiers]


async def apply_redemption(
    db: AsyncSession,
    *,
    customer: Customer,
    staff_user_id: str | None,
    restaurant_id: str,
    tier_stamps: int | None,
    qr_jti: str,
) -> str:
    """Redeem one reward milestone for `customer` and record the transaction.

    Redeeming a tier deducts its `stamps_required` from the customer's balance.
    When `tier_stamps` is omitted, the highest tier the customer can currently
    afford is redeemed. Returns the redeemed reward's name."""
    tiers = await resolve_tiers(db, restaurant_id)
    if not tiers:
        raise InsufficientStampsError("not enough stamps")

    if tier_stamps is None:
        affordable = [(req, name) for req, name in tiers if customer.stamps >= req]
        if not affordable:
            raise InsufficientStampsError("not enough stamps")
        target_req, target_name = affordable[-1]
    else:
        match = next(((req, name) for req, name in tiers if req == tier_stamps), None)
        if match is None:
            raise RewardTierNotFoundError("reward tier not found")
        target_req, target_name = match
        if customer.stamps < target_req:
            raise InsufficientStampsError("not enough stamps")

    customer.stamps -= target_req
    customer.redemptions += 1

    db.add(
        Transaction(
            id=str(uuid4()),
            customer_id=customer.id,
            staff_user_id=staff_user_id,
            kind=TransactionKind.REDEEM.value,
            stamps_delta=-target_req,
            qr_jti=qr_jti,
        )
    )
    return target_name


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


def _generate_otp() -> str:
    import random
    return str(random.randint(100000, 999999))


async def _send_otp_email(email: str, code: str) -> None:
    import logging
    logger = logging.getLogger(__name__)
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — OTP code for %s: %s", email, code)
        return
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.resend_api_key
        resend_sdk.Emails.send({
            "from": settings.resend_from_email,
            "to": [email],
            "subject": "Tu código de verificación Frittes",
            "html": (
                f"<div style='font-family:sans-serif;max-width:400px;margin:auto;padding:32px'>"
                f"<h2 style='margin-bottom:8px'>Frittes Maison</h2>"
                f"<p style='color:#555'>Tu código de verificación es:</p>"
                f"<div style='font-size:40px;font-weight:bold;letter-spacing:8px;margin:24px 0'>{code}</div>"
                f"<p style='color:#999;font-size:13px'>Válido por 5 minutos. No compartas este código.</p>"
                f"</div>"
            ),
        })
    except Exception as exc:
        # Email delivery is best-effort: the OTP is already persisted in DB.
        # Don't 500 the request if Resend is in sandbox mode, rate-limited, or down.
        logger.warning("OTP email delivery failed for %s (code=%s): %s", email, code, exc)


async def send_redemption_email(customer_name: str, customer_email: str, reward_name: str) -> None:
    import logging
    logger = logging.getLogger(__name__)
    settings = get_settings()
    if not settings.resend_api_key:
        logger.info("RESEND not set — skip redemption email for %s", customer_email)
        return
    if "@" not in customer_email:
        return
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.resend_api_key
        first_name = customer_name.split()[0] if customer_name else customer_name
        resend_sdk.Emails.send({
            "from": settings.resend_from_email,
            "to": [customer_email],
            "subject": f"¡Canjeaste tu premio en Frittes Maison! 🎁",
            "html": (
                f"<div style='font-family:sans-serif;max-width:460px;margin:auto;padding:32px;background:#F5F1E8;border-radius:16px'>"
                f"<div style='text-align:center;margin-bottom:24px'>"
                f"<h1 style='font-size:28px;font-weight:900;color:#1A1815;margin:0'>FRITTES</h1>"
                f"<p style='font-style:italic;color:#6B6660;margin:0'>maison</p>"
                f"</div>"
                f"<div style='background:#FFD23F;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px'>"
                f"<p style='font-size:40px;margin:0'>🎁</p>"
                f"<h2 style='color:#1A1815;margin:8px 0 4px'>¡Premio canjeado!</h2>"
                f"<p style='color:#1A1815;font-weight:600;font-size:18px;margin:0'>{reward_name}</p>"
                f"</div>"
                f"<p style='color:#1A1815'>Hola <strong>{first_name}</strong>, acabas de canjear tu premio en Frittes Maison.</p>"
                f"<p style='color:#6B6660;font-size:14px'>Preséntate en caja con este correo si el cajero lo solicita. ¡Que lo disfrutes!</p>"
                f"<hr style='border:none;border-top:1px solid #E2DCCC;margin:24px 0'>"
                f"<p style='color:#6B6660;font-size:12px;text-align:center'>Club Frittes · Rancagua · "
                f"<a href='https://frittesrancagua-production.up.railway.app' style='color:#E8B82E'>Mi pase</a></p>"
                f"</div>"
            ),
        })
    except Exception as exc:
        logger.warning("Redemption email failed for %s: %s", customer_email, exc)


async def send_password_reset_email(staff_email: str, staff_name: str, reset_url: str) -> None:
    import logging
    logger = logging.getLogger(__name__)
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND not set — reset link for %s: %s", staff_email, reset_url)
        return
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.resend_api_key
        first_name = staff_name.split()[0] if staff_name else "Staff"
        resend_sdk.Emails.send({
            "from": settings.resend_from_email,
            "to": [staff_email],
            "subject": "Restablece tu contraseña — Frittes POS",
            "html": (
                f"<div style='font-family:sans-serif;max-width:460px;margin:auto;padding:32px;background:#F5F1E8;border-radius:16px'>"
                f"<h1 style='font-size:22px;font-weight:900;color:#1A1815'>FRITTES <span style='font-style:italic;font-weight:400;color:#6B6660'>maison</span></h1>"
                f"<h2 style='color:#1A1815'>Restablecer contraseña</h2>"
                f"<p style='color:#1A1815'>Hola <strong>{first_name}</strong>, recibimos una solicitud para restablecer tu contraseña del sistema POS.</p>"
                f"<div style='text-align:center;margin:32px 0'>"
                f"<a href='{reset_url}' style='background:#1A1815;color:#FFD23F;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block'>"
                f"Restablecer contraseña</a>"
                f"</div>"
                f"<p style='color:#6B6660;font-size:13px'>Este enlace expira en <strong>30 minutos</strong>. Si no solicitaste esto, ignora este correo.</p>"
                f"<p style='color:#6B6660;font-size:12px'>O copia este enlace: <br><a href='{reset_url}' style='color:#E8B82E;word-break:break-all'>{reset_url}</a></p>"
                f"</div>"
            ),
        })
    except Exception as exc:
        logger.warning("Password reset email failed for %s: %s", staff_email, exc)


async def request_otp(db: AsyncSession, phone: str) -> None:
    expires = _now() + timedelta(minutes=5)
    code = _generate_otp()
    async with db.begin():
        existing = await db.get(PendingOtp, phone)
        if existing:
            existing.code = code
            existing.expires_at = expires
        else:
            db.add(PendingOtp(phone=phone, code=code, expires_at=expires))
    await _send_otp_email(phone, code)


async def verify_otp(db: AsyncSession, phone: str, code: str) -> bool:
    async with db.begin():
        row = await db.get(PendingOtp, phone)
        if not row:
            return False
        if _now() > row.expires_at:
            await db.delete(row)
            return False
        if row.code != code:
            return False
        await db.delete(row)
        return True


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
    tier_stamps: int | None = None,
) -> tuple[Customer, str, str]:
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

    reward_name = await apply_redemption(
        db,
        customer=customer,
        staff_user_id=staff_user.id,
        restaurant_id=restaurant_id,
        tier_stamps=tier_stamps,
        qr_jti=jti,
    )
    await revoke_jti(db, jti=jti, expires_at=exp)
    await db.flush()
    return customer, TransactionKind.REDEEM.value, reward_name
