"""Correzioni dopo la revisione indipendente del 2/11 al testo della seconda lettura dei noduli."""
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
cambi = [
    (" · lobo ${esc(x.lobo || '—')} · <b>Lung-RADS",
     " · lobo ${esc(x.lobo || '—')} <span class=\"muted small\">(dalla segmentazione)</span> · <b>Lung-RADS"),
    ("'<span class=\"muted small\">Lung-RADS v2022 come primo esame di screening (senza precedenti); diametro = media di asse lungo e corto. Per i noduli incidentali fuori dallo screening vale Fleischner (Σ Scale).</span>'",
     "'<span class=\"muted small\">Lung-RADS v2022 come primo esame di screening (senza precedenti); diametro = media di asse lungo e corto, spicule escluse (può essere minore dell\\'asse lungo che si misura a occhio). L\\'IA non valuta le caratteristiche sospette (spicule, linfonodi, crescita): con queste una categoria 3 o 4 diventa <b>4X</b>. Le misure vicine alla soglia vanno rifatte a mano. Per i noduli incidentali fuori dallo screening vale Fleischner (Σ Scale).</span>'"),
]
for a, b in cambi:
    assert s.count(a) == 1, a[:50]
    s = s.replace(a, b)
open(p, "w", encoding="utf-8").write(s)
print("ok")
