# patch_client_1127.py: prova senza registrazione, primo accesso guidato, «Inizia da qui», revisione dei casi
# e caso della settimana per email (scelta nel profilo e all'iscrizione). web/app.js, web/index.html, web/style.css.
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'


def patch(nome, coppie):
    f = W + nome; s = open(f).read()
    for a, b, *n in coppie:
        k = n[0] if n else 1
        assert s.count(a) == k, (nome, a[:90], s.count(a))
        s = s.replace(a, b)
    open(f, 'w').write(s)


NUOVO = r"""// ---------------------------------------------------------------- prova senza registrazione e primo accesso guidato (27/11/2026)
// /api/prova: i casi aperti a tutti (scelti dall'amministratore con «prova») e il caso del giorno. Chi non è entrato li apre
// da ospite: barra in alto con l'invito a iscriversi, correzione completa, nessun dato salvato. Dopo l'iscrizione
// (#/benvenuto) si apre subito un caso facile e breve, poi si propone il percorso del primo anno; in home, finché non ha
// risolto 3 casi, il riquadro «Inizia da qui». Il revisore dei casi trova in alto nel caso «Confermo» e «Da correggere».
const PERCORSO_PRIMO = 'rx-primo-anno';
let PROVA_P = null;
const elencoProva = () => (PROVA_P ||= fetch('/api/prova', { credentials: 'same-origin', cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : { giorno: '', casi: [] })).catch(() => { PROVA_P = null; return { giorno: '', casi: [] }; }));
const provaFatti = () => { try { const l = JSON.parse(localStorage.getItem('rq-prova-fatti') || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } };
function barraGuida(tipo = '') {
  const b = $('#guida-barra'); if (!b) return;
  b.hidden = !tipo; b.className = 'guida-barra' + (tipo ? ' ' + tipo : '');
  if (!tipo) { b.innerHTML = ''; return; }
  if (tipo === 'ospite') b.innerHTML = `<span class="gb-testo"><b>Stai provando senza account.</b> <span>Iscriviti gratis per salvare i progressi e aprire tutti i casi.</span></span><span class="gb-az"><a class="btn primario" href="#/iscriviti">Iscriviti gratis</a><a class="btn" href="#/" data-guida="entra">Entra</a></span>`;
  else if (tipo === 'benvenuto') b.innerHTML = `<span class="gb-testo"><b>Benvenuto! Il tuo primo caso.</b> <span>Scorri le immagini (rotellina, o trascina con il dito), poi rispondi alle domande e conferma: la correzione arriva subito.</span></span><button type="button" class="ghost gb-chiudi" data-guida="chiudi" aria-label="Chiudi">✕</button>`;
  else if (tipo === 'revisione') b.innerHTML = `<span class="gb-testo"><b>Revisione del caso</b></span><input id="gb-nota" maxlength="1000" placeholder="Nota (obbligatoria per «Da correggere»)" aria-label="Nota della revisione"><span class="gb-az"><button type="button" class="primary" data-guida="confermato">✅ Confermo</button><button type="button" data-guida="da-correggere">✏️ Da correggere</button><a class="btn" href="#/revisione">Casi da rivedere</a></span><span id="gb-msg" class="small"></span>`;
  b.querySelector('[data-guida="chiudi"]')?.addEventListener('click', () => { b.hidden = true; });
  b.querySelectorAll('[data-guida="confermato"], [data-guida="da-correggere"]').forEach((x) => x.addEventListener('click', async () => {
    const esito = x.dataset.guida, nota = $('#gb-nota').value.trim();
    if (esito === 'da-correggere' && nota.length < 3) { $('#gb-msg').textContent = 'Scrivi che cosa va corretto.'; $('#gb-nota').focus(); return; }
    try { await postJSON(`/api/casi/${encodeURIComponent(V.caso.id)}/revisione`, { esito, nota }); }
    catch (e) { if (!(e instanceof NonAutorizzato)) $('#gb-msg').textContent = e.message; return; }
    scriviSessione('quiz-revisione', null); avvisoBreve(esito === 'confermato' ? 'Caso confermato: grazie!' : 'Richiesta di correzione registrata.'); location.hash = '#/revisione';
  }));
}
function lasciaOspite() { if (!OSPITE) return; OSPITE = false; barraGuida(''); }
async function apriOspite(id) {
  OSPITE = true;
  $('#btn-profilo').hidden = $('#btn-esci').hidden = $('#btn-editor').hidden = $('#menu-gestione').hidden = true;
  $('#chi').hidden = true; $('#gioco-chip').hidden = true; if ($('#menu-utente')) $('#menu-utente').hidden = true;
  $('#vista-accesso').hidden = true;
  try { const x = JSON.parse(localStorage.getItem('rq-caso-dopo')); if (x?.c === id) localStorage.removeItem('rq-caso-dopo'); } catch {}
  segnaVisita('caso', id);
  await apriCaso(id);
  if (!OSPITE || V.caso?.id !== id) return;
  barraGuida('ospite'); autoNeuro();
  if (!(V.caso?.disposizione || []).length && !(V.caso?.riquadri >= 1)) await disposizioneClient().catch(() => {});
}
// primo caso facile: tra i casi di prova, uno non ancora fatto (anche da ospite), di preferenza una radiografia
async function primoCasoFacile() {
  const p = await elencoProva(), fatti = new Set([...provaFatti(), ...Object.keys(GIOCO?.casi || {})]);
  const l = p.casi.filter((c) => !fatti.has(c.id)), c = l.find((x) => x.modalita === 'RX') || l.find((x) => x.difficolta === 'Base') || l[0];
  if (!c) { location.hash = '#/'; return; }
  scriviSessione('quiz-benvenuto', c.id); location.hash = '#/caso/' + c.id;
}
async function avviaPercorso(id) {
  if (!ELENCO.length) await caricaElencoDati().catch(() => {});
  if (!PERCORSI.length) await caricaPercorsi().catch(() => {});
  const p = PERCORSI.find((x) => x.id === id); if (!p) { location.hash = '#/allenamento'; return; }
  const st = statoPercorso(p); if (!st.casi.length) { location.hash = '#/allenamento'; return; }
  iniziaGiro({ tipo: 'percorso', id: p.id, titolo: p.titolo, casi: st.casi }, st.prossimo);
}
async function chiediSettimana(btn) {
  btn.disabled = true;
  try { await postJSON('/api/io/profilo', { settimana: true }); if (UTENTE) UTENTE.settimana = true; btn.textContent = '✓ Riceverai il caso della settimana'; }
  catch (e) { btn.disabled = false; if (!(e instanceof NonAutorizzato)) alertInline(e.message); }
}
// dopo la correzione: all'ospite l'invito a iscriversi; al nuovo iscritto il passo successivo
function dopoRispostaGuidata() {
  const box = $('#q-esito'); if (!box || !V.caso) return;
  const dopo = qs1('#q-esito .esito-azioni') || qs1('#q-esito .esito-testa');
  const card = document.createElement('div'); card.className = 'guida-dopo';
  if (OSPITE) {
    try { const f = provaFatti(); if (!f.includes(V.caso.id)) localStorage.setItem('rq-prova-fatti', JSON.stringify([...f, V.caso.id].slice(-20))); } catch {}
    card.innerHTML = `<h3>Ti è piaciuto?</h3><p>Con un account gratuito trovi più di 170 casi in tutte le metodiche, percorsi con attestato, i tuoi progressi e gli errori da ripassare.</p><p class="riga"><a class="btn primario" href="#/iscriviti">Iscriviti gratis</a> <button type="button" class="ghost" data-altro>Prova un altro caso</button></p>`;
    card.querySelector('[data-altro]').onclick = async () => {
      const p = await elencoProva(), f = provaFatti(), c = p.casi.find((x) => !f.includes(x.id) && x.id !== V.caso.id) || p.casi.find((x) => x.id !== V.caso.id);
      if (c) location.hash = '#/caso/' + c.id;
    };
  } else if (UTENTE && leggiSessione('quiz-benvenuto', null) === V.caso.id) {
    scriviSessione('quiz-benvenuto', null); barraGuida('');
    card.innerHTML = `<h3>Primo caso fatto!</h3><p>Il passo successivo che ti consigliamo: il percorso «Primo anno: RX del torace e dello scheletro», casi scelti dal più semplice.</p><p class="riga"><button type="button" class="primary" data-percorso>🧭 Inizia il percorso</button> <a class="btn" href="#/">Tutti i casi</a> <a class="btn" href="#/profilo">Completa il profilo</a></p>${UTENTE.settimana ? '' : '<p class="riga"><button type="button" class="ghost" data-settimana>🗓 Mandami per email il caso della settimana</button> <span class="muted small">Una email a settimana; la togli quando vuoi.</span></p>'}`;
    card.querySelector('[data-percorso]').onclick = () => avviaPercorso(PERCORSO_PRIMO);
    card.querySelector('[data-settimana]')?.addEventListener('click', (e) => chiediSettimana(e.currentTarget));
  } else return;
  if (dopo) dopo.after(card); else box.prepend(card);
}
// home: «Inizia da qui» finché il nuovo iscritto non ha risolto 3 casi
function iniziaQui() {
  const box = $('#inizia-qui'); if (!box) return;
  const n = GIOCO ? Object.keys(GIOCO.casi || {}).length : null;
  if (!UTENTE || ADMIN || DOCENTE || CLIENT || AZIENDA() || n === null || n >= 3) { box.hidden = true; return; }
  box.innerHTML = `<h2>Inizia da qui</h2><ol class="iq-passi"><li class="${n ? 'fatto' : ''}"><button type="button" class="primary" data-iq="caso">▶ Un caso facile</button><span class="muted small">5 minuti: immagini, domande, correzione</span></li><li><button type="button" data-iq="percorso">🧭 Percorso del primo anno</button><span class="muted small">RX del torace e dello scheletro, dal caso più semplice</span></li><li><a class="btn" href="#/profilo">👤 Completa il profilo</a><span class="muted small">scuola, anno di corso e docenti</span></li></ol>`;
  box.hidden = false;
  box.querySelector('[data-iq="caso"]').onclick = () => primoCasoFacile();
  box.querySelector('[data-iq="percorso"]').onclick = () => avviaPercorso(PERCORSO_PRIMO);
}
// revisione dei casi (pagina «Revisione delle bozze», in testa per il revisore)
async function casiDaRivedere() {
  const box = $('#rv-casi'); if (!box) return;
  if (!UTENTE?.revisore || !CLOUD) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = '<p class="muted">Carico…</p>';
  let d; try { d = await getJSON('/api/revisione/casi'); } catch (e) { box.innerHTML = e instanceof NonAutorizzato ? '' : `<p class="ko">${esc(e.message)}</p>`; return; }
  const motivi = { 'non ancora rivisto dal medico': 'non ancora rivisto dal medico', 'dubbi aperti nella nota': 'dubbi aperti nella nota', 'correzioni chieste dal revisore': 'correzioni chieste dal revisore' };
  const riga = (c) => `<li><a href="#/caso/${esc(c.id)}" data-rv="${esc(c.id)}"><b>${esc(c.titolo_interno || c.titolo)}</b></a><br><span class="muted small">${esc(c.id.replace(/^caso-tcia-/, 'n. '))} · ${esc(c.modalita)} · ${esc(motivi[c.motivo] || c.motivo)}</span>${c.revisione?.nota ? `<div class="small">${esc(c.revisione.nota)}</div>` : ''}</li>`;
  box.innerHTML = `<h2>Casi da rivedere <small class="muted">${d.daRivedere.length}</small></h2><p class="muted">Casi già visibili agli studenti, preparati con l'aiuto dell'IA o con dubbi aperti nella nota. Apri il caso: in alto trovi «Confermo» e «Da correggere». La revisione resta nel caso, con il tuo nome e la data.</p>`
    + (d.daRivedere.length ? `<ol class="rvc-lista">${d.daRivedere.map(riga).join('')}</ol>` : '<p>Nessun caso da rivedere.</p>')
    + (d.rivisti.length ? `<details class="rvc-rivisti"><summary>Già rivisti (${d.rivisti.length})</summary><ul class="rvc-lista">${d.rivisti.map((c) => `<li>${esc(c.titolo_interno || c.titolo)}<br><span class="muted small">${c.revisione.esito === 'confermato' ? '✅ confermato' : '✏️ da correggere'} · ${esc(c.revisione.da || '')} · ${esc(String(c.revisione.data || '').slice(0, 10))}</span></li>`).join('')}</ul></details>` : '');
  box.querySelectorAll('[data-rv]').forEach((a) => a.addEventListener('click', () => scriviSessione('quiz-revisione', a.dataset.rv)));
}
istanzaPronta.then(() => elencoProva()).then((p) => { const b = $('#hv-prova'); if (b && p.casi.length && !AZIENDA() && !CLIENT) b.hidden = false; }).catch(() => {});
"""

patch('app.js', [
    ("class NonAutorizzato extends Error {}", "class NonAutorizzato extends Error {}\nlet OSPITE = false;   // 27/11: caso di prova aperto senza accesso"),
    ("  if (r.status === 401) { mostraAccesso(); throw new NonAutorizzato('accesso richiesto'); }",
     "  if (r.status === 401) { if (!OSPITE) mostraAccesso(); throw new NonAutorizzato('accesso richiesto'); }"),
    ("async function chiSono() {", "async function chiSono(muto = false) {"),
    ("    if (r.status === 401) { mostraAccesso(); return false; }", "    if (r.status === 401) { if (!muto) mostraAccesso(); return false; }"),
    ("entrato(r.dati, '#/profilo/benvenuto')", "entrato(r.dati, '#/benvenuto')", 2),
    ("  if (CLIENT) return routerClient(tipo);",
     "  if (CLIENT) return routerClient(tipo);\n  if (OSPITE && tipo !== 'caso' && tipo !== 'prova') lasciaOspite();\n  if (tipo !== 'caso') barraGuida('');"),
    ("""    if (!UTENTE) { pronto = null; vista('sfida'); $('#vista-accesso').hidden = true; segnaVisita('sfida'); await (await caricaSfide()).apriPubblica(decodeURIComponent(id)); return; }
    if (!ok) return;
  }
  if (!pronto) pronto = chiSono();""",
     """    if (!UTENTE) { pronto = null; vista('sfida'); $('#vista-accesso').hidden = true; segnaVisita('sfida'); await (await caricaSfide()).apriPubblica(decodeURIComponent(id)); return; }
    if (!ok) return;
  }
  // 27/11: prova senza registrazione: «#/prova» apre il caso del giorno, un caso di prova si apre da ospite;
  // gli altri casi chiedono l'accesso e si riaprono dopo
  if ((tipo === 'prova' || (tipo === 'caso' && id)) && !UTENTE && !FINESTRA_N) {
    const ok = await (pronto ||= chiSono(true));
    if (!UTENTE && CLOUD) {
      pronto = null;
      const p = await elencoProva(), idc = tipo === 'prova' ? (decodeURIComponent(id || '') || p.giorno) : decodeURIComponent(id);
      if (idc && p.casi.some((c) => c.id === idc)) { try { await apriOspite(idc); } catch (e) { if (!(e instanceof NonAutorizzato)) alertInline('Errore: ' + e.message); } return; }
      lasciaOspite();
      if (tipo === 'caso' && /^caso-[a-z0-9-]{1,40}$/i.test(idc)) try { localStorage.setItem('rq-caso-dopo', JSON.stringify({ c: idc, t: Date.now() })); } catch {}
      mostraAccesso(); return;
    }
    if (!ok) return;
  }
  if (tipo === 'prova') { location.hash = '#/'; return; }
  if (!pronto) pronto = chiSono();"""),
    ("""      await apriCaso(decodeURIComponent(id));   // 11/11: all'apertura un solo riquadro (niente confronto automatico)
      autoNeuro();""",
     """      await apriCaso(decodeURIComponent(id));   // 11/11: all'apertura un solo riquadro (niente confronto automatico)
      barraGuida(UTENTE?.revisore && leggiSessione('quiz-revisione', null) === V.caso?.id ? 'revisione' : leggiSessione('quiz-benvenuto', null) === V.caso?.id ? 'benvenuto' : '');
      autoNeuro();"""),
    ("""    else await apriElenco();
  } catch (e) {""",
     """    else if (tipo === 'benvenuto' && CLOUD && UTENTE) await primoCasoFacile();
    else await apriElenco();
  } catch (e) {"""),
    ("      aggiungiCondivisioneCaso(r);", "      if (!OSPITE) aggiungiCondivisioneCaso(r);\n      dopoRispostaGuidata();"),
    ("  disegnaElenco(); numeriHome(); mostraSponsor($('#sponsor-home'), 'home');",
     "  disegnaElenco(); numeriHome(); iniziaQui(); mostraSponsor($('#sponsor-home'), 'home');"),
    ("""    try { GIOCO = await getJSON('/api/io/progressi'); } catch (e) { if (e instanceof NonAutorizzato) throw e; GIOCO = null; }
    disegnaGioco();""",
     """    try { GIOCO = await getJSON('/api/io/progressi'); } catch (e) { if (e instanceof NonAutorizzato) throw e; GIOCO = null; }
    disegnaGioco(); iniziaQui();"""),
    ("function apriRevisione(...a) { return caricaDocenti().then((m) => m.apriRevisione(...a)); }",
     "function apriRevisione(...a) { casiDaRivedere(); return caricaDocenti().then((m) => m.apriRevisione(...a)); }"),
    ("  $('#pr-avvisi').checked = io.avvisi; annoVisibile('#pr-categoria', '#pr-anno-campo');",
     "  $('#pr-avvisi').checked = io.avvisi; if ($('#pr-settimana')) $('#pr-settimana').checked = !!io.settimana; annoVisibile('#pr-categoria', '#pr-anno-campo');"),
    ("avvisi: $('#pr-avvisi').checked, ...(UTENTE?.conPassword",
     "avvisi: $('#pr-avvisi').checked, settimana: $('#pr-settimana')?.checked === true, ...(UTENTE?.conPassword"),
    ("    docente: $('#isc-docente').checked, privacy: $('#isc-privacy').checked, maggiorenne: $('#isc-maggiorenne').checked, sito: $('#isc-sito').value });",
     "    docente: $('#isc-docente').checked, settimana: $('#isc-settimana')?.checked === true, privacy: $('#isc-privacy').checked, maggiorenne: $('#isc-maggiorenne').checked, sito: $('#isc-sito').value });"),
    ("// correzione del referto libero con il modello open source nel browser (refertolocale.js), se attivata",
     NUOVO + "// correzione del referto libero con il modello open source nel browser (refertolocale.js), se attivata"),
    ("function mostraAccesso(msg = '', pannello = 'entra') {", "function mostraAccesso(msg = '', pannello = 'entra') {\n  OSPITE = false; barraGuida('');"),
])

patch('index.html', [
    ('<main id="vista-elenco" class="elenco">', '<div id="guida-barra" class="guida-barra" role="status" hidden></div>\n<main id="vista-elenco" class="elenco">'),
    ('<div class="hv-cta"><a class="btn primario hv-grande" href="#/iscriviti">Iscriviti gratis</a>',
     '<div class="hv-cta"><a class="btn hv-grande hv-prova" id="hv-prova" href="#/prova" hidden>▶ Prova un caso, senza iscriverti</a><a class="btn primario hv-grande" href="#/iscriviti">Iscriviti gratis</a>'),
    ('<div id="home-numeri" class="home-numeri"></div>', '<div id="home-numeri" class="home-numeri"></div>\n      <section id="inizia-qui" class="inizia-qui" hidden></section>'),
    ('  <div id="rv-lista"></div>\n</main>', '  <section id="rv-casi" class="rv-casi" hidden></section>\n  <div id="rv-lista"></div>\n</main>'),
    ('    <label class="check"><input type="checkbox" id="pr-avvisi"> Ricevi per email gli avvisi dei compiti assegnati e i promemoria delle scadenze</label>',
     '    <label class="check"><input type="checkbox" id="pr-avvisi"> Ricevi per email gli avvisi dei compiti assegnati e i promemoria delle scadenze</label>\n    <label class="check"><input type="checkbox" id="pr-settimana"> Ricevi per email il caso della settimana (una email a settimana)</label>'),
    ('      <label class="check"><input type="checkbox" id="isc-docente">',
     '      <label class="check"><input type="checkbox" id="isc-settimana"> <span>Mandami per email il caso della settimana (facoltativo, lo togli quando vuoi)</span></label>\n      <label class="check"><input type="checkbox" id="isc-docente">'),
])

css = r"""
/* 27/11: prova senza registrazione, primo accesso guidato, revisione dei casi */
.guida-barra { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .8rem; padding: .55rem 1rem; background: var(--accento-tenue, #e8f1ff); border-bottom: 1px solid var(--bordo, #cfd8e3); font-size: .95rem; }
.guida-barra[hidden] { display: none; }
.guida-barra .gb-testo { flex: 1 1 18rem; }
.guida-barra .gb-az { display: flex; gap: .4rem; flex-wrap: wrap; }
.guida-barra.revisione { background: #eaf7ef; }
.guida-barra.revisione input { flex: 1 1 14rem; min-width: 0; }
.guida-barra .gb-chiudi { margin-left: auto; }
.guida-dopo { margin: .8rem 0; padding: .8rem 1rem; border: 1px solid var(--bordo, #cfd8e3); border-left: 4px solid var(--accento, #2a6fdb); border-radius: 10px; background: var(--pannello, #fff); }
.guida-dopo h3 { margin: 0 0 .3rem; }
.hv-cta .hv-prova { background: #1f8a4c; color: #fff; border-color: #1f8a4c; }
.hv-cta .hv-prova[hidden] { display: none; }
.inizia-qui { margin: .8rem 0; padding: .8rem 1rem; border-radius: 12px; border: 1px solid var(--bordo, #cfd8e3); background: var(--pannello, #fff); }
.inizia-qui h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
.iq-passi { margin: 0; padding-left: 1.2rem; display: grid; gap: .45rem; }
.iq-passi li { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .7rem; }
.iq-passi li.fatto > button { opacity: .75; }
.rv-casi { margin: 0 0 1.2rem; }
.rvc-lista { display: grid; gap: .45rem; padding-left: 1.4rem; }
@media (max-width: 700px) { .guida-barra { font-size: .9rem; padding: .45rem .7rem; } .guida-barra .gb-testo > span { display: block; } .hv-cta .hv-prova { order: -1; width: 100%; } }
"""
f = W + 'style.css'; open(f, 'a').write(css)
print('ok')
