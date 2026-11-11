"""Déserts du monde : 40 zones, sur une carte du monde qui descend jusqu'au pôle Sud.

Usage : python3 -I tools/build_deserts.py <dossier des sources> <racine du dépôt>
Sources (Natural Earth, domaine public) :
  regions/ne_10m_geography_regions_polys.geojson (déserts, Grand Bassin, Patagonie, Andes)
  world-countries.geojson (fond de carte et Antarctique)
Le Mojave, absent de la source, est un contour simplifié tracé à la main (ci-dessous).
Noms français vérifiés sur Wikipédia (novembre 2026).
"""
import json
import math
import os
import sys

from shapely.geometry import shape, mapping, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, svg_doc, marker, is_tiny, anchor  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))


# ---------- Projection Natural Earth, comme la carte du monde, mais jusqu'à 90° S ----------
def natural_earth(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p
    p4 = p2 * p2
    x = l * (0.870700 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y


W = 1000
XMAX = natural_earth(180, 0)[0]
YTOP, YBOT = natural_earth(0, 84)[1], natural_earth(0, -90)[1]
S = (W - 20) / (2 * XMAX)
H = round((YBOT - YTOP) * S + 20)


def tf(lon, lat):
    x, y = natural_earth(max(-180, min(180, lon)), max(-90, min(90, lat)))
    return 10 + (x + XMAX) * S, 10 + (y - YTOP) * S


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

items, zones, tops, minis = [], [], [], []
for code, nom, alias, cont, g in DESERTS:
    g = g.intersection(land.buffer(0.05)).buffer(0) if code != "d-anta" else g
    c = g.representative_point()
    part = code in SAHARA_PARTS
    detail = f"{cont} · {'partie du Sahara' if part else 'désert'}"
    items.append({"code": code, "nom": nom, "alias": [a for a in alias if a != nom], "domaine": "physique",
                  "categorie": "désert", "continent": cont, "geo": [round(c.x, 3), round(c.y, 3)], "detail": detail})
    d = f'<path class="zone des{" part" if part else ""}" data-code="{code}"{anchor(mapping(g), tf)} d="{path_d(mapping(g.simplify(0.03)), tf, 0.05)}"/>'
    (tops if part else zones).append(d)
    if is_tiny(mapping(g), tf, area_max=4, small_max=10, extent_max=5):
        minis.append(marker(*tf(c.x, c.y), "rond", "mini", code))

sahara = next(g for code, *_, g in DESERTS if code == "d-saha")
body = ['<g data-layer="terres"><path class="land" d="' + "".join(path_d(mapping(g), tf, 0.05) for g in countries.values()) + '"/></g>',
        '<g data-layer="deserts">', *zones, *tops, '</g>',
        # Liseré du Sahara : rappelle, par-dessus ses parties, qu'elles en font partie.
        f'<g data-layer="contour-sahara"><path class="sub sahara-line" d="{path_d(mapping(sahara.simplify(0.03)), tf, 0.05)}"/></g>',
        '<g data-layer="petits-deserts">', *minis, '</g>']
open(f"{root}/maps/deserts.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], body))
json.dump({"id": "deserts", "titre": "Déserts du monde", "items": items},
          open(f"{root}/data/deserts.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "déserts ·", len(minis), "avec un rond ·", os.path.getsize(f"{root}/maps/deserts.svg") // 1024, "Ko")
