"""Hérault : communes, cours d'eau, sommets, étangs et sites, sur une carte du département.

Usage : python3 -I tools/build_herault.py <dossier des sources> <racine du dépôt>
Sources :
  communes-arr.geojson (france-geojson, voir build_france.py) : contour du département et des voisins
  npm/node_modules/@etalab/decoupage-administratif/data/communes.json : codes INSEE et populations
  osm34/export.geojson : cours d'eau, étangs et sommets, © contributeurs OpenStreetMap (ODbL),
    export Overpass (requête dans le README)
"""
import json
import os
import sys

from shapely.geometry import shape, mapping, box, Point
from shapely.ops import unary_union, linemerge

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import lcc, fit, path_d, line_d, svg_doc, marker  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))

# ---------- Contours : Hérault et morceaux des départements voisins ----------
comm = J("communes-arr.geojson")["features"]
dep_parts = {}
for f in comm:
    d = f["properties"]["dep"]
    if d in ("34", "11", "12", "30", "81"):
        dep_parts.setdefault(d, []).append(shape(f["geometry"]).buffer(0))
herault = unary_union(dep_parts.pop("34"))
x0, y0, x1, y1 = herault.bounds
frame = box(x0 - 0.06, y0 - 0.05, x1 + 0.06, y1 + 0.05)
voisins = {d: unary_union(p).intersection(frame) for d, p in dep_parts.items()}

W, H = 1000, 720
tf = fit([mapping(frame)], lcc(43, 44, 43.6, 3.4), (0, 0, W, H), pad=0)

# ---------- Éléments ----------
etalab = {c["nom"]: c for c in J("npm/node_modules/@etalab/decoupage-administratif/data/communes.json")
          if c.get("departement") == "34" and c.get("type") == "commune-actuelle"}
TOWNS = {  # centre-ville (lon, lat)
    "Montpellier": (3.8767, 43.6108), "Béziers": (3.2158, 43.3442), "Sète": (3.6976, 43.4028),
    "Agde": (3.4753, 43.3108), "Lunel": (4.1361, 43.6756), "Frontignan": (3.7556, 43.4483),
    "Castelnau-le-Lez": (3.9008, 43.6336), "Lattes": (3.9036, 43.5675), "Mauguio": (3.9667, 43.6167),
    "Mèze": (3.6053, 43.4256), "Pézenas": (3.4233, 43.4592), "Lodève": (3.3194, 43.7317),
    "Clermont-l'Hérault": (3.4317, 43.6275), "Ganges": (3.7086, 43.9339),
    "Saint-Pons-de-Thomières": (2.7656, 43.4894), "Bédarieux": (3.1556, 43.6156), "Gignac": (3.5508, 43.6522),
    "Marseillan": (3.5281, 43.3569), "Palavas-les-Flots": (3.9333, 43.5283), "La Grande-Motte": (4.0847, 43.5614),
    "Pérols": (3.9528, 43.5650), "Olonzac": (2.7314, 43.2828), "Saint-Martin-de-Londres": (3.7314, 43.7900),
    "Villeneuve-lès-Maguelone": (3.8606, 43.5328), "Sérignan": (3.2783, 43.2817), "Valras-Plage": (3.2908, 43.2481),
    "Capestang": (3.0442, 43.3283), "Saint-Chinian": (2.9472, 43.4222), "Lamalou-les-Bains": (3.0808, 43.5975),
    "Balaruc-les-Bains": (3.6778, 43.4417),
}
TOWN_ALIAS = {"Saint-Pons-de-Thomières": ["Saint-Pons"], "Castelnau-le-Lez": ["Castelnau"],
              "Palavas-les-Flots": ["Palavas"], "Villeneuve-lès-Maguelone": ["Villeneuve-les-Maguelone"],
              "Clermont-l'Hérault": ["Clermont"], "Lamalou-les-Bains": ["Lamalou"], "Balaruc-les-Bains": ["Balaruc"]}
RIVERS = {  # nom → nom OpenStreetMap
    "Hérault": "L'Hérault", "Orb": "L'Orb", "Lez": "Le Lez", "Vidourle": "Le Vidourle", "Lergue": "La Lergue",
    "Jaur": "Le Jaur", "Vis": "La Vis", "Libron": "Le Libron", "Mosson": "La Mosson", "Agoût": "L'Agoût",
}
RIVER_ALIAS = {"Agoût": ["Agout"]}
PEAKS = {  # nom → nom OpenStreetMap (le Caroux culmine au lieu-dit « La Tour »)
    "Pic Saint-Loup": "Pic Saint-Loup", "Montagne de l'Hortus": "Montagne d'Hortus",
    "Montagne de la Séranne": "Montagne de la Séranne", "Mont Saint-Baudille": "Mont Saint-Baudille",
    "Mont Caroux": "La Tour", "Sommet de l'Espinouse": "Sommet de l'Espinouse",
    "Mont Saint-Clair": "Mont Saint-Clair", "Pic de Vissou": "Pic de Vissou",
}
PEAK_ALIAS = {"Montagne de l'Hortus": ["Hortus", "Montagne d'Hortus"], "Montagne de la Séranne": ["Séranne"],
              "Mont Caroux": ["Caroux"], "Sommet de l'Espinouse": ["Espinouse", "Mont de l'Espinouse"],
              "Pic Saint-Loup": ["Saint-Loup"], "Mont Saint-Baudille": ["Saint-Baudille"], "Pic de Vissou": ["Vissou"]}
LAKES = {
    "Étang de Thau": ["Étang de Thau"], "Étang de l'Or": ["Étang de l'Or"], "Étang de Vic": ["Étang de Vic"],
    "Étang d'Ingril": ["Étang d'Ingril"], "Étang du Bagnas": ["Étang du Bagnas"], "Étang du Méjean": ["Étang du Méjean"],
}
LAKE_ALIAS = {"Étang de Thau": ["Thau", "Bassin de Thau"], "Étang de l'Or": ["Étang de Mauguio", "Or"],
              "Étang de Vic": ["Vic"], "Étang d'Ingril": ["Ingril"], "Étang du Bagnas": ["Bagnas"], "Étang du Méjean": ["Méjean"]}
SITES = {  # (lon, lat) ou None pour une zone OpenStreetMap
    "Saint-Guilhem-le-Désert": (3.5497, 43.7339), "Pont du Diable": (3.5567, 43.7113),
    "Grotte de Clamouse": (3.5589, 43.7096), "Minerve": (2.7461, 43.3544),
    "Cirque de Navacelles": (3.5113, 43.8869), "Lac du Salagou": None,
}
SITE_ALIAS = {"Saint-Guilhem-le-Désert": ["Saint-Guilhem"], "Lac du Salagou": ["Salagou"],
              "Cirque de Navacelles": ["Navacelles"], "Grotte de Clamouse": ["Clamouse"]}

osm = J("osm34/export.geojson")["features"]
by_name = {}
for f in osm:
    n = f["properties"].get("name")
    if n:
        by_name.setdefault(n, []).append(f)

items, zones, lines, hits, pts = [], [], [], [], {"villes": [], "sommets": [], "sites": []}


def add(code, nom, alias, cat, detail, geo):
    items.append({"code": code, "nom": nom, "alias": [a for a in alias if a != nom], "domaine": cat,
                  "categorie": cat, "geo": [round(geo[0], 4), round(geo[1], 4)], "detail": detail})


for nom, (lon, lat) in TOWNS.items():
    c = etalab[nom]
    assert herault.contains(Point(lon, lat)), nom
    pop = f"{c['population']:,}".replace(",", " ")
    add(f"hv-{c['code']}", nom, TOWN_ALIAS.get(nom, []), "ville", f"Commune · {pop} hab.", (lon, lat))
    pts["villes"].append(marker(*tf(lon, lat), "rond", "ville", f"hv-{c['code']}"))

for i, (nom, on) in enumerate(RIVERS.items()):
    g = unary_union([shape(f["geometry"]) for f in by_name[on] if f["properties"].get("waterway") == "river"])
    g = g.intersection(frame)
    g = (linemerge(g) if g.geom_type == "MultiLineString" else g).simplify(0.0008)
    code = f"hr-{i + 1:02d}"
    mid = (g if g.geom_type == "LineString" else max(g.geoms, key=lambda x: x.length)).interpolate(0.5, normalized=True)
    add(code, nom, RIVER_ALIAS.get(nom, []), "fleuve", "Cours d'eau", (mid.x, mid.y))
    d = line_d(mapping(g), tf)
    lines.append(f'<path class="riv" data-code="{code}" d="{d}"/>')
    hits.append(f'<path class="riv-hit" data-code="{code}" d="{d}"/>')

for i, (nom, on) in enumerate(PEAKS.items()):
    f = next(f for f in by_name[on] if f["properties"].get("natural") == "peak" and herault.buffer(0.01).contains(shape(f["geometry"])))
    lon, lat = f["geometry"]["coordinates"]
    ele = f["properties"].get("ele")
    code = f"hs-{i + 1:02d}"
    add(code, nom, PEAK_ALIAS.get(nom, []), "relief", f"Sommet · {round(float(ele))} m" if ele else "Relief", (lon, lat))
    pts["sommets"].append(marker(*tf(lon, lat), "triangle", "som", code))


def water(names):
    return unary_union([shape(f["geometry"]).buffer(0) for n in names for f in by_name[n]
                        if f["properties"].get("natural") == "water"])


for i, (nom, names) in enumerate(LAKES.items()):
    g = water(names)
    code = f"he-{i + 1:02d}"
    c = g.representative_point()
    add(code, nom, LAKE_ALIAS.get(nom, []), "etang", "Étang littoral", (c.x, c.y))
    zones.append(f'<path class="zone lake-z" data-code="{code}" d="{path_d(mapping(g.simplify(0.0004)), tf, 0)}"/>')

for i, (nom, xy) in enumerate(SITES.items()):
    code = f"hl-{i + 1:02d}"
    if xy is None:
        g = water([nom])
        c = g.representative_point()
        add(code, nom, SITE_ALIAS.get(nom, []), "site", "Lac de barrage", (c.x, c.y))
        zones.append(f'<path class="zone lake-z" data-code="{code}" d="{path_d(mapping(g.simplify(0.0004)), tf, 0)}"/>')
    else:
        add(code, nom, SITE_ALIAS.get(nom, []), "site", "Site", xy)
        pts["sites"].append(marker(*tf(*xy), "etoile", "site", code))

body = ['<g data-layer="terres">']
for d, g in voisins.items():
    body.append(f'<path class="land nb" d="{path_d(mapping(g.simplify(0.0008)), tf, 0.5)}"/>')
body.append(f'<path class="land dep34" d="{path_d(mapping(herault.simplify(0.0005)), tf, 0.5)}"/>')
body.append('</g><g data-layer="eaux">' + "".join(zones) + "</g>")
body.append('<g data-layer="cours">' + "".join(lines) + "</g>")
body.append('<g data-layer="cours-toucher">' + "".join(hits) + "</g>")
for k, v in pts.items():
    body.append(f'<g data-layer="{k}">' + "".join(v) + "</g>")
open(f"{root}/maps/herault.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], body))
json.dump({"id": "herault", "titre": "Hérault", "items": items},
          open(f"{root}/data/herault.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "éléments ·", os.path.getsize(f"{root}/maps/herault.svg") // 1024, "Ko")
