from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiErrorResponse(BaseModel):
    code: str
    message: str


class RegisterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    customer_name: str | None = None
    phone: str | None = None
    email: str | None = None


class CardLevelView(BaseModel):
    number: int
    name: str
    stamps_required: int


class CustomerResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: str | None
    stamps: int
    threshold: int
    lifetime_stamps: int
    redemptions: int
    tier: str
    member_since: datetime
    level_label: str = "Nivel"
    current_level: CardLevelView | None = None
    next_level: CardLevelView | None = None


class DevLoginRequest(BaseModel):
    phone: str


class SessionResponse(BaseModel):
    session_token: str
    customer: CustomerResponse | None


class QrTokenResponse(BaseModel):
    token: str
    exp_at: datetime


class AccrueRequest(BaseModel):
    qr_token: str


class RedeemRequest(BaseModel):
    qr_token: str
    # Which milestone to redeem (its stamps_required value). When omitted, the
    # backend redeems the highest tier the customer currently qualifies for.
    tier_stamps: int | None = None


class TransactionResponse(BaseModel):
    kind: Literal["accrual", "redeem"]
    new_balance: int
    customer_name: str
    reward_name: str | None = None


class StaffLoginRequest(BaseModel):
    email: str
    password: str


class StaffPublic(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["cashier", "manager"]


class StaffSessionResponse(BaseModel):
    session_token: str
    staff: StaffPublic


class OtpRequest(BaseModel):
    phone: str


class OtpVerifyRequest(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=8)


class EmailLoginRequest(BaseModel):
    email: str


# ─── Carta (menú) ─────────────────────────────────────────────────────────────

class MenuItemView(BaseModel):
    id: str
    category_id: str
    name: str
    description: str | None = None
    price_cents: int
    is_available: bool
    badge: str | None = None
    image_url: str | None = None
    position: int


class MenuCategoryView(BaseModel):
    id: str
    name: str
    position: int
    items: list[MenuItemView] = Field(default_factory=list)


class MenuView(BaseModel):
    brand_name: str
    categories: list[MenuCategoryView] = Field(default_factory=list)


class MenuItemInput(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=400)
    price_cents: int = Field(ge=0)
    is_available: bool = True
    badge: str | None = Field(default=None, max_length=40)
    image_url: str | None = None


class MenuCategoryInput(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    items: list[MenuItemInput] = Field(default_factory=list)


class MenuReplaceRequest(BaseModel):
    categories: list[MenuCategoryInput] = Field(default_factory=list)
