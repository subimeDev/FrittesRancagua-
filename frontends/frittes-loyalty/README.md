# Frittes Maison — Tarjeta de fidelidad

App standalone, **solo tarjeta de fidelidad** para Frittes Maison.
Vive en `frontends/frittes-loyalty/`, separada de `demo-app/` para
deploy y mantencion independientes.

## Que hay aca

- `/` — flujo unico de tres estados:
  - `loading` → hidrata desde `localStorage`
  - `anonymous` → onboarding con form (nombre, telefono, email opcional)
  - `registered` → pase wallet + acciones (canje, simular sello, cerrar sesion)

- **Pase tipo Apple/Google Wallet**: header amarillo Frittes, logo +
  wordmark, balance de sellos, strip QR. Tap para girar y ver el dorso
  con la grilla de sellos (10 casilleros que se llenan con el logo).

- **Botones oficiales** "Añadir a Apple Wallet" + "Guardar en Google Wallet",
  estilizados al spec de cada plataforma. Hoy son mock — listos para
  conectar al backend (`.pkpass` firmado / Save link de Google Wallet API).

## Stack

- Next.js 15 (App Router)
- React 18
- Tailwind CSS 3.4
- Tipografia: **Bodoni Moda** (display, imita el wordmark FRITTES) +
  **Caveat** (script, imita "maison") + **Plus Jakarta Sans** (body)

## Identidad visual

Extraida del menu impreso 2026 + logo:

- **Negro denso** `#1A1815` para tipografia
- **Amarillo mostaza Frittes** `#FFD23F` como acento principal
- **Crema papel rugoso** `#F5F1E8` para fondo (con textura sutil)
- **Verde Breadgan** `#2D5A3F` para Veggie / vegano
- **Naranja ember** `#E55934` para detalles ocasionales
- Blobs de mostaza en esquinas que replican el menu impreso

## Comandos

```bash
cd frontends/frittes-loyalty
npm install
npm run dev        # http://localhost:3001
```

(Corre en `:3001` para no chocar con `demo-app` en `:3000`).

## Conectar Wallet real (proximo paso)

El frontend ya tiene los hooks listos. Para activar Wallet de verdad:

### Apple Wallet (`.pkpass`)

Backend debe firmar un `.pkpass` con:
- Apple Developer Pass Type ID + certificado
- `pass.json` con campos del tipo `storeCard`:
  - `headerFields`: tier
  - `primaryFields`: balance de sellos (`X / 10`)
  - `secondaryFields`: nombre del titular
  - `auxiliaryFields`: telefono + miembro desde
  - `barcodes`: token QR firmado
- Imagenes: `logo.png`, `icon.png`, `strip.png` (todas @2x y @3x)
- `manifest.json` + `signature` con el cert

Frontend cambia el callback:
```ts
onAppleWallet={() => {
  window.location.href = `/api/v1/passes/apple/${account.id}`;
}}
```

### Google Wallet

Backend genera un Save JWT con la `LoyaltyClass` + `LoyaltyObject` del cliente.

Frontend cambia el callback:
```ts
onGoogleWallet={() => {
  window.location.href = `https://pay.google.com/gp/v/save/${jwt}`;
}}
```

## Persistencia (demo)

Para el demo el cliente vive en `localStorage` con la clave
`frittes-loyalty:account:frittes-maison`. Para reset:

```js
localStorage.removeItem("frittes-loyalty:account:frittes-maison");
```

O usar el boton "Cerrar sesion" arriba a la derecha cuando estas registrado.

## Estructura

```
frittes-loyalty/
├── app/
│   ├── globals.css        # paper texture, blobs, animaciones
│   ├── layout.tsx         # fonts + CSS vars del branding
│   └── page.tsx           # flujo unico (loading / anonymous / registered)
├── components/
│   ├── frittes-mark.tsx   # logo cono SVG inline
│   ├── wallet-pass.tsx    # PIEZA ESTRELLA — el pase wallet
│   ├── qr-pattern.tsx     # QR mock deterministico
│   ├── add-to-wallet.tsx  # botones Apple + Google Wallet
│   └── onboarding.tsx     # form de alta
├── lib/
│   ├── branding.ts        # toda la identidad de Frittes (editable)
│   ├── types.ts
│   └── use-loyalty-account.ts  # hook con localStorage (swappable)
└── public/
    └── frittes-logo.jpg   # logo original (referencia)
```

## Customizar

Para cambiar copy / colores / threshold de sellos / premio: editar
`lib/branding.ts`. Los componentes leen todo de ahi.

Para reusar este mismo proyecto con OTRO restaurante: duplicar la carpeta,
editar `lib/branding.ts` y `lib/use-loyalty-account.ts` (slug del
storageKey), reemplazar el logo en `public/` y opcionalmente reemplazar
el SVG en `components/frittes-mark.tsx`.
