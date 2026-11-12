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
json.dump({"id": "morse", "titre": "Code morse", "items": items},
          open(f"{root}/data/morse.json", "w"), ensure_ascii=False, indent=1)

# Transmission libre : les 36 signes plus la ponctuation et le « é » de la recommandation UIT.
PONCT = {
    ".": ".-.-.-", ",": "--..--", ":": "---...", "?": "..--..", "'": ".----.", "-": "-....-", "/": "-..-.",
    "(": "-.--.", ")": "-.--.-", '"': ".-..-.", "=": "-...-", "+": ".-.-.", "@": ".--.-.", "É": "..-..",
}
signes = items + [{"code": f"m-p{i}", "nom": ch, "alias": [], "domaine": "code", "morse": m, "signe": pretty(m),
                   "detail": f"{ch} · {pretty(m)}"} for i, (ch, m) in enumerate(PONCT.items())]
json.dump({"id": "morse-signes", "titre": "Code morse (signes complets)", "items": signes},
          open(f"{root}/data/morse-signes.json", "w"), ensure_ascii=False, indent=1)
print(len(items), "signes pour les quiz ·", len(signes), "pour la transmission libre")
