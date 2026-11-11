#!/bin/sh
# Décompresse les fichiers volumineux, rangés en .gz pour alléger la branche.
find . -name "*.gz" -exec gunzip -kf {} \;
echo "Sources prêtes."
