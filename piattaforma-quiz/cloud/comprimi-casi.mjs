// comprimi-casi.mjs (pubblicazione, 1.265): copia compressa con brotli (livello 6) di ogni immagine DICOM dei casi, in
// una cartella «specchio» (.casi-br) con gli stessi percorsi. Le copie si caricano su S3 con «Content-Encoding: br»: il
// browser le decomprime da solo e riceve il file identico all'originale, ma sulla rete viaggia circa la metà
// (TC: 47-55%). I file originali in casi-free non si toccano.
// Non si comprimono: i vetrini (cartelle «vetrino/», letti a pezzi con richieste parziali, già compressi) e i file in _rimosse.
// Si ricomprime solo ciò che è cambiato (data di modifica uguale all'originale = copia già fatta); le copie di file
// che non esistono più si tolgono. Uso: node comprimi-casi.mjs <cartella dei casi> <cartella specchio>
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
if (!isMainThread) {
  parentPort.on('message', ({ da, a, mtime }) => {
    try {
      const b = fs.readFileSync(da), c = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } });
      // controllo: la copia si decomprime nell'originale
      if (!zlib.brotliDecompressSync(c).equals(b)) throw new Error('verifica non riuscita');
      fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a + '.tmp', c); fs.renameSync(a + '.tmp', a); fs.utimesSync(a, mtime, mtime);
      parentPort.postMessage({ ok: true, prima: b.length, dopo: c.length });
    } catch (e) { parentPort.postMessage({ ok: false, errore: `${da}: ${e.message}` }); }
  });
} else {
  const [CASI, SPECCHIO] = process.argv.slice(2).map((x) => path.resolve(x));
  if (!CASI || !SPECCHIO) { console.error('uso: node comprimi-casi.mjs <casi> <specchio>'); process.exit(2); }
  const lavori = [], tenuti = new Set();
  const giro = (rel) => { for (const e of fs.readdirSync(path.join(CASI, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === '_rimosse' || e.name === 'vetrino') continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) giro(r);
    else if (e.name.endsWith('.dcm')) {
      const da = path.join(CASI, r), a = path.join(SPECCHIO, r), st = fs.statSync(da); tenuti.add(a);
      let fatto = false; try { fatto = Math.abs(fs.statSync(a).mtimeMs - st.mtimeMs) < 1000; } catch {}
      if (!fatto) lavori.push({ da, a, mtime: st.mtime });
    } } };
  giro('');
  // copie di file tolti dai casi
  let tolte = 0;
  const pulisci = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) pulisci(f); else if (!tenuti.has(f)) { fs.unlinkSync(f); tolte++; } } };
  pulisci(SPECCHIO);
  let prima = 0, dopo = 0, fatti = 0; const errori = [];
  if (lavori.length) {
    const n = Math.max(1, Math.min(6, os.cpus().length - 2)), ws = Array.from({ length: n }, () => new Worker(new URL(import.meta.url)));
    await Promise.all(ws.map((w) => new Promise((fine) => {
      const prossimo = () => { const l = lavori.pop(); if (!l) { w.terminate(); fine(); return; } w.postMessage(l); };
      w.on('message', (m) => { if (m.ok) { prima += m.prima; dopo += m.dopo; fatti++; if (fatti % 2000 === 0) console.error(`  … ${fatti} immagini compresse`); } else errori.push(m.errore); prossimo(); });
      w.on('error', (e) => { errori.push(e.message); prossimo(); });
      prossimo();
    })));
  }
  console.log(`${tenuti.size} immagini; compresse ora ${fatti}${fatti ? ` (${(prima / 1e9).toFixed(2)} → ${(dopo / 1e9).toFixed(2)} GB, ${Math.round(100 * dopo / prima)}%)` : ''}; copie tolte ${tolte}`);
  if (errori.length) { console.error(errori.slice(0, 10).join('\n')); process.exit(1); }
}
