// Fotografia della correzione di ogni caso (casi-free/*/caso.json) con risposte tipo: tutte giuste, solo il reperto
// principale, tutte le risposte, nessuna, giuste + un distrattore; referto libero con i reperti attesi o con le
// affermazioni sbagliate; comunicazione dell'esito giusta o assente; clic al centro del segno sulla figura.
// La usa casi.test.mjs (non regressione). Dopo una modifica voluta di un caso o della correzione:
//   node casi-fotografia.mjs > fixture/casi-fotografia.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url));
export const CASI = process.env.CASI || fileURLToPath(new URL('../../casi-free', import.meta.url));   // relativo: gira anche su GitHub
const L = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);

const breve = (r) => r && { p: r.punteggio, ok: !!r.perfetta, ...(r.sezioni ? { sez: r.sezioni.map((s) => s.punteggio) } : {}) };
export function correzioni(caso) {
  const o = caso.opzioni || [], giuste = o.map((x, i) => (x.corretta ? i : -1)).filter((i) => i >= 0);
  const princ = o.findIndex((_, i) => L.tipoOpzione(o, i) === 'principale'), distr = o.findIndex((x) => !x.corretta);
  const testi = (f) => o.filter(f).map((x) => x.testo).join('. ');
  const out = {
    tutteGiuste: breve(L.valuta(caso, giuste)), soloPrincipale: breve(L.valuta(caso, princ >= 0 ? [princ] : [])),
    tutte: breve(L.valuta(caso, o.map((_, i) => i))), nessuna: breve(L.valuta(caso, [])),
    conDistrattore: breve(L.valuta(caso, distr >= 0 ? [...giuste, distr] : giuste)),
  };
  const rif = (t) => { const r = L.valutaReferto(caso, t); return { p: r.punteggio, citati: r.citati, attesi: r.attesi, errori: r.errori.length }; };
  out.refertoGiusto = rif(testi((x) => x.corretta)); out.refertoSbagliato = rif(testi((x) => !x.corretta));
  if (caso.comunicazione) {
    const c = caso.comunicazione, a = { livello: c.livello, accettabili: c.accettabili || [], destinatari: c.destinatari || ['richiedente'], parole: (c.parole || []).map((w) => String(w).toLowerCase()), motivo: '' };   // come pulisciComunicazione nel server
    out.comGiusta = L.valutaComunicazione(a, { livello: a.livello, a: a.destinatari[0], come: ['immediata', 'urgente'].includes(a.livello) ? 'telefono' : 'messaggio', testo: a.parole.join(' '), dopo_s: 300 }, 'Comunicato al medico richiedente.')?.punteggio;
    out.comAssente = L.valutaComunicazione(a, { livello: 'nessuna' }, '')?.punteggio;
  }
  const sg = caso.vista?.segno;
  if (sg) out.punto = L.valutaPunto(caso.vista, { serie: caso.vista.serie, idx: caso.vista.idx, x: (sg.a.x + sg.b.x) / 2, y: (sg.a.y + sg.b.y) / 2 })?.esito;
  out.controlli = L.controlliCaso(caso);
  return out;
}
export function fotografia() {
  const f = {};
  for (const id of fs.readdirSync(CASI).sort()) { const p = path.join(CASI, id, 'caso.json'); if (fs.existsSync(p)) f[id] = correzioni(JSON.parse(fs.readFileSync(p, 'utf8'))); }
  return f;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(fotografia(), null, 1) + '\n');
