// Account: rendere amministratore un utente (con avviso email) e password dimenticata (dall'utente e dall'amministratore)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), B = `http://localhost:${PORTA}`;
let sim, ck = '';
const api = async (p, corpo, cookie = ck) => { const r = await fetch(B + p, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get('set-cookie') || '').split(';')[0] }; };
const ultimoLink = async (a) => { const p = (await api('/__posta')).j.filter((m) => m.a === a); const m = String(p[p.length - 1]?.testo || '').match(/nuova-password\/([\w.-]+)/); return { codice: m?.[1], oggetto: p[p.length - 1]?.o, n: p.length }; };
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CASI: path.join(QUI, '../../casi-free') }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
  ck = (await api('/api/accesso', { codice: 'admin-test-0000' }, '')).ck;
});
after(() => sim?.kill());
test('amministratore e password dimenticata', async () => {
  let r = await api('/api/account', { nome: 'Utente Prova', email: 'utente@prova.example', ruolo: 'specializzando', invita: true });
  assert.equal(r.s, 200); const id = r.j.account.id;
  assert.equal((await api(`/api/account/${id}/reset`, {})).s, 400);                       // niente password ancora: si usa l'invito
  let l = await ultimoLink('utente@prova.example'); assert.ok(l.codice, 'link dell\'invito');
  r = await api('/api/password/nuova', { codice: l.codice, password: 'Password-di-prova-1' }, ''); assert.equal(r.s, 200);
  // l'amministratore manda il link per una nuova password
  r = await api(`/api/account/${id}/reset`, {}); assert.equal(r.s, 200);
  l = await ultimoLink('utente@prova.example'); assert.ok(l.codice); assert.match(l.oggetto || '', /password/i);
  r = await api('/api/password/nuova', { codice: l.codice, password: 'Nuova-password-2' }, ''); assert.equal(r.s, 200);
  assert.equal((await api('/api/password/nuova', { codice: l.codice, password: 'Altra-password-3' }, '')).s, 400);   // link monouso
  // password dimenticata dalla pagina di accesso (stessa risposta anche per indirizzi sconosciuti)
  const n0 = (await ultimoLink('utente@prova.example')).n;
  await new Promise((ok) => setTimeout(ok, 50));
  r = await api('/api/password/dimenticata', { email: 'nessuno@prova.example' }, ''); assert.equal(r.s, 200);
  // rendere amministratore: avviso per email e ruolo nell'elenco
  r = await api(`/api/account/${id}`, { ruolo: 'admin' }); assert.equal(r.s, 200);
  const posta = (await api('/__posta')).j; assert.ok(posta.some((m) => m.a === 'utente@prova.example' && /amministratore/i.test(m.o)));
  assert.equal((await api('/api/account')).j.find((a) => a.id === id).ruolo, 'admin');
  r = await api(`/api/account/${id}`, { ruolo: 'docente' }); assert.equal((await api('/api/account')).j.find((a) => a.id === id).ruolo, 'docente');
  assert.ok(n0 >= 2);
});
