// prova_zap.mjs: scansione di sicurezza automatica con OWASP ZAP (Apache-2.0) sul simulatore locale, mai sul sito vero.
// ZAP visita le pagine e le chiamate dell'API (anche con l'accesso del docente), poi prova gli attacchi comuni: iniezione
// di codice e di comandi, cross-site scripting, attraversamento delle cartelle, cookie e intestazioni insicure, file esposti.
// Il simulatore tiene tutto in memoria (nessuna scrittura su disco) e usa una copia di tre casi senza immagini.
// Fallisce se ZAP trova problemi di rischio alto o medio non spiegati qui sotto. Rapporto completo: /tmp/zap-rapporto.html
// Prerequisiti (una volta): ZAP in ~/.radioquiz-zap/ZAP_2.17.0, Java 21 (brew install openjdk@21).
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', WEB = '/Volumes/Caloggero/piattaforma-quiz/cloud/web', ORIG = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const ZAP = path.join(os.homedir(), '.radioquiz-zap/ZAP_2.17.0/zap.sh'), JAVA = '/opt/homebrew/opt/openjdk@21';
const PORTA = 19390 + Math.floor(Math.random() * 50), PZ = 18090 + Math.floor(Math.random() * 50), B = `http://localhost:${PORTA}`, API = `http://localhost:${PZ}`;
// avvisi accettati, con il motivo (il simulatore non è il sito vero: lì le intestazioni le mette CloudFront, controllate da controlla-sito.sh)
const ACCETTATI = {
  10038: 'CSP: sul sito la mette CloudFront (controlla-sito.sh); il simulatore non la imposta',
  10020: 'protezione dal framing: idem, intestazione di CloudFront',
  10035: 'HSTS: solo su HTTPS, il simulatore è in HTTP',
  10010: 'cookie senza Secure: il simulatore è in HTTP (sul sito il cookie è Secure, cfg.sicuro)',
  10098: 'CORS: il simulatore non imposta intestazioni CORS restrittive come CloudFront',
  10055: 'CSP con unsafe-eval e unsafe-inline negli stili: servono ai decodificatori delle immagini (codice caricato con new Function) e agli stili calcolati; limite noto, il resto della CSP è chiuso',
  10202: 'moduli senza gettone anti-CSRF: il cookie di sessione è SameSite=Lax e l\'API accetta solo JSON, quindi un altro sito non può inviare richieste con la sessione',
};
const CASI = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-casi-'));
for (const id of ['caso-tcia-001', 'caso-tcia-003', 'caso-tcia-109']) {
  fs.mkdirSync(path.join(CASI, id)); for (const f of ['caso.json', 'serie.json']) if (fs.existsSync(path.join(ORIG, id, f))) fs.copyFileSync(path.join(ORIG, id, f), path.join(CASI, id, f));
}
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const zap = spawn(ZAP, ['-daemon', '-port', String(PZ), '-host', '127.0.0.1', '-config', 'api.disablekey=true', '-config', 'database.recoverylog=false', '-newsession', path.join(os.tmpdir(), 'zap-sessione-' + PZ)],
  { env: { ...process.env, JAVA_HOME: JAVA, PATH: `${JAVA}/bin:${process.env.PATH}` }, stdio: ['ignore', 'ignore', 'ignore'], detached: true });
const fine = () => { try { process.kill(-zap.pid); } catch {} sim.kill(); fs.rmSync(CASI, { recursive: true, force: true }); };
const zapi = async (via, par = {}) => { const r = await fetch(`${API}/JSON/${via}/?${new URLSearchParams(par)}`); const j = await r.json(); if (!r.ok) throw new Error(`${via}: ${JSON.stringify(j)}`); return j; };
try {
  for (let i = 0; ; i++) { try { await zapi('core/view/version'); break; } catch { if (i > 90) throw new Error('ZAP non parte'); await new Promise((x) => setTimeout(x, 2000)); } }
  console.log('ZAP pronto; simulatore su', B);
  const acc = await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) });
  const cookie = (acc.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('accesso del docente non riuscito');
  await zapi('replacer/action/removeRule', { description: 'accesso' }).catch(() => {});   // regola rimasta da un giro precedente
  await zapi('replacer/action/addRule', { description: 'accesso', enabled: 'true', matchType: 'REQ_HEADER', matchRegex: 'false', matchString: 'Cookie', replacement: cookie });
  await zapi('context/action/newContext', { contextName: 'sim' }); await zapi('context/action/includeInContext', { contextName: 'sim', regex: `${B}.*` });
  // rotte dell'API prese dal codice della pagina (con un caso vero al posto delle variabili), più le pagine del sito
  const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8'), rotte = new Set();
  for (const m of src.matchAll(/[`'](\/api\/[^`'\s?]*)/g)) rotte.add(m[1].replace(/\$\{[^}]+\}/g, 'caso-tcia-001'));
  const pagine = ['/', '/?prova', ...fs.readdirSync(WEB).filter((f) => f.endsWith('.html')).map((f) => '/' + f), '/casi/caso-tcia-001/caso.json'];
  for (const u of [...pagine, ...rotte]) await zapi('core/action/accessUrl', { url: B + u, followRedirects: 'true' }).catch(() => {});
  // alcune richieste POST tipiche, perché ZAP le conosca e le attacchi
  const posta = [['/api/accesso', { codice: 'prova' }], ['/api/iscrizione', { nome: 'Prova', email: 'prova@esempio.test', password: 'passwordlunga1', ruolo: 'specializzando' }],
    ['/api/password/dimenticata', { email: 'prova@esempio.test' }], ['/api/casi/caso-tcia-001/risposta', { scelte: [0], sicurezza: {}, dettagli: { referto: 'testo' } }],
    ['/api/account', { nome: 'Persona Prova', ruolo: 'specializzando' }], ['/api/io/profilo', { nome: 'Nome' }]];
  for (const [u, corpo] of posta) await zapi('core/action/sendRequest', { request: `POST ${B}${u} HTTP/1.1\r\nHost: localhost:${PORTA}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(corpo)}`, followRedirects: 'false' }).catch((e) => console.log('POST', u, e.message.slice(0, 80)));
  const { scan: sp } = await zapi('spider/action/scan', { url: B + '/', contextName: 'sim', maxChildren: '50' });
  for (;;) { const { status } = await zapi('spider/view/status', { scanId: sp }); if (+status >= 100) break; await new Promise((x) => setTimeout(x, 2000)); }
  await zapi('ascan/action/setOptionMaxScanDurationInMins', { Integer: '25' }).catch(() => {});
  const { scan: as } = await zapi('ascan/action/scan', { url: B, recurse: 'true', inScopeOnly: 'false', contextId: '' });
  let ultimo = -1;
  for (;;) { const { status } = await zapi('ascan/view/status', { scanId: as }); if (+status >= 100) break; if (+status >= ultimo + 20) { console.log(`scansione attiva: ${status}%`); ultimo = +status; } await new Promise((x) => setTimeout(x, 5000)); }
  const r = await fetch(`${API}/OTHER/core/other/htmlreport/`); fs.writeFileSync('/tmp/zap-rapporto.html', await r.text());
  const { alerts } = await zapi('core/view/alerts', { baseurl: B, start: '0', count: '5000' });
  const per = new Map();
  for (const a of alerts) { const k = `${a.pluginId}|${a.risk}|${a.alert}`; if (!per.has(k)) per.set(k, { ...a, n: 0, url: new Set() }); const v = per.get(k); v.n++; v.url.add(a.url.replace(B, '')); }
  let gravi = 0;
  const ordine = { High: 0, Medium: 1, Low: 2, Informational: 3 }, nomi = { High: 'ALTO', Medium: 'medio', Low: 'basso', Informational: 'info' };
  for (const v of [...per.values()].sort((a, b) => ordine[a.risk] - ordine[b.risk])) {
    const acc = ACCETTATI[v.pluginId], grave = ['High', 'Medium'].includes(v.risk) && !acc;
    if (grave) gravi++;
    console.log(`${grave ? 'KO' : '  '}  [${nomi[v.risk]}] ${v.alert} (${v.pluginId}) ×${v.n}  ${[...v.url].slice(0, 3).join(' ')}${acc ? '  — accettato: ' + acc : ''}`);
  }
  console.log(`${alerts.length} avvisi, ${per.size} tipi; problemi alti o medi non spiegati: ${gravi}`);
  console.log(`ℹ pass ${gravi ? 0 : 1}\nℹ fail ${gravi ? 1 : 0}`);
  process.exitCode = gravi ? 1 : 0;
} catch (e) { console.log('KO  ' + e.message); console.log('ℹ pass 0\nℹ fail 1'); process.exitCode = 1; } finally { fine(); }
