"""Cartes et données des États-Unis et du Canada, avec leurs capitales.

Usage : python3 -I tools/build_na.py <dossier des sources> <racine du dépôt>
Sources (Natural Earth, domaine public) :
  us.geojson, ca.geojson   (ne_50m_admin_1_states_provinces filtré et simplifié, voir README)
  ne/ne_10m_populated_places_simple.geojson, ne/ne_10m_populated_places.geojson
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import lcc, equi, fit, path_d, centroid, svg_doc, esc, marker  # noqa: E402
from unicodedata import normalize

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))

ALIAS = {"NY": ["État de New York"], "HI": ["Hawaii"]}
NAME = {"NY": "New York"}
CAP_NAME = {"Washington,  D.C.": None, "St.  Paul": "Saint Paul"}
CAP_ALIAS = {"NL": ["Saint-Jean de Terre-Neuve"], "QC": ["Ville de Québec"]}

# Capitales : Natural Earth, « Admin-1 capital » (Toronto pour l'Ontario, pas Ottawa)
places = J("ne/ne_10m_populated_places_simple.geojson")["features"]


def capitals(adm0):
    out = {}
    for f in places:
        p = f["properties"]
        if p["adm0_a3"] == adm0 and p.get("featurecla") == "Admin-1 capital":
            out[p["adm1name"]] = (p["name"], f["geometry"]["coordinates"])
    return out


def unwrap(geom):
    """Aléoutiennes : longitudes positives ramenées à l'ouest pour ne pas couper la carte."""
    def fix(c):
        return [c[0] - 360 if c[0] > 0 else c[0], c[1]]
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [[fix(c) for c in r] for r in geom["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[[fix(c) for c in r] for r in p] for p in geom["coordinates"]]}


def items_and_points(feats, caps, prefix_detail):
    zones, cities = [], []
    for f in feats:
        p = f["properties"]
        code = p["postal"]
        if code == "DC":
            continue
        nom = NAME.get(code, p["name_fr"])
        cap = caps.get(p["name"])
        assert cap, p["name"]
        cname = CAP_NAME.get(cap[0], cap[0])
        zones.append({"code": code, "nom": nom, "alias": ALIAS.get(code, []), "domaine": "zone",
                      "geo": [round(v, 4) for v in centroid(f["geometry"])], "detail": f"Capitale : {cname}"})
        cities.append({"code": f"c-{code}", "nom": cname, "alias": CAP_ALIAS.get(code, []), "domaine": "ville",
                       "etat": nom, "etatCode": code, "geo": [round(v, 4) for v in cap[1]],
                       "detail": f"{prefix_detail} · {nom}"})
    return sorted(zones, key=lambda x: x["nom"]), sorted(cities, key=lambda x: x["etat"])


def dump(name, titre, items):
    json.dump({"id": name, "titre": titre, "items": items},
              open(f"{root}/data/{name}.json", "w"), ensure_ascii=False, indent=1)


def write_map(name, viewbox, insets, feats, cities, tf_of, villes=()):
    body = ['<g data-layer="zones">']
    for f in feats:
        code = f["properties"]["postal"]
        tf = tf_of(code)
        attr = '' if code == "DC" else f' data-code="{code}"'
        body.append(f'<path class="zone"{attr} d="{path_d(f["geometry"], tf, 0.3)}"/>')
    body.append('</g><g data-layer="capitales">')
    for c in cities:
        x, y = tf_of(c["etatCode"])(*c["geo"])
        body.append(marker(x, y, "carre", "cap", c["code"]))
    body.append('</g>')
    if villes:
        body.append('<g data-layer="villes">')
        for v in villes:
            x, y = tf_of(v["etatCode"])(*v["geo"])
            body.append(marker(x, y, "rond", "ville", v["code"]))
        body.append('</g>')
    open(f"{root}/maps/{name}.svg", "w").write(svg_doc(viewbox, insets, body))
    print(name, os.path.getsize(f"{root}/maps/{name}.svg"), "octets")


# ---------- États-Unis : 48 États contigus, encarts Alaska et Hawaï ----------
us = J("us.geojson")["features"]
for f in us:
    if f["properties"]["postal"] == "AK":
        f["geometry"] = unwrap(f["geometry"])
by = {f["properties"]["postal"]: f for f in us}
W, H = 1000, 780
lower = [f["geometry"] for c, f in by.items() if c not in ("AK", "HI")]
main_tf = fit(lower, lcc(29.5, 45.5, 37.5, -96), (0, 0, W, 610), pad=10)
ak_box, hi_box = (10, 612, 330, 160), (352, 652, 230, 120)
ak_tf = fit([by["AK"]["geometry"]], lcc(55, 65, 50, -154), ak_box, pad=10)
hi_tf = fit([by["HI"]["geometry"]], equi(20.5), hi_box, pad=10)
tf_us = lambda c: ak_tf if c == "AK" else hi_tf if c == "HI" else main_tf
states, us_caps = items_and_points(us, capitals("USA"), "Capitale")
write_map("etats-unis", f"0 0 {W} {H}", [("AK", ak_box), ("HI", hi_box)], us, us_caps, tf_us)
dump("etats-unis", "États des États-Unis", states)
dump("capitales-etats-unis", "Capitales des États américains", us_caps)


# ---------- 100 villes américaines à connaître ----------
# Choix éditorial : les villes principales des plus grandes agglomérations, plus quelques villes
# célèbres pour autre chose que leur taille (Santa Fe, Key West, Atlantic City…).
US100 = [
    ("New York", "NY", []), ("Los Angeles", "CA", []), ("Chicago", "IL", []), ("Houston", "TX", []),
    ("Phoenix", "AZ", []), ("Philadelphie", "PA", ["Philadelphia"]), ("San Antonio", "TX", []),
    ("San Diego", "CA", []), ("Dallas", "TX", []), ("San José", "CA", ["San Jose"]), ("Austin", "TX", []),
    ("Jacksonville", "FL", []), ("Fort Worth", "TX", []), ("Columbus", "OH", []), ("Charlotte", "NC", []),
    ("San Francisco", "CA", []), ("Indianapolis", "IN", []), ("Seattle", "WA", []), ("Denver", "CO", []),
    ("Washington", "DC", ["Washington DC"]), ("Boston", "MA", []), ("El Paso", "TX", []),
    ("Nashville", "TN", []), ("Détroit", "MI", ["Detroit"]), ("Oklahoma City", "OK", []),
    ("Portland", "OR", []), ("Las Vegas", "NV", []), ("Memphis", "TN", []), ("Louisville", "KY", []),
    ("Baltimore", "MD", []), ("Milwaukee", "WI", []), ("Albuquerque", "NM", []), ("Tucson", "AZ", []),
    ("Fresno", "CA", []), ("Sacramento", "CA", []), ("Kansas City", "MO", []), ("Atlanta", "GA", []),
    ("Omaha", "NE", []), ("Colorado Springs", "CO", []), ("Raleigh", "NC", []), ("Miami", "FL", []),
    ("Long Beach", "CA", []), ("Virginia Beach", "VA", []), ("Oakland", "CA", []),
    ("Minneapolis", "MN", []), ("Tulsa", "OK", []), ("Tampa", "FL", []),
    ("La Nouvelle-Orléans", "LA", ["Nouvelle-Orléans", "New Orleans"]), ("Wichita", "KS", []),
    ("Cleveland", "OH", []), ("Bakersfield", "CA", []), ("Honolulu", "HI", []), ("Anaheim", "CA", []),
    ("Riverside", "CA", []), ("Saint-Louis", "MO", ["St. Louis"]), ("Pittsburgh", "PA", []),
    ("Cincinnati", "OH", []), ("Saint Paul", "MN", ["St. Paul"]), ("Orlando", "FL", []),
    ("Buffalo", "NY", []), ("Anchorage", "AK", []), ("Salt Lake City", "UT", []), ("Richmond", "VA", []),
    ("Birmingham", "AL", []), ("Rochester", "NY", []), ("Hartford", "CT", []), ("Providence", "RI", []),
    ("Albany", "NY", []), ("Boise", "ID", []), ("Spokane", "WA", []), ("Des Moines", "IA", []),
    ("Madison", "WI", []), ("Grand Rapids", "MI", []), ("Knoxville", "TN", []), ("Little Rock", "AR", []),
    ("Charleston", "SC", []), ("Savannah", "GA", []), ("Baton Rouge", "LA", []), ("Reno", "NV", []),
    ("Fort Lauderdale", "FL", []), ("Norfolk", "VA", []), ("Durham", "NC", []), ("Lexington", "KY", []),
    ("Toledo", "OH", []), ("Dayton", "OH", []), ("Chattanooga", "TN", []), ("Corpus Christi", "TX", []),
    ("Santa Fe", "NM", []), ("Santa Barbara", "CA", []), ("Pasadena", "CA", []), ("Fargo", "ND", []),
    ("Sioux Falls", "SD", []), ("Billings", "MT", []), ("Burlington", "VT", []), ("Key West", "FL", []),
    ("Palm Springs", "CA", []), ("Atlantic City", "NJ", []), ("Newark", "NJ", []),
    ("Jersey City", "NJ", []), ("Saint Petersburg", "FL", ["St. Petersburg", "Saint-Pétersbourg"]),
]
assert len(US100) == 100, len(US100)

# Coordonnées absentes de Natural Earth (centre-ville, lon/lat).
MANUAL = {"Anaheim": [-117.9145, 33.8366], "Jersey City": [-74.0776, 40.7282]}

ALL_PLACES = J("ne/ne_10m_populated_places.geojson")["features"]
STATE_NAME = {f["properties"]["postal"]: f["properties"]["name"] for f in J("us.geojson")["features"]}
STATE_NAME["DC"] = "District of Columbia"


def key(s):
    s = normalize("NFD", s.lower()).encode("ascii", "ignore").decode()
    s = s.replace("st. ", "saint ").replace("ft. ", "fort ").replace(",", " ").replace("d.c.", "")
    return " ".join(s.replace("-", " ").split())


us_places = {}
for f in ALL_PLACES:
    q = f["properties"]
    if q["ADM0_A3"] == "USA":
        k = (key(q["NAME"]), q["ADM1NAME"])
        if k not in us_places or q["POP_MAX"] > us_places[k][0]:
            us_places[k] = (q["POP_MAX"], f["geometry"]["coordinates"])


def find_place(nom, alias, st):
    for n in [nom, *alias]:
        k = (key(n), STATE_NAME[st])
        if k in us_places:
            return us_places[k][1]
    if nom in MANUAL:
        return MANUAL[nom]
    raise SystemExit(f"introuvable : {nom} ({st})")


state_fr = {s["code"]: s["nom"] for s in states}
state_fr["DC"] = "district de Columbia"
villes_us = []
for i, (nom, st, alias) in enumerate(US100):
    lon, lat = find_place(nom, alias, st)
    villes_us.append({"code": f"v-{key(nom).replace(' ', '-')}-{st.lower()}", "nom": nom, "alias": alias,
                      "domaine": "ville", "etat": state_fr[st], "etatCode": st, "rang": i + 1,
                      "geo": [round(lon, 4), round(lat, 4)], "detail": state_fr[st]})
dump("villes-etats-unis", "100 villes des États-Unis", villes_us)
write_map("etats-unis", f"0 0 {W} {H}", [("AK", ak_box), ("HI", hi_box)], us, us_caps, tf_us, villes_us)

# ---------- Canada : projection conique de Statistique Canada ----------
ca = J("ca.geojson")["features"]
Wc, Hc = 1000, 900
ca_tf = fit([f["geometry"] for f in ca], lcc(49, 77, 63.39, -91.87), (0, 0, Wc, Hc), pad=10)
provs, ca_caps = items_and_points(ca, capitals("CAN"), "Capitale")
write_map("canada", f"0 0 {Wc} {Hc}", [], ca, ca_caps, lambda c: ca_tf)
dump("canada", "Provinces et territoires du Canada", provs)
dump("capitales-canada", "Capitales provinciales et territoriales", ca_caps)
print(len(states), "États,", len(provs), "provinces et territoires")
