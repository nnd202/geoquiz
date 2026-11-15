"""Ciel mobile : géométrie du ciel en coordonnées célestes, recalculée par l'app pour un lieu et une heure.

Usage : python3 -I tools/build_sky_geo.py <dossier des sources> <racine du dépôt>
Sources (dossier sky/, projet d3-celestial, licence BSD) :
  constellations.bounds.json, constellations.lines.json, starnames.json, stars.6.json
Sortie : data/ciel-geo.json
  bounds  : code → anneaux [[ad, déc], …] (ascension droite en degrés de -180 à 180, déclinaison),
            les côtés suivent un parallèle ou un méridien : ils sont découpés tous les 2° pour rester courbes
  anchor  : code → [ad, déc], point d'accroche de l'étiquette (centre du plus grand morceau, sur la sphère)
  lines   : tracés des constellations, découpés tous les 3°
  stars   : [ad, déc, magnitude, code ou ""] : étoiles jusqu'à la magnitude 4,5, plus les étoiles nommées des quiz
Les étoiles nommées portent le même code que dans data/etoiles.json et data/etoiles-nav.json.
"""
import json
import math
import os
import sys

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, "sky", name)))
r1 = lambda v: round(v, 1)


def densify(pts, step):
    out = []
    for (a0, d0), (a1, d1) in zip(pts, pts[1:]):
        da = (a1 - a0 + 540) % 360 - 180
        n = max(1, math.ceil(max(abs(da), abs(d1 - d0)) / step))
        for k in range(n):
            a = (a0 + da * k / n + 540) % 360 - 180
            out.append([r1(a), r1(d0 + (d1 - d0) * k / n)])
    a, d = pts[-1]
    out.append([r1((a + 540) % 360 - 180), r1(d)])
    return out


def vec(a, d):
    a, d = math.radians(a), math.radians(d)
    return (math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d))


def center(ring):
    x = y = z = 0
    for a, d in ring:
        vx, vy, vz = vec(a, d)
        x += vx; y += vy; z += vz
    n = math.sqrt(x * x + y * y + z * z) or 1
    return [r1(math.degrees(math.atan2(y, x))), r1(math.degrees(math.asin(z / n)))]


def area(ring):  # aire approchée (pour choisir le plus grand morceau)
    return abs(sum((b[0] - a[0]) * (b[1] + a[1]) * math.cos(math.radians((a[1] + b[1]) / 2)) for a, b in zip(ring, ring[1:])))


bounds, anchor = {}, {}
for f in J("constellations.bounds.json")["features"]:
    ring = densify(f["geometry"]["coordinates"][0], 2)
    bounds.setdefault(f["id"], []).append(ring)
for code, rings in bounds.items():
    anchor[code] = center(max(rings, key=area)[:-1])

lines = []
for f in J("constellations.lines.json")["features"]:
    for seg in f["geometry"]["coordinates"]:
        lines.append(densify(seg, 3))

named = set()
for name in ("etoiles", "etoiles-nav"):
    for it in json.load(open(f"{root}/data/{name}.json"))["items"]:
        named.add(it["code"][2:])
stars = []
for f in J("stars.6.json")["features"]:
    hip, m = str(f["id"]), f["properties"]["mag"]
    if m > 4.5 and hip not in named:
        continue
    a, d = f["geometry"]["coordinates"]
    stars.append([round(a, 2), round(d, 2), round(m, 2), f"s-{hip}" if hip in named else ""])
stars.sort(key=lambda s: -s[2])  # les plus brillantes dessinées en dernier, au-dessus
assert len({s[3] for s in stars if s[3]}) == len(named)

json.dump({"bounds": bounds, "anchor": anchor, "lines": lines, "stars": stars},
          open(f"{root}/data/ciel-geo.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(bounds), "constellations ·", len(lines), "tracés ·", len(stars), "étoiles ·",
      os.path.getsize(f"{root}/data/ciel-geo.json") // 1024, "Ko")
