"""Code morse international (recommandation UIT-R M.1677-1) : 26 lettres et 10 chiffres.

Usage : python3 -I tools/build_morse.py . (aucune source externe)
"""
import json
import sys

root = sys.argv[1]
MORSE = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.", "G": "--.", "H": "....", "I": "..",
    "J": ".---", "K": "-.-", "L": ".-..", "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-", "Y": "-.--", "Z": "--..",
    "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..",
    "9": "----.", "0": "-----",
}
pretty = lambda m: " ".join("·" if c == "." else "−" for c in m)
items = []
for ch, m in MORSE.items():
    kind = "Chiffre" if ch.isdigit() else "Lettre"
    items.append({"code": f"m-{ch}", "nom": ch, "alias": [ch.lower()] if ch.isalpha() else [], "domaine": "code",
                  "morse": m, "signe": pretty(m), "detail": f"{kind} {ch} · {pretty(m)}"})
# Ponctuation et « é » de la recommandation UIT : 50 signes en tout, pour tous les quiz morse.
PONCT = {
    ".": ".-.-.-", ",": "--..--", ":": "---...", "?": "..--..", "'": ".----.", "-": "-....-", "/": "-..-.",
    "(": "-.--.", ")": "-.--.-", '"': ".-..-.", "=": "-...-", "+": ".-.-.", "@": ".--.-.", "É": "..-..",
}
NOMS = {".": "point", ",": "virgule", ":": "deux-points", "?": "point d'interrogation", "'": "apostrophe",
        "-": "trait d'union", "/": "barre oblique", "(": "parenthèse ouvrante", ")": "parenthèse fermante",
        '"': "guillemets", "=": "signe égal", "+": "signe plus", "@": "arobase", "É": "e accent aigu"}
items += [{"code": f"m-p{i}", "nom": ch, "alias": [], "domaine": "code", "morse": m, "signe": pretty(m),
           "detail": f"{NOMS[ch].capitalize()} · {pretty(m)}"} for i, (ch, m) in enumerate(PONCT.items())]
json.dump({"id": "morse", "titre": "Code morse", "items": items},
          open(f"{root}/data/morse.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "signes")
