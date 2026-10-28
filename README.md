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

## Régénérer la carte des départements

Source : [france-geojson](https://github.com/gregoiredavid/france-geojson) (données IGN / INSEE, licence ouverte).

```
mapshaper departements-avec-outre-mer.geojson -simplify 4% keep-shapes -clean -o dep-simpl.geojson precision=0.0001
mapshaper departements-avec-outre-mer.geojson -filter '["75","92","93","94"].indexOf(code)>-1' -simplify 25% keep-shapes -o idf.geojson precision=0.00001
python3 tools/build_map.py dep-simpl.geojson idf.geojson map.json
python3 tools/export_assets.py map.json .
```

Projection conique conforme de Lambert pour la métropole ; encarts pour la petite couronne et l'outre-mer.
