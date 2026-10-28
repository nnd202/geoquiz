# Géo-quiz

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
| `catalogue.json` | Les jeux de données et les quiz (support, mécanique, tirage, chrono) |
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

Outils : [mapshaper](https://github.com/mbloch/mapshaper) et Python 3. Les scripts sont dans `tools/` ; `mapkit.py` contient la projection, les encarts et l'écriture des SVG.

**France** (`maps/france.svg`, `maps/france-regions.svg`, données des départements, régions, préfectures et sous-préfectures)

Sources : communes de [france-geojson](https://github.com/gregoiredavid/france-geojson) et référentiel [@etalab/decoupage-administratif](https://www.npmjs.com/package/@etalab/decoupage-administratif) (chefs-lieux à jour). Les arrondissements sont recalculés en fusionnant les communes, puis départements et régions en sont déduits, pour que tous les traits coïncident.

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

**États-Unis et Canada** (`maps/etats-unis.svg`, `maps/canada.svg` et leurs capitales)

Source : [Natural Earth](https://www.naturalearthdata.com/) (domaine public), `ne_50m_admin_1_states_provinces` et `ne_10m_populated_places_simple`.

```
mapshaper ne_50m_admin_1_states_provinces.geojson -filter 'adm0_a3=="USA"' -filter-fields name,name_fr,postal -simplify 30% keep-shapes -clean -o us.geojson precision=0.0001
mapshaper ne_50m_admin_1_states_provinces.geojson -filter 'adm0_a3=="CAN"' -filter-fields name,name_fr,postal -filter-islands min-area=150km2 -simplify 12% keep-shapes -clean -o ca.geojson precision=0.0001
python3 tools/build_na.py <dossier des sources> .
```

## Contrat des cartes

Chaque SVG regroupe ses éléments en calques `<g data-layer="…">` : zones `path.zone`, traits de sous-division `path.sub`, points `circle.pt` (`pref` pour un point principal). Les éléments jouables portent un `data-code` identique à celui des données.

Dans un quiz, les zones hors du jeu de données deviennent du décor ; les points hors du jeu sont masqués, sauf si leur calque figure dans `calques` (ils deviennent alors des repères) ; les traits ne s'affichent que si leur calque est demandé.
