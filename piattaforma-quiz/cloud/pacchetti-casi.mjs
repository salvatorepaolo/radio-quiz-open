// pacchetti-casi.mjs (pubblicazione, 1.277): le immagini di ogni serie raggruppate in pochi «pacchetti» invece di un
// file per immagine. Ogni richiesta al sito conta (piani di CloudFront a richieste): una TC di 200 immagini passa da
// 200 richieste a 4-6. Un pacchetto è la semplice concatenazione dei file DICOM originali, nell'ordine di serie.json,
// fino a circa MAX byte; si carica compresso con brotli (Content-Encoding: br, il browser lo decomprime da solo).
// Il nome è l'impronta del contenuto (sha256): un pacchetto non cambia mai, quindi il browser lo tiene un anno
// (Cache-Control immutable) e chi riapre un caso non lo riscarica.
// Per ogni caso si scrive <specchio>/<id>/pacchetti.json: { v: 1, p: [[nome, [file...], [byte...]], ...] } (no-cache).
// Restano fuori i vetrini (letti a pezzi con richieste parziali) e le serie di un solo file. I file singoli restano
// online: il visualizzatore li usa per la prima immagine, per le immagini aggiunte dall'editor e nel client.
// Si rifà solo ciò che è cambiato (indice con data e dimensione dei file). Uso: node pacchetti-casi.mjs <casi> <specchio>
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib'; import crypto from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
const MAX = 16 * 2 ** 20;   // byte originali per pacchetto (circa 6-9 MB sulla rete dopo brotli)
if (!isMainThread) {
  parentPort.on('message', ({ files, a }) => {
    try {
      const b = Buffer.concat(files.map((f) => fs.readFileSync(f)));
      const nome = crypto.createHash('sha256').update(b).digest('hex').slice(0, 24) + '.rqp', dest = path.join(a, nome);
      if (!fs.existsSync(dest)) {
        const c = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } });
        if (!zlib.brotliDecompressSync(c).equals(b)) throw new Error('verifica non riuscita');
        fs.mkdirSync(a, { recursive: true }); fs.writeFileSync(dest + '.tmp', c); fs.renameSync(dest + '.tmp', dest);
      }
      parentPort.postMessage({ ok: true, nome, byte: b.length });
    } catch (e) { parentPort.postMessage({ ok: false, errore: e.message }); }
  });
} else {
  const [CASI, SPECCHIO] = process.argv.slice(2).map((x) => path.resolve(x));
  if (!CASI || !SPECCHIO) { console.error('uso: node pacchetti-casi.mjs <casi> <specchio>'); process.exit(2); }
  const fIndice = path.join(SPECCHIO, 'indice-pacchetti.json');
  let indice = {}; try { indice = JSON.parse(fs.readFileSync(fIndice, 'utf8')); } catch {}
  const nuovoIndice = {}, lavori = [], perCaso = {};
  for (const id of fs.readdirSync(CASI).sort()) {
    let serie; try { serie = JSON.parse(fs.readFileSync(path.join(CASI, id, 'serie.json'), 'utf8')); } catch { continue; }
    const gruppi = [];
    for (const s of serie) {
      if (s.tipo === 'vetrino' || !Array.isArray(s.files) || s.files.length < 2) continue;
      let g = [], tot = 0;
      for (const f of s.files) {
        const p = path.join(CASI, id, f); let st; try { st = fs.statSync(p); } catch { continue; }
        if (g.length && tot + st.size > MAX) { gruppi.push(g); g = []; tot = 0; }
        g.push([f, st.size, Math.round(st.mtimeMs)]); tot += st.size;
      }
      if (g.length > 1) gruppi.push(g);   // un pacchetto con un solo file non fa risparmiare richieste
    }
    perCaso[id] = gruppi.map((g) => {
      const chiave = id + '|' + g.map((x) => x.join(':')).join('|'), h = crypto.createHash('sha1').update(chiave).digest('hex');
      const voce = { h, files: g.map((x) => x[0]), byte: g.map((x) => x[1]), nome: indice[h] };
      if (!voce.nome || !fs.existsSync(path.join(SPECCHIO, id, 'pacchetti', voce.nome))) lavori.push(voce); else nuovoIndice[h] = voce.nome;
      return voce;
    });
  }
  let fatti = 0, byte = 0; const errori = [];
  if (lavori.length) {
    const n = Math.max(1, Math.min(6, os.cpus().length - 2)), ws = Array.from({ length: n }, () => new Worker(new URL(import.meta.url)));
    let k = 0;
    await Promise.all(ws.map((w) => new Promise((fine) => {
      const prossimo = () => { if (k >= lavori.length) { w.terminate(); fine(); return; } const v = lavori[k++], id = Object.keys(perCaso).find((c) => perCaso[c].includes(v));
        w.once('message', (r) => { if (r.ok) { v.nome = r.nome; nuovoIndice[v.h] = r.nome; fatti++; byte += r.byte; } else errori.push(r.errore); prossimo(); });
        w.postMessage({ files: v.files.map((f) => path.join(CASI, id, f)), a: path.join(SPECCHIO, id, 'pacchetti') }); };
      prossimo();
    })));
  }
  if (errori.length) { console.error('Pacchetti non riusciti:\n  ' + errori.slice(0, 10).join('\n  ')); process.exit(1); }
  // pacchetti.json per caso; via i pacchetti non più usati
  let tot = 0, file = 0, tolti = 0;
  for (const [id, l] of Object.entries(perCaso)) {
    const d = path.join(SPECCHIO, id), usati = new Set(l.map((v) => v.nome)); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'pacchetti.json'), JSON.stringify({ v: 1, p: l.map((v) => [v.nome, v.files, v.byte]) }));
    try { for (const n of fs.readdirSync(path.join(d, 'pacchetti'))) if (!usati.has(n)) { fs.rmSync(path.join(d, 'pacchetti', n)); tolti++; } } catch {}
    tot += l.length; file += l.reduce((t, v) => t + v.files.length, 0);
  }
  fs.mkdirSync(SPECCHIO, { recursive: true }); fs.writeFileSync(fIndice, JSON.stringify(nuovoIndice));
  console.log(`pacchetti: ${tot} per ${file} immagini (${(file / Math.max(1, tot)).toFixed(0)} immagini per pacchetto); nuovi ${fatti} (${(byte / 2 ** 30).toFixed(1)} GB letti); tolti ${tolti}`);
}
