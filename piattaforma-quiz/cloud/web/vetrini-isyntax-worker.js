// vetrini-isyntax-worker.js — web worker che legge un vetrino Philips iSyntax con libisyntax (WebAssembly, lib/isyntax.mjs).
// Il file resta sul computer (WORKERFS) oppure, sulla piattaforma, si legge dal sito a pezzi: solo le parti che servono.
import crea from './lib/isyntax.mjs';
let M = null;
self.onmessage = async (e) => {
  const { id, tipo } = e.data;
  try {
    if (tipo === 'apri') {
      M = await crea();
      // file del computer: montato in sola lettura (WORKERFS); file del sito: letto a pezzi con richieste parziali (sincrone,
      // possibili solo in un worker) man mano che libisyntax ne chiede una parte
      let percorso;
      if (e.data.file) { M.FS.mkdir('/v'); M.FS.mount(M.WORKERFS, { files: [e.data.file] }, '/v'); percorso = '/v/' + e.data.file.name; }
      else { M.FS.mkdir('/r'); M.FS.createLazyFile('/r', 'vetrino.isyntax', e.data.url, true, false); percorso = '/r/vetrino.isyntax'; }
      const r = M.ccall('rq_apri', 'number', ['string'], [percorso]);
      if (r !== 0) throw new Error(`iSyntax non leggibile (${r})`);
      const n = M._rq_livelli(), livelli = [];
      for (let l = 0; l < n; l++) livelli.push({ w: M._rq_liv_w(l), h: M._rq_liv_h(l), tx: M._rq_liv_tx(l), ty: M._rq_liv_ty(l), ds: M._rq_liv_ds(l) });
      const jpeg = (q) => { const p = M._rq_jpeg(q), k = M._rq_jpeg_n(); return p && k ? M.HEAPU8.slice(p, p + k) : null; };
      self.postMessage({ id, info: { tw: M._rq_tw(), th: M._rq_th(), mpp: M._rq_mpp(), livelli, etichetta: jpeg(0), panoramica: jpeg(1) } });
    } else if (tipo === 'tessera') {
      const p = M._rq_tessera(e.data.l, e.data.x, e.data.y), n = M._rq_tw() * M._rq_th() * 4;
      if (!p) throw new Error('tessera iSyntax non leggibile');
      const b = M.HEAPU8.slice(p, p + n);
      self.postMessage({ id, b }, [b.buffer]);
    }
  } catch (err) { self.postMessage({ id, errore: String(err?.message || err) }); }
};
