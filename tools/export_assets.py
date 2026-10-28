"""Transforme la sortie de build_map.py en fichiers de l'app.

Usage : python3 -I tools/export_assets.py <map.json> <racine du dépôt>
Écrit : maps/france-departements.svg et data/departements.json
"""
import json
import sys
from xml.sax.saxutils import quoteattr

src, root = sys.argv[1:3]
m = json.load(open(src))

order = lambda c: 20.1 if c == "2A" else 20.2 if c == "2B" else float(c)

# Carte : un SVG, un identifiant stable par département (data-code), encarts dessinés en fond
out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{m["viewBox"]}">']
for i in m["insets"]:
    x, y, w, h = i["box"]
    out.append(f'<rect class="inset-bg" data-inset="{i["key"]}" x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/>')
for code in sorted(m["paths"], key=order):
    out.append(f'<path class="dep" data-code="{code}" d="{m["paths"][code]}"/>')
for code in sorted(m["idf"], key=order):
    out.append(f'<path class="dep" data-code="{code}" data-inset="idf" d="{m["idf"][code]}"/>')
out.append("</svg>")
open(f"{root}/maps/france-departements.svg", "w").write("\n".join(out) + "\n")

# Données : identifiant, nom, alias explicites (aucun pour l'instant), étiquettes
items = []
for code in sorted(m["names"], key=order):
    outre_mer = code.startswith("97")
    items.append({"code": code, "nom": m["names"][code], "alias": [],
                  "tags": {"pays": "FR", "zone": "outre-mer" if outre_mer else "métropole", "categorie": "departement"}})
json.dump({"id": "departements", "titre": "Départements français", "items": items},
          open(f"{root}/data/departements.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "départements")
