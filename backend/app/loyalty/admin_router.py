from __future__ import annotations

import asyncio
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import api_error, get_current_staff, get_db, get_restaurant_id
from app.loyalty import service
from app.models import Customer, RestaurantConfig, StaffRole, StaffUser, Transaction, TransactionKind
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
    customers_with_coupon = (await db.execute(
        select(func.count()).select_from(Customer)
        .where(Customer.restaurant_id == restaurant_id, Customer.stamps >= Customer.threshold)
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
            "has_coupon": c.stamps >= c.threshold,
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
    base_filter = [Customer.restaurant_id == restaurant_id]
    if with_coupon:
        base_filter.append(Customer.stamps >= Customer.threshold)
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
                "has_coupon": c.stamps >= c.threshold,
                "member_since": c.member_since.isoformat(),
            }
            for c in rows
        ],
    }


# ---------------------------------------------------------------------------
# Customer actions (manager only)
# ---------------------------------------------------------------------------

@router.post("/customers/{customer_id}/redeem")
async def manual_redeem(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    manager: StaffUser = Depends(require_manager),
) -> dict[str, object]:
    customer = (await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.restaurant_id == restaurant_id)
    )).scalar_one_or_none()
    if not customer:
        raise api_error(404, "not_found", "customer not found")
    if customer.stamps < customer.threshold:
        raise api_error(400, "insufficient_stamps", f"necesita {customer.threshold} sellos, tiene {customer.stamps}")

    deducted = customer.threshold
    customer.stamps -= deducted
    customer.redemptions += 1
    db.add(Transaction(
        id=str(uuid4()),
        customer_id=customer.id,
        staff_user_id=manager.id,
        kind=TransactionKind.REDEEM.value,
        stamps_delta=-deducted,
        qr_jti=f"admin_{uuid4().hex}",
    ))
    config = await db.get(RestaurantConfig, restaurant_id)
    reward_name = config.reward_name if config else "Papas fritas gratis"
    customer_name = customer.name
    customer_phone = customer.phone
    await db.commit()
    asyncio.create_task(service.send_redemption_email(customer_name, customer_phone, reward_name))
    return {
        "new_balance": customer.stamps,
        "redemptions": customer.redemptions,
        "customer_name": customer_name,
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
    config = await db.get(RestaurantConfig, restaurant_id)
    if not config:
        return {"threshold": 10, "reward_name": "Papas fritas gratis", "tier_name": "Maisonero"}
    return {
        "threshold": config.threshold,
        "reward_name": config.reward_name,
        "tier_name": config.tier_name,
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

    from datetime import datetime, timezone
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
