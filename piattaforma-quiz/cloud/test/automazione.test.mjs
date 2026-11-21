// Creazione automatica delle piattaforme dei clienti: avvio dal pannello, esito del lavoro AWS con il gettone monouso,
// lavoro fallito senza esito, smontaggio con conferma (simulatore con CREAZIONE_FINTA=1: niente AWS)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), B = `http://localhost:${PORTA}`;
let sim, ck = '';
const api = async (p, corpo, cookie = ck) => { const r = await fetch(B + p, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers }; };
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CREAZIONE_FINTA: '1', CASI: path.join(QUI, '../../casi-free') }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
  const r = await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) });
  ck = (r.headers.get('set-cookie') || '').split(';')[0];
});
after(() => sim?.kill());
test('creazione automatica: avvio, esito con gettone, email, lavoro fallito, smontaggio', async () => {
  let r = await api('/api/tenant', { id: 'ospedale-prova', cliente: 'Ospedale di Prova', referenteEmail: 'ref@prova.example', utentiMax: 50 });
  assert.equal(r.s, 200); assert.equal(r.j.stato, 'da_creare');
  assert.equal((await api('/api/tenant')).j.automatica, true);
  r = await api('/api/tenant/ospedale-prova/avvia', {}); assert.equal(r.s, 200); assert.equal(r.j.stato, 'in_corso'); assert.equal(r.j.lavoro.azione, 'crea'); assert.equal(r.j.lavoro.token, undefined);
  assert.equal((await api('/api/tenant/ospedale-prova/avvia', {})).s, 409);                       // un solo lavoro alla volta
  const lav = (await api('/__lavori')).j['ospedale-prova'];
  assert.equal(lav.azione, 'crea'); assert.equal(lav.tenant.dominio, 'ospedale-prova.' + lav.tenant.zona); assert.ok(lav.token.length > 20);
  // esito: senza gettone o con quello sbagliato no; anche senza sessione con quello giusto sì
  assert.equal((await api('/api/tenant/ospedale-prova/esito', { token: 'sbagliato', stato: 'attiva' }, '')).s, 403);
  r = await api('/api/tenant/ospedale-prova/esito', { token: lav.token, stato: 'attiva', versione: '1.999', invitato: true, log: 'tutto bene' }, '');
  assert.equal(r.s, 200);
  assert.equal((await api('/api/tenant/ospedale-prova/esito', { token: lav.token, stato: 'attiva' }, '')).s, 403);   // gettone monouso
  let t = (await api('/api/tenant')).j.elenco.find((x) => x.id === 'ospedale-prova');
  assert.equal(t.stato, 'attiva'); assert.equal(t.creata, true); assert.ok(t.invitato); assert.equal(t.versione, '1.999'); assert.equal(t.registro, 'tutto bene');
  const posta = (await api('/__posta')).j; assert.ok(posta.some((m) => m.a === 'info@prova.example' && /creazione completato/.test(m.o)));
  // non si toglie una piattaforma creata
  assert.equal((await api('/api/tenant/ospedale-prova/elimina', {})).s, 400);
  // aggiornamento: lavoro AWS fallito senza esito → errore
  await api('/api/tenant/ospedale-prova', { stato: 'da_aggiornare' });
  r = await api('/api/tenant/ospedale-prova/avvia', {}); assert.equal(r.j.lavoro.azione, 'aggiorna');
  await api('/__lavori/fallito');
  t = (await api('/api/tenant')).j.elenco.find((x) => x.id === 'ospedale-prova'); assert.equal(t.stato, 'errore'); assert.match(t.errore, /non riuscito/);
  // smontaggio: serve l'identificativo come conferma
  await api('/api/tenant/ospedale-prova', { stato: 'da_smontare' });
  assert.equal((await api('/api/tenant/ospedale-prova/avvia', {})).s, 400);
  r = await api('/api/tenant/ospedale-prova/avvia', { conferma: 'ospedale-prova' }); assert.equal(r.j.lavoro.azione, 'smonta');
  const lav2 = (await api('/__lavori')).j['ospedale-prova'];
  assert.equal((await api('/api/tenant/ospedale-prova/esito', { token: lav2.token, stato: 'smontata' }, '')).s, 200);
  t = (await api('/api/tenant')).j.elenco.find((x) => x.id === 'ospedale-prova'); assert.equal(t.stato, 'smontata'); assert.equal(t.creata, false);
  assert.equal((await api('/api/tenant/ospedale-prova/elimina', {})).s, 200);
  // gli utenti non amministratori non avviano nulla
  assert.ok([401, 403].includes((await api('/api/tenant/ospedale-prova/avvia', {}, '')).s));
});
