"""Outils communs de génération de cartes SVG légères (projection, encarts, tracés).

Chaque carte produite suit le même contrat :
- <path class="zone" data-code="…" data-layer="…">  zones jouables ou de décor
- <path class="sub" data-layer="…">                  traits de sous-division (affichés si le quiz le demande)
- <path class="pt <forme> …" data-code="…" data-x data-y d="forme unité"> dans un <g transform="translate(x y)">
  marqueurs (villes, étoiles…) : la forme est dessinée au rayon 1 et mise à l'échelle par le CSS,
  pour garder une taille constante à l'écran quel que soit le zoom
- <rect class="inset-bg">                            fonds d'encarts
Un même code peut apparaître deux fois (carte principale + encart) : les deux réagissent ensemble.
"""
import math


def lcc(lat1, lat2, lat0, lon0):
    """Projection conique conforme de Lambert (unités arbitraires, y vers le bas)."""
    r = math.radians
    p1, p2, p0, l0 = r(lat1), r(lat2), r(lat0), r(lon0)
    n = math.log(math.cos(p1) / math.cos(p2)) / math.log(
        math.tan(math.pi / 4 + p2 / 2) / math.tan(math.pi / 4 + p1 / 2))
    F = math.cos(p1) * math.tan(math.pi / 4 + p1 / 2) ** n / n
    rho0 = F / math.tan(math.pi / 4 + p0 / 2) ** n

    def f(lon, lat):
        rho = F / math.tan(math.pi / 4 + r(lat) / 2) ** n
        t = n * (r(lon) - l0)
        return rho * math.sin(t), -(rho0 - rho * math.cos(t))
    return f


def equi(lat0):
    k = math.cos(math.radians(lat0))
    return lambda lon, lat: (lon * k, -lat)


def rings(geom):
    t = geom["type"]
    if t == "Polygon":
        return list(geom["coordinates"])
    if t == "MultiPolygon":
        return [r for poly in geom["coordinates"] for r in poly]
    if t == "LineString":
        return [geom["coordinates"]]
    if t == "MultiLineString":
        return list(geom["coordinates"])
    return []


def fit(geoms, proj, box, pad=6):
    """Transformation lon/lat → coordonnées SVG qui loge les géométries dans box=(x, y, w, h)."""
    pts = [proj(*c) for g in geoms for ring in rings(g) for c in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    bx, by, bw, bh = box
    s = min((bw - 2 * pad) / (maxx - minx), (bh - 2 * pad) / (maxy - miny))
    ox = bx + (bw - s * (maxx - minx)) / 2 - s * minx
    oy = by + (bh - s * (maxy - miny)) / 2 - s * miny

    def tf(lon, lat):
        x, y = proj(lon, lat)
        return ox + s * x, oy + s * y
    return tf


def _pts(ring, tf, closed):
    out, last = [], None
    for c in ring:
        x, y = tf(c[0], c[1])
        p = (round(x, 1), round(y, 1))
        if p != last:
            out.append(p)
            last = p
    return out


def _area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


def path_d(geom, tf, min_area=0.0):
    """Tracé SVG d'une zone ; les îlots plus petits que min_area (unités SVG²) sont ignorés."""
    parts = []
    for ring in rings(geom):
        pts = _pts(ring, tf, True)
        if len(pts) < 3 or _area(pts) < min_area:
            continue
        parts.append(_rel(pts) + "z")
    return "".join(parts)


def _n(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _rel(pts):
    """Commandes relatives (« l dx dy ») : environ 40 % plus léger que des coordonnées absolues."""
    x0, y0 = pts[0]
    out = [f"M{_n(x0)} {_n(y0)}l"]
    px, py = x0, y0
    seg = []
    for x, y in pts[1:]:
        seg.append(f"{_n(x - px)} {_n(y - py)}")
        px, py = x, y
    return out[0] + " ".join(seg)


def line_d(geom, tf):
    parts = []
    for ring in rings(geom):
        pts = _pts(ring, tf, False)
        if len(pts) >= 2:
            parts.append(_rel(pts))
    return "".join(parts)


def centroid(geom):
    """Centre de gravité du plus grand polygone (lon, lat)."""
    best, best_a = None, -1
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        ring = poly[0]
        a = cx = cy = 0.0
        for i in range(len(ring) - 1):
            x0, y0 = ring[i][:2]
            x1, y1 = ring[i + 1][:2]
            cr = x0 * y1 - x1 * y0
            a += cr
            cx += (x0 + x1) * cr
            cy += (y0 + y1) * cr
        if abs(a) > best_a and a != 0:
            best_a, best = abs(a), (cx / (3 * a), cy / (3 * a))
    return best


def svg_doc(viewbox, insets, body):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">']
    for key, (x, y, w, h) in insets:
        out.append(f'<rect class="inset-bg" data-inset="{key}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="10"/>')
    out.extend(body)
    out.append("</svg>")
    return "\n".join(out) + "\n"


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


# Formes de marqueurs au rayon 1, centrées sur l'origine.
def _star(n=5, inner=0.45):
    import math as m
    pts = []
    for i in range(2 * n):
        r = 1 if i % 2 == 0 else inner
        a = -m.pi / 2 + i * m.pi / n
        pts.append(f"{r * m.cos(a):.3f} {r * m.sin(a):.3f}")
    return "M" + " L".join(pts) + "Z"


SHAPES = {
    "rond": "M-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0z",
    "carre": "M-.82-.82h1.64v1.64h-1.64z",
    "etoile": _star(),
}


def marker(x, y, shape, cls, code=None, extra=""):
    """Marqueur à taille constante à l'écran (voir css .pt)."""
    attr = f' data-code="{code}"' if code else ""
    # Le translate est porté par un <g> : le CSS « transform » du <path> remplacerait sinon l'attribut.
    return (f'<g transform="translate({x:.1f} {y:.1f})"><path class="pt {shape} {cls}"{attr} '
            f'data-x="{x:.1f}" data-y="{y:.1f}" d="{SHAPES[shape]}"{extra}/></g>')
