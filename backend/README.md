# Frittes Loyalty Backend (FastAPI)

Backend funcional para Frittes Maison, listo para correr local y conectar con `frontends/frittes-loyalty`.

## Requisitos

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) recomendado (o `pip`)

## Instalacion

### Opcion A: uv

```bash
cd backend
uv sync
```

### Opcion B: pip

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
```

## Configuracion

1. Copia `.env.example` a `.env` (opcional en dev, se autogenera secret en `.env.local` si falta JWT_SECRET).
2. Variables clave:
   - `APP_ENV=dev|prod`
   - `DATABASE_URL=sqlite+aiosqlite:///./data/app.db`
   - `JWT_SECRET` (min 32 chars, requerido en prod)
   - `SESSION_TTL_MINUTES=602430`
   - `QR_TTL_SECONDS=90`
   - `RESTAURANT_ID=frittes-maison`

## Migraciones

```bash
cd backend
uv run alembic upgrade head
```

## Seed inicial (staff demo)

```bash
cd backend
uv run python -m scripts.seed
```

Credenciales dev:
- email: `cajero@frittes.cl`
- password: `cajero123`

## Correr server

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Swagger: `http://localhost:8000/docs`

## Endpoints principales

- `POST /api/v1/loyalty/customers`
  - body: `{"name":"Ana","phone":"+56912345678","email":"ana@mail.com"}`
  - response: `{"session_token":"...","customer":{...}}`
- `POST /api/v1/loyalty/auth/dev-login` (solo dev)
- `GET /api/v1/loyalty/customers/me` (Bearer session token)
- `POST /api/v1/loyalty/auth/sign-out`
- `GET /api/v1/loyalty/qr-tokens`
- `POST /api/v1/loyalty/staff/auth/login`
- `POST /api/v1/loyalty/transactions/accrue`
- `POST /api/v1/loyalty/transactions/redeem`

Compatibilidad adicional con frontend actual:
- `POST /api/v1/loyalty/auth/request-otp` (mock OTP dev: `123456`)
- `POST /api/v1/loyalty/auth/verify-otp`

## Curl examples

Registro cliente:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/customers \
  -H "Content-Type: application/json" \
  -H "X-Restaurant-Id: frittes-maison" \
  -d '{"name":"Ana","phone":"+56912345678"}'
```

Ver cliente autenticado:

```bash
curl http://localhost:8000/api/v1/loyalty/customers/me \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -H "X-Restaurant-Id: frittes-maison"
```

Pedir QR token:

```bash
curl http://localhost:8000/api/v1/loyalty/qr-tokens \
  -H "Authorization: Bearer <SESSION_TOKEN>" \
  -H "X-Restaurant-Id: frittes-maison"
```

Login staff:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/staff/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Restaurant-Id: frittes-maison" \
  -d '{"email":"cajero@frittes.cl","password":"cajero123"}'
```

Acumular sello:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/transactions/accrue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STAFF_TOKEN>" \
  -H "X-Restaurant-Id: frittes-maison" \
  -d '{"qr_token":"<QR_TOKEN>"}'
```

Canjear:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/transactions/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STAFF_TOKEN>" \
  -H "X-Restaurant-Id: frittes-maison" \
  -d '{"qr_token":"<QR_TOKEN>"}'
```

## Test end-to-end con `frittes-loyalty`

1. Levantar backend en `:8000`.
2. En `frontends/frittes-loyalty/.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
3. Levantar frontend en `:3001`.
4. Flujo:
   - Registrar/login cliente.
   - Obtener `qr_token` desde `GET /loyalty/qr-tokens`.
   - Login staff.
   - Hacer `POST /transactions/accrue` y confirmar que sube `stamps`.
   - Reusar mismo `qr_token` debe fallar con `400` + `"token already used"`.
