import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, H = W + 'app.js', W + 'index.html'
for f in (A, H): shutil.copy(f, f + '.bak_1108assistito')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a)); s = s.replace(a, b)

# pulsante 🤖 anche nel visualizzatore scaricabile e nei casi senza analisi IA preparata: confronto assistito
sost("""async function caricaConfrontoIA() {
  CFIA.dati = null; CFIA.caso = V.caso?.id; $('#btn-confronto-ia').hidden = true; $('#cfia-pannello').hidden = true;
  if (CLIENT || !V.caso?.id || V.studi.length < 2) return;
  const id = V.caso.id;""", """async function caricaConfrontoIA() {
  CFIA.dati = null; CFIA.caso = V.caso?.id; CFIA.lesioni = []; CFIA.attesa = false; $('#btn-confronto-ia').hidden = true; $('#cfia-pannello').hidden = true;
  if (!V.caso?.id || V.studi.length < 2) return;
  // con almeno due esami il confronto assistito c'è sempre; nei casi della piattaforma con l'analisi IA preparata, quella
  $('#btn-confronto-ia').hidden = false;
  if (CLIENT) return;
  const id = V.caso.id;""")
sost("""$('#btn-confronto-ia').addEventListener('click', () => { const b = $('#cfia-pannello'); if (!b.hidden) { b.hidden = true; return; } pannelloConfrontoIA(); });""",
"""$('#btn-confronto-ia').addEventListener('click', () => { const b = $('#cfia-pannello'); if (!b.hidden) { b.hidden = true; return; } if (CFIA.dati) pannelloConfrontoIA(); else pannelloAssistito(); });
// ---- confronto assistito (visualizzatore scaricabile e casi senza analisi IA): si clicca ogni lesione nell'esame attuale;
// il volume si misura per crescita di regione, la lesione si ritrova negli altri esami con la coregistrazione e la ricerca
// del blocco di «Segui nel tempo», e si misura anche lì. Tutto nel browser, niente esce dal computer.
function torace() {
  const t = [V.caso?.distretto, V.caso?.titolo, ...V.serie.map((x) => `${x.regione || ''} ${x.descrizione || ''}`)].join(' ');
  return /torac|polmon|chest|lung|thorax|nodul/i.test(t) && !/\\bPET\\b|total body/i.test(t);
}
function datiLesione(l) {
  const ok = l.punti.filter((p) => p.vol != null && p.diam != null).sort((a, b) => a.n - b.n);
  const att = ok.find((p) => p.studio === l.studio) || ok[ok.length - 1];
  const prec = [...ok].reverse().find((p) => p.n < att?.n) || ok.find((p) => p !== att);
  if (!att || !prec) return { att, prec, ok };
  const tt = tempiTraccia([prec, att]), giorni = tt.noti ? (tt.t[1] - tt.t[0]) * tt.giorniPer : null;
  const [p, a] = att.n > prec.n ? [prec, att] : [att, prec];
  const dv = p.vol > 0 ? Math.round((a.vol / p.vol - 1) * 100) : null, dd = a.diam - p.diam;
  const vdt = giorni && a.vol > p.vol * 1.05 ? Math.round(vdtGiorni(p.vol, a.vol, Math.abs(giorni))) : null;
  return { att: a, prec: p, ok, giorni: giorni && Math.abs(giorni), dv, dd, vdt, crescita: dd > 1.5, riduzione: a.vol < p.vol * 0.75 };
}
function lungRadsCrescita(d) { return !d.crescita ? null : d.att.diam < 8 ? '4A' : '4B'; }
function sommaRecist(lista) {
  const ber = lista.filter((d) => d.prec && d.prec.diam >= 10).sort((x, y) => y.prec.diam - x.prec.diam).slice(0, 5);
  if (!ber.length) return null;
  const s0 = ber.reduce((a, d) => a + d.prec.diam, 0), s1 = ber.reduce((a, d) => a + d.att.diam, 0), v = (s1 - s0) / s0 * 100;
  return { n: ber.length, s0, s1, v: Math.round(v), r: (v >= 20 && s1 - s0 >= 5) ? 'PD' : s1 < 1 ? 'CR' : v <= -30 ? 'PR' : 'SD' };
}
async function aggiungiLesioneAssistita(v) {
  CFIA.attesa = false;
  await seguiNelTempo(v);
  const tr = V.traccia; if (!tr) return;
  CFIA.lesioni.push({ studio: v.studio, punti: tr.punti.map(({ v: _v, ...x }) => ({ ...x })), sIdx: v.sIdx, idx: v.idx });
  scegliStrumento('scroll'); pannelloAssistito();
}
function testoAssistito() {
  const L = CFIA.lesioni.map(datiLesione).filter((d) => d.att && d.prec), r = [], tor = torace();
  if (!L.length) return '';
  const mesi = L[0].giorni ? Math.round(L[0].giorni / 30.44) : null;
  r.push(`Confronto con l'esame precedente${mesi ? ` (intervallo ${mesi} mesi)` : ''}, misure volumetriche semiautomatiche:`);
  L.forEach((d, i) => r.push(`- lesione ${i + 1}: ${mmV(d.prec.diam)} → ${mmV(d.att.diam)} (volume ${pct(d.dv)}${d.vdt ? `, tempo di raddoppio ${d.vdt} giorni` : ''}): ${d.crescita ? `in crescita${tor ? ` (Lung-RADS ${lungRadsCrescita(d)})` : ''}` : d.riduzione ? 'ridotta' : 'stabile'}`));
  const rc = sommaRecist(L); if (rc) r.push(`RECIST 1.1: somma dei diametri ${mmV(rc.s0)} → ${mmV(rc.s1)} (${pct(rc.v)}): ${rc.r}.`);
  return r.join('\\n');
}
function pannelloAssistito() {
  const box = $('#cfia-pannello'); if (!box) return;
  box.hidden = false;
  const tor = torace(), L = CFIA.lesioni.map((l) => ({ l, d: datiLesione(l) }));
  const and = (d) => (d.crescita ? '<b class="cfia-su">▲ crescita</b>' : d.riduzione ? '▼ ridotta' : '= stabile');
  const righe = L.map(({ d }, i) => !d.att || !d.prec
    ? `<tr class="muted"><td>${i + 1}</td><td colspan="${tor ? 5 : 4}">non ritrovata nell'altro esame: apri «Segui nel tempo» dalla lista dei volumi e misurala a mano</td><td><button type="button" class="ghost piccolo" data-cfia-via="${i}">✕</button></td></tr>`
    : `<tr><td>${i + 1}</td><td>${mmV(d.prec.diam)} → <b>${mmV(d.att.diam)}</b>${d.ok.some((p) => p.stato === 'da verificare') ? ' <span class="muted small" title="ritrovata con poca sicurezza: controlla">(da verificare)</span>' : ''}</td><td>${pct(d.dv)}</td><td>${d.vdt ? `${d.vdt} gg${d.vdt < 400 ? ' <b title="Sotto 400 giorni: crescita sospetta">!</b>' : ''}` : '—'}</td><td>${and(d)}</td>${tor ? `<td>${lungRadsCrescita(d) ? `<span class="cfia-lr lr-${lungRadsCrescita(d).toLowerCase()}">${lungRadsCrescita(d)}</span>` : '<span class="muted small">da valutare</span>'}</td>` : ''}<td><button type="button" class="ghost piccolo" data-cfia-vai="${i}">vai</button> <button type="button" class="ghost piccolo" data-cfia-via="${i}" title="Togli dal confronto">✕</button></td></tr>`).join('');
  const rc = sommaRecist(L.map(({ d }) => d).filter((d) => d.att && d.prec));
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>🤖 Confronto con l'esame precedente</b><span class="spacer"></span><button type="button" class="ghost piccolo" id="cfia-chiudi" aria-label="Chiudi">✕</button></div>
    <p class="small">Clicca <b>＋ Aggiungi lesione</b>, poi clicca la lesione (nodulo, massa, linfonodo) nell'<b>esame attuale</b>: il programma ne misura il volume, la ritrova negli altri esami (allineamento automatico) e la misura anche lì. Ripeti per ogni lesione.</p>
    <p><button type="button" class="primary piccolo" id="cfia-aggiungi"${CFIA.attesa ? ' disabled' : ''}>${CFIA.attesa ? 'Clicca la lesione nell\\'immagine…' : '＋ Aggiungi lesione'}</button></p>
    ${L.length ? `<table class="tab eco-tab cfia-tab"><thead><tr><th>#</th><th>Diametro</th><th>Volume</th><th>VDT</th><th>Andamento</th>${tor ? '<th>Lung-RADS</th>' : ''}<th></th></tr></thead><tbody>${righe}</tbody></table>` : ''}
    ${rc ? `<p class="small"><b>RECIST 1.1</b> (${rc.n} ${rc.n === 1 ? 'bersaglio' : 'bersagli'} ≥ 10 mm al precedente, al massimo 5): somma ${mmV(rc.s0)} → ${mmV(rc.s1)} (${pct(rc.v)}) → <b>${rc.r}</b> <span class="muted">— al massimo 2 bersagli per organo: scegli tu quali; una lesione nuova fa PD.</span></p>` : ''}
    <p class="small muted">Diametro = massimo della lesione segmentata; crescita Lung-RADS v2022: aumento di più di 1,5 mm${tor ? '' : ' (Lung-RADS solo nelle TC del torace)'}; VDT = intervallo × ln2 / ln(V2/V1), sotto 400 giorni crescita sospetta. Stime da verificare sulle immagini.</p>
    ${L.length ? '<p><button type="button" class="ghost piccolo" id="cfia-referto">Copia nel referto</button></p>' : ''}`;
  $('#cfia-aggiungi').onclick = () => { CFIA.attesa = true; scegliStrumento('volume'); avvisoBreve('Clicca la lesione nell\\'esame attuale'); pannelloAssistito(); };
  box.querySelectorAll('[data-cfia-via]').forEach((b) => b.onclick = () => { CFIA.lesioni.splice(+b.dataset.cfiaVia, 1); pannelloAssistito(); });
  box.querySelectorAll('[data-cfia-vai]').forEach((b) => b.onclick = async () => {
    const d = L[+b.dataset.cfiaVai].d; if (!d.att || !d.prec) return;
    if (V.n < 2) await impostaRiquadri(2);
    const sincro = V.sincro; V.sincro = false;
    try { await selezionaSerie(d.prec.sIdx, 0, { idx: d.prec.idx }); await selezionaSerie(d.att.sIdx, 1, { idx: d.att.idx }); } finally { V.sincro = sincro; }
    attiva(1); evidenziaSerie(); disegna();
  });
  $('#cfia-referto')?.addEventListener('click', () => { const t = $('#q-referto'), frase = testoAssistito(); if (!frase) return;
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else inserisciNelReferto(frase);
    avvisoBreve('Confronto copiato nel referto'); });
  legaPannelloCfia(box);
}""")
# il volume appena misurato, se il confronto assistito lo aspetta, entra nel confronto
sost("""    const v = { sIdx: p.sIdx, k, ...r, studio: st.id, data: st.data, idx, x: Math.round(pt.x), y: Math.round(pt.y), _cv: new Map() };
    V.volumi.push(v);""", """    const v = { sIdx: p.sIdx, k, ...r, studio: st.id, data: st.data, idx, x: Math.round(pt.x), y: Math.round(pt.y), _cv: new Map() };
    V.volumi.push(v);
    if (CFIA.attesa && !r.pet) setTimeout(() => aggiungiLesioneAssistita(v).catch((e) => { CFIA.attesa = false; avvisoBreve('Confronto non riuscito: ' + e.message); pannelloAssistito(); }), 0);""")
sost("const CFIA = { dati: null, caso: null };", "const CFIA = { dati: null, caso: null, lesioni: [], attesa: false };")
open(A, 'w', encoding='utf-8').write(s)

h = open(H, encoding='utf-8').read()
a = 'title="Confronto IA con l\'esame precedente: noduli abbinati, variazione di volume, tempo di raddoppio, Lung-RADS al controllo e RECIST (stime da verificare)"'
assert h.count(a) == 1
h = h.replace(a, 'title="Confronto con l\'esame precedente: per ogni lesione volume e diametro prima e dopo, tempo di raddoppio, crescita Lung-RADS e RECIST (stime da verificare)"')
open(H, 'w', encoding='utf-8').write(h)
print('ok')
