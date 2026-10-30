"""Drapeaux des 197 pays : copie des SVG et jeu de données.

Usage : python3 -I tools/build_flags.py <dossier des sources> <racine du dépôt>
Sources : flags/node_modules/flag-icons/flags/4x3 (paquet npm flag-icons, licence MIT),
          ne/ne_50m_admin_0_countries.geojson (codes ISO à deux lettres).
À lancer après build_world.py (reprend data/pays.json).
"""
import json
import os
import shutil
import sys

src, root = sys.argv[1:3]
ne = {f["properties"]["ADM0_A3"]: f["properties"]
      for f in json.load(open(os.path.join(src, "ne/ne_50m_admin_0_countries.geojson")))["features"]}
FIX = {"PSX": "ps", "KOS": "xk", "TWN": "tw"}
ORDER = ["Europe", "Asie", "Afrique", "Amérique du Nord", "Amérique du Sud", "Océanie"]
flags = os.path.join(src, "flags/node_modules/flag-icons/flags/4x3")
out = os.path.join(root, "flags")
os.makedirs(out, exist_ok=True)

items = []
for it in json.load(open(f"{root}/data/pays.json"))["items"]:
    c = it["code"]
    iso = FIX.get(c) or ne[c]["ISO_A2_EH"].lower()
    shutil.copy(os.path.join(flags, f"{iso}.svg"), os.path.join(out, f"{iso}.svg"))
    items.append({"code": c, "nom": it["nom"], "alias": it["alias"], "domaine": "zone", "continent": it["continent"],
                  "image": f"flags/{iso}.svg", "detail": it["continent"]})
# Ordre de la grille : par continent, puis par code ISO (ni alphabétique en français, ni aléatoire).
items.sort(key=lambda x: (ORDER.index(x["continent"]), x["image"]))
json.dump({"id": "drapeaux", "titre": "Drapeaux", "items": items},
          open(f"{root}/data/drapeaux.json", "w"), ensure_ascii=False, indent=1)
size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
print(len(items), "drapeaux ·", size // 1024, "Ko")
