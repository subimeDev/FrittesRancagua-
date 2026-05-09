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


class TransactionResponse(BaseModel):
    kind: Literal["accrual", "redeem"]
    new_balance: int
    customer_name: str


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
