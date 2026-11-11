"""Grands sommets du monde : 39 triangles sur la carte du monde prolongée jusqu'au pôle Sud.

Usage : python3 -I tools/build_summits.py <dossier des sources> <racine du dépôt>
Sources : regions/ne_10m_geography_regions_elevation_points.geojson (Natural Earth, domaine public)
pour les positions ; six sommets absents de la source sont placés à la main (coordonnées ci-dessous).
Altitudes : valeurs de référence actuelles (Everest 8 849 m, mesure sino-népalaise de 2020).
"""
import json
import os
import sys

from shapely.geometry import shape
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, svg_doc, marker  # noqa: E402
from worldproj_full import tf, W, H  # noqa: E402
from shapely.geometry import mapping  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))
pts = {f["properties"]["name"]: f["geometry"]["coordinates"] for f in J("regions/ne_10m_geography_regions_elevation_points.geojson")["features"]}

# (code, nom, alias, continent, chaîne, altitude, nom dans la source ou (lon, lat))
SUMMITS = [
    ("p-ever", "Everest", ["Mont Everest", "Chomolungma", "Sagarmatha"], "Asie", "Himalaya", 8849, "Mount Everest"),
    ("p-k2", "K2", ["Chogori", "Mont Godwin-Austen"], "Asie", "Karakoram", 8611, "K2"),
    ("p-kang", "Kangchenjunga", ["Kanchenjunga"], "Asie", "Himalaya", 8586, (88.1475, 27.7025)),
    ("p-lhot", "Lhotse", [], "Asie", "Himalaya", 8516, (86.9333, 27.9617)),
    ("p-maka", "Makalu", [], "Asie", "Himalaya", 8485, (87.0889, 27.8897)),
    ("p-anna", "Annapurna", ["Annapurna I"], "Asie", "Himalaya", 8091, (83.8203, 28.5961)),
    ("p-nang", "Nanga Parbat", [], "Asie", "Himalaya", 8126, "Nanga Parbat"),
    ("p-acon", "Aconcagua", [], "Amérique du Sud", "Andes", 6961, "Cerro Aconcagua"),
    ("p-ojos", "Ojos del Salado", [], "Amérique du Sud", "Andes", 6893, "Nevado Ojos del Salado"),
    ("p-huas", "Huascarán", [], "Amérique du Sud", "Andes", 6768, "Nevado Huascarán"),
    ("p-chim", "Chimborazo", [], "Amérique du Sud", "Andes", 6263, "Chimborazo"),
    ("p-coto", "Cotopaxi", [], "Amérique du Sud", "Andes", 5897, (-78.4378, -0.6838)),
    ("p-dena", "Denali", ["Mont McKinley", "McKinley"], "Amérique du Nord", "Chaîne d'Alaska", 6190, "Denali"),
    ("p-loga", "Mont Logan", ["Logan"], "Amérique du Nord", "Monts Saint-Élie", 5959, "Mount Logan"),
    ("p-oriz", "Pic d'Orizaba", ["Orizaba", "Citlaltépetl"], "Amérique du Nord", "Cordillère néovolcanique", 5636, "Pico de Orizaba"),
    ("p-popo", "Popocatépetl", ["Popo"], "Amérique du Nord", "Cordillère néovolcanique", 5426, "Volcán Popocatépetl"),
    ("p-whit", "Mont Whitney", ["Whitney"], "Amérique du Nord", "Sierra Nevada", 4421, "Mount Whitney"),
    ("p-rain", "Mont Rainier", ["Rainier", "Tahoma"], "Amérique du Nord", "Chaîne des Cascades", 4392, "Mount Rainier"),
    ("p-kili", "Kilimandjaro", ["Kibo", "Uhuru Peak"], "Afrique", "volcan isolé", 5895, "Mount Kilimanjaro"),
    ("p-keny", "Mont Kenya", ["Kirinyaga"], "Afrique", "volcan isolé", 5199, "Mount Kenya"),
    ("p-rasd", "Ras Dashen", ["Ras Dejen"], "Afrique", "Hauts plateaux d'Éthiopie", 4550, (38.3722, 13.2364)),
    ("p-toub", "Toubkal", ["Jbel Toubkal", "Djebel Toubkal"], "Afrique", "Haut Atlas", 4167, "Jebel Toubkal"),
    ("p-emik", "Emi Koussi", [], "Afrique", "Tibesti", 3415, "Emi Koussi"),
    ("p-elbr", "Elbrouz", ["Elbrus"], "Europe", "Caucase", 5642, "Gora Elbrus"),
    ("p-blan", "Mont Blanc", [], "Europe", "Alpes", 4806, "Mont Blanc"),
    ("p-cerv", "Cervin", ["Matterhorn"], "Europe", "Alpes", 4478, "Matterhorn"),
    ("p-olym", "Mont Olympe", ["Olympe"], "Europe", "Grèce", 2917, None),
    ("p-etna", "Etna", ["Mont Etna"], "Europe", "Sicile", 3357, "Monte Etna"),
    ("p-vesu", "Vésuve", ["Mont Vésuve"], "Europe", "Campanie", 1281, "Vesuvio"),
    ("p-teid", "Teide", ["Pic du Teide"], "Europe", "Canaries", 3715, "Pico del Teide"),
    ("p-arar", "Mont Ararat", ["Ararat"], "Asie", "Haut-plateau arménien", 5137, "Mount Ararat"),
    ("p-dama", "Damavand", ["Mont Damavand"], "Asie", "Elbourz", 5610, "Mount Damavand"),
    ("p-fuji", "Mont Fuji", ["Fuji", "Fuji-san", "Fujiyama"], "Asie", "Honshū", 3776, "Fuji"),
    ("p-kina", "Kinabalu", ["Mont Kinabalu"], "Asie", "Bornéo", 4095, "Gunung Kinabalu"),
    ("p-vins", "Massif Vinson", ["Mont Vinson", "Vinson"], "Antarctique", "Monts Ellsworth", 4892, "Vinson Massif"),
    ("p-jaya", "Puncak Jaya", ["Pyramide Carstensz", "Carstensz"], "Océanie", "Nouvelle-Guinée", 4884, "Puncak Jaya"),
    ("p-kosc", "Mont Kosciuszko", ["Kosciuszko"], "Océanie", "Alpes australiennes", 2228, "Mount Kosciuszko"),
    ("p-maun", "Mauna Kea", [], "Océanie", "Hawaï", 4207, "Mauna Kea"),
    ("p-cook", "Aoraki / Mont Cook", ["Mont Cook", "Aoraki"], "Océanie", "Alpes du Sud", 3724, "Aoraki (Mount Cook)"),
]
# Deux « Mount Olympus » dans la source (Grèce et Chypre) : celui de Grèce.
OLYMPE = (22.3583, 40.0856)

items, marks = [], []
for code, nom, alias, cont, chaine, alt, ref in SUMMITS:
    lon, lat = OLYMPE if ref is None else (ref if isinstance(ref, tuple) else pts[ref])
    items.append({"code": code, "nom": nom, "alias": [a for a in alias if a != nom], "domaine": "physique",
                  "categorie": "sommet", "continent": cont, "geo": [round(lon, 4), round(lat, 4)],
                  "detail": f"{cont} · {chaine} · {alt:,} m".replace(",", " ")})
    marks.append(marker(*tf(lon, lat), "triangle", "som", code))

countries = [shape(f["geometry"]).buffer(0) for f in J("world-countries.geojson")["features"]]
body = ['<g data-layer="terres"><path class="land" d="' + "".join(path_d(mapping(g), tf, 0.05) for g in countries) + '"/></g>',
        '<g data-layer="sommets">', *marks, '</g>']
open(f"{root}/maps/sommets.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], body))
json.dump({"id": "sommets", "titre": "Grands sommets", "items": items},
          open(f"{root}/data/sommets.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "sommets ·", os.path.getsize(f"{root}/maps/sommets.svg") // 1024, "Ko")
