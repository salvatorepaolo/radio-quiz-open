#!/usr/bin/env python3
"""27/11 (5): il «lume» di riferimento per le calcificazioni è il sangue già riconosciuto come vaso dalla segmentazione
senza la regola (prima passata), non una qualsiasi regione grande di quella densità: lo spongioso delle teste femorali
e del bacino (denso come il sangue, grande e collegato) e lo stomaco con il contrasto orale facevano da «lume»."""
import pathlib
P = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js')
s = P.read_text()
def sost(v, n, c=1):
    global s
    k = s.count(v)
    if k != c: raise SystemExit(f'atteso {c}, trovato {k}: {v[:90]!r}')
    s = s.replace(v, n)

sost("function vasi(R, corpo) {", "function vasi(R, corpo, conCalcio = OPZ_VASI.calcio) {")
sost("    const calc = OPZ_VASI.calcio ? calcificazioniR(R, o, dv, semeOsso) : null;",
     "    // prima passata senza la regola: i vasi sicuri, il cui lume fa da riferimento\n"
     "    calc = conCalcio && dv >= 250 ? calcificazioniR(R, o, dv, semeOsso, vasi(R, corpo, false).m) : null;")
sost("  let lo, semeOsso = 450, dv = null;", "  let lo, semeOsso = 450, dv = null, calc = null;")
sost("  ultimiVasi = { m, R, dv, semeOsso };", "  ultimiVasi = { m, R, dv, semeOsso, calc };")
# criterio del lume
sost("""function calcificazioniR(R, semi, dv, seme) {""", """function calcificazioniR(R, semi, dv, seme, vasiBase) {""")
sost("""  const S = componenti3d(bl, W, H, N), maxS = S.comp.reduce((a, c) => Math.max(a, c.n), 0), minS = Math.min(30000 / vv, maxS * 0.25);
  const lume = new Uint8Array(S.comp.length + 1); for (const c of S.comp) if (c.n >= minS) lume[c.L] = 1;""",
"""  // lume: regioni di sangue opacizzato di almeno 2 cm³ che per almeno metà stanno nei vasi della prima passata
  const S = componenti3d(bl, W, H, N), dentro = new Float64Array(S.comp.length + 1);
  for (let p = 0; p < n; p++) if (S.lab[p] && vasiBase[p]) dentro[S.lab[p]]++;
  const lume = new Uint8Array(S.comp.length + 1); for (const c of S.comp) if (c.n * vv >= 2000 && dentro[c.L] >= c.n * 0.5) lume[c.L] = 1;""")
# calcioPerOsso: stessa regola con la prima passata
sost("""      const m = calcificazioniR(R, s0, dv, seme); if (m) c = { m, W: R.W, H: R.H, N: R.N }; }""",
"""      const m = calcificazioniR(R, s0, dv, seme, vasi(R, corpo3dR().m, false).m); if (m) c = { m, W: R.W, H: R.H, N: R.N }; }""")
# diagnosi: la maschera usata nell'ultima segmentazione
sost("""  const cal = calcificazioniR(R, s0, dv, semeOsso) || new Uint8Array(n);""", """  const cal = ultimiVasi.calc || new Uint8Array(n);""")
sost("""  const c = calcificazioniR(R, s0, dv, semeOsso);""", """  const c = ultimiVasi.calc;""")
P.write_text(s); print('ok')
