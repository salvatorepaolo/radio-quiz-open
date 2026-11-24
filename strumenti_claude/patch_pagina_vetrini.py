# patch_pagina_vetrini.py: pagina «Vetrini» con scheda (organo, colorazione, ingrandimento, formato), filtri per organo e
# stato, e i casi radiologici che mostrano un vetrino dopo la risposta. Campo nuovo del caso: scheda_vetrino.
import sys, json
R = sys.argv[1]   # .../piattaforma-quiz/cloud
def patch(p, coppie):
    s = open(p, encoding='utf-8').read()
    for a, b in coppie:
        assert s.count(a) == 1, (p, a[:80]); s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

patch(R + '/api/logica.mjs', [
 ("export function pulisciZonaVetrino(z) {",
  "// 1.323 scheda del vetrino per la pagina «Vetrini» (organo, colorazione, ingrandimento, formato del file, campione)\n"
  "export function pulisciSchedaVetrino(s) {\n"
  "  if (!s || typeof s !== 'object') return null;\n"
  "  const o = {}; for (const k of ['organo', 'colorazione', 'ingrandimento', 'formato', 'campione']) { const v = String(s[k] || '').replace(/\\s+/g, ' ').trim().slice(0, 60); if (v) o[k] = v; }\n"
  "  return Object.keys(o).length ? o : null;\n"
  "}\n"
  "export function pulisciZonaVetrino(z) {"),
 ("  ...(pulisciZonaVetrino(d.zona_vetrino) ? { zona_vetrino: pulisciZonaVetrino(d.zona_vetrino) } : {}),\n",
  "  ...(pulisciZonaVetrino(d.zona_vetrino) ? { zona_vetrino: pulisciZonaVetrino(d.zona_vetrino) } : {}),\n"
  "  ...(pulisciSchedaVetrino(d.scheda_vetrino) ? { scheda_vetrino: pulisciSchedaVetrino(d.scheda_vetrino) } : {}),\n"),
 ("        ...(c.area ? { area: c.area } : {}),\n        ...(autore ? { visibile: visibile(c),",
  "        ...(c.area ? { area: c.area } : {}),\n        ...(c.scheda_vetrino ? { schedaVetrino: c.scheda_vetrino } : {}),   // 1.323 pagina «Vetrini»\n        ...(autore ? { visibile: visibile(c),"),
])

VECCHIA = """async function apriVetriniPagina() {
  if (!ELENCO.length) ELENCO = await getJSON('/api/casi');
  const l = ELENCO.filter(eVetrini), box = $('#lista-vetrini');
  const svolti = GIOCO ? l.filter((c) => GIOCO.casi?.[c.id] != null).length : 0;
  $('#vetrini-numeri').textContent = l.length ? `${l.length} ${l.length === 1 ? 'caso' : 'casi'}${GIOCO ? ` · ${svolti} svolti` : ''}` : '';
  box.innerHTML = l.length ? l.map(cardCaso).join('') : '<p class="muted">Nessun caso con i vetrini disponibile.</p>';
  box.querySelectorAll('.card').forEach((c) => c.onclick = (e) => { if (e.target.closest('a.no-apri')) return; scriviSessione('quiz-casuale', null); scriviSessione('quiz-giro', null); location.hash = `#/caso/${c.dataset.id}`; });
}"""
NUOVA = """// 1.323 pagina «Vetrini»: scheda del vetrino sotto ogni caso (organo, colorazione, ingrandimento, formato; 🎯 se c'è la
// domanda sul vetrino), filtri per organo e per stato, e in fondo i casi radiologici con il vetrino dopo la risposta.
// Ogni parte della scheda è un elemento a sé, così la traduzione inglese la trova uguale.
let filtroVtOrgano = leggiSessione('quiz-vt-organo', ''), filtroVtStato = leggiSessione('quiz-vt-stato', '');
const organoVetrino = (c) => c.schedaVetrino?.organo || c.distretto || 'Altro';
function schedaVetrinoHtml(c) {
  const s = c.schedaVetrino || {}, parti = [organoVetrino(c), s.colorazione, s.campione, s.ingrandimento, s.formato].filter(Boolean);
  return `<div class="vt-scheda">🧫 ${parti.map((p) => `<span>${esc(p)}</span>`).join(' · ')}${c.localizza ? ' · <span class="vt-dom" title="Prima di rispondere indichi il reperto sul vetrino">🎯 Indica sul vetrino</span>' : ''}</div>`;
}
async function apriVetriniPagina() {
  if (!ELENCO.length) ELENCO = await getJSON('/api/casi');
  const tutti = ELENCO.filter(eVetrini), conRx = ELENCO.filter((c) => !eVetrini(c) && c.schedaVetrino), box = $('#lista-vetrini');
  const svolto = (c) => GIOCO?.casi?.[c.id] != null;
  const svolti = GIOCO ? tutti.filter(svolto).length : 0;
  $('#vetrini-numeri').textContent = tutti.length ? `${tutti.length} ${tutti.length === 1 ? 'caso' : 'casi'}${GIOCO ? ` · ${svolti} svolti` : ''}` : '';
  const organi = [...new Set([...tutti, ...conRx].map(organoVetrino))].sort((a, b) => a.localeCompare(b, 'it'));
  if (filtroVtOrgano && !organi.includes(filtroVtOrgano)) filtroVtOrgano = '';
  const passa = (c) => (!filtroVtOrgano || organoVetrino(c) === filtroVtOrgano) && (!filtroVtStato || (filtroVtStato === 'svolti') === svolto(c));
  const l = tutti.filter(passa), lr = conRx.filter(passa);
  const bott = (val, cur, testo, dato) => `<button type="button" class="ghost piccolo${val === cur ? ' on' : ''}" data-${dato}="${esc(val)}" aria-pressed="${val === cur}">${testo}</button>`;
  const filtri = tutti.length + conRx.length > 3 ? `<div class="vt-filtri" role="group" aria-label="Filtri dei vetrini">
      <span class="muted small">Organo</span>${bott('', filtroVtOrgano, 'Tutti', 'org')}${organi.map((o) => bott(o, filtroVtOrgano, `<span>${esc(o)}</span>`, 'org')).join('')}
      ${GIOCO ? `<span class="muted small vt-sep">Stato</span>${bott('', filtroVtStato, 'Tutti', 'st')}${bott('da-fare', filtroVtStato, 'Da fare', 'st')}${bott('svolti', filtroVtStato, 'Svolti', 'st')}` : ''}</div>` : '';
  const carte = (lista) => lista.map((c) => cardCaso(c).replace(/<\\/div>\\s*$/, `${schedaVetrinoHtml(c)}</div>`)).join('');
  box.innerHTML = filtri + (tutti.length ? (l.length ? `<div class="lista">${carte(l)}</div>` : '<p class="muted">Nessun vetrino con questi filtri.</p>') : '<p class="muted">Nessun caso con i vetrini disponibile.</p>')
    + (lr.length ? `<h2 class="vt-titolo">Radiologia con il vetrino dopo la risposta</h2><p class="muted small">Casi di TC, RM o ecografia: rispondi sulle immagini radiologiche, poi vedi il vetrino dello stesso paziente.</p><div class="lista">${carte(lr)}</div>` : '');
  box.querySelectorAll('[data-org]').forEach((b) => b.onclick = () => { filtroVtOrgano = b.dataset.org; scriviSessione('quiz-vt-organo', filtroVtOrgano); apriVetriniPagina(); });
  box.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => { filtroVtStato = b.dataset.st; scriviSessione('quiz-vt-stato', filtroVtStato); apriVetriniPagina(); });
  box.querySelectorAll('.card').forEach((c) => c.onclick = (e) => { if (e.target.closest('a.no-apri')) return; scriviSessione('quiz-casuale', null); scriviSessione('quiz-giro', null); location.hash = `#/caso/${c.dataset.id}`; });
}"""
patch(R + '/web/app.js', [(VECCHIA, NUOVA)])
# la lista ora contiene filtri, titoli e liste annidate: il contenitore non è più una griglia di carte
patch(R + '/web/index.html', [('<div id="lista-vetrini" class="lista"></div>', '<div id="lista-vetrini"></div>')])
css = open(R + '/web/style.css', encoding='utf-8').read().rstrip() + "\n/* 1.323 pagina Vetrini: filtri e scheda del vetrino */\n" \
  "#lista-vetrini .vt-filtri{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0 14px}\n" \
  "#lista-vetrini .vt-filtri button.on{background:var(--acc);color:#fff;border-color:var(--acc)}\n" \
  "#lista-vetrini .vt-sep{margin-left:12px}\n" \
  "#lista-vetrini .vt-scheda{margin-top:8px;font-size:.88em;color:var(--muto,#667)}\n" \
  "#lista-vetrini .vt-dom{white-space:nowrap}\n" \
  "#lista-vetrini .vt-titolo{margin:26px 0 4px;font-size:1.15em}\n"
open(R + '/web/style.css', 'w', encoding='utf-8').write(css)

p = R + '/web/lingua/en.json'; s = open(p, encoding='utf-8').read().rstrip(); d = json.loads(s)
nuovi = {'Organo': 'Organ', 'Stato': 'Status', 'Tutti': 'All', 'Da fare': 'To do', 'Svolti': 'Done', 'Filtri dei vetrini': 'Slide filters',
 'Nessun vetrino con questi filtri.': 'No slides match these filters.', '🎯 Indica sul vetrino': '🎯 Mark on the slide',
 'Prima di rispondere indichi il reperto sul vetrino': 'Before answering you mark the finding on the slide',
 'Radiologia con il vetrino dopo la risposta': 'Radiology with the slide after the answer',
 'Casi di TC, RM o ecografia: rispondi sulle immagini radiologiche, poi vedi il vetrino dello stesso paziente.': 'CT, MRI or ultrasound cases: answer on the radiological images, then see the slide of the same patient.',
 'Ematossilina-eosina': 'Haematoxylin-eosin', 'Pezzo operatorio': 'Surgical specimen', 'Aperio SVS': 'Aperio SVS', 'DICOM': 'DICOM',
 'Tiroide': 'Thyroid', 'Encefalo': 'Brain', 'Colon': 'Colon', 'Fegato': 'Liver', 'Polmone': 'Lung', 'Rene': 'Kidney', 'Mammella': 'Breast'}
agg = {k: v for k, v in nuovi.items() if k not in d}
if agg:
    s = s[:-1] + ''.join(',' + json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False) for k, v in agg.items()) + '}'
    json.loads(s); open(p, 'w', encoding='utf-8').write(s)
print('ok', len(agg), 'testi inglesi aggiunti')
