// Fotografia dei risultati delle scale (web/scale-dati.js) su un insieme fisso di risposte: ogni scala con
// tutte le scelte di ogni campo, una alla volta, più 150 combinazioni pseudo-casuali (sempre le stesse).
// Le risposte hanno la stessa forma di quelle lette dalla scheda nella pagina (scale.js, funzione leggi).
// Serve al test di non regressione (scale.test.mjs): se un calcolo cambia, il test lo segnala.
// Dopo una correzione voluta di una scala si rifà la fotografia:
//   node scale-fotografia.mjs ../web/scale-dati.js > fixture/scale-fotografia.json
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const MM = [undefined, 0, 3, 5.5, 8, 10, 15, 20, 25, 30, 40, 50, 70, 100];
const NUM = [undefined, 0, 1.5, 3, 10, 35, 50, 70];
function valoriDi(c, m) {
  // come nella pagina: le scelte arrivano come testo (valore del pulsante), le scelte multiple come elenco di testi
  if (c.scelte && c.multi) { const t = c.scelte.map((s) => String(s[0])); return [[], [t[0]], [t[0], t[t.length - 1]], t]; }
  if (c.scelte) return [undefined, ...c.scelte.map((s) => String(s[0]))];
  if (c.tipo === 'mm') return MM;
  if (c.tipo === 'num') return NUM;
  if (c.tipo === 'prostata') return [[], ['base-PZpl-dx'], ['base-PZpl-dx', 'medio-TZa-sx', 'apice-PZpm-dx']];
  if (c.tipo === 'fegato') return [[], ['S8'], ['S4b', 'S8'], ['S1']];
  if (c.tipo === 'bullseye') return [{}, { 1: 2, 7: 3 }, Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, 1])), { 3: 'nv', 4: 4 }];
  if (c.tipo === 'mammella') return [undefined, ...[[30, 40], [120, 60], [75, 75], [200, 100]].map(([x, y]) => m.sedeMammella(x, y)).filter(Boolean)];
  return [undefined];
}
// generatore pseudo-casuale con seme fisso
function rng(seme) { let s = seme >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const prova = (S, v) => { try { return S.calcola(v); } catch (e) { return 'ERRORE: ' + e.message; } };

export function fotografia(m) {
  const out = {};
  for (const [k, S] of Object.entries(m.SCALE)) {
    const campi = S.campi, vals = campi.map((c) => valoriDi(c, m));
    // base: per ogni campo il primo valore definito «di mezzo»
    const base = Object.fromEntries(campi.map((c, i) => [c.id, vals[i][Math.min(vals[i].length - 1, Math.ceil(vals[i].length / 2))]]));
    const casi = [{}, base];
    campi.forEach((c, i) => vals[i].forEach((x) => casi.push({ ...base, [c.id]: x })));
    const r = rng(k.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
    for (let n = 0; n < 150; n++) casi.push(Object.fromEntries(campi.map((c, i) => [c.id, vals[i][Math.floor(r() * vals[i].length)]])));
    out[k] = { nome: S.nome, metodiche: S.metodiche, campi: campi.map((c) => c.id), risultati: casi.map((v) => [v, prova(S, v) ?? null]) };
  }
  out._disegni = {
    prostata: m.svgProstata(['base-PZpl-dx', 'medio-TZa-sx']), fegato: m.svgFegato(['S4b', 'S8']), bullseye: m.svgBullseye({ 1: 2, 7: 3 }, '2'),
    mammella: m.svgMammella(m.sedeMammella(120, 60)), settori: ['base-PZpl-dx', 'apice-TZa-sx', 'SV-dx', 'US'].map((s) => [m.descriviSettore(s), m.sigla(s)]),
    segmenti: ['S1', 'S4a', 'S8'].map((s) => [m.descriviSegmento(s), m.siglaSegmento(s)]), cinetica: m.descriviBullseye({ 1: 2, 7: 2, 3: 3 }),
  };
  return JSON.parse(JSON.stringify(out));
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = await import(pathToFileURL(path.resolve(process.argv[2] || '../web/scale-dati.js')).href);
  process.stdout.write(JSON.stringify(fotografia(m)) + '\n');
}
