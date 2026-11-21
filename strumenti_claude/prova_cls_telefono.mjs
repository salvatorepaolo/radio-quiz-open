// prova_cls_telefono.mjs: link diretto a un caso su un telefono lento (4G lenta, processore ×4): la pagina non deve saltare
// (CLS ≤ 0,1; prima della 1.293 l'elenco compariva e si riassestava: 0,25). Poi «indietro» deve mostrare l'elenco.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23581, B = `http://localhost:${PORTA}`, CASO = 'caso-tcia-001';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const acc = await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) });
const ck = (acc.headers.getSetCookie?.() || [])[0].split(';')[0].split('=');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, locale: 'it-IT' });
await ctx.addCookies([{ name: ck[0], value: ck.slice(1).join('='), url: B }]);
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: e.sources.map((s) => { const n = s.node; let id = '?'; if (n) { id = n.nodeName; if (n.id) id += '#' + n.id; else if (typeof n.className === 'string' && n.className) id += '.' + n.className.split(' ').slice(0, 2).join('.'); if (n.parentElement && !n.id) id += ' in ' + (n.parentElement.id ? '#' + n.parentElement.id : n.parentElement.className?.toString().split(' ')[0]); } return `${id} y${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`; }) }); }).observe({ type: 'layout-shift', buffered: true }); });
await p.goto(B + `/#/caso/${CASO}`); await p.waitForTimeout(25000);
const l = await p.evaluate(() => window.__ls); let t = 0; for (const e of l) { t += e.v; if (e.v > 0.005) console.log(`${e.t}ms ${e.v}  ${e.src.join(' | ')}`); } console.log('totale', t.toFixed(3));
const caso = await p.evaluate(() => !document.querySelector('#vista-caso').hidden);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(3000);
const elenco = await p.evaluate(() => !document.querySelector('#vista-elenco').hidden && getComputedStyle(document.querySelector('#vista-elenco')).display !== 'none' && !document.documentElement.classList.contains('apre-caso'));
const ok = t <= 0.1 && caso && elenco;
console.log(`${t <= 0.1 ? 'OK' : 'KO'}  spostamenti della pagina (CLS) ${t.toFixed(3)} (limite 0,1)`); console.log(`${caso ? 'OK' : 'KO'}  il caso si apre`); console.log(`${elenco ? 'OK' : 'KO'}  tornando indietro l'elenco è visibile`);
await b.close(); sim.kill(); process.exit(ok ? 0 : 1);
