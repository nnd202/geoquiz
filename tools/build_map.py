"""Projette les départements simplifiés en un SVG léger (métropole + encarts).

Usage : python3 -I build_map.py <dep-simpl.geojson> <idf.geojson> <sortie.json>
Sortie : {"viewBox": "...", "insets": [...], "paths": {code: d}, "idf": {code: d}, "names": {code: nom}}
"""
import json
import math
import sys

src, idf_src, out = sys.argv[1:4]
data = json.load(open(src))
idf = json.load(open(idf_src))

DOM = ["971", "972", "973", "974", "976"]
W, H = 1000, 900
LEFT = 190  # colonne des encarts


def lcc_factory():
    # Lambert conique conforme, parallèles 44° et 49°, origine 46.5° N / 3° E
    r = math.radians
    p1, p2, p0, l0 = r(44), r(49), r(46.5), r(3)
    n = math.log(math.cos(p1) / math.cos(p2)) / math.log(
        math.tan(math.pi / 4 + p2 / 2) / math.tan(math.pi / 4 + p1 / 2))
    F = math.cos(p1) * math.tan(math.pi / 4 + p1 / 2) ** n / n
    rho0 = F / math.tan(math.pi / 4 + p0 / 2) ** n

    def f(lon, lat):
        rho = F / math.tan(math.pi / 4 + r(lat) / 2) ** n
        t = n * (r(lon) - l0)
        return rho * math.sin(t), -(rho0 - rho * math.cos(t))
    return f


def equi_factory(lat0):
    k = math.cos(math.radians(lat0))
    return lambda lon, lat: (lon * k, -lat)


def rings(geom):
    if geom["type"] == "Polygon":
        return [r for r in geom["coordinates"]]
    return [r for poly in geom["coordinates"] for r in poly]


def fit(features, proj, box, pad=6):
    """Calcule la transformation qui loge les entités dans box=(x,y,w,h)."""
    pts = [proj(*c) for f in features for ring in rings(f["geometry"]) for c in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    bx, by, bw, bh = box
    s = min((bw - 2 * pad) / (maxx - minx), (bh - 2 * pad) / (maxy - miny))
    ox = bx + (bw - s * (maxx - minx)) / 2 - s * minx
    oy = by + (bh - s * (maxy - miny)) / 2 - s * miny
    return lambda lon, lat: (ox + s * proj(lon, lat)[0], oy + s * proj(lon, lat)[1])


def path_d(geom, tf, min_area=0.0):
    parts = []
    for ring in rings(geom):
        pts = [tf(*c) for c in ring]
        # ignore les îlots minuscules (invisibles et lourds)
        a = 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))
        if a < min_area:
            continue
        out_pts, last = [], None
        for x, y in pts:
            p = (round(x, 1), round(y, 1))
            if p != last:
                out_pts.append(p)
                last = p
        if len(out_pts) < 3:
            continue
        s = "M" + " L".join(f"{x:g} {y:g}" for x, y in out_pts) + "Z"
        parts.append(s)
    return "".join(parts)


feats = {f["properties"]["code"]: f for f in data["features"]}
names = {c: f["properties"]["nom"] for c, f in feats.items()}

result = {"paths": {}, "idf": {}, "insets": [], "names": names}

# Métropole
metro = [f for c, f in feats.items() if c not in DOM]
tf = fit(metro, lcc_factory(), (LEFT + 10, 0, W - LEFT - 10, H))
for f in metro:
    result["paths"][f["properties"]["code"]] = path_d(f["geometry"], tf, min_area=0.6)

# Encarts : petite couronne puis outre-mer
boxes = []
y = 8
idf_h = 196
boxes.append(("idf", (8, y, LEFT - 16, idf_h)))
y += idf_h + 14
dom_h = (H - y - 8 - 4 * 10) / 5
for c in DOM:
    boxes.append((c, (8, y, LEFT - 16, dom_h)))
    y += dom_h + 10

for key, box in boxes:
    result["insets"].append({"key": key, "box": [round(v, 1) for v in box]})
    if key == "idf":
        tf = fit(idf["features"], equi_factory(48.86), box, pad=10)
        for f in idf["features"]:
            result["idf"][f["properties"]["code"]] = path_d(f["geometry"], tf)
    else:
        f = feats[key]
        lat0 = sum(c[1] for ring in rings(f["geometry"]) for c in ring) / sum(
            len(ring) for ring in rings(f["geometry"]))
        tf = fit([f], equi_factory(lat0), box, pad=12)
        result["paths"][key] = path_d(f["geometry"], tf, min_area=0.4)

result["viewBox"] = f"0 0 {W} {H}"
json.dump(result, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
total = sum(len(v) for v in result["paths"].values()) + sum(len(v) for v in result["idf"].values())
print("paths:", len(result["paths"]), "idf:", len(result["idf"]), "bytes:", total)
