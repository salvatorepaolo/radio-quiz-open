// Traduzioni inglesi (web/lingua): controlli statici, senza browser.
// - i file di contenuto in inglese hanno la stessa struttura degli originali (stessi id, stessi elenchi);
// - nessun testo NUOVO di index.html senza traduzione (quelli già senza, per lo più sigle e nomi, sono in una lista);
// - en.json: traduzioni non vuote e stessi segnaposto {x};
// - ogni caso ha il suo file di traduzione.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(QUI, '../web'), CASI = path.join(QUI, '../../casi-free');
const json = (f) => JSON.parse(fs.readFileSync(path.join(WEB, f), 'utf8'));
const EN = json('lingua/en.json');

function confronta(a, b, p, out) {
  if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) out.push(`${p}: ${a.length} elementi, in inglese ${Array.isArray(b) ? b.length : 'nessuno'}`); else a.forEach((x, i) => confronta(x, b[i], `${p}[${i}]`, out)); return; }
  if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') { out.push(`${p}: manca in inglese`); return; }
    for (const k of Object.keys(a)) { if (!(k in b)) out.push(`${p}.${k}: manca in inglese`); else if (k === 'id' && a[k] !== b[k]) out.push(`${p}.id diverso`); else confronta(a[k], b[k], `${p}.${k}`, out); }
  }
}
for (const f of ['aiuto.json', 'schede.json', 'modelli-referto.json', 'percorsi.json', 'protocolli.json'])
  test(`${f}: la versione inglese ha la stessa struttura`, () => { const out = []; confronta(json(f), json('lingua/en/' + f), f, out); assert.deepEqual(out.slice(0, 20), []); });

// testi visibili di index.html (contenuto degli elementi e attributi title, placeholder, aria-label, alt)
export function testiPagina() {
  const h = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  const dec = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const t = new Set();
  for (const m of h.matchAll(/>([^<>]+)</g)) { const s = dec(m[1]); if (/[a-zà-ù]{3}/i.test(s)) t.add(s); }
  for (const m of h.matchAll(/(?:title|placeholder|aria-label|alt)="([^"]+)"/g)) { const s = dec(m[1]); if (/[a-zà-ù]{3}/i.test(s)) t.add(s); }
  return t;
}
test('index.html: nessun testo nuovo senza traduzione inglese', () => {
  const noti = new Set(JSON.parse(fs.readFileSync(path.join(QUI, 'fixture/testi-senza-traduzione.json'), 'utf8')));
  const nuovi = [...testiPagina()].filter((s) => !(s in EN) && !noti.has(s));
  assert.deepEqual(nuovi, [], 'aggiungi la traduzione in web/lingua/en.json (o, se è una sigla, in test/fixture/testi-senza-traduzione.json)');
});
test('en.json: traduzioni non vuote, con gli stessi segnaposto {x}', () => {
  const conta = (s) => (s.match(/\{x\}/g) || []).length, male = [];
  for (const [it, en] of Object.entries(EN)) if (typeof en !== 'string' || !en.trim() || conta(it) !== conta(en)) male.push(it.slice(0, 80));
  assert.deepEqual(male.slice(0, 20), []);
});
test('ogni caso ha il suo file di traduzione (lingua/casi/<id>.json)', { skip: !fs.existsSync(CASI) && 'cartella dei casi assente' }, () => {
  const casi = fs.readdirSync(CASI).filter((d) => fs.existsSync(path.join(CASI, d, 'caso.json')));
  const mancano = casi.filter((id) => !fs.existsSync(path.join(WEB, 'lingua/casi', id + '.json')));
  assert.deepEqual(mancano, []);
});
