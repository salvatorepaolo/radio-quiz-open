# 1.212: mappa ADC calcolata dalle DWI con valori b diversi
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

d = open(R + 'decodifica.js', encoding='utf-8').read()
d = sost(d, "function decodificaDicom(buf, { grezzo = false, frame = 0 } = {}) {",
  "// valore b della diffusione: etichetta standard (0018,9087); nel visualizzatore scaricabile anche i campi privati dei\n"
  "// produttori (Siemens 0019,100C · GE 0043,1039, primo valore, spesso + 10⁹ · Philips 2001,1003), che l'anonimizzazione toglie\n"
  "function valoreB(ds) {\n"
  "  const e = ds.elements || {};\n"
  "  try { if (e.x00189087) { const v = ds.double('x00189087'); if (Number.isFinite(v)) return v; } } catch {}\n"
  "  try { if (e.x0019100c) { const v = parseFloat(ds.string('x0019100c')); if (Number.isFinite(v)) return v; } } catch {}\n"
  "  try { if (e.x00431039) { let v = parseFloat(String(ds.string('x00431039') || '').split('\\\\')[0]); if (Number.isFinite(v)) { if (v >= 1e9) v -= 1e9; if (v >= 0 && v < 1e5) return v; } } } catch {}\n"
  "  try { if (e.x20011003) { const v = ds.float('x20011003'); if (Number.isFinite(v)) return v; } } catch {}\n"
  "  return null;\n"
  "}\n"
  "function decodificaDicom(buf, { grezzo = false, frame = 0 } = {}) {", 'valoreB')
d = sost(d, "te: num('x00180081'), bitsSt,", "te: num('x00180081'), b: valoreB(ds), bitsSt,", 'campo b')
open(R + 'decodifica.js', 'w', encoding='utf-8').write(d)

a = open(R + 'app.js', encoding='utf-8').read()
a = sost(a, "  const img = f.virt ? fettaPiano(f.vol, f.piano, f.t) : suvizza(decodificaDicom(await caricaRaw(f)), V.serie[p.sIdx]?.suv);",
  "  if (p.adc && ADC.mappe.has(k)) return ADC.mappe.get(k);    // mappa ADC calcolata al posto della DWI\n"
  "  const img = f.virt ? fettaPiano(f.vol, f.piano, f.t) : suvizza(decodificaDicom(await caricaRaw(f)), V.serie[p.sIdx]?.suv);", 'immagineDi')
a = sost(a, "  if (p.cache.has(k)) { const v = p.cache.get(k); p.cache.delete(k); p.cache.set(k, v); return v; }\n  if (p.adc",
  "  if (p.adc && ADC.mappe.has(k)) return ADC.mappe.get(k);\n  if (p.cache.has(k)) { const v = p.cache.get(k); p.cache.delete(k); p.cache.set(k, v); return v; }\n  if (p.adc", 'immagineDi 2')
# unità della ROI sulla mappa
a = sost(a, "const unita = (img) => (img?.suv ? ' SUV' : !img?.modalita || img.modalita === 'CT' ? ' HU' : '');",
  "const unita = (img) => (img?.adc ? ' ×10⁻⁶ mm²/s' : img?.suv ? ' SUV' : !img?.modalita || img.modalita === 'CT' ? ' HU' : '');", 'unita')
# scritta nel riquadro
a = sost(a, "  if (img?.spessore) br.push(`Spessore ${+img.spessore.toFixed(2)} mm`);",
  "  if (img?.adc) br.push(`ADC calcolata · b ${img.adc.bs.join(', ')} · ×10⁻⁶ mm²/s`);\n  if (img?.spessore) br.push(`Spessore ${+img.spessore.toFixed(2)} mm`);", 'scritta')
FUNZ = r'''// ---- mappa ADC calcolata dalle DWI con valori b diversi: per ogni pixel ln S = ln S₀ − b·ADC (minimi quadrati su tutti
// i b della fetta; con due b è ln(S₁/S₂)/(b₂ − b₁)). Il b si legge dall'intestazione (decodifica.js → valoreB) o dalla
// descrizione della serie («b800», «b = 1000»), altrimenti lo si chiede. La mappa si vede al posto della DWI nel
// riquadro, in ×10⁻⁶ mm²/s come quelle degli apparecchi (1000 = 1,0 × 10⁻³ mm²/s). Strumento didattico, non validato.
const ADC = { mappe: new Map(), chiave: '', bs: [], lavoro: false };
const RE_DWI = /dwi|diff|trace|\bep2d|\bb\s*[=-]?\s*\d{1,4}\b|b (bass|alt)/i, RE_NON_DWI = /\badc\b|\bexp|\bfa\b|calcolat|mappa/i;
const bDaDescrizione = (t) => { const m = String(t || '').match(/\bb\s*[=-]?\s*(\d{1,4})\b/i); return m ? +m[1] : null; };
async function immagineSerieAdc(si, i) {
  const s = V.serie[si]; s._frAdc ||= s.files.map((f) => ({ url: `/casi/${V.caso.id}/${f}` }));
  return immagineDi({ frames: s._frAdc, cache: new Map(), sIdx: si }, i);
}
const serieDwi = (sRif) => { const st = studioDi(sRif)?.id; return V.serie.map((s, si) => ({ s, si })).filter(({ s }) => s.files?.length && (!st || studioDi(s)?.id === st) && RE_DWI.test(s.descrizione || '') && !RE_NON_DWI.test(s.descrizione || '')); };
async function calcolaAdc(p) {
  const rif = p.img; if (!rif?.iop) throw new Error('immagine senza orientamento');
  const nn = normaleDi(rif.iop), cand = serieDwi(V.serie[p.sIdx]);
  if (!cand.some(({ si }) => si === p.sIdx)) throw new Error('apri prima una serie di diffusione (DWI)');
  const voci = [], chiesti = new Map();
  for (const { s, si } of cand) {
    for (let i = 0; i < s.files.length; i++) {
      const im = await immagineSerieAdc(si, i);
      if (!im.iop || im.rgb || im.rows !== rif.rows || im.cols !== rif.cols || Math.abs(dot3(normaleDi(im.iop), nn)) < 0.99) continue;
      let b = Number.isFinite(im.b) ? im.b : bDaDescrizione(s.descrizione);
      if (!Number.isFinite(b)) {
        if (!chiesti.has(si)) { const r = prompt(`Valore b della serie «${s.descrizione || si + 1}» (s/mm², per esempio 0 o 800)?`, ''); chiesti.set(si, r === null || r.trim() === '' ? null : +r.replace(',', '.')); }
        b = chiesti.get(si);
      }
      if (Number.isFinite(b)) voci.push({ b, z: dot3(im.ipp, nn), url: s._frAdc[i].url, im });
    }
  }
  const bs = [...new Set(voci.map((v) => v.b))].sort((x, y) => x - y);
  if (bs.length < 2) throw new Error(bs.length ? `trovato un solo valore di b (${bs[0]}): servono almeno due pesature` : 'valori di b non trovati');
  voci.sort((x, y) => x.z - y.z);
  const fette = []; for (const v of voci) { const f = fette[fette.length - 1]; if (f && Math.abs(v.z - f[0].z) < 0.6) f.push(v); else fette.push([v]); }
  ADC.mappe.clear(); let fatte = 0;
  for (const g of fette) {
    const bb = [...new Set(g.map((v) => v.b))]; if (bb.length < 2) continue;
    const n = g.length, bm = g.reduce((t, v) => t + v.b, 0) / n, sbb = g.reduce((t, v) => t + (v.b - bm) ** 2, 0);
    const basso = g.reduce((m, v) => (v.b < m.b ? v : m)), alto = g.reduce((m, v) => (v.b > m.b ? v : m));
    const L = basso.im, N = L.rows * L.cols, val = (im, i) => im.pix[i] * (im.slope ?? 1) + (im.inter ?? 0);
    let mx = 0; for (let i = 0; i < N; i += 7) mx = Math.max(mx, val(L, i));
    const soglia = mx * 0.06, out = new Uint16Array(N);
    for (let i = 0; i < N; i++) {
      if (val(L, i) < soglia) continue;
      let sy = 0, sby = 0, buono = true;
      for (const v of g) { const x = val(v.im, i); if (!(x > 0)) { buono = false; break; } const y = Math.log(x); sy += y; sby += (v.b - bm) * y; }
      if (!buono) continue;
      const adc = -(sby / sbb) * 1e6; out[i] = adc > 0 ? Math.min(6000, Math.round(adc)) : 0;
    }
    const img = {}; for (const [kk, vv] of Object.entries(alto.im)) if (!kk.startsWith('_')) img[kk] = vv;
    Object.assign(img, { pix: out, slope: 1, inter: 0, wc: 1200, ww: 2400, rgb: false, suv: false, mono1: false, conSegno: false, adc: { bs: bb.sort((x, y) => x - y) } });
    for (const v of g) ADC.mappe.set(v.url, img);
    fatte++;
  }
  if (!fatte) throw new Error('le serie con b diversi non hanno fette nella stessa posizione');
  ADC.bs = bs; ADC.chiave = V.caso?.id + ':' + p.sIdx;
  return fatte;
}
async function attivaAdc() {
  if (bloccoEsame()) return;
  const p = P(); if (!p?.img) return;
  if (p.adc) { p.adc = false; p.wc = p._wcDwi ?? p.wc; p.ww = p._wwDwi ?? p.ww; $('#btn-adc')?.classList.remove('on'); await mostraDi(V.attivo, p.idx); return; }
  if (ADC.lavoro) return;
  const url = p.frames[p.idx]?.url;
  if (!ADC.mappe.has(url)) {
    ADC.lavoro = true; avvisoBreve('Calcolo la mappa ADC…');
    try { const n = await calcolaAdc(p); avvisoBreve(`Mappa ADC calcolata su ${n} fette (b ${ADC.bs.join(', ')}).`); }
    catch (e) { avvisoBreve('Mappa ADC non calcolata: ' + e.message); return; }
    finally { ADC.lavoro = false; }
  }
  p._wcDwi = p.wc; p._wwDwi = p.ww; p.adc = true; p.wc = 1200; p.ww = 2400; p.wl0 = true;
  $('#btn-adc')?.classList.add('on'); await mostraDi(V.attivo, p.idx);
}
$('#btn-adc')?.addEventListener('click', () => attivaAdc().catch((e) => avvisoBreve('Mappa ADC: ' + e.message)));
'''
a = sost(a, "async function selezionaSerie(si, k = V.attivo, { idx } = {}) {", FUNZ + "async function selezionaSerie(si, k = V.attivo, { idx } = {}) {", 'funzioni adc')
# cambio di serie o di caso: la mappa si spegne nel riquadro
a = sost(a, "  p.zoom = 1; p.panX = p.panY = 0; p.rot = 0; p.fl = false; p.img = null; p.wl0 = false;\n",
  "  p.zoom = 1; p.panX = p.panY = 0; p.rot = 0; p.fl = false; p.img = null; p.wl0 = false; p.adc = false; $('#btn-adc')?.classList.remove('on');\n", 'reset serie')
# pulsante visibile solo nelle RM con DWI
a = sost(a, "  if ($('[data-tool=\"t2s\"]')) $('[data-tool=\"t2s\"]').hidden = !(metodicaDi(V.caso || {}) === 'RM' && V.serie.some((x) => SERIE_MULTIECO.test(x.descrizione || '')));",
  "  if ($('[data-tool=\"t2s\"]')) $('[data-tool=\"t2s\"]').hidden = !(metodicaDi(V.caso || {}) === 'RM' && V.serie.some((x) => SERIE_MULTIECO.test(x.descrizione || '')));\n"
  "  if ($('#btn-adc')) { $('#btn-adc').hidden = !((metodicaDi(V.caso || {}) === 'RM' || CLIENT) && V.serie.some((x) => RE_DWI.test(x.descrizione || '') && !RE_NON_DWI.test(x.descrizione || ''))); ADC.mappe.clear(); }", 'visibile')
open(R + 'app.js', 'w', encoding='utf-8').write(a)

h = open(R + 'index.html', encoding='utf-8').read()
h = sost(h, '            <button data-tool="anatomia" class="ico"',
  '            <button id="btn-adc" class="ico" aria-label="Mappa ADC" hidden title="Mappa ADC calcolata dalle DWI con valori b diversi (b0, b800…): apri la serie di diffusione e premi; un secondo clic torna alla DWI. La ROI dà l\'ADC in ×10⁻⁶ mm²/s (1000 = 1,0 × 10⁻³ mm²/s)"><b style="font-size:10px;letter-spacing:-.02em">ADC</b></button>\n'
  '            <button data-tool="anatomia" class="ico"', 'pulsante')
open(R + 'index.html', 'w', encoding='utf-8').write(h)

en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {
  "Mappa ADC calcolata dalle DWI con valori b diversi (b0, b800…): apri la serie di diffusione e premi; un secondo clic torna alla DWI. La ROI dà l'ADC in ×10⁻⁶ mm²/s (1000 = 1,0 × 10⁻³ mm²/s)": 'ADC map computed from DWI with different b values (b0, b800…): open the diffusion series and press; a second click goes back to the DWI. The ROI gives ADC in ×10⁻⁶ mm²/s (1000 = 1.0 × 10⁻³ mm²/s)',
  'Mappa ADC': 'ADC map', 'Calcolo la mappa ADC…': 'Computing the ADC map…', 'Mappa ADC calcolata su {x} fette (b {x}).': 'ADC map computed on {x} slices (b {x}).',
  'Mappa ADC non calcolata: {x}': 'ADC map not computed: {x}', 'ADC calcolata · b {x} · ×10⁻⁶ mm²/s': 'Computed ADC · b {x} · ×10⁻⁶ mm²/s',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('adc OK')
