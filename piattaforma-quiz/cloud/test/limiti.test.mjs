// Test dei limiti della piattaforma di un cliente: numero massimo di utenti, scadenza del servizio, sospensione.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const sims = [];
async function avvia(env) {
  const PORTA = await portaLibera(), B = `http://localhost:${PORTA}`, VUOTA = fs.mkdtempSync(path.join(os.tmpdir(), 'casi-lim-'));
  const sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CASI: VUOTA, WEB: process.env.WEB || path.join(QUI, '../web'),
    MODO: 'azienda', NOME_ISTANZA: 'Azienda limiti', CONTATTO: 'ref@azienda.example', ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  sims.push(sim);
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const utente = () => { const jar = new Map(); return async (u, { metodo = 'GET', corpo } = {}) => {
    const r = await fetch(B + u, { method: metodo, headers: { 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { stato: r.status, j }; }; };
  return utente;
}
after(() => sims.forEach((s) => s.kill()));

test('limite di utenti del piano', async () => {
  const utente = await avvia({ UTENTI_MAX: '2' }); const admin = utente();
  assert.equal((await admin('/api/accesso', { metodo: 'POST', corpo: { codice: 'admin-test-0000' } })).stato, 200);
  assert.equal((await utente()('/api/istanza')).j.utentiMax, 2);
  for (const n of ['Uno', 'Due']) assert.equal((await admin('/api/account', { metodo: 'POST', corpo: { nome: n, ruolo: 'specializzando' } })).stato, 200);
  const r = await admin('/api/account', { metodo: 'POST', corpo: { nome: 'Tre', ruolo: 'specializzando' } });
  assert.equal(r.stato, 400); assert.match(r.j.errore, /Limite del piano/);
});

test('servizio scaduto o sospeso: entra solo l\'amministratore', async () => {
  for (const env of [{ SCADENZA: '2020-01-31' }, { SOSPESA: '1' }]) {
    const utente = await avvia(env); const admin = utente();
    assert.equal((await utente()('/api/istanza')).j.blocco, env.SOSPESA ? 'sospesa' : 'scaduta');
    assert.equal((await admin('/api/accesso', { metodo: 'POST', corpo: { codice: 'admin-test-0000' } })).stato, 200);
    const cod = (await admin('/api/account', { metodo: 'POST', corpo: { nome: 'Studente', ruolo: 'specializzando' } })).j.codice;
    assert.ok(cod);
    const s = utente(), r = await s('/api/accesso', { metodo: 'POST', corpo: { codice: cod } });
    assert.equal(r.stato, 403); assert.match(r.j.errore, env.SOSPESA ? /sospesa/ : /terminato il 31\/01\/2020/);
    assert.equal((await admin('/api/account')).stato, 200);   // l'amministratore lavora ancora (esportazione dei dati)
  }
});
