// controllo_quotidiano.mjs: controllo automatico del sito vero (radio-quiz.it), due volte al giorno (launchd sul Mac).
// Non modifica nulla: solo letture, come un visitatore e come l'amministratore.
// Controlla: pagine e file principali (con i tempi), intestazioni di sicurezza, certificato, API riservate chiuse a chi non
// ha fatto l'accesso, bozze non raggiungibili, testi vietati, accesso, apertura di tre casi con le immagini (uno fisso e due
// che cambiano ogni giorno), visualizzatore client, strumenti 3D.
// Scrive /tmp/controllo_quotidiano.txt ed esce con 1 se qualcosa non va (controllo_quotidiano.sh avvisa per email).
import { createRequire } from 'node:module'; import fs from 'node:fs'; import tls from 'node:tls';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const B = process.env.SITO || 'https://radio-quiz.it', HOST = new URL(B).hostname;
const codice = (fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^CODICE_AMMINISTRATORE="(.*)"/m) || [])[1];
const problemi = [], note = [];
const tempo = async (u, opz = {}) => { const t0 = Date.now(); try { const r = await fetch(B + u, { cache: 'no-store', redirect: 'manual', ...opz }); return { r, ms: Date.now() - t0 }; } catch (e) { return { errore: e.message, ms: Date.now() - t0 }; } };

// 1. pagine e file principali, con i tempi di risposta
const v = await (await tempo('/versione.json')).r?.json().catch(() => null);
note.push(`versione online: ${v?.versione || '?'}`);
const lenti = [];
for (const u of ['/', '/app.js', '/style.css', '/i18n.js', '/lingua/en.json', '/lingua/casi/_titoli.json', '/manuale-client.html', '/licenze.html', '/api/istanza', '/client/index.html', '/client/sw.js', '/client/manifest.json', '/lib/mpr3d.js']) {
  const x = await tempo(u);
  if (x.errore) problemi.push(`${u}: non raggiungibile (${x.errore})`);
  else if (!x.r.ok) problemi.push(`${u}: HTTP ${x.r.status}`);
  else if (x.ms > 5000) lenti.push(`${u} ${(x.ms / 1000).toFixed(1)} s`);
  if (u === '/lingua/en.json' && x.r?.ok) { try { const j = await x.r.json(); if (Object.keys(j).length < 1000) problemi.push(`/lingua/en.json: solo ${Object.keys(j).length} frasi tradotte`); } catch { problemi.push('/lingua/en.json: JSON non valido'); } }
  if (u === '/lib/mpr3d.js' && x.r?.ok && Number(x.r.headers.get('content-length') || 1e9) < 500000) problemi.push('/lib/mpr3d.js: file troppo piccolo (modulo 3D incompleto?)');
}
if (lenti.length) problemi.push(`risposte lente (oltre 5 s): ${lenti.join(', ')}`);

// 2. intestazioni di sicurezza della pagina principale
{ const x = await tempo('/');
  const h = x.r?.headers;
  if (h) for (const [k, re] of [['content-security-policy', /default-src 'self'/], ['strict-transport-security', /max-age=\d{7,}/], ['x-content-type-options', /nosniff/], ['x-frame-options', /DENY|SAMEORIGIN/], ['referrer-policy', /./]])
    if (!re.test(h.get(k) || '')) problemi.push(`intestazione di sicurezza mancante o cambiata: ${k}`);
  // pagine raggiunte da link del sito (il manuale del client si apre da /client/ anche prima che parta il service worker)
  for (const u of ['/client/', '/client/manuale-client.html', '/client/manuale-client.en.html', '/manuale-client.html', '/qualita.html', '/qualita.en.html', '/licenze.html']) {
    const st = (await tempo(u)).r?.status; if (st !== 200) problemi.push(`${u}: risponde ${st || 'nulla'}`); }
  // autore: il nome compare solo come firma (piede e crediti, scelta del 21/11); nessuna email diversa da quelle @radio-quiz.it
  for (const u of ['/', '/licenze.html', '/manuale-client.html']) { const t = await (await tempo(u)).r?.text().catch(() => '') || '';
    if (u !== '/manuale-client.html' && !/realizzato dall'<b>Ing\. Salvatore Paolo Buemi<\/b>/.test(t)) problemi.push(`${u}: manca la firma dell'autore`);
    const altre = [...new Set(t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [])].filter((e) => !/@radio-quiz\.it$/i.test(e) && !/^(nome|esempio|mario\.rossi)@/i.test(e) && !/@(example|esempio)\./i.test(e));
    if (altre.length) problemi.push(`${u}: email non del sito: ${altre.join(', ')}`); }
}

// 3. certificato HTTPS: almeno 21 giorni di validità
await new Promise((ok) => { const s = tls.connect(443, HOST, { servername: HOST, timeout: 15000 }, () => {
  const c = s.getPeerCertificate(), giorni = Math.floor((new Date(c.valid_to) - Date.now()) / 864e5);
  note.push(`certificato valido ancora ${giorni} giorni`); if (giorni < 21) problemi.push(`il certificato HTTPS scade tra ${giorni} giorni`); s.end(); ok(); });
  s.on('error', (e) => { problemi.push('certificato: ' + e.message); ok(); }); s.on('timeout', () => { problemi.push('certificato: nessuna risposta'); s.destroy(); ok(); }); });

// 4. senza accesso, dati e casi devono restare chiusi
for (const u of ['/api/casi', '/api/io/progressi', '/api/io/statistiche', '/api/io/temi', '/api/account', '/api/impostazioni', '/api/casi/caso-tcia-001/atteso', '/api/riepilogo-mensile', '/casi/caso-tcia-001/caso.json', '/casi/caso-tcia-001/serie.json']) {
  const x = await tempo(u); if (x.r && ![401, 403, 404].includes(x.r.status)) problemi.push(`SICUREZZA: ${u} risponde ${x.r.status} senza accesso`);
}

// 5. come amministratore nel browser: elenco, bozze, testi vietati, tre casi con le immagini, client
const b = await chromium.launch();
const segui = (p, dove) => {
  p.on('pageerror', (e) => problemi.push(`[${dove}] errore JavaScript: ${e.message} (${(e.stack || '').split('\n')[1]?.trim() || ''} su ${p.url().replace(B, '')})`));
  p.on('response', (r) => { if (r.status() >= 500) problemi.push(`[${dove}] ${r.status()} ${r.url().replace(B, '')}`); });
};
try {
  for (const [loc, atteso] of [['it-IT', /Accedi|Entra|codice/i], ['en-US', /Sign in|Log in|code/i]]) {
    const ctx = await b.newContext({ locale: loc }); const p = await ctx.newPage(); segui(p, 'accesso ' + loc);
    await p.goto(B + '/', { waitUntil: 'load', timeout: 45000 }); await p.waitForTimeout(2500);
    if (!atteso.test(await p.evaluate(() => document.body.innerText))) problemi.push(`[accesso ${loc}] la pagina non mostra il testo atteso`);
    await ctx.close();
  }
  if (codice) {
    const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); segui(p, 'amministratore');
    await p.goto(B + '/#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
    await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 30000 }).catch(() => problemi.push('[accesso] la home non si apre dopo l\'accesso'));
    await p.waitForTimeout(2500);
    const casi = await p.evaluate(() => fetch('/api/casi').then((r) => r.json()).catch(() => []));
    const vis = casi.filter((c) => c.visibile !== false), bozze = casi.filter((c) => c.visibile === false);
    note.push(`${vis.length} casi visibili, ${bozze.length} bozze`);
    if (vis.length < 50) problemi.push(`[home] solo ${vis.length} casi visibili`);
    const vietati = casi.filter((c) => /confermat[oa] dal docente/i.test(JSON.stringify(c))); if (vietati.length) problemi.push(`testo vietato «confermato dal docente» in: ${vietati.map((c) => c.id).join(', ')}`);
    // una bozza non deve aprirsi senza accesso
    if (bozze[0]) { const x = await tempo(`/api/casi/${encodeURIComponent(bozze[0].id)}`); if (x.r?.ok) problemi.push(`SICUREZZA: la bozza ${bozze[0].id} si apre senza accesso`); }
    // tre casi: uno fisso, due che cambiano ogni giorno
    const g = Math.floor(Date.now() / 864e5), scelti = ['caso-tcia-001', ...[0, 1].map((k) => vis[(g * 7 + k * 31) % Math.max(1, vis.length)]?.id)].filter(Boolean);
    for (const id of [...new Set(scelti)]) {
      await p.goto(B + '/#/'); await p.waitForTimeout(500);
      await p.goto(B + '/#/caso/' + encodeURIComponent(id));
      const aperto = await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }).then(() => true).catch(() => false);
      if (!aperto) { problemi.push(`[${id}] il caso non si apre`); continue; }
      // immagine disegnata: tela non vuota (2D o WebGL), entro 25 s
      let pix = 0; for (let k = 0; k < 10 && !pix; k++) { await p.waitForTimeout(2500); pix = await p.evaluate(() => { for (const c of document.querySelectorAll('#vista-caso #stage canvas, #vista-caso canvas')) { if (!c.width || !c.offsetWidth) continue; try { const t = document.createElement('canvas'); t.width = 64; t.height = 64; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; if (s > 5000) return 1; } catch {} } return 0; }); }
      if (!pix) problemi.push(`[${id}] le immagini del caso non si vedono`);
      const serie = await p.evaluate(() => document.querySelectorAll('#lista-serie .s').length); if (!serie) problemi.push(`[${id}] nessuna serie nella barra`);
    }
    note.push(`casi aperti: ${[...new Set(scelti)].join(', ')}`);
    // vetrino del caso 003: si apre, le tessere si vedono e si scaricano solo poche parti del file (1,7 GB)
    { let byte = 0, intere = 0; const conta = (r) => { if (!r.url().includes('/vetrino/')) return; if (r.status() === 200 && /livello_[01]\.dcm/.test(r.url())) intere++; r.body().then((b) => { byte += b.length; }).catch(() => {}); };
      p.on('response', conta);
      await p.goto(B + '/#/'); await p.waitForTimeout(500); await p.goto(B + '/#/caso/caso-tcia-003');
      const btn = await p.waitForSelector('#btn-vetrini:not([hidden])', { timeout: 30000 }).catch(() => null);
      if (!btn) problemi.push('[vetrino] il pulsante del vetrino non compare nel caso 003');
      else {
        await btn.click(); let col = 0, secondo = false;
        // 27/11: se il tessuto non si vede (una volta 0 byte scaricati, Mac appena svegliato) si riapre il caso e si riprova una volta
        for (let k = 0; k < 24 && col < 0.05; k++) { if (k === 12) { secondo = true; await p.goto(B + '/#/'); await p.waitForTimeout(1000); await p.goto(B + '/#/caso/caso-tcia-003'); const b2 = await p.waitForSelector('#btn-vetrini:not([hidden])', { timeout: 30000 }).catch(() => null); if (!b2) break; await b2.click(); }
          await p.waitForTimeout(2500); col = await p.evaluate(() => { for (const c of document.querySelectorAll('.vista-vetrino canvas, #vista-vetrino canvas')) { if (!c.width || !c.offsetWidth) continue; try { const t = document.createElement('canvas'); t.width = 64; t.height = 64; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) n++; if (n) return n / 4096; } catch {} } return 0; }); }
        if (col < 0.05) problemi.push('[vetrino] il tessuto del vetrino non si vede');
        if (intere) problemi.push(`[vetrino] ${intere} file del vetrino scaricati interi invece che a parti`);
        if (byte > 80e6) problemi.push(`[vetrino] scaricati ${(byte / 1e6).toFixed(0)} MB per aprire il vetrino`);
        note.push(`vetrino: ${Math.round(col * 100)}% di tessuto colorato, ${(byte / 1e6).toFixed(1)} MB scaricati${secondo && col >= 0.05 ? ' (visto solo al secondo tentativo)' : ''}`);
      }
      p.off('response', conta); }
    await ctx.close();
  } else problemi.push('codice amministratore non trovato in .segreti: accesso non controllato');
  { const ctx = await b.newContext({ locale: 'it-IT' }); const p = await ctx.newPage(); segui(p, 'client');
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 60000 }).catch(() => problemi.push('[client] il visualizzatore scaricabile non si apre'));
    await ctx.close(); }
} catch (e) { problemi.push('controllo interrotto: ' + e.message); }
await b.close();
// 6. firewall (1.293): la regola «limite-api-per-indirizzo» (3000 chiamate /api/ in 5 minuti per indirizzo) per ora conta soltanto.
// Se resta a zero per qualche giorno si può passare al blocco; se conta richieste di uso normale (es. un'aula dietro un solo indirizzo), alzare il limite.
try {
  const { execFileSync } = await import('node:child_process');
  const acl = (fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^WEB_ACL="?([^"\n]*)/m) || [])[1] || '';
  const nome = acl.split('/').at(-2);
  if (nome) {
    const fine = new Date(), inizio = new Date(fine - 86400e3);
    const out = execFileSync('aws', ['cloudwatch', 'get-metric-statistics', '--region', 'us-east-1', '--namespace', 'AWS/WAFV2', '--metric-name', 'CountedRequests',
      '--dimensions', `Name=WebACL,Value=${nome}`, 'Name=Rule,Value=limite-api-per-indirizzo', '--start-time', inizio.toISOString(), '--end-time', fine.toISOString(),
      '--period', '86400', '--statistics', 'Sum', '--output', 'json'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: '/opt/homebrew/bin:' + process.env.PATH } });
    const n = JSON.parse(out).Datapoints.reduce((a, d) => a + d.Sum, 0);
    if (n > 0) problemi.push(`[firewall] la regola sul limite di chiamate per indirizzo avrebbe bloccato ${n} richieste nelle ultime 24 ore: controllare se erano uso normale`);
    else note.push('firewall: nessuna richiesta oltre il limite per indirizzo nelle ultime 24 ore');
  }
} catch (e) { note.push('firewall: conteggio non letto (' + e.message.split('\n')[0].slice(0, 80) + ')'); }
const testo = `Controllo automatico di ${B} (${new Date().toLocaleString('it-IT')}):\n` + (problemi.length ? [...new Set(problemi)].map((x) => '- ' + x).join('\n') : 'tutto a posto.') + '\n' + note.map((x) => '  · ' + x).join('\n');
fs.writeFileSync('/tmp/controllo_quotidiano.txt', testo + '\n'); console.log(testo);
process.exit(problemi.length ? 1 : 0);
