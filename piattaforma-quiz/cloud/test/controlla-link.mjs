// controlla-link.mjs: i link esterni citati dai casi (DOI, archivi TCIA, licenze) e dalle pagine del sito funzionano ancora?
// Un link che non esiste più (404, 410, dominio sparito) fa fallire il controllo; un sito che rifiuta i programmi automatici
// (403, 429) o non risponde in tempo è solo segnalato. Gira ogni settimana su GitHub (.github/workflows/link.yml).
// Uso: node controlla-link.mjs [cartella dei casi] [cartella del sito]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const CASI = path.resolve(process.argv[2] || path.join(QUI, '../../casi-free')), WEB = path.resolve(process.argv[3] || path.join(QUI, '../web'));
const PROPRI = /^https?:\/\/([a-z0-9-]+\.)*radio-quiz\.it|localhost|esempio\.|example\./;
const link = new Map();   // url → dove è citato
const aggiungi = (testo, dove) => {
  for (let u of testo.match(/https?:\/\/[^\s"'<>)\]\\]+/g) || []) {
    u = u.replace(/[.,;:]+$/, '').replace(/&amp;/g, '&');
    try { if (!new URL(u).hostname.includes(".")) continue; } catch { continue; }
    if (PROPRI.test(u) || /\$\{|\{\{/.test(u)) continue;
    if (!link.has(u)) link.set(u, new Set()); link.get(u).add(dove);
  }
};
for (const d of fs.readdirSync(CASI)) { const f = path.join(CASI, d, 'caso.json'); if (fs.existsSync(f)) aggiungi(fs.readFileSync(f, 'utf8'), d); }
for (const f of fs.readdirSync(WEB).filter((x) => x.endsWith('.html'))) aggiungi(fs.readFileSync(path.join(WEB, f), 'utf8'), f);

const prova = async (u) => {
  for (let giro = 0; giro < 2; giro++) {
    for (const metodo of ['HEAD', 'GET']) {
      try {
        const r = await fetch(u, { method: metodo, redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'Mozilla/5.0 (radio-quiz.it controllo dei link)', accept: 'text/html,*/*' } });
        r.body?.cancel().catch(() => {});
        if (r.ok) return { stato: r.status };
        if (metodo === 'HEAD' && [400, 403, 404, 405, 501].includes(r.status)) continue;   // molti siti non accettano HEAD
        if (giro === 0 && r.status >= 500) break;
        return { stato: r.status };
      } catch (e) { if (giro === 1) return { stato: 0, errore: e.cause?.code || e.name }; break; }
    }
    await new Promise((x) => setTimeout(x, 3000));
  }
  return { stato: 0, errore: 'nessuna risposta' };
};
const voci = [...link.keys()], esiti = new Map(); let k = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (k < voci.length) { const u = voci[k++]; esiti.set(u, await prova(u)); } }));
const rotti = [], dubbi = [];
for (const [u, e] of esiti) {
  const dove = [...link.get(u)].slice(0, 4).join(', ') + (link.get(u).size > 4 ? '…' : '');
  if (e.stato >= 200 && e.stato < 400) continue;
  const morto = [404, 410].includes(e.stato) || ['ENOTFOUND', 'EAI_AGAIN_NO'].includes(e.errore);
  (morto ? rotti : dubbi).push(`${e.stato || e.errore}  ${u}  (${dove})`);
}
console.log(`${voci.length} link controllati: ${voci.length - rotti.length - dubbi.length} funzionano, ${rotti.length} rotti, ${dubbi.length} da verificare a mano`);
for (const r of rotti) console.log('  ✖ ' + r);
for (const d of dubbi) console.log('  ? ' + d);
if (process.env.GITHUB_ACTIONS) for (const d of dubbi) console.log(`::warning::link da verificare: ${d}`);
process.exit(rotti.length ? 1 : 0);
