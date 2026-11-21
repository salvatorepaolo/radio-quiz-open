import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch({ headless: true });
const c = await (await b.newContext()).newPage();
await c.goto('http://localhost:19777/licenze.html');
c.on('console', (m) => { if (/STADIO/.test(m.text())) console.log(m.text()); });
await c.evaluate(async () => {
  const log = (x) => console.log('STADIO ' + x);
  const ort = await import('/modelli-ia/noduli-v1/ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = '/modelli-ia/noduli-v1/'; ort.env.wasm.numThreads = 1;
  for (const m of ['/modelli-ia/prova/noduli_int8q.onnx', '/modelli-ia/noduli-v1/noduli.onnx', '/modelli-ia/prova/noduli_int8.onnx']) {
    const s = await ort.InferenceSession.create(m, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    const x = new Float32Array(96 * 96 * 40); for (let i = 0; i < x.length; i++) x[i] = Math.random(); const tt = [];
    for (let i = 0; i < 2; i++) { const t0 = performance.now(); await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, 1, 96, 96, 40]) }); tt.push(Math.round(performance.now() - t0)); }
    log(m + ' ' + tt.join(',') + ' ms'); await s.release();
  }
});
await b.close();
