# Pendientes externos antes de prod

## Credenciales y cuentas

- Apple Developer: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, certs (`.pem`) y password.
- Google Wallet: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_CLASS_ID`, service account JSON.
- Sentry DSN (`NEXT_PUBLIC_SENTRY_DSN`).
- Plausible domain (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`).
- Proveedor OTP SMS en Chile y credenciales.

## Infraestructura

- Railway proyecto y servicios separados para `frittes-loyalty` y `frittes-pos`.
- Dominios productivos (`club.frittes.cl`, `pos.frittes.cl` o equivalente).
- Variables de entorno en Railway segun `.env.example`.

## Datos legales pendientes

- RUT del negocio.
- Direccion legal/comercial.
- Email de contacto para derechos de datos personales.

## QA dispositivo real

- Probar Save to Apple Wallet en iOS (simulador + dispositivo real).
- Probar Save to Google Wallet en Android real.
- Probar scanner POS con camara en dispositivo de caja.
