import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu'], headless: false });
const c = await (await b.newContext()).newPage();
await c.goto('http://localhost:19777/licenze.html');
c.on('console', (m) => { if (/STADIO/.test(m.text())) console.log(m.text()); });
await c.evaluate(async () => {
  const log = (x) => console.log('STADIO ' + x);
  const ort = await import('/modelli-ia/noduli-v1/ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = '/modelli-ia/noduli-v1/'; ort.env.wasm.numThreads = 1;
  for (const nome of ['conv', 'norm']) for (const ep of ['webgpu', 'wasm']) {
    const s = await ort.InferenceSession.create(`/modelli-ia/micro/${nome}.onnx`, { executionProviders: [ep] });
    const x = new Float32Array(32 * 96 * 96 * 40).fill(0.1); const tt = [];
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); const o = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, 32, 96, 96, 40]) }); tt.push(Math.round(performance.now() - t0)); }
    log(`${nome} ${ep} ${tt.join(',')} ms`);
  }
});
await b.close();
