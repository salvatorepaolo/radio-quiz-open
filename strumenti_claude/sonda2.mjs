import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const EP = process.argv[2] || 'webgpu', N = +(process.argv[3] || 1);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu'], headless: !!process.env.HL });
const c = await (await b.newContext()).newPage();
await c.goto('http://localhost:19777/licenze.html');
c.on('console', (m) => { if (/STADIO/.test(m.text())) console.log(m.text()); });
const r = await c.evaluate(async ([EP, N]) => {
  const log = (x) => console.log('STADIO ' + x); log('inizio');
  const ort = await import('/modelli-ia/noduli-v1/ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = '/modelli-ia/noduli-v1/'; ort.env.wasm.numThreads = 1;
  const a = await navigator.gpu?.requestAdapter(); log('adapter ' + JSON.stringify({ v: a?.info?.vendor, ar: a?.info?.architecture, d: a?.info?.description, fallback: a?.isFallbackAdapter }));
  const buf = await (await fetch('/modelli-ia/noduli-v1/noduli.onnx')).arrayBuffer();
  let t0 = performance.now(); const s = await ort.InferenceSession.create(buf, { executionProviders: [EP] }); log('creata ' + Math.round(performance.now() - t0));
  for (const [X, Z] of [[48, 16], [96, 40], [192, 80]].slice(0, N)) { const x = new Float32Array(X * X * Z).fill(0.1); t0 = performance.now(); await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', x, [1, 1, X, X, Z]) }); log(`run ${X}x${X}x${Z} ${Math.round(performance.now() - t0)} ms`); }
  return 'fine';
}, [EP, N]);
console.log(r); await b.close();
