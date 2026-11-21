import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu'], headless: false });
const c = await (await b.newContext()).newPage();
await c.goto('http://localhost:19777/licenze.html');
const prof = [];
c.on('console', (m) => { const t = m.text(); if (/STADIO/.test(t)) console.log(t); else if (t.includes('"cat"') || t.includes('dur')) prof.push(t); });
await c.evaluate(async () => {
  const log = (x) => console.log('STADIO ' + x);
  const ort = await import('/modelli-ia/noduli-v1/ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = '/modelli-ia/noduli-v1/'; ort.env.wasm.numThreads = 1;
  const s = await ort.InferenceSession.create('/modelli-ia/noduli-v1/noduli.onnx', { executionProviders: ['wasm'], enableProfiling: true });
  const x = new Float32Array(96 * 96 * 40).fill(0.1); const t0 = performance.now();
  await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, 1, 96, 96, 40]) }); log('run ' + Math.round(performance.now() - t0));
  s.endProfiling(); await new Promise((r) => setTimeout(r, 2000));
});
console.log('righe profilo', prof.length); console.log(prof.slice(0, 3).join('\n').slice(0, 1500));
import('node:fs').then((fs) => fs.writeFileSync('/tmp/prof.txt', prof.join('\n')));
await new Promise((r) => setTimeout(r, 500)); await b.close();
