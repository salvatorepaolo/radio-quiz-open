// Pubblicazione: le due librerie grandi (lib/mpr3d.js, motore MPR/3D; lib/webllm.js, IA del referto nel browser)
// si caricano già compresse con brotli al livello massimo: circa il 30% in meno di quanto comprime CloudFront da sé
// (mpr3d 1,29 → 0,90 MB, webllm 2,0 → 1,4 MB). Le versioni compresse restano in .br-cache, una per contenuto
// (hash), così si ricomprime solo quando la libreria cambia.
// Uso: node comprimi.mjs <file>  → stampa «<percorso del .br> <hash>»
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import crypto from 'node:crypto';
const f = process.argv[2], dati = fs.readFileSync(f);
const hash = crypto.createHash('sha256').update(dati).digest('hex').slice(0, 12);
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '.br-cache'); fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `${path.basename(f)}.${hash}.br`);
if (!fs.existsSync(out)) {
  for (const x of fs.readdirSync(dir)) if (x.startsWith(path.basename(f) + '.')) fs.unlinkSync(path.join(dir, x));   // versioni vecchie
  fs.writeFileSync(out, zlib.brotliCompressSync(dati, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_LGWIN]: 24, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: dati.length } }));
}
console.log(out, hash);
