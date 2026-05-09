# Checklist 3.3 y 3.4 - Validacion backend

Fecha de ejecucion: 2026-05-09

## 3.3 - `GET /customers/me`

### Caso positivo (con token valido)

Comando:

```bash
curl -X GET http://localhost:8000/api/v1/loyalty/customers/me \
  -H "Authorization: Bearer <SESSION_TOKEN>"
```

Resultado:

- Status: `200 OK`
- Retorna customer sin envolvente `session_token`
- Campo de nombre viene como `name` (no `customer_name`)

Respuesta observada:

```json
{
  "id": "frt_630f0bad15c9",
  "name": "Check 3.4 User",
  "phone": "+56966666666",
  "email": null,
  "stamps": 0,
  "threshold": 10,
  "lifetime_stamps": 0,
  "redemptions": 0,
  "tier": "Maisonero",
  "member_since": "2026-05-09T13:58:46.048044"
}
```

### Caso negativo (sin token)

Comando:

```bash
curl -X GET http://localhost:8000/api/v1/loyalty/customers/me
```

Resultado:

- Status: `401`
- Body claro (sin stack trace):

```json
{"detail":{"code":"unauthenticated","message":"missing token"}}
```

### Caso negativo (token invalido)

Comando:

```bash
curl -X GET http://localhost:8000/api/v1/loyalty/customers/me \
  -H "Authorization: Bearer no-soy-un-jwt"
```

Resultado:

- Status: `401`
- Body claro (sin stack trace):

```json
{"detail":{"code":"unauthenticated","message":"invalid token"}}
```

## 3.4 - `GET /qr-tokens`

Comando:

```bash
curl -X GET http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN>"
```

Resultado:

- Status: `200 OK`
- Respuesta trae `token` y `exp_at`

Respuesta observada:

```json
{
  "token": "eyJhbGc...",
  "exp_at": "2026-05-09T14:00:16.129769Z"
}
```

### Claims del QR token

Claims observados:

```json
{
  "sub": "frt_630f0bad15c9",
  "aud": "frittes-maison",
  "scope": "qr",
  "jti": "720401dd-057e-4b34-8463-7c09373283dd",
  "iat": 1778335126,
  "exp": 1778335216
}
```

Validaciones:

- `sub`: presente y corresponde al `customer_id`
- `aud`: `frittes-maison`
- `scope`: `qr` (correcto, distinguible de token de sesion)
- `jti`: presente y con formato UUID
- `exp - iat`: `90` segundos

## Nota detectada al probar expiracion con `accrue`

Al intentar usar `POST /transactions/accrue` con QR expirado, la instancia actual en `:8000` devuelve:

```json
{"code":"internal_error","message":"A transaction is already begun on this Session."}
```

Este comportamiento es de la seccion 4.x/5.x (no de 3.3/3.4), pero queda registrado porque bloquea validar expiracion end-to-end via cajero en esta corrida.
