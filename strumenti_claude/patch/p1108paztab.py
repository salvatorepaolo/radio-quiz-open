import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, H, C = W + 'app.js', W + 'index.html', W + 'style.css'
for f in (A, H, C): shutil.copy(f, f + '.bak_1108paztab')
def sost(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

h = open(H, encoding='utf-8').read()
h = sost(h, '<label class="check cl-paz" title="Mostra nome, data di nascita, data dell\'esame e struttura sull\'immagine (solo su questo schermo: mai nelle esportazioni)"><input type="checkbox" id="cl-paziente"> dati paziente sull\'immagine</label>',
 '<label class="check cl-paz" title="Nome, data di nascita e codice del paziente sulla linguetta dell\'esame, sopra le serie (solo su questo schermo: mai nelle esportazioni)"><input type="checkbox" id="cl-paz-tab"> dati paziente sulla linguetta</label>\n          <label class="check cl-paz" title="Mostra nome, data di nascita, data dell\'esame e struttura sull\'immagine (solo su questo schermo: mai nelle esportazioni)"><input type="checkbox" id="cl-paziente"> dati paziente sull\'immagine</label>')
open(H, 'w', encoding='utf-8').write(h)

s = open(A, encoding='utf-8').read()
# dati del paziente per esame, presi dalle immagini già lette (client: restano su questo computer)
s = sost(s, "  if (CLIENT && V.datiPaziente && !V.esportando && img) for (const r of righePaziente(img)) tl.push('👤 ' + r);",
 """  if (CLIENT && V.datiPaziente && !V.esportando && img) for (const r of righePaziente(img)) tl.push('👤 ' + r);
  if (CLIENT && (img?.paziente?.nome || img?.paziente?.pid || img?.paziente?.nascita)) { const k = studioDi(s)?.id ?? ''; if (!PAZ_STUDIO.has(k)) { PAZ_STUDIO.set(k, img.paziente); aggiornaTabPaziente(); } }""")
s = sost(s, "  $('#cl-paziente').onchange = (e) => { V.datiPaziente = e.target.checked; disegna(); };",
 """  $('#cl-paziente').onchange = (e) => { V.datiPaziente = e.target.checked; disegna(); };
  // dati del paziente sulla linguetta dell'esame: accesi di base nel client, la scelta si ricorda
  $('#cl-paz-tab').checked = pazTabAttivi();
  $('#cl-paz-tab').onchange = (e) => { try { localStorage.setItem('rq-cl-paz-tab', e.target.checked ? '1' : '0'); } catch {} aggiornaTabPaziente(); };""")
s = sost(s, "function righePaziente(img) {", """const PAZ_STUDIO = new Map();   // id dello studio → dati del paziente letti dall'immagine (solo nel client, in memoria)
const pazTabAttivi = () => { try { return localStorage.getItem('rq-cl-paz-tab') !== '0'; } catch { return true; } };
function rigaPazienteBreve(d) {
  if (!d) return '';
  const eta = (() => { const n = /^\\d{8}$/.test(d.nascita || '') ? d.nascita : null, e = /^\\d{8}$/.test(d.esame || '') ? d.esame : null; if (!n || !e) return '';
    let a = +e.slice(0, 4) - +n.slice(0, 4); if (e.slice(4) < n.slice(4)) a--; return a >= 0 && a < 130 ? `${a} anni` : ''; })();
  return [d.nome, d.nascita ? `nato/a il ${dataLeggibile(d.nascita)}${eta ? ` (${eta})` : ''}` : '', d.sesso, d.pid ? `ID ${d.pid}` : ''].filter(Boolean).join(' · ');
}
// sulla linguetta di ogni esame (sopra l'elenco delle serie): nome, data di nascita con l'età all'esame, sesso, codice
function aggiornaTabPaziente() {
  if (!CLIENT) return;
  const on = pazTabAttivi(), primo = [...PAZ_STUDIO.values()][0];
  qsAll('#tab-studi button[data-n]').forEach((b) => {
    let el = b.querySelector('.tab-paz');
    const d = PAZ_STUDIO.get(b.dataset.n) || primo, t = on ? rigaPazienteBreve(d) : '';
    if (!t) { el?.remove(); return; }
    if (!el) { el = document.createElement('small'); el.className = 'tab-paz'; b.insertBefore(el, b.querySelector('.tab-chiudi')); }
    el.textContent = '👤 ' + t; b.title = t;
  });
}
function righePaziente(img) {""")
# dopo il disegno delle linguette e alla chiusura/apertura di un altro esame
s = sost(s, "  $('#lista-serie').innerHTML = V.serie.map((s, i) => { const st = studioDi(s), multi = V.studi.length > 0;",
 "  if (CLIENT) { PAZ_STUDIO.clear(); aggiornaTabPaziente(); }\n  $('#lista-serie').innerHTML = V.serie.map((s, i) => { const st = studioDi(s), multi = V.studi.length > 0;")
open(A, 'w', encoding='utf-8').write(s)

c = open(C, encoding='utf-8').read()
c += """
/* client: dati del paziente sulla linguetta dell'esame */
.tab-studi button .tab-paz{display:block;font-size:.82em;font-weight:500;font-style:normal;color:var(--txt);margin-top:1px;white-space:nowrap}
"""
open(C, 'w', encoding='utf-8').write(c)
print('ok')
