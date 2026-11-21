// prova_detta.mjs: dettatura del referto nel client con Google Chrome vero e audio finto (file WAV)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19800 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const prof = '/tmp/rq-detta-prof';
const ctx = await chromium.launchPersistentContext(prof, { channel: 'chrome', headless: false, ignoreDefaultArgs: ['--disable-component-update'], locale: 'it-IT', viewport: { width: 1300, height: 850 },
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/tmp/detta.wav'] });
await ctx.grantPermissions(['microphone'], { origin: B });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
const c = ctx.pages()[0] || await ctx.newPage(); const log = []; c.on('console', (m) => log.push(m.text())); c.on('pageerror', (e) => log.push('ERR ' + e.message)); c.on('dialog', (d) => d.accept());
try {
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  await c.setInputFiles('#cl-file', files.slice(0, 40));
  await c.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 120000 }); await c.waitForTimeout(1000);
  console.log('stato SR', await c.evaluate(async () => { const SR = window.SpeechRecognition; return [!!SR, await SR?.available?.({ langs: ['it-IT'], processLocally: true }).catch((e) => 'E' + e.message)]; }));
  if (process.env.RAW) console.log('RAW', await c.evaluate(() => new Promise((ris) => { const ev = []; const r = new SpeechRecognition(); r.lang = 'it-IT'; r.continuous = true; r.interimResults = true; r.processLocally = true;
    ['start', 'audiostart', 'speechstart', 'speechend', 'end'].forEach((k) => r.addEventListener(k, () => ev.push(k))); r.onerror = (e) => ev.push('ERR:' + e.error);
    r.onresult = (e) => { const x = e.results[e.results.length - 1]; ev.push((x.isFinal ? 'FIN:' : 'int:') + x[0].transcript.slice(0, 40)); }; r.start(); setTimeout(() => { r.stop(); setTimeout(() => ris(ev.join(' | ')), 1500); }, 15000); })));
  await c.evaluate(() => document.querySelector('#cl-referto').click()); await c.waitForTimeout(1500);
  console.log('referto aperto', await c.evaluate(() => !!document.querySelector('#dlg-referto')?.open || !!window.FIN_REF?.win));
  await c.evaluate(() => { const SR = window.SpeechRecognition; const P = SR.prototype; const st = P.start; P.start = function () { console.log('SR.start'); ['start','audiostart','speechstart','end','error','result'].forEach((k) => this.addEventListener(k, (e) => console.log('SR.' + k + (e.error ? ':' + e.error : '') + (e.results ? ':' + e.results[e.results.length - 1][0].transcript : '')))); return st.call(this); }; });
  await c.click('#ref-detta'); console.log('CLIC');
  for (let i = 0; i < 5; i++) { await c.waitForTimeout(5000); console.log('t' + i, await c.evaluate(async () => [document.querySelector('#ref-stato')?.textContent, await SpeechRecognition.available({ langs: ['it-IT'], processLocally: true })].join(' / '))); }
  
  console.log('stato', await c.evaluate(() => document.querySelector('#ref-stato')?.textContent));
  console.log('testo', await c.evaluate(() => (window.FIN_REF?.win?.document || document).querySelector('#ref-testo')?.innerText));
} finally { console.log(log.join('\n')); await ctx.close(); sim.kill(); }
