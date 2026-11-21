// vetrini-worker.js — web worker che decodifica le tessere dei vetrini (JPEG 2000, JPEG-LS, JPEG lossless, RLE, …)
// fuori dal filo principale: lo scorrimento e lo zoom restano fluidi anche su computer lenti e tablet.
import { decodificaTessera } from './vetrini-dec.js';
self.onmessage = async (e) => {
  const { id, t, b, P } = e.data;
  try {
    const r = await decodificaTessera(t, new Uint8Array(b), P);
    // i pixel si trasferiscono senza copia (se il buffer è condiviso con il decodificatore, se ne fa una copia)
    let pix = r.pix; if (pix.byteOffset || pix.byteLength !== pix.buffer.byteLength) pix = pix.slice();
    self.postMessage({ id, t: { ...r, pix } }, [pix.buffer]);
  } catch (err) { self.postMessage({ id, errore: String(err?.message || err) }); }
};
