// vetrini-dec.js — decodifica di una tessera di vetrino in valori dei pixel, senza DOM: la usa il web worker
// (vetrini-worker.js) e, se i worker non sono disponibili, la pagina stessa. Le tessere JPEG a colori e JPEG XL non passano
// di qui: le decodifica il browser con createImageBitmap, già fuori dal filo principale.
import { caricaCodec, decodificaCodec, decodificaRLE, CODEC } from './decodifica.js';
import { Decoder } from './lib/lossless-min.js';

function campioni(buf, bits, conSegno) {
  const ab = buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf;
  return bits > 8 ? (conSegno ? new Int16Array(ab) : new Uint16Array(ab)) : new Uint8Array(ab);
}
// t: tipo di compressione (jpeg, jpeg12, j2k, jls, lossless, rle, nativi); b: byte della tessera (Uint8Array);
// P: { w, h, spp, bits, conSegno, foto, piani }. Restituisce { pix, w, h, spp, bits }.
export async function decodificaTessera(t, b, P) {
  const { w, h, spp, bits, conSegno, foto, piani } = P, colore = spp === 3;
  if (t === 'jpeg' && !colore && bits <= 8) { await caricaCodec('jpeg'); return { pix: decodificaCodec('jpeg', b), w, h, spp: 1, bits: 8 }; }   // canale monocromatico
  if (t === 'jpeg' && colore) { await caricaCodec('jpeg'); return { pix: decodificaCodec('jpeg', b), w, h, spp, bits: 8 }; }   // libjpeg-turbo
  let pix;
  if (t === 'jpeg12' || t === 'jpeg') {
    await caricaCodec('jpegjs'); const J = new CODEC.jpegjs_pronto(); J.parse(b);
    pix = bits > 8 && !colore ? J.getData16(w, h) : J.getData(w, h);
    return { pix, w, h, spp, bits: bits > 8 && !colore ? 16 : 8 };
  }
  if (t === 'j2k' || t === 'jls') { await caricaCodec(t); pix = campioni(decodificaCodec(t, b), bits, conSegno); }
  else if (t === 'lossless') { const o = new Decoder().decompress(b.buffer, b.byteOffset, b.length); pix = campioni(o.buffer ? new Uint8Array(o.buffer, o.byteOffset, o.byteLength) : o, bits, conSegno); }
  else if (t === 'rle') pix = campioni(decodificaRLE(b, h, w, spp, bits), bits, conSegno);
  else if (t === 'nativi') {
    pix = campioni(b, bits, conSegno);
    if (colore && piani === 1) { const n = w * h, q = new pix.constructor(n * 3); for (let i = 0; i < n; i++) { q[i * 3] = pix[i]; q[i * 3 + 1] = pix[n + i]; q[i * 3 + 2] = pix[2 * n + i]; } pix = q; }
  } else throw new Error('compressione delle tessere non supportata');
  // colore non ancora RGB (dati non compressi o RLE in YBR_FULL): conversione
  if (colore && /^YBR_FULL/.test(foto || '') && (t === 'nativi' || t === 'rle')) for (let i = 0; i < pix.length; i += 3) {
    const Y = pix[i], Cb = pix[i + 1] - 128, Cr = pix[i + 2] - 128;
    pix[i] = Math.max(0, Math.min(255, Y + 1.402 * Cr)); pix[i + 1] = Math.max(0, Math.min(255, Y - 0.344136 * Cb - 0.714136 * Cr)); pix[i + 2] = Math.max(0, Math.min(255, Y + 1.772 * Cb));
  }
  return { pix, w, h, spp, bits };
}
