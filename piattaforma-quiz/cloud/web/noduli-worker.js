// Worker di noduli-client.js: una copia del modello ONNX dei noduli (onnxruntime-web, WebAssembly, un thread)
let ort = null, s = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.modello) {
      ort = await import(m.cartella + 'ort.webgpu.min.mjs');
      ort.env.wasm.wasmPaths = m.cartella; ort.env.wasm.numThreads = 1;
      s = await ort.InferenceSession.create(m.modello, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ pronto: true }); return;
    }
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', m.dati, [1, 1, ...m.forma]) });
    const uscite = s.outputNames.map((n) => out[n].data);
    self.postMessage({ uscite }, [...new Set(uscite.map((u) => u.buffer))]);
  } catch (err) { self.postMessage({ errore: String(err?.message || err) }); }
};
