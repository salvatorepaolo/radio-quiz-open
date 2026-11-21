import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A = W + 'app.js'; I = W + 'index.html'; S = W + 'style.css'
for f in (A, I, S): shutil.copy(f, f + '.bak_1107p')
def sost(t, a, b, n=1):
    assert t.count(a) == n, (a[:90], t.count(a)); return t.replace(a, b)

h = open(I, encoding='utf-8').read()
h = sost(h, '<div id="t2s-pannello" class="eco-pannello" hidden></div>', '<div id="t2s-pannello" class="eco-pannello" hidden></div>\n<div id="calcio-pannello" class="eco-pannello calcio-pannello" hidden></div>')
h = sost(h, '            <button data-tool="volume" class="ico"',
  '            <button data-tool="calcio" class="ico" aria-label="Calcio coronarico" title="Calcio coronarico (TC): scegli l\'arteria e clicca su ogni calcificazione; punteggio di Agatston e categoria CAC-DRS, anche visiva per le TC del torace"><b style="font-size:10px;line-height:18px">CAC</b></button>\n            <button data-tool="volume" class="ico"')
open(I, 'w', encoding='utf-8').write(h)

a = open(A, encoding='utf-8').read()
a = sost(a, "  if (tool === 'volume') { volumeDa(k, pt); return; }", "  if (tool === 'volume') { volumeDa(k, pt); return; }\n  if (tool === 'calcio' && e.button === 0 && !e.shiftKey) { calcioDa(k, pt).catch((err) => avvisoBreve(err.message)); return; }")
a = sost(a, "  $('#t2s-pannello').hidden = V.tool !== 't2s'; if (V.tool === 't2s') { stopCine(); pannelloT2s(); }\n  aggiornaMenuBarra(); disegna();",
  "  $('#t2s-pannello').hidden = V.tool !== 't2s'; if (V.tool === 't2s') { stopCine(); pannelloT2s(); }\n  $('#calcio-pannello').hidden = V.tool !== 'calcio' && !CAC.lesioni.length; if (V.tool === 'calcio') { stopCine(); pannelloCalcio(); }\n  aggiornaMenuBarra(); disegna();")
a = sost(a, "  canvas.style.cursor = V.tool === 'lente' ? 'none' : STRUMENTI_MISURA.includes(V.tool) || V.tool === 'eco' || V.tool === 'cmr' ||",
  "  canvas.style.cursor = V.tool === 'lente' ? 'none' : STRUMENTI_MISURA.includes(V.tool) || V.tool === 'eco' || V.tool === 'cmr' || V.tool === 'calcio' ||")
a = sost(a, "    disegnaVolumi(k, g);\n", "    disegnaVolumi(k, g); disegnaCalcio(k, g);\n")
a = sost(a, "// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio\n", r"""// ---------------------------------------------------------------- calcio coronarico (Agatston e CAC-DRS)
// Clic su una calcificazione: crescita di regione sopra 130 HU (8-connessa) nell'immagine e nelle vicine, entro 12 mm
// dal punto (così non si prendono coste, vertebre o la valvola). Per ogni immagine: area × fattore di densità del picco
// (130-199 → 1, 200-299 → 2, 300-399 → 3, ≥ 400 → 4), solo aree ≥ 1 mm²; la somma si riporta a strati di 3 mm
// (passo/3), come si fa per le TC del torace non sincronizzate con l'ECG (stima). Categoria CAC-DRS (Hecht 2018):
// A0 = 0, A1 1-99, A2 100-299, A3 ≥ 300, più il numero di arterie coinvolte (N); in alternativa la scala visiva
// per arteria 0-3 (somma 0 → V0, 1-3 → V1, 4-5 → V2, 6-12 → V3).
const CAC = { lesioni: [], vaso: 'IVA', visivo: { TCS: 0, IVA: 0, CX: 0, CD: 0 }, modo: 'agatston' };
const VASI_CAC = [['TCS', 'tronco comune', '#ff6b5b'], ['IVA', 'interventricolare anteriore', '#ffd23c'], ['CX', 'circonflessa', '#7ee787'], ['CD', 'coronaria destra', '#78b4ff']];
const pesoAgatston = (hu) => (hu >= 400 ? 4 : hu >= 300 ? 3 : hu >= 200 ? 2 : hu >= 130 ? 1 : 0);
function categoriaCac(score) { return score <= 0 ? ['A0', 'calcio assente'] : score < 100 ? ['A1', 'lieve'] : score < 300 ? ['A2', 'moderato'] : ['A3', 'grave']; }
function categoriaVisiva(somma) { return somma <= 0 ? ['V0', 'calcio assente'] : somma <= 3 ? ['V1', 'lieve'] : somma <= 5 ? ['V2', 'moderato'] : ['V3', 'grave']; }
async function calcioDa(k, pt) {
  if (bloccoEsame()) return;
  const p = P(k), img0 = p.img; if (!img0) return;
  if (img0.modalita !== 'CT') throw new Error('Il calcio coronarico si misura sulle TC');
  const W = img0.cols, H = img0.rows, val = (im, i) => im.pix[i] * im.slope + im.inter, sp = Math.min(img0.spCol, img0.spRow);
  // punto sopra soglia più vicino al clic (entro 3 mm)
  const x0 = Math.round(pt.x), y0 = Math.round(pt.y), rc = Math.ceil(3 / sp); let seme = -1, dm = Infinity;
  for (let y = Math.max(0, y0 - rc); y <= Math.min(H - 1, y0 + rc); y++) for (let x = Math.max(0, x0 - rc); x <= Math.min(W - 1, x0 + rc); x++) {
    const i = y * W + x, d = (x - x0) ** 2 + (y - y0) ** 2; if (val(img0, i) >= 130 && d < dm) { dm = d; seme = i; } }
  if (seme < 0) throw new Error('Nessuna calcificazione (≥ 130 HU) vicino al punto: clicca sulla calcificazione');
  const sx = seme % W, sy = (seme / W) | 0, rMax = 12 / sp, n = normaleDi(img0.iop);
  const cresci = (im, semi) => { const m = new Uint8Array(W * H), coda = [], out = [];
    for (const i of semi) if (!m[i] && val(im, i) >= 130) { m[i] = 1; coda.push(i); }
    while (coda.length) { const i = coda.pop(); out.push(i); if (out.length > 20000) break; const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (m[j] || Math.hypot(xx - sx, yy - sy) > rMax) continue; if (val(im, j) >= 130) { m[j] = 1; coda.push(j); } } }
    return out; };
  const maschere = new Map(), base = cresci(img0, [seme]);
  if (base.length > Math.PI * rMax * rMax * 0.5) throw new Error('La regione è troppo grande: non sembra una calcificazione coronarica (osso o mezzo di contrasto?)');
  maschere.set(p.idx, base);
  for (const dir of [-1, 1]) { let prec = base;
    for (let j = p.idx + dir, giri = 0; j >= 0 && j < p.frames.length && giri < 12; j += dir, giri++) {
      const im = await immagineDi(p, j); if (!im || im.cols !== W || im.rows !== H) break;
      if (im.ipp && img0.ipp && Math.abs((im.ipp[0] - img0.ipp[0]) * n[0] + (im.ipp[1] - img0.ipp[1]) * n[1] + (im.ipp[2] - img0.ipp[2]) * n[2]) > 15) break;
      const r = cresci(im, prec); if (!r.length) break; maschere.set(j, r); prec = r; } }
  // passo tra le immagini e punteggio
  const idxs = [...maschere.keys()].sort((x, y) => x - y), pos = [];
  for (const j of idxs) { const im = await immagineDi(p, j); pos.push(im.ipp ? im.ipp[0] * n[0] + im.ipp[1] * n[1] + im.ipp[2] * n[2] : j * (img0.spessore || 3)); }
  let passo = idxs.length > 1 ? Math.abs(pos[pos.length - 1] - pos[0]) / (idxs.length - 1) : 0;
  if (!passo) { const im1 = await immagineDi(p, Math.min(p.frames.length - 1, p.idx + 1)); passo = im1?.ipp && img0.ipp ? Math.abs((im1.ipp[0] - img0.ipp[0]) * n[0] + (im1.ipp[1] - img0.ipp[1]) * n[1] + (im1.ipp[2] - img0.ipp[2]) * n[2]) : (img0.spessore || 3); }
  const pxmm2 = img0.spCol * img0.spRow; let grezzo = 0, vox = 0, picco = 0;
  for (const j of idxs) { const im = await immagineDi(p, j), l = maschere.get(j); let mx = 0; for (const i of l) { const v = val(im, i); if (v > mx) mx = v; } vox += l.length; picco = Math.max(picco, mx);
    const area = l.length * pxmm2; if (area >= 1) grezzo += area * pesoAgatston(mx); }
  const agatston = grezzo * (passo || 3) / 3, volume = vox * pxmm2 * (passo || 3);
  // la stessa calcificazione cliccata due volte non si conta due volte
  const giaPresa = CAC.lesioni.find((l) => l.sIdx === p.sIdx && l.maschere.get(p.idx)?.includes(seme));
  if (giaPresa) { giaPresa.vaso = CAC.vaso; avvisoBreve(`Calcificazione già misurata: assegnata a ${CAC.vaso}`); pannelloCalcio(); disegna(); return; }
  CAC.lesioni.push({ sIdx: p.sIdx, idx: p.idx, x: sx, y: sy, vaso: CAC.vaso, maschere, agatston, volume, picco, passo, _cv: new Map() });
  T.misure++; $('#calcio-pannello').hidden = false; pannelloCalcio(); disegna();
  avvisoBreve(`${CAC.vaso}: calcificazione di ${virgola(volume, 0)} mm³, picco ${Math.round(picco)} HU, Agatston ${virgola(agatston, 1)}`);
}
function disegnaCalcio(k, g) {
  const p = P(k); if (!CAC.lesioni.length) return;
  for (const l of CAC.lesioni) {
    if (l.sIdx !== p.sIdx || !l.maschere.has(p.idx)) continue;
    let cv = l._cv.get(`${p.idx}|${l.vaso}`);
    if (!cv) { cv = document.createElement('canvas'); cv.width = p.img.cols; cv.height = p.img.rows;
      const c = cv.getContext('2d'), id = c.createImageData(cv.width, cv.height), col = (VASI_CAC.find(([v]) => v === l.vaso) || VASI_CAC[1])[2];
      const rgb = [1, 3, 5].map((o) => parseInt(col.slice(o, o + 2), 16));
      for (const i of l.maschere.get(p.idx)) { id.data[i * 4] = rgb[0]; id.data[i * 4 + 1] = rgb[1]; id.data[i * 4 + 2] = rgb[2]; id.data[i * 4 + 3] = 190; }
      c.putImageData(id, 0, 0); l._cv.set(`${p.idx}|${l.vaso}`, cv); }
    ctx.save(); ruotaCtx(g); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, g.x, g.y, g.w, g.h); ctx.restore();
    if (p.idx === l.idx) { const q = aSchermo(g, { x: l.x, y: l.y }); testoContorno(`${l.vaso} ${virgola(l.agatston, 0)}`, q.x + 10, q.y - 8, (VASI_CAC.find(([v]) => v === l.vaso) || VASI_CAC[1])[2]); }
  }
}
function riassuntoCalcio() {
  const per = Object.fromEntries(VASI_CAC.map(([v]) => [v, { agatston: 0, volume: 0, n: 0 }]));
  for (const l of CAC.lesioni) { const x = per[l.vaso]; x.agatston += l.agatston; x.volume += l.volume; x.n++; }
  const totale = Object.values(per).reduce((t, x) => t + x.agatston, 0), vasi = Object.values(per).filter((x) => x.n).length;
  const somma = Object.values(CAC.visivo).reduce((t, x) => t + (+x || 0), 0);
  return { per, totale, vasi, cat: categoriaCac(totale), somma, vis: categoriaVisiva(somma), vasiVis: Object.values(CAC.visivo).filter((x) => +x > 0).length };
}
function testoCalcio() {
  const r = riassuntoCalcio(), passo = CAC.lesioni[0]?.passo;
  if (CAC.modo === 'visivo') return `Calcio coronarico, valutazione visiva (CAC-DRS): TCS ${CAC.visivo.TCS}, IVA ${CAC.visivo.IVA}, CX ${CAC.visivo.CX}, CD ${CAC.visivo.CD} (somma ${r.somma}/12): CAC-DRS ${r.vis[0]}${r.vasiVis ? '/N' + r.vasiVis : ''}, calcio ${r.vis[1]}.`;
  return `Calcio coronarico: punteggio di Agatston ${virgola(r.totale, 0)} (TCS ${virgola(r.per.TCS.agatston, 0)}, IVA ${virgola(r.per.IVA.agatston, 0)}, CX ${virgola(r.per.CX.agatston, 0)}, CD ${virgola(r.per.CD.agatston, 0)})`
    + `${passo && Math.abs(passo - 3) > 0.3 ? `, stimato da strati di ${virgola(passo, 1)} mm` : ''}: CAC-DRS ${r.cat[0]}${r.vasi ? '/N' + r.vasi : ''}, calcio ${r.cat[1]}.`;
}
function pannelloCalcio() {
  const box = $('#calcio-pannello'); if (!box || box.hidden) return;
  const r = riassuntoCalcio(), passo = CAC.lesioni[0]?.passo, img = P(V.attivo).img, gated = /cardi|coronar|calcium|score|gat/i.test(V.serie[P(V.attivo).sIdx]?.descrizione || '');
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>Calcio coronarico</b><span class="eco-breve small muted">${CAC.modo === 'visivo' ? `CAC-DRS ${r.vis[0]}` : `Agatston ${virgola(r.totale, 0)} · ${r.cat[0]}`}</span><span class="spacer"></span><button class="ghost piccolo" id="cac-chiudi" title="Chiudi">✕</button></div>
    <div class="cac-modi"><button type="button" class="${CAC.modo === 'agatston' ? 'on' : ''}" data-cac-modo="agatston">Agatston (clic)</button><button type="button" class="${CAC.modo === 'visivo' ? 'on' : ''}" data-cac-modo="visivo">Visiva (TC torace)</button></div>
    ${CAC.modo === 'agatston' ? `<p class="small muted">Scegli l'arteria, poi clicca su ogni calcificazione (sopra 130 HU): la piattaforma la segue nelle immagini vicine. ${img && !gated ? 'Su una TC del torace non sincronizzata con l\'ECG il punteggio è una stima: le linee guida suggeriscono di riportare anche la categoria visiva.' : ''}</p>
      <div class="cac-vasi">${VASI_CAC.map(([v, nome, col]) => `<button type="button" data-cac-vaso="${v}" class="${CAC.vaso === v ? 'on' : ''}" style="--c:${col}" title="${nome}">${v}</button>`).join('')}</div>
      <table class="tab eco-tab"><thead><tr><th>Arteria</th><th>Lesioni</th><th>Agatston</th><th>Volume</th></tr></thead><tbody>
      ${VASI_CAC.map(([v, nome, col]) => `<tr><td><span class="cac-pallino" style="background:${col}"></span>${v} <span class="muted small">${nome}</span></td><td class="num">${r.per[v].n}</td><td class="num">${virgola(r.per[v].agatston, 0)}</td><td class="num">${virgola(r.per[v].volume, 0)} mm³</td></tr>`).join('')}
      <tr class="cac-tot"><td><b>Totale</b></td><td class="num">${CAC.lesioni.length}</td><td class="num"><b>${virgola(r.totale, 0)}</b></td><td></td></tr></tbody></table>
      <p class="cac-esito cac-${r.cat[0]}"><b>CAC-DRS ${r.cat[0]}${r.vasi ? '/N' + r.vasi : ''}</b>: calcio ${r.cat[1]} <span class="muted small">(A0 = 0 · A1 1-99 · A2 100-299 · A3 ≥ 300; N = arterie coinvolte)</span></p>
      ${passo && Math.abs(passo - 3) > 0.3 ? `<p class="small muted">Strati di ${virgola(passo, 1)} mm: punteggio riportato a 3 mm (stima).</p>` : ''}
      <p><button type="button" class="ghost piccolo" id="cac-ultima" ${CAC.lesioni.length ? '' : 'disabled'}>↶ Togli l'ultima</button> <button type="button" class="ghost piccolo" id="cac-azzera" ${CAC.lesioni.length ? '' : 'disabled'}>Azzera</button></p>`
    : `<p class="small muted">Per ogni arteria: 0 assente, 1 lieve, 2 moderato, 3 grave (estensione delle calcificazioni lungo il vaso).</p>
      <table class="tab eco-tab"><tbody>${VASI_CAC.map(([v, nome, col]) => `<tr><td><span class="cac-pallino" style="background:${col}"></span>${v} <span class="muted small">${nome}</span></td><td>${[0, 1, 2, 3].map((x) => `<button type="button" class="cac-vis ${+CAC.visivo[v] === x ? 'on' : ''}" data-cac-vis="${v}:${x}">${x}</button>`).join('')}</td></tr>`).join('')}</tbody></table>
      <p class="cac-esito cac-${r.vis[0].replace('V', 'A')}"><b>CAC-DRS ${r.vis[0]}${r.vasiVis ? '/N' + r.vasiVis : ''}</b>: calcio ${r.vis[1]} <span class="muted small">(somma ${r.somma}/12: 0 → V0 · 1-3 → V1 · 4-5 → V2 · 6-12 → V3)</span></p>`}
    <p><button type="button" class="ghost piccolo" id="cac-referto">Copia nel referto</button></p>`;
  $('#cac-chiudi').onclick = () => { box.hidden = true; if (V.tool === 'calcio') scegliStrumento('scroll'); };
  box.querySelectorAll('[data-cac-modo]').forEach((b) => b.onclick = () => { CAC.modo = b.dataset.cacModo; pannelloCalcio(); });
  box.querySelectorAll('[data-cac-vaso]').forEach((b) => b.onclick = () => { CAC.vaso = b.dataset.cacVaso; pannelloCalcio(); });
  box.querySelectorAll('[data-cac-vis]').forEach((b) => b.onclick = () => { const [v, x] = b.dataset.cacVis.split(':'); CAC.visivo[v] = +x; pannelloCalcio(); });
  $('#cac-ultima')?.addEventListener('click', () => { CAC.lesioni.pop(); pannelloCalcio(); disegna(); });
  $('#cac-azzera')?.addEventListener('click', () => { CAC.lesioni = []; pannelloCalcio(); disegna(); });
  $('#cac-referto').onclick = () => { const t = $('#q-referto'); const frase = testoCalcio();
    if (t) { t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + frase; t.closest('details')?.setAttribute('open', ''); t.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (typeof inserisciNelReferto === 'function') inserisciNelReferto(frase);
    avvisoBreve('Calcio coronarico copiato nel referto'); };
}
// ---------------------------------------------------------------- volume semiautomatico e tempo di raddoppio
""")
open(A, 'w', encoding='utf-8').write(a)

c = open(S, encoding='utf-8').read()
c += '''
/* calcio coronarico */
.calcio-pannello{min-width:330px}
.cac-modi,.cac-vasi{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}
.cac-modi button,.cac-vasi button,.cac-vis{border:1px solid var(--bord);background:var(--pan);color:var(--txt);border-radius:8px;padding:3px 10px;cursor:pointer;font-weight:600}
.cac-modi button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
.cac-vasi button{border-left:4px solid var(--c)}
.cac-vasi button.on{background:color-mix(in srgb,var(--c) 30%,var(--pan));border-color:var(--c)}
.cac-vis{padding:2px 8px;margin-right:3px}
.cac-vis.on{background:var(--acc);color:#fff;border-color:var(--acc)}
.cac-pallino{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle}
.cac-tot td{border-top:2px solid var(--bord)}
.cac-esito{padding:6px 10px;border-radius:8px;background:color-mix(in srgb,var(--ok) 12%,transparent)}
.cac-esito.cac-A1{background:color-mix(in srgb,var(--warn) 14%,transparent)}
.cac-esito.cac-A2{background:color-mix(in srgb,var(--warn) 26%,transparent)}
.cac-esito.cac-A3{background:color-mix(in srgb,var(--ko) 22%,transparent)}
'''
open(S, 'w', encoding='utf-8').write(c)
print('ok')
