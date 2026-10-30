"""Cartes et données du monde : 197 pays, leurs capitales, les 101 mers et océans de l'OHI.

Usage : python3 -I tools/build_world.py <dossier des sources> <racine du dépôt>
Sources (voir README) :
  world-countries.geojson, world-land.geojson   (Natural Earth 50m, fusions et simplification mapshaper)
  world-seas.geojson                             (OHI, zones maritimes v3, Marine Regions, CC-BY 4.0)
  ne/ne_50m_admin_0_countries.geojson, ne/ne_10m_populated_places.geojson
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import path_d, centroid, svg_doc, marker, rings  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))


# ---------- Projection Natural Earth (Šavrič et al.) ----------
def natural_earth(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p
    p4 = p2 * p2
    x = l * (0.870700 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y


W = 1000
XMAX = natural_earth(180, 0)[0]
YTOP, YBOT = natural_earth(0, 84)[1], natural_earth(0, -60)[1]  # Antarctique coupé à 60° S
S = (W - 20) / (2 * XMAX)
H = round((YBOT - YTOP) * S + 20)


def tf(lon, lat):
    x, y = natural_earth(max(-180, min(180, lon)), max(-90, min(90, lat)))
    return 10 + (x + XMAX) * S, 10 + (y - YTOP) * S


VIEW = f"0 0 {W} {H}"

# ---------- Pays : 193 membres de l'ONU + Vatican, Palestine, Kosovo, Taïwan ----------
ne = {f["properties"]["ADM0_A3"]: f["properties"] for f in J("ne/ne_50m_admin_0_countries.geojson")["features"]}
shapes = {f["properties"]["code"]: f["geometry"] for f in J("world-countries.geojson")["features"]}
SOV = sorted(c for c, p in ne.items()
             if p["TYPE"] in ("Sovereign country", "Country", "Sovereignty", "Disputed")
             and p["SOVEREIGNT"] == p["ADMIN"] and c not in ("SOL", "CYN")) + ["PSX"]
assert len(SOV) == 197, len(SOV)

NOM = {"CHN": "Chine", "COG": "Congo", "VAT": "Vatican", "FSM": "Micronésie", "VNM": "Viêt Nam",
       "MHL": "Îles Marshall", "SLB": "Îles Salomon", "BHS": "Bahamas", "GMB": "Gambie", "PSX": "Palestine"}
ALIAS = {
    "COD": ["RDC", "Congo-Kinshasa", "République démocratique du Congo"],
    "COG": ["Congo-Brazzaville", "République du Congo"],
    "CZE": ["République tchèque"], "MMR": ["Myanmar"], "SWZ": ["Swaziland"], "TLS": ["Timor-Leste"],
    "VNM": ["Vietnam"], "KNA": ["Saint-Kitts-et-Nevis"], "SLV": ["El Salvador"], "CPV": ["Cabo Verde"],
    "MHL": ["Marshall"], "SLB": ["Salomon"], "FSM": ["États fédérés de Micronésie"], "VAT": ["Cité du Vatican", "Saint-Siège"],
    "USA": ["USA"], "GBR": ["Angleterre"], "NLD": ["Hollande"], "BLR": ["Bélarus"], "MKD": ["Macédoine"],
    "BHS": ["Les Bahamas"], "GMB": ["La Gambie"], "CIV": ["Ivory Coast"], "TWN": ["Formose"], "KOR": ["Corée"],
    "ARE": ["Émirats"], "CAF": ["Centrafrique"], "DOM": ["Dominicaine"], "STP": ["São Tomé-et-Príncipe"],
    "BIH": ["Bosnie"], "PNG": ["Papouasie"], "TTO": ["Trinidad-et-Tobago"], "GNQ": ["Guinée-Équatoriale"],
}
CONT = {"Africa": "Afrique", "Europe": "Europe", "Asia": "Asie", "North America": "Amérique du Nord",
        "South America": "Amérique du Sud", "Oceania": "Océanie", "Seven seas (open ocean)": "Océanie"}
CONT_FIX = {"PSX": "Asie", "RUS": "Europe", "TUR": "Asie"}

# ---------- Capitales ----------
places = J("ne/ne_10m_populated_places.geojson")["features"]
CAP_PICK = {"BEN": "Porto-Novo", "BOL": "Sucre", "CIV": "Yamoussoukro", "ISR": "Jerusalem", "MYS": "Kuala Lumpur",
            "MMR": "Naypyidaw", "NLD": "Amsterdam", "NGA": "Abuja", "ZAF": "Pretoria", "LKA": "Sri Jayawardenepura Kotte",
            "TZA": "Dodoma", "SWZ": "Mbabane", "CHL": "Santiago", "JPN": "Tokyo", "MAR": "Rabat", "PHL": "Manila",
            "PSX": "Ramallah", "SOM": "Mogadishu", "GEO": "Tbilisi", "GBR": "London", "SRB": "Belgrade",
            "BIH": "Sarajevo", "PRT": "Lisbon", "TWN": "Taipei"}
CAP_FR = {"KAZ": "Astana", "UKR": "Kiev", "LKA": "Sri Jayawardenapura-Kotte", "BGD": "Dacca", "KWT": "Koweït",
          "GTM": "Guatemala", "PAN": "Panama", "VAT": "Vatican", "MDA": "Chișinău", "PRY": "Asuncion",
          "ATG": "Saint John's", "GRD": "Saint-Georges", "KIR": "Tarawa-Sud", "TON": "Nukuʻalofa",
          "PSX": "Ramallah", "MEX": "Mexico", "ISL": "Reykjavik", "BRA": "Brasilia", "NPL": "Katmandou"}
CAP_ALIAS = {
    "BOL": ["La Paz"], "ZAF": ["Le Cap", "Bloemfontein"], "MYS": ["Putrajaya"], "SWZ": ["Lobamba"],
    "UKR": ["Kyiv"], "KAZ": ["Nour-Soultan", "Noursoultan"], "BGD": ["Dhaka"], "KWT": ["Koweït City", "Koweït-Ville"],
    "GTM": ["Guatemala-Ville", "Guatemala City"], "PAN": ["Panama City"], "VAT": ["Cité du Vatican"],
    "MMR": ["Nay Pyi Taw", "Naypyitaw"], "MNG": ["Oulan Bator", "Ulaanbaatar"], "PSX": ["Jérusalem-Est"],
    "KIR": ["Tarawa"], "GRD": ["Saint George's"], "TTO": ["Port of Spain"], "PRY": ["Asunción"],
    "STP": ["Sao Tomé"], "MDV": ["Male"], "TCD": ["Ndjamena"], "CHN": ["Beijing"], "IND": ["Delhi"],
    "MEX": ["Mexico City"], "LKA": ["Kotte"], "BRA": ["Brasília"], "COL": ["Bogotá"], "ISL": ["Reykjavík"],
    "MDA": ["Kichinev"], "DNK": ["Kobenhavn"], "ARE": ["Abu Dhabi"], "SAU": ["Riyadh"], "OMN": ["Muscat"],
    "TKM": ["Achkhabad"], "KGZ": ["Bichkek"], "MRT": ["Nouakchott"], "ETH": ["Addis Abeba"],
}
EXTRA = {  # capitales absentes de Natural Earth (lon, lat)
    "BDI": ("Gitega", [29.9246, -3.4271]), "SDS": ("Djouba", [31.5825, 4.8517]), "PLW": ("Ngerulmud", [134.6243, 7.5006]), "NRU": ("Yaren", [166.9209, -0.5477]),
}
by_country = {}
for f in places:
    q = f["properties"]
    if q["FEATURECLA"] in ("Admin-0 capital", "Admin-0 capital alt", "Admin-0 region capital"):
        by_country.setdefault(q["ADM0_A3"], []).append((q, f["geometry"]["coordinates"]))
by_country.setdefault("PSX", [])
by_country["SDS"] = by_country.pop("SSD", [])  # code du Soudan du Sud différent dans les villes
if not any(q["NAME"] == "Ramallah" for q, _ in by_country["PSX"]):
    for f in places:
        if f["properties"]["NAME"] == "Ramallah":
            by_country["PSX"].append((f["properties"], f["geometry"]["coordinates"]))
            break


def capital(code):
    if code in EXTRA:
        return EXTRA[code][0], EXTRA[code][1]
    cands = by_country.get(code, [])
    if code in CAP_PICK:
        cands = [c for c in cands if c[0]["NAME"] == CAP_PICK[code]]
    else:
        cands = [c for c in cands if c[0]["FEATURECLA"] == "Admin-0 capital"]
    assert len(cands) == 1, (code, [c[0]["NAME"] for c in cands])
    q, xy = cands[0]
    return CAP_FR.get(code, q["NAME_FR"] or q["NAME"]), xy


countries, caps = [], []
for c in SOV:
    p = ne[c]
    nom = NOM.get(c, p["NAME_FR"])
    cap, cxy = capital(c)
    en = p["NAME_EN"]
    alias = [a for a in ALIAS.get(c, []) if a != nom]
    if p["NAME_FR"] != nom and p["NAME_FR"] not in alias:
        alias.append(p["NAME_FR"])
    cont = CONT_FIX.get(c, CONT.get(p["CONTINENT"], p["CONTINENT"]))
    geom = shapes[c]
    lx, ly = (p.get("LABEL_X"), p.get("LABEL_Y")) if p.get("LABEL_X") else centroid(geom)
    countries.append({"code": c, "nom": nom, "alias": alias, "domaine": "zone", "continent": cont,
                      "geo": [round(lx, 3), round(ly, 3)], "capitale": cap, "detail": f"{cont} · capitale : {cap}"})
    cap_en = next((q["NAME"] for q, _ in by_country.get(c, []) if (CAP_FR.get(c) or q["NAME_FR"]) == cap), None)
    calias = list(CAP_ALIAS.get(c, []))
    if cap_en and cap_en != cap and cap_en not in calias and "," not in cap_en:
        calias.append(cap_en)
    caps.append({"code": f"c-{c}", "nom": cap, "alias": calias, "domaine": "ville", "pays": nom, "paysCode": c,
                 "continent": cont, "geo": [round(cxy[0], 4), round(cxy[1], 4)], "detail": f"Capitale · {nom}"})

countries.sort(key=lambda x: x["nom"])
caps.sort(key=lambda x: x["pays"])


def dump(name, titre, items):
    json.dump({"id": name, "titre": titre, "items": items},
              open(f"{root}/data/{name}.json", "w"), ensure_ascii=False, indent=1)


dump("pays", "Pays du monde", countries)
dump("capitales", "Capitales du monde", caps)

# ---------- Carte du monde : pays, micro-États, capitales ----------
def proj_area(geom):
    a = 0
    for ring in rings(geom):
        pts = [tf(*c[:2]) for c in ring]
        a += abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2
    return a


body = ['<g data-layer="pays">']
deco = [c for c in shapes if c not in SOV]
# Territoires : rattachés à leur pays souverain (le Groenland se teinte quand le Danemark est trouvé).
sov_code = {ne[c]["ADMIN"]: c for c in SOV if c in ne}
for c in deco:
    parent = sov_code.get(ne.get(c, {}).get("SOVEREIGNT"))
    attr = f' data-parent="{parent}"' if parent and parent != c else ""
    body.append(f'<path class="zone" data-code="x-{c}"{attr} d="{path_d(shapes[c], tf, 0.05)}"/>')
for c in SOV:
    body.append(f'<path class="zone" data-code="{c}" d="{path_d(shapes[c], tf, 0.05)}"/>')
body.append('</g><g data-layer="micro-etats">')
small = []
for it in countries:
    if proj_area(shapes[it["code"]]) < 6:
        small.append(it["nom"])
        body.append(marker(*tf(*it["geo"]), "rond", "mini", it["code"]))
body.append('</g><g data-layer="capitales">')
for it in caps:
    body.append(marker(*tf(*it["geo"]), "carre", "cap", it["code"]))
body.append('</g>')
open(f"{root}/maps/monde.svg", "w").write(svg_doc(VIEW, [], body))
print("micro-États marqués :", len(small), ", ".join(small))

# ---------- Mers et océans (OHI) ----------
SEAS = {
    "Adriatic Sea": ("Mer Adriatique", []), "Aegean Sea": ("Mer Égée", []), "Alboran Sea": ("Mer d'Alboran", []),
    "Andaman or Burma Sea": ("Mer d'Andaman", []), "Arabian Sea": ("Mer d'Arabie", ["Mer d'Oman"]),
    "Arafura Sea": ("Mer d'Arafura", []), "Arctic Ocean": ("Océan Arctique", []), "Baffin Bay": ("Baie de Baffin", []),
    "Balearic (Iberian Sea)": ("Mer des Baléares", ["Mer Ibérique"]), "Bali Sea": ("Mer de Bali", []),
    "Baltic Sea": ("Mer Baltique", []), "Banda Sea": ("Mer de Banda", []), "Barentsz Sea": ("Mer de Barents", []),
    "Bass Strait": ("Détroit de Bass", []), "Bay of Bengal": ("Golfe du Bengale", ["Baie du Bengale"]),
    "Bay of Biscay": ("Golfe de Gascogne", []), "Bay of Fundy": ("Baie de Fundy", []),
    "Beaufort Sea": ("Mer de Beaufort", []), "Bering Sea": ("Mer de Béring", []), "Bismarck Sea": ("Mer de Bismarck", []),
    "Black Sea": ("Mer Noire", []), "Bristol Channel": ("Canal de Bristol", []),
    "Caribbean Sea": ("Mer des Caraïbes", ["Mer des Antilles"]), "Celebes Sea": ("Mer de Célèbes", []),
    "Celtic Sea": ("Mer Celtique", []), "Ceram Sea": ("Mer de Seram", ["Mer de Céram"]),
    "Chukchi Sea": ("Mer des Tchouktches", []), "Coral Sea": ("Mer de Corail", []), "Davis Strait": ("Détroit de Davis", []),
    "East Siberian Sea": ("Mer de Sibérie orientale", []), "Eastern China Sea": ("Mer de Chine orientale", []),
    "English Channel": ("Manche", []), "Flores Sea": ("Mer de Florès", []),
    "Great Australian Bight": ("Grande Baie australienne", []), "Greenland Sea": ("Mer du Groenland", []),
    "Gulf of Aden": ("Golfe d'Aden", []), "Gulf of Alaska": ("Golfe d'Alaska", []), "Gulf of Aqaba": ("Golfe d'Aqaba", []),
    "Gulf of Boni": ("Golfe de Bone", ["Golfe de Boni"]), "Gulf of Bothnia": ("Golfe de Botnie", []),
    "Gulf of California": ("Golfe de Californie", []), "Gulf of Finland": ("Golfe de Finlande", []),
    "Gulf of Guinea": ("Golfe de Guinée", []), "Gulf of Mexico": ("Golfe du Mexique", []), "Gulf of Oman": ("Golfe d'Oman", []),
    "Gulf of Riga": ("Golfe de Riga", []), "Gulf of St. Lawrence": ("Golfe du Saint-Laurent", []),
    "Gulf of Suez": ("Golfe de Suez", []), "Gulf of Thailand": ("Golfe de Thaïlande", []), "Gulf of Tomini": ("Golfe de Tomini", []),
    "Halmahera Sea": ("Mer d'Halmahera", []), "Hudson Bay": ("Baie d'Hudson", []), "Hudson Strait": ("Détroit d'Hudson", []),
    "Indian Ocean": ("Océan Indien", []),
    "Inner Seas off the West Coast of Scotland": ("Mers intérieures d'Écosse", ["Mer des Hébrides"]),
    "Ionian Sea": ("Mer Ionienne", []), "Irish Sea and St. George's Channel": ("Mer d'Irlande", ["Canal Saint-Georges"]),
    "Japan Sea": ("Mer du Japon", []), "Java Sea": ("Mer de Java", []), "Kara Sea": ("Mer de Kara", []),
    "Kattegat": ("Cattégat", ["Kattegat"]), "Labrador Sea": ("Mer du Labrador", []), "Laccadive Sea": ("Mer des Laquedives", []),
    "Laptev Sea": ("Mer de Laptev", []), "Ligurian Sea": ("Mer Ligurienne", ["Mer de Ligurie"]), "Lincoln Sea": ("Mer de Lincoln", []),
    "Makassar Strait": ("Détroit de Makassar", []), "Malacca Strait": ("Détroit de Malacca", []),
    # Regroupés (décision du 29 octobre 2026) : l'OHI coupe ces trois étendues, l'usage courant non.
    "Mediterranean Sea - Eastern Basin": ("Mer Méditerranée", ["Méditerranée"]),
    "Mediterranean Sea - Western Basin": ("Mer Méditerranée", ["Méditerranée"]),
    "Molukka Sea": ("Mer des Moluques", []), "Mozambique Channel": ("Canal du Mozambique", []),
    "North Atlantic Ocean": ("Océan Atlantique", ["Atlantique"]),
    "North Pacific Ocean": ("Océan Pacifique", ["Pacifique"]),
    "North Sea": ("Mer du Nord", []), "Norwegian Sea": ("Mer de Norvège", []),
    "Persian Gulf": ("Golfe Persique", ["Golfe arabo-persique"]), "Philippine Sea": ("Mer des Philippines", []),
    "Red Sea": ("Mer Rouge", []), "Rio de La Plata": ("Río de la Plata", []), "Savu Sea": ("Mer de Savu", []),
    "Sea of Azov": ("Mer d'Azov", []), "Sea of Marmara": ("Mer de Marmara", []), "Sea of Okhotsk": ("Mer d'Okhotsk", []),
    "Seto Naikai or Inland Sea": ("Mer intérieure de Seto", ["Seto Naikai"]), "Singapore Strait": ("Détroit de Singapour", []),
    "Skagerrak": ("Skagerrak", []), "Solomon Sea": ("Mer des Salomon", []),
    "South Atlantic Ocean": ("Océan Atlantique", ["Atlantique"]),
    "South China Sea": ("Mer de Chine méridionale", []),
    "South Pacific Ocean": ("Océan Pacifique", ["Pacifique"]),
    "Southern Ocean": ("Océan Austral", []), "Strait of Gibraltar": ("Détroit de Gibraltar", []),
    "Sulu Sea": ("Mer de Sulu", []), "Tasman Sea": ("Mer de Tasman", []),
    "The Coastal Waters of Southeast Alaska and British Columbia": ("Eaux côtières de l'Alaska et de la Colombie-Britannique", []),
    "The Northwestern Passages": ("Passage du Nord-Ouest", ["Passages du Nord-Ouest"]),
    "Timor Sea": ("Mer de Timor", []), "Tyrrhenian Sea": ("Mer Tyrrhénienne", []), "White Sea": ("Mer Blanche", []),
    "Yellow Sea": ("Mer Jaune", []),
}
def geoms(doc):
    return [f["geometry"] for f in doc["features"]] if "features" in doc else doc["geometries"]


sea_feats = J("world-seas.geojson")["features"]
assert len(sea_feats) == 101 and all(f["properties"]["NAME"] in SEAS for f in sea_feats)
land_d = "".join(path_d(g, tf, 0.05) for g in geoms(J("world-land.geojson")))

# Les côtes des zones OHI disponibles sont grossières et ne suivent pas le tracé des terres (Natural Earth).
# On garde les frontières officielles entre mers, et l'on fait épouser aux mers le tracé des terres :
# espace marin = monde − terres ; chaque interstice (mer non couverte, ou terre OHI qui est en fait de la mer)
# est rattaché à la zone voisine avec laquelle il partage le plus de frontière. Les étendues fermées qui ne
# touchent aucune zone (mer Caspienne, grands lacs) restent hors du quiz.
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree

land = unary_union([shape(g).buffer(0) for g in geoms(J("world-land.geojson"))])
ocean = box(-180, -90, 180, 90).difference(land)
zone_geom = {}
for f in sea_feats:
    zone_geom.setdefault(SEAS[f["properties"]["NAME"]][0], []).append(shape(f["geometry"]).buffer(0))
names = sorted(zone_geom)
cores = [unary_union(zone_geom[n]).intersection(ocean) for n in names]
gaps = ocean.difference(unary_union(cores))
tree = STRtree(cores)
extra = {n: [] for n in names}
lakes = []
for piece in getattr(gaps, "geoms", [gaps]):
    if piece.area < 1e-6:
        continue
    near = piece.buffer(0.05)
    best, score = None, 0
    for i in tree.query(near):
        s = near.intersection(cores[i]).area
        if s > score:
            best, score = i, s
    if best is None:
        lakes.append(piece)
    else:
        extra[names[best]].append(piece)
fitted = {n: unary_union([c, *extra[n]]) for n, c in zip(names, cores)}
print("interstices rattachés :", sum(len(v) for v in extra.values()), "· étendues fermées hors quiz :", len(lakes))
seas, body = [], ['<g data-layer="mers">']
# Un élément par nom français : les zones regroupées partagent un code et sont dessinées en plusieurs morceaux.
groups = {}
for f in sorted(sea_feats, key=lambda f: f["properties"]["NAME"]):
    groups.setdefault(SEAS[f["properties"]["NAME"]][0], []).append(f)
for i, (nom, feats) in enumerate(sorted(groups.items(), key=lambda kv: kv[0])):
    alias = SEAS[feats[0]["properties"]["NAME"]][1]
    code = f"m{i + 1:03d}"
    first = nom.split()[0].lower().replace("é", "e").replace("è", "e")
    gen = first if first in ("mer", "mers", "golfe", "baie", "detroit", "canal", "ocean", "passage", "eaux") else None
    kind = "océan" if nom.startswith("Océan") else "mer"
    big = max(feats, key=lambda f: len(json.dumps(f["geometry"])))
    seas.append({"code": code, "nom": nom, "alias": alias, "domaine": "physique", "categorie": kind, "gen": gen,
                 "geo": [round(v, 2) for v in centroid(big["geometry"])],
                 "detail": "OHI : " + " + ".join(f["properties"]["NAME"] for f in feats)})
    body.append(f'<path class="zone sea" data-code="{code}" d="{path_d(mapping(fitted[nom]), tf, 0.02)}"/>')
# Terres par-dessus (trait de côte net), et étendues fermées (Caspienne…) en décor.
lake_d = "".join(path_d(mapping(l), tf, 0.02) for l in lakes)
body.append('</g><g data-layer="terres"><path class="lake" d="' + lake_d + '"/><path class="land" d="' + land_d + '"/></g>')
open(f"{root}/maps/mers.svg", "w").write(svg_doc(VIEW, [], body))
dump("mers", "Mers et océans (OHI)", seas)
for n in ("monde", "mers"):
    print(n, os.path.getsize(f"{root}/maps/{n}.svg"), "octets")
print(len(countries), "pays,", len(caps), "capitales,", len(seas), "mers et océans")
