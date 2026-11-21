import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19500 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });
const c = await (await b.newContext()).newPage();
c.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 300)));
c.on('requestfailed', (r) => console.log('fallita', r.url(), r.failure()?.errorText));
c.on('response', (r) => { if (/modelli-ia/.test(r.url())) console.log('risp', r.status(), r.url(), r.headers()['content-type']); });
await c.goto(B + '/licenze.html');
const r = await c.evaluate(async () => {
  try { const ort = await import('/modelli-ia/noduli-v1/ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = '/modelli-ia/noduli-v1/'; ort.env.wasm.numThreads = 1; 
    const buf = await (await fetch('/modelli-ia/noduli-v1/noduli.onnx')).arrayBuffer();
    const s = await ort.InferenceSession.create(buf, { executionProviders: ['webgpu'] }); const x = new Float32Array(192*192*80).fill(0.1); const tt = [];
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); const o = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1,1,192,192,80]) }); await o[s.outputNames[0]].getData?.(); tt.push(Math.round(performance.now() - t0)); }
    return 'ok ms ' + tt.join(',') + ' ' + (await navigator.gpu?.requestAdapter())?.info?.description;
  } catch (e) { return 'errore ' + e.message + ' ' + e.stack; }
});
console.log(r); await b.close(); sim.kill();
