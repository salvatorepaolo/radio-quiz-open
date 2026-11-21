// prova_rete.mjs: rete assente, interrotta o lenta mentre uno studente risponde a un caso. La risposta non deve andare
// persa (scelte e referto restano), deve comparire un messaggio chiaro, il secondo tentativo deve riuscire, una rete lenta
// non deve far partire due invii. Uso: node prova_rete.mjs   (BROWSER=webkit|firefox per gli altri motori)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19560 + Math.floor(Math.random() * 80)), B = `http://localhost:${PORTA}/?prova`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d ? ' → ' + d : ''}`); };
const REFERTO = 'Prova di referto scritto prima che cada la rete: non deve andare perso.';
try {
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errori = [];
  // WebKit segnala come errori della pagina gli scaricamenti interrotti da un ricaricamento (passo 5): non sono del sito
  p.on('pageerror', (e) => { if (!/due to access control checks/.test(e.message)) errori.push(e.message); });
  await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const entra = async (codice) => { await p.goto(B + '#/'); await p.reload(); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 }); };
  await entra('admin-test-0000');
  const casi = (await p.evaluate(async () => (await (await fetch('/api/casi')).json()))).filter((c) => c.visibile !== false && ['RX', 'Mammografia', 'TC'].includes(c.modalita));
  const { codice } = await p.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Rete', ruolo: 'specializzando' }) })).json()));
  await ctx.clearCookies(); await entra(codice);

  // apre un caso e compila tutte le sezioni fino al pulsante di conferma, senza premerlo
  const prepara = async (id) => {
    await p.goto(B + `#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => { const cv = document.querySelector('#vista-caso canvas'); return cv && cv.width > 50; }, null, { timeout: 30000 });
    // il modulo del caso nuovo, una sezione alla volta, non quello già corretto del caso precedente
    await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && document.querySelector('#q-form .sezione:not([hidden]) input:not([disabled])') && document.querySelectorAll('#q-form .sezione:not([hidden])').length === 1, id, { timeout: 20000 });
    for (let k = 0; k < 15; k++) {
      const scelta = p.locator('#q-form .sezione:not([hidden]) .opz input').first();
      if (await scelta.count() && !(await scelta.isChecked())) { await scelta.check({ force: true }); await p.locator('#q-form .sezione:not([hidden]) .opz button[data-conf]').first().click({ force: true }).catch(() => {}); }
      await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
      await p.waitForTimeout(250); if (process.env.DEBUG_RETE) console.log('giro', id, k, await p.evaluate(() => [...document.querySelectorAll('#q-form .sezione')].map((s) => s.dataset.n + (s.hidden ? 'h' : 'V') + s.querySelectorAll('input:checked').length + '/' + s.querySelectorAll('input').length).join(' ')));
      if (await p.locator('#btn-conferma').isVisible()) break;
      const av = p.locator('#q-succ:not([hidden])'); if (await av.count()) await av.evaluate((e) => e.click()); else break;
    }
    if (await p.locator('#q-referto').isVisible()) await p.fill('#q-referto', REFERTO);
    return { scelte: await p.locator('#q-form .sezione input:checked').count(), referto: await p.locator('#q-referto').inputValue().catch(() => '') };
  };
  const conferma = () => p.locator('#btn-conferma').evaluate((e) => e.click());
  const testoEsito = () => p.locator('#q-esito').innerText().catch(() => '');
  const attendiEsito = (re, ms = 15000) => p.waitForFunction((s) => new RegExp(s).test(document.querySelector('#q-esito')?.textContent || ''), re.source, { timeout: ms }).then(() => true, () => false);

  // 1. rete assente al momento dell'invio
  const [c1, c2, c3] = casi;
  const prima = await prepara(c1.id);
  await ctx.setOffline(true); await conferma();
  esito(await attendiEsito(/Connessione assente/), 'senza rete: messaggio chiaro', (await testoEsito()).slice(0, 90));
  const dopo = { scelte: await p.locator('#q-form .sezione input:checked').count(), referto: await p.locator('#q-referto').inputValue().catch(() => '') };
  esito(dopo.scelte === prima.scelte && prima.scelte > 0, 'senza rete: le scelte restano', `${dopo.scelte}/${prima.scelte}`);
  esito(dopo.referto === prima.referto, 'senza rete: il referto resta');
  esito(await p.locator('#btn-conferma').isEnabled(), 'senza rete: il pulsante si può premere di nuovo');
  await ctx.setOffline(false); await conferma();
  esito(await attendiEsito(/\d+\s*%/), 'tornata la rete: il secondo tentativo riesce');

  // 2. connessione interrotta prima che la risposta arrivi al server
  await prepara(c2.id);
  let tagliate = 0;
  await p.route('**/api/casi/*/risposta', (r) => { if (!tagliate++) return r.abort('connectionreset'); return r.continue().catch(() => {}); });
  await conferma();
  esito(await attendiEsito(/Connessione assente/), 'connessione interrotta: messaggio chiaro');
  await conferma();
  esito(await attendiEsito(/\d+\s*%/), 'connessione interrotta: il secondo tentativo riesce');
  await p.unrouteAll({ behavior: 'wait' });

  // 3. rete lenta (4 s): un solo invio anche premendo più volte, poi l'esito
  await prepara(c3.id);
  let invii = 0;
  await p.route('**/api/casi/*/risposta', async (r) => { invii++; await new Promise((x) => setTimeout(x, 4000)); return r.continue().catch(() => {}); });
  await conferma(); await p.waitForTimeout(300); await conferma(); await conferma();
  { const v = await attendiEsito(/\d+\s*%/, 20000); esito(v, 'rete lenta: l\'esito arriva', v ? '' : c3.id + ' ' + (await testoEsito()).slice(0, 140)); }
  esito(invii === 1, 'rete lenta: un solo invio anche premendo tre volte', `${invii} invii`);
  await p.unrouteAll({ behavior: 'wait' });

  // 4. risposta registrata dal server ma persa per strada: il nuovo tentativo non deve dare un errore incomprensibile
  if (casi[3]) {
    await prepara(casi[3].id);
    let n = 0;
    await p.route('**/api/casi/*/risposta', async (r) => { if (!n++) { await r.fetch(); return r.abort('connectionreset'); } return r.continue().catch(() => {}); });
    await conferma();
    // WebKit a volte consegna comunque la risposta già scaricata: allora l'esito c'è subito e non serve riprovare
    const persa = await attendiEsito(/Connessione assente|\d+\s*%/) && /Connessione assente/.test(await testoEsito());
    if (persa) { await p.waitForFunction(() => !document.querySelector('#btn-conferma')?.disabled, null, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(300); await conferma(); }
    const ok4 = await attendiEsito(/\d+\s*%/);
    esito(ok4, 'risposta già registrata ma persa: il nuovo tentativo mostra l\'esito', ok4 ? '' : (await testoEsito()).slice(0, 120));
    await p.unrouteAll({ behavior: 'wait' });
  }

  // 5. accesso senza rete
  await ctx.clearCookies(); await p.goto(B + '#/'); await p.reload(); await p.click('[data-vai="codice"]');
  await ctx.setOffline(true); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
  await p.waitForTimeout(1500);
  const msg = await p.locator('#msg-accesso').innerText().catch(() => '');
  esito(/Connessione/i.test(msg), 'accesso senza rete: messaggio chiaro', msg.slice(0, 80));
  await ctx.setOffline(false);
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 300));
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
