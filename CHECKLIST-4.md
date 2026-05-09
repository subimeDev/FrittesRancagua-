# CHECKLIST-4 — Flujo de cajero y manejo de errores QR

Todos los comandos asumen el servidor corriendo en `http://localhost:8000`.
Reemplazá `<STAFF_TOKEN>`, `<QR_TOKEN>`, `<SESSION_TOKEN>` con los valores reales.

---

## Setup previo

```bash
# Levantar el backend (desde backend/)
uvicorn app.main:app --reload --port 8000

# Seed de staff demo (solo si la DB está vacía)
python scripts/seed.py
```

---

## 4.1 Login del staff con seed → 200 + staff_token

```bash
curl -s -X POST http://localhost:8000/api/v1/loyalty/staff/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cajero@frittes.com","password":"demo1234"}' | jq .
```

Esperado: `200` con `{ "session_token": "...", "staff": { ... } }`

Guardá el token:
```bash
STAFF_TOKEN="<session_token del response>"
```

---

## 4.2 Accrue con QR válido → 200 + new_balance: 1

Primero obtené un QR token del cliente (necesitás su session token):

```bash
# Obtener QR del cliente
QR_TOKEN=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE>" | jq -r .token)

# Acumular sello
curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$QR_TOKEN\"}" | jq .
```

Esperado: `200` con `{ "kind": "accrual", "new_balance": 1, "customer_name": "..." }`

---

## 4.3 Verificar GET /customers/me muestra stamps: 1

```bash
curl -s http://localhost:8000/api/v1/loyalty/customers/me \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE>" | jq .stamps
```

Esperado: `1`

---

## 4.4 Reusar el MISMO QR → 400 {"code":"qr_replayed",...}

```bash
curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$QR_TOKEN\"}" | jq .
```

Esperado: `400` con `{ "code": "qr_replayed", "message": "qr token already used" }`

---

## 4.5 QR con firma alterada → 400 {"code":"qr_invalid",...}

```bash
# Modificar el último char del token para romper la firma
TAMPERED="${QR_TOKEN%?}X"

curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$TAMPERED\"}" | jq .
```

Esperado: `400` con `{ "code": "qr_invalid", "message": "invalid qr token" }`

---

## 4.6 QR expirado (esperar >90s) → 400 {"code":"qr_expired",...}

```bash
# Obtener un QR fresco
STALE_QR=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE>" | jq -r .token)

# Esperar que expire
sleep 91

curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$STALE_QR\"}" | jq .
```

Esperado: `400` con `{ "code": "qr_expired", "message": "qr token expired" }`

---

## 4.7 Accrue válido inmediatamente después de 4.4/4.5/4.6 → 200

Este test valida que el rollback de sesión funcionó correctamente y el server no quedó en estado inconsistente.

```bash
FRESH_QR=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE>" | jq -r .token)

curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$FRESH_QR\"}" | jq .
```

Esperado: `200` con `new_balance` incrementado.
Si devuelve `"A transaction is already begun on this Session."` → el bug persiste.

---

## 4.8 Sumar 10 sellos, intentar accrue 11 → ok, sigue sumando

```bash
# Repetir 10 veces (una por vez, cada iteración necesita QR fresco)
for i in $(seq 1 10); do
  QR=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
    -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE>" | jq -r .token)
  curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
    -H "Authorization: Bearer $STAFF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"qr_token\":\"$QR\"}" | jq .new_balance
done
```

Esperado: balance crece de 1 a 10 (o el valor actual +10). No hay cap en accrual.

---

## 4.9 Redeem con stamps < threshold → 400 {"code":"insufficient_stamps",...}

Con un cliente que tenga 0 stamps:

```bash
QR=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE_SIN_STAMPS>" | jq -r .token)

curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/redeem \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$QR\"}" | jq .
```

Esperado: `400` con `{ "code": "insufficient_stamps", "message": "not enough stamps" }`

---

## 4.10 Redeem con stamps == threshold → 200, balance vuelve a 0, redemptions: 1

Con un cliente que tenga exactamente 10 stamps (threshold):

```bash
QR=$(curl -s http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE_CON_10>" | jq -r .token)

curl -s -X POST http://localhost:8000/api/v1/loyalty/transactions/redeem \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"qr_token\":\"$QR\"}" | jq .
```

Esperado: `200` con `{ "kind": "redeem", "new_balance": 0, ... }`

Verificar:
```bash
curl -s http://localhost:8000/api/v1/loyalty/customers/me \
  -H "Authorization: Bearer <SESSION_TOKEN_CLIENTE_CON_10>" | jq '{stamps,redemptions,lifetime_stamps}'
```

Esperado: `{ "stamps": 0, "redemptions": 1, "lifetime_stamps": <sin cambio> }`

---

## Secuencia crítica de regresión (criterio de done)

Ejecutar en orden sin reiniciar el server:

```
4.4 → 4.5 → 4.6 → 4.7
```

Si 4.7 pasa → bug resuelto.
Si 4.7 falla con `"transaction already begun"` → sesión DB contaminada, bug persiste.
