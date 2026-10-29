"""Carte du ciel : les deux hémisphères côte à côte, 88 constellations et leurs étoiles les plus brillantes.

Usage : python3 -I tools/build_sky.py <dossier des sources> <racine du dépôt>
Sources (dossier sky/, projet d3-celestial, licence BSD) :
  constellations.json, constellations.bounds.json, constellations.lines.json, starnames.json, stars.6.json
Projection : azimutale équidistante centrée sur chaque pôle céleste, de l'horizon de l'équateur au pôle.
Vu du sol : ascension droite croissante dans le sens inverse des aiguilles d'une montre au nord, dans le sens
des aiguilles au sud.
"""
import json
import math
import os
import sys

from shapely.geometry import Polygon, LineString, Point, MultiPolygon, MultiLineString
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import marker, svg_doc, _rel  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, "sky", name)))

W, H = 1000, 540
R = 238
CENTERS = {"N": (255, 260), "S": (745, 260)}
DISK = Point(0, 0).buffer(R, 256)


def proj(hemi, lon, lat):
    """Coordonnées relatives au centre du disque (y vers le bas)."""
    r = (90 - lat if hemi == "N" else 90 + lat) / 90 * R
    a = math.radians(lon)
    return (r * math.sin(a), r * math.cos(a)) if hemi == "N" else (-r * math.sin(a), r * math.cos(a))


def densify(ring, step=1.0):
    out = []
    for (lo0, la0), (lo1, la1) in zip(ring, ring[1:]):
        d = (lo1 - lo0 + 540) % 360 - 180
        n = max(1, int(max(abs(d), abs(la1 - la0)) / step))
        for k in range(n):
            out.append((lo0 + d * k / n, la0 + (la1 - la0) * k / n))
    out.append(ring[-1])
    return out


def shift(geom, hemi):
    cx, cy = CENTERS[hemi]
    if geom.is_empty:
        return []
    parts = geom.geoms if hasattr(geom, "geoms") else [geom]
    return [[(x + cx, y + cy) for x, y in (p.exterior.coords if isinstance(p, Polygon) else p.coords)] for p in parts
            if not p.is_empty]


def d_of(polys, closed=True):
    s = []
    for pts in polys:
        pts = [(round(x, 1), round(y, 1)) for x, y in pts]
        if len(pts) >= (3 if closed else 2):
            s.append(_rel(pts) + ("z" if closed else ""))
    return "".join(s)


# ---------- Noms français ----------
FR = {  # graphie française usuelle (casse, accents)
    "Ant": "Machine pneumatique", "Aps": "Oiseau de paradis", "CMa": "Grand Chien", "CMi": "Petit Chien",
    "CVn": "Chiens de chasse", "Com": "Chevelure de Bérénice", "CrA": "Couronne australe", "CrB": "Couronne boréale",
    "Cru": "Croix du Sud", "Equ": "Petit Cheval", "Eri": "Éridan", "Hya": "Hydre", "Hyi": "Hydre mâle",
    "LMi": "Petit Lion", "PsA": "Poisson austral", "Sct": "Écu de Sobieski", "TrA": "Triangle austral",
    "UMa": "Grande Ourse", "UMi": "Petite Ourse", "Vol": "Poisson volant", "Vul": "Petit Renard",
}
CON_ALIAS = {"Hya": ["Hydre femelle"], "Sct": ["Écu"], "Cru": ["Croix"], "Oph": ["Serpentaire"]}
STAR_FR = {
    "Altair": ("Altaïr", []), "Vega": ("Véga", []), "Aldebaran": ("Aldébaran", []), "Antares": ("Antarès", []),
    "Alnair": ("Alnaïr", []), "Polaris": ("Étoile polaire", ["Polaris", "Polaire"]), "Regulus": ("Régulus", []),
    "Spica": ("Spica", ["L'Épi"]), "Capella": ("Capella", ["La Chèvre"]), "Labr": ("Labrum", []),
    "Rigil Kentaurus": ("Rigil Kentaurus", ["Alpha du Centaure", "Alpha Centauri"]), "Navi": ("Navi", ["Tiansi"]),
    "Kaus Australis": ("Kaus Australis", []), "Deneb Algedi": ("Deneb Algedi", []),
}
# Noms sans usage reconnu (absents du catalogue de l'UAI) : l'étoile reste affichée, sans être à trouver.
STAR_DROP = {"Men", "Persian", "Mizan"}

cons = {}
for f in J("constellations.json")["features"]:
    p = f["properties"]
    code = f["id"]
    nom = FR.get(code, p["fr"].replace(" ", " "))
    latin = p["name"]
    cons[code] = {"code": code, "nom": nom, "alias": [a for a in [latin, *CON_ALIAS.get(code, [])] if a != nom],
                  "domaine": "ciel", "latin": latin, "genitif": p["gen"]}

# ---------- Étoiles ----------
mag = {}
pos = {}
for f in J("stars.6.json")["features"]:
    mag[str(f["id"])] = f["properties"]["mag"]
    pos[str(f["id"])] = f["geometry"]["coordinates"]
names = J("starnames.json")
best = {}
for hip, v in names.items():
    con = v.get("c")
    if con in cons and hip in mag and (con not in best or mag[hip] < mag[best[con]]):
        best[con] = hip
assert len(best) == 88, len(best)

stars = []
for con, hip in best.items():
    v = names[hip]
    en = v.get("name") or ""
    desig = (v.get("desig") or "") + " " + cons[con]["genitif"]
    cons[con]["etoile"] = en if en and en not in STAR_DROP else desig.strip()
    if not en or en in STAR_DROP:
        continue
    nom, alias = STAR_FR.get(en, (en, []))
    alias = [a for a in [en, *alias] if a != nom]
    stars.append({"code": f"s-{hip}", "nom": nom, "alias": alias, "domaine": "ciel", "con": con,
                  "geo": [round(c, 3) for c in pos[hip]], "mag": mag[hip],
                  "detail": f"{cons[con]['nom']} · magnitude {mag[hip]:.2f}"})
stars.sort(key=lambda s: s["mag"])
named = {s["code"][2:] for s in stars}

# ---------- Frontières des constellations, découpées par hémisphère ----------
body = []
shapes = {}
for f in J("constellations.bounds.json")["features"]:
    code = f["id"]
    ring = f["geometry"]["coordinates"][0]
    lats = [p[1] for p in ring]
    dense = densify(ring)
    for hemi in ("N", "S"):
        if (hemi == "N" and max(lats) <= 0) or (hemi == "S" and min(lats) >= 0):
            continue
        poly = Polygon([proj(hemi, *p) for p in dense]).buffer(0)
        clip = poly.intersection(DISK)
        if clip.area > 1:
            shapes.setdefault((code, hemi), []).append(clip)

for (code, hemi), parts in sorted(shapes.items()):
    geom = unary_union(parts).simplify(0.4)
    pts = shift(geom, hemi)
    extra = f' data-hemi="{hemi}"'
    body.append(f'<path class="zone con" data-code="{code}"{extra} d="{d_of(pts)}"/>')
    c = geom.representative_point()
    cons[code].setdefault("geo", [round(c.x + CENTERS[hemi][0], 1), round(c.y + CENTERS[hemi][1], 1)])
zones = ['<g data-layer="constellations">', *body, '</g>']

# ---------- Tracés des constellations ----------
lines = {"N": [], "S": []}
for f in J("constellations.lines.json")["features"]:
    for seg in f["geometry"]["coordinates"]:
        dense = densify(seg, 2)
        for hemi in ("N", "S"):
            ls = LineString([proj(hemi, *p) for p in dense]).intersection(DISK)
            lines[hemi].extend(shift(ls, hemi))
trace = ['<g data-layer="traces"><path class="sub sky-line" d="' +
         d_of(lines["N"] + lines["S"], closed=False) + '"/></g>']

# ---------- Étoiles : décor jusqu'à la magnitude 4,2, plus les étoiles nommées ----------
def star_radius(m):
    return round(max(0.7, 3.3 - 0.55 * m), 2)


dots = ['<g data-layer="etoiles">']
for hip, m in sorted(mag.items(), key=lambda kv: kv[1], reverse=True):
    if m > 4.2 and hip not in named:
        continue
    lon, lat = pos[hip]
    hemi = "N" if lat >= 0 else "S"
    x, y = proj(hemi, lon, lat)
    cx, cy = CENTERS[hemi]
    code = f"s-{hip}" if hip in named else None
    dots.append(marker(x + cx, y + cy, "rond", "star" + (" named" if code else ""), code, f' style="--r:{star_radius(m)}"'))
dots.append('</g>')

frame = ['<g data-layer="cadre">']
for hemi, label in (("N", "Hémisphère nord"), ("S", "Hémisphère sud")):
    cx, cy = CENTERS[hemi]
    frame.append(f'<circle class="sky-disk" cx="{cx}" cy="{cy}" r="{R}"/>')
    frame.append(f'<text class="sky-lbl" x="{cx}" y="{cy + R + 24}">{label}</text>')
frame.append('</g>')

open(f"{root}/maps/ciel.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], frame + zones + trace + dots))


def dump(name, titre, items):
    json.dump({"id": name, "titre": titre, "items": items},
              open(f"{root}/data/{name}.json", "w"), ensure_ascii=False, indent=1)


con_items = []
for c in sorted(cons.values(), key=lambda c: c["nom"]):
    c["detail"] = f"{c['latin']} · étoile la plus brillante : {c['etoile']}"
    con_items.append({k: c[k] for k in ("code", "nom", "alias", "domaine", "detail")})
dump("constellations", "Les 88 constellations", con_items)
dump("etoiles", "Étoiles les plus brillantes de chaque constellation", stars)
print(len(con_items), "constellations ·", len(stars), "étoiles nommées ·",
      os.path.getsize(f"{root}/maps/ciel.svg"), "octets")
