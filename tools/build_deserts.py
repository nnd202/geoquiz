"""Déserts du monde : 40 zones, sur une carte du monde qui descend jusqu'au pôle Sud.

Usage : python3 -I tools/build_deserts.py <dossier des sources> <racine du dépôt>
Sources (Natural Earth, domaine public) :
  regions/ne_10m_geography_regions_polys.geojson (déserts, Grand Bassin, Patagonie, Andes)
  world-countries.geojson (fond de carte et Antarctique)
Le Mojave, absent de la source, est un contour simplifié tracé à la main (ci-dessous).
Noms français vérifiés sur Wikipédia (novembre 2026).
"""
import json
import os
import sys

from shapely.geometry import shape, mapping, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, svg_doc, marker, anchor  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))


from worldproj_full import tf, W, H  # noqa: E402


# ---------- Sources ----------
regions = {}
for f in J("regions/ne_10m_geography_regions_polys.geojson")["features"]:
    p = f["properties"]
    regions.setdefault((p["FEATURECLA"], p["NAME"]), []).append(shape(f["geometry"]).buffer(0))
reg = lambda cla, name: unary_union(regions[(cla, name)])
countries = {f["properties"]["code"]: shape(f["geometry"]).buffer(0) for f in J("world-countries.geojson")["features"]}
land = unary_union(list(countries.values()))

# Mojave : contour simplifié (Tehachapi, Vallée de la Mort, fleuve Colorado, monts San Bernardino)
MOJAVE = Polygon([(-118.7, 34.85), (-118.2, 35.3), (-117.9, 35.8), (-117.4, 36.4), (-116.8, 36.9), (-115.9, 37.0),
                  (-115.0, 36.6), (-114.2, 36.2), (-114.0, 35.4), (-114.3, 34.6), (-114.9, 34.2), (-115.7, 33.9),
                  (-116.6, 34.0), (-117.4, 34.25), (-118.2, 34.55)])
# Patagonie : la région Patagonie de la source, sans les Andes ni ce qui est à l'ouest de leur crête.
ANDES = unary_union([g for (cla, n), gs in regions.items() if cla == "Range/mtn" and
                     (n == "ANDES" or n.startswith("CORD")) for g in gs])
PATAGONIE = reg("Geoarea", "PATAGONIA").difference(ANDES.buffer(0.3)).difference(box(-80, -56, -71.3, -38))

SAHARA_PARTS = {"d-tene", "d-liby", "d-nubi", "d-arab", "d-ergo", "d-erge", "d-chec", "d-djou"}
# (code, nom, alias, continent, géométrie)
DESERTS = [
    ("d-saha", "Sahara", ["Désert du Sahara"], "Afrique", reg("Desert", "SAHARA")),
    ("d-tene", "Ténéré", ["Désert du Ténéré"], "Afrique", reg("Desert", "Ténéré")),
    ("d-liby", "Désert Libyque", ["Libyque"], "Afrique", reg("Desert", "LIBYAN DESERT")),
    ("d-nubi", "Désert de Nubie", ["Nubie"], "Afrique", reg("Desert", "NUBIAN DESERT")),
    ("d-arab", "Désert Arabique", ["Désert oriental"], "Afrique", reg("Desert", "Eastern Desert")),
    ("d-ergo", "Grand Erg occidental", [], "Afrique", reg("Desert", "Grand Erg Occidental")),
    ("d-erge", "Grand Erg oriental", [], "Afrique", reg("Desert", "Grand Erg Oriental")),
    ("d-chec", "Erg Chech", [], "Afrique", reg("Desert", "‘Erg Chech")),
    ("d-djou", "El Djouf", ["Majâbat al-Koubrâ"], "Afrique", reg("Desert", "El Djouf")),
    ("d-kala", "Désert du Kalahari", ["Kalahari"], "Afrique", reg("Desert", "KALAHARI DESERT")),
    ("d-nami", "Désert du Namib", ["Namib"], "Afrique", reg("Desert", "NAMIB DESERT")),
    ("d-dana", "Désert Danakil", ["Danakil", "Désert du Danakil"], "Afrique", reg("Desert", "Danakil")),
    ("d-karo", "Karoo", ["Grand Karoo"], "Afrique", reg("Plateau", "Great Karroo").union(reg("Plateau", "Northern Karroo"))),
    ("d-rubk", "Rub al-Khali", ["Rub al Khali", "Quart Vide"], "Asie", reg("Desert", "RUB’ AL KHALI")),
    ("d-nefo", "Désert du Néfoud", ["Néfoud", "Nefoud", "Nafoud"], "Asie", reg("Desert", "An Nafud Desert")),
    ("d-syri", "Désert de Syrie", ["Désert syrien"], "Asie", reg("Desert", "SYRIAN DESERT")),
    ("d-negu", "Néguev", ["Désert du Néguev", "Negev"], "Asie", reg("Desert", "Negev Desert")),
    ("d-kavi", "Dacht-e Kavir", ["Dasht-e Kavir", "Grand désert salé", "Kavir"], "Asie", reg("Desert", "Kavir Desert")),
    ("d-lout", "Dacht-e Lout", ["Dasht-e Lut", "Lout", "Lut"], "Asie", reg("Desert", "LUT DESERT")),
    ("d-kara", "Karakoum", ["Désert du Karakoum", "Garagum"], "Asie", reg("Desert", "GARAGUM DESERT")),
    ("d-kyzy", "Kyzylkoum", ["Désert du Kyzylkoum", "Qizilqum"], "Asie", reg("Desert", "QIZILQUM DESERT")),
    ("d-takl", "Taklamakan", ["Désert du Taklamakan", "Taklimakan"], "Asie", reg("Desert", "TAKLIMAKAN DESERT")),
    ("d-gobi", "Gobi", ["Désert de Gobi"], "Asie", reg("Desert", "GOBI DESERT")),
    ("d-ordo", "Désert d'Ordos", ["Ordos", "Mu Us", "Désert de Mu Us"], "Asie", reg("Desert", "Mu Us Desert")),
    ("d-thar", "Désert du Thar", ["Thar", "Grand désert indien"], "Asie", reg("Desert", "THAR DESERT")),
    ("d-regi", "Registan", ["Désert du Registan"], "Asie", reg("Desert", "Rigestan")),
    ("d-betp", "Betpak-Dala", ["Steppe de la Faim"], "Asie", reg("Desert", "BETPAQDALA DESERT")),
    ("d-atac", "Désert d'Atacama", ["Atacama"], "Amérique du Sud", reg("Desert", "DESIERTO DE ATACAMA")),
    ("d-pata", "Désert de Patagonie", ["Patagonie", "Désert patagonien"], "Amérique du Sud", PATAGONIE),
    ("d-sono", "Désert de Sonora", ["Sonora"], "Amérique du Nord", reg("Desert", "SONORAN DESERT")),
    ("d-chih", "Désert de Chihuahua", ["Chihuahua"], "Amérique du Nord", reg("Desert", "CHIHUAHUAN DESERT")),
    ("d-moja", "Désert de Mojave", ["Mojave", "Mojave Desert"], "Amérique du Nord", MOJAVE),
    ("d-gbas", "Désert du Grand Bassin", ["Grand Bassin"], "Amérique du Nord", reg("Basin", "GREAT BASIN")),
    ("d-vict", "Grand désert de Victoria", ["Désert de Victoria"], "Océanie", reg("Desert", "GREAT VICTORIA DESERT")),
    ("d-sabl", "Grand désert de Sable", ["Grand désert de sable"], "Océanie", reg("Desert", "GREAT SANDY DESERT")),
    ("d-gibs", "Désert de Gibson", ["Gibson"], "Océanie", reg("Desert", "Gibson Desert")),
    ("d-simp", "Désert de Simpson", ["Simpson"], "Océanie", reg("Desert", "Simpson Desert")),
    ("d-tana", "Désert de Tanami", ["Tanami"], "Océanie", reg("Desert", "Tanami Desert")),
    ("d-strz", "Désert de Strzelecki", ["Strzelecki"], "Océanie", reg("Desert", "Strzelecki Desert")),
    ("d-anta", "Antarctique", ["Désert antarctique", "Antarctica"], "Antarctique", countries["ATA"]),
]
assert len(DESERTS) == 40

# Partition sans chevauchement : chaque désert perd ce que recouvrent les plus petits que lui
# (le Grand Bassin ne cache plus le Mojave). Les parties du Sahara sont rognées à son contour,
# et la zone « Sahara » est ce qui reste une fois ses parties retirées.
geoms = {}
for code, nom, alias, cont, g in DESERTS:
    geoms[code] = g.intersection(land.buffer(0.05)).buffer(0) if code != "d-anta" else g
sahara_all = geoms["d-saha"]
for code in SAHARA_PARTS:
    geoms[code] = geoms[code].intersection(sahara_all).buffer(0)
taken = None
for code in sorted(geoms, key=lambda c: geoms[c].area):
    if code == "d-saha":
        continue
    if taken is not None:
        geoms[code] = geoms[code].difference(taken).buffer(0)
    taken = geoms[code] if taken is None else taken.union(geoms[code])
geoms["d-saha"] = sahara_all.difference(unary_union([geoms[c] for c in SAHARA_PARTS])).buffer(0)

items, zones, pts = [], [], []
for code, nom, alias, cont, _ in DESERTS:
    g = geoms[code]
    big = max(getattr(g, "geoms", [g]), key=lambda p: p.area)
    c = big.representative_point()
    part = code in SAHARA_PARTS
    detail = f"{cont} · {'partie du Sahara' if part else 'désert'}"
    items.append({"code": code, "nom": nom, "alias": [a for a in alias if a != nom], "domaine": "physique",
                  "categorie": "désert", "continent": cont, "geo": [round(c.x, 3), round(c.y, 3)], "detail": detail})
    zones.append(f'<path class="zone des{" part" if part else ""}" data-code="{code}"{anchor(mapping(g), tf)} d="{path_d(mapping(g.simplify(0.03)), tf, 0.05)}"/>')
    # Losange de repère au cœur de chaque désert (taille fixe à l'écran), vert avec sa zone.
    pts.append(marker(*tf(c.x, c.y), "losange", "des-pt", code))

sahara = sahara_all
body = ['<g data-layer="terres"><path class="land" d="' + "".join(path_d(mapping(g), tf, 0.05) for g in countries.values()) + '"/></g>',
        '<g data-layer="deserts">', *zones, '</g>',
        # Liseré du Sahara : rappelle, par-dessus ses parties, qu'elles en font partie.
        f'<g data-layer="contour-sahara"><path class="sub sahara-line" d="{path_d(mapping(sahara.simplify(0.03)), tf, 0.05)}"/></g>',
        '<g data-layer="reperes">', *pts, '</g>']
open(f"{root}/maps/deserts.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], body))
json.dump({"id": "deserts", "titre": "Déserts du monde", "items": items},
          open(f"{root}/data/deserts.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "déserts ·", os.path.getsize(f"{root}/maps/deserts.svg") // 1024, "Ko")
