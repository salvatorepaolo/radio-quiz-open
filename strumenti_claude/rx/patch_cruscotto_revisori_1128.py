#!/usr/bin/env python3
# 28/11: cruscotto dei revisori in testa alla pagina «Revisione delle bozze»:
# totali, avanzamento, filtri, priorità per uso degli studenti, dubbio dalla nota, casi corretti da riconfermare.
import json, os, shutil, sys
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/'

def bak(p):
    if not os.path.exists(p + '.bak_1128rvd'): shutil.copy(p, p + '.bak_1128rvd')

def sostituisci(t, old, new, nome):
    if new in t: return t
    if t.count(old) != 1: sys.exit(f'{nome}: trovato {t.count(old)} volte: {old[:70]!r}')
    return t.replace(old, new)

# ---------------------------------------------------------------- API
p = C + 'api/logica.mjs'; t = open(p, encoding='utf-8').read()
FUNZ = r'''// 28/11: cruscotto dei revisori: totali, avanzamento per revisore, casi da rivedere con le risposte degli studenti
// (priorità ai più usati) e la riga di dubbio della nota; «corretto» = l'autore ha salvato il caso dopo la richiesta di correzione
export function cruscottoRevisione(casi, stat = {}) {
  const l = casi.filter(visibile).map((c) => {
    const s = stat[c.id], motivo = motivoRevisione(c), rv = c.revisione;
    const dubbio = motivo && motivo !== 'correzioni chieste dal revisore'
      ? (String(c.nota_docente || '').split('\n').map((r) => r.trim()).find((r) => /verificar|da controllare|dubbi/i.test(r) && !/^\[revisione/.test(r)) || '').slice(0, 240) : '';
    return { id: c.id, titolo: c.titolo || c.id, titolo_interno: c.titolo_interno || '', modalita: c.modalita || '', distretto: c.distretto || '',
      motivo, risposte: s?.n || 0, ...(s?.n ? { media: s.media } : {}), ...(dubbio ? { dubbio } : {}), ...(rv ? { revisione: rv } : {}),
      ...(rv?.esito === 'da-correggere' && c.aggiornato && String(c.aggiornato) > String(rv.data || '') ? { corretto: String(c.aggiornato) } : {}) };
  });
  const daRivedere = l.filter((c) => c.motivo && c.revisione?.esito !== 'confermato').sort((a, b) => (a.id < b.id ? -1 : 1));
  const rivisti = l.filter((c) => c.revisione).sort((a, b) => String(b.revisione.data).localeCompare(String(a.revisione.data)));
  const perRevisore = {};
  for (const c of rivisti) {
    const r = perRevisore[c.revisione.da || 'Revisore'] ||= { confermati: 0, daCorreggere: 0 };
    if (c.revisione.esito === 'confermato') r.confermati++; else r.daCorreggere++;
  }
  const confermati = rivisti.filter((c) => c.revisione.esito === 'confermato').length;
  return { totali: { visibili: l.length, daRivedere: daRivedere.length, confermati, daCorreggere: rivisti.length - confermati,
    corretti: daRivedere.filter((c) => c.corretto).length }, perRevisore, daRivedere, rivisti: rivisti.slice(0, 200) };
}
'''
t = sostituisci(t, 'export function controlliCaso(c) {', FUNZ + 'export function controlliCaso(c) {', 'logica funzione')
i = t.find("    if (!revisore) return json(403, { errore: 'solo il revisore dei casi' });\n    const l = (await M.elencoCasi()).filter(visibile)")
if i >= 0:
    fine_txt = "slice(0, 200) });\n"
    j = t.find(fine_txt, i)
    if j < 0: sys.exit('logica: fine del blocco non trovata')
    t = t[:i] + "    if (!revisore) return json(403, { errore: 'solo il revisore dei casi' });\n" \
        "    return json(200, cruscottoRevisione(await M.elencoCasi(), M.risultati ? await statistiche(M) : {}));\n" + t[j + len(fine_txt):]
elif 'cruscottoRevisione(await M.elencoCasi()' not in t:
    sys.exit('logica: endpoint non trovato')
bak(p); open(p, 'w', encoding='utf-8').write(t); print('ok', p)

# ---------------------------------------------------------------- pagina
p = C + 'web/app.js'; t = open(p, encoding='utf-8').read()
INIZIO = "// revisione dei casi (pagina «Revisione delle bozze», in testa per il revisore)\nasync function casiDaRivedere() {"
FINE = "  box.querySelectorAll('[data-rv]').forEach((a) => a.addEventListener('click', () => scriviSessione('quiz-revisione', a.dataset.rv)));\n}\n"
NUOVO = r'''// revisione dei casi: cruscotto dei revisori (28/11) in testa alla pagina «Revisione delle bozze»
const RVD = { cerca: '', mod: '', mot: '', ord: 'uso', d: null };
async function casiDaRivedere() {
  const box = $('#rv-casi'); if (!box) return;
  if (!UTENTE?.revisore || !CLOUD) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = '<p class="muted">Carico…</p>';
  let d; try { d = await getJSON('/api/revisione/casi'); } catch (e) { box.innerHTML = e instanceof NonAutorizzato ? '' : `<p class="ko">${esc(e.message)}</p>`; return; }
  RVD.d = d;
  const t = d.totali || { daRivedere: d.daRivedere.length, confermati: 0, daCorreggere: 0, corretti: 0 };
  const tot = t.confermati + t.daRivedere, perc = tot ? Math.round((100 * t.confermati) / tot) : 100;
  const mie = d.perRevisore?.[UTENTE?.nome || ''];
  const kpi = (cls, tit, val, sub) => `<div class="cmr-kpi ${cls}"><span class="k-tit">${tit}</span><span class="k-val">${val}</span>${sub ? `<span class="k-sub">${sub}</span>` : ''}</div>`;
  const opz = (l, v) => l.map((x) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const mod = [...new Set(d.daRivedere.map((c) => c.modalita).filter(Boolean))].sort();
  const mot = [...new Set(d.daRivedere.map((c) => c.motivo).filter(Boolean))].sort();
  box.innerHTML = `<h2>Cruscotto della revisione</h2>
    <p class="muted">Casi già visibili agli studenti, preparati con l'aiuto dell'IA o con dubbi aperti nella nota. Apri il caso: in alto trovi «Confermo» e «Da correggere». La revisione resta nel caso, con il tuo nome e la data.</p>
    <div class="cmr-kpis">${kpi(t.daRivedere ? 'dubbio' : 'ok', 'Da rivedere', t.daRivedere, t.corretti ? `<span>${t.corretti}</span> <span>corretti, da riconfermare</span>` : '')}${kpi('ok', 'Confermati', t.confermati, mie ? `<span>${mie.confermati}</span> <span>da te</span>` : '')}${kpi(t.daCorreggere ? 'ko' : '', 'Correzioni chieste', t.daCorreggere, '')}${kpi('', 'Avanzamento', perc + '%', `<span>${t.confermati}</span> <span>su</span> <span>${tot}</span>`)}</div>
    <progress class="rvd-barra" max="${tot || 1}" value="${t.confermati}" aria-label="Avanzamento della revisione"></progress>
    ${d.daRivedere.length ? `<div class="rvd-filtri">
      <input type="search" id="rvd-cerca" placeholder="Cerca titolo o numero" value="${esc(RVD.cerca)}">
      <select id="rvd-mod"><option value="">Tutte le metodiche</option>${opz(mod, RVD.mod)}</select>
      <select id="rvd-mot"><option value="">Tutti i motivi</option>${opz(mot, RVD.mot)}</select>
      <select id="rvd-ord">${[['uso', 'Prima i più usati dagli studenti'], ['media', 'Prima la media più bassa'], ['num', 'Per numero'], ['mod', 'Per metodica']].map(([v, s]) => `<option value="${v}"${v === RVD.ord ? ' selected' : ''}>${s}</option>`).join('')}</select>
    </div>
    <p class="small muted">Prima i casi più usati: un errore lì pesa su più studenti. Una media molto bassa può indicare un caso ambiguo o una risposta sbagliata.</p>
    <div id="rvd-lista"></div>` : '<p>Nessun caso da rivedere.</p>'}
    ${d.rivisti.length ? `<details class="rvc-rivisti"><summary>Già rivisti (${d.rivisti.length})</summary>
      ${Object.keys(d.perRevisore || {}).length ? `<p class="small">${Object.entries(d.perRevisore).map(([n, r]) => `<b>${esc(n)}</b>: <span>${r.confermati}</span> <span>confermati</span>, <span>${r.daCorreggere}</span> <span>da correggere</span>`).join(' · ')}</p>` : ''}
      <ul class="rvc-lista">${d.rivisti.map((c) => `<li><a href="#/caso/${esc(c.id)}" data-rv="${esc(c.id)}">${esc(c.titolo_interno || c.titolo)}</a><br><span class="muted small">${c.revisione.esito === 'confermato' ? '✅ confermato' : c.corretto ? '🔁 corretto, da riconfermare' : '✏️ da correggere'} · ${esc(c.revisione.da || '')} · ${esc(String(c.revisione.data || '').slice(0, 10))}</span></li>`).join('')}</ul></details>` : ''}`;
  const lega = (id, k, ev) => { const el = $('#' + id); if (el) el.addEventListener(ev, () => { RVD[k] = el.value; rvdLista(); }); };
  lega('rvd-cerca', 'cerca', 'input'); lega('rvd-mod', 'mod', 'change'); lega('rvd-mot', 'mot', 'change'); lega('rvd-ord', 'ord', 'change');
  box.querySelectorAll('[data-rv]').forEach((a) => a.addEventListener('click', () => scriviSessione('quiz-revisione', a.dataset.rv)));
  rvdLista();
}
function rvdLista() {
  const el = $('#rvd-lista'); if (!el || !RVD.d) return;
  const q = RVD.cerca.trim().toLowerCase();
  const num = (c) => c.id.replace(/^caso-tcia-/, 'n. ');
  let l = RVD.d.daRivedere.filter((c) => (!RVD.mod || c.modalita === RVD.mod) && (!RVD.mot || c.motivo === RVD.mot)
    && (!q || `${c.titolo_interno} ${c.titolo} ${num(c)} ${c.id} ${c.distretto}`.toLowerCase().includes(q)));
  const per = { uso: (a, b) => b.risposte - a.risposte, media: (a, b) => (a.media ?? 101) - (b.media ?? 101), num: () => 0, mod: (a, b) => a.modalita.localeCompare(b.modalita) };
  l = [...l].sort((a, b) => (per[RVD.ord] || per.uso)(a, b) || (a.id < b.id ? -1 : 1));
  if (!l.length) { el.innerHTML = '<p class="muted">Nessun caso con questi filtri.</p>'; return; }
  el.innerHTML = `<div class="rvd-tab-box"><table class="rvd-tab"><thead><tr><th>Caso</th><th>Metodica</th><th>Motivo</th><th class="num">Risposte</th><th class="num">Media</th></tr></thead><tbody>${l.map((c) => `<tr${c.corretto ? ' class="rvd-corretto"' : ''}>
    <td><a href="#/caso/${esc(c.id)}" data-rv="${esc(c.id)}"><b>${esc(c.titolo_interno || c.titolo)}</b></a><br><span class="muted small">${esc(num(c))}${c.distretto ? ' · ' + esc(c.distretto) : ''}</span>
      ${c.dubbio ? `<div class="small rvd-dubbio">❓ ${esc(c.dubbio)}</div>` : ''}${c.revisione?.nota ? `<div class="small">✏️ ${esc(c.revisione.nota)}</div>` : ''}${c.corretto ? `<div class="small ok">🔁 <span>Corretto dall'autore il</span> ${esc(c.corretto.slice(0, 10))}<span>: da riconfermare</span></div>` : ''}</td>
    <td>${esc(c.modalita)}</td><td><span class="rvd-motivo">${esc(c.motivo)}</span></td><td class="num">${c.risposte}</td><td class="num${c.media != null && c.media < 40 ? ' ko' : ''}">${c.media != null ? c.media + '%' : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted"><span>${l.length}</span> <span>casi mostrati</span></p>`;
  el.querySelectorAll('[data-rv]').forEach((a) => a.addEventListener('click', () => scriviSessione('quiz-revisione', a.dataset.rv)));
}
'''
if 'function rvdLista()' not in t:
    i = t.find(INIZIO); j = t.find(FINE, i)
    if i < 0 or j < 0: sys.exit('app.js: casiDaRivedere non trovato')
    t = t[:i] + NUOVO + t[j + len(FINE):]
    bak(p); open(p, 'w', encoding='utf-8').write(t); print('ok', p)

# ---------------------------------------------------------------- stile
p = C + 'web/style.css'; t = open(p, encoding='utf-8').read()
CSS = '''
/* 28/11: cruscotto dei revisori */
.rv-casi .rvd-barra { width: 100%; height: 10px; margin: 0 0 .8rem; accent-color: var(--ok, #1f8a4c); }
.rvd-filtri { display: flex; flex-wrap: wrap; gap: .5rem; margin: .4rem 0; }
.rvd-filtri input[type=search] { flex: 1 1 14rem; min-width: 0; }
.rvd-tab-box { overflow-x: auto; }
.rvd-tab { width: 100%; border-collapse: collapse; font-size: .92rem; }
.rvd-tab th, .rvd-tab td { padding: .45rem .5rem; border-bottom: 1px solid var(--bord, #cfd8e3); text-align: left; vertical-align: top; }
.rvd-tab th { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--mut); }
.rvd-tab .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rvd-tab tr.rvd-corretto td { background: color-mix(in srgb, var(--ok, #1f8a4c) 8%, transparent); }
.rvd-motivo { display: inline-block; padding: .1rem .45rem; border-radius: 999px; background: var(--pan2, #eef2f7); font-size: .8rem; white-space: nowrap; }
.rvd-dubbio { margin-top: .2rem; color: var(--warn, #9a6700); }
@media (max-width: 700px) { .rvd-tab th:nth-child(2), .rvd-tab td:nth-child(2) { display: none; } }
'''
if '.rvd-tab' not in t:
    bak(p); open(p, 'a', encoding='utf-8').write(CSS); print('ok', p)

# ---------------------------------------------------------------- inglese
p = C + 'web/lingua/en.json'; d = json.load(open(p, encoding='utf-8'))
EN = {
 'Cruscotto della revisione': 'Review dashboard', 'Correzioni chieste': 'Corrections requested', 'Confermati': 'Confirmed',
 'Avanzamento': 'Progress', 'corretti, da riconfermare': 'corrected, to be reconfirmed', 'da te': 'by you', 'su': 'of',
 'Cerca titolo o numero': 'Search title or number', 'Tutte le metodiche': 'All modalities', 'Tutti i motivi': 'All reasons',
 'Prima i più usati dagli studenti': 'Most used by students first', 'Prima la media più bassa': 'Lowest average first',
 'Per numero': 'By number', 'Per metodica': 'By modality',
 'Prima i casi più usati: un errore lì pesa su più studenti. Una media molto bassa può indicare un caso ambiguo o una risposta sbagliata.':
   'Most used cases first: a mistake there affects more students. A very low average may point to an ambiguous case or a wrong answer.',
 'Nessun caso con questi filtri.': 'No cases with these filters.', 'casi mostrati': 'cases shown', 'Risposte': 'Answers', 'Media': 'Average',
 'Motivo': 'Reason', 'Metodica': 'Modality', 'Caso': 'Case', 'confermati': 'confirmed', 'da correggere': 'to correct',
 "Corretto dall'autore il": 'Corrected by the author on', ': da riconfermare': ': to be reconfirmed', 'Avanzamento della revisione': 'Review progress',
 '🔁 corretto, da riconfermare': '🔁 corrected, to be reconfirmed',
}
nuove = {k: v for k, v in EN.items() if k not in d}
if nuove:
    s = open(p, encoding='utf-8').read().rstrip()
    assert s.endswith('}')
    s = s[:-1] + ''.join(', ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) for k, v in nuove.items()) + '}\n'
    json.loads(s); bak(p); open(p, 'w', encoding='utf-8').write(s); print('ok en', len(nuove))
