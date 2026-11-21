// prova_detta_raw.mjs: riconoscimento della voce «nudo» in Chrome (profilo di prova) su una pagina data — uso: node prova_detta_raw.mjs URL
import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const ctx = await chromium.launchPersistentContext('/tmp/rq-detta-prof', { channel: 'chrome', headless: false, ignoreDefaultArgs: ['--disable-component-update'], args: ['--use-fake-ui-for-media-stream'] });
const c = ctx.pages()[0] || await ctx.newPage();
await c.goto(process.argv[2]); await c.waitForTimeout(2000);
console.log('PRONTO');
console.log('RAW', await c.evaluate(() => new Promise((ris) => { const ev = []; const r = new SpeechRecognition(); r.lang = 'it-IT'; r.continuous = true; r.interimResults = true; r.processLocally = true;
  ['start', 'audiostart', 'speechstart', 'speechend', 'end'].forEach((k) => r.addEventListener(k, () => ev.push(k))); r.onerror = (e) => ev.push('ERR:' + e.error);
  r.onresult = (e) => { const x = e.results[e.results.length - 1]; ev.push((x.isFinal ? 'FIN:' : 'int:') + x[0].transcript.slice(0, 40)); }; r.start(); setTimeout(() => { r.stop(); setTimeout(() => ris(ev.join(' | ')), 1500); }, 15000); })));
await ctx.close();
