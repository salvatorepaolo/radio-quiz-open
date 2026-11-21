// Service worker della versione client di radio-quiz (ambito /client/): il visualizzatore funziona anche senza rete.
// /client/index.html (e ogni pagina sotto /client/) riceve la pagina del sito; /client/<file> → /<file>.
// Prima la rete (aggiornamenti), poi la copia salvata. /api/ e /casi/ non passano di qui. Nessun dato del paziente
// viene salvato: in cache vanno solo i file del sito.
const CACHE = 'rq-client-13';
const PROPRI = /^\/client\/(sw\.js|avvio\.js|manifest\.json|icona-\d+\.png)$/;
const FILE = ['/index.html', '/app.js', '/style.css', '/logo.svg', '/versione.json', '/licenze.html', '/anonimizza.js', '/analisi.js', '/cmr.js', '/ecosemi.js',
  '/t2star.js', '/refertolocale.js', '/scale.js', '/scale-dati.js', '/scale-indice.js', '/prima.js', '/rotta.js', '/cmr-ui.js', '/docenti.js', '/gestione-sito.js', '/noduli-client.js', '/noduli-worker.js', '/aiuto.json', '/schede.json', '/modelli-referto.json', '/protocolli.json', '/percorsi.json',
  '/lib/dicomParser.min.js', '/lib/lossless-min.js', '/lib/mpr3d.js', '/lib/mp4-muxer.js', '/lib/openseadragon.min.js', '/vetrini.js', '/vetrini-sop.js', '/vetrini-ann.js', '/vetrini-dec.js', '/vetrini-worker.js',
  '/lib/codec/openjpegwasm_decode.js', '/lib/codec/openjpegwasm_decode.wasm', '/lib/codec/charlswasm_decode.js', '/lib/codec/charlswasm_decode.wasm',
  '/lib/codec/libjpegturbowasm_decode.js', '/lib/codec/libjpegturbowasm_decode.wasm', '/lib/codec/jpegimage.js',
  '/gsps.js', '/referto.js', '/manuale-client.html', '/manuale-client.en.html', '/i18n.js', '/lingua/en.json', '/lingua/en/modelli-referto.json', '/lingua/en/aiuto.json', '/lingua/en/schede.json', '/decodifica.js', '/decodifica-worker.js', '/client/manifest.json', '/client/icona-192.png', '/client/icona-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(FILE.map(async (u) => { try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch {} }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('rq-client-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || /^\/(api|casi|esempi)\//.test(url.pathname)) return;   // esempi: l'esame di prova non va nella cache dei file del sito
  // modelli IA facoltativi (noduli-client.js): scaricati a richiesta in una cache a parte, letti da lì anche senza rete
  if (url.pathname.startsWith('/modelli-ia/')) { e.respondWith(caches.match(url.pathname).then((r) => r || fetch(req))); return; }
  let dest = url.pathname;
  if (req.mode === 'navigate' && dest.startsWith('/client/')) dest = /^\/client\/manuale-client(\.en)?\.html$/.test(dest) ? dest.slice(7) : '/index.html';   // il manuale è una pagina a sé
  else if (dest.startsWith('/client/') && !PROPRI.test(dest)) dest = dest.slice(7);
  e.respondWith(primaLaRete(dest + url.search, dest));
});
async function primaLaRete(indirizzo, chiave) {
  const c = await caches.open(CACHE), salvata = await c.match(chiave);
  const rete = fetch(indirizzo, { cache: 'no-cache' }).then(async (r) => { if (r.ok) await c.put(chiave, r.clone()); return r; });
  if (!salvata) return rete.catch(() => new Response('Non disponibile senza rete', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  // con una copia salvata: la rete ha 4 secondi, poi si usa la copia (la rete intanto aggiorna la cache)
  return Promise.race([rete.then((r) => (r.ok ? r : salvata)).catch(() => salvata), new Promise((ok) => setTimeout(() => ok(salvata), 4000))]);
}
