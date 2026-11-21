# decodifica in un modulo condiviso (pagina e web worker) + pool di worker
import sys, re
W = sys.argv[1]
src = open(W + '/app.js', encoding='utf-8').read()
a = src.index("const TS_LOSSLESS = [")
b = src.index("function decodificaDicom(buf, { grezzo = false, frame = 0 } = {}) {")
e = src.index("\n}\n", b) + 3
blocco = src[a:e]
eq = "// contrasto locale attivo per questa immagine: di serie nelle radiografie, il pulsante lo accende o lo spegne\nconst eqAttivo = (img) => !!img && !img.rgb && (V.eq ?? !!img.rx);\n"
assert eq in blocco
blocco = blocco.replace(eq, '')
# nel modulo: niente CLIENT, niente document nel worker
blocco = blocco.replace("    paziente: CLIENT ? {", "    paziente: CON_PAZIENTE ? {")
old_cc = blocco[blocco.index("function caricaCodec(tipo) {"):blocco.index("function decodificaCodec(tipo, fr) {")]
new_cc = """function caricaCodec(tipo) {
  CODEC[tipo] ||= (async () => {
    const [file, globale, classe] = CODEC_FILE[tipo], base = new URL('./lib/codec/', import.meta.url).href;
    if (!globalThis[globale]) {
      if (typeof document !== 'undefined') await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = base + file + '.js'; s.onload = ok; s.onerror = () => ko(new Error('decodificatore non disponibile (' + file + ')')); document.head.appendChild(s); });
      else { const t = await (await fetch(base + file + '.js')).text(); globalThis[globale] = new Function(t + '\\nreturn ' + globale + ';')(); }   // web worker
    }
    const m = await globalThis[globale]({ locateFile: (f) => base + f });
    CODEC[tipo + '_pronto'] = new m[classe]();
  })().catch((e) => { delete CODEC[tipo]; throw e; });
  return CODEC[tipo];
}
"""
blocco = blocco.replace(old_cc, new_cc)
nomi = re.findall(r'^(?:const|let|function|async function) ([A-Za-z_$][\w$]*)', blocco, re.M)
testa = """// Decodifica DICOM condivisa dalla pagina e dai web worker (decodifica-worker.js): sintassi native, JPEG lossless, RLE,
// JPEG / JPEG 2000 / JPEG-LS (decodificatori WebAssembly in lib/codec), multi-frame e gruppi funzionali «enhanced».
// Usa dicomParser globale (nella pagina dal tag <script>, nel worker caricato da decodifica-worker.js).
import { Decoder } from './lib/lossless-min.js';
let CON_PAZIENTE = false;   // versione client: dati del paziente nell'immagine (mostrati solo a richiesta)
export function impostaPaziente(v) { CON_PAZIENTE = !!v; }
"""
mod = testa + blocco + "\nexport { " + ", ".join(nomi) + " };\n"
open(W + '/decodifica.js', 'w', encoding='utf-8').write(mod)
src = src[:a] + eq + src[e:]
src = src.replace("import { Decoder } from './lib/lossless-min.js';\n", "import { " + ", ".join(nomi) + ", impostaPaziente } from './decodifica.js';\n", 1)
assert "from './decodifica.js'" in src
src = src.replace("if (CLIENT) document.documentElement.classList.add('client');", "if (CLIENT) document.documentElement.classList.add('client');\nimpostaPaziente(CLIENT);", 1)

POOL = r"""
// ---- decodifica in processi separati (web worker): i volumi (coronale/sagittale, MPR) e le immagini vicine si decodificano
// senza bloccare la pagina. Se i worker non partono, si decodifica qui come prima.
const POOL = { lav: [], attese: new Map(), id: 0, giro: 0, ko: false };
function avviaPool() {
  if (POOL.lav.length || POOL.ko) return;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  try {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./decodifica-worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { const r = POOL.attese.get(e.data.id); if (!r) return; POOL.attese.delete(e.data.id); clearTimeout(r.t); if (e.data.errore) r.male(e.data.errore); else r.ok(e.data.img); };
      w.onerror = (e) => { console.warn('worker di decodifica non disponibile', e.message || e); POOL.ko = true; for (const r of POOL.attese.values()) { clearTimeout(r.t); r.male('worker'); } POOL.attese.clear(); };
      POOL.lav.push(w);
    }
  } catch (e) { console.warn('worker non disponibili', e); POOL.ko = true; }
}
function decodificaAsync(raw, suv) {
  const qui = () => suvizza(decodificaDicom(raw), suv);
  avviaPool();
  if (POOL.ko || !POOL.lav.length) return Promise.resolve().then(qui);
  const ab = bufDi(raw), frame = raw && !isAB(raw) ? raw.frame : null;
  return new Promise((ok, ko) => {
    const id = ++POOL.id;
    const male = (m) => { try { ok(qui()); } catch (x) { ko(x instanceof Error ? x : new Error(m)); } };   // in caso di problemi: decodifica qui
    const t = setTimeout(() => { if (POOL.attese.delete(id)) male('tempo scaduto'); }, 20000);
    POOL.attese.set(id, { ok: (img) => ok(suvizza(img, suv)), male, t });
    POOL.lav[POOL.giro++ % POOL.lav.length].postMessage({ id, buf: ab, frame });
  });
}
// le immagini vicine a quella mostrata, già scaricate, si decodificano in anticipo (scorrimento più fluido)
function preparaVicine(p, i) {
  if (POOL.ko || !p.frames.length || p.piano) return;
  const tok = p.token, s = V.serie[p.sIdx];
  for (const j of [i + 1, i - 1, i + 2, i + 3, i - 2]) {
    const f = p.frames[j]; if (!f || !f.buf || p.cache.has(f.url) || f._prep) continue;
    f._prep = true;
    decodificaAsync(f.buf, s?.suv).then((img) => {
      f._prep = false;
      if (tok !== p.token || p.cache.has(f.url)) return;
      f.pos = img.ipp; f.iop = img.iop; f.for = img.for; p.cache.set(f.url, img);
      while (p.cache.size > 60) p.cache.delete(p.cache.keys().next().value);
    }).catch(() => { f._prep = false; });
  }
}
"""
src = src.replace("const immagine = (i) => immagineDi(P(), i);\n", "const immagine = (i) => immagineDi(P(), i);\n" + POOL, 1)
# volume per coronale / sagittale e MPR: in parallelo nei worker
o = "    const fette = frames.map((f) => suvizza(decodificaDicom(f.buf), s.suv));\n    frames.forEach((f) => { f.buf = null; });"
assert src.count(o) == 1
src = src.replace(o, """    let dec = 0;
    const fette = await Promise.all(frames.map((f) => decodificaAsync(f.buf, s.suv).then((im) => { if (++dec % 20 === 0) avanza?.(dec, frames.length, 'decodifica'); return im; })));
    frames.forEach((f) => { f.buf = null; });""")
o = "    for (const [i, f] of frames.entries()) {\n      if (i % passoZ === 0) { const d = suvizza(decodificaDicom(f.buf), s.suv); fette.push(mobile ? ridottaMobile(d) : d); }\n      f.buf = null;\n    }"
if src.count(o) == 1:
    src = src.replace(o, """    // decodifica nei worker, a gruppi (la pagina resta libera)
    const scelti = frames.filter((_, i) => i % passoZ === 0);
    for (let i = 0; i < scelti.length; i += 24) {
      const parte = await Promise.all(scelti.slice(i, i + 24).map((f) => decodificaAsync(f.buf, s.suv)));
      for (const d of parte) fette.push(mobile ? ridottaMobile(d) : d);
      statoMPR(`Ricostruisco il volume: ${Math.min(scelti.length, i + 24)} / ${scelti.length}`);
      if (mio !== MPR.token) return;
    }
    frames.forEach((f) => { f.buf = null; });""")
else:
    print('ATTENZIONE: ciclo MPR non trovato')
o = "    p.img = img; if (!ME.has(p.sIdx)"
assert src.count(o) == 1
src = src.replace(o, "    p.img = img; preparaVicine(p, i); if (!ME.has(p.sIdx)")
o = "vol = await volumeDi(si, (a, b) => { $('#caricamento').hidden = false; $('#caricamento').textContent = `Ricostruisco il piano: ${a} / ${b} immagini`; });"
assert src.count(o) == 1
src = src.replace(o, "vol = await volumeDi(si, (a, b, fase) => { $('#caricamento').hidden = false; $('#caricamento').textContent = `${fase === 'decodifica' ? 'Ricostruisco il piano: decodifica' : 'Ricostruisco il piano: lettura'} ${a} / ${b} immagini`; });")
open(W + '/app.js', 'w', encoding='utf-8').write(src)

open(W + '/decodifica-worker.js', 'w', encoding='utf-8').write("""// Web worker di decodifica DICOM: riceve il file (e il fotogramma), restituisce l'immagine con i pixel trasferiti.
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
""")
print('ok', len(nomi), 'nomi')
