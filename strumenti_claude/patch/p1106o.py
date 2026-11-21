# 1.212: scheda RM cardiaca in una finestra separata (spostabile su un altro monitor), come il referto
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)
a = open(R + 'web/app.js', encoding='utf-8').read()
a = sost(a, "const FIN_REF = { win: null };", "const FIN_REF = { win: null };\n// altre finestre separate (scheda della RM cardiaca): $ cerca anche lì\nconst FIN_ALTRE = { cmr: null };", 'fin altre')
a = sost(a, "const $ = (s) => document.querySelector(s) || FIN_REF.win?.document.querySelector(s) || null;",
  "const $ = (s) => document.querySelector(s) || FIN_REF.win?.document.querySelector(s) || FIN_ALTRE.cmr?.document.querySelector(s) || null;", '$')
a = sost(a, "<span class=\"spacer\"></span><button class=\"ghost piccolo\" id=\"cmr-riduci\">",
  "<span class=\"spacer\"></span><button class=\"ghost piccolo\" id=\"cmr-finestra\" title=\"${FIN_ALTRE.cmr ? 'Rimetti la scheda nella pagina' : 'Apri la scheda in una finestra separata (spostala su un altro monitor)'}\">${FIN_ALTRE.cmr ? '⤓' : '⧉'}</button><button class=\"ghost piccolo\" id=\"cmr-riduci\">", 'header')
a = sost(a, "  $('#cmr-chiudi').onclick = () => { box.hidden = true; scegliStrumento('wl'); };",
  "  $('#cmr-chiudi').onclick = () => { if (FIN_ALTRE.cmr) { chiudiCmrFinestra(); return; } box.hidden = true; scegliStrumento('wl'); };\n"
  "  $('#cmr-finestra').onclick = () => { if (FIN_ALTRE.cmr) chiudiCmrFinestra(); else staccaCmr(); };", 'chiudi')
a = sost(a, "  box.querySelector('.eco-testa').onpointerdown = (e) => {\n    if (e.target.closest('button')) return;",
  "  box.querySelector('.eco-testa').onpointerdown = (e) => {\n    if (e.target.closest('button') || FIN_ALTRE.cmr) return;", 'drag')
a = sost(a, "  $('#cmr-pannello').hidden = V.tool !== 'cmr'; if (V.tool === 'cmr') { stopCine(); pannelloCmr(); }",
  "  $('#cmr-pannello').hidden = V.tool !== 'cmr' && !FIN_ALTRE.cmr; if (V.tool === 'cmr') { stopCine(); pannelloCmr(); }", 'tool')
a = sost(a, "$('#cmr-pannello').hidden = true;", "chiudiCmrFinestra(); $('#cmr-pannello').hidden = true;", 'cambio caso', 2)
a = sost(a, "function pannelloCmr() {",
  "// ---- scheda della RM cardiaca in una finestra separata (window.open: si può spostare su un altro monitor e restare\n"
  "// aperta insieme al referto, che usa la finestra Picture-in-Picture). Il pannello si sposta lì con i suoi gestori.\n"
  "function copiaStili(w) {\n"
  "  for (const sh of document.styleSheets) {\n"
  "    try { const st = w.document.createElement('style'); st.textContent = [...sh.cssRules].map((r) => r.cssText).join('\\n'); w.document.head.append(st); }\n"
  "    catch { if (sh.href) { const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = sh.href; w.document.head.append(l); } }\n"
  "  }\n"
  "  w.document.documentElement.lang = document.documentElement.lang;\n"
  "  for (const [k, v] of Object.entries(document.documentElement.dataset)) w.document.documentElement.dataset[k] = v;\n"
  "}\n"
  "function chiudiCmrFinestra() { try { FIN_ALTRE.cmr?.close(); } catch {} }\n"
  "function staccaCmr() {\n"
  "  const box = $('#cmr-pannello'); if (!box || FIN_ALTRE.cmr) return;\n"
  "  const w = window.open('', 'rq-cmr', `popup,width=${Math.round(Math.min(600, screen.availWidth * 0.4))},height=${Math.round(Math.min(980, screen.availHeight - 60))}`);\n"
  "  if (!w) { avvisoBreve('Il browser ha bloccato la finestra: consenti le finestre popup per questo sito.'); return; }\n"
  "  w.document.open(); w.document.write('<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>RM cardiaca · radio-quiz</title></head><body class=\"fin-cmr\"></body></html>'); w.document.close();\n"
  "  copiaStili(w);\n"
  "  FIN_ALTRE.cmr = w;\n"
  "  box.classList.add('in-finestra'); box.removeAttribute('style'); box.hidden = false; w.document.body.append(box); pannelloCmr();\n"
  "  let fatto = false;\n"
  "  const rientra = () => { if (fatto) return; fatto = true; clearInterval(t); if (FIN_ALTRE.cmr === w) FIN_ALTRE.cmr = null;\n"
  "    box.classList.remove('in-finestra'); document.body.append(box); box.hidden = V.tool !== 'cmr'; pannelloCmr(); };\n"
  "  const t = setInterval(() => { if (w.closed) rientra(); }, 700);\n"
  "  w.addEventListener('pagehide', () => setTimeout(rientra, 0));\n"
  "}\n"
  "addEventListener('pagehide', chiudiCmrFinestra);\n"
  "function pannelloCmr() {", 'staccaCmr')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)
c = open(R + 'web/style.css', encoding='utf-8').read()
if 'body.fin-cmr' not in c:
    c += '''
/* scheda RM cardiaca in una finestra separata */
body.fin-cmr{margin:0;background:var(--pan);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.eco-pannello.in-finestra{position:static;width:auto;max-height:none;overflow:visible;border:0;border-radius:0;box-shadow:none;padding:12px 16px;font-size:15px}
.eco-pannello.in-finestra .eco-testa{cursor:default}
'''
    open(R + 'web/style.css', 'w', encoding='utf-8').write(c)
en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
for k, v in {'Rimetti la scheda nella pagina': 'Put the panel back in the page', 'Apri la scheda in una finestra separata (spostala su un altro monitor)': 'Open the panel in a separate window (move it to another monitor)',
             'Il browser ha bloccato la finestra: consenti le finestre popup per questo sito.': 'The browser blocked the window: allow pop-ups for this site.'}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('cmr finestra OK')
