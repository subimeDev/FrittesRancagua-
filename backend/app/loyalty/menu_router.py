"""Endpoints de la carta (menú) de Frittes.

- `GET /loyalty/public/menu` — público, devuelve la carta vigente.
- `GET /loyalty/admin/menu` — staff, mismo shape para precargar el editor.
- `PUT /loyalty/admin/menu` — manager, bulk-replace.

La carta se reemplaza completa en cada PUT para que el editor del admin sea
simple (serializar el árbol y mandar). Los `id` que vienen sin valor se
generan en backend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_staff, get_db, get_restaurant_id
from app.loyalty.admin_router import require_manager
from app.models import MenuCategory, MenuItem, RestaurantConfig, StaffUser
from app.schemas import (
    MenuCategoryView,
    MenuItemView,
    MenuReplaceRequest,
    MenuView,
)

router = APIRouter(prefix="/loyalty", tags=["menu"])

BRAND_NAME = "Frittes Maison"


async def _build_menu_view(db: AsyncSession, restaurant_id: str) -> MenuView:
    config = await db.get(RestaurantConfig, restaurant_id)
    brand_name = (getattr(config, "brand_name", None) if config else None) or BRAND_NAME
    categories = (
        (
            await db.execute(
                select(MenuCategory)
                .where(MenuCategory.restaurant_id == restaurant_id)
                .order_by(MenuCategory.position, MenuCategory.name)
            )
        )
        .scalars()
        .all()
    )
    items = (
        (
            await db.execute(
                select(MenuItem)
                .where(MenuItem.restaurant_id == restaurant_id)
                .order_by(MenuItem.position, MenuItem.name)
            )
        )
        .scalars()
        .all()
    )
    items_by_cat: dict[str, list[MenuItemView]] = {}
    for it in items:
        items_by_cat.setdefault(it.category_id, []).append(
            MenuItemView(
                id=it.id,
                category_id=it.category_id,
                name=it.name,
                description=it.description,
                price_cents=it.price_cents,
                is_available=it.is_available,
                badge=it.badge,
                image_url=it.image_url,
                position=it.position,
            )
        )
    return MenuView(
        brand_name=brand_name,
        categories=[
            MenuCategoryView(
                id=c.id,
                name=c.name,
                position=c.position,
                items=items_by_cat.get(c.id, []),
            )
            for c in categories
        ],
    )


@router.get("/public/menu", response_model=MenuView)
async def get_public_menu(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
) -> MenuView:
    return await _build_menu_view(db, restaurant_id)


@router.get("/admin/menu", response_model=MenuView)
async def get_admin_menu(
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(get_current_staff),
) -> MenuView:
    return await _build_menu_view(db, restaurant_id)


@router.put("/admin/menu", response_model=MenuView)
async def replace_menu(
    payload: MenuReplaceRequest,
    db: AsyncSession = Depends(get_db),
    restaurant_id: str = Depends(get_restaurant_id),
    _: StaffUser = Depends(require_manager),
) -> MenuView:
    """Reemplaza la carta entera. Borra lo existente y persiste el árbol del
    payload (los items primero por la FK a categorías)."""
    await db.execute(delete(MenuItem).where(MenuItem.restaurant_id == restaurant_id))
    await db.execute(delete(MenuCategory).where(MenuCategory.restaurant_id == restaurant_id))

    now = datetime.now(timezone.utc)
    for cat_pos, cat in enumerate(payload.categories):
        cat_id = cat.id or f"cat_{uuid4().hex[:12]}"
        db.add(
            MenuCategory(
                id=cat_id,
                restaurant_id=restaurant_id,
                name=cat.name.strip(),
                position=cat_pos,
                created_at=now,
            )
        )
        await db.flush()  # asegura la categoría antes de insertar sus items (FK)
        for item_pos, item in enumerate(cat.items):
            db.add(
                MenuItem(
                    id=item.id or f"itm_{uuid4().hex[:12]}",
                    restaurant_id=restaurant_id,
                    category_id=cat_id,
                    name=item.name.strip(),
                    description=(item.description or "").strip() or None,
                    price_cents=item.price_cents,
                    is_available=item.is_available,
                    badge=(item.badge or "").strip() or None,
                    image_url=(item.image_url or "").strip() or None,
                    position=item_pos,
                    created_at=now,
                )
            )

    await db.commit()
    return await _build_menu_view(db, restaurant_id)
