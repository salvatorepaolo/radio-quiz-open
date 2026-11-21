import shutil, json
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
N = ['app.js', 'style.css', 'lingua/en.json']
for n in N: shutil.copy(W + n, W + n + '.bak_1109menu')
T = {n: open(W + n, encoding='utf-8').read() for n in N}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:100], T[k].count(a)); T[k] = T[k].replace(a, b)
A, C = 'app.js', 'style.css'

# ---- menù della barra del visualizzatore: titolo e una riga di spiegazione sotto ogni voce
sost(A, """const MENU_BARRA = [...qsAll('.menu-barra')];
for (const d of MENU_BARRA) {
  const sum = d.querySelector('summary'), pop = d.querySelector('.menu-pop');
  sum.dataset.icona = sum.innerHTML;
  for (const b of pop.querySelectorAll('button')) {
    b.setAttribute('role', 'menuitem');
    if (!b.querySelector('.et')) b.insertAdjacentHTML('beforeend', `<span class="et">${esc(b.getAttribute('aria-label') || b.title.split(/[:(]/)[0])}</span>`);""",
"""const MENU_BARRA = [...qsAll('.menu-barra')];
const DESC_MENU = { profilo: 'valori lungo una linea', calcio: 'Agatston e CAC-DRS', volume: 'clic dentro la lesione', cobb: 'due linee, scoliosi', ict: 'cuore / torace',
  t2s: 'ferro nel miocardio e nel fegato', 'btn-adc': 'dalle DWI con valori b diversi', anatomia: 'nome della struttura cliccata', 'btn-densita': 'ACR A-D, tessuto denso',
  'btn-vertebre': 'L1, T12… accanto alla colonna', 'btn-quiz-anat': 'trova la struttura richiesta', 'btn-radiomica': 'istogramma e tessitura' };
const TIT_MENU = { 'menu-misure': 'Altre misure', 'menu-altro': 'Altri strumenti' };
for (const d of MENU_BARRA) {
  const sum = d.querySelector('summary'), pop = d.querySelector('.menu-pop');
  sum.dataset.icona = sum.innerHTML;
  if (TIT_MENU[d.id] && !pop.querySelector('.mg-tit')) pop.insertAdjacentHTML('afterbegin', `<div class="mg-tit">${TIT_MENU[d.id]}</div>`);
  for (const b of pop.querySelectorAll('button')) {
    b.setAttribute('role', 'menuitem');
    const desc = DESC_MENU[b.dataset.tool] || DESC_MENU[b.id];
    if (!b.querySelector('.et')) b.insertAdjacentHTML('beforeend', `<span class="et"><span class="et-n">${esc(b.getAttribute('aria-label') || b.title.split(/[:(]/)[0])}</span>${desc ? `<small>${desc}</small>` : ''}</span>`);""")

# ---- menù ⋯ del visualizzatore: titolo e spiegazioni
sost(A, "// menu Gestione: la voce della pagina aperta è evidenziata",
"""// menù ⋯ del visualizzatore: titolo e una riga di spiegazione sotto ogni voce
{ const pop = $('#cl-altro .cl-aggiungi-voci');
  const DESC = { 'cl-sincro': 'scorrimento, finestra e zoom insieme', 'hp-ricorda': 'per gli esami dello stesso tipo', 'hp-auto': 'riquadri secondo il tipo di esame',
    'cl-paz-tab': "nome ed età sopra le serie", 'cl-paziente': 'mai nelle esportazioni', 'cl-manuale': 'funziona anche senza rete' };
  if (pop && !pop.querySelector('.mg-tit')) {
    pop.insertAdjacentHTML('afterbegin', '<div class="mg-tit">Altre funzioni</div>');
    for (const [id, t] of Object.entries(DESC)) { const el = $('#' + id); if (!el) continue; const v = el.closest('label') || el; v.classList.add('voce-menu'); v.insertAdjacentHTML('beforeend', `<small class="voce-desc">${t}</small>`); }
  }
}
// menu Gestione: con la tastiera ↑ ↓ scorrono le voci, Esc chiude; scelta una voce il menu si chiude
$('#menu-gestione').addEventListener('keydown', (e) => {
  const m = $('#menu-gestione'); if (!m.open) return;
  const voci = [...m.querySelectorAll('.menu-voci a:not([hidden])')], i = voci.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = voci.length; voci[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus(); }
  if (e.key === 'Escape') { m.open = false; m.querySelector('summary').focus(); }
});
$('#menu-gestione .menu-voci').addEventListener('click', (e) => { if (e.target.closest('a')) $('#menu-gestione').open = false; });
// menu Gestione: la voce della pagina aperta è evidenziata""")

T[C] += """
/* ===== menù (9/11): stesso stile del menu Gestione — titolo, icona, nome e una riga di spiegazione ===== */
.menu-barra .menu-pop{min-width:250px;padding:6px;border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.25);animation:mg-apri .12s ease-out}
.menu-barra .menu-pop .mg-tit{padding:6px 10px 3px}
.menu-barra .menu-pop button{padding:7px 10px;border-radius:10px;border:0;background:transparent}
.menu-barra .menu-pop button:hover,.menu-barra .menu-pop button:focus-visible{background:color-mix(in srgb,var(--acc) 12%,transparent);outline:none}
.menu-barra .menu-pop button>svg,.menu-barra .menu-pop button>b{flex:none;width:30px;height:30px;padding:6px;box-sizing:border-box;border-radius:9px;background:var(--pan2);display:inline-grid;place-items:center}
.menu-barra .menu-pop button>b{line-height:18px!important;padding:6px 0}
.menu-barra .menu-pop button.on>svg,.menu-barra .menu-pop button.on>b{background:var(--acc);color:#fff}
.menu-barra .menu-pop .et{display:flex;flex-direction:column;gap:1px;line-height:1.2}
.menu-barra .menu-pop .et-n{font-weight:600}
.menu-barra .menu-pop .et small{color:var(--mut);font-size:.78rem;font-weight:400}
#cl-altro .cl-aggiungi-voci{min-width:260px;padding:6px;gap:2px;border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.25);animation:mg-apri .12s ease-out}
#cl-altro .cl-aggiungi-voci .mg-tit{padding:6px 10px 3px}
#cl-altro .voce-menu{display:grid!important;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;padding:7px 10px;border-radius:10px;text-decoration:none;color:var(--txt);border:0}
#cl-altro .voce-menu:hover{background:color-mix(in srgb,var(--acc) 12%,transparent)}
#cl-altro .voce-desc{grid-column:2;display:block;color:var(--mut);font-size:.78rem;line-height:1.2}
#cl-altro .cl-hp{display:flex;flex-direction:column;gap:2px}
#cl-altro .cl-hp>button.voce-menu,#cl-altro a.voce-menu{grid-template-columns:1fr;background:transparent;text-align:left;font-weight:500}
#cl-altro .cl-hp>button.voce-menu .voce-desc,#cl-altro a.voce-menu .voce-desc{grid-column:1}
/* menu Azioni della pagina Iscritti e docenti: righe della stessa altezza */
.acc-menu-pop button{min-height:34px}.acc-menu-pop .mi{font-size:1rem;line-height:1}
"""
E = json.loads(T['lingua/en.json'])
for k, v in {
  'valori lungo una linea': 'values along a line', 'Agatston e CAC-DRS': 'Agatston and CAC-DRS', 'clic dentro la lesione': 'click inside the lesion', 'due linee, scoliosi': 'two lines, scoliosis',
  'cuore / torace': 'heart / chest', 'ferro nel miocardio e nel fegato': 'iron in myocardium and liver', 'dalle DWI con valori b diversi': 'from DWI with different b values',
  'nome della struttura cliccata': 'name of the clicked structure', 'ACR A-D, tessuto denso': 'ACR A-D, dense tissue', 'L1, T12… accanto alla colonna': 'L1, T12… next to the spine',
  'trova la struttura richiesta': 'find the requested structure', 'istogramma e tessitura': 'histogram and texture', 'Altre misure': 'More measurements', 'Altri strumenti': 'More tools',
  'Altre funzioni': 'More functions', 'scorrimento, finestra e zoom insieme': 'scrolling, window and zoom together', 'per gli esami dello stesso tipo': 'for exams of the same type',
  'riquadri secondo il tipo di esame': 'viewports by exam type', 'nome ed età sopra le serie': 'name and age above the series', 'mai nelle esportazioni': 'never in exports',
  'funziona anche senza rete': 'also works offline'}.items(): E.setdefault(k, v)
T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':'))
for n in N: open(W + n, 'w', encoding='utf-8').write(T[n])
print('ok')
