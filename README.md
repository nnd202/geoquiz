# Geoquiz

Web app personnelle pour réviser la géographie tous les jours. Installable sur téléphone, fonctionne hors ligne, sans serveur ni compte.

## Installer sur le téléphone

1. Ouvrir l'adresse de l'app dans Chrome.
2. Menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).

Les mises à jour arrivent toutes seules : l'app se rafraîchit quand elle est ouverte avec du réseau.

## Les données

Les tentatives sont stockées uniquement dans le navigateur de l'appareil. Le bouton « Exporter un fichier » produit une sauvegarde JSON, à réimporter sur un autre appareil ou après un nettoyage du navigateur.

## Organisation

Tout ce qui varie vit dans des fichiers ; le code ne change que pour une nouvelle mécanique.

| Dossier ou fichier | Rôle |
| --- | --- |
| `catalogue.json` | Les jeux de données (fichier, carte, calques, nombre d’éléments) et les sections de quiz de l’accueil ; chaque quiz propose ensuite ses options (15 au hasard, mode clic) |
| `data/` | Un fichier par jeu : code, nom, alias explicites, étiquettes |
| `maps/` | Un SVG par carte, un `data-code` stable par zone |
| `js/core/` | Moteur commun : validation, plateaux carte et grille, partie, stats |
| `js/mechanics/` | Un module par mécanique : Tout trouver, Indice → saisie, Nom → toucher |
| `tools/` | Génération des cartes et script de vérification |
| `sw.js` | Hors ligne (réseau d'abord, cache en secours) |

- **Ajouter un quiz** : une entrée dans `catalogue.json`.
- **Ajouter une carte** : un SVG dans `maps/` et son fichier dans `data/`, déclarés dans `catalogue.json`.
- **Ajouter une mécanique** : un module dans `js/mechanics/`, enregistré dans `js/mechanics/index.js`.

Après un ajout de fichiers, les ajouter aussi à la liste `CORE` de `sw.js` et incrémenter `VERSION`.

## Vérification des données

```
node tools/check.mjs
```

Liste les homonymes et les préfixes ambigus (réponses qui commencent comme une autre, validées après une courte pause de frappe), et vérifie que chaque élément existe sur la carte.

## Régénérer les cartes

Outils : [mapshaper](https://github.com/mbloch/mapshaper), Python 3 et [shapely](https://pypi.org/project/shapely/) pour le ciel. Les scripts sont dans `tools/` ; `mapkit.py` contient la projection, les encarts, les marqueurs et l'écriture des SVG. Après une régénération, mettre à jour le nombre d'éléments (`nb`) dans `catalogue.json` et lancer `node tools/check.mjs`.

**Monde** (`maps/monde.svg`, `maps/mers.svg`) · `tools/build_world.py`

- Pays et capitales : [Natural Earth](https://www.naturalearthdata.com/) (domaine public). 197 pays : les 193 membres de l'ONU, plus Vatican, Palestine, Kosovo et Taïwan. Somaliland, Chypre du Nord, Hong Kong, Macao et Åland sont fusionnés avec leur pays.
- Mers et océans : zones maritimes de l’OHI, version 3 (Atlantique Nord et Sud, Pacifique Nord et Sud et les deux bassins de la Méditerranée regroupés : 98 éléments), [Marine Regions](https://www.marineregions.org/) (CC-BY 4.0), via le paquet npm `oceans-seas.geojson`. Noms traduits en français dans le script. Les côtes OHI disponibles étant grossières, le script fait épouser aux mers le tracé des terres : frontières officielles entre mers conservées, interstices rattachés à la mer voisine (shapely).

```
mapshaper ne_50m_admin_0_countries.geojson -each "code = ({SOL:'SOM',CYN:'CYP',HKG:'CHN',MAC:'CHN',ALD:'FIN'})[ADM0_A3] || ADM0_A3" -dissolve2 code -simplify 14% keep-shapes -clean -o world-countries.geojson precision=0.001
mapshaper world-countries.geojson -dissolve2 -o world-land.geojson
mapshaper oceans-seas.geo.json -simplify 20% keep-shapes -o world-seas.geojson precision=0.001   # sans -clean, qui écrase des zones
python3 tools/build_world.py <dossier des sources> .
```

**Pays ++, lacs, fleuves, drapeaux** · `tools/build_world_plus.py`, `tools/build_water.py`, `tools/build_flags.py` (même projection que le monde, `tools/worldproj.py`)

- Pays ++ (`maps/monde-plus.svg`) : les 197 pays, plus 45 États non reconnus et territoires habités (Natural Earth sans fusion ; Abkhazie, Ossétie du Sud, Transnistrie et Gibraltar repris des zones disputées et découpés dans leur pays). Chaque élément porte un statut, coloré en mode étude.
- Lacs (`maps/lacs.svg`) : 73 lacs choisis dans `ne_10m_lakes`, noms français dans le script ; la mer Caspienne est le « trou » qu'elle forme dans les terres ; les petits lacs ont un rond en plus.
- Fleuves (`maps/fleuves.svg`) : 116 fleuves et rivières de `ne_10m_rivers_lake_centerlines` ; chaque nom français regroupe les tronçons aux noms locaux (Donau, Duna, Dunav…), avec une zone géographique pour les noms ambigus (Colorado, Negro, Don…). Un trait large invisible facilite le toucher.
- Drapeaux (`flags/`) : paquet npm [flag-icons](https://github.com/lipis/flag-icons) (MIT), format 4:3, optimisés avec svgo.

```
mapshaper ne_50m_admin_0_countries.geojson -each "code = ADM0_A3" -filter-fields code -dissolve2 code -simplify 14% keep-shapes -clean -o world-units.geojson precision=0.001
mapshaper ne_10m_admin_0_disputed_areas.geojson -filter '["B35","B36","B37","B55"].indexOf(BRK_A3)>-1' -each "code=BRK_A3" -filter-fields code -simplify 30% keep-shapes -o breakaway.geojson precision=0.001
python3 tools/build_world_plus.py <dossier des sources> .
python3 tools/build_water.py <dossier des sources> .
python3 tools/build_flags.py <dossier des sources> . && svgo -f flags --multipass
```

**Hérault** (`maps/herault.svg`) · `tools/build_herault.py`

30 communes, 10 cours d'eau, 8 sommets, 6 étangs et 6 sites. Contours : communes de france-geojson ; populations : @etalab/decoupage-administratif ; cours d'eau, étangs et sommets : © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL), exportés depuis [overpass-turbo.eu](https://overpass-turbo.eu) (Exporter → GeoJSON, enregistré dans `osm34/export.geojson`) avec :

```
[out:json][timeout:180];
area["ref:INSEE"="34"]["boundary"="administrative"]["admin_level"="6"]->.h;
(
  way["waterway"="river"](area.h);
  way["natural"="water"]["name"~"[ÉE]tang|Salagou",i](area.h);
  relation["natural"="water"]["name"~"[ÉE]tang|Salagou",i](area.h);
  node["natural"="peak"]["name"](area.h);
);
out geom;
```

**Ciel** (`maps/ciel.svg`) · `tools/build_sky.py`

Source : [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD) : frontières officielles des 88 constellations, tracés, étoiles jusqu'à la magnitude 6, noms. Deux hémisphères côte à côte, projection azimutale équidistante centrée sur chaque pôle. L'étoile la plus brillante de chaque constellation est à trouver quand elle a un nom d'usage (55 sur 88, vérifiés contre le catalogue de l'UAI).

**France** (`maps/france.svg`, `maps/france-regions.svg`) · `tools/build_france.py`

Sources : communes de [france-geojson](https://github.com/gregoiredavid/france-geojson) et référentiel [@etalab/decoupage-administratif](https://www.npmjs.com/package/@etalab/decoupage-administratif) (chefs-lieux et populations à jour). Les arrondissements sont recalculés en fusionnant les communes, puis départements et régions en sont déduits, pour que tous les traits coïncident. Marqueurs : étoile pour la préfecture de région, carré pour la préfecture, rond pour la sous-préfecture. Les 100 villes sont les communes les plus peuplées.

```
mapshaper communes-arr.geojson -dissolve2 arr copy-fields=dep,reg -simplify 2% keep-shapes -clean -o arr.geojson precision=0.0001
mapshaper arr.geojson -dissolve dep copy-fields=reg -o dep.geojson
mapshaper arr.geojson -innerlines where='A.dep == B.dep' -o arrlines.geojson
mapshaper dep.geojson -dissolve reg -o reg.geojson
mapshaper communes-arr.geojson -filter '["75","92","93","94"].indexOf(dep)>-1' -dissolve2 arr copy-fields=dep -simplify 20% keep-shapes -clean -o idf-arr.geojson precision=0.00001
mapshaper idf-arr.geojson -dissolve dep -o idf-dep.geojson
mapshaper idf-arr.geojson -innerlines where='A.dep == B.dep' -o idf-lines.geojson
python3 tools/build_france.py <dossier des sources> .
```

**États-Unis et Canada** (`maps/etats-unis.svg`, `maps/canada.svg`) · `tools/build_na.py`

Source : Natural Earth, `ne_50m_admin_1_states_provinces` et `ne_10m_populated_places`. Les 100 villes américaines sont une sélection éditoriale (villes principales des grandes agglomérations, plus quelques villes célèbres), listée dans le script.

```
mapshaper ne_50m_admin_1_states_provinces.geojson -filter 'adm0_a3=="USA"' -filter-fields name,name_fr,postal -simplify 30% keep-shapes -clean -o us.geojson precision=0.0001
mapshaper ne_50m_admin_1_states_provinces.geojson -filter 'adm0_a3=="CAN"' -filter-fields name,name_fr,postal -filter-islands min-area=150km2 -simplify 12% keep-shapes -clean -o ca.geojson precision=0.0001
python3 tools/build_na.py <dossier des sources> .
```

## Contrat des cartes

Chaque SVG regroupe ses éléments en calques `<g data-layer="…">` : zones `path.zone`, traits `path.sub`, marqueurs `path.pt` (forme au rayon 1 dans un `<g transform="translate(x y)">`, avec `data-x` et `data-y`). Le CSS met les marqueurs à l'échelle pour qu'ils gardent la même taille à l'écran quel que soit le zoom. Les éléments jouables portent un `data-code` identique à celui des données.

Dans un quiz, les zones hors du jeu de données deviennent du décor ; les points hors du jeu sont masqués, sauf si leur calque figure dans `calques` (ils deviennent alors des repères) ; les traits ne s'affichent que si leur calque est demandé.
