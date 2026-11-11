"""Chaînes de montagnes du monde, sur la carte du monde prolongée jusqu'au pôle Sud.

Usage : python3 -I tools/build_ranges.py <dossier des sources> <racine du dépôt>
Sources (Natural Earth, domaine public) :
  regions/ne_10m_geography_regions_polys.geojson (reliefs, Massif central)
  world-countries.geojson (fond de carte)
Les chaînes qui en contiennent d'autres (Atlas, Carpates, Cordillère australienne) sont dessinées comme le
Sahara des déserts : la zone de l'ensemble est ce qui reste hors de ses sous-chaînes, et un liseré en fait le tour.
"""
import json
import os
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, svg_doc, marker, anchor, is_tiny  # noqa: E402
from worldproj_full import tf, W, H  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))

regions = {}
for f in J("regions/ne_10m_geography_regions_polys.geojson")["features"]:
    p = f["properties"]
    regions.setdefault((p["FEATURECLA"], p["NAME"], p.get("REGION")), []).append(shape(f["geometry"]).buffer(0))


def R(*names, cla="Range/mtn", region=None):
    parts = [g for (c, n, r), gs in regions.items() if c == cla and n in names and (region is None or r == region) for g in gs]
    assert parts, names
    return unary_union(parts)


countries = {f["properties"]["code"]: shape(f["geometry"]).buffer(0) for f in J("world-countries.geojson")["features"]}
land = unary_union(list(countries.values()))
andes_names = [n for (c, n, r) in regions if c == "Range/mtn" and r == "South America" and (n == "ANDES" or n.startswith("CORD"))]

# (code, nom, alias, continent, géométrie, ensemble éventuel)
RANGES = [
    # Europe
    ("r-alpe", "Alpes", [], "Europe", R("ALPS"), None),
    ("r-pyre", "Pyrénées", [], "Europe", R("PYRENEES"), None),
    ("r-apen", "Apennins", ["Apennin"], "Europe", R("APPENNINI"), None),
    ("r-carp", "Carpates", [], "Europe", R("CARPATHIAN MOUNTAINS"), None),
    ("r-tatr", "Tatras", ["Monts Tatras", "Tatra"], "Europe", R("Tatra Mts."), "r-carp"),
    ("r-tran", "Alpes de Transylvanie", ["Carpates méridionales"], "Europe", R("Transylvanian Alps"), "r-carp"),
    ("r-scan", "Alpes scandinaves", ["Monts scandinaves", "Kjølen"], "Europe", R("KJØLEN MOUNTAINS"), None),
    ("r-cauc", "Caucase", ["Grand Caucase"], "Europe", R("CAUCASUS MTS."), None),
    ("r-pcau", "Petit Caucase", [], "Asie", R("Lesser Caucasus"), None),
    ("r-oura", "Oural", ["Monts Oural"], "Europe", R("URAL MOUNTAINS"), None),
    ("r-balk", "Balkan", ["Grand Balkan", "Monts Balkan", "Stara Planina"], "Europe", R("Balkan Mts."), None),
    ("r-dina", "Alpes dinariques", ["Dinarides"], "Europe", R("Dinaric Alps"), None),
    ("r-pind", "Pinde", ["Massif du Pinde"], "Europe", R("Pindus Mts."), None),
    ("r-cant", "Cordillère Cantabrique", ["Monts Cantabriques"], "Europe", R("Cord. Cantábrica"), None),
    ("r-snes", "Sierra Nevada", [], "Europe", R("S. Nevada"), None),
    ("r-jura", "Jura", ["Massif du Jura"], "Europe", R("Jura"), None),
    ("r-vosg", "Vosges", ["Massif des Vosges"], "Europe", R("Vosges"), None),
    ("r-mcen", "Massif central", [], "Europe", R("Massif Central", cla="Plateau"), None),
    ("r-arde", "Ardenne", ["Ardennes"], "Europe", R("Ardennes"), None),
    ("r-sude", "Sudètes", [], "Europe", R("Sudetes Mts."), None),
    ("r-gram", "Monts Grampians", ["Grampians"], "Europe", R("Grampian Mts."), None),
    # Afrique
    ("r-atla", "Atlas", ["Monts de l'Atlas"], "Afrique", R("ATLAS MOUNTAINS"), None),
    ("r-hatl", "Haut Atlas", [], "Afrique", R("HAUT ATLAS"), "r-atla"),
    ("r-matl", "Moyen Atlas", [], "Afrique", R("Moyen Atlas"), "r-atla"),
    ("r-aatl", "Anti-Atlas", [], "Afrique", R("Anti Atlas"), "r-atla"),
    ("r-satl", "Atlas saharien", [], "Afrique", R("ATLAS SAHARIEN"), "r-atla"),
    ("r-tatl", "Atlas tellien", [], "Afrique", R("Atlas Tellien"), "r-atla"),
    ("r-rif", "Rif", [], "Afrique", R("Er Rif"), None),
    ("r-hogg", "Hoggar", ["Ahaggar"], "Afrique", R("AHAGGAR MTS."), None),
    ("r-tibe", "Tibesti", ["Massif du Tibesti"], "Afrique", R("TIBESTI MTS."), None),
    ("r-air", "Aïr", ["Massif de l'Aïr"], "Afrique", R("AÏR MTS."), None),
    ("r-drak", "Drakensberg", [], "Afrique", R("DRAKENSBERG"), None),
    ("r-rwen", "Rwenzori", ["Ruwenzori", "Monts de la Lune"], "Afrique", R("Ruwenzori Range"), None),
    ("r-ethi", "Hauts plateaux d'Éthiopie", ["Plateau éthiopien", "Massif éthiopien"], "Afrique", R("ETHIOPIAN HIGHLANDS"), None),
    # Asie
    ("r-hima", "Himalaya", [], "Asie", R("HIMALAYAS"), None),
    ("r-kara", "Karakoram", [], "Asie", R("KARAKORAM RA."), None),
    ("r-hind", "Hindou Kouch", ["Hindu Kush"], "Asie", R("HINDU KUSH"), None),
    ("r-pami", "Pamir", [], "Asie", R("PAMIRS"), None),
    ("r-tian", "Tian Shan", ["Tianshan"], "Asie", R("TIAN SHAN"), None),
    ("r-kunl", "Kunlun", ["Monts Kunlun", "Cordillère du Kunlun"], "Asie", R("KUNLUN MOUNTAINS"), None),
    ("r-alta", "Altaï", ["Monts Altaï"], "Asie", R("ALTAY MOUNTAINS"), None),
    ("r-saia", "Monts Saïan", ["Saïan"], "Asie", R("EASTERN SAYAN MTS.", "Western Sayan Mts."), None),
    ("r-khan", "Khangaï", ["Monts Khangaï"], "Asie", R("Hangayn Mts."), None),
    ("r-zagr", "Zagros", ["Monts Zagros"], "Asie", R("ZAGROS MOUNTAINS"), None),
    ("r-elbo", "Elbourz", ["Alborz"], "Asie", R("ELBURZ MTS."), None),
    ("r-taur", "Taurus", ["Monts Taurus"], "Asie", R("Taurus Mts."), None),
    ("r-pont", "Chaîne pontique", ["Monts Pontiques", "Alpes pontiques"], "Asie", R("PONTIC MOUNTAINS"), None),
    ("r-kope", "Kopet-Dag", ["Kopet Dag"], "Asie", R("Kopet Dag Mts ."), None),
    ("r-liba", "Mont-Liban", ["Mont Liban", "Monts du Liban"], "Asie", R("Lebanon Mts."), None),
    ("r-asir", "Monts Asir", ["Asir"], "Asie", R("ASIR MTS."), None),
    ("r-gocc", "Ghâts occidentaux", ["Ghats occidentaux"], "Asie", R("WESTERN GHATS"), None),
    ("r-gori", "Ghâts orientaux", ["Ghats orientaux"], "Asie", R("EASTERN GHATS"), None),
    ("r-arak", "Arakan Yoma", ["Chaîne de l'Arakan", "Arakan"], "Asie", R("Arakan Yoma"), None),
    ("r-anna", "Cordillère annamitique", ["Chaîne annamitique", "Truong Son"], "Asie", R("CHAÎNE ANNAMITIQUE"), None),
    ("r-qinl", "Qinling", ["Monts Qinling"], "Asie", R("Qinling Mountains"), None),
    ("r-khin", "Grand Khingan", [], "Asie", R("GREATER KHINGAN RANGE"), None),
    ("r-stan", "Monts Stanovoï", ["Stanovoï"], "Asie", R("STANOVOY RANGE"), None),
    ("r-verk", "Monts de Verkhoïansk", ["Verkhoïansk"], "Asie", R("VERKHOYANSK RANGE"), None),
    ("r-tche", "Monts Tcherski", ["Tcherski"], "Asie", R("CHERSKIY RANGE"), None),
    ("r-sikh", "Sikhote-Aline", [], "Asie", R("SIKHOTE-ALIN’ RANGE"), None),
    # Amériques
    ("r-rock", "Rocheuses", ["Montagnes Rocheuses"], "Amérique du Nord", R("ROCKY MOUNTAINS"), None),
    ("r-appa", "Appalaches", [], "Amérique du Nord", R("APPALACHIAN MTS."), None),
    ("r-casc", "Chaîne des Cascades", ["Cascades"], "Amérique du Nord", R("CASCADE RANGE"), None),
    ("r-snca", "Sierra Nevada", [], "Amérique du Nord", R("SIERRA NEVADA"), None),
    ("r-cote", "Chaîne Côtière", ["Coast Mountains"], "Amérique du Nord", R("COAST MOUNTAINS"), None),
    ("r-alas", "Chaîne d'Alaska", [], "Amérique du Nord", R("ALASKA RANGE"), None),
    ("r-broo", "Chaîne Brooks", ["Brooks"], "Amérique du Nord", R("BROOKS RANGE"), None),
    ("r-mack", "Monts Mackenzie", [], "Amérique du Nord", R("MACKENZIE MTS."), None),
    ("r-smoc", "Sierra Madre occidentale", [], "Amérique du Nord", R("SIERRA MADRE OCCIDENTAL"), None),
    ("r-smor", "Sierra Madre orientale", [], "Amérique du Nord", R("SIERRA MADRE ORIENTAL"), None),
    ("r-smsu", "Sierra Madre du Sud", [], "Amérique du Nord", R("Sierra Madre del Sur"), None),
    ("r-ande", "Andes", ["Cordillère des Andes"], "Amérique du Sud", R(*andes_names), None),
    ("r-guya", "Massif des Guyanes", ["Plateau des Guyanes", "Bouclier guyanais"], "Amérique du Sud", R("GUIANA HIGHLANDS"), None),
    # Océanie et Antarctique
    ("r-aust", "Cordillère australienne", ["Great Dividing Range"], "Océanie", R("GREAT DIVIDING RANGE"), None),
    ("r-aalp", "Alpes australiennes", [], "Océanie", R("Australian Alps"), "r-aust"),
    ("r-asud", "Alpes du Sud", [], "Océanie", R("SOUTHERN ALPS"), None),
    ("r-ngui", "Chaîne centrale de Nouvelle-Guinée", ["Cordillère centrale", "Chaîne centrale"], "Océanie", R("NEW GUINEA HIGHLANDS"), None),
    ("r-tant", "Chaîne Transantarctique", ["Monts Transantarctiques"], "Antarctique", R("Transantarctic Mountains"), None),
    ("r-ells", "Monts Ellsworth", ["Ellsworth"], "Antarctique", R("Ellsworth Mountains"), None),
]
PAYS = {"r-snes": "Espagne", "r-snca": "États-Unis"}  # deux « Sierra Nevada » : précisées en mode clic

geoms = {code: (g.intersection(land.buffer(0.05)).buffer(0) if cont != "Antarctique" else g)
         for code, nom, alias, cont, g, parent in RANGES}
parents = {code: parent for code, *_, parent in RANGES if parent}
umbrellas = set(parents.values())
umbrella_full = {u: geoms[u].union(unary_union([geoms[c] for c, p in parents.items() if p == u])) for u in umbrellas}
for c, p in parents.items():
    geoms[c] = geoms[c].intersection(umbrella_full[p]).buffer(0)
# Partition : chaque chaîne perd ce que recouvrent les plus petites ; un ensemble garde ce qui reste hors de ses sous-chaînes.
taken = None
for code in sorted(geoms, key=lambda c: geoms[c].area):
    if code in umbrellas:
        continue
    if taken is not None:
        geoms[code] = geoms[code].difference(taken).buffer(0)
    taken = geoms[code] if taken is None else taken.union(geoms[code])
for u in umbrellas:
    geoms[u] = umbrella_full[u].difference(taken).buffer(0)

items, zones, pts, rings = [], [], [], []
for code, nom, alias, cont, _, parent in RANGES:
    g = geoms[code]
    assert not g.is_empty, nom
    big = max(getattr(g, "geoms", [g]), key=lambda p: p.area)
    c = big.representative_point()
    detail = f"{cont} · " + (f"fait partie : {next(n for k, n, *_ in RANGES if k == parent)}" if parent else "chaîne de montagnes")
    it = {"code": code, "nom": nom, "alias": [a for a in alias if a != nom], "domaine": "physique", "categorie": "relief",
          "continent": cont, "geo": [round(c.x, 3), round(c.y, 3)], "detail": detail}
    if code in PAYS:
        it["pays"] = PAYS[code]
    items.append(it)
    zones.append(f'<path class="zone rng" data-code="{code}"{anchor(mapping(g), tf)} d="{path_d(mapping(g.simplify(0.02)), tf, 0.05)}"/>')
    # Triangle de repère pour les chaînes trop petites pour être vues sans zoomer.
    if is_tiny(mapping(g), tf, area_max=3, small_max=8, extent_max=5):
        pts.append(marker(*tf(c.x, c.y), "triangle", "rng-pt", code))
for u in sorted(umbrellas):
    rings.append(f'<path class="sub group-line" d="{path_d(mapping(umbrella_full[u].simplify(0.02)), tf, 0.05)}"/>')

body = ['<g data-layer="terres"><path class="land" d="' + "".join(path_d(mapping(g), tf, 0.05) for g in countries.values()) + '"/></g>',
        '<g data-layer="chaines">', *zones, '</g>',
        '<g data-layer="contours-ensembles">', *rings, '</g>',
        '<g data-layer="reperes">', *pts, '</g>']
open(f"{root}/maps/chaines.svg", "w").write(svg_doc(f"0 0 {W} {H}", [], body))
json.dump({"id": "chaines", "titre": "Chaînes de montagnes", "items": items},
          open(f"{root}/data/chaines.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "chaînes ·", len(pts), "triangles ·", os.path.getsize(f"{root}/maps/chaines.svg") // 1024, "Ko")
