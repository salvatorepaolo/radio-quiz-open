// prova_vetrini_chiave_sito.mjs (1.294): immagini chiave e referto dei vetrini nella piattaforma (simulatore locale), su un caso
// di solo vetrino: 📸 / tasto K → la vista del vetrino va nelle chiavi inviate al docente (pulite dal server come nell'API);
// tasto I → misure nella risposta del quiz; 📝 → referto con il modello di anatomia patologica; il docente riapre la vista.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const { pulisciDettagli } = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/api/logica.mjs');
const PORTA = +process.env.PORTA_PROVA || 23617, B = `http://localhost:${PORTA}`, CASO = process.env.CASO || 'caso-tcia-136';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage(), err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => d.accept());
const E = (f, a) => p.evaluate(f, a);
try {
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + `/?prova#/caso/${CASO}`);
  await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 90000 }); await p.waitForTimeout(2500);
  esito(await p.isVisible('#vt-incorporato .vt-chiave') && await p.isVisible('#vt-incorporato .vt-ritaglia') && await p.isVisible('#vt-incorporato .vt-referto'), 'caso di solo vetrino: pulsanti Chiave, Ritaglia e Referto');
  await p.click('#vt-incorporato .vt-ingr[data-m="4"]'); await p.waitForTimeout(1500);
  const R = await E(() => { const e = document.querySelector('#vt-incorporato .vt-misure').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  await p.click('#vt-incorporato .vt-s[data-s="dist"]'); await p.mouse.move(R.x - 50, R.y); await p.mouse.down(); await p.mouse.move(R.x + 50, R.y, { steps: 5 }); await p.mouse.up(); await p.keyboard.press('Escape');
  await p.keyboard.press('k'); await p.waitForTimeout(600);
  const st = await E(() => ({ ic: window.__dbg.IC.lista.length, vt: window.__dbg.IC.lista[0]?.vt, chiavi: window.__dbg.V.chiavi, inviate: window.__dbg.dettagliTraccia().chiavi }));
  esito(st.ic === 1 && st.vt && st.chiavi?.[0]?.vt, 'tasto K → immagine chiave con la vista del vetrino', JSON.stringify(st.vt));
  const pul = pulisciDettagli({ chiavi: st.inviate }).chiavi;
  esito(pul.length === 1 && pul[0].vt?.um > 0 && pul[0].vt.c?.length === 2 && pul[0].s, 'chiave del vetrino accettata e pulita dal server', JSON.stringify(pul[0]));
  const finta = pulisciDettagli({ chiavi: [{ s: 'x', i: 1, vt: { i: 999, c: [-5, 'a', 3], um: -1, s: 1e9, r: 45, z: 'x', rit: [1, 2] } }] }).chiavi[0].vt;
  esito(finta.i === 50 && finta.c[0] === 0 && finta.r === 0 && finta.s === 10000 && !finta.rit && finta.um === undefined, 'valori fuori dai limiti corretti dal server', JSON.stringify(finta));
  // misure nella risposta (tasto I)
  await p.keyboard.press('i'); await p.waitForTimeout(500);
  const testo = await E(() => document.querySelector('#q-referto')?.value || document.querySelector('#ref-testo')?.innerText || '');
  esito(/distanza \d/.test(testo), 'tasto I → distanza nella risposta', testo.slice(0, 120));
  // referto con il modello di anatomia patologica
  await p.click('#vt-incorporato .vt-referto'); await p.waitForSelector('#dlg-referto[open]', { timeout: 15000 }); await p.waitForTimeout(500);
  const mod = await E(() => [...document.querySelectorAll('#ref-modello option')].map((o) => o.value));
  esito(mod.includes('anatomia-patologica'), 'modello di anatomia patologica tra quelli del referto', mod.join(', '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // il docente riapre la vista
  const v0 = st.vt; await p.keyboard.press('0'); await p.waitForTimeout(1200);
  await E((k) => window.__dbg.vaiChiaveDoc(k), pul[0]); await p.waitForTimeout(1500);
  const v1 = await E(() => window.__dbg.VT.vista());
  esito(Math.abs(v1.c[0] - v0.c[0]) <= 3 && Math.abs(v1.c[1] - v0.c[1]) <= 3 && Math.abs(v1.um / v0.um - 1) < 0.02, 'il docente riapre la stessa vista del vetrino', `${JSON.stringify(v0)} / ${JSON.stringify(v1)}`);
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
