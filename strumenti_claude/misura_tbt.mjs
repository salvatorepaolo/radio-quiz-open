// misura_tbt.mjs: tempo bloccato (somma delle parti oltre 50 ms dei compiti lunghi) nei primi 15 s di un caso, telefono
// emulato (412 px, CPU ×4, rete 4G lenta). Uso: GIRI=3 node misura_tbt.mjs [caso]
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23471, B = `http://localhost:${PORTA}`, CASO = process.argv[2] || 'caso-tcia-001';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), out = [];
for (let g = 0; g < +(process.env.GIRI || 3); g++) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await p.addInitScript(() => { window.__lunghi = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lunghi.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); });
  await p.goto(B + '/#/caso/' + CASO); await p.waitForTimeout(15000);
  const l = await p.evaluate(() => window.__lunghi);
  const tbt = l.reduce((s, [, d]) => s + Math.max(0, d - 50), 0), max = Math.max(0, ...l.map((x) => x[1]));
  out.push(Math.round(tbt)); console.log(`giro ${g + 1}: blocco ${Math.round(tbt)} ms, compiti lunghi ${l.length}, il più lungo ${Math.round(max)} ms`);
  await ctx.close();
}
console.log('mediana', out.sort((a, b) => a - b)[out.length >> 1]); await b.close(); sim.kill();
