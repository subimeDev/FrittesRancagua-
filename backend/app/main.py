from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.loyalty.exceptions import (
    CustomerNotFoundError,
    InsufficientStampsError,
    QrTokenAlreadyUsedError,
    QrTokenExpiredError,
    QrTokenInvalidError,
)
from app.loyalty.router import router as loyalty_router

logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title="Frittes Loyalty API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Cookie", "X-Restaurant-Id"],
    allow_credentials=True,
)


@app.exception_handler(QrTokenExpiredError)
async def qr_expired_handler(_: Request, exc: QrTokenExpiredError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"code": "qr_expired", "message": "qr token expired"})


@app.exception_handler(QrTokenInvalidError)
async def qr_invalid_handler(_: Request, exc: QrTokenInvalidError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"code": "qr_invalid", "message": "invalid qr token"})


@app.exception_handler(QrTokenAlreadyUsedError)
async def qr_replayed_handler(_: Request, exc: QrTokenAlreadyUsedError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"code": "qr_replayed", "message": "qr token already used"})


@app.exception_handler(InsufficientStampsError)
async def insufficient_stamps_handler(_: Request, exc: InsufficientStampsError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"code": "insufficient_stamps", "message": "not enough stamps"})


@app.exception_handler(CustomerNotFoundError)
async def customer_not_found_handler(_: Request, exc: CustomerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"code": "not_found", "message": "customer not found"})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    request_id = str(uuid.uuid4())
    logger.error("unhandled exception request_id=%s path=%s", request_id, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"code": "internal_error", "message": "unexpected error", "request_id": request_id},
    )


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(loyalty_router, prefix="/api/v1")
