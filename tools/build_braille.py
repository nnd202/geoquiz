"""Braille : les 26 lettres (alphabet braille à 6 points, identique en français pour a à z).

Usage : python3 -I tools/build_braille.py . (aucune source externe)
Points numérotés 1-2-3 en colonne gauche (haut → bas), 4-5-6 en colonne droite.
"""
import json
import sys

root = sys.argv[1]
DOTS = {
    "A": "1", "B": "12", "C": "14", "D": "145", "E": "15", "F": "124", "G": "1245", "H": "125", "I": "24",
    "J": "245", "K": "13", "L": "123", "M": "134", "N": "1345", "O": "135", "P": "1234", "Q": "12345",
    "R": "1235", "S": "234", "T": "2345", "U": "136", "V": "1236", "W": "2456", "X": "1346", "Y": "13456",
    "Z": "1356",
}
uni = lambda d: chr(0x2800 + sum(1 << (int(n) - 1) for n in d))  # caractère Unicode du motif
items = [{"code": f"b-{ch}", "nom": ch, "alias": [ch.lower()], "domaine": "code", "points": d, "signe": uni(d),
          "detail": f"Lettre {ch} · points {'-'.join(d)}"} for ch, d in DOTS.items()]
json.dump({"id": "braille", "titre": "Braille", "items": items},
          open(f"{root}/data/braille.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "lettres")
