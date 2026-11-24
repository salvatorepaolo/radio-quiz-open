# patch_chiedi.py: domanda sul vetrino con il testo del caso («chiedi»), p.es. «Indica dove si vede la necrosi»
import sys, json
R = sys.argv[1]   # .../piattaforma-quiz/cloud
def patch(p, coppie):
    s = open(p, encoding='utf-8').read()
    for a, b in coppie:
        assert s.count(a) == 1, (p, a[:70]); s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch(R + '/api/logica.mjs', [
 ("return { i: Math.round(Math.max(0, Math.min(50, Number(z.i) || 0))), r, nota: String(z.nota || '').trim().slice(0, 300), ...(z.domanda === true ? { domanda: true } : {}) };",
  "const chiedi = String(z.chiedi || '').replace(/\\s+/g, ' ').trim().slice(0, 200);   // 1.323: che cosa indicare (testo per lo studente)\n"
  "  return { i: Math.round(Math.max(0, Math.min(50, Number(z.i) || 0))), r, nota: String(z.nota || '').trim().slice(0, 300), ...(z.domanda === true ? { domanda: true } : {}), ...(chiedi ? { chiedi } : {}) };"),
 ("if (localizza && zona_vetrino?.domanda) resto.localizza = { vetrino: zona_vetrino.i };   // domanda sul vetrino: solo quale vetrino",
  "if (localizza && zona_vetrino?.domanda) resto.localizza = { vetrino: zona_vetrino.i, ...(zona_vetrino.chiedi ? { chiedi: zona_vetrino.chiedi } : {}) };   // domanda sul vetrino: quale vetrino e che cosa cercare, mai la zona"),
])

GEN = 'Porta il vetrino sulla zona del reperto principale, poi premi «Indica sul vetrino» e cliccaci sopra.'
patch(R + '/web/app.js', [
 ("function preparaLocalizza() {",
  "// 1.323: testo della domanda sul vetrino; con «chiedi» il caso dice che cosa cercare (in grassetto, frase a parte per la traduzione)\n"
  "function testoLocVetrino(L) {\n"
  "  const box = $('#q-loc-testo');\n"
  "  if (!L?.chiedi) { box.textContent = '" + GEN + "'; return; }\n"
  "  box.innerHTML = `<b>${esc(L.chiedi)}</b> <span>Porta il vetrino sulla zona, poi premi «Indica sul vetrino» e cliccaci sopra.</span>`;\n"
  "}\n"
  "function preparaLocalizza() {"),
 ("    $('#q-loc-testo').textContent = '" + GEN + "';\n    $('#btn-punta').textContent = 'Indica sul vetrino';",
  "    testoLocVetrino(L);\n    $('#btn-punta').textContent = 'Indica sul vetrino';"),
 ("if (!q) { $('#q-loc-testo').textContent = V.punto ? 'Punto già indicato sul vetrino. Puoi cambiarlo prima di confermare.' : '" + GEN + "'; return; }",
  "if (!q) { if (V.punto) $('#q-loc-testo').textContent = 'Punto già indicato sul vetrino. Puoi cambiarlo prima di confermare.'; else testoLocVetrino(L); return; }"),
 ("  const domanda = V.soloVetrino ? confirm('Chiedere agli studenti di indicare il reperto sul vetrino prima di rispondere? (domanda sulla figura: pesa il 20% del punteggio)') : false;",
  "  const domanda = V.soloVetrino ? confirm('Chiedere agli studenti di indicare il reperto sul vetrino prima di rispondere? (domanda sulla figura: pesa il 20% del punteggio)') : false;\n"
  "  const chiedi = domanda ? prompt('Che cosa devono indicare gli studenti? (per esempio «Indica dove si vede la necrosi»; vuoto = «il reperto principale»)', V.caso?.zona_vetrino?.chiedi || '') : null;"),
 ("    const zona = { i: q.i, r: q.r, nota: nota.trim(), ...(domanda ? { domanda: true } : {}) };",
  "    const zona = { i: q.i, r: q.r, nota: nota.trim(), ...(domanda ? { domanda: true } : {}), ...(chiedi?.trim() ? { chiedi: chiedi.trim() } : {}) };"),
])

# testi nuovi in inglese (en.json è su una riga: si aggiungono chiavi in fondo senza riformattare)
p = R + '/web/lingua/en.json'; s = open(p, encoding='utf-8').read().rstrip()
nuovi = {
 'Porta il vetrino sulla zona, poi premi «Indica sul vetrino» e cliccaci sopra.': 'Move the slide to that area, then press «Point on the slide» and click on it.',
 "Che cosa devono indicare gli studenti? (per esempio «Indica dove si vede la necrosi»; vuoto = «il reperto principale»)": "What should students point to? (for example «Show where the necrosis is»; empty = «the main finding»)",
}
d = json.loads(s)
agg = {k: v for k, v in nuovi.items() if k not in d}
if agg:
    assert s.endswith('}')
    s = s[:-1] + ''.join(',' + json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False) for k, v in agg.items()) + '}'
    json.loads(s); open(p, 'w', encoding='utf-8').write(s)
print('ok', len(agg), 'testi inglesi aggiunti')
