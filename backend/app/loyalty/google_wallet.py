from __future__ import annotations

import json
import logging
import time
import uuid

from app.config import get_settings
from app.models import Customer

logger = logging.getLogger(__name__)


def _parse_credentials_json(raw: str) -> dict:
    """Accept either raw JSON or Base64-encoded JSON (Railway-friendly)."""
    raw = raw.strip()
    try:
        if raw.startswith("{"):
            return json.loads(raw)
        import base64
        return json.loads(base64.b64decode(raw).decode("utf-8"))
    except Exception as e:
        logger.error("Failed to parse GOOGLE_WALLET_CREDENTIALS_JSON: %s", e)
        raise ValueError(f"Invalid credentials JSON format: {e}") from e


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


def _class_id() -> str:
    settings = get_settings()
    if not settings.google_wallet_issuer_id:
        raise ValueError("GOOGLE_WALLET_ISSUER_ID not configured")
    return f"{settings.google_wallet_issuer_id}.frittes-loyalty"


def _object_id(customer_id: str) -> str:
    settings = get_settings()
    # Ensure ID doesn't have hyphens if it's a UUID, although Google allows them, 
    # some older implementations/parsers prefer alphanumeric.
    clean_id = customer_id.replace("-", "")
    return f"{settings.google_wallet_issuer_id}.{clean_id}"


def create_loyalty_class_if_needed() -> None:
    import googleapiclient.discovery  # type: ignore[import-untyped]
    try:
        creds = _credentials()
        service = googleapiclient.discovery.build("walletobjects", "v1", credentials=creds)
        class_id = _class_id()
        try:
            service.loyaltyclass().get(resourceId=class_id).execute()
            logger.info("Google Wallet LoyaltyClass %s already exists", class_id)
            return
        except Exception:
            logger.info("Google Wallet LoyaltyClass %s not found, creating...", class_id)
            pass

        loyalty_class = {
            "id": class_id,
            "issuerName": "Frittes Maison",
            "programName": "Club Frittes",
            "programLogo": {
                "sourceUri": {"uri": "https://frittesrancagua-production.up.railway.app/icons/icon-192.png"},
                "contentDescription": {"defaultValue": {"language": "es", "value": "Logo Frittes"}},
            },
            "rewardsTier": "Maisonero",
            "rewardsTierLabel": "Nivel",
            "reviewStatus": "UNDER_REVIEW",
            "hexBackgroundColor": "#F5C842",
        }
        service.loyaltyclass().insert(body=loyalty_class).execute()
        logger.info("Google Wallet LoyaltyClass %s created successfully", class_id)
    except Exception as e:
        logger.error("Failed to create Google Wallet class: %s", e)
        # We don't raise here to avoid blocking the main flow if it's already there 
        # but the check failed for some other reason.
        pass


def build_save_url(customer: Customer) -> str:
    import google.auth.crypt as crypt
    import google.auth.jwt as gjwt

    settings = get_settings()
    if not settings.google_wallet_issuer_id or not settings.google_wallet_credentials_json:
        raise ValueError("Google Wallet not configured")

    creds_info = _parse_credentials_json(settings.google_wallet_credentials_json)
    signer = crypt.RSASigner.from_service_account_info(creds_info)

    loyalty_object = {
        "id": _object_id(customer.id),
        "classId": _class_id(),
        "state": "ACTIVE",
        "accountId": customer.phone or customer.id,
        "accountName": customer.name,
        "loyaltyPoints": {
            "label": "Sellos",
            "balance": {"int": customer.stamps},
        },
    }

    payload = {
        "iss": creds_info["client_email"],
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()),
        "jti": str(uuid.uuid4()),
        "payload": {"loyaltyObjects": [loyalty_object]},
    }

    token = gjwt.encode(payload, signer)
    jwt_str = token if isinstance(token, str) else token.decode("utf-8")
    return f"https://pay.google.com/gp/v/save/{jwt_str}"
