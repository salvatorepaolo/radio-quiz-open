// Test della modalità «azienda» (piattaforma di un'azienda, accesso solo su invito): simulatore con MODO=azienda
// e una cartella dei casi vuota (le aziende partono senza casi).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), B = `http://localhost:${PORTA}`;
const VUOTA = fs.mkdtempSync(path.join(os.tmpdir(), 'casi-azienda-'));
let sim;
function utente() {
  const jar = new Map();
  return async (u, { metodo = 'GET', corpo } = {}) => {
    const r = await fetch(B + u, { method: metodo, headers: { 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: corpo === undefined ? undefined : JSON.stringify(corpo), redirect: 'manual' });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); if (/Max-Age=0/i.test(c)) jar.delete(kv.slice(0, i)); else jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j, t };
  };
}
const admin = utente();
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CASI: VUOTA, WEB: process.env.WEB || path.join(QUI, '../web'),
    MODO: 'azienda', NOME_ISTANZA: 'Azienda di prova', CONTATTO: 'formazione@azienda.example' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  assert.equal((await admin('/api/accesso', { metodo: 'POST', corpo: { codice: 'admin-test-0000' } })).stato, 200);
});
after(() => { sim?.kill(); fs.rmSync(VUOTA, { recursive: true, force: true }); });

test('azienda: istanza, niente iscrizione libera né sponsor, nessun caso', async () => {
  const u = utente();
  const i = (await u('/api/istanza')).j;
  assert.deepEqual(i, { modo: 'azienda', nome: 'Azienda di prova', contatto: 'formazione@azienda.example' });
  const r = await u('/api/iscrizione', { metodo: 'POST', corpo: { nome: 'Mario Rossi', email: 'm@x.it', password: 'password-lunga-1', privacy: true, maggiorenne: true } });
  assert.equal(r.stato, 403); assert.match(r.j.errore, /invito/);
  assert.deepEqual((await u('/api/sponsor')).j, []);
  assert.deepEqual((await admin('/api/casi')).j, []);
});

test('azienda: invito per email, scelta della password, ruolo deciso dall\'amministratore', async () => {
  const r = await admin('/api/account', { metodo: 'POST', corpo: { nome: 'Anna Bianchi', email: 'anna@azienda.example', ruolo: 'specializzando', invita: true } });
  assert.equal(r.stato, 200, r.t); const id = r.j.account.id;
  assert.ok((await admin('/api/account')).j.find((a) => a.id === id).invitoInAttesa, 'invito in attesa nell\'elenco');
  let posta = await (await fetch(B + '/__posta')).json();
  let m = posta.filter((x) => x.a === 'anna@azienda.example').pop();
  assert.match(m.o, /Azienda di prova/);
  const codice = m.testo.match(/nuova-password\/([^\s]+)/)[1];
  // reinvio: il link precedente non vale più
  assert.equal((await admin(`/api/account/${id}/invito`, { metodo: 'POST' })).stato, 200);
  posta = await (await fetch(B + '/__posta')).json();
  const nuovo = posta.filter((x) => x.a === 'anna@azienda.example').pop().testo.match(/nuova-password\/([^\s]+)/)[1];
  const s = utente();
  assert.equal((await s('/api/password/nuova', { metodo: 'POST', corpo: { codice, password: 'una-password-1' } })).stato, 400, 'vecchio link non più valido');
  assert.equal((await s('/api/password/nuova', { metodo: 'POST', corpo: { codice: nuovo, password: 'una-password-1' } })).stato, 200);
  assert.equal((await s('/api/password/nuova', { metodo: 'POST', corpo: { codice: nuovo, password: 'altra-password-2' } })).stato, 400, 'link usato una sola volta');
  const e = utente();
  assert.equal((await e('/api/accesso', { metodo: 'POST', corpo: { email: 'anna@azienda.example', password: 'una-password-1' } })).stato, 200);
  assert.ok(!(await admin('/api/account')).j.find((a) => a.id === id).invitoInAttesa, 'invito concluso');
  assert.equal((await e('/api/io/profilo', { metodo: 'POST', corpo: { docente: true } })).stato, 403, 'non si diventa docenti da sé');
  assert.equal((await admin(`/api/account/${id}/invito`, { metodo: 'POST' })).stato, 400, 'niente invito a chi ha già la password');
  assert.equal((await admin('/api/account', { metodo: 'POST', corpo: { nome: 'Senza email', ruolo: 'docente', invita: true } })).stato, 400);
});
