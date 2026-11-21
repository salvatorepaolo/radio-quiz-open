// Web worker di decodifica DICOM: riceve il file (e il fotogramma), restituisce l'immagine con i pixel trasferiti.
import { decodificaDicom, assicuraCodec } from './decodifica.js';
const pronto = (async () => {
  if (!self.dicomParser) { const t = await (await fetch(new URL('./lib/dicomParser.min.js', import.meta.url))).text(); new Function(t).call(self); }
})();
self.onmessage = async (e) => {
  const { id, buf, frame } = e.data;
  try {
    await pronto; await assicuraCodec(buf);
    const img = decodificaDicom(frame != null ? { buf, frame } : buf);
    const tr = [img.pix.buffer]; if (img.rgb && img.rgb.buffer !== img.pix.buffer) tr.push(img.rgb.buffer);
    self.postMessage({ id, img }, tr);
  } catch (err) { self.postMessage({ id, errore: String(err?.message || err) }); }
};
