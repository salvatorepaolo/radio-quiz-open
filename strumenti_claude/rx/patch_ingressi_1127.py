# patch_ingressi_1127.py: provenienza delle visite e delle iscrizioni, link dei casi per i social (/c/<caso>), domanda
# del caso nell'elenco dei casi di prova. api/logica.mjs, api/lambda.mjs, lib/stack.mjs, test/simulatore.mjs.
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/'


def patch(nome, coppie):
    f = C + nome; s = open(f).read()
    for a, b in coppie:
        assert s.count(a) == 1, (nome, a[:90], s.count(a))
        s = s.replace(a, b)
    open(f, 'w').write(s)


patch('api/logica.mjs', [
    ("""export const ROBOT = """, """// 27/11: provenienza (etichetta «?da=» del link o categoria del sito di origine): mai l'indirizzo completo
export const ORIGINE_OK = /^[a-z0-9-]{1,30}$/;
const ORIGINI = [[/(^|\\.)instagram\\.com$/, 'instagram'], [/(^|\\.)facebook\\.com$|(^|\\.)fb\\.com$|^fb\\.me$/, 'facebook'], [/(^|\\.)linkedin\\.com$|^lnkd\\.in$/, 'linkedin'],
  [/(^|\\.)whatsapp\\.(com|net)$|^wa\\.me$/, 'whatsapp'], [/^t\\.me$|(^|\\.)telegram\\.org$/, 'telegram'], [/(^|\\.)google\\.[a-z.]+$/, 'google'], [/(^|\\.)bing\\.com$/, 'bing'],
  [/(^|\\.)duckduckgo\\.com$/, 'duckduckgo'], [/^t\\.co$|(^|\\.)x\\.com$|(^|\\.)twitter\\.com$/, 'x'], [/(^|\\.)reddit\\.com$/, 'reddit'], [/^news\\.ycombinator\\.com$/, 'hackernews'],
  [/(^|\\.)youtube\\.com$|^youtu\\.be$/, 'youtube'], [/(^|\\.)github\\.com$/, 'github'], [/(^|\\.)tiktok\\.com$/, 'tiktok']];
export const origineDaHost = (h) => { h = String(h || '').toLowerCase(); if (!h) return ''; return (ORIGINI.find(([r]) => r.test(h)) || [null, 'altro-sito'])[1]; };
export const pulisciOrigine = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
export const ROBOT = """),
    # visite: provenienza alla prima pagina della sessione
    ("""    if (dati.s) voci.push('_sessioni', dati.m ? '_mobile' : '_desktop');""",
     """    if (dati.s) voci.push('_sessioni', dati.m ? '_mobile' : '_desktop');
    if (dati.s && ORIGINE_OK.test(String(dati.o || ''))) voci.push('da:' + dati.o);   // 27/11: da dove arriva la visita"""),
    # iscrizioni per provenienza (email: alla richiesta; Google/LinkedIn: alla creazione)
    ("""      conferma: salvato, ultimoInvio: Date.now(), avvisi: true, docenti: [], privacy: ora16(), condizioni: ora16() };
    await M.scriviAccount(acc);""",
     """      conferma: salvato, ultimoInvio: Date.now(), avvisi: true, docenti: [], privacy: ora16(), condizioni: ora16() };
    await M.scriviAccount(acc);
    if (!prima && ORIGINE_OK.test(String(dati.da || ''))) await conta('iscr:' + dati.da);"""),
    ("""      await M.scriviAccount(acc);
      await conta('_' + prov);""",
     """      await M.scriviAccount(acc);
      await conta('_' + prov);
      if (ORIGINE_OK.test(String(dati.da || ''))) await conta('iscr:' + dati.da);"""),
    # dashboard: provenienze
    ("""      else if (r.voce.startsWith('caso:')) perCaso[r.voce.slice(5)] = (perCaso[r.voce.slice(5)] || 0) + r.n;""",
     """      else if (r.voce.startsWith('caso:')) perCaso[r.voce.slice(5)] = (perCaso[r.voce.slice(5)] || 0) + r.n;
      else if (r.voce.startsWith('da:')) (prov[r.voce.slice(3)] ||= { da: r.voce.slice(3), visite: 0, iscrizioni: 0 }).visite += r.n;
      else if (r.voce.startsWith('iscr:')) (prov[r.voce.slice(5)] ||= { da: r.voce.slice(5), visite: 0, iscrizioni: 0 }).iscrizioni += r.n;"""),
    ("""    const pagine = {}, perCaso = {};
    for (const r of righe) {""",
     """    const pagine = {}, perCaso = {}, prov = {};
    for (const r of righe) {"""),
    ("""    return json(200, { generato: new Date().toISOString(), da, giorni: Object.values(perGiorno), imbuto,""",
     """    const provenienze = Object.values(prov).sort((a, b) => b.visite - a.visite || b.iscrizioni - a.iscrizioni);
    return json(200, { generato: new Date().toISOString(), da, giorni: Object.values(perGiorno), imbuto, provenienze,"""),
    # elenco dei casi di prova: anche la domanda (per il testo dei post)
    ("""    return json(200, { giorno: l.length ? l[n % l.length].id : '', casi: l.map((c) => ({ id: c.id, titolo: c.titolo || c.id, modalita: c.modalita || '', distretto: c.distretto || '', difficolta: c.difficolta || '' })) });""",
     """    return json(200, { giorno: l.length ? l[n % l.length].id : '', casi: l.map((c) => ({ id: c.id, titolo: c.titolo || c.id, modalita: c.modalita || '', distretto: c.distretto || '', difficolta: c.difficolta || '', domanda: c.domanda || '' })) });"""),
    # pagina per i social di un caso
    ("""// pagina per i social (radio-quiz.it/s/<codice>): anteprima (Open Graph) e rimando alla pagina della sfida""",
     """// 27/11: pagina per i social di un caso (radio-quiz.it/c/<caso>?da=<canale>): anteprima con immagine, titolo e domanda
// solo per i casi di prova (si aprono senza iscrizione); per gli altri un'anteprima generica. Rimanda al caso con la provenienza.
export function paginaCaso(c, id, da, indirizzo) {
  const base = radice(indirizzo), url = `${base}/?da=${encodeURIComponent(da)}#/caso/${encodeURIComponent(id)}`;
  const titolo = c ? c.titolo || 'Caso clinico' : 'Quiz Radiologia: casi reali di diagnostica per immagini';
  const descr = c ? `${c.domanda ? c.domanda + ' ' : ''}Prova il caso senza iscriverti: immagini vere nel visualizzatore e correzione immediata.` : 'Casi reali e anonimi da leggere nel visualizzatore DICOM, con la correzione subito. Gratuito, a scopo formativo.';
  const img = c ? `${base}/img/condividi/${id}.jpg` : `${base}/img/condivisione.jpg`, wh = c ? [480, 480] : [1200, 630];
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${escH(titolo)} · Quiz Radiologia</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="${escH(descr)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Quiz Radiologia"><meta property="og:locale" content="it_IT">
<meta property="og:title" content="${escH(titolo)}"><meta property="og:description" content="${escH(descr)}">
<meta property="og:url" content="${escH(`${base}/c/${id}`)}"><meta property="og:image" content="${escH(img)}">
<meta property="og:image:width" content="${wh[0]}"><meta property="og:image:height" content="${wh[1]}"><meta property="og:image:alt" content="${escH(c ? 'Immagine del caso: ' + titolo : 'Quiz Radiologia')}">
<meta name="twitter:card" content="${c ? 'summary' : 'summary_large_image'}"><meta name="twitter:title" content="${escH(titolo)}"><meta name="twitter:description" content="${escH(descr)}"><meta name="twitter:image" content="${escH(img)}">
<meta http-equiv="refresh" content="0; url=${escH(url)}"></head>
<body style="font-family:system-ui,sans-serif;padding:2em"><p><a href="${escH(url)}">${escH(titolo)}: apri il caso su Quiz Radiologia</a></p></body></html>`;
}
// pagina per i social (radio-quiz.it/s/<codice>): anteprima (Open Graph) e rimando alla pagina della sfida"""),
    ("""  if (parti[0] !== 'api') return json(404, { errore: 'non trovato' });""",
     """  if (parti[0] === 'c' && (metodo === 'GET' || metodo === 'HEAD') && parti.length === 2) {
    const id = String(parti[1]), M0 = cfg.magazzino;
    const c = /^caso-[a-z0-9-]{1,40}$/i.test(id) ? await M0.leggiCaso(id).catch(() => null) : null;
    const prova = !!(c && c.prova === true && visibile(c) && istanzaDi(cfg).modo !== 'azienda');
    let da = pulisciOrigine(req.query?.da);
    if (!da) { let h = ''; try { h = new URL(String(req.headers?.referer || '')).hostname; } catch {} da = origineDaHost(h) || 'link-caso'; }
    return { stato: c && visibile(c) ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, corpo: paginaCaso(prova ? c : null, id, da, cfg.indirizzo) };
  }
  if (parti[0] !== 'api') return json(404, { errore: 'non trovato' });"""),
])
patch('api/lambda.mjs', [
    ("""      headers: { cookie: cookieHeader, 'user-agent': event.headers?.['user-agent'] || '' },""",
     """      headers: { cookie: cookieHeader, 'user-agent': event.headers?.['user-agent'] || '', referer: event.headers?.referer || '' },"""),
])
patch('lib/stack.mjs', [
    ("""        '/api/*': {
          origin: origineApi,""",
     """        // 27/11: link dei casi da condividere (radio-quiz.it/c/<caso>): anteprima per i social, come le sfide
        '/c/*': {
          origin: origineApi,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [risposta],
        },
        '/api/*': {
          origin: origineApi,"""),
])
patch('test/simulatore.mjs', [
    ("""/^\\/s\\/[^/]+$/.test(u.pathname)""", """/^\\/[sc]\\/[^/]+$/.test(u.pathname)"""),
])
print('ok')
