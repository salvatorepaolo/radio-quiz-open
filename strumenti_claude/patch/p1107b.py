# 1.213: VD più affidabile (sistole dentro la diastole, esclusione delle fette basali, gittate a confronto) e RECIST dal volume
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

c = open(R + 'cmr.js', encoding='utf-8').read()
c = sost(c, "  return { area: n * sx * sy, n, bordo, centro: interno, baricentro: { x: gx + x0, y: gy + y0 }, perdita: tocchi / perim, B, thr };",
  "  return { area: n * sx * sy, n, bordo, centro: interno, baricentro: { x: gx + x0, y: gy + y0 }, perdita: tocchi / perim, B, thr, maschera: { x0, y0, W, H, m } };", 'maschera')
open(R + 'cmr.js', 'w', encoding='utf-8').write(c)

a = open(R + 'app.js', encoding='utf-8').read()
# --- VD: in sistole il contorno resta dentro quello di fine diastole; fette che non si riducono escluse (soglia 0,85)
a = sost(a, "  CMR.ed = ed; CMR.es = es;\n  CMR.lavoro = false; CMR.stato = ''; T.misure++;",
  "  // VD: in fine sistole la cavità resta dentro quella di fine diastole (dilatata di 2 pixel). Senza questo vincolo il\n"
  "  // contorno del VD in sistole usciva nell'atrio o nel tratto di efflusso e la FE del VD risultava troppo bassa.\n"
  "  if (v === 'vd' && ed != null && es != null && ed !== es) {\n"
  "    for (const { si } of sax) {\n"
  "      const rd = CMR.seg[`vd|${si}|${ed}`], rs = CMR.seg[`vd|${si}|${es}`], M = rd?.maschera; if (!M || !rs || rs.vuota || CMR.man[`vd|${si}|${es}`]) continue;\n"
  "      const dentroED = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx - M.x0, yy = y + dy - M.y0; if (xx >= 0 && yy >= 0 && xx < M.W && yy < M.H && M.m[yy * M.W + xx]) return true; } return false; };\n"
  "      const seme = [rs.centro, rd.centro].find((q) => q && dentroED(Math.round(q.x), Math.round(q.y))); if (!seme) continue;\n"
  "      const r2 = CM.segmentaCavita(await imgCmr(si, es), seme, { ...opz, limite: dentroED });\n"
  "      if (r2 && r2.area < rs.area) CMR.seg[`vd|${si}|${es}`] = r2;\n"
  "    }\n"
  "    for (const { si } of sax) if (incl[si] && areaCmr(v, si, es) > 0.85 * areaCmr(v, si, ed)) incl[si] = false;\n"
  "    vol = volumiCmr(v);\n"
  "  }\n"
  "  CMR.ed = ed; CMR.es = es;\n  CMR.lavoro = false; CMR.stato = ''; T.misure++;", 'vd sistole')
# --- plausibilità del VD: gittate di VS e VD a confronto
a = sost(a, "  if (CMR.ed == null || CMR.es == null) return out;\n  for (const v of ['vs', 'vd']) {",
  "  if (CMR.ed == null || CMR.es == null) return controllaVd(out);\n  for (const v of ['vs', 'vd']) {", 'cifre ritorno 1')
a = sost(a, "      if (conEpi.length && conEpi.length === incl.length) out.vs.massa = incl.reduce((s, x) => s + Math.max(0, CMR.epi[x.si].area - areaCmr('vs', x.si, CMR.ed)), 0) * CMR.passo / 1000 * 1.05;\n    }\n  }\n  return out;\n}",
  "      if (conEpi.length && conEpi.length === incl.length) out.vs.massa = incl.reduce((s, x) => s + Math.max(0, CMR.epi[x.si].area - areaCmr('vs', x.si, CMR.ed)), 0) * CMR.passo / 1000 * 1.05;\n    }\n  }\n  return controllaVd(out);\n}\n"
  "// Senza shunt né insufficienze valvolari le gittate dei due ventricoli sono quasi uguali: se quella del VD è molto diversa\n"
  "// (o la FE del VD è fuori da ogni plausibilità) il numero non va preso per buono: di solito sono i contorni del VD alla\n"
  "// base (atrio, efflusso) o in sistole. I valori del VD restano visibili ma segnati «da verificare».\n"
  "function controllaVd(out) {\n"
  "  const s = out.vs, d = out.vd; if (!d) return out;\n"
  "  const diff = s && !s.metodo && s.sv > 0 ? Math.abs(d.sv - s.sv) / s.sv : 0;\n"
  "  if (diff > 0.3 || d.fe < 30 || d.fe > 85) d.dubbio = `${s && !s.metodo ? `Gittata del VD ${virgola(d.sv, 0)} mL contro ${virgola(s.sv, 0)} mL del VS` : `FE del VD ${virgola(d.fe, 0)}%`}: controlla i contorni del VD alla base (fette con l'atrio o il tratto di efflusso) e in fine sistole, e correggili («Correggi un contorno» → VD). Senza shunt né insufficienze valvolari le due gittate sono quasi uguali.`;\n"
  "  return out;\n}", 'cifre ritorno 2')
a = sost(a, "  return out;\n}\n// misure per il referto: elenco",
  "  if (K.vd?.dubbio) for (const r of out) if (r.id.startsWith('vd_')) { r.fuori = null; r.dubbio = true; r.sub = 'da verificare'; }\n  return out;\n}\n// misure per il referto: elenco", 'righe dubbio')
a = sost(a, "`<div class=\"cmr-kpi ${r.fuori ? 'ko' : r.rif ? 'ok' : ''}\"", "`<div class=\"cmr-kpi ${r.dubbio ? 'dubbio' : r.fuori ? 'ko' : r.rif ? 'ok' : ''}\"", 'tile')
a = sost(a, "<b class=\"k-val\">${esc(r.testo)}${r.fuori ? ` <span class=\"k-freccia\">${freccia(r)}</span>` : ''}</b>",
  "<b class=\"k-val\">${esc(r.testo)}${r.dubbio ? ' <span class=\"k-freccia\">?</span>' : r.fuori ? ` <span class=\"k-freccia\">${freccia(r)}</span>` : ''}</b>", 'tile val')
a = sost(a, "      ${fuori.length ? `<p class=\"cmr-allarme\">",
  "      ${K.vd?.dubbio ? `<p class=\"cmr-dubbio\">⚠ ${esc(K.vd.dubbio)}</p>` : ''}\n      ${fuori.length ? `<p class=\"cmr-allarme\">", 'avviso dubbio')
a = sost(a, "<tr class=\"${r.fuori ? 'fuori' : ''}\"><td>${esc(r.nome)}</td><td class=\"num\">${esc(r.testo)}${r.fuori ? ` <b>${freccia(r)}</b>` : ''}</td>",
  "<tr class=\"${r.dubbio ? 'dubbio' : r.fuori ? 'fuori' : ''}\"><td>${esc(r.nome)}</td><td class=\"num\">${esc(r.testo)}${r.dubbio ? ' <b>?</b>' : r.fuori ? ` <b>${freccia(r)}</b>` : ''}</td>", 'riga tabella')
a = sost(a, "  const RM = righeMisureCmr(cifreCmr()), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x));\n  const sesso",
  "  const KK = cifreCmr(), RM = righeMisureCmr(KK), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x));\n  const sesso", 'referto K')
a = sost(a, "  const html = `<h3>Misure di RM cardiaca</h3><ul>${RM.map((r) => `<li>${esc(riga(r))}${r.fuori ? ` — <b>${segno(r)}</b>` : ''}</li>`).join('')}",
  "  const html = `<h3>Misure di RM cardiaca</h3><ul>${RM.map((r) => `<li>${esc(riga(r))}${r.dubbio ? ' — <i>da verificare</i>' : r.fuori ? ` — <b>${segno(r)}</b>` : ''}</li>`).join('')}", 'referto html')
a = sost(a, "    + (fuori.length ? `<p><b>Fuori dai limiti di riferimento:</b>",
  "    + (KK.vd?.dubbio ? `<p><b>Valori del VD da verificare:</b> ${esc(KK.vd.dubbio)}</p>` : '')\n    + (fuori.length ? `<p><b>Fuori dai limiti di riferimento:</b>", 'referto dubbio')
a = sost(a, "  const testo = ['MISURE DI RM CARDIACA', ...RM.map((r) => `- ${riga(r)}${r.fuori ? ' — ' + segno(r) : ''}`), ...altre.map((x) => `- ${x}`),",
  "  const testo = ['MISURE DI RM CARDIACA', ...RM.map((r) => `- ${riga(r)}${r.dubbio ? ' — da verificare' : r.fuori ? ' — ' + segno(r) : ''}`), ...altre.map((x) => `- ${x}`), ...(KK.vd?.dubbio ? [`Valori del VD da verificare: ${KK.vd.dubbio}`] : []),", 'referto testo')

# --- RECIST dal volume: asse lungo e asse corto dal contorno della lesione
a = sost(a, "    V.volumi.push(v);\n",
  "    V.volumi.push(v);\n"
  "    // RECIST dallo stesso contorno: asse lungo nella sezione dove è massimo, asse corto perpendicolare; entra come misura RECIST\n"
  "    // (si può spostare o cancellare come le altre)\n"
  "    if (!r.pet) { const im0 = await immagineDi(p, idx), rc = recistDaMaschere(r.maschere, im0);\n"
  "      if (rc) { memoriaMisure(); const key = `${p.sIdx}:${rc.j}`; (V.misure[key] = V.misure[key] || []).push({ tipo: 'recist', a: rc.a, b: rc.b, c: rc.c, d: rc.d, auto: true }); v.recist = rc;\n"
  "        avvisoBreve(`Volume ${virgola(r.vol, 2)} cm³ · RECIST ${virgola(rc.lung, 1)} × ${virgola(rc.corto, 1)} mm (immagine ${rc.j + 1}), aggiunto come misura: controllalo e correggilo se serve.`); } }\n", 'recist volume')
FUNZ = r'''// asse lungo (corda massima della sezione, nella fetta dove è più lungo) e asse corto (corda perpendicolare più lunga)
function recistDaMaschere(maschere, img) {
  const W = img.cols, sx = img.spCol || 1, sy = img.spRow || 1; let best = null;
  for (const [j, lista] of maschere) {
    if (lista.length < 6) continue;
    const set = new Set(lista), bordo = []; for (const i of lista) if (!set.has(i - 1) || !set.has(i + 1) || !set.has(i - W) || !set.has(i + W)) bordo.push(i);
    const passo = Math.max(1, Math.ceil(bordo.length / 400)), pts = []; for (let k = 0; k < bordo.length; k += passo) pts.push({ x: bordo[k] % W, y: (bordo[k] / W) | 0 });
    let d2 = 0, A = null, B = null;
    for (let u = 0; u < pts.length; u++) for (let w = u + 1; w < pts.length; w++) { const dd = ((pts[u].x - pts[w].x) * sx) ** 2 + ((pts[u].y - pts[w].y) * sy) ** 2; if (dd > d2) { d2 = dd; A = pts[u]; B = pts[w]; } }
    if (A && (!best || d2 > best.d2)) best = { j, d2, A, B, lista };
  }
  if (!best) return null;
  const { A, B, lista } = best, ux = (B.x - A.x) * sx, uy = (B.y - A.y) * sy, L = Math.hypot(ux, uy); if (!(L > 0)) return null;
  const u = [ux / L, uy / L], w = [-u[1], u[0]], bin = Math.min(sx, sy), fasce = new Map();
  for (const i of lista) {
    const x = i % W, y = (i / W) | 0, X = (x - A.x) * sx, Y = (y - A.y) * sy, t = X * u[0] + Y * u[1], s = X * w[0] + Y * w[1], kb = Math.round(t / bin), e = fasce.get(kb);
    if (!e) fasce.set(kb, { mn: s, mx: s, pmn: { x, y }, pmx: { x, y } }); else { if (s < e.mn) { e.mn = s; e.pmn = { x, y }; } if (s > e.mx) { e.mx = s; e.pmx = { x, y }; } }
  }
  let cb = null; for (const e of fasce.values()) if (!cb || e.mx - e.mn > cb.mx - cb.mn) cb = e;
  const c = (q) => ({ x: q.x + 0.5, y: q.y + 0.5 });
  return { j: best.j, a: c(A), b: c(B), c: c(cb.pmn), d: c(cb.pmx), lung: L + bin, corto: cb.mx - cb.mn + bin };
}
'''
a = sost(a, "function diametroMaschere(maschere, img) {", FUNZ + "function diametroMaschere(maschere, img) {", 'funzione recist')
a = sost(a, "  box.querySelectorAll('.via').forEach((b) => { b.onclick = () => { V.volumi.splice(+b.dataset.i, 1); disegnaVolumiLista(); disegna(); }; });\n}",
  "  box.querySelectorAll('.via').forEach((b) => { b.onclick = () => { V.volumi.splice(+b.dataset.i, 1); disegnaVolumiLista(); disegna(); }; });\n"
  "  l.forEach((v, i) => { if (v.recist) box.querySelector(`.vai[data-i=\"${i}\"]`)?.insertAdjacentHTML('afterend', ` <span class=\"small muted\">RECIST ${virgola(v.recist.lung, 1)} × ${virgola(v.recist.corto, 1)} mm (img ${v.recist.j + 1})</span>`); });\n}", 'lista volumi')
open(R + 'app.js', 'w', encoding='utf-8').write(a)

s = open(R + 'style.css', encoding='utf-8').read()
if '.cmr-dubbio' not in s:
    s += '''
.cmr-kpi.dubbio{border-left-color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,var(--pan2))}
.cmr-kpi.dubbio .k-val,.cmr-kpi.dubbio .k-sub{color:var(--warn)}
.cmr-dubbio{margin:4px 0 8px;padding:7px 10px;border-radius:9px;background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn);font-size:.86em;font-weight:600;line-height:1.35}
.cmr-ris-tab tr.dubbio td{color:var(--warn)}
'''
    open(R + 'style.css', 'w', encoding='utf-8').write(s)
en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {'da verificare': 'to be checked', 'Valori del VD da verificare:': 'RV values to be checked:',
  "Gittata del VD {x} mL contro {x} mL del VS: controlla i contorni del VD alla base (fette con l'atrio o il tratto di efflusso) e in fine sistole, e correggili («Correggi un contorno» → VD). Senza shunt né insufficienze valvolari le due gittate sono quasi uguali.": 'RV stroke volume {x} mL versus {x} mL for the LV: check the RV contours at the base (slices with the atrium or the outflow tract) and at end-systole, and correct them («Correct a contour» → RV). Without shunts or valve regurgitation the two stroke volumes are nearly equal.',
  "⚠ Gittata del VD {x} mL contro {x} mL del VS: controlla i contorni del VD alla base (fette con l'atrio o il tratto di efflusso) e in fine sistole, e correggili («Correggi un contorno» → VD). Senza shunt né insufficienze valvolari le due gittate sono quasi uguali.": '⚠ RV stroke volume {x} mL versus {x} mL for the LV: check the RV contours at the base (slices with the atrium or the outflow tract) and at end-systole, and correct them («Correct a contour» → RV). Without shunts or valve regurgitation the two stroke volumes are nearly equal.',
  'RECIST {x} × {x} mm (img {x})': 'RECIST {x} × {x} mm (img {x})',
  'Volume {x} cm³ · RECIST {x} × {x} mm (immagine {x}), aggiunto come misura: controllalo e correggilo se serve.': 'Volume {x} cm³ · RECIST {x} × {x} mm (image {x}), added as a measurement: check it and correct it if needed.',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('vd + recist OK')
