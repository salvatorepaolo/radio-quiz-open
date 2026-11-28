// Segnalazioni e suggerimenti sul programma (28/11/2026), attraverso il simulatore. Nomi inventati.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim; const ck = { nessuno: '' };
const chiama = async (chi, url, corpo) => {
  const r = await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'user-agent': 'Prova/1.0', ...(ck[chi] ? { cookie: ck[chi] } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { stato: r.status, j };
};
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const entra = async (corpo) => (await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })).headers.get('set-cookie')?.split(';')[0] || '';
  ck.admin = await entra({ codice: 'admin-test-0000' });
  const spe = (await chiama('admin', '/api/account', { nome: 'Sara Segnala', ruolo: 'specializzando' })).j;
  ck.spec = await entra({ codice: spe.codice });
});
after(() => { sim?.kill(); });

test('segnalazioni: da ospite e da iscritto, robot ignorati, solo l\'amministratore le legge e le gestisce', async () => {
  assert.equal((await chiama('nessuno', '/api/segnalazioni', { tipo: 'idea', testo: 'ok' })).stato, 400, 'troppo corto');
  assert.equal((await chiama('nessuno', '/api/segnalazioni', { tipo: 'idea', testo: 'Comprami questo', sito: 'http://spam' })).stato, 200);
  assert.equal((await chiama('nessuno', '/api/segnalazioni', { tipo: 'idea', testo: 'Aggiungete i casi di <b>ecografia</b> pediatrica', email: 'Ospite@Esempio.it', pagina: '/#/elenco', versione: '1.355' })).stato, 200);
  assert.equal((await chiama('spec', '/api/segnalazioni', { tipo: 'boh', testo: 'Il pulsante Avanti non risponde', email: 'non@serve.it', pagina: '/#/caso/caso-tcia-001' })).stato, 200);
  // email al gestore: una per segnalazione (non per il robot), «Rispondi» verso chi ha scritto se ha un'email
  const posta = (await (await fetch(BASE + '/__posta')).json()).filter((m) => /nuova segnalazione/.test(m.o));
  assert.equal(posta.length, 2); assert.ok(posta.every((m) => m.a === 'info@prova.example'));
  const mo = posta.find((m) => /Suggerimento/.test(m.o)); assert.equal(mo.rispondiA, 'ospite@esempio.it'); assert.match(mo.testo, /ecografia/); assert.match(mo.testo, /Pagina: .*#\/elenco/);
  const ms = posta.find((m) => /Altro/.test(m.o)); assert.match(ms.testo, /Sara Segnala/); assert.match(ms.testo, /#\/segnalazioni/);
  assert.equal((await chiama('spec', '/api/segnalazioni')).stato, 403, 'lo studente non le legge');
  assert.equal((await chiama('nessuno', '/api/segnalazioni')).stato, 401);
  const l = (await chiama('admin', '/api/segnalazioni')).j;
  assert.equal(l.length, 2, 'il robot non entra');
  const sp = l.find((s) => s.account), os = l.find((s) => !s.account);
  assert.equal(sp.tipo, 'altro'); assert.equal(sp.chi.nome, 'Sara Segnala'); assert.equal(sp.email, undefined, 'dagli iscritti nessuna email salvata');
  assert.equal(sp.pagina, '/#/caso/caso-tcia-001'); assert.equal(sp.browser, 'Prova/1.0'); assert.equal(sp.stato, 'nuova');
  assert.equal(os.email, 'ospite@esempio.it'); assert.doesNotMatch(os.testo, /</); assert.equal(os.versione, '1.355');
  assert.equal((await chiama('spec', `/api/segnalazioni/${sp.id}/stato`, { stato: 'risolta' })).stato, 403);
  assert.equal((await chiama('admin', `/api/segnalazioni/${sp.id}/stato`, { stato: 'risolta', nota: 'corretto nella 1.356' })).stato, 200);
  assert.equal((await chiama('admin', '/api/segnalazioni/xx/stato', { stato: 'letta' })).stato, 404);
  let m = (await chiama('admin', '/api/segnalazioni')).j.find((s) => s.id === sp.id);
  assert.equal(m.stato, 'risolta'); assert.equal(m.nota, 'corretto nella 1.356');
  assert.equal((await chiama('admin', `/api/segnalazioni/${os.id}/elimina`, {})).stato, 200);
  assert.equal((await chiama('admin', '/api/segnalazioni')).j.length, 1);
  for (let i = 0; i < 9; i++) await chiama('spec', '/api/segnalazioni', { tipo: 'idea', testo: 'Idea numero ' + i });
  assert.equal((await chiama('spec', '/api/segnalazioni', { tipo: 'idea', testo: 'Una di troppo' })).stato, 429, 'al più 10 al giorno');
});
