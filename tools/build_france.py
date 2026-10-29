"""Cartes et données de la France : départements, arrondissements, préfectures, sous-préfectures, régions.

Usage : python3 -I tools/build_france.py <dossier des sources> <racine du dépôt>
Sources attendues (voir README) :
  dep.geojson, reg.geojson, arrlines.geojson         (simplifiés ensemble, mêmes sommets)
  idf-dep.geojson, idf-lines.geojson                  (petite couronne, plus détaillée)
  communes-arr.geojson                                (communes, pour placer les chefs-lieux)
  npm/node_modules/@etalab/decoupage-administratif/data/*.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapkit import lcc, equi, fit, path_d, line_d, centroid, svg_doc, rings, esc, marker  # noqa: E402

src, root = sys.argv[1:3]
J = lambda name: json.load(open(os.path.join(src, name)))
E = lambda name: json.load(open(os.path.join(src, "npm/node_modules/@etalab/decoupage-administratif/data", name)))

DOM = ["971", "972", "973", "974", "976"]
IDF = ["75", "92", "93", "94"]
REG_DOM = {"01": "971", "02": "972", "03": "973", "04": "974", "06": "976"}
W, H, LEFT = 1000, 900, 190
order = lambda c: 20.1 if c == "2A" else 20.2 if c == "2B" else float(c)


def dom_of(lon, lat):
    if lon < -58 and lat > 15.5: return "971"
    if lon < -58: return "972"
    if lon < -40: return "973"
    if lon > 50: return "974"
    if lon > 40: return "976"
    return None


# ---------- Référentiel administratif ----------
deps = {d["code"]: d for d in E("departements.json") if d["zone"] in ("metro", "drom")}
regs = {r["code"]: r for r in E("regions.json") if r.get("zone", "metro") in ("metro", "drom") or r["code"] in REG_DOM}
arrs = [a for a in E("arrondissements.json") if a["departement"] in deps]
communes = {c["code"]: c for c in E("communes.json") if c["type"] == "commune-actuelle"}
pref_codes = {d["chefLieu"] for d in deps.values()}
sp_codes = {a["chefLieu"] for a in arrs} - pref_codes

# Position des chefs-lieux : centre de leur commune
need = pref_codes | sp_codes
geo = {}
for f in J("communes-arr.geojson")["features"]:
    c = f["properties"]["code"]
    if c in need:
        geo[c] = centroid(f["geometry"])
assert need <= set(geo), sorted(need - set(geo))

# ---------- Mise en page commune (encarts à gauche) ----------
dep_feats = {f["properties"]["dep"]: f for f in J("dep.geojson")["features"]}
metro_geoms = [f["geometry"] for c, f in dep_feats.items() if c not in DOM]
metro_tf = fit(metro_geoms, lcc(44, 49, 46.5, 3), (LEFT + 10, 0, W - LEFT - 10, H))


def layout(with_idf):
    boxes, y = [], 8
    if with_idf:
        boxes.append(("idf", (8, y, LEFT - 16, 196)))
        y += 196 + 14
    n = len(DOM)
    h = (H - y - 8 - (n - 1) * 10) / n
    for c in DOM:
        boxes.append((c, (8, y, LEFT - 16, h)))
        y += h + 10
    return boxes


def dom_tfs(boxes):
    tfs = {}
    for key, box in boxes:
        if key in DOM:
            g = dep_feats[key]["geometry"]
            pts = [c for r in rings(g) for c in r]
            lat0 = sum(p[1] for p in pts) / len(pts)
            tfs[key] = fit([g], equi(lat0), box, pad=12)
    return tfs


# ---------- Carte France : départements + arrondissements + chefs-lieux ----------
boxes = layout(True)
tfs = dom_tfs(boxes)
idf_dep = {f["properties"]["dep"]: f for f in J("idf-dep.geojson")["features"]}
tfs["idf"] = fit([f["geometry"] for f in idf_dep.values()], equi(48.86), dict(boxes)["idf"], pad=10)

body = ['<g data-layer="departements">']
for c in sorted(dep_feats, key=order):
    tf = tfs[c] if c in DOM else metro_tf
    body.append(f'<path class="zone" data-code="{c}" d="{path_d(dep_feats[c]["geometry"], tf, 0.4 if c in DOM else 0.6)}"/>')
for c in IDF:
    body.append(f'<path class="zone" data-code="{c}" data-inset="idf" d="{path_d(idf_dep[c]["geometry"], tfs["idf"])}"/>')
body.append('</g>')

# Traits d'arrondissement, répartis entre métropole et encarts
by_inset = {}
def geoms(doc):
    return [f["geometry"] for f in doc["features"]] if "features" in doc else doc["geometries"]


for g in geoms(J("arrlines.geojson")):
    for ring in rings(g):
        k = dom_of(*ring[0][:2])
        by_inset.setdefault(k, []).append(ring)
sub = []
for k, lines in by_inset.items():
    tf = tfs[k] if k else metro_tf
    sub.append(line_d({"type": "MultiLineString", "coordinates": lines}, tf))
idf_lines = [r for g in geoms(J("idf-lines.geojson")) for r in rings(g)]
sub.append(line_d({"type": "MultiLineString", "coordinates": idf_lines}, tfs["idf"]))
body.append(f'<g data-layer="arrondissements"><path class="sub" d="{"".join(sub)}"/></g>')


region_cl = {r["chefLieu"] for r in regs.values()}


def point_tags(code, shape, cls):
    lon, lat = geo[code]
    dep = communes[code]["departement"]
    tf = tfs[dep] if dep in DOM else metro_tf
    out = [marker(*tf(lon, lat), shape, cls, code)]
    if dep in IDF:
        x, y = tfs["idf"](lon, lat)
        out.append(marker(x, y, shape, cls, code, ' data-inset="idf"'))
    return out


# Trois rôles, trois formes : étoile (préfecture de région), carré (préfecture), rond (sous-préfecture).
body.append('<g data-layer="sous-prefectures">')
for c in sorted(sp_codes):
    body.extend(point_tags(c, "rond", "sp"))
body.append('</g><g data-layer="prefectures">')
for c in sorted(pref_codes - region_cl):
    body.extend(point_tags(c, "carre", "pref"))
for c in sorted(region_cl):
    body.extend(point_tags(c, "etoile", "preg"))
body.append('</g>')

# 100 communes les plus peuplées (population municipale INSEE)
top = sorted((c for c in communes.values() if c.get("population") and c["departement"] in deps),
             key=lambda c: -c["population"])[:100]
need_v = {c["code"] for c in top} - set(geo)
for f in J("communes-arr.geojson")["features"]:
    if f["properties"]["code"] in need_v:
        geo[f["properties"]["code"]] = centroid(f["geometry"])
body.append('<g data-layer="villes">')
for c in top:
    lon, lat = geo[c["code"]]
    d = c["departement"]
    tf = tfs[d] if d in DOM else metro_tf
    body.append(marker(*tf(lon, lat), "rond", "ville", f'v-{c["code"]}'))
    if d in IDF:
        x, y = tfs["idf"](lon, lat)
        body.append(marker(x, y, "rond", "ville", f'v-{c["code"]}', ' data-inset="idf"'))
body.append('</g>')

open(f"{root}/maps/france.svg", "w").write(svg_doc(f"0 0 {W} {H}", boxes, body))

# ---------- Carte des régions ----------
boxes_r = layout(False)
tfs_r = dom_tfs(boxes_r)
reg_feats = {f["properties"]["reg"]: f for f in J("reg.geojson")["features"]}
body = ['<g data-layer="regions">']
for c in sorted(reg_feats):
    k = REG_DOM.get(c)
    tf = tfs_r[k] if k else metro_tf
    body.append(f'<path class="zone" data-code="{c}" d="{path_d(reg_feats[c]["geometry"], tf, 0.4)}"/>')
body.append('</g>')
open(f"{root}/maps/france-regions.svg", "w").write(svg_doc(f"0 0 {W} {H}", boxes_r, body))

# ---------- Données ----------
def dump(name, titre, items):
    json.dump({"id": name, "titre": titre, "items": items},
              open(f"{root}/data/{name}.json", "w"), ensure_ascii=False, indent=1)


def dep_geo(c):
    return [round(v, 4) for v in centroid(dep_feats[c]["geometry"])]


dump("departements", "Départements français", [
    {"code": c, "nom": deps[c]["nom"], "alias": [], "domaine": "zone", "geo": dep_geo(c),
     "detail": regs[deps[c]["region"]]["nom"]}
    for c in sorted(deps, key=order)])

REG_ALIAS = {"93": ["PACA"]}
dump("regions", "Régions françaises", [
    {"code": c, "nom": regs[c]["nom"], "alias": REG_ALIAS.get(c, []), "domaine": "zone",
     "geo": [round(v, 4) for v in centroid(reg_feats[c]["geometry"])],
     "detail": f'{sum(1 for d in deps.values() if d["region"] == c)} département(s)'}
    for c in sorted(reg_feats)])


def city(code, kind):
    co = communes[code]
    d = co["departement"]
    if kind == "prefecture" and code in region_cl:
        role = f'Préfecture de région ({regs[co["region"]]["nom"]})'
    else:
        role = "Préfecture" if kind == "prefecture" else "Sous-préfecture"
    return {"code": code, "nom": co["nom"], "alias": [], "domaine": "ville", "categorie": kind,
            "geo": [round(v, 4) for v in geo[code]], "dep": d, "depNom": deps[d]["nom"],
            "detail": f'{role} · {deps[d]["nom"]} ({d})'}


prefs = sorted((city(c, "prefecture") for c in pref_codes), key=lambda x: order(x["dep"]))
sps = sorted((city(c, "sous-prefecture") for c in sp_codes), key=lambda x: (order(x["dep"]), x["nom"]))
dump("prefectures", "Préfectures", prefs)
dump("chefs-lieux", "Préfectures et sous-préfectures", sorted(prefs + sps, key=lambda x: (order(x["dep"]), x["categorie"] != "prefecture", x["nom"])))
def fmt_pop(n):
    return f"{n:,}".replace(",", " ")


dump("villes-france", "100 villes de France", [
    {"code": f'v-{c["code"]}', "nom": c["nom"], "alias": [], "domaine": "ville", "rang": i + 1,
     "geo": [round(v, 4) for v in geo[c["code"]]], "dep": c["departement"], "depNom": deps[c["departement"]]["nom"],
     "detail": f'{i + 1}e ville · {fmt_pop(c["population"])} hab. · {deps[c["departement"]]["nom"]} ({c["departement"]})'}
    for i, c in enumerate(top)])
print(f"départements {len(deps)} · régions {len(reg_feats)} · préfectures {len(prefs)} · sous-préfectures {len(sps)}")
for f in ("france.svg", "france-regions.svg"):
    print(f, os.path.getsize(f"{root}/maps/{f}"), "octets")
