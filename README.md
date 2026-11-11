# Sources de construction des cartes

Branche à part : rien ici n'est servi par l'application. Elle contient les fichiers dont les scripts de `tools/` (branche `main`) ont besoin pour régénérer cartes et données, pour qu'une session de travail puisse repartir sans rien retélécharger.

## Restaurer

```
git clone --branch sources --depth 1 https://github.com/nnd202/geoquiz.git src-data
cd src-data && sh restore.sh          # décompresse les fichiers .gz
cd ../geoquiz && python3 -I tools/build_world.py ../src-data .   # etc., voir README de main
```

## Contenu

| Chemin | Origine | Licence |
| --- | --- | --- |
| `ne/`, `regions/` | Natural Earth (10m, 50m ; régions géographiques : déserts, reliefs) | domaine public |
| `world-*.geojson`, `breakaway.geojson` | dérivés de Natural Earth par mapshaper (commandes dans le README de main) | domaine public |
| `world-seas.geojson`, `seas/oceans-seas.geojson` | zones maritimes OHI, Marine Regions, paquet npm oceans-seas | CC-BY 4.0 |
| `communes-arr.geojson`, `arr*.geojson`, `dep.geojson`, `reg.geojson`, `idf-*.geojson` | france-geojson + recalculs (build_france) | Licence ouverte Etalab |
| `npm/node_modules/@etalab/decoupage-administratif/data/` | référentiel administratif Etalab | Licence ouverte |
| `us.geojson`, `ca.geojson` | Natural Earth admin 1 | domaine public |
| `sky/` | d3-celestial | BSD |
| `osm34/export.geojson` | export Overpass de l'Hérault (requête dans le README de main) | © contributeurs OpenStreetMap, ODbL |

Non inclus : les drapeaux bruts (paquet npm `flag-icons`, déjà optimisés dans `flags/` de main).
