"""Google Wallet (LoyaltyClass + LoyaltyObject) — Frittes Maison.

Versión portada del molde Loyalty (single-tenant): el pase muestra QR
escaneable por el POS, "Próximo premio x/N", la grilla de sellos como
heroImage y se actualiza solo tras cada accrue/redeem vía
`update_loyalty_object` (llamar desde el router en background).

Resiliencia: nunca levantamos excepciones que rompan el flujo del cliente.
Si Google está caído / no configurado, el botón "Save to Google Wallet"
muestra error en el frontend pero el resto de la tarjeta sigue funcionando.
"""

from __future__ import annotations

import json
import logging
import time
import uuid

from app.config import get_settings
from app.models import Customer, RestaurantConfig

logger = logging.getLogger(__name__)

HOMEPAGE_URI = "https://frittes2026.cl/"
ISSUER_NAME = "Frittes Maison"
LOGO_URI = "https://frittes2026.cl/icons/icon-512.png"
HEX_BACKGROUND = "#FFD23F"  # --brand-mustard


# ─── Configuración / credenciales ────────────────────────────────────────────


def _parse_credentials_json(raw: str) -> dict:
    """Accept either raw JSON or Base64-encoded JSON (Railway-friendly)."""
    raw = raw.strip()
    try:
        if raw.startswith("{"):
            info = json.loads(raw)
        else:
            import base64

            info = json.loads(base64.b64decode(raw).decode("utf-8"))
    except Exception as e:
        logger.error("Failed to parse GOOGLE_WALLET_CREDENTIALS_JSON: %s", e)
        raise ValueError(f"Invalid credentials JSON format: {e}") from e

    if not isinstance(info, dict):
        raise ValueError("Invalid credentials JSON: se esperaba un objeto")
    missing = [k for k in ("client_email", "private_key", "token_uri") if not info.get(k)]
    if missing:
        raise ValueError(f"Credentials JSON incompleto, faltan: {', '.join(missing)}")
    return info


def is_wallet_configured() -> bool:
    settings = get_settings()
    return bool(settings.google_wallet_issuer_id and settings.google_wallet_credentials_json)


def _credentials():
    import google.oauth2.service_account as sa

    settings = get_settings()
    if not settings.google_wallet_credentials_json:
        raise ValueError("GOOGLE_WALLET_CREDENTIALS_JSON not configured")
    info = _parse_credentials_json(settings.google_wallet_credentials_json)
    return sa.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/wallet_object.issuer"],
    )


def _service():
    """Cliente Google API con timeout de socket (10s) para que un Google
    degradado no cuelgue el request del backend."""
    import google_auth_httplib2  # type: ignore[import-untyped]
    import googleapiclient.discovery  # type: ignore[import-untyped]
    import httplib2  # type: ignore[import-untyped]

    authed_http = google_auth_httplib2.AuthorizedHttp(
        _credentials(), http=httplib2.Http(timeout=10)
    )
    return googleapiclient.discovery.build(
        "walletobjects", "v1", http=authed_http, cache_discovery=False
    )


# ─── IDs ──────────────────────────────────────────────────────────────────────


def _class_id() -> str:
    settings = get_settings()
    if not settings.google_wallet_issuer_id:
        raise ValueError("GOOGLE_WALLET_ISSUER_ID not configured")
    return f"{settings.google_wallet_issuer_id}.frittes-loyalty"


def _object_id(customer_id: str) -> str:
    settings = get_settings()
    clean_id = customer_id.replace("-", "")
    return f"{settings.google_wallet_issuer_id}.{clean_id}"


# ─── LoyaltyClass ─────────────────────────────────────────────────────────────


def _build_class_body(config: RestaurantConfig) -> dict:
    return {
        "id": _class_id(),
        "issuerName": ISSUER_NAME,
        "programName": config.tier_name or "Club Frittes",
        "rewardsTierLabel": config.level_label or "Nivel",
        "reviewStatus": "UNDER_REVIEW",
        "countryCode": "CL",
        "hexBackgroundColor": HEX_BACKGROUND,
        "programLogo": {
            "sourceUri": {"uri": LOGO_URI},
            "contentDescription": {
                "defaultValue": {"language": "es", "value": f"Logo de {ISSUER_NAME}"}
            },
        },
        "homepageUri": {
            "uri": HOMEPAGE_URI,
            "description": f"Sitio de {ISSUER_NAME}",
        },
        "linksModuleData": {
            "uris": [
                {
                    "uri": HOMEPAGE_URI,
                    "description": "Ver mi tarjeta de fidelidad",
                    "id": "tarjeta",
                }
            ]
        },
    }


def ensure_class(config: RestaurantConfig) -> str:
    """Crea o actualiza la LoyaltyClass. Idempotente: INSERT primero y
    UPDATE ante 409 — así los cambios de programa (nombre, logo, links)
    se propagan también a la class ya existente."""
    cid = _class_id()
    try:
        service = _service()
        body = _build_class_body(config)
        try:
            service.loyaltyclass().insert(body=body).execute()
            logger.info("Google Wallet class %s created", cid)
        except Exception as insert_exc:
            status = getattr(getattr(insert_exc, "resp", None), "status", None)
            if status == 409:
                service.loyaltyclass().update(resourceId=cid, body=body).execute()
                logger.info("Google Wallet class %s updated", cid)
            else:
                raise
    except Exception as exc:
        logger.warning("ensure_class(%s) failed: %s", cid, exc)
    return cid


# ─── LoyaltyObject por cliente ───────────────────────────────────────────────


def _loyalty_object(
    customer: Customer,
    config: RestaurantConfig,
    *,
    tiers: list[dict] | None = None,
) -> dict:
    """Pase del cliente: QR escaneable (JWT scope `qr`, TTL extendido),
    saldo de sellos, "Próximo premio x/N", grilla heroImage y filas de texto
    con la escalera de premios + progreso."""
    # Import local para evitar ciclo con service.py.
    from app.loyalty.service import create_wallet_qr_token

    threshold = int(config.threshold or 10)
    milestones = sorted(
        int(str(t["stamps_required"])) for t in (tiers or [])
    ) or [threshold]
    ladder_top = milestones[-1]
    next_milestone = next((m for m in milestones if m > customer.stamps), None)
    if tiers:
        by_req = {int(str(t["stamps_required"])): str(t["reward_name"]) for t in tiers}
        next_reward = by_req.get(next_milestone or ladder_top, config.reward_name)
        next_target = next_milestone or ladder_top
    else:
        next_reward = config.reward_name or "Premio"
        next_target = threshold

    wallet_token, _ = create_wallet_qr_token(customer)
    obj: dict = {
        "id": _object_id(customer.id),
        "classId": _class_id(),
        "state": "ACTIVE",
        # OJO: accountId/accountName se muestran en el pase. El correo del
        # cliente NO va acá (la versión anterior lo mostraba gigante).
        "accountId": customer.id,
        "accountName": customer.name or "Cliente Frittes",
        "loyaltyPoints": {
            "label": "Sellos",
            "balance": {"int": int(customer.stamps)},
        },
        "secondaryLoyaltyPoints": {
            "label": "Próximo premio",
            "balance": {"string": f"{customer.stamps}/{next_target} · {next_reward}"},
        },
        # QR = JWT con scope `qr` y TTL extendido; el POS lo escanea y valida
        # igual que el QR efímero de la web. Al consumirse (jti revocado) el
        # próximo sync del pase trae un token fresco.
        "barcode": {
            "type": "QR_CODE",
            "value": wallet_token,
            "alternateText": "Mostrar al cajero",
        },
    }

    # heroImage = grilla de sellos con el branding de Frittes (wallet_stamps).
    # Requiere BACKEND_PUBLIC_URL (Google fetchea la imagen desde su backend).
    settings = get_settings()
    public_backend = (settings.backend_public_url or "").rstrip("/")
    if public_backend and ladder_top > 0:
        from app.loyalty.wallet_stamps import stamps_image_version, stamps_url_signature

        ver = stamps_image_version(
            stamps=customer.stamps, threshold=ladder_top, milestones=milestones
        )
        sig = stamps_url_signature(customer.restaurant_id, customer.id)
        obj["heroImage"] = {
            "sourceUri": {
                "uri": (
                    f"{public_backend}/api/v1/loyalty/public/wallet/"
                    f"{customer.id}/stamps.png?v={ver}&t={sig}"
                )
            },
            "contentDescription": {
                "defaultValue": {
                    "language": "es",
                    "value": f"Sellos: {customer.stamps} de {ladder_top}",
                }
            },
        }

    text_modules: list[dict] = []
    if tiers:
        text_modules.append(
            {
                "id": "premios",
                "header": "Premios",
                "body": " · ".join(
                    f"{t['stamps_required']} sellos = {t['reward_name']}" for t in tiers
                ),
            }
        )
    text_modules.append(
        {
            "id": "progreso",
            "header": "Tu progreso",
            "body": (
                f"Sellos disponibles: {customer.stamps} · "
                f"Premios canjeados: {customer.redemptions}"
            ),
        }
    )
    obj["textModulesData"] = text_modules
    return obj


def _save_jwt_origins() -> list[str]:
    """Orígenes web autorizados a usar el JWT de Save to Wallet."""
    from urllib.parse import urlsplit

    settings = get_settings()
    candidates = [HOMEPAGE_URI, *settings.cors_origins]
    out: list[str] = []
    for cand in candidates:
        parts = urlsplit(cand.strip())
        if parts.scheme in ("http", "https") and parts.netloc:
            origin = f"{parts.scheme}://{parts.netloc}"
            if origin not in out:
                out.append(origin)
    return out


def build_save_url(
    customer: Customer,
    config: RestaurantConfig,
    *,
    tiers: list[dict] | None = None,
) -> str:
    """JWT que abre Google Wallet con el pase prellenado."""
    import google.auth.jwt as gjwt
    from google.oauth2 import service_account

    settings = get_settings()
    if not settings.google_wallet_issuer_id or not settings.google_wallet_credentials_json:
        raise ValueError("Google Wallet not configured")

    creds_info = _parse_credentials_json(settings.google_wallet_credentials_json)
    creds = service_account.Credentials.from_service_account_info(creds_info)
    signer = creds.signer

    obj = _loyalty_object(customer, config, tiers=tiers)
    payload = {
        "iss": creds_info["client_email"],
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()),
        "jti": str(uuid.uuid4()),
        "payload": {"loyaltyObjects": [obj]},
    }
    origins = _save_jwt_origins()
    if origins:
        payload["origins"] = origins
    token = gjwt.encode(signer, payload)
    jwt_str = token if isinstance(token, str) else token.decode("utf-8")
    return f"https://pay.google.com/gp/v/save/{jwt_str}"


def update_loyalty_object(
    customer: Customer,
    config: RestaurantConfig,
    *,
    tiers: list[dict] | None = None,
) -> None:
    """Push del estado actual al pase ya guardado. Llamar (en background)
    después de cada accrue/redeem. 404 = el cliente nunca guardó el pase →
    se ignora. NUNCA levanta excepciones (el POS no debe fallar por Google)."""
    if not is_wallet_configured():
        return
    try:
        service = _service()
        oid = _object_id(customer.id)
        body = _loyalty_object(customer, config, tiers=tiers)
        attempts = 3
        for attempt in range(1, attempts + 1):
            try:
                service.loyaltyobject().patch(resourceId=oid, body=body).execute()
                logger.debug("wallet_sync ok object=%s", oid)
                return
            except Exception as exc:
                status = getattr(getattr(exc, "resp", None), "status", None)
                if status == 404:
                    logger.debug("wallet_sync skip object=%s (pase no guardado)", oid)
                    return
                transient = status is None or status >= 500
                if transient and attempt < attempts:
                    time.sleep(0.5 * attempt)
                    continue
                logger.warning(
                    "wallet_sync FAILED object=%s status=%s attempt=%s/%s err=%s",
                    oid, status, attempt, attempts, exc,
                )
                return
    except Exception as exc:
        logger.warning("wallet_sync outer failure customer=%s err=%s", customer.id, exc)


# ─── Compatibilidad hacia atrás ──────────────────────────────────────────────


def create_loyalty_class_if_needed() -> None:  # pragma: no cover - deprecated
    logger.info("create_loyalty_class_if_needed() es legacy; usá ensure_class(config)")
