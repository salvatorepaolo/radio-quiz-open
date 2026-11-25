// riprendi-nuove.mjs (pubblicazione, 1.265): immagini di un caso aggiunte online con l'editor del sito → nella cartella del
// caso sul Mac. Si scaricano SOLO i file che qui mancano: online le altre immagini sono copie compresse con brotli
// (Content-Encoding: br) e non devono sostituire gli originali. Se un file scaricato fosse compresso, si decomprime.
// Uso: node riprendi-nuove.mjs <bucket del sito> <id del caso> <cartella del caso>
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import os from 'node:os';
const [BUCKET, ID, DIR] = process.argv.slice(2);
if (!BUCKET || !ID || !DIR) { console.error('uso: node riprendi-nuove.mjs <bucket> <id> <cartella>'); process.exit(2); }
const aws = (...a) => execFileSync('aws', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
let token = null, nuove = 0;
do {
  const r = JSON.parse(aws('s3api', 'list-objects-v2', '--bucket', BUCKET, '--prefix', `casi/${ID}/serie/`, '--output', 'json', ...(token ? ['--continuation-token', token] : [])));
  for (const o of r.Contents || []) {
    const rel = o.Key.slice(`casi/${ID}/`.length), dest = path.join(DIR, rel);
    if (fs.existsSync(dest) || fs.existsSync(path.join(DIR, '_rimosse', rel))) continue;
    const tmp = path.join(os.tmpdir(), `riprendi-${process.pid}-${nuove}`);
    const testa = JSON.parse(aws('s3api', 'get-object', '--bucket', BUCKET, '--key', o.Key, tmp, '--output', 'json'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (testa.ContentEncoding === 'br') { fs.writeFileSync(dest, zlib.brotliDecompressSync(fs.readFileSync(tmp))); fs.unlinkSync(tmp); }
    else fs.copyFileSync(tmp, dest), fs.unlinkSync(tmp);   // 1.326: vetrini fino a 4 GB, senza leggerli in memoria
    // data del file = data online: la sincronizzazione successiva non ricarica un vetrino di gigabyte già presente
    if (o.LastModified) { const t = new Date(o.LastModified); fs.utimesSync(dest, t, t); }
    nuove++;
  }
  token = r.IsTruncated ? r.NextContinuationToken : null;
} while (token);
console.log(`${ID}: ${nuove} immagini nuove riprese dal sito`);
