import shutil
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
A, L, LA, S = R + 'web/app.js', R + 'api/logica.mjs', R + 'api/lambda.mjs', R + 'test/simulatore.mjs'
for f in (A, L, LA, S): shutil.copy(f, f + '.bak_1108elenco')
def sost(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---- API: ?indice=1 per la home (senza i controlli del caso, che costano: si calcolano solo in «Gestione dei casi»)
l = open(L, encoding='utf-8').read()
l = sost(l, """  if (parti.length === 2 && metodo === 'GET') {
    const casi = (await M.elencoCasi()).filter((c) => autore || visibile(c));""", """  if (parti.length === 2 && metodo === 'GET') {
    // ?indice=1: elenco leggero per la pagina iniziale (niente controlli, conteggi di opzioni e sezioni, proposte)
    const indice = req.query?.indice === '1';
    const casi = (await M.elencoCasi()).filter((c) => autore || visibile(c));""")
l = sost(l, """        ...(autore ? { visibile: visibile(c), difficoltaDocente: c.difficolta || '', ...(s ? { media: s.media, risposte: s.n } : {}),
          aggiornato: c.aggiornato || '', controlli: controlliCaso(c), nOpzioni: (c.opzioni || []).length, nSezioni: (c.sezioni || []).length,
          ...(c.proposta ? { proposta: { stato: c.proposta.stato, nome: c.proposta.nome, data: c.proposta.data } } : {}) } : {}) };""",
"""        ...(c.area ? { area: c.area } : {}),
        ...(autore ? { visibile: visibile(c), difficoltaDocente: c.difficolta || '', ...(s ? { media: s.media, risposte: s.n } : {}),
          ...(indice ? {} : { aggiornato: c.aggiornato || '', controlli: controlliCaso(c), nOpzioni: (c.opzioni || []).length, nSezioni: (c.sezioni || []).length,
            ...(c.proposta ? { proposta: { stato: c.proposta.stato, nome: c.proposta.nome, data: c.proposta.data } } : {}) }) } : {}) };""")
open(L, 'w', encoding='utf-8').write(l)

# ---- Lambda: parametri della richiesta e casi in memoria (si rilegge solo il caso.json cambiato, dall'ETag di S3)
la = open(LA, encoding='utf-8').read()
la = sost(la, """      percorso: event.rawPath || '/',
      headers: { cookie: cookieHeader },""", """      percorso: event.rawPath || '/',
      query: event.queryStringParameters || {},
      headers: { cookie: cookieHeader },""")
la = sost(la, """  async elencoCasi() {
    const ids = [];
    let token;
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_DATI, Prefix: 'casi/', ContinuationToken: token }));
      for (const o of r.Contents || []) {
        const m = o.Key.match(/^casi\\/([^/]+)\\/caso\\.json$/);
        if (m) ids.push(m[1]);
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    ids.sort();
    const casi = await Promise.all(ids.map(async (id) => ({ ...(await leggiJSON(`casi/${id}/caso.json`)), id })));
    return casi;
  },""", """  // con molti casi non si rileggono tutti i caso.json a ogni richiesta: la funzione, finché resta calda, li tiene in
  // memoria e rilegge da S3 solo quelli con l'ETag cambiato (l'elenco degli oggetti costa una richiesta ogni 1000)
  async elencoCasi() {
    const voci = [];
    let token;
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_DATI, Prefix: 'casi/', ContinuationToken: token }));
      for (const o of r.Contents || []) {
        const m = o.Key.match(/^casi\\/([^/]+)\\/caso\\.json$/);
        if (m) voci.push([m[1], o.ETag]);
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    voci.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const casi = await Promise.all(voci.map(async ([id, etag]) => {
      const m = CACHE_CASI.get(id);
      if (m && m.etag === etag) return m.caso;
      const caso = { ...(await leggiJSON(`casi/${id}/caso.json`)), id };
      CACHE_CASI.set(id, { etag, caso });
      return caso;
    }));
    for (const id of CACHE_CASI.keys()) if (!voci.some(([k]) => k === id)) CACHE_CASI.delete(id);
    // copie: chi modifica un caso dell'elenco non deve cambiare quello in memoria
    return casi.map((c) => structuredClone(c));
  },""")
la = sost(la, "  leggiCaso: (id) => leggiJSON(`casi/${id}/caso.json`),", "  leggiCaso: (id) => leggiJSON(`casi/${id}/caso.json`),", 1)
# la mappa va dichiarata a livello di modulo, prima dell'oggetto magazzino
la = sost(la, "const magazzino = {", "const CACHE_CASI = new Map();   // id → { etag, caso }\nconst magazzino = {", 1)
open(LA, 'w', encoding='utf-8').write(la)

si = open(S, encoding='utf-8').read()
si = sost(si, "const r = await gestisci({ metodo: q.method, percorso: u.pathname, headers: q.headers, corpo }, cfg);",
     "const r = await gestisci({ metodo: q.method, percorso: u.pathname, query: Object.fromEntries(u.searchParams), headers: q.headers, corpo }, cfg);")
open(S, 'w', encoding='utf-8').write(si)

# ---- pagina iniziale: elenco leggero e schede dei casi disegnate solo quando si apre la metodica
s = open(A, encoding='utf-8').read()
s = sost(s, "  [ELENCO] = await Promise.all([getJSON('/api/casi'), caricaProgressi(),", "  [ELENCO] = await Promise.all([getJSON('/api/casi?indice=1'), caricaProgressi(),")
s = sost(s, """      ${GIOCO ? `<span class="gm-prog" title="${pc}% svolti"><span style="width:${pc}%"></span></span>` : ''}<span class="gm-freccia" aria-hidden="true">›</span></summary>
      <div class="lista">${l.map(cardCaso).join('')}</div></details>`; }).join('')""",
"""      ${GIOCO ? `<span class="gm-prog" title="${pc}% svolti"><span style="width:${pc}%"></span></span>` : ''}<span class="gm-freccia" aria-hidden="true">›</span></summary>
      <div class="lista" data-gruppo="${esc(m)}"></div></details>`; }).join('')""")
s = sost(s, """  qsAll('.card').forEach((c) => c.onclick = (e) => { if (e.target.closest('a.no-apri')) return; scriviSessione('quiz-casuale', null); scriviSessione('quiz-giro', null); location.hash = `#/caso/${c.dataset.id}`; });
  disegnaPercorsi();
}""", """  // le schede dei casi si costruiscono solo per le metodiche aperte (con centinaia di casi la pagina resta leggera)
  GRUPPI_ELENCO = new Map(gruppi);
  qsAll('#lista-casi details.gruppo-metodica[open]').forEach(riempiGruppo);
  disegnaPercorsi();
}
let GRUPPI_ELENCO = new Map();
function riempiGruppo(det) {
  const box = det.querySelector('.lista[data-gruppo]'); if (!box || box.dataset.pieno) return;
  const l = GRUPPI_ELENCO.get(box.dataset.gruppo) || [];
  box.innerHTML = l.map(cardCaso).join(''); box.dataset.pieno = '1';
  box.querySelectorAll('.card').forEach((c) => c.onclick = (e) => { if (e.target.closest('a.no-apri')) return; scriviSessione('quiz-casuale', null); scriviSessione('quiz-giro', null); location.hash = `#/caso/${c.dataset.id}`; });
}
$('#lista-casi').addEventListener('toggle', (e) => { if (e.target.matches?.('details.gruppo-metodica') && e.target.open) riempiGruppo(e.target); }, true);""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
