import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A = W + 'app.js'; S = W + 'style.css'; I = W + 'index.html'
for f in (A, S, I): shutil.copy(f, f + '.bak_1107h')
s = open(A, encoding='utf-8').read()
def sost(vecchio, nuovo, n=1):
    global s
    c = s.count(vecchio)
    assert c == n, (vecchio[:90], c)
    s = s.replace(vecchio, nuovo)

sost("const FIN_ALTRE = { cmr: null, quiz: null, scale: null };", "const FIN_ALTRE = { cmr: null, quiz: null, scale: null, serie: null };")
sost("FIN_ALTRE.scale?.document].filter(Boolean);", "FIN_ALTRE.scale?.document, FIN_ALTRE.serie?.document].filter(Boolean);")
# anteprime: radice = barra delle serie ovunque sia (pagina o finestra separata), senza doppioni
sost("}, { root: qs1('.caso > .serie'), rootMargin: '200px' });", "}, { root: qs1('aside.serie'), rootMargin: '200px' });")
sost("for (const v of voci) if (v.isIntersecting) { osservaAnteprime.unobserve(v.target); coda.push(v.target); }",
     "for (const v of voci) if (v.isIntersecting) { osservaAnteprime.unobserve(v.target); if (!v.target.querySelector('canvas.anteprima')) coda.push(v.target); }")
# serie e linguette: comandi delegati ai contenitori (funzionano anche con la barra in un'altra finestra)
sost('''`<button class="s${nascoste.has(s._i) ? ' nascosta' : ''}" data-i="${i}"''', '''`<button class="s${nascoste.has(s._i) ? ' nascosta' : ''}" draggable="true" data-i="${i}"''')
sost('''  qsAll('#lista-serie .s').forEach((b) => {
    b.onclick = () => selezionaSerie(+b.dataset.i);
    b.draggable = true;
    b.ondragstart = (e) => { e.dataTransfer.setData('text/x-rq-serie', b.dataset.i); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('trascina-serie'); };
    b.ondragend = () => { document.body.classList.remove('trascina-serie'); V.sopra = null; disegna(); };
  });
''', '')
sost('''  qsAll('#tab-studi .tab-chiudi').forEach((x) => x.onclick = (e) => { e.stopPropagation(); chiudiStudio(x.dataset.chiudi); });
  qsAll('#tab-studi button').forEach((b) => b.onclick = async () => {
    mostraLinguetta(b.dataset.n);
    // mammografia: cliccando un esame (attuale o precedente) le sue proiezioni si dispongono nei 4 riquadri
    const n = +b.dataset.n.split('|')[0], st = mappaMG().find(([k]) => k === n);
    if (st && Object.keys(st[1]).length >= 2) { await apriWorkspaceMG('4', n); mostraLinguetta(b.dataset.n); }
  });
''', '')
sost("$('#btn-serie').addEventListener('click', () => barraSerie(!$('#vista-caso').classList.contains('senza-serie')));", r'''$('#btn-serie').addEventListener('click', () => barraSerie(!$('#vista-caso').classList.contains('senza-serie')));
{ const l = $('#lista-serie'), t = $('#tab-studi');
  l.addEventListener('click', (e) => { const b = e.target.closest('.s'); if (b && !b.disabled) selezionaSerie(+b.dataset.i); });
  l.addEventListener('dragstart', (e) => { const b = e.target.closest('.s'); if (!b) return; e.dataTransfer.setData('text/x-rq-serie', b.dataset.i); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('trascina-serie'); });
  l.addEventListener('dragend', () => { document.body.classList.remove('trascina-serie'); V.sopra = null; disegna(); });
  t.addEventListener('click', async (e) => {
    const x = e.target.closest('.tab-chiudi'); if (x) { e.stopPropagation(); chiudiStudio(x.dataset.chiudi); return; }
    const b = e.target.closest('button[data-n]'); if (!b) return;
    mostraLinguetta(b.dataset.n);
    // mammografia: cliccando un esame (attuale o precedente) le sue proiezioni si dispongono nei 4 riquadri
    const n = +b.dataset.n.split('|')[0], st = mappaMG().find(([k]) => k === n);
    if (st && Object.keys(st[1]).length >= 2) { await apriWorkspaceMG('4', n); mostraLinguetta(b.dataset.n); }
  });
}
// barra delle serie in una finestra separata (da spostare su un altro monitor, come il referto)
function staccaSerie() {
  const aside = $('aside.serie'), vista = $('#vista-caso'); if (!aside || !vista || FIN_ALTRE.serie) return;
  const w = window.open('', 'rq-serie-' + Date.now(), `popup,width=${Math.round(Math.min(560, screen.availWidth * 0.35))},height=${Math.round(Math.min(1000, screen.availHeight - 60))}`);
  if (!w) { avvisoBreve('Il browser ha bloccato la finestra: consenti le finestre popup per questo sito.'); return; }
  w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Serie · radio-quiz</title></head><body class="fin-serie"></body></html>'); w.document.close();
  copiaStili(w); FIN_ALTRE.serie = w;
  aside.classList.add('in-finestra'); w.document.body.append(aside); vista.classList.add('serie-staccata');
  aggiornaBtnSerieFinestra(); anteprimeSerie(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  let fatto = false;
  const rientra = () => { if (fatto) return; fatto = true; clearInterval(t); if (FIN_ALTRE.serie === w) FIN_ALTRE.serie = null;
    aside.classList.remove('in-finestra'); vista.prepend(aside); vista.classList.remove('serie-staccata');
    aggiornaBtnSerieFinestra(); anteprimeSerie(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); };
  const t = setInterval(() => { if (w.closed) rientra(); }, 700);
  w.addEventListener('pagehide', () => setTimeout(rientra, 0));
}
function chiudiSerieFinestra() { try { FIN_ALTRE.serie?.close(); } catch {} }
function aggiornaBtnSerieFinestra() {
  const b = $('#btn-serie-finestra'); if (!b) return;
  b.textContent = FIN_ALTRE.serie ? '⤓' : '⧉';
  b.title = FIN_ALTRE.serie ? 'Rimetti le serie nella pagina' : 'Apri le serie in una finestra separata (spostala su un altro monitor)';
}
$('#btn-serie-finestra')?.addEventListener('click', () => { if (FIN_ALTRE.serie) chiudiSerieFinestra(); else staccaSerie(); });
addEventListener('pagehide', chiudiSerieFinestra);''')
sost("if (nome !== 'caso') { stopCine(); if (MPR.attivo) modo2D(); $('#eco-pannello').hidden = true; chiudiCmrFinestra();",
     "if (nome !== 'caso') { stopCine(); if (MPR.attivo) modo2D(); $('#eco-pannello').hidden = true; chiudiCmrFinestra(); chiudiSerieFinestra();")
open(A, 'w', encoding='utf-8').write(s)

h = open(I, encoding='utf-8').read()
v = '''<h3><button id="btn-serie" type="button" class="btn-serie" title="Nascondi la barra delle serie (più spazio alle immagini)" aria-expanded="true">Serie ▾</button></h3>'''
assert h.count(v) == 1
h = h.replace(v, '''<h3><span class="serie-tit">Serie</span><button id="btn-serie" type="button" class="btn-serie" title="Nascondi la barra delle serie (più spazio alle immagini)" aria-expanded="true">Serie ▾</button><button id="btn-serie-finestra" type="button" class="btn-serie btn-serie-fin" title="Apri le serie in una finestra separata (spostala su un altro monitor)">⧉</button></h3>''')
open(I, 'w', encoding='utf-8').write(h)

c = open(S, encoding='utf-8').read()
c += '''
/* barra delle serie in una finestra separata */
.serie-tit{display:none}
.caso>.serie h3 .btn-serie-fin{margin-top:4px;padding:2px 4px;font-size:1em;line-height:1}
.caso.senza-serie>.serie h3 .btn-serie-fin{margin:0 0 0 4px}
@media (max-width:700px){#btn-serie-finestra{display:none}}
body.fin-serie{margin:0;background:var(--bg,var(--pan));color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
body.fin-serie aside.serie.in-finestra{border:0;padding:12px 14px 18px;min-height:100vh;box-sizing:border-box;overflow:visible;display:block;background:linear-gradient(180deg,var(--pan),color-mix(in srgb,var(--acc) 3%,var(--pan)))}
body.fin-serie aside.serie h3{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--bord);font-size:1.05rem;writing-mode:horizontal-tb;transform:none;position:sticky;top:0;z-index:2;background:var(--pan)}
body.fin-serie .serie-tit{display:inline;flex:1}
body.fin-serie #btn-serie{display:none}
body.fin-serie #btn-serie-finestra{font-size:1rem;padding:4px 10px;border-radius:8px}
body.fin-serie .serie-corpo{display:block}
body.fin-serie .tab-studi{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
body.fin-serie .tab-studi[hidden]{display:none}
body.fin-serie #lista-serie{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
body.fin-serie #lista-serie .s{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;width:100%;min-width:0;max-width:none;margin:0;padding:8px 10px 8px 8px;text-align:left;white-space:normal;line-height:1.25;font-size:.9em;border-radius:12px;background:var(--pan);border:1px solid var(--bord);color:var(--txt);cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}
body.fin-serie #lista-serie .s:hover{transform:translateY(-2px);border-color:var(--acc);box-shadow:0 8px 18px color-mix(in srgb,var(--acc) 18%,transparent)}
body.fin-serie #lista-serie .s.on{background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 22%,var(--pan)),var(--pan));border-color:var(--acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc) 35%,transparent)}
body.fin-serie #lista-serie .s[hidden]{display:none}
body.fin-serie #lista-serie .s canvas.anteprima{grid-row:1 / span 2;width:60px;height:60px;border-radius:8px;background:#000;box-shadow:0 2px 6px rgba(0,0,0,.25)}
body.fin-serie #lista-serie .s small{grid-column:2;color:var(--mut)}
body.fin-serie #lista-serie .s:not(:has(canvas)) small{grid-column:1 / -1}
body.fin-serie #lista-serie .s.chiusa{opacity:.5;cursor:not-allowed}
'''
open(S, 'w', encoding='utf-8').write(c)
print('ok')
