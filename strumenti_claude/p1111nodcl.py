#!/usr/bin/env python3
# 11/11: noduli polmonari IA anche nel client, facoltativi e scaricati a richiesta (noduli-client.js)
import re, sys, shutil, os
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def leggi(p): return open(W + p, encoding='utf-8').read()
def scrivi(p, s):
    if not os.path.exists(W + p + '.bak_1111nodcl'): shutil.copy(W + p, W + p + '.bak_1111nodcl')
    open(W + p, 'w', encoding='utf-8').write(s)
def sost(s, a, b, n=1):
    c = s.count(a)
    if c != n: sys.exit(f'trovato {c} volte (attese {n}): {a[:90]!r}')
    return s.replace(a, b)

# ------------------------------------------------------------------ app.js
s = leggi('app.js')
s = sost(s, """// Agli studenti solo dopo la risposta, come gli altri reperti IA. Non nel visualizzatore scaricabile (nessun calcolo lì).
const NOD = { per: new Map(), cache: new Map(), nascosti: false };
function noduliSerie(si) {
  if (CLIENT || !V.caso || V.caso.ia === false) return null;""",
"""// Agli studenti solo dopo la risposta, come gli altri reperti IA.
// Nel visualizzatore scaricabile (11/11, facoltativo): ⚙ Impostazioni → «Noduli polmonari con IA» scarica una volta il
// modello MONAI in ONNX (noduli-client.js) e l'analisi gira su questo computer, nelle TC del torace a strato sottile.
const NOD = { per: new Map(), cache: new Map(), nascosti: false, stato: new Map() };
const iaNoduliOk = () => CLIENT || repertiIAConsentiti();
const NODC = { on: (() => { try { return localStorage.getItem('rq-cl-noduli') === '1'; } catch { return false; } })(), modulo: null, pronto: null };
const moduloNoduli = () => (NODC.modulo ||= import('./noduli-client.js'));
// chiave per serie del client (i casi locali hanno tutti l'id «locale»): primo file e numero di immagini
const kNodC = (si) => { const s = V.serie[si]; return s ? `cl:${s.files?.[0] || si}:${s.files?.length || 0}` : 'cl:-'; };
// TC assiale a strato sottile (≤ 2,5 mm, almeno 60 immagini) che non è un encefalo; «torace» se lo dicono le descrizioni
function tcPolmoniClient(si) {
  const s = V.serie[si], q = V.pannelli.find((x) => x.sIdx === si && x.frames?.length), img = q?.img || q?.frames?.[0];
  if (!s || !img || img.modalita !== 'CT' || img.rgb || !img.iop || (s.files?.length || 0) < 60) return null;
  if (pianoNativo(img) !== 'assiale' || (img.spessore || 0) > 2.5 || testaDaImmagine(img)) return null;
  const e = img.esame || {}, t = `${e.parte || ''} ${e.studio || ''} ${e.serie || ''} ${s.descrizione || ''}`;
  return { torace: /torac|thora|chest|lung|polmon|ldct|screening|nodul|total ?body|whole ?body|torso/i.test(t) && !/addom|abdom|pelvi|encef|brain|cranio|head/i.test(t) || /^(chest|thorax|lung)/i.test(e.parte || '') };
}
async function analizzaNoduliClient(si, auto = false) {
  const k = kNodC(si); if (NOD.per.has(k)) return NOD.per.get(k);
  const M = await moduloNoduli();
  if (!(await M.giaScaricato())) { if (!auto) { NOD.stato.set(k, { msg: 'Il modello non è ancora scaricato: ⚙ Impostazioni del visualizzatore → Noduli polmonari con IA.' }); pannelloNoduli(); } return null; }
  const pr = (async () => {
    NOD.stato.set(k, { f: 0, msg: 'Carico le immagini…' }); aggiornaBottoneNoduli();
    const vol = await volumeDi(si, (a, b) => { NOD.stato.set(k, { f: 0.05 * a / b, msg: `Carico le immagini (${a}/${b})…` }); if (!$('#nod-pannello').hidden) pannelloNoduli(); });
    const l = await M.trovaNoduli(vol, (f, msg) => { NOD.stato.set(k, { f: 0.05 + 0.95 * f, msg }); if (!$('#nod-pannello').hidden && P()?.sIdx === si) pannelloNoduli(); });
    NOD.cache.set(k, l); NOD.stato.delete(k); aggiornaBottoneNoduli(); disegna();
    if (!$('#nod-pannello').hidden || !auto) pannelloNoduli();
    return l;
  })().catch((e) => { NOD.per.delete(k); NOD.stato.set(k, { msg: 'Analisi non riuscita: ' + (e?.message || e) }); aggiornaBottoneNoduli(); if (!$('#nod-pannello').hidden) pannelloNoduli(); return null; });
  NOD.per.set(k, pr); return pr;
}
// all'apertura di una TC del torace a strato sottile, se il modello è già scaricato, l'analisi parte da sola
function noduliClientAuto() {
  if (!CLIENT || !NODC.on) return;
  if (!visibili().some(([q]) => q.img)) { if ((NODC.tent = (NODC.tent || 0) + 1) < 10) setTimeout(noduliClientAuto, 1500); return; }
  NODC.tent = 0;
  for (const [q] of visibili()) { const t = tcPolmoniClient(q.sIdx); if (t?.torace && !NOD.per.has(kNodC(q.sIdx))) analizzaNoduliClient(q.sIdx, true); }
}
function noduliSerie(si) {
  if (CLIENT) return NOD.cache.get(kNodC(si)) || null;
  if (!V.caso || V.caso.ia === false) return null;""")

s = sost(s, """  const l = noduliAttivi(), qualcuno = visibili().some(([q]) => noduliSerie(q.sIdx)?.length); b.hidden = !qualcuno; b.disabled = !l?.length;
  if (!l?.length) b.querySelector('.n').textContent = '–';
  if (l?.length) { b.querySelector('.n').textContent = repertiIAConsentiti() ? l.length : '?'; b.classList.toggle('on', !NOD.nascosti && repertiIAConsentiti()); }""",
"""  const l = noduliAttivi(), qualcuno = visibili().some(([q]) => noduliSerie(q.sIdx)?.length);
  if (CLIENT) {
    // client: il pulsante c'è nelle TC a strato sottile se l'opzione è accesa; senza risultati avvia l'analisi
    const tc = NODC.on && visibili().some(([q]) => tcPolmoniClient(q.sIdx)), k = kNodC(P()?.sIdx), st = NOD.stato.get(k);
    b.hidden = !tc && !qualcuno; b.disabled = !NODC.on || !tcPolmoniClient(P()?.sIdx);
    b.querySelector('.n').textContent = l ? l.length : st?.f != null ? Math.round(st.f * 100) + '%' : '';
    b.classList.toggle('on', !!l?.length && !NOD.nascosti);
    if (!$('#nod-pannello').hidden) pannelloNoduli();
    return;
  }
  b.hidden = !qualcuno; b.disabled = !l?.length;
  if (!l?.length) b.querySelector('.n').textContent = '–';
  if (l?.length) { b.querySelector('.n').textContent = repertiIAConsentiti() ? l.length : '?'; b.classList.toggle('on', !NOD.nascosti && repertiIAConsentiti()); }""")

s = sost(s, """  if (NOD.nascosti || !repertiIAConsentiti()) return;
  const p = P(k), img = p.img;""", """  if (NOD.nascosti || !iaNoduliOk()) return;
  const p = P(k), img = p.img;""")
s = sost(s, "    if (x.modelli !== 'entrambi') ctx.setLineDash([5, 4]);", "    if (x.modelli !== 'entrambi' && !CLIENT) ctx.setLineDash([5, 4]);")

s = sost(s, """  if (!repertiIAConsentiti()) box.innerHTML = testa + '<p class="small muted">La seconda lettura automatica dei noduli si vede dopo la risposta: prima cerca i noduli da solo.</p>';
  else {""", """  const stC = CLIENT && NOD.stato.get(kNodC(P()?.sIdx));
  if (CLIENT && !NODC.on) box.innerHTML = testa + '<p class="small">La ricerca dei noduli con IA è facoltativa: accendila in ⚙ Impostazioni del visualizzatore (pagina iniziale). Il modello si scarica una volta e gira su questo computer.</p>';
  else if (CLIENT && stC) box.innerHTML = testa + (stC.f != null ? `<p class="small"><progress max="1" value="${stC.f}"></progress> ${esc(stC.msg || '')}</p><p class="small muted">L'analisi gira su questo computer: le immagini non escono. Puoi continuare a guardare l'esame.</p>` : `<p class="small">${esc(stC.msg || '')}</p>`);
  else if (CLIENT && !l.length && !NOD.cache.has(kNodC(P()?.sIdx))) {
    box.innerHTML = testa + (tcPolmoniClient(P()?.sIdx) ? '<p class="small">Cerca i noduli polmonari in questa serie con il modello IA scaricato (da 1 a qualche minuto, dipende dal computer).</p><button type="button" class="primary piccolo" id="nod-avvia">🫁 Cerca i noduli</button>' : '<p class="small muted">Serve una TC assiale a strato sottile (fino a 2,5 mm) del torace.</p>');
  }
  else if (!iaNoduliOk()) box.innerHTML = testa + '<p class="small muted">La seconda lettura automatica dei noduli si vede dopo la risposta: prima cerca i noduli da solo.</p>';
  else {""")
s = sost(s, """      + '<p class="small muted">Seconda lettura con due modelli (TotalSegmentator e MONAI): ● entrambi, ○ uno solo. Diametro = media di asse lungo e corto; Lung-RADS v2022 come primo esame; lobo stimato dalla segmentazione. Può sbagliare (vasi, cicatrici): controlla sempre sulle immagini.</p>';
  }""", """      + (CLIENT ? '<p class="small muted">Seconda lettura con il modello open source MONAI (RetinaNet 3D, LUNA16), sul tuo computer. Diametro = media di asse lungo e corto misurati sulle immagini; Lung-RADS v2022 come primo esame; lato stimato. Può sbagliare (vasi, cicatrici) e non trova tutto: controlla sempre sulle immagini. Solo per la formazione.</p>'
        : '<p class="small muted">Seconda lettura con due modelli (TotalSegmentator e MONAI): ● entrambi, ○ uno solo. Diametro = media di asse lungo e corto; Lung-RADS v2022 come primo esame; lobo stimato dalla segmentazione. Può sbagliare (vasi, cicatrici): controlla sempre sulle immagini.</p>');
  }
  if ($('#nod-avvia')) $('#nod-avvia').onclick = () => { analizzaNoduliClient(P().sIdx); pannelloNoduli(); };""")
s = sost(s, """tr><td>${x.modelli === 'entrambi' ? '●' : '○'} ${i + 1}</td>""", """tr><td>${x.modelli === 'entrambi' || CLIENT ? '●' : '○'} ${i + 1}</td>""")
s = sost(s, """$('#btn-noduli')?.addEventListener('click', () => { const b = $('#nod-pannello'); if (!b.hidden) { b.hidden = true; return; } pannelloNoduli(); });""",
"""$('#btn-noduli')?.addEventListener('click', () => { const b = $('#nod-pannello'); if (!b.hidden) { b.hidden = true; return; } pannelloNoduli(); });
// impostazione del client: accende l'opzione, scarica o elimina il modello (una volta sola; poi funziona anche senza rete)
async function initNoduliClient() {
  const c = $('#cl-imp-noduli'), box = $('#cl-noduli-box'), st = $('#cl-noduli-stato'); if (!CLIENT || !c) return;
  c.checked = NODC.on; box.hidden = !c.checked;
  const stato = async () => { const M = await moduloNoduli(); const g = await M.giaScaricato();
    $('#cl-noduli-scarica').hidden = g; $('#cl-noduli-elimina').hidden = !g;
    st.textContent = g ? `Modello scaricato: l'analisi parte da sola aprendo una TC del torace a strato sottile (o con 🫁 sulla barra).${navigator.gpu ? '' : ' Senza WebGPU usa il processore: può volerci qualche minuto in più.'}` : `Da scaricare (${M.DIMENSIONE}, una volta sola).`; };
  c.onchange = async () => { NODC.on = c.checked; try { localStorage.setItem('rq-cl-noduli', c.checked ? '1' : '0'); } catch {} box.hidden = !c.checked; if (c.checked) await stato(); aggiornaBottoneNoduli(); };
  $('#cl-noduli-scarica').onclick = async (ev) => {
    ev.target.disabled = true;
    try { const M = await moduloNoduli(); await M.scarica((f, msg) => { st.innerHTML = `<progress max="1" value="${f}"></progress> ${esc(msg)}`; }); await stato(); noduliClientAuto(); }
    catch (e) { st.textContent = /quota/i.test(e?.message) ? 'Il browser non è riuscito a salvare il modello: libera spazio sul disco e riprova.' : 'Download non riuscito: ' + (e?.message || e) + '. Controlla la connessione e riprova.'; }
    ev.target.disabled = false;
  };
  $('#cl-noduli-elimina').onclick = async () => { const M = await moduloNoduli(); await M.elimina(); NOD.per.clear(); NOD.cache.clear(); NOD.stato.clear(); await stato(); aggiornaBottoneNoduli(); disegna(); };
  if (c.checked) stato().catch(() => {});
}
initNoduliClient();""")

# avvio automatico dopo l'apertura di un esame nel client: accanto ad autoNeuro
s = sost(s, "    if (!CL.finestra) { await disposizioneClient(); autoNeuro(); }", "    if (!CL.finestra) { await disposizioneClient(); autoNeuro(); setTimeout(noduliClientAuto, 1500); }")
scrivi('app.js', s)

# ------------------------------------------------------------------ index.html
h = leggi('index.html')
h = sost(h, """      <p id="cl-cartella-no" class="muted small" hidden>""", """      <label class="check"><input type="checkbox" id="cl-imp-noduli"> Noduli polmonari con IA nelle TC del torace (facoltativo): un modello open source (MONAI, Apache-2.0) si scarica una volta e gira su questo computer; le immagini non escono</label>
      <div id="cl-noduli-box" class="cl-cartella-box" hidden><button type="button" id="cl-noduli-scarica">⬇ Scarica il modello</button> <button type="button" id="cl-noduli-elimina" class="ghost" hidden>🗑 Elimina il modello</button> <span id="cl-noduli-stato" class="muted small"></span></div>
      <p id="cl-cartella-no" class="muted small" hidden>""")
scrivi('index.html', h)

# ------------------------------------------------------------------ service worker: i modelli dalla loro cache, mai nella cache del sito
w = leggi('client/sw.js')
w = sost(w, "const CACHE = 'rq-client-7';", "const CACHE = 'rq-client-8';")
w = sost(w, "'/t2star.js', '/refertolocale.js',", "'/t2star.js', '/refertolocale.js', '/noduli-client.js',")
w = sost(w, """  if (url.origin !== location.origin || /^\\/(api|casi)\\//.test(url.pathname)) return;""",
"""  if (url.origin !== location.origin || /^\\/(api|casi)\\//.test(url.pathname)) return;
  // modelli IA facoltativi (noduli-client.js): scaricati a richiesta in una cache a parte, letti da lì anche senza rete
  if (url.pathname.startsWith('/modelli-ia/')) { e.respondWith(caches.match(url.pathname).then((r) => r || fetch(req))); return; }""")
scrivi('client/sw.js', w)
print('ok')
