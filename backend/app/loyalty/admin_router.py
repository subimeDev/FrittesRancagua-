from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_current_staff, get_db, get_restaurant_id
from app.loyalty import service
from app.loyalty.exceptions import InsufficientStampsError, RewardTierNotFoundError
from app.models import (
    CardLevel,
    Customer,
    RestaurantConfig,
    RewardTier,
    StaffRole,
    StaffUser,
    Transaction,
    TransactionKind,
)
from app.security import hash_password

router = APIRouter(prefix="/loyalty/admin", tags=["admin"])


def require_manager(staff: StaffUser = Depends(get_current_staff)) -> StaffUser:
    if staff.role != StaffRole.MANAGER.value:
        raise api_error(403, "forbidden", "manager role required")
    return staff


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> dict[str, int]:
    total_customers = (await db.execute(
        select(func.count()).select_from(Customer)
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    total_stamps = (await db.execute(
        select(func.coalesce(func.sum(Customer.lifetime_stamps), 0))
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    total_redemptions = (await db.execute(
        select(func.coalesce(func.sum(Customer.redemptions), 0))
        .where(Customer.restaurant_id == restaurant_id)
    )).scalar_one()
    # A customer "has a coupon" once they can afford the cheapest reward tier.
    min_tier_stamps = (await service.resolve_tiers(db, restaurant_id))[0][0]
    customers_with_coupon = (await db.execute(
        select(func.count()).select_from(Customer)
        .where(Customer.restaurant_id == restaurant_id, Customer.stamps >= min_tier_stamps)
    )).scalar_one()
    return {
        "total_customers": total_customers,
        "total_stamps_given": total_stamps,
        "total_redemptions": total_redemptions,
        "customers_with_coupon": customers_with_coupon,
    }


# ---------------------------------------------------------------------------
# Top customers
# ---------------------------------------------------------------------------

@router.get("/top-customers")
async def top_customers(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
    limit: int = Query(default=20, ge=1, le=50),
) -> list[dict[str, object]]:
    min_tier_stamps = (await service.resolve_tiers(db, restaurant_id))[0][0]
    rows = (await db.execute(
        select(Customer)
        .where(Customer.restaurant_id == restaurant_id)
        .order_by(Customer.lifetime_stamps.desc())
        .limit(limit)
    )).scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "stamps": c.stamps,
            "threshold": c.threshold,
            "lifetime_stamps": c.lifetime_stamps,
            "redemptions": c.redemptions,
            "has_coupon": c.stamps >= min_tier_stamps,
            "member_since": c.member_since.isoformat(),
            "rank": i + 1,
        }
        for i, c in enumerate(rows)
    ]


# ---------------------------------------------------------------------------
# Customers list
# ---------------------------------------------------------------------------

@router.get("/customers")
async def list_customers(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    with_coupon: bool = Query(default=False),
    search: str | None = Query(default=None),
) -> dict[str, object]:
    min_tier_stamps = (await service.resolve_tiers(db, restaurant_id))[0][0]
    base_filter = [Customer.restaurant_id == restaurant_id]
    if with_coupon:
        base_filter.append(Customer.stamps >= min_tier_stamps)
    if search:
        like = f"%{search.strip().lower()}%"
        base_filter.append(
            (func.lower(Customer.name).like(like)) | (func.lower(Customer.phone).like(like))
        )

    total = (await db.execute(
        select(func.count()).select_from(Customer).where(*base_filter)
    )).scalar_one()
    rows = (await db.execute(
        select(Customer)
        .where(*base_filter)
        .order_by(Customer.stamps.desc(), Customer.created_at.desc())
        .offset(offset).limit(limit)
    )).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "stamps": c.stamps,
                "threshold": c.threshold,
                "lifetime_stamps": c.lifetime_stamps,
                "redemptions": c.redemptions,
                "has_coupon": c.stamps >= min_tier_stamps,
                "member_since": c.member_since.isoformat(),
            }
            for c in rows
        ],
    }


# ---------------------------------------------------------------------------
# Customer actions (manager only)
# ---------------------------------------------------------------------------

class ManualRedeemRequest(BaseModel):
    # Which milestone to redeem (its stamps_required). Omit to redeem the highest
    # tier the customer currently qualifies for.
    tier_stamps: int | None = None


@router.post("/customers/{customer_id}/redeem")
async def manual_redeem(
    customer_id: str,
    background_tasks: BackgroundTasks,
    payload: ManualRedeemRequest | None = None,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    manager: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    )).scalar_one_or_none()
    if not customer:
        raise api_error(404, "not_found", "customer not found")

    tier_stamps = payload.tier_stamps if payload else None
    try:
        reward_name = await service.apply_redemption(
            db,
            customer=customer,
            staff_user_id=manager.id,
            restaurant_id=restaurant_id,
            tier_stamps=tier_stamps,
            qr_jti=f"admin_{uuid4().hex}",
        )
    except InsufficientStampsError:
        raise api_error(400, "insufficient_stamps", "El cliente no tiene suficientes sellos para este premio")
    except RewardTierNotFoundError:
        raise api_error(404, "tier_not_found", "Nivel de recompensa no encontrado")

    customer_name = customer.name
    customer_phone = customer.phone
    await db.commit()
    background_tasks.add_task(service.send_redemption_email, customer_name, customer_phone, reward_name)
    return {
        "new_balance": customer.stamps,
        "redemptions": customer.redemptions,
        "customer_name": customer_name,
        "reward_name": reward_name,
    }


class AdjustStampsRequest(BaseModel):
    delta: int


@router.post("/customers/{customer_id}/adjust-stamps")
async def adjust_stamps(
    customer_id: str,
    payload: AdjustStampsRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    manager: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    if payload.delta == 0:
        raise api_error(400, "invalid_input", "delta no puede ser cero")

    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    )).scalar_one_or_none()
    if not customer:
        raise api_error(404, "not_found", "customer not found")

    new_stamps = max(0, customer.stamps + payload.delta)
    actual_delta = new_stamps - customer.stamps
    customer.stamps = new_stamps
    if actual_delta > 0:
        customer.lifetime_stamps += actual_delta

    db.add(Transaction(
        id=str(uuid4()),
        customer_id=customer.id,
        staff_user_id=manager.id,
        kind=TransactionKind.ACCRUAL.value if payload.delta > 0 else TransactionKind.REDEEM.value,
        stamps_delta=actual_delta if actual_delta != 0 else payload.delta,
        qr_jti=f"admin_{uuid4().hex}",
    ))
    await db.commit()
    return {
        "new_balance": customer.stamps,
        "lifetime_stamps": customer.lifetime_stamps,
        "customer_name": customer.name,
    }


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@router.get("/transactions")
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
    limit: int = Query(default=60, ge=1, le=200),
) -> list[dict[str, object]]:
    rows = (await db.execute(
        select(Transaction, Customer, StaffUser)
        .join(Customer, Transaction.customer_id == Customer.id)
        .outerjoin(StaffUser, Transaction.staff_user_id == StaffUser.id)
        .where(Customer.restaurant_id == restaurant_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )).all()
    return [
        {
            "id": tx.id,
            "kind": tx.kind,
            "stamps_delta": tx.stamps_delta,
            "customer_name": customer.name,
            "staff_name": staff.name if staff else None,
            "created_at": tx.created_at.isoformat(),
            "is_manual": tx.qr_jti.startswith("admin_"),
        }
        for tx, customer, staff in rows
    ]


# ---------------------------------------------------------------------------
# Program config (manager only to write)
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> dict[str, object]:
    tiers = await service.tiers_payload(db, restaurant_id)
    levels = await service.levels_payload(db, restaurant_id)
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        return {
            "threshold": tiers[-1]["stamps_required"],
            "reward_name": tiers[-1]["reward_name"],
            "tier_name": "Maisonero",
            "tiers": tiers,
            "levels": levels,
            "level_label": "Nivel",
        }
    return {
        "threshold": config.threshold,
        "reward_name": config.reward_name,
        "tier_name": config.tier_name,
        "tiers": tiers,
        "levels": levels,
        "level_label": config.level_label,
    }


# ---------------------------------------------------------------------------
# Reward tiers (milestones) — manager only to write
# ---------------------------------------------------------------------------

@router.get("/tiers")
async def get_tiers(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> dict[str, object]:
    return {"tiers": await service.tiers_payload(db, restaurant_id)}


class TierInput(BaseModel):
    stamps_required: int
    reward_name: str


class UpdateTiersRequest(BaseModel):
    tiers: list[TierInput]


@router.put("/tiers")
async def update_tiers(
    payload: UpdateTiersRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    if not payload.tiers:
        raise api_error(400, "invalid_input", "Debe haber al menos un nivel de recompensa")
    if len(payload.tiers) > 10:
        raise api_error(400, "invalid_input", "Máximo 10 niveles")

    seen: set[int] = set()
    cleaned: list[tuple[int, str]] = []
    for tier in payload.tiers:
        if not (1 <= tier.stamps_required <= 50):
            raise api_error(400, "invalid_input", "Cada nivel debe estar entre 1 y 50 sellos")
        if tier.stamps_required in seen:
            raise api_error(400, "invalid_input", "No puede haber dos niveles con la misma cantidad de sellos")
        seen.add(tier.stamps_required)
        name = tier.reward_name.strip()
        if not name:
            raise api_error(400, "invalid_input", "Cada nivel necesita un nombre de premio")
        cleaned.append((tier.stamps_required, name))
    cleaned.sort()

    now = datetime.now(timezone.utc)
    await db.execute(sql_delete(RewardTier).where(RewardTier.restaurant_id == restaurant_id))
    for stamps_required, name in cleaned:
        db.add(RewardTier(
            id=f"tier_{uuid4().hex[:12]}",
            restaurant_id=restaurant_id,
            stamps_required=stamps_required,
            reward_name=name,
            created_at=now,
        ))

    # The top milestone is the card size — keep config + customers in sync with it.
    top_stamps, top_name = cleaned[-1]
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        config = RestaurantConfig(
            restaurant_id=restaurant_id,
            threshold=top_stamps,
            reward_name=top_name,
            tier_name="Maisonero",
            updated_at=now,
        )
        db.add(config)
    else:
        config.threshold = top_stamps
        config.reward_name = top_name
    await db.execute(
        sql_update(Customer)
        .where(Customer.restaurant_id == restaurant_id)
        .values(threshold=top_stamps)
    )

    await db.commit()
    return {"tiers": [{"stamps_required": s, "reward_name": n} for s, n in cleaned]}


# ---------------------------------------------------------------------------
# Card levels (membership progression) — manager only to write
# ---------------------------------------------------------------------------

@router.get("/levels")
async def get_levels(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> dict[str, object]:
    config = await db.get(RestaurantConfig, restaurant_id)
    return {
        "level_label": config.level_label if config else "Nivel",
        "levels": await service.levels_payload(db, restaurant_id),
    }


class LevelInput(BaseModel):
    name: str
    stamps_required: int


class UpdateLevelsRequest(BaseModel):
    # Either field is optional so the admin UI can update the label without
    # resending all levels, or vice-versa.
    level_label: str | None = None
    levels: list[LevelInput] | None = None


@router.put("/levels")
async def update_levels(
    payload: UpdateLevelsRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    if payload.levels is not None:
        if not payload.levels:
            raise api_error(400, "invalid_input", "Debe haber al menos un nivel")
        if len(payload.levels) > 10:
            raise api_error(400, "invalid_input", "Máximo 10 niveles")
        seen: set[int] = set()
        cleaned: list[tuple[int, str]] = []
        for lvl in payload.levels:
            name = lvl.name.strip()
            if not name:
                raise api_error(400, "invalid_input", "Cada nivel necesita un nombre")
            if len(name) > 60:
                raise api_error(400, "invalid_input", "Nombre demasiado largo")
            if lvl.stamps_required < 0 or lvl.stamps_required > 10000:
                raise api_error(400, "invalid_input", "Sellos requeridos fuera de rango (0–10000)")
            if lvl.stamps_required in seen:
                raise api_error(400, "invalid_input", "No puede haber dos niveles con el mismo umbral de sellos")
            seen.add(lvl.stamps_required)
            cleaned.append((lvl.stamps_required, name))
        cleaned.sort()
        now = datetime.now(timezone.utc)
        await db.execute(sql_delete(CardLevel).where(CardLevel.restaurant_id == restaurant_id))
        for stamps_required, name in cleaned:
            db.add(CardLevel(
                id=f"lvl_{uuid4().hex[:12]}",
                restaurant_id=restaurant_id,
                stamps_required=stamps_required,
                name=name,
                created_at=now,
            ))

    if payload.level_label is not None:
        label = payload.level_label.strip()
        if not label:
            raise api_error(400, "invalid_input", "La etiqueta no puede ser vacía")
        if len(label) > 40:
            raise api_error(400, "invalid_input", "La etiqueta es demasiado larga")
        config = await db.get(RestaurantConfig, restaurant_id)
        if not config:
            config = RestaurantConfig(
                restaurant_id=restaurant_id,
                level_label=label,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(config)
        else:
            config.level_label = label

    await db.commit()
    config = await db.get(RestaurantConfig, restaurant_id)
    return {
        "level_label": config.level_label if config else "Nivel",
        "levels": await service.levels_payload(db, restaurant_id),
    }


class UpdateConfigRequest(BaseModel):
    threshold: int | None = None
    reward_name: str | None = None
    tier_name: str | None = None


@router.patch("/config")
async def update_config(
    payload: UpdateConfigRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    if payload.threshold is not None and not (1 <= payload.threshold <= 50):
        raise api_error(400, "invalid_input", "El umbral debe estar entre 1 y 50 sellos")

    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        config = RestaurantConfig(
            restaurant_id=restaurant_id,
            threshold=payload.threshold if payload.threshold is not None else 10,
            reward_name=payload.reward_name or "Papas fritas gratis",
            tier_name=payload.tier_name or "Maisonero",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(config)
    else:
        if payload.threshold is not None:
            config.threshold = payload.threshold
        if payload.reward_name is not None:
            config.reward_name = payload.reward_name.strip()
        if payload.tier_name is not None:
            config.tier_name = payload.tier_name.strip()

    if payload.threshold is not None:
        await db.execute(
            sql_update(Customer)
            .where(Customer.restaurant_id == restaurant_id)
            .values(threshold=payload.threshold)
        )

    if payload.tier_name is not None:
        await db.execute(
            sql_update(Customer)
            .where(Customer.restaurant_id == restaurant_id)
            .values(tier=payload.tier_name.strip())
        )

    await db.commit()
    return {
        "threshold": config.threshold,
        "reward_name": config.reward_name,
        "tier_name": config.tier_name,
        "tiers": await service.tiers_payload(db, restaurant_id),
    }


# ---------------------------------------------------------------------------
# Staff management
# ---------------------------------------------------------------------------

class CreateStaffRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = StaffRole.CASHIER.value


class UpdateStaffRequest(BaseModel):
    name: str | None = None
    password: str | None = None
    is_active: bool | None = None


@router.get("/staff")
async def list_staff(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> list[dict[str, object]]:
    rows = (await db.execute(
        select(StaffUser)
        .where(StaffUser.restaurant_id == restaurant_id)
        .order_by(StaffUser.created_at)
    )).scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "role": s.role,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]


@router.post("/staff", status_code=201)
async def create_staff_user(
    payload: CreateStaffRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    email = payload.email.strip().lower()
    if payload.role not in (StaffRole.CASHIER.value, StaffRole.MANAGER.value):
        raise api_error(400, "invalid_input", "role must be cashier or manager")
    existing = (await db.execute(
        select(StaffUser).where(StaffUser.restaurant_id == restaurant_id, StaffUser.email == email)
    )).scalar_one_or_none()
    if existing:
        raise api_error(409, "duplicate_email", "email already registered")
    new_user = StaffUser(
        id=f"stf_{uuid4().hex[:12]}",
        restaurant_id=restaurant_id,
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    return {"id": new_user.id, "email": email, "name": new_user.name, "role": new_user.role, "is_active": True}


@router.patch("/staff/{staff_id}")
async def update_staff_user(
    staff_id: str,
    payload: UpdateStaffRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    manager: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    target = (await db.execute(
        select(StaffUser).where(StaffUser.id == staff_id, StaffUser.restaurant_id == restaurant_id)
    )).scalar_one_or_none()
    if not target:
        raise api_error(404, "not_found", "staff not found")
    if target.id == manager.id:
        raise api_error(400, "self_edit", "cannot modify your own account here")
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.name:
        target.name = payload.name.strip()
    if payload.password:
        target.password_hash = hash_password(payload.password)
    await db.commit()
    return {"id": target.id, "email": target.email, "name": target.name, "role": target.role, "is_active": target.is_active}


# ---------------------------------------------------------------------------
# Proximidad (geofence de Google Wallet) — apartado OCULTO
# ---------------------------------------------------------------------------
# No hay link a esto en ninguna UI: se accede por URL directa. La feature se
# vende aparte; mientras el cliente no pague, el dueño no ve el botón. Igual
# queda protegida por require_manager: sin sesión de manager no se puede usar.


class ProximityUpdate(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    proximity_message: str | None = None
    clear: bool = False


@router.get("/proximity")
async def get_proximity(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        return {"latitude": None, "longitude": None, "proximity_message": None}
    return {
        "latitude": config.latitude,
        "longitude": config.longitude,
        "proximity_message": config.proximity_message,
    }


@router.patch("/proximity")
async def update_proximity(
    payload: ProximityUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    """Setea ubicación + mensaje de proximidad y re-syncea la LoyaltyClass de
    Google (que lleva merchantLocations), así el geofence queda activo para
    todos los pases ya guardados. `clear=true` apaga el geofence."""
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        config = RestaurantConfig(restaurant_id=restaurant_id)
        db.add(config)

    if payload.clear:
        config.latitude = None
        config.longitude = None
        config.proximity_message = None
    else:
        if (payload.latitude is None) != (payload.longitude is None):
            raise api_error(
                400, "invalid_input",
                "latitude y longitude deben enviarse juntas (o usar clear=true).",
            )
        if payload.latitude is not None:
            if not (-90 <= payload.latitude <= 90) or not (-180 <= payload.longitude <= 180):
                raise api_error(400, "invalid_input", "coordenadas fuera de rango.")
            config.latitude = payload.latitude
            config.longitude = payload.longitude
        if payload.proximity_message is not None:
            config.proximity_message = payload.proximity_message.strip() or None

    await db.commit()
    await db.refresh(config)

    # Re-sync de la class en Google (idempotente, en background: I/O bloqueante).
    from app.loyalty.google_wallet import ensure_class, is_wallet_configured

    if is_wallet_configured():
        background_tasks.add_task(ensure_class, config)

    return {
        "latitude": config.latitude,
        "longitude": config.longitude,
        "proximity_message": config.proximity_message,
    }


# ---------------------------------------------------------------------------
# Anuncio a clientes con la tarjeta en Google Wallet (broadcast a la clase)
# ---------------------------------------------------------------------------


class AnnounceRequest(BaseModel):
    header: str
    body: str


@router.get("/announce")
async def announce_status(
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    """Cuántos anuncios quedan hoy (para mostrarlo en el admin)."""
    from app.loyalty.google_wallet import (
        announcements_remaining,
        announcements_today,
        is_wallet_configured,
    )

    return {
        "wallet_configured": is_wallet_configured(),
        "sent_today": announcements_today(),
        "remaining_today": announcements_remaining(),
    }


@router.post("/announce")
async def announce(
    payload: AnnounceRequest,
    _: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    """Manda una notificación a TODOS los clientes con el pase guardado.

    Un solo addmessage a la clase → Google lo propaga a cada pase. Rate-limit
    diario propio (más conservador que el de Google) para no quemar el cupo de
    3/día por pase ni molestar a los clientes."""
    import asyncio

    from app.loyalty.google_wallet import (
        announcements_remaining,
        broadcast_class_message,
        is_wallet_configured,
    )

    header = payload.header.strip()
    body = payload.body.strip()
    if not header or not body:
        raise api_error(400, "invalid_input", "El título y el mensaje son obligatorios.")
    if len(header) > 60:
        raise api_error(400, "invalid_input", "El título no puede superar 60 caracteres.")
    if len(body) > 250:
        raise api_error(400, "invalid_input", "El mensaje no puede superar 250 caracteres.")
    if not is_wallet_configured():
        raise api_error(503, "wallet_not_configured", "Google Wallet no está configurado.")
    if announcements_remaining() <= 0:
        raise api_error(
            429, "rate_limited",
            "Ya enviaste el máximo de anuncios por hoy. Intenta mañana.",
        )

    try:
        await asyncio.to_thread(broadcast_class_message, header, body)
    except Exception as exc:
        logger.exception("announce broadcast failed")
        raise api_error(502, "wallet_provider_error", "Google rechazó el envío. Reintenta.") from exc

    from app.loyalty.google_wallet import announcements_remaining as _rem

    return {"ok": True, "remaining_today": _rem()}
