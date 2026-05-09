# Backend contract (frontend esperado)

Este documento fija el contrato que usan `frontends/frittes-loyalty` y `frontends/frittes-pos`.

## Headers comunes

- `Content-Type: application/json`
- `X-Restaurant-Id: frittes-maison`
- `Authorization: Bearer <session_token>` cuando corresponda

## Auth cliente loyalty

- `POST /api/v1/loyalty/auth/request-otp`
  - body: `{ "phone": "+56912345678" }`
  - response: `204 No Content`
  - reglas: OTP 6 digitos, TTL 5 min, rate limit 3 intentos por numero cada 10 min.

- `POST /api/v1/loyalty/auth/verify-otp`
  - body: `{ "phone": "+56912345678", "code": "123456" }`
  - response:
    ```json
    {
      "session_token": "jwt-or-random-token",
      "customer": null
    }
    ```
    o `customer` completo si ya existe.

- `POST /api/v1/loyalty/auth/sign-out`
  - invalida sesion.

## Cliente loyalty

- `POST /api/v1/loyalty/customers`
  - body: `{ "customer_name": "Maria", "email": "maria@mail.com" }`
  - response: `LoyaltyCustomerDto`

- `GET /api/v1/loyalty/customers/me`
  - response: `LoyaltyCustomerDto`

`LoyaltyCustomerDto`:
```json
{
  "id": "frt_abc123",
  "customer_name": "Maria Perez",
  "phone": "+56912345678",
  "email": "maria@mail.com",
  "stamps": 7,
  "threshold": 10,
  "lifetime_stamps": 19,
  "redemptions": 1,
  "tier": "Maisonero",
  "member_since": "2026-05-01T13:00:00Z"
}
```

## QR token loyalty

- `GET /api/v1/loyalty/qr-tokens`
  - response: `{ "token": "<jwt>", "exp_at": "2026-05-08T04:10:00Z" }`
  - TTL esperado: 90s.
  - JWT claims: `sub`, `aud=frittes-maison`, `iat`, `exp`, `jti`.

## Wallet

- `GET /api/v1/loyalty/passes/apple/me`
  - response: `application/vnd.apple.pkpass`

- `GET /api/v1/loyalty/passes/google/me`
  - response: `{ "url": "https://pay.google.com/gp/v/save/<jwt>" }`
  - alternativa valida: 302 redirect.

## POS staff

- `POST /api/v1/loyalty/staff/auth/login`
  - body: `{ "email": "staff@frittes.cl", "password": "..." }`
  - response: `{ "session_token": "..." }`

- `POST /api/v1/loyalty/transactions/accrue`
  - body: `{ "qr_token": "<jwt>" }`
  - response: balance actualizado.

- `POST /api/v1/loyalty/transactions/redeem`
  - body: `{ "qr_token": "<jwt>" }`
  - response: balance actualizado.

Cada transaccion debe persistir `staff_user_id` para auditoria.

## Codigos de error esperados

- `401 -> code: "unauthenticated"`
- `404 -> code: "not_found"`
- `429 -> code: "rate_limited"` (+ `retry_after` recomendado)
- `5xx -> error generico, cliente reintenta con backoff`
