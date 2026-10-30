"""Projection de la carte du monde (Natural Earth, Antarctique coupé à 60° S), commune aux cartes mondiales."""
import math


def natural_earth(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p
    p4 = p2 * p2
    x = l * (0.870700 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y


W = 1000
XMAX = natural_earth(180, 0)[0]
YTOP, YBOT = natural_earth(0, 84)[1], natural_earth(0, -60)[1]
S = (W - 20) / (2 * XMAX)
H = round((YBOT - YTOP) * S + 20)
VIEW = f"0 0 {W} {H}"


def tf(lon, lat):
    x, y = natural_earth(max(-180, min(180, lon)), max(-90, min(90, lat)))
    return 10 + (x + XMAX) * S, 10 + (y - YTOP) * S
