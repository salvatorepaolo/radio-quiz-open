import re, shutil, time
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A = W + 'app.js'; S = W + 'style.css'
for f in (A, S): shutil.copy(f, f + '.bak_1107g')
s = open(A, encoding='utf-8').read()
def sost(vecchio, nuovo, n=1):
    global s
    c = s.count(vecchio)
    assert c == n, (vecchio[:80], c)
    s = s.replace(vecchio, nuovo)

sost("const FIN_ALTRE = { cmr: null, quiz: null };", "const FIN_ALTRE = { cmr: null, quiz: null, scale: null };")
sost("FIN_ALTRE.quiz?.document].filter(Boolean);", "FIN_ALTRE.quiz?.document, FIN_ALTRE.scale?.document].filter(Boolean);")
sost("if (typeof sceltaIniziale !== 'string') { box.hidden = !box.hidden; if (box.hidden) return; } else box.hidden = false;",
     "if (typeof sceltaIniziale !== 'string' && !FIN_ALTRE.scale) { box.hidden = !box.hidden; if (box.hidden) return; } else { box.hidden = false; try { FIN_ALTRE.scale?.focus(); } catch {} }")
sost('<button class="ghost" id="scala-chiudi" title="Chiudi">✕</button>', '${btnFinScale()}<button class="ghost" id="scala-chiudi" title="Chiudi">✕</button>', 2)
sost("$('#scala-chiudi').onclick = () => { box.hidden = true; };", "legaChiudiScale(box);", 2)
sost("new MutationObserver(() => {\n    if (box.hidden) { viewer.classList.remove('con-scheda');",
     "new MutationObserver(() => {\n    if (box.hidden || FIN_ALTRE.scale) { viewer.classList.remove('con-scheda');")
sost("$('#aspects').hidden = true; $('#scale').hidden = true;", "$('#aspects').hidden = true; chiudiScaleFinestra(); $('#scale').hidden = true;")
nuovo = r'''addEventListener('pagehide', chiudiCmrFinestra);
// scheda delle scale in una finestra separata (da spostare su un altro monitor, come il referto)
function chiudiScaleFinestra() { try { FIN_ALTRE.scale?.close(); } catch {} }
function btnFinScale() {
  return `<button class="ghost" id="scala-finestra" type="button" title="${FIN_ALTRE.scale ? 'Rimetti la scheda nella pagina' : 'Apri la scheda in una finestra separata (spostala su un altro monitor)'}">${FIN_ALTRE.scale ? '⤓' : '⧉'}</button> `;
}
function legaChiudiScale(box) {
  $('#scala-chiudi').onclick = () => { if (FIN_ALTRE.scale) { chiudiScaleFinestra(); return; } box.hidden = true; };
  const f = $('#scala-finestra');
  if (f) f.onclick = () => { if (FIN_ALTRE.scale) { FIN_ALTRE.scale.__torna = true; chiudiScaleFinestra(); } else staccaScale(); };
}
function staccaScale() {
  const box = $('#scale'); if (!box || FIN_ALTRE.scale) return;
  const w = window.open('', 'rq-scale', `popup,width=${Math.round(Math.min(980, screen.availWidth * 0.5))},height=${Math.round(Math.min(1000, screen.availHeight - 60))}`);
  if (!w) { avvisoBreve('Il browser ha bloccato la finestra: consenti le finestre popup per questo sito.'); return; }
  w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Scale e classificazioni · radio-quiz</title></head><body class="fin-scale"></body></html>'); w.document.close();
  copiaStili(w);
  const padre = box.parentNode, dopo = box.nextSibling, viewer = box.closest('.viewer');
  FIN_ALTRE.scale = w;
  box.classList.add('in-finestra'); box.hidden = false; w.document.body.append(box);
  viewer?.classList.remove('con-scheda'); viewer?.style.removeProperty('--alt-img');
  const aggiornaBtn = () => { const b = $('#scala-finestra'); if (!b) return; const t = document.createElement('template'); t.innerHTML = btnFinScale().trim(); b.title = t.content.firstChild.title; b.textContent = t.content.firstChild.textContent; };
  aggiornaBtn(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  let fatto = false;
  const rientra = () => { if (fatto) return; fatto = true; clearInterval(t); const torna = !!w.__torna; if (FIN_ALTRE.scale === w) FIN_ALTRE.scale = null;
    box.classList.remove('in-finestra'); padre.insertBefore(box, dopo && dopo.parentNode === padre ? dopo : null);
    box.hidden = true; aggiornaBtn();
    if (torna) setTimeout(() => { box.hidden = false; }, 0);   // «Rimetti nella pagina»: la scheda resta aperta sotto le immagini
    setTimeout(() => window.dispatchEvent(new Event('resize')), 30); };
  const t = setInterval(() => { if (w.closed) rientra(); }, 700);
  w.addEventListener('pagehide', () => setTimeout(rientra, 0));
}
addEventListener('pagehide', chiudiScaleFinestra);'''
sost("addEventListener('pagehide', chiudiCmrFinestra);", nuovo)
sost("  if (k === 'mammella' && met === 'Mammografia') return true;\n  if (k === 'cinetica' && met === 'Ecocardio') return true;",
     "  // esame cardiaco (anche se il titolo cita altri organi, p.es. il fegato nella T2*): solo le scale del cuore\n  const cardiaco = /cuor|cardi/i.test(c.distretto || '') || (['RM', 'TC'].includes(met) && /(rm|risonanza|tc)\\s+(del\\s+)?(cardiac|cuore)|cardio[\\s-]*(rm|tc)/i.test(c.titolo || '')) || (CLIENT && met === 'RM' && /cuore cardiaco/.test(testo));\n  if (cardiaco && !ORGANO_SCALA[k]?.test('cuore cardiaco miocardio ventricolo')) return false;\n  if (k === 'mammella' && met === 'Mammografia') return true;\n  if (k === 'cinetica' && met === 'Ecocardio') return true;")
open(A, 'w', encoding='utf-8').write(s)
css = open(S, encoding='utf-8').read()
css += '''
/* scale e classificazioni in una finestra separata */
body.fin-scale{margin:0;background:var(--pan);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
body.fin-scale .scale.in-finestra{margin:0;border:0;border-radius:0;box-shadow:none;max-width:none;max-height:none;min-height:100vh;box-sizing:border-box;padding:16px 22px;overflow:visible}
body.fin-scale .scale.in-finestra .scale-testa{position:sticky;top:0;z-index:5;background:var(--pan);padding:6px 0 10px;border-bottom:1px solid var(--bord)}
'''
open(S, 'w', encoding='utf-8').write(css)
print('ok')
