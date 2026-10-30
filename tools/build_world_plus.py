"""Pays ++ : les 197 pays, plus les États non reconnus et les territoires habités.

Usage : python3 -I tools/build_world_plus.py <dossier des sources> <racine du dépôt>
À lancer après build_world.py (reprend data/pays.json). Sources (Natural Earth, domaine public) :
  world-units.geojson  (ne_50m_admin_0_countries sans fusion, voir README)
  breakaway.geojson    (ne_10m_admin_0_disputed_areas : Abkhazie, Ossétie du Sud, Transnistrie, Gibraltar)
"""
import json
import os
import sys

from shapely.geometry import shape, mapping

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, svg_doc, marker, rings  # noqa: E402
from worldproj import tf, VIEW  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))

pays = json.load(open(f"{root}/data/pays.json"))["items"]
units = {f["properties"]["code"]: shape(f["geometry"]).buffer(0) for f in J("world-units.geojson")["features"]}
brk = {f["properties"]["code"]: shape(f["geometry"]).buffer(0) for f in J("breakaway.geojson")["features"]}

LIMITE = {"KOS", "TWN", "PSX"}
# (code, nom, alias, continent, statut, souverain ou revendiquant, source géométrique)
EXTRA = [
    ("SOL", "Somaliland", [], "Afrique", "non", "Somalie", "SOL"),
    ("CYN", "Chypre du Nord", ["République turque de Chypre du Nord"], "Europe", "lim", "Chypre", "CYN"),
    ("ABK", "Abkhazie", [], "Europe", "lim", "Géorgie", "B35"),
    ("OSS", "Ossétie du Sud", [], "Europe", "lim", "Géorgie", "B37"),
    ("TRN", "Transnistrie", [], "Europe", "non", "Moldavie", "B36"),
    ("SAH", "Sahara occidental", [], "Afrique", "dis", "Maroc", "SAH"),
    ("GRL", "Groenland", [], "Amérique du Nord", "ter", "Danemark", "GRL"),
    ("FRO", "Îles Féroé", ["Féroé"], "Europe", "ter", "Danemark", "FRO"),
    ("ALD", "Åland", ["Îles Åland", "Aland"], "Europe", "ter", "Finlande", "ALD"),
    ("GGY", "Guernesey", [], "Europe", "ter", "Royaume-Uni", "GGY"),
    ("JEY", "Jersey", [], "Europe", "ter", "Royaume-Uni", "JEY"),
    ("IMN", "Île de Man", ["Man"], "Europe", "ter", "Royaume-Uni", "IMN"),
    ("GIB", "Gibraltar", [], "Europe", "ter", "Royaume-Uni", "B55"),
    ("HKG", "Hong Kong", [], "Asie", "ter", "Chine", "HKG"),
    ("MAC", "Macao", ["Macau"], "Asie", "ter", "Chine", "MAC"),
    ("PRI", "Porto Rico", ["Puerto Rico"], "Amérique du Nord", "ter", "États-Unis", "PRI"),
    ("VIR", "Îles Vierges des États-Unis", ["Îles Vierges américaines"], "Amérique du Nord", "ter", "États-Unis", "VIR"),
    ("GUM", "Guam", [], "Océanie", "ter", "États-Unis", "GUM"),
    ("MNP", "Îles Mariannes du Nord", ["Mariannes du Nord"], "Océanie", "ter", "États-Unis", "MNP"),
    ("ASM", "Samoa américaines", [], "Océanie", "ter", "États-Unis", "ASM"),
    ("BMU", "Bermudes", [], "Amérique du Nord", "ter", "Royaume-Uni", "BMU"),
    ("CYM", "Îles Caïmans", ["Caïmans"], "Amérique du Nord", "ter", "Royaume-Uni", "CYM"),
    ("TCA", "Îles Turques-et-Caïques", ["Turques-et-Caïques"], "Amérique du Nord", "ter", "Royaume-Uni", "TCA"),
    ("VGB", "Îles Vierges britanniques", [], "Amérique du Nord", "ter", "Royaume-Uni", "VGB"),
    ("AIA", "Anguilla", [], "Amérique du Nord", "ter", "Royaume-Uni", "AIA"),
    ("MSR", "Montserrat", [], "Amérique du Nord", "ter", "Royaume-Uni", "MSR"),
    ("FLK", "Îles Malouines", ["Malouines", "Îles Falkland", "Falkland"], "Amérique du Sud", "ter", "Royaume-Uni", "FLK"),
    ("SGS", "Géorgie du Sud-et-les Îles Sandwich du Sud", ["Géorgie du Sud"], "Amérique du Sud", "ter", "Royaume-Uni", "SGS"),
    ("SHN", "Sainte-Hélène", ["Sainte-Hélène, Ascension et Tristan da Cunha"], "Afrique", "ter", "Royaume-Uni", "SHN"),
    ("IOT", "Territoire britannique de l'océan Indien", ["Chagos", "Archipel des Chagos"], "Asie", "ter", "Royaume-Uni", "IOT"),
    ("PCN", "Îles Pitcairn", ["Pitcairn"], "Océanie", "ter", "Royaume-Uni", "PCN"),
    ("ABW", "Aruba", [], "Amérique du Nord", "ter", "Pays-Bas", "ABW"),
    ("CUW", "Curaçao", ["Curacao"], "Amérique du Nord", "ter", "Pays-Bas", "CUW"),
    ("SXM", "Sint Maarten", ["Saint-Martin néerlandais"], "Amérique du Nord", "ter", "Pays-Bas", "SXM"),
    ("MAF", "Saint-Martin", [], "Amérique du Nord", "ter", "France", "MAF"),
    ("BLM", "Saint-Barthélemy", [], "Amérique du Nord", "ter", "France", "BLM"),
    ("SPM", "Saint-Pierre-et-Miquelon", [], "Amérique du Nord", "ter", "France", "SPM"),
    ("NCL", "Nouvelle-Calédonie", [], "Océanie", "ter", "France", "NCL"),
    ("PYF", "Polynésie française", ["Polynésie"], "Océanie", "ter", "France", "PYF"),
    ("WLF", "Wallis-et-Futuna", [], "Océanie", "ter", "France", "WLF"),
    ("ATF", "Terres australes et antarctiques françaises", ["TAAF", "Terres australes françaises", "Kerguelen"], "Afrique", "ter", "France", "ATF"),
    ("COK", "Îles Cook", ["Cook"], "Océanie", "ter", "Nouvelle-Zélande", "COK"),
    ("NIU", "Niue", ["Niué"], "Océanie", "ter", "Nouvelle-Zélande", "NIU"),
    ("NFK", "Île Norfolk", ["Norfolk"], "Océanie", "ter", "Australie", "NFK"),
    ("IOA", "Île Christmas et îles Cocos", ["Île Christmas", "Îles Cocos", "Christmas", "Cocos"], "Asie", "ter", "Australie", "IOA"),
]
STATUT = {
    "ok": "Pays reconnu", "lim": "Reconnaissance limitée", "non": "Non reconnu",
    "dis": "Territoire disputé", "ter": "Territoire",
}

# Les régions sécessionnistes sont découpées dans leur pays (frontières communes exactes).
geom = {}
for it in pays:
    geom[it["code"]] = units[it["code"]]
for code, *_, s in EXTRA:
    geom[code] = brk[s] if s in brk else units[s]
for parent, kids in {"GEO": ["ABK", "OSS"], "MDA": ["TRN"]}.items():
    for k in kids:
        geom[k] = geom[k].intersection(geom[parent]).buffer(0)
        geom[parent] = geom[parent].difference(geom[k]).buffer(0)

items = []
for it in pays:
    st = "lim" if it["code"] in LIMITE else "ok"
    items.append({**{k: it[k] for k in ("code", "nom", "alias", "domaine", "continent", "geo")},
                  "statut": STATUT[st], "st": st, "detail": f"{it['continent']} · {STATUT[st]}"})
for code, nom, alias, cont, st, sov, _ in EXTRA:
    c = geom[code].representative_point()
    lien = "rattaché à" if st == "ter" else "revendiqué par"
    items.append({"code": code, "nom": nom, "alias": alias, "domaine": "zone", "continent": cont,
                  "geo": [round(c.x, 3), round(c.y, 3)], "statut": STATUT[st], "st": st,
                  "detail": f"{cont} · {STATUT[st]} · {lien} : {sov}"})
items.sort(key=lambda x: x["nom"])
json.dump({"id": "pays-plus", "titre": "Pays et territoires", "items": items},
          open(f"{root}/data/pays-plus.json", "w"), ensure_ascii=False, indent=1)


def proj_area(g):
    a = 0
    for ring in rings(mapping(g)):
        pts = [tf(*c[:2]) for c in ring]
        a += abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2
    return a


used = set(geom)
body = ['<g data-layer="pays">']
for c, g in units.items():  # décor : Antarctique, îles inhabitées
    if c not in used and c not in ("SOL", "CYN"):
        body.append(f'<path class="zone" data-code="x-{c}" d="{path_d(mapping(g), tf, 0.05)}"/>')
for it in items:
    body.append(f'<path class="zone st-{it["st"]}" data-code="{it["code"]}" d="{path_d(mapping(geom[it["code"]]), tf, 0.05)}"/>')
body.append('</g><g data-layer="micro-etats">')
small = 0
for it in items:
    if proj_area(geom[it["code"]]) < 6:
        small += 1
        body.append(marker(*tf(*it["geo"]), "rond", f"mini st-{it['st']}", it["code"]))
body.append('</g>')
open(f"{root}/maps/monde-plus.svg", "w").write(svg_doc(VIEW, [], body))
print(len(items), "éléments ·", small, "marqués ·", os.path.getsize(f"{root}/maps/monde-plus.svg"), "octets")
