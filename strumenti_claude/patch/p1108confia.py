import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, H, C = W + 'app.js', W + 'index.html', W + 'style.css'
for f in (A, H, C): shutil.copy(f, f + '.bak_1108confia')
def sost(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

h = open(H, encoding='utf-8').read()
h = sost(h, '        <button id="btn-confronta" class="ico" hidden',
 '        <button id="btn-confronto-ia" class="ico" hidden aria-label="Confronto IA con il precedente" title="Confronto IA con l\'esame precedente: noduli abbinati, variazione di volume, tempo di raddoppio, Lung-RADS al controllo e RECIST (stime da verificare)">🤖</button>\n        <button id="btn-confronta" class="ico" hidden')
h = sost(h, '<div id="calcio-pannello" class="eco-pannello calcio-pannello" hidden></div>',
 '<div id="calcio-pannello" class="eco-pannello calcio-pannello" hidden></div>\n<div id="cfia-pannello" class="eco-pannello cfia-pannello" hidden></div>')
open(H, 'w', encoding='utf-8').write(h)

s = open(A, encoding='utf-8').read()
s = sost(s, "  $('#btn-confronta').hidden = V.studi.length < 2;   // con almeno due esami, anche di distretti diversi",
 "  $('#btn-confronta').hidden = V.studi.length < 2;   // con almeno due esami, anche di distretti diversi\n  caricaConfrontoIA();")
s = sost(s, "// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio",
r"""// ---------------------------------------------------------------- confronto IA con l'esame precedente
// casi/<id>/ia/confronto.json (strumenti/confronto_ia.py): allineamento affine dai baricentri delle strutture IA,
// noduli abbinati prima/dopo, variazione di volume, VDT, crescita Lung-RADS v2022, noduli nuovi e scomparsi, RECIST 1.1.
const CFIA = { dati: null, caso: null };
async function caricaConfrontoIA() {
  CFIA.dati = null; CFIA.caso = V.caso?.id; $('#btn-confronto-ia').hidden = true; $('#cfia-pannello').hidden = true;
  if (CLIENT || !V.caso?.id || V.studi.length < 2) return;
  const id = V.caso.id;
  try { const r = await fetch(`/casi/${id}/ia/confronto.json`, { credentials: 'same-origin' }); if (!r.ok || CFIA.caso !== id) return; CFIA.dati = await r.json(); }
  catch { return; }
  $('#btn-confronto-ia').hidden = false;
}
const mmV = (x) => (x == null ? '—' : virgola(+x, 1) + ' mm');
const pct = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${x}%`);
function testoConfrontoIA(d) {
  const mesi = d.intervallo_giorni ? Math.round(d.intervallo_giorni / 30.44) : null, r = [];
  r.push(`Confronto con l'esame precedente${mesi ? ` (intervallo ${mesi} mesi)` : ''}, stime automatiche da verificare:`);
  for (const c of d.coppie) r.push(`- nodulo ${c.tipo?.[1] || ''} del lobo ${c.lobo || '—'}: ${mmV(c.diametro_mm[0])} → ${mmV(c.diametro_mm[1])} (volume ${pct(c.variazione_volume_pct)}${c.vdt_giorni ? `, tempo di raddoppio ${c.vdt_giorni} giorni` : ''}): ${c.andamento === 'crescita' ? `in crescita (Lung-RADS ${c.lung_rads_controllo})` : c.andamento === 'riduzione' ? 'ridotto' : 'stabile'}`);
  for (const n of d.nuovi) r.push(`- nodulo nuovo ${n.tipo || ''} del lobo ${n.lobo || '—'}: ${mmV(n.diametro_mm)} (Lung-RADS ${n.lung_rads_controllo})`);
  for (const n of d.scomparsi) r.push(`- non più visibile il nodulo del lobo ${n.lobo || '—'} di ${mmV(n.diametro_mm)}`);
  if (d.recist) r.push(`RECIST 1.1: somma dei diametri ${mmV(d.recist.somma_mm[0])} → ${mmV(d.recist.somma_mm[1])} (${pct(d.recist.variazione_pct)}): ${d.recist.risposta}.`);
  r.push(`Lung-RADS al controllo proposto: ${d.lung_rads_controllo}.`);
  return r.join('\n');
}
async function vaiNoduloIA(prima, dopo) {
  const d = CFIA.dati; if (!d) return;
  const iP = V.serie.findIndex((x) => x._i === d.precedente.indice), iA = V.serie.findIndex((x) => x._i === d.attuale.indice);
  if (iP < 0 || iA < 0) { avvisoBreve('Le serie del confronto non sono nel caso'); return; }
  const nP = prima != null ? (await geoNoduli(d.precedente.serie))?.[prima] : null, nA = dopo != null ? (await geoNoduli(d.attuale.serie))?.[dopo] : null;
  if (V.n < 2) await impostaRiquadri(2);
  const sincro = V.sincro; V.sincro = false;
  try {
    await selezionaSerie(iP, 0, { idx: Math.max(0, (nP?.immagine || 1) - 1) });
    await selezionaSerie(iA, 1, { idx: Math.max(0, (nA?.immagine || 1) - 1) });
  } finally { V.sincro = sincro; }
  attiva(1); evidenziaSerie(); disegna();
}
const GEO_NODULI = new Map();
async function geoNoduli(cart) {
  const k = V.caso.id + '/' + cart;
  if (!GEO_NODULI.has(k)) GEO_NODULI.set(k, getJSON(`/casi/${V.caso.id}/ia/${cart}.json`).then((g) => g.analisi?.noduli || []).catch(() => []));
  return GEO_NODULI.get(k);
}
function pannelloConfrontoIA() {
  const box = $('#cfia-pannello'), d = CFIA.dati; if (!box || !d) return;
  box.hidden = false;
  const testa = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>🤖 Confronto IA con il precedente</b><span class="spacer"></span><button type="button" class="ghost piccolo" id="cfia-chiudi" aria-label="Chiudi">✕</button></div>`;
  if (!repertiIAConsentiti()) { box.innerHTML = testa + '<p class="small muted">Il confronto automatico con il precedente si vede dopo la risposta: prima prova da solo a confrontare i due esami.</p>'; legaPannelloCfia(box); return; }
  const mesi = d.intervallo_giorni ? Math.round(d.intervallo_giorni / 30.44) : null, al = d.allineamento || {};
  const LR = (x) => (x ? `<span class="cfia-lr lr-${String(x).toLowerCase()}">${esc(x)}</span>` : '<span class="muted small">da valutare</span>');
  const and = { crescita: '<b class="cfia-su">▲ crescita</b>', riduzione: '▼ ridotto', stabile: '= stabile' };
  box.innerHTML = testa + `<p class="small muted">${d.precedente.data ? esc(dataLeggibileIso(d.precedente.data)) : 'precedente'} → ${d.attuale.data ? esc(dataLeggibileIso(d.attuale.data)) : 'attuale'}${mesi ? ` · intervallo ${mesi} mesi` : ''} · allineamento su ${al.punti}/${al.punti_totali} strutture, errore mediano ${virgola(al.errore_mediano_mm ?? 0, 1)} mm</p>
    <table class="tab eco-tab cfia-tab"><thead><tr><th>Lobo</th><th>Diametro</th><th>Volume</th><th>VDT</th><th>Andamento</th><th>Lung-RADS</th><th></th></tr></thead><tbody>
    ${d.coppie.map((c) => `<tr><td>${esc(c.lobo || '—')}<br><span class="muted small">${esc(c.tipo?.[1] || '')}</span></td><td>${mmV(c.diametro_mm[0])} → <b>${mmV(c.diametro_mm[1])}</b></td><td>${pct(c.variazione_volume_pct)}</td><td>${c.vdt_giorni ? `${c.vdt_giorni} gg${c.vdt_giorni < 400 ? ' <b title="Sotto 400 giorni: crescita sospetta">!</b>' : ''}` : '—'}</td><td>${and[c.andamento] || ''}</td><td>${LR(c.lung_rads_controllo)}</td><td><button type="button" class="ghost piccolo" data-cfia="${c.prima},${c.dopo}">vai</button></td></tr>`).join('')}
    ${d.nuovi.map((n) => `<tr class="cfia-nuovo"><td>${esc(n.lobo || '—')}<br><span class="muted small">${esc(n.tipo || '')}</span></td><td>nuovo · <b>${mmV(n.diametro_mm)}</b></td><td>—</td><td>—</td><td><b>● nuovo</b></td><td>${LR(n.lung_rads_controllo)}</td><td><button type="button" class="ghost piccolo" data-cfia=",${n.dopo}">vai</button></td></tr>`).join('')}
    ${d.scomparsi.map((n) => `<tr class="muted"><td>${esc(n.lobo || '—')}</td><td>${mmV(n.diametro_mm)} → —</td><td>—</td><td>—</td><td>○ non più visto</td><td></td><td><button type="button" class="ghost piccolo" data-cfia="${n.prima},">vai</button></td></tr>`).join('')}
    </tbody></table>
    ${d.recist ? `<p class="small"><b>RECIST 1.1</b>: somma dei diametri dei bersagli ${mmV(d.recist.somma_mm[0])} → ${mmV(d.recist.somma_mm[1])} (${pct(d.recist.variazione_pct)}) → <b>${esc(d.recist.risposta)}</b><br><span class="muted">${esc(d.recist.nota)}</span></p>` : ''}
    <p><b>Lung-RADS al controllo (proposta)</b>: ${LR(d.lung_rads_controllo)} <span class="muted small">— i noduli stabili o ridotti si declassano secondo la storia (es. 4A stabile → 3 → 2): la categoria la decide il radiologo.</span></p>
    <p class="small muted">${esc(d.nota)} VDT sotto 400 giorni: crescita sospetta per neoplasia; oltre 600 giorni: crescita lenta o assente.</p>
    <p><button type="button" class="ghost piccolo" id="cfia-referto">Copia nel referto</button></p>`;
  box.querySelectorAll('[data-cfia]').forEach((b) => b.onclick = () => { const [p, a] = b.dataset.cfia.split(','); vaiNoduloIA(p === '' ? null : +p, a === '' ? null : +a); });
  $('#cfia-referto').onclick = () => { const t = $('#q-referto'), frase = testoConfrontoIA(d);
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else inserisciNelReferto(frase);
    avvisoBreve('Confronto copiato nel referto'); };
  legaPannelloCfia(box);
}
function legaPannelloCfia(box) {
  $('#cfia-chiudi').onclick = () => { box.hidden = true; };
  box.querySelector('.eco-testa').onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    const r0 = box.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
    const muovi = (ev) => { Object.assign(box.style, { left: Math.max(0, Math.min(innerWidth - r0.width, ev.clientX - dx)) + 'px', top: Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px', bottom: 'auto' }); };
    const fine = () => { removeEventListener('pointermove', muovi); removeEventListener('pointerup', fine); };
    addEventListener('pointermove', muovi); addEventListener('pointerup', fine);
  };
}
const dataLeggibileIso = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][+m[2] - 1]} ${m[1]}` : d; };
$('#btn-confronto-ia').addEventListener('click', () => { const b = $('#cfia-pannello'); if (!b.hidden) { b.hidden = true; return; } pannelloConfrontoIA(); });
// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio""")
# __dbg
s = sost(s, "window.__dbg = { GPU2D, CPRS, CAC, calcioDa,", "window.__dbg = { GPU2D, CPRS, CAC, CFIA, vaiNoduloIA, calcioDa,")
open(A, 'w', encoding='utf-8').write(s)

c = open(C, encoding='utf-8').read()
c += """
/* confronto IA con il precedente */
.cfia-pannello{width:min(620px,calc(100vw - 32px))}
.cfia-tab td,.cfia-tab th{padding:3px 6px;vertical-align:top;font-size:.86em}
.cfia-tab .cfia-nuovo td{background:color-mix(in srgb,var(--warn) 10%,transparent)}
.cfia-su{color:var(--ko)}
.cfia-lr{display:inline-block;padding:0 6px;border-radius:6px;font-weight:700;border:1px solid var(--bord)}
.cfia-lr.lr-4a,.cfia-lr.lr-4b,.cfia-lr.lr-4x{border-color:var(--ko);color:var(--ko)}
.cfia-lr.lr-3{border-color:var(--warn);color:var(--warn)}
"""
open(C, 'w', encoding='utf-8').write(c)
print('ok')
