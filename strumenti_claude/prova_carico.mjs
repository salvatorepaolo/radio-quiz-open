// prova_carico.mjs: quante richieste regge l'API del sito vero (Lambda con al massimo 50 esecuzioni insieme, DynamoDB a richiesta).
// Gradini da 10 s a 5, 10, 20 e 40 richieste contemporanee (sotto il tetto di 50: chi usa il sito non viene rallentato).
// Accesso con il codice dell'amministratore (.segreti). Costo: qualche migliaio di chiamate, dentro la quota gratuita.
// Uso: node prova_carico.mjs [--gradini 5,10] [--secondi 10]
import fs from 'node:fs';
const B = 'https://radio-quiz.it', arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const GRADINI = arg('--gradini', '5,10,20,40').split(',').map(Number), SEC = +arg('--secondi', 10);
const codice = (fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^CODICE_AMMINISTRATORE="(.*)"/m) || [])[1];
const acc = await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice }) });
if (!acc.ok) { console.log('KO  accesso non riuscito: HTTP ' + acc.status); process.exit(1); }
const cookie = (acc.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
// richieste tipiche di chi usa il sito: chi sono, elenco dei casi, un caso
const INDIRIZZI = ['/api/io', '/api/casi', '/api/casi/caso-tcia-001'];
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const righe = [];
for (const n of GRADINI) {
  const ms = [], stati = {}; let fine = Date.now() + SEC * 1000, k = 0;
  const lavora = async () => { while (Date.now() < fine) { const u = INDIRIZZI[k++ % INDIRIZZI.length], t0 = performance.now();
    try { const r = await fetch(B + u, { headers: { cookie }, cache: 'no-store' }); await r.arrayBuffer(); stati[r.status] = (stati[r.status] || 0) + 1; if (r.ok) ms.push(performance.now() - t0); }
    catch (e) { stati.errore = (stati.errore || 0) + 1; } } };
  const t0 = Date.now(); await Promise.all(Array.from({ length: n }, lavora)); const durata = (Date.now() - t0) / 1000;
  ms.sort((a, b) => a - b); const tot = Object.values(stati).reduce((a, b) => a + b, 0), ok = ms.length;
  const r = { insieme: n, richieste: tot, al_secondo: +(tot / durata).toFixed(1), mediana_ms: Math.round(pct(ms, 0.5)), p95_ms: Math.round(pct(ms, 0.95)), max_ms: Math.round(ms.at(-1) || 0), riuscite: ok, stati };
  righe.push(r); console.log(`${String(n).padStart(3)} insieme: ${r.richieste} richieste, ${r.al_secondo}/s, mediana ${r.mediana_ms} ms, 95% sotto ${r.p95_ms} ms, max ${r.max_ms} ms, esiti ${JSON.stringify(stati)}`);
  await new Promise((r) => setTimeout(r, 3000));
}
fs.writeFileSync(new URL('./carico-ultimo.json', import.meta.url), JSON.stringify({ data: new Date().toISOString(), righe }, null, 1) + '\n');
const male = righe.filter((r) => r.riuscite < r.richieste);
console.log(male.length ? `⚠ richieste non riuscite: ${male.map((r) => `${r.insieme} insieme → ${r.richieste - r.riuscite}`).join(', ')}` : 'OK  tutte le richieste riuscite');
