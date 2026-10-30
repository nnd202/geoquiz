"""Lacs et fleuves du monde : listes choisies, noms français, sur la carte du monde.

Usage : python3 -I tools/build_water.py <dossier des sources> <racine du dépôt>
Sources (Natural Earth, domaine public) :
  ne/ne_10m_lakes.geojson, ne/ne_10m_rivers_lake_centerlines.geojson, world-land.geojson
La mer Caspienne n'est pas un lac pour Natural Earth : elle est reprise du « trou » qu'elle forme dans les terres.
"""
import json
import math
import os
import sys

from shapely.geometry import shape, mapping, box, MultiLineString
from shapely.ops import unary_union, linemerge

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, line_d, svg_doc, marker  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))


from worldproj import tf, VIEW  # noqa: E402


def geoms(doc):
    return [f["geometry"] for f in doc["features"]] if "features" in doc else doc["geometries"]


land_shapes = [shape(g).buffer(0) for g in geoms(J("world-land.geojson"))]
land_d = "".join(path_d(g, tf, 0.05) for g in geoms(J("world-land.geojson")))


def proj_area(geom):
    a = 0
    for poly in getattr(geom, "geoms", [geom]):
        pts = [tf(*c) for c in poly.exterior.coords]
        a += abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2
    return a


def dump(name, titre, items):
    json.dump({"id": name, "titre": titre, "items": items},
              open(f"{root}/data/{name}.json", "w"), ensure_ascii=False, indent=1)


# ---------- Lacs ----------
LAKES = [  # (nom français, noms Natural Earth, alias)
    ("Mer Caspienne", [], ["Caspienne"]),
    ("Lac Supérieur", ["Lake Superior"], []), ("Lac Michigan", ["Lake Michigan"], []), ("Lac Huron", ["Lake Huron"], []),
    ("Lac Érié", ["Lake Erie"], []), ("Lac Ontario", ["Lake Ontario"], []), ("Lac Victoria", ["Lake Victoria"], []),
    ("Lac Tanganyika", ["Lake Tanganyika"], []), ("Lac Malawi", ["Lake Malawi"], ["Lac Nyassa"]),
    ("Lac Baïkal", ["Lake Baikal"], []), ("Grand lac de l'Ours", ["Great Bear Lake"], []),
    ("Grand lac des Esclaves", ["Great Slave Lake"], []), ("Lac Winnipeg", ["Lake Winnipeg"], []),
    ("Lac Ladoga", ["Lake Ladoga"], []), ("Lac Onega", ["Lake Onega"], ["Lac Onéga"]), ("Lac Balkhach", ["Lake Balkhash"], []),
    ("Mer d'Aral", ["North Aral Sea", "South Aral Sea"], ["Aral"]), ("Lac Tchad", ["Lake Chad"], []),
    ("Lac Titicaca", ["Lago Titicaca"], []), ("Lac Nicaragua", ["Lago de Nicaragua"], ["Lac Cocibolca"]),
    ("Lac Vänern", ["Vänern"], ["Lac Vanern"]), ("Lac Vättern", ["Vättern"], []), ("Lac Tana", ["Lake Tana"], []),
    ("Lac Turkana", ["Lake Turkana"], ["Lac Rodolphe"]), ("Lac Albert", ["Lake Albert"], []), ("Lac Kivu", ["Lake Kivu"], []),
    ("Lac Édouard", ["Lake Edward"], []), ("Lac Volta", ["Lake Volta"], []), ("Lac Nasser", ["Lake Nasser"], []),
    ("Lac Kariba", ["Lake Kariba"], []), ("Lac Moero", ["Lac Moeru"], ["Lac Mweru"]), ("Lac Issyk-Koul", ["Issyk-Kul"], []),
    ("Lac Qinghai", ["Qinghai Hu"], []), ("Lac Khanka", ["Lake Khanka"], []), ("Tonlé Sap", ["Tonlé Sap"], ["Lac Tonlé Sap"]),
    ("Mer Morte", ["Dead Sea"], []), ("Lac de Tibériade", ["Sea of Galilee"], ["Mer de Galilée", "Lac Kinneret"]),
    ("Lac de Van", ["Lake Van"], []), ("Lac d'Ourmia", ["Lake Urmia"], []), ("Grand Lac Salé", ["Great Salt Lake"], []),
    ("Lac Okeechobee", ["Lake Okeechobee"], []), ("Lac Athabasca", ["Lake Athabasca"], []),
    ("Lac Champlain", ["Lake Champlain"], []), ("Lac Tahoe", ["Lake Tahoe"], []),
    ("Lac Léman", ["Lake Geneva"], ["Lac de Genève"]), ("Lac de Constance", ["Bodensee"], []),
    ("Lac de Garde", ["Lago di Garda"], []), ("Lac de Côme", ["Lago di Como"], []), ("Lac Balaton", ["Lake Balaton"], []),
    ("Lac Saimaa", ["Lake Saimaa"], []), ("Lac Peïpous", ["Lake Peipus"], ["Lac Peipsi"]), ("Lac Inari", ["Inarijrvi"], []),
    ("Lac Eyre", ["Lake Eyre North"], []), ("Lac Taupo", ["Lake Taupo"], []), ("Lac Sevan", ["Lake Sevan"], []),
    ("Lac Dongting", ["Dongting Hu"], []), ("Lac Poyang", ["Poyang Hu"], []), ("Lac Khövsgöl", ["Khövsgöl Nuur"], []),
    ("Lac Bangweulu", ["Lake Bangweulu"], []), ("Lac Manitoba", ["Lake Manitoba"], []), ("Lac Nipigon", ["Lake Nipigon"], []),
    ("Lac Mistassini", ["Lake Mistassini"], []), ("Lac des Bois", ["Lake of the Woods"], []),
    ("Lac Mälar", ["Mälaren"], ["Lac Mälaren"]), ("IJsselmeer", ["IJsselmeer"], []), ("Lac Argentino", ["Lago Argentino"], []),
    ("Lac Buenos Aires", ["Lago Buenos Aires"], ["Lac General Carrera"]), ("Lac Kyoga", ["Lake Kyoga"], []),
    ("Lac Tuz", ["Lake Tuz"], []), ("Lac Assal", ["Lake Assal"], []), ("Lac Poopó", ["Lago Poopó"], []),
    ("Lac Toba", ["Danau Toba"], []), ("Lac Biwa", ["Biwa Ko"], []),
]


def short(nom):
    """« Lac Baïkal » se tape aussi « Baïkal », « Lac de Constance » aussi « Constance »."""
    for p in ("Lac de ", "Lac d'", "Lac des ", "Lac "):
        if nom.startswith(p):
            return [nom[len(p):]]
    return []

lake_feats = {}
for f in J("ne/ne_10m_lakes.geojson")["features"]:
    n = f["properties"].get("name")
    if n:
        lake_feats.setdefault(n, []).append(shape(f["geometry"]).buffer(0))

# Mer Caspienne : le plus grand trou des terres autour de 50° E, 42° N
casp = None
for g in land_shapes:
    for poly in getattr(g, "geoms", [g]):
        for ring in poly.interiors:
            hole = shape({"type": "Polygon", "coordinates": [list(ring.coords)]})
            if box(46, 36, 56, 48).contains(hole.representative_point()) and (casp is None or hole.area > casp.area):
                casp = hole
assert casp is not None

lakes, body, minis = [], ['<g data-layer="lacs">'], ['<g data-layer="petits-lacs">']
for i, (nom, ne_names, alias) in enumerate(LAKES):
    code = f"l{i + 1:02d}"
    if nom == "Mer Caspienne":
        g = casp
    else:
        parts = [p for n in ne_names for p in lake_feats.get(n, [])]
        assert parts, nom
        g = unary_union(parts)
    c = g.representative_point()
    lakes.append({"code": code, "nom": nom, "alias": alias + short(nom), "domaine": "physique", "categorie": "lac",
                  "geo": [round(c.x, 3), round(c.y, 3)], "detail": "Lac"})
    body.append(f'<path class="zone lake-z" data-code="{code}" d="{path_d(mapping(g.simplify(0.02)), tf, 0.0)}"/>')
    if proj_area(g) < 4:
        minis.append(marker(*tf(c.x, c.y), "rond", "mini", code))
body.append('</g>')
minis.append('</g>')
base = ['<g data-layer="terres"><path class="land" d="' + land_d + '"/></g>']
open(f"{root}/maps/lacs.svg", "w").write(svg_doc(VIEW, [], base + body + minis))
dump("lacs", "Lacs du monde", lakes)

# ---------- Fleuves ----------
# (nom français, noms des tronçons Natural Earth, alias, zone (lon min, lat min, lon max, lat max) pour les noms ambigus)
RIVERS = [
    # Europe
    ("Volga", ["Volga"], [], None), ("Danube", ["Danube", "Donau", "Duna", "Dunav", "Dunărea", "Dunaj"], [], None),
    ("Rhin", ["Rhein", "Rhin", "Rhine", "Rijn"], [], None), ("Rhône", ["Rhône", "Rhone"], [], None),
    ("Loire", ["Loire"], [], None), ("Seine", ["Seine"], [], None), ("Garonne", ["Garonne"], [], None),
    ("Meuse", ["Meuse", "Maas"], [], None), ("Escaut", ["Schelde", "Escaut", "Scheldt"], [], None),
    ("Elbe", ["Elbe", "Labe"], [], None), ("Oder", ["Oder", "Odra"], [], None), ("Vistule", ["Vistula", "Wisla", "Wisła"], [], None),
    ("Dniepr", ["Dnipro", "Dnepre", "Dnieper", "Dnyapro", "Dnepr"], ["Dnipro"], None),
    ("Dniestr", ["Dniester", "Nistru", "Dnister", "Dnestr"], [], None), ("Don", ["Don"], [], (30, 45, 50, 56)),
    ("Oural", ["Ural"], ["Ural"], (45, 45, 62, 56)), ("Tamise", ["Thames"], [], None), ("Pô", ["Po"], ["Po"], (6, 44, 13, 46.5)),
    ("Tibre", ["Tevere", "Tiber"], [], None), ("Èbre", ["Ebro"], [], None), ("Tage", ["Tajo", "Tejo"], [], None),
    ("Douro", ["Duero", "Douro"], [], None), ("Guadalquivir", ["Guadalquivir"], [], None), ("Guadiana", ["Guadiana"], [], None),
    ("Neva", ["Neva"], [], None), ("Daugava", ["Daugava", "Zapadnaya Dvina"], ["Dvina occidentale"], None),
    ("Dvina septentrionale", ["Severnaya Dvina"], [], None), ("Petchora", ["Pechora"], [], None), ("Kama", ["Kama"], [], None),
    ("Niémen", ["Neman", "Nemunas", "Nyoman"], [], None), ("Tisza", ["Tisza", "Tisa"], ["Tisa"], None),
    ("Save", ["Sava"], ["Sava"], None), ("Drave", ["Drava", "Drau"], [], None), ("Weser", ["Weser"], [], None),
    ("Shannon", ["Shannon"], [], None), ("Moselle", ["Moselle", "Mosel"], [], None),
    # Asie
    ("Ienisseï", ["Yenisey"], ["Iénisséï"], None), ("Ob", ["Ob", "Ob'"], [], None), ("Irtych", ["Irtysh", "Ertis", "Ertix"], [], None),
    ("Léna", ["Lena"], [], None), ("Amour", ["Amur", "Heilong Jiang"], [], None), ("Kolyma", ["Kolyma"], [], None),
    ("Indiguirka", ["Indigirka"], [], None), ("Angara", ["Angara"], [], None), ("Selenga", ["Selenga", "Selenge"], [], None),
    ("Yangzi Jiang", ["Yangtze", "Chang Jiang", "Jinsha", "Tongtian", "Tuotuo"], ["Yangtsé", "Fleuve Bleu", "Yangtze"], None),
    ("Huang He", ["Huang"], ["Fleuve Jaune"], None), ("Mékong", ["Mekong", "Lancang"], [], None),
    ("Salouen", ["Salween", "Nu"], [], None), ("Irrawaddy", ["Ayeyarwady", "Irrawaddy"], [], None),
    ("Gange", ["Ganges", "Ganga"], [], None), ("Brahmapoutre", ["Brahmaputra", "Yarlung", "Dihang", "Jamuna"], [], None),
    ("Indus", ["Indus"], [], None), ("Euphrate", ["Euphrates", "Firat", "Al Furat"], [], None),
    ("Tigre", ["Tigris", "Dicle", "Dijlah"], [], None), ("Amou-Daria", ["Amu  Darya", "Amu Darya"], ["Amou Darya"], None),
    ("Syr-Daria", ["Syr  Darya", "Syr Darya"], ["Syr Darya"], None), ("Xi Jiang", ["Xi"], [], (104, 21, 114, 26)),
    ("Godavari", ["Godävari", "Godavari"], [], None), ("Krishna", ["Krishna"], [], None),
    ("Chatt-el-Arab", ["Shatt al Arab"], [], None), ("Jourdain", ["Jordan"], [], (35, 29, 36.5, 34)),
    ("Tarim", ["Tarim"], [], None), ("Oussouri", ["Ussuri", "Wusuli"], [], None),
    # Afrique
    ("Nil", ["Nile", "El Bahr el Abyad", "Bahr el Jebel", "Albert Nile", "Victoria Nile"], [], None),
    ("Nil Bleu", ["El Bahr el Azraq", "Abay"], [], None), ("Congo", ["Congo", "Lualaba"], [], None),
    ("Niger", ["Niger"], [], None), ("Zambèze", ["Zambezi", "Zambeze"], [], None), ("Orange", ["Orange"], [], (14, -32, 30, -25)),
    ("Limpopo", ["Limpopo"], [], None), ("Sénégal", ["Sénégal", "Senegal"], [], None), ("Volta", ["Volta"], [], (-3, 5, 2, 12)),
    ("Oubangui", ["Ubangi"], [], None), ("Kasaï", ["Kasai"], [], None), ("Okavango", ["Okavango", "Cubango"], [], None),
    ("Bénoué", ["Benue", "Bénoué"], [], None), ("Chari", ["Chari"], [], None), ("Vaal", ["Vaal"], [], None),
    # Amérique du Nord
    ("Mississippi", ["Mississippi"], [], None), ("Missouri", ["Missouri"], [], None), ("Ohio", ["Ohio"], [], None),
    ("Saint-Laurent", ["St. Lawrence"], [], None), ("Mackenzie", ["Mackenzie"], [], None), ("Yukon", ["Yukon"], [], None),
    ("Colorado", ["Colorado"], [], (-120, 28, -104, 42)), ("Rio Grande", ["Rio Grande", "Grande", "Río Bravo"], ["Rio Bravo"], (-110, 24, -96, 38.5)),
    ("Columbia", ["Columbia"], [], None), ("Fraser", ["Fraser"], [], None), ("Arkansas", ["Arkansas"], [], None),
    ("Tennessee", ["Tennessee"], [], None), ("Nelson", ["Nelson"], [], None), ("Hudson", ["Hudson"], [], (-75, 40, -73, 44)),
    ("Snake", ["Snake"], [], None), ("Rivière de la Paix", ["Peace"], ["Peace"], None),
    ("Saskatchewan", ["Saskatchewan", "North Saskatchewan", "South Saskatchewan"], [], None),
    ("Outaouais", ["Ottawa", "R. des Outaouais"], ["Ottawa"], None), ("Niagara", ["Niagara"], [], None),
    ("Rivière Rouge", ["Red"], [], (-103, 30, -91, 36)),
    # Amérique du Sud
    ("Amazone", ["Amazonas", "Amazon", "Solimões"], [], None), ("Paraná", ["Paraná", "Parana"], [], None),
    ("Orénoque", ["Orinoco"], [], None), ("Rio Negro", ["Negro"], [], (-73, -4, -58, 4)), ("Madeira", ["Madeira"], [], None),
    ("Uruguay", ["Uruguay"], [], None), ("São Francisco", ["São  Francisco", "São Francisco"], ["Sao Francisco"], None),
    ("Tocantins", ["Tocantins"], [], None), ("Araguaia", ["Araguaia"], [], None), ("Xingu", ["Xingu"], [], None),
    ("Tapajós", ["Tapajós"], [], None), ("Magdalena", ["Magdalena"], [], None),
    ("Juruá", ["Juruá"], [], None), ("Ucayali", ["Ucayali"], [], None), ("Marañón", ["Marañón"], [], None),
    # Océanie
    ("Murray", ["Murray"], [], None), ("Darling", ["Darling"], [], None),
]

seg = {}
for f in J("ne/ne_10m_rivers_lake_centerlines.geojson")["features"]:
    q = f["properties"]
    if q.get("name") and f["geometry"]:
        seg.setdefault(q["name"], []).append(shape(f["geometry"]))

rivers, missing = [], []
lines = ['<g data-layer="fleuves">']
hits = ['<g data-layer="fleuves-toucher">']
for i, (nom, ne_names, alias, bb) in enumerate(RIVERS):
    parts = []
    for n in ne_names:
        for s in seg.get(n, []):
            if bb is None or box(*bb).intersects(s):
                parts.append(s)
    if not parts:
        missing.append(nom)
        continue
    u = unary_union(parts)
    g = (linemerge(u) if u.geom_type == "MultiLineString" else u).simplify(0.03)
    code = f"r{i + 1:03d}"
    c = g.interpolate(0.5, normalized=True) if g.geom_type == "LineString" else max(g.geoms, key=lambda x: x.length).interpolate(0.5, normalized=True)
    rivers.append({"code": code, "nom": nom, "alias": alias, "domaine": "physique", "categorie": "fleuve",
                   "geo": [round(c.x, 3), round(c.y, 3)], "detail": "Fleuve"})
    d = line_d(mapping(g), tf)
    lines.append(f'<path class="riv" data-code="{code}" d="{d}"/>')
    hits.append(f'<path class="riv-hit" data-code="{code}" d="{d}"/>')
lines.append('</g>')
hits.append('</g>')
open(f"{root}/maps/fleuves.svg", "w").write(svg_doc(VIEW, [], base + lines + hits))
dump("fleuves", "Fleuves du monde", rivers)
print(len(lakes), "lacs ·", len(rivers), "fleuves · absents :", ", ".join(missing) or "aucun")
for n in ("lacs", "fleuves"):
    print(n, os.path.getsize(f"{root}/maps/{n}.svg"), "octets")
