// prova_casi_vetrini.mjs: sezione «Vetrini» (1.274-1.275): pagina dedicata dal pulsante in alto (non nella pagina iniziale), il caso apre subito il
// vetrino nel riquadro del visualizzatore (prima della risposta), si risponde e si torna a un caso normale senza residui
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23491, B = `http://localhost:${PORTA}`, CASO = process.env.CASO || 'caso-tcia-141';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), errori = []; let ok = 0, ko = 0;
const esito = (c, t) => { console.log(`${c ? 'OK' : 'KO'}  ${t}`); c ? ok++ : ko++; };
const ctxA = await b.newContext({ locale: 'it-IT' }), pa = await ctxA.newPage();
const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }), p = await ctx.newPage();
p.on('pageerror', (e) => errori.push(e.message));
process.on('uncaughtException', (e) => { console.log('KO  ' + e.message.split('\n')[0]); sim.kill(); process.exit(1); });
// uno specializzando (i docenti vedono sempre i vetrini): account con codice, creato dall'amministratore nel simulatore
await pa.goto(B + '/?prova#/'); await pa.waitForSelector('[data-vai="codice"]'); await pa.click('[data-vai="codice"]'); await pa.fill('#codice', 'admin-test-0000'); await pa.press('#codice', 'Enter');
await pa.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
const cod = await pa.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente di prova', ruolo: 'specializzando' }) })).json()).codice);
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
await p.waitForTimeout(1500);
// dalla 1.298 i casi-vetrino hanno il loro filtro nell'elenco dei casi (prima erano solo nella pagina «Vetrini»)
esito(/Vetrini/.test(await p.textContent('#filtro-metodica')), 'filtro «Vetrini» nell\'elenco dei casi (1.298)', (await p.textContent('#filtro-metodica')).replace(/\s+/g, ' ').slice(0, 160));
esito(await p.$eval('#btn-vetrini-pagina', (x) => !x.hidden), 'pulsante «Vetrini» in alto');
await p.click('#btn-vetrini-pagina'); await p.waitForSelector('#vista-vetrini:not([hidden]) .card', { timeout: 15000 });
esito((await p.locator('#lista-vetrini .card').count()) >= 6, 'pagina «Vetrini» con i casi (almeno 6)');
await p.click(`#lista-vetrini .card[data-id="${CASO}"]`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
await p.waitForSelector('#vt-incorporato .openseadragon-canvas, #vt-incorporato canvas', { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(6000);
const st = await p.evaluate(() => { const b = document.querySelector('#vt-incorporato'), r = b?.getBoundingClientRect(), cv = b?.querySelector('canvas');
  let col = 0; if (cv) { try { const c = document.createElement('canvas'); c.width = 80; c.height = 60; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 80, 60); const d = x.getImageData(0, 0, 80, 60).data; for (let i = 0; i < d.length; i += 4) if (d[i] - d[i + 1] > 25 && d[i + 2] - d[i + 1] > 15) col++; } catch {} }
  return { c: !!b, w: r?.width | 0, h: r?.height | 0, solo: document.body.classList.contains('solo-vetrino'), col: col / 4800, bott: !document.querySelector('#btn-vetrini') || document.querySelector('#btn-vetrini').hidden,
    quiz: !!document.querySelector('.caso > aside.quiz input, .caso > aside.quiz button'), chiudi: b?.querySelector('.vt-chiudi')?.hidden };
});
esito(st.c && st.solo && st.w > 500 && st.h > 400, `vetrino nel riquadro del caso prima della risposta (${st.w}×${st.h})`);
esito(st.col > 0.08, `tessuto colorato visibile (${Math.round(st.col * 100)}% del riquadro)`);
esito(st.bott && st.chiudi, 'niente pulsante «Vetrino» flottante né «Chiudi» nel riquadro');
esito(st.quiz, 'domande del caso presenti');
await p.screenshot({ path: '/tmp/caso_vetrino.png' });
// risposta: la prima opzione di ogni sezione, poi conferma
const risposto = await p.evaluate(async () => { const s = [...document.querySelectorAll('aside.quiz input[type=checkbox], aside.quiz input[type=radio]')]; if (!s.length) return 'nessuna opzione'; s[0].click(); const r = s.find((x) => x.type === 'radio'); r?.click(); return s.length; });
esito(typeof risposto === 'number', 'opzioni cliccabili: ' + risposto);
// conferma: dopo la risposta compare la correlazione con la radiologia (1.276)
for (let k = 0; k < 15; k++) {   // come browser.test.mjs: una scelta per sezione, «Avanti», poi conferma
  await p.evaluate(() => { const i = [...document.querySelectorAll('#q-form input[type=checkbox], #q-form input[type=radio]')].find((x) => x.offsetParent); if (i && !i.checked) i.click(); i?.closest('.opz')?.querySelector('button[data-conf]')?.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
  const b = await p.$('#btn-conferma:not([hidden])'); if (b && await b.isVisible()) { await b.evaluate((e) => e.click()); break; }
  const av = await p.$('#q-succ:not([hidden])'); if (av) await av.evaluate((e) => e.click()); else break;
  await p.waitForTimeout(200);
}
await p.waitForSelector('.rassegna.correlazione', { timeout: 15000 }).catch(() => {});
const corr = await p.evaluate(() => document.querySelector('.rassegna.correlazione')?.innerText || '');
esito(/Correlazione con la radiologia/.test(corr) && /caso|TC|RM/.test(corr), 'dopo la risposta: «Correlazione con la radiologia» con i casi collegati');
// un caso radiologico dopo: nessun residuo del vetrino
await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-001' && window.__dbg.P(0)?.img, null, { timeout: 60000 }).catch(() => {});
esito(await p.evaluate(() => !document.querySelector('#vt-incorporato') && !document.body.classList.contains('solo-vetrino')), 'caso radiologico successivo senza il vetrino');
esito(!errori.length, 'nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''));
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
