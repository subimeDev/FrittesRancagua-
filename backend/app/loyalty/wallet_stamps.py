"""Imagen dinámica de estampillas para el `heroImage` del pase de Google Wallet.

Google Wallet no tiene una grilla de sellos nativa: el layout del pase es fijo
(logo, color, filas de texto, QR). El único lienzo libre es el `heroImage`, un
banner de 1032×336 que se puede setear POR OBJETO (por cliente). Acá lo usamos
para dibujar la grilla de estampillas con el branding del tenant — el mismo
`stamp_icon`, colores y template que la tarjeta de la PWA — así el pase de
Wallet se ve "de la marca" y muestra el progreso real del cliente.

Render con Pillow (sin fuentes: solo primitivas vectoriales — los containers
de Railway no traen TTFs y el texto ya lo muestran los campos nativos del
pase). Los iconos son aproximaciones geométricas de los lucide del frontend
(`frontends/pos/components/card-templates.ts:STAMP_ICONS`); si llega un id
desconocido caemos a estrella, igual que `stampIconById`.

La URL del PNG lleva:
- `?v=` — versión derivada de (sellos, threshold, branding): Google cachea las
  imágenes por URL exacta, así que cada sello nuevo = URL nueva = re-fetch
  (misma lección del logo, ver commit 9a8e15e).
- `&t=` — firma HMAC sobre (restaurant_id, customer_id) con el JWT_SECRET:
  el endpoint es público (Google fetchea sin headers) y sin la firma cualquiera
  podría enumerar cuántos sellos tiene un cliente arbitrario.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import math

from app.config import get_settings

logger = logging.getLogger(__name__)

# Branding fijo de Frittes Maison (single-tenant — espejo de
# frontends/frittes-loyalty/lib/branding.ts:brandingToCssVars).
FRITTES_PRIMARY = "#FFD23F"      # mustard: sellos llenos
FRITTES_SECONDARY = "#6B6660"    # ink-muted: contorno de sellos vacíos
FRITTES_ACCENT = "#E55934"       # ember: hitos de premio
FRITTES_BACKGROUND = "#FBF8F1"   # cream-elev: fondo del banner
FRITTES_STAMP_ICON = "star"
FRITTES_TEMPLATE = "classic"     # layout "band" (banda mostaza superior)

# Tamaño recomendado por Google para heroImage (ratio 3.3:1).
WIDTH, HEIGHT = 1032, 336

# Tope de casilleros dibujables — alineado con el máximo que valida el backend
# (50 sellos por premio, ver admin_router.update_tiers). La grilla escala de 1
# a 4 filas según el total; a 4 filas los círculos quedan de ~28px, legibles.
# Si algún día sube la validación, el excedente se trunca SOLO visualmente (con
# warning) — el número exacto lo muestran los campos nativos del pase.
MAX_SLOTS = 50

# Espejo de CARD_TEMPLATES del POS: cada template del wizard tiene un layout
# visual. Acá solo tomamos el rasgo dibujable en un banner (banda superior,
# hairline, patrón). Template desconocido → "band", el más neutro.
_LAYOUT_BY_TEMPLATE = {
    "classic": "band",
    "minimal": "minimal",
    "vivid": "hero",
    "crimson": "band",
    "monogram": "monogram",
    "noir": "noir",
}


# ─── Firma y versionado de la URL ─────────────────────────────────────────────


def _signature_with(secret: str, restaurant_id: str, customer_id: str) -> str:
    msg = f"wallet-stamps:{restaurant_id}:{customer_id}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()[:16]


def stamps_url_signature(restaurant_id: str, customer_id: str) -> str:
    """Firma corta para la URL pública del PNG. Firmada con el secret primario."""
    secret = get_settings().jwt_secret or ""
    return _signature_with(secret, restaurant_id, customer_id)


def verify_stamps_signature(restaurant_id: str, customer_id: str, sig: str) -> bool:
    if not sig:
        return False
    secret = get_settings().jwt_secret or ""
    return hmac.compare_digest(_signature_with(secret, restaurant_id, customer_id), sig)


def stamps_image_version(
    *,
    stamps: int,
    threshold: int,
    milestones: list[int] | None = None,
) -> str:
    """Cache-buster: cambia cuando cambian los sellos o la escalera de
    premios, así Google re-baja la imagen exactamente cuando hay algo nuevo
    que mostrar. (El branding de Frittes es fijo, no entra en la versión.)"""
    parts = "|".join(
        [
            str(stamps),
            str(threshold),
            ",".join(str(m) for m in (milestones or [])),
        ]
    )
    digest = hashlib.sha1(parts.encode("utf-8")).hexdigest()[:8]
    return f"{stamps}-{threshold}-{digest}"


# ─── Colores ──────────────────────────────────────────────────────────────────


def _hex_rgb(value: str | None, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    s = (value or "").strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        return fallback
    try:
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
    except ValueError:
        return fallback


def _luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


# ─── Iconos (aproximaciones geométricas de los lucide del frontend) ──────────
# Cada drawer recibe el ImageDraw del layer RGBA, el centro, el radio útil del
# icono, `fill` (color del icono) y `hole` (color "de fondo" para perforar
# detalles: chips de la galleta, cinta del regalo…).


def _star_pts(cx: float, cy: float, outer: float, inner: float, n: int = 5) -> list:
    pts = []
    for i in range(n * 2):
        ang = -math.pi / 2 + i * math.pi / n
        rad = outer if i % 2 == 0 else inner
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def _circle(d, cx: float, cy: float, rad: float, **kw) -> None:
    d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), **kw)


def _d_star(d, cx, cy, r, fill, hole):
    d.polygon(_star_pts(cx, cy, r, r * 0.45), fill=fill)


def _d_sparkles(d, cx, cy, r, fill, hole):
    d.polygon(_star_pts(cx, cy, r, r * 0.22, n=4), fill=fill)
    d.polygon(_star_pts(cx + r * 0.62, cy - r * 0.62, r * 0.34, r * 0.1, n=4), fill=fill)


def _d_heart(d, cx, cy, r, fill, hole):
    _circle(d, cx - r * 0.38, cy - r * 0.3, r * 0.45, fill=fill)
    _circle(d, cx + r * 0.38, cy - r * 0.3, r * 0.45, fill=fill)
    d.polygon(
        [(cx - r * 0.8, cy - r * 0.05), (cx + r * 0.8, cy - r * 0.05), (cx, cy + r * 0.88)],
        fill=fill,
    )


def _d_diamond(d, cx, cy, r, fill, hole):
    d.polygon(
        [(cx, cy - r), (cx + r * 0.72, cy), (cx, cy + r), (cx - r * 0.72, cy)], fill=fill
    )


def _d_gem(d, cx, cy, r, fill, hole):
    d.polygon(
        [
            (cx - r * 0.52, cy - r * 0.72),
            (cx + r * 0.52, cy - r * 0.72),
            (cx + r * 0.92, cy - r * 0.18),
            (cx, cy + r * 0.85),
            (cx - r * 0.92, cy - r * 0.18),
        ],
        fill=fill,
    )


def _d_crown(d, cx, cy, r, fill, hole):
    d.polygon(
        [
            (cx - r * 0.85, cy - r * 0.5),
            (cx - r * 0.38, cy - r * 0.08),
            (cx, cy - r * 0.78),
            (cx + r * 0.38, cy - r * 0.08),
            (cx + r * 0.85, cy - r * 0.5),
            (cx + r * 0.66, cy + r * 0.5),
            (cx - r * 0.66, cy + r * 0.5),
        ],
        fill=fill,
    )


def _d_award(d, cx, cy, r, fill, hole):
    d.polygon(
        [(cx - r * 0.32, cy + r * 0.12), (cx - r * 0.55, cy + r * 0.92), (cx - r * 0.05, cy + r * 0.6)],
        fill=fill,
    )
    d.polygon(
        [(cx + r * 0.32, cy + r * 0.12), (cx + r * 0.55, cy + r * 0.92), (cx + r * 0.05, cy + r * 0.6)],
        fill=fill,
    )
    _circle(d, cx, cy - r * 0.28, r * 0.55, fill=fill)
    _circle(d, cx, cy - r * 0.28, r * 0.24, fill=hole)


def _d_gift(d, cx, cy, r, fill, hole):
    d.rectangle((cx - r * 0.85, cy - r * 0.5, cx + r * 0.85, cy - r * 0.16), fill=fill)
    d.rectangle((cx - r * 0.7, cy - r * 0.16, cx + r * 0.7, cy + r * 0.82), fill=fill)
    # Cinta vertical perforada al color de fondo.
    d.rectangle((cx - r * 0.09, cy - r * 0.5, cx + r * 0.09, cy + r * 0.82), fill=hole)
    _circle(d, cx - r * 0.3, cy - r * 0.68, r * 0.2, fill=fill)
    _circle(d, cx + r * 0.3, cy - r * 0.68, r * 0.2, fill=fill)


def _d_flame(d, cx, cy, r, fill, hole):
    d.ellipse((cx - r * 0.62, cy - r * 0.25, cx + r * 0.62, cy + r * 0.9), fill=fill)
    d.polygon(
        [
            (cx - r * 0.5, cy + r * 0.1),
            (cx - r * 0.12, cy - r * 0.42),
            (cx + r * 0.05, cy - r * 0.95),
            (cx + r * 0.4, cy - r * 0.2),
            (cx + r * 0.55, cy + r * 0.15),
        ],
        fill=fill,
    )


def _d_sun(d, cx, cy, r, fill, hole):
    _circle(d, cx, cy, r * 0.45, fill=fill)
    w = max(3, int(r * 0.14))
    for k in range(8):
        ang = k * math.pi / 4
        d.line(
            (
                cx + r * 0.62 * math.cos(ang),
                cy + r * 0.62 * math.sin(ang),
                cx + r * 0.95 * math.cos(ang),
                cy + r * 0.95 * math.sin(ang),
            ),
            fill=fill,
            width=w,
        )


def _d_leaf(d, cx, cy, r, fill, hole):
    # Elipse rotada -45° aproximada con polígono paramétrico (PIL no rota
    # elipses nativamente).
    a, b, rot = r * 0.95, r * 0.5, -math.pi / 4
    pts = []
    for i in range(40):
        t = 2 * math.pi * i / 40
        x, y = a * math.cos(t), b * math.sin(t)
        pts.append(
            (cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot))
        )
    d.polygon(pts, fill=fill)


def _d_flower(d, cx, cy, r, fill, hole, petals: int = 6, petal_r: float = 0.36, dist: float = 0.55):
    for k in range(petals):
        ang = k * 2 * math.pi / petals
        _circle(d, cx + r * dist * math.cos(ang), cy + r * dist * math.sin(ang), r * petal_r, fill=fill)
    _circle(d, cx, cy, r * 0.3, fill=fill)
    _circle(d, cx, cy, r * 0.14, fill=hole)


def _d_flower2(d, cx, cy, r, fill, hole):
    _d_flower(d, cx, cy, r, fill, hole, petals=4, petal_r=0.45, dist=0.48)


def _d_cherry(d, cx, cy, r, fill, hole):
    w = max(3, int(r * 0.1))
    d.line((cx - r * 0.38, cy + r * 0.2, cx + r * 0.15, cy - r * 0.85), fill=fill, width=w)
    d.line((cx + r * 0.42, cy + r * 0.1, cx + r * 0.18, cy - r * 0.85), fill=fill, width=w)
    _circle(d, cx - r * 0.38, cy + r * 0.45, r * 0.34, fill=fill)
    _circle(d, cx + r * 0.42, cy + r * 0.38, r * 0.34, fill=fill)


def _d_coffee(d, cx, cy, r, fill, hole):
    w = max(3, int(r * 0.12))
    d.ellipse((cx + r * 0.25, cy - r * 0.12, cx + r * 0.85, cy + r * 0.42), outline=fill, width=w)
    d.rounded_rectangle(
        (cx - r * 0.7, cy - r * 0.35, cx + r * 0.42, cy + r * 0.62), radius=r * 0.16, fill=fill
    )
    thin = max(2, int(r * 0.09))
    d.line((cx - r * 0.4, cy - r * 0.85, cx - r * 0.4, cy - r * 0.52), fill=fill, width=thin)
    d.line((cx - r * 0.05, cy - r * 0.9, cx - r * 0.05, cy - r * 0.52), fill=fill, width=thin)


def _d_cookie(d, cx, cy, r, fill, hole):
    _circle(d, cx, cy, r * 0.85, fill=fill)
    for ox, oy in ((-0.3, -0.25), (0.25, -0.35), (0.0, 0.1), (-0.35, 0.3), (0.3, 0.3)):
        _circle(d, cx + r * ox, cy + r * oy, r * 0.13, fill=hole)


def _d_pizza(d, cx, cy, r, fill, hole):
    d.polygon(
        [(cx - r * 0.78, cy - r * 0.5), (cx + r * 0.78, cy - r * 0.5), (cx, cy + r * 0.92)],
        fill=fill,
    )
    for ox, oy in ((-0.25, -0.18), (0.25, -0.22), (0.0, 0.22)):
        _circle(d, cx + r * ox, cy + r * oy, r * 0.12, fill=hole)


def _d_wine(d, cx, cy, r, fill, hole):
    w = max(3, int(r * 0.12))
    d.pieslice((cx - r * 0.55, cy - r * 0.95, cx + r * 0.55, cy + r * 0.15), 0, 180, fill=fill)
    d.line((cx, cy + r * 0.05, cx, cy + r * 0.62), fill=fill, width=w)
    d.line((cx - r * 0.38, cy + r * 0.68, cx + r * 0.38, cy + r * 0.68), fill=fill, width=w)


_ICON_DRAWERS = {
    "star": _d_star,
    "heart": _d_heart,
    "sparkles": _d_sparkles,
    "diamond": _d_diamond,
    "gem": _d_gem,
    "crown": _d_crown,
    "award": _d_award,
    "gift": _d_gift,
    "flame": _d_flame,
    "sun": _d_sun,
    "leaf": _d_leaf,
    "flower": _d_flower,
    "flower2": _d_flower2,
    "cherry": _d_cherry,
    "coffee": _d_coffee,
    "cookie": _d_cookie,
    "pizza": _d_pizza,
    "wine": _d_wine,
}


def _draw_icon(d, icon_id: str | None, cx: float, cy: float, r: float, fill, hole) -> None:
    drawer = _ICON_DRAWERS.get(icon_id or "star", _d_star)
    drawer(d, cx, cy, r, fill, hole)


# ─── Render principal ─────────────────────────────────────────────────────────


def render_stamps_png(
    *,
    stamps: int,
    threshold: int,
    primary_color: str | None,
    secondary_color: str | None,
    accent_color: str | None,
    background_color: str | None,
    stamp_icon: str | None,
    card_template: str | None,
    milestones: list[int] | None = None,
) -> bytes:
    """Dibuja la grilla de estampillas (1032×336) y devuelve los bytes PNG.

    `threshold` es el TOPE de la escalera (el último premio configurado) y
    `milestones` las posiciones de cada premio dentro de ella. Los casilleros
    de premio se dibujan con icono de regalo en el accent del tenant: alcanzado
    = "premio listo" (relleno accent + anillo); pendiente = contorno accent.
    Así la grilla muestra el mapa COMPLETO de premios y nunca se re-escala al
    cruzar un hito (lo que antes parecía un "reinicio" de la tarjeta).

    CPU-bound puro (sin I/O): el llamador async debe envolverlo en
    `asyncio.to_thread` para no congelar el event loop.
    """
    import io

    from PIL import Image, ImageDraw

    if threshold > MAX_SLOTS:
        logger.warning(
            "stamps render truncado: threshold=%s > MAX_SLOTS=%s "
            "(el saldo exacto lo muestran los campos de texto del pase)",
            threshold,
            MAX_SLOTS,
        )
    n = max(1, min(int(threshold), MAX_SLOTS))
    filled = max(0, min(int(stamps), n))
    # Posiciones (1-based) de los premios dentro de la grilla visible.
    milestone_set = {int(m) for m in (milestones or []) if 1 <= int(m) <= n}

    bg = _hex_rgb(background_color, (255, 255, 255))
    pri = _hex_rgb(primary_color, (31, 41, 55))
    sec = _hex_rgb(secondary_color, (107, 114, 128))
    acc = _hex_rgb(accent_color, (59, 130, 246))
    # Tinta del icono sobre el círculo lleno: contraste por luminancia.
    ink = (17, 24, 39, 255) if _luminance(pri) > 0.62 else (255, 255, 255, 255)
    acc_ink = (17, 24, 39, 255) if _luminance(acc) > 0.62 else (255, 255, 255, 255)

    img = Image.new("RGB", (WIDTH, HEIGHT), bg)
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    layout = _LAYOUT_BY_TEMPLATE.get(card_template or "", "band")
    top = 0
    if layout == "monogram":
        # Patrón sutil del icono repetido tras la grilla, como en la PWA.
        for row_i, py in enumerate(range(28, HEIGHT, 96)):
            for px in range(36 + (48 if row_i % 2 else 0), WIDTH, 110):
                _draw_icon(d, stamp_icon, px, py, 20, sec + (16,), (0, 0, 0, 0))
    elif layout == "band":
        d.rectangle((0, 0, WIDTH, 18), fill=pri + (255,))
        top = 18
    elif layout == "hero":
        # Banda con gradiente horizontal primary→accent.
        for x in range(0, WIDTH, 4):
            f = x / WIDTH
            color = tuple(int(pri[i] + (acc[i] - pri[i]) * f) for i in range(3))
            d.rectangle((x, 0, x + 4, 18), fill=color + (255,))
        top = 18
    elif layout in ("minimal", "noir"):
        d.rectangle((0, 0, WIDTH, 5), fill=acc + (255,))
        top = 5

    # Grilla adaptativa: 1 fila hasta 8 casilleros, 2 hasta 24, 3 hasta 36 y 4
    # hasta MAX_SLOTS (50) — cubre el rango completo que valida el backend sin
    # truncar. Cada fila se centra por separado (la última puede ir incompleta).
    if n <= 8:
        rows = 1
    elif n <= 24:
        rows = 2
    elif n <= 36:
        rows = 3
    else:
        rows = 4
    cols = math.ceil(n / rows)
    margin_x, margin_y = 56, 30
    avail_w = WIDTH - 2 * margin_x
    avail_h = HEIGHT - top - 2 * margin_y
    cell_w = avail_w / cols
    cell_h = avail_h / rows
    radius = min(min(cell_w, cell_h) * 0.42, 64.0)

    idx = 0
    for row in range(rows):
        row_items = min(cols, n - row * cols)
        row_off = (avail_w - row_items * cell_w) / 2
        for col in range(row_items):
            cx = margin_x + row_off + (col + 0.5) * cell_w
            cy = top + margin_y + (row + 0.5) * cell_h
            pos = idx + 1  # posición 1-based, comparable con stamps_required
            is_milestone = pos in milestone_set
            if is_milestone and pos <= filled:
                # Premio alcanzado y canjeable AHORA (el saldo descuenta al
                # canjear, así que todo hito ≤ sellos está disponible):
                # relleno accent + anillo exterior = "ven a canjear".
                ring_w = max(3, int(radius * 0.09))
                _circle(d, cx, cy, radius, fill=acc + (255,))
                _circle(d, cx, cy, radius * 1.16, outline=acc + (255,), width=ring_w)
                _draw_icon(d, "gift", cx, cy, radius * 0.58, acc_ink, acc + (255,))
            elif is_milestone:
                # Premio pendiente: contorno accent con el regalo marcado —
                # el cliente ve DÓNDE están los premios en el camino.
                _circle(
                    d, cx, cy, radius,
                    outline=acc + (210,), width=max(3, int(radius * 0.09)),
                )
                _draw_icon(d, "gift", cx, cy, radius * 0.58, acc + (130,), bg + (255,))
            elif idx < filled:
                _circle(d, cx, cy, radius, fill=pri + (255,))
                _draw_icon(d, stamp_icon, cx, cy, radius * 0.6, ink, pri + (255,))
            else:
                _circle(
                    d, cx, cy, radius,
                    outline=sec + (150,), width=max(3, int(radius * 0.09)),
                )
                _draw_icon(d, stamp_icon, cx, cy, radius * 0.6, sec + (70,), bg + (255,))
            idx += 1

    img.paste(layer, (0, 0), layer)
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def render_frittes_stamps(
    *,
    stamps: int,
    threshold: int,
    milestones: list[int] | None = None,
) -> bytes:
    """Azúcar: render con el branding fijo de Frittes Maison."""
    return render_stamps_png(
        stamps=stamps,
        threshold=threshold,
        primary_color=FRITTES_PRIMARY,
        secondary_color=FRITTES_SECONDARY,
        accent_color=FRITTES_ACCENT,
        background_color=FRITTES_BACKGROUND,
        stamp_icon=FRITTES_STAMP_ICON,
        card_template=FRITTES_TEMPLATE,
        milestones=milestones,
    )
