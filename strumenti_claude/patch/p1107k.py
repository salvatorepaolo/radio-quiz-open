import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A = W + 'app.js'; S = W + 'style.css'; I = W + 'index.html'
for f in (A, S, I): shutil.copy(f, f + '.bak_1107k')
s = open(A, encoding='utf-8').read()
def sost(vecchio, nuovo, n=1):
    global s
    c = s.count(vecchio); assert c == n, (vecchio[:90], c); s = s.replace(vecchio, nuovo)

sost("$('#cpr-crea').disabled = $('#cpr-vaso').disabled = n < 2; }", "$('#cpr-crea').disabled = $('#cpr-vaso').disabled = $('#cpr-diametri').disabled = n < 2; }")
sost("function esciCPR() { CPRS.vaso = null;", "function esciCPR() { CPRS.vaso = null; CPRS.diam = null; CPRS.nomeIA = null;")
sost("""  $('#cpr-aorta').hidden = !(MPR.ia?.geo?.etichette && Object.values(MPR.ia.geo.etichette).includes('aorta') && MPR.modulo.lineaAortaIA);
});""", """  // vasi della segmentazione IA per la linea centrale automatica
  const pres = new Set(Object.values(MPR.ia?.geo?.etichette || {})), vasi = MPR.modulo.lineaVasoIA ? VASI_IA.filter(([k]) => pres.has(k)) : [];
  const sel = $('#cpr-ia-vaso'); sel.innerHTML = vasi.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join(''); sel.hidden = vasi.length < 2;
  $('#cpr-aorta').hidden = !vasi.length; CPRS.nomeIA = null;
});
const VASI_IA = [['aorta', 'Aorta'], ['inferior_vena_cava', 'Vena cava inferiore'], ['portal_vein_and_splenic_vein', 'Vena porta e splenica'],
  ['iliac_artery_right', 'Arteria iliaca destra'], ['iliac_artery_left', 'Arteria iliaca sinistra'], ['iliac_vena_right', 'Vena iliaca destra'], ['iliac_vena_left', 'Vena iliaca sinistra'],
  ['common_carotid_artery_right', 'Carotide comune destra'], ['common_carotid_artery_left', 'Carotide comune sinistra'], ['brachiocephalic_trunk', 'Tronco brachiocefalico'],
  ['subclavian_artery_right', 'Succlavia destra'], ['subclavian_artery_left', 'Succlavia sinistra'], ['superior_vena_cava', 'Vena cava superiore'], ['pulmonary_artery', 'Arteria polmonare'],
  ['brachiocephalic_vein_right', 'Vena brachiocefalica destra'], ['brachiocephalic_vein_left', 'Vena brachiocefalica sinistra']];
async function caricaLabIA() {
  const ia = MPR.ia; if (!ia) throw new Error('segmentazione IA non disponibile');
  if (!ia.lab) { statoMPR('Scarico la segmentazione IA…'); const r = await fetch(ia.url, { credentials: 'same-origin' }); if (!r.ok) throw new Error('file della segmentazione non trovato'); ia.lab = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); statoMPR(''); }
  return ia;
}""")
sost("""$('#cpr-aorta').addEventListener('click', async () => {
  const ia = MPR.ia; if (!ia) return;
  try {
    if (!ia.lab) { statoMPR('Scarico la segmentazione IA…'); const r = await fetch(ia.url, { credentials: 'same-origin' }); if (!r.ok) throw new Error('file della segmentazione non trovato'); ia.lab = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); statoMPR(''); }
    const r = MPR.modulo.lineaAortaIA({ geo: ia.geo, lab: ia.lab });
    if (!r.ok) { avvisoBreve('Aorta automatica: ' + r.motivo); return; }
    avvisoBreve(`Linea centrale dell'aorta: ${r.n} punti, circa ${Math.round(r.lunghezza / 10)} cm (aorta discendente e addominale). Correggi i punti se serve.`);
    $('#cpr-crea').click();
  } catch (e) { avvisoBreve('Aorta automatica non riuscita: ' + e.message); }
});""", """$('#cpr-aorta').addEventListener('click', async () => {
  if (!MPR.ia) return;
  const nome = $('#cpr-ia-vaso').value || 'aorta', nomeIt = (VASI_IA.find(([k]) => k === nome) || [, nome])[1];
  try {
    const ia = await caricaLabIA(); statoMPR('Linea centrale…'); await pausa(30);
    const r = nome === 'aorta' ? MPR.modulo.lineaAortaIA({ geo: ia.geo, lab: ia.lab }) : MPR.modulo.lineaVasoIA({ geo: ia.geo, lab: ia.lab, nome });
    statoMPR('');
    if (!r.ok) { avvisoBreve(`${nomeIt} (IA): ${r.motivo}`); return; }
    avvisoBreve(nome === 'aorta' ? `Linea centrale dell'aorta: ${r.n} punti, circa ${Math.round(r.lunghezza / 10)} cm (aorta discendente e addominale). Correggi i punti se serve.`
      : `Linea centrale: ${nomeIt.toLowerCase()}, ${r.n} punti, circa ${Math.round(r.lunghezza / 10)} cm. Correggi i punti se serve.`);
    CPRS.nomeIA = nome; $('#cpr-crea').click(); await calcolaDiametri();
  } catch (e) { statoMPR(''); avvisoBreve('Linea centrale automatica non riuscita: ' + e.message); }
});
// diametri perpendicolari alla linea centrale in tutto il tratto: il massimo è la misura degli aneurismi
async function calcolaDiametri() {
  statoMPR('Diametri del vaso…'); await pausa(30);
  try {
    if (MPR.ia?.geo) { try { await caricaLabIA(); } catch {} }
    const vaso = MPR.ia?.lab ? MPR.modulo.impostaMascheraVaso({ geo: MPR.ia.geo, lab: MPR.ia.lab, nome: CPRS.nomeIA }) : MPR.modulo.impostaMascheraVaso({});
    const r = MPR.modulo.diametriVaso();
    if (!r.ok) { $('#mpr-info').textContent = 'Diametri del vaso: ' + r.motivo; return; }
    r.vaso = vaso || r.vaso; CPRS.vaso = null; CPRS.diam = r; CPRS.pos = r.massimo?.s ?? 0;
    $('#cpr-analisi').hidden = false; disegnaCPR(); disegnaDiametri(); T.misure++;
  } catch (e) { console.error(e); $('#mpr-info').textContent = 'Diametri del vaso non riusciti: ' + e.message; }
  finally { statoMPR(''); }
}
$('#cpr-diametri').addEventListener('click', calcolaDiametri);
function disegnaDiametri() {
  const r = CPRS.diam; if (!r) return;
  $('#cpr-sezione').hidden = false; $('#cpr-pos').hidden = false;
  const pos = $('#cpr-pos'); pos.max = String(r.lunghezza); pos.value = String(CPRS.pos);
  // profilo: diametro massimo, ortogonale e lume
  const tela = $('#cpr-profilo'), w = tela.width = Math.max(100, Math.round(tela.getBoundingClientRect().width)), h = tela.height, k = tela.getContext('2d');
  const val = r.profilo.filter(Boolean), max = Math.max(...val.map((x) => x.dmax), 10) * 1.1, X = (s) => 30 + (s / Math.max(1, r.lunghezza)) * (w - 40), Y = (d) => h - 14 - (d / max) * (h - 24);
  k.fillStyle = '#0d1117'; k.fillRect(0, 0, w, h); k.font = '10px system-ui'; k.fillStyle = '#9aa4b2';
  for (let d = 0; d <= max; d += max > 40 ? 20 : 10) { k.fillText(`${d}`, 4, Y(d) + 3); k.strokeStyle = 'rgba(255,255,255,.08)'; k.beginPath(); k.moveTo(30, Y(d)); k.lineTo(w - 10, Y(d)); k.stroke(); }
  k.fillText('mm', 4, 10);
  const linea = (campo, colore, tratt) => { k.strokeStyle = colore; k.lineWidth = 1.5; k.setLineDash(tratt ? [4, 3] : []); k.beginPath(); let su = false; for (const x of r.profilo) { if (!x) { su = false; continue; } su ? k.lineTo(X(x.s), Y(x[campo])) : k.moveTo(X(x.s), Y(x[campo])); su = true; } k.stroke(); k.setLineDash([]); };
  if (r.parete === 'ia') linea('dlume', '#7ee787', true);
  linea('dperp', 'rgba(120,180,255,.8)'); linea('dmax', '#ffd23c');
  if (r.massimo) { k.strokeStyle = '#ff6b5b'; k.beginPath(); k.moveTo(X(r.massimo.s), 4); k.lineTo(X(r.massimo.s), h - 12); k.stroke(); }
  k.strokeStyle = '#3ad1ff'; k.beginPath(); k.moveTo(X(CPRS.pos), 4); k.lineTo(X(CPRS.pos), h - 12); k.stroke();
  tela.onclick = (e) => { const b = tela.getBoundingClientRect(), x = (e.clientX - b.left) * (w / b.width); CPRS.pos = Math.max(0, Math.min(r.lunghezza, Math.round((x - 30) / (w - 40) * r.lunghezza))); disegnaDiametri(); disegnaCPR(); };
  // sezione perpendicolare nel punto scelto
  const sz = MPR.modulo.sezioneVaso(CPRS.pos), tv = $('#cpr-sezione'), kv = tv.getContext('2d');
  kv.fillStyle = '#000'; kv.fillRect(0, 0, tv.width, tv.height);
  if (sz) {
    const c = document.createElement('canvas'); c.width = c.height = sz.lato; const cx = c.getContext('2d'), id = cx.createImageData(sz.lato, sz.lato), lo = sz.voi.lower, sc = 255 / Math.max(1, sz.voi.upper - sz.voi.lower);
    for (let i = 0; i < sz.dati.length; i++) { const g = Math.max(0, Math.min(255, (sz.dati[i] - lo) * sc)); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = g; id.data[i * 4 + 3] = 255; }
    cx.putImageData(id, 0, 0); kv.imageSmoothingEnabled = true; kv.drawImage(c, 0, 0, tv.width, tv.height);
    const f = tv.width / sz.lato, P = ([x, y]) => [x * f, y * f];
    const poli = (pts, col, tr) => { if (!pts) return; kv.strokeStyle = col; kv.lineWidth = 1.5; kv.setLineDash(tr ? [3, 3] : []); kv.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? kv.lineTo(x, y) : kv.moveTo(x, y); }); kv.closePath(); kv.stroke(); kv.setLineDash([]); };
    poli(sz.lume, '#7ee787', true); poli(sz.contorno, '#ffd23c');
    for (const l of sz.linee || []) { kv.strokeStyle = l.tipo === 'max' ? '#ff6b5b' : '#78b4ff'; kv.lineWidth = 2; kv.beginPath(); kv.moveTo(...P(l.a)); kv.lineTo(...P(l.b)); kv.stroke(); }
    kv.font = 'bold 12px system-ui'; kv.fillStyle = '#ff6b5b'; kv.fillText(`${virgola(sz.dmax || 0, 1)} mm`, 6, 16); kv.fillStyle = '#78b4ff'; kv.fillText(`${virgola(sz.dperp || 0, 1)} mm`, 6, 31);
    kv.fillStyle = '#3ad1ff'; kv.font = '11px system-ui'; kv.fillText(`${virgola(CPRS.pos / 10, 1)} cm`, 6, tv.height - 6);
  }
  // esito
  const mm = (x) => virgola(x, 1), m = r.massimo, rifMin = Math.min(r.rifP || Infinity, r.rifD || Infinity), rapp = m && isFinite(rifMin) && rifMin > 0 ? m.dmax / rifMin : null;
  const nomeV = r.vaso ? (VASI_IA.find(([k]) => k === r.vaso)?.[1] || r.vaso) : '';
  const giudizio = rapp == null ? '' : rapp >= 1.5 ? `<b>aspetto aneurismatico</b> (${mm(rapp)} volte il diametro agli estremi)` : rapp >= 1.2 ? `ectasia (${mm(rapp)} volte il diametro agli estremi)` : `calibro regolare rispetto agli estremi (${mm(rapp)} volte)`;
  const aorta = r.vaso === 'aorta' || CPRS.nomeIA === 'aorta';
  $('#cpr-esito').innerHTML = `<span style="color:#ffd23c">— diametro massimo</span> · <span style="color:#78b4ff">— ortogonale</span>${r.parete === 'ia' ? ' · <span style="color:#7ee787">- - lume</span>' : ''} · <span style="color:#3ad1ff">| sezione mostrata</span><br>`
    + (m ? `${nomeV ? esc(nomeV) + ': d' : 'D'}iametro massimo perpendicolare all'asse <b>${mm(m.dmax)} mm</b> (ortogonale ${mm(m.dperp)} mm) a ${mm(m.s / 10)} cm dall'inizio del tratto; `
      + (r.parete === 'ia' ? `parete esterna dalla segmentazione IA, trombo compreso; lume opacizzato ${mm(m.dlume)} mm. ` : 'misurato sul lume opacizzato (senza trombo). ')
      + `Agli estremi ${mm(r.rifP)} → ${mm(r.rifD)} mm: ${giudizio}.` : 'Nessuna sezione misurabile.')
    + (aorta && m ? ` <span class="muted">Aorta addominale: aneurisma da 30 mm; la riparazione si considera di solito da 55 mm negli uomini e da 50 mm nelle donne (ESVS 2024).</span>` : '')
    + ` <span class="muted">Stima automatica, da verificare sulla sezione.</span> <button type="button" class="ghost piccolo" id="cpr-referto">Copia nel referto</button>`;
  $('#cpr-referto').onclick = () => { const t = $('#q-referto'); if (!t || !m) return;
    t.value = (t.value.trim() ? t.value.trim() + '\\n' : '') + `${nomeV || 'Vaso'}: diametro massimo perpendicolare all'asse ${mm(m.dmax)} x ${mm(m.dperp)} mm a ${mm(m.s / 10)} cm dall'inizio del tratto esaminato${r.parete === 'ia' ? ` (lume opacizzato ${mm(m.dlume)} mm)` : ''}; ${mm(r.rifP)} e ${mm(r.rifD)} mm agli estremi.`;
    t.closest('details')?.setAttribute('open', ''); };
}
$('#cpr-pos').addEventListener('input', () => { CPRS.pos = +$('#cpr-pos').value; disegnaDiametri(); disegnaCPR(); });""")
sost("$('#cpr-crea').addEventListener('click', () => { CPRS.vaso = null; $('#cpr-analisi').hidden = true; disegnaCPR(); });",
     "$('#cpr-crea').addEventListener('click', () => { CPRS.vaso = null; CPRS.diam = null; $('#cpr-analisi').hidden = true; $('#cpr-sezione').hidden = $('#cpr-pos').hidden = true; disegnaCPR(); });")
sost("    CPRS.vaso = r; $('#cpr-analisi').hidden = false; disegnaCPR(); disegnaProfilo(); T.misure++;",
     "    CPRS.vaso = r; CPRS.diam = null; $('#cpr-sezione').hidden = $('#cpr-pos').hidden = true; $('#cpr-analisi').hidden = false; disegnaCPR(); disegnaProfilo(); T.misure++;")
# sulla CPR: punto di diametro massimo e sezione mostrata
sost("""  const m = CPRS.vaso?.minimo; if (m) {""", """  const dm = CPRS.diam; if (dm?.massimo) { const y = oy + (dm.massimo.s / r.passo) * s; k.strokeStyle = '#ff6b5b'; k.setLineDash([5, 4]); k.beginPath(); k.moveTo(ox, y); k.lineTo(ox + w, y); k.stroke(); k.setLineDash([]); k.fillStyle = '#ff6b5b'; k.fillText(`⌀ ${virgola(dm.massimo.dmax, 0)}`, ox + w + 4, y + 4);
    const yp = oy + (CPRS.pos / r.passo) * s; k.strokeStyle = '#3ad1ff'; k.beginPath(); k.moveTo(ox, yp); k.lineTo(ox + w, yp); k.stroke(); }
  const m = CPRS.vaso?.minimo; if (m) {""")
open(A, 'w', encoding='utf-8').write(s)

h = open(I, encoding='utf-8').read()
v = '''<button id="cpr-aorta" class="ghost" type="button" hidden title="Linea centrale dell'aorta dalla segmentazione IA (aorta discendente e addominale): i punti si possono poi correggere">🫀 Aorta (IA)</button>'''
assert h.count(v) == 1
h = h.replace(v, '''<select id="cpr-ia-vaso" class="compatto" hidden title="Vaso per la linea centrale automatica"></select><button id="cpr-aorta" class="ghost" type="button" hidden title="Linea centrale del vaso dalla segmentazione IA, poi CPR e diametri: i punti si possono correggere">🩸 Linea IA</button>''')
v = '<button id="cpr-crea" class="primary" type="button" disabled>Crea CPR</button>'
assert h.count(v) == 1
h = h.replace(v, v + ' <button id="cpr-diametri" class="primary" type="button" disabled title="Diametro massimo perpendicolare alla linea centrale lungo tutto il tratto (aneurismi, ectasie), con la sezione">⌀ Diametri</button>')
v = '<div id="cpr-analisi" class="cpr-analisi" hidden><canvas id="cpr-profilo" height="90"></canvas><div id="cpr-esito"></div></div>'
assert h.count(v) == 1
h = h.replace(v, '<div id="cpr-analisi" class="cpr-analisi" hidden><div class="cpr-an-riga"><div class="cpr-an-graf"><canvas id="cpr-profilo" height="90"></canvas><input type="range" id="cpr-pos" min="0" max="100" value="0" hidden title="Sezione perpendicolare: posizione lungo la linea centrale"></div><canvas id="cpr-sezione" width="170" height="170" hidden title="Sezione perpendicolare alla linea centrale"></canvas></div><div id="cpr-esito"></div></div>')
open(I, 'w', encoding='utf-8').write(h)

c = open(S, encoding='utf-8').read()
c += '''
/* diametri del vaso: profilo e sezione perpendicolare */
.cpr-an-riga{display:flex;gap:8px;align-items:flex-start}
.cpr-an-graf{flex:1;min-width:0}
.cpr-an-graf #cpr-pos{width:100%;margin:2px 0 0}
#cpr-sezione{width:120px;height:120px;flex:none;border-radius:6px;background:#000;cursor:crosshair}
#cpr-sezione[hidden]{display:none}
#cpr-profilo{cursor:pointer}
.cpr-analisi{max-height:52%;overflow:auto}
'''
open(S, 'w', encoding='utf-8').write(c)
print('ok')
