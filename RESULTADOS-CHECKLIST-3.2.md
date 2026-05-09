# Checklist 3.2 - Crear cliente

Fecha de ejecucion: 2026-05-09

## 1) Con header `X-Restaurant-Id`

Comando ejecutado:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/customers \
  -H "Content-Type: application/json" \
  -H "X-Restaurant-Id: frittes-maison" \
  -d '{"name":"Test User","phone":"+56912345678"}'
```

Resultado:

- Status: `200 OK`
- Respuesta incluye `session_token`
- Respuesta incluye `customer.name: "Test User"` (sin `customer_name`)

Respuesta observada (resumen):

```json
{
  "session_token": "eyJhbGc...",
  "customer": {
    "id": "frt_aed28016e73c",
    "name": "Test User",
    "phone": "+56912345678",
    "stamps": 0,
    "threshold": 10
  }
}
```

## 2) Sin header `X-Restaurant-Id`

Comando ejecutado:

```bash
curl -X POST http://localhost:8000/api/v1/loyalty/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Sin Header","phone":"+56999999999"}'
```

Resultado:

- Status: `200 OK`
- Funciona sin header
- Respuesta incluye `session_token`
- Respuesta incluye `customer.name: "Test Sin Header"`

Respuesta observada (resumen):

```json
{
  "session_token": "eyJhbGc...",
  "customer": {
    "id": "frt_48e3827ef165",
    "name": "Test Sin Header",
    "phone": "+56999999999",
    "stamps": 0,
    "threshold": 10
  }
}
```

## Conclusiones

- `POST /api/v1/loyalty/customers` pasa el checklist 3.2.
- El contrato de respuesta ya usa `name` en `customer`.
- No se requirio migracion de DB para este cambio.
