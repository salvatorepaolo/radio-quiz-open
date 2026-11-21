#!/usr/bin/env python3
# p1111neuro.py: 11/11 — noduli solo nelle TC del torace, coregistrazione senza doppioni, fino a 8 riquadri,
# disposizione «SM» (T1 e FLAIR/STIR di più esami su due righe), lesioni della sclerosi multipla con le nuove,
# encefalo raddrizzato in automatico (piano fronto-meatale stimato)
import sys, shutil
W = sys.argv[1] if len(sys.argv) > 1 else '.'
p = W + '/app.js'; s = open(p).read(); shutil.copy(p, p + '.bak_1111neuro')
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:80]); s = s.replace(a, b)

# 1) noduli: solo TC del torace (niente richieste inutili negli altri esami)
rep("""    const cart = V.serie[si]?.files?.[0]?.split('/')[1];
    NOD.per.set(k, (!cart ? Promise.resolve(null)""", """    const cart = V.serie[si]?.files?.[0]?.split('/')[1];
    const torace = /torac|polmon|chest|lung|nodul|screening|ldct|nlst|lidc|total ?body|whole ?body/i.test(`${V.caso?.distretto || ''} ${V.caso?.titolo || ''} ${V.caso?.titolo_interno || ''} ${V.serie[si]?.descrizione || ''}`) && /TC|CT/i.test(`${metodicaDi(V.caso || {})} ${V.caso?.modalita || ''}`);
    NOD.per.set(k, (!cart || !torace ? Promise.resolve(null)""")

# 2) coregistrazione automatica: una volta per esame (più riquadri dello stesso esame condividono l'allineamento)
rep("""  if (!da.length) return;
  const box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = 'Allineo i due esami per la sincronizzazione · ' + t.replace(/^Coregistrazione: /, ''); };""",
"""  { const visti = new Set(); for (let i = da.length - 1; i >= 0; i--) { if (visti.has(da[i][0].img.for)) da.splice(i, 1); else visti.add(da[i][0].img.for); } }
  if (!da.length) return;
  const box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = 'Allineo gli esami per la sincronizzazione · ' + t.replace(/^Coregistrazione: /, ''); };""")

# 3) fino a 8 riquadri (due righe)
rep("const MAX_RIQUADRI = 4, LETTERE = 'ABCD';", "const MAX_RIQUADRI = 8, LETTERE = 'ABCDEFGH';")
rep("  const [col, rig] = V.n === 4 ? [2, 2] : V.n === 2 && V.verticale ? [1, 2] : [V.n, 1];",
    "  const [col, rig] = V.n === 4 ? [2, 2] : V.n > 4 ? [Math.ceil(V.n / 2), 2] : V.n === 2 && V.verticale ? [1, 2] : [V.n, 1];")

# 4) disposizione SM + 5) lesioni SM + 6) encefalo raddrizzato
rep("function aggiornaWorkspaceFasi() {", r"""// ---- 11/11: NEURO. Disposizione «SM»: per ogni esame RM dell'encefalo (fino a 4, dal più recente) il T1 sopra e il
// FLAIR/STIR/T2 sotto, 8 riquadri su due righe, sincronizzati e allineati tra loro.
function serieSM() {
  const neuro = /encef|cranio|cerebr|brain|head|sclerosi|demiel|\bsm\b|\bms\b/i.test(`${V.caso?.distretto || ''} ${V.caso?.titolo || ''} ${V.caso?.quesito || ''}`)
    || V.serie.some((s) => /flair|brain|encef|head/i.test(`${s.descrizione} ${studioDi(s).nome}`));
  if (!neuro || V.studi.length < 2 || !V.serie.some((s) => /^MR/i.test(s.modalita || '') || tipoSequenza(s.descrizione).tipo)) return null;
  const studi = [...V.studi].sort((a, b) => b.n - a.n).slice(0, 4);
  const scegli = (st, tipi) => { let m = null; V.serie.forEach((s, i) => { if (studioDi(s).id !== st.id || s.files.length < 10) return; const t = tipoSequenza(s.descrizione || studioDi(s).nome);
    const r = tipi.indexOf(t.tipo); if (r < 0) return; const pt = r * 100 - (t.piano === 'ax' ? 20 : 0) - Math.min(19, s.files.length / 20); if (!m || pt < m.pt) m = { i, pt }; }); return m?.i ?? null; };
  const sopra = studi.map((st) => scegli(st, ['T1+C', 'T1'])), sotto = studi.map((st) => scegli(st, ['FLAIR', 'STIR', 'T2']));
  if (sotto.filter((x) => x != null).length < 2) return null;
  return { sopra, sotto, n: studi.length };
}
async function apriDisposizioneSM() {
  const d = serieSM(); if (!d) { avvisoBreve('Servono almeno due RM dell\'encefalo con FLAIR o STIR'); return; }
  if (MPR.attivo) modo2D();
  stopCine(); V.solo = null; V.inCorso = null; V.sincro = true; $('#sincro').checked = true;
  const lista = [...d.sopra, ...d.sotto];
  V.pannelli = Array.from({ length: MAX_RIQUADRI }, nuovoPannello); V.n = lista.length; V.attivo = d.n; V.verticale = false;
  $('#riquadri').value = valoreRiquadri(); $('#sincro-wrap').hidden = false; T.confronto = true;
  for (let k = 0; k < lista.length; k++) if (lista[k] != null) await selezionaSerie(lista[k], k);
  V.attivo = d.n; evidenziaSerie(); disegna();
  avvisoBreve('SM: T1 sopra, FLAIR/STIR sotto, dal più recente; gli esami si allineano da soli (🧠 SM per le lesioni)');
  await allineaPerSincro(d.n); await COREG.inCorso; await sincronizzaDa(d.n);
}
// ---- lesioni della sclerosi multipla (stima automatica nel browser): nel FLAIR/STIR/T2 del riquadro attivo si
// cercano le aree iperintense della sostanza bianca (oltre 3 deviazioni robuste dalla mediana del parenchima, lontano
// dalla superficie del cervello), poi ogni lesione si cerca negli esami precedenti dello stesso tipo (allineati):
// se lì non era iperintensa è «nuova». È un aiuto alla lettura, non una diagnosi: falsi positivi (plessi corioidei,
// artefatti di flusso, bordi dei ventricoli) e lesioni piccole perse.
const SM = { lesioni: null, si: null, nascoste: false };
function statRobuste(vol) {
  const d = vol.dati, camp = []; for (let i = 0; i < d.length; i += 7) camp.push(d[i]); camp.sort((a, b) => a - b);
  const p99 = camp[Math.floor(camp.length * 0.99)] || 1, t0 = 0.18 * p99;
  const tess = camp.filter((v) => v > t0); const med = tess[tess.length >> 1] || 0;
  const dev = tess.map((v) => Math.abs(v - med)).sort((a, b) => a - b), mad = (dev[dev.length >> 1] || 1) * 1.4826;
  return { t0, med, mad: Math.max(mad, 1e-6) };
}
function maschera(vol, t0, mm) {
  // cervello = sopra la soglia del tessuto, eroso di «mm» millimetri (via la superficie: corteccia, cute, artefatti di bordo)
  const { W, H, N, dati, sp } = vol, m = new Uint8Array(W * H * N);
  for (let i = 0; i < m.length; i++) m[i] = dati[i] > t0 ? 1 : 0;
  const erodi = (asse, r) => { if (r < 1) return; const st = [1, W, W * H][asse], L = [W, H, N][asse], tmp = new Uint8Array(L);
    for (let o = 0; o < m.length; o++) {
      const c = [o % W, Math.floor(o / W) % H, Math.floor(o / (W * H))]; if (c[asse] !== 0) continue;
      for (let t = 0; t < L; t++) tmp[t] = m[o + t * st];
      let fuori = -1e9; for (let t = 0; t < L; t++) { if (!tmp[t]) fuori = t; if (t - fuori <= r) m[o + t * st] = 0; }
      fuori = 1e9; for (let t = L - 1; t >= 0; t--) { if (!tmp[t]) fuori = t; if (fuori - t <= r) m[o + t * st] = 0; }
    } };
  for (let a = 0; a < 3; a++) erodi(a, Math.round(mm / sp[a]));
  return m;
}
const vxPaz = (vol, i, j, k) => [0, 1, 2].map((c) => vol.origine[c] + i * vol.sp[0] * vol.assi[0][c] + j * vol.sp[1] * vol.assi[1][c] + k * vol.sp[2] * vol.assi[2][c]);
const pazVx = (vol, q) => { const e = [q[0] - vol.origine[0], q[1] - vol.origine[1], q[2] - vol.origine[2]]; return [0, 1, 2].map((a) => dot3(e, vol.assi[a]) / vol.sp[a]); };
function valoreVol(vol, q, r = 1) {
  const [x, y, z] = pazVx(vol, q).map(Math.round); let s = 0, n = 0;
  for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const i = x + dx, j = y + dy, k = z + dz; if (i < 0 || j < 0 || k < 0 || i >= vol.W || j >= vol.H || k >= vol.N) continue;
    s += vol.dati[(k * vol.H + j) * vol.W + i]; n++; }
  return n ? s / n : null;
}
async function lesioniSM() {
  const p = P(), s = V.serie[p.sIdx]; if (!p.img?.ipp || p.piano) { avvisoBreve('Apri nel riquadro attivo il FLAIR (o STIR/T2) dell\'esame'); return; }
  const tipo = tipoSequenza(s.descrizione || studioDi(s).nome).tipo;
  if (!['FLAIR', 'STIR', 'T2', 'PD'].includes(tipo) && !confirm('La serie del riquadro attivo non sembra un FLAIR/STIR/T2: cerco lo stesso le lesioni iperintense?')) return;
  const box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = t; };
  try {
    const vol = await volumeDi(p.sIdx, (a, b) => stato(`Lesioni SM: leggo ${a}/${b}`));
    stato('Lesioni SM: cerco le aree iperintense…'); await pausa(30);
    const { t0, med, mad } = statRobuste(vol), soglia = med + 3 * mad, m = maschera(vol, t0, 4), { W, H, N, dati, sp } = vol, vv = sp[0] * sp[1] * sp[2];
    const vis = new Uint8Array(W * H * N), lesioni = [], coda = new Int32Array(W * H * N);
    for (let o = 0; o < dati.length; o++) {
      if (vis[o] || !m[o] || dati[o] <= soglia) continue;
      let a = 0, b = 0; coda[b++] = o; vis[o] = 1; let sx = 0, sy = 0, sz = 0, n = 0, mx = 0;
      while (a < b) { const q = coda[a++], i = q % W, j = Math.floor(q / W) % H, k = Math.floor(q / (W * H)); sx += i; sy += j; sz += k; n++; if (dati[q] > mx) mx = dati[q];
        for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const i2 = i + di, j2 = j + dj, k2 = k + dk; if (i2 < 0 || j2 < 0 || k2 < 0 || i2 >= W || j2 >= H || k2 >= N) continue;
          const q2 = (k2 * H + j2) * W + i2; if (!vis[q2] && m[q2] && dati[q2] > soglia) { vis[q2] = 1; coda[b++] = q2; } } }
      const vol_mm3 = n * vv; if (vol_mm3 < 10 || vol_mm3 > 20000) continue;
      const c = vxPaz(vol, sx / n, sy / n, sz / n);
      lesioni.push({ centro: c, vol_mm3, diam_mm: 2 * Math.cbrt(3 * vol_mm3 / (4 * Math.PI)), z: (mx - med) / mad, stato: 'da confrontare' });
    }
    lesioni.sort((x, y) => y.vol_mm3 - x.vol_mm3);
    // confronto con i precedenti dello stesso tipo, allineati (traslazione e rotazione)
    const st = studioDi(s), prec = V.studi.filter((x) => x.n < st.n).sort((x, y) => y.n - x.n);
    let confronto = null;
    for (const pr of prec) {
      const si = serieCorrispondente(s, pr.id); if (si == null || tipoSequenza(V.serie[si].descrizione).tipo !== tipo) continue;
      stato(`Lesioni SM: allineo il precedente ${etichettaStudio(pr.id) || pr.data || ''}…`);
      const q = await pannelloTemp(si);
      if (!allineate(p.img, q.img)) await coregistraStudi(p, q, stato);
      const vp = await volumeDi(si, (a, b) => stato(`Lesioni SM: leggo il precedente ${a}/${b}`)), sp_ = statRobuste(vp);
      const Tc = offsetDi(p.img.for), Tp = offsetDi(q.img.for);
      for (const l of lesioni) { const qq = inversa(Tp, applica(Tc, l.centro)), v = valoreVol(vp, qq, 1);
        l.zPrec = v == null ? null : (v - sp_.med) / sp_.mad; l.stato = v == null ? 'fuori dal precedente' : l.zPrec < 2 ? 'nuova' : 'già presente'; }
      confronto = { nome: etichettaStudio(pr.id) || pr.data || 'precedente' }; break;
    }
    SM.lesioni = lesioni; SM.si = p.sIdx; SM.confronto = confronto; SM.nascoste = false; T.lesioniSM = true;
    pannelloSM(); disegna();
  } catch (e) { console.error(e); avvisoBreve('Ricerca delle lesioni non riuscita: ' + e.message); }
  finally { box.hidden = true; }
}
function disegnaSM(k, g) {
  if (!SM.lesioni?.length || SM.nascoste) return;
  const p = P(k), img = p.img; if (!img?.ipp || !img.iop) return;
  const rif = V.serie[SM.si]; if (!rif || studioDi(V.serie[p.sIdx]).id !== studioDi(rif).id) return;
  const n = normaleDi(img.iop), sp = Math.max(1, img.spessore || 1);
  ctx.save(); ctx.font = 'bold 11px system-ui, sans-serif';
  SM.lesioni.forEach((l, i) => {
    const q = l.centro, r = l.diam_mm / 2, d = (q[0] - img.ipp[0]) * n[0] + (q[1] - img.ipp[1]) * n[1] + (q[2] - img.ipp[2]) * n[2];
    if (Math.abs(d) > r + sp / 2) return;
    const pix = daPaziente(img, q), c = aSchermo(g, pix), e = aSchermo(g, { x: pix.x + Math.max(r, 2) / img.spCol, y: pix.y }), rr = Math.hypot(e.x - c.x, e.y - c.y) + 4;
    const col = l.stato === 'nuova' ? '#ff4d4d' : l.stato === 'già presente' ? '#ffd34d' : '#7ec8ff';
    for (const w of [3, 1.6]) { ctx.lineWidth = w; ctx.strokeStyle = w > 2 ? 'rgba(0,0,0,.75)' : col; ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 7); ctx.stroke(); }
    testoContorno(`${i + 1}${l.stato === 'nuova' ? ' nuova' : ''}`, c.x + rr * 0.7 + 3, c.y - rr * 0.7 - 2, col);
  });
  ctx.restore();
}
function pannelloSM() {
  const box = $('#sm-pannello'), L = SM.lesioni || []; box.hidden = false;
  const nuove = L.filter((l) => l.stato === 'nuova').length, gia = L.filter((l) => l.stato === 'già presente').length, vt = L.reduce((a, l) => a + l.vol_mm3, 0) / 1000;
  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>🧠 Lesioni iperintense (stima automatica)</b><span class="spacer"></span><button type="button" class="ghost piccolo" id="sm-occhio">${SM.nascoste ? '👁 Mostra' : '🚫 Nascondi'}</button><button type="button" class="ghost piccolo" id="sm-chiudi" aria-label="Chiudi">✕</button></div>
    <p class="small"><b>${L.length}</b> lesioni ≥ 10 mm³ · volume totale ${virgola(vt, 1)} mL${SM.confronto ? ` · confronto con ${esc(SM.confronto.nome)}: <b style="color:#ff4d4d">${nuove} nuove</b>, ${gia} già presenti` : ' · nessun precedente dello stesso tipo da confrontare'}</p>
    ${L.length ? `<div class="sm-lista"><table class="tab eco-tab"><thead><tr><th>#</th><th>Diametro</th><th>Volume</th><th>Stato</th><th></th></tr></thead><tbody>${L.slice(0, 60).map((l, i) => `<tr${l.stato === 'nuova' ? ' class="cfia-nuovo"' : ''}><td>${i + 1}</td><td>${mm1(l.diam_mm)}</td><td>${Math.round(l.vol_mm3)} mm³</td><td>${l.stato === 'nuova' ? '<b>● nuova</b>' : esc(l.stato)}</td><td><button type="button" class="ghost piccolo ia-nodulo" data-p="${l.centro.map((x) => x.toFixed(1)).join(',')}">vai</button></td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="small muted">Aree oltre 3 deviazioni robuste dal parenchima, a più di 4 mm dalla superficie del cervello; «nuova» = nel precedente allineato lo stesso punto non era iperintenso. Stima didattica: falsi positivi (plessi corioidei, flusso, bordi dei ventricoli) e lesioni piccole perse; controlla sempre sulle immagini.</p>`;
  $('#sm-chiudi').onclick = () => { box.hidden = true; };
  $('#sm-occhio').onclick = () => { SM.nascoste = !SM.nascoste; pannelloSM(); disegna(); };
  legaTrascinaPannello(box);
}
// ---- encefalo raddrizzato in automatico: piano medio-sagittale per simmetria destra-sinistra (rotazioni attorno
// all'asse cranio-caudale e antero-posteriore), poi l'asse antero-posteriore del cervello nel piano medio (vicino alla
// linea fronto-meatale / bicommissurale) per l'inclinazione. Si crea la serie assiale raddrizzata (come «⊞ Serie»).
async function raddrizzaEncefalo(k = V.attivo, { auto = false } = {}) {
  const p = P(k); if (!p.img?.ipp || p.piano || !pianoPossibile(p)) { if (!auto) avvisoBreve('Serve una serie volumetrica TC o RM dell\'encefalo'); return false; }
  const si = p.sIdx, box = $('#caricamento'), stato = (t) => { box.hidden = false; box.textContent = t; };
  try {
    const vol = await volumeDi(si, (a, b) => stato(`Raddrizzo l'encefalo: leggo ${a}/${b}`));
    stato('Raddrizzo l\'encefalo: simmetria…'); await pausa(20);
    const tc = /CT/.test(vol.meta.modalita || ''), { W, H, N, dati, sp } = vol;
    const lo = tc ? -100 : 0, hi = tc ? 120 : Infinity, testa = (v) => (tc ? v > -300 : v > 0);
    const st = tc ? null : statRobuste(vol), soglia = tc ? -300 : st.t0;
    const passo = [Math.max(1, Math.round(4 / sp[0])), Math.max(1, Math.round(4 / sp[1])), Math.max(1, Math.round(4 / sp[2]))];
    const punti = []; let c = [0, 0, 0];
    for (let kk = 0; kk < N; kk += passo[2]) for (let j = 0; j < H; j += passo[1]) for (let i = 0; i < W; i += passo[0]) {
      const v = dati[(kk * H + j) * W + i]; if (!(v > soglia)) continue;
      const q = vxPaz(vol, i, j, kk); punti.push({ q, v: Math.min(hi, Math.max(lo, v)) }); c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; }
    if (punti.length < 500) throw new Error('testa non riconosciuta');
    c = c.map((x) => x / punti.length);
    const camp = punti.filter((_, i) => i % Math.max(1, Math.floor(punti.length / 5000)) === 0);
    const val = (q) => { const [x, y, z] = pazVx(vol, q).map(Math.round); if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= N) return null; const v = dati[(z * H + y) * W + x]; return testa(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
    const Rzy = (yaw, roll) => { const a = yaw * Math.PI / 180, b = roll * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), -Math.sin(b)]; };
    const corr = (nrm, d) => { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (const pt of camp) { const e = (pt.q[0] - c[0]) * nrm[0] + (pt.q[1] - c[1]) * nrm[1] + (pt.q[2] - c[2]) * nrm[2] - d;
        const r = [pt.q[0] - 2 * e * nrm[0], pt.q[1] - 2 * e * nrm[1], pt.q[2] - 2 * e * nrm[2]], v = val(r); if (v == null) continue;
        n++; sa += pt.v; sb += v; saa += pt.v * pt.v; sbb += v * v; sab += pt.v * v; }
      if (n < camp.length * 0.5) return -1; const cv = sab / n - (sa / n) * (sb / n), va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2; return cv / Math.sqrt(Math.max(1e-9, va * vb)); };
    let best = { yaw: 0, roll: 0, d: 0, r: corr(Rzy(0, 0), 0) };
    for (let yaw = -20; yaw <= 20; yaw += 4) for (let roll = -20; roll <= 20; roll += 4) { const r = corr(Rzy(yaw, roll), 0); if (r > best.r) best = { yaw, roll, d: 0, r }; }
    for (const pa of [2, 1, 0.5]) for (let giro = 0, meglio = true; meglio && giro < 10; giro++) { meglio = false;
      for (const [dy, dr, dd] of [[pa, 0, 0], [-pa, 0, 0], [0, pa, 0], [0, -pa, 0], [0, 0, 2 * pa], [0, 0, -2 * pa]]) {
        const t = { yaw: best.yaw + dy, roll: best.roll + dr, d: best.d + dd }; const r = corr(Rzy(t.yaw, t.roll), t.d); if (r > best.r + 1e-4) { best = { ...t, r }; meglio = true; } } await pausa(0); }
    if (best.r < 0.4) throw new Error('simmetria non trovata');
    let Hh = Rzy(best.yaw, best.roll); if (Hh[0] < 0) Hh = Hh.map((x) => -x);
    const cm = [c[0] + best.d * Hh[0], c[1] + best.d * Hh[1], c[2] + best.d * Hh[2]];
    // inclinazione: asse principale del cervello nel piano medio (direzioni y' antero-posteriore e z' cranio-caudale)
    let y1 = [0, 1, 0]; y1 = unit3(y1.map((x, i) => x - dot3(y1, Hh) * Hh[i])); const z1 = unit3(croce3(Hh, y1));
    let syy = 0, szz = 0, syz = 0, nn = 0;
    const cerv = punti.filter((pt) => (tc ? pt.v > 15 && pt.v < 60 : pt.v > st.med - st.mad && pt.v < st.med + 2 * st.mad));
    const zc = cerv.reduce((a, pt) => a + dot3([pt.q[0] - cm[0], pt.q[1] - cm[1], pt.q[2] - cm[2]], z1), 0) / Math.max(1, cerv.length);
    for (const pt of cerv) { const e = [pt.q[0] - cm[0], pt.q[1] - cm[1], pt.q[2] - cm[2]], yy = dot3(e, y1), zz = dot3(e, z1); if (zz < zc - 10) continue; syy += yy * yy; szz += zz * zz; syz += yy * zz; nn++; }
    let phi = 0.5 * Math.atan2(2 * syz, syy - szz) * 180 / Math.PI; phi = Math.max(-25, Math.min(25, phi));
    const ph = phi * Math.PI / 180, Dn = unit3(y1.map((x, i) => x * Math.cos(ph) + z1[i] * Math.sin(ph))), S = unit3(croce3(Hh, Dn));
    const pv = { normale: S.map((x) => -x), su: Dn.map((x) => -x), centro: cm };
    box.hidden = true;
    await serieDalPiano(si, pv, 'assiale', k);
    const gradi = (u, v) => Math.round(Math.acos(Math.min(1, Math.abs(dot3(u, v)))) * 180 / Math.PI);
    avvisoBreve(`🧠 Encefalo raddrizzato (stima automatica: ${gradi(Hh, [1, 0, 0])}° di lato, ${Math.round(Math.abs(phi))}° di inclinazione). Ax per le immagini originali.`);
    T.raddrizzato = true; return true;
  } catch (e) { if (!auto) avvisoBreve('Encefalo non raddrizzato: ' + e.message); console.warn('raddrizza', e); return false; }
  finally { box.hidden = true; }
}
function aggiornaPulsantiNeuro() {
  const neuro = typeof esameNeuro === 'function' && esameNeuro();
  if ($('#btn-raddrizza')) $('#btn-raddrizza').hidden = !neuro;
  if ($('#btn-sm')) $('#btn-sm').hidden = !neuro || !V.serie.some((s) => ['FLAIR', 'STIR', 'T2'].includes(tipoSequenza(s.descrizione).tipo));
}
function aggiornaWorkspaceFasi() {""")

# pulsante SM nelle disposizioni
rep("""  box.hidden = !box.querySelector('button');
  box.querySelector('.ws-tit').textContent = 'Disposizioni';""", """  if (serieSM()) { const b = Object.assign(document.createElement('button'), { textContent: 'SM: T1 · FLAIR di ogni esame', title: 'Per ogni RM dell\\'encefalo (fino a 4, dalla più recente) il T1 sopra e il FLAIR/STIR sotto: 8 riquadri su due righe, allineati e sincronizzati' }); b.onclick = () => apriDisposizioneSM(); box.appendChild(b); }
  aggiornaPulsantiNeuro();
  box.hidden = !box.querySelector('button');
  box.querySelector('.ws-tit').textContent = 'Disposizioni';""")

# disegno delle lesioni
rep("disegnaSegno(k, g); disegnaNoduli(k, g); }", "disegnaSegno(k, g); disegnaNoduli(k, g); disegnaSM(k, g); }")
# pulsanti
rep("$('#btn-noduli')?.addEventListener('click', () => {", """$('#btn-sm')?.addEventListener('click', () => { if (SM.lesioni && $('#sm-pannello').hidden && SM.si === P().sIdx) { pannelloSM(); return; } lesioniSM(); });
$('#btn-raddrizza')?.addEventListener('click', () => raddrizzaEncefalo());
$('#btn-noduli')?.addEventListener('click', () => {""")
# nuovo caso: si azzerano le lesioni
rep("V.offset = {}; V.allinea = null; COREG.provati.clear();", "V.offset = {}; V.allinea = null; COREG.provati.clear(); SM.lesioni = null; if ($('#sm-pannello')) $('#sm-pannello').hidden = true;")
open(p, 'w').write(s)

# index.html: pulsanti e riquadri 6 e 8
p = W + '/index.html'; h = open(p).read(); shutil.copy(p, p + '.bak_1111neuro')
a = '<option value="3">▢ 3</option><option value="4">▢ 4</option>'
assert h.count(a) == 1
h = h.replace(a, a + '<option value="6">▢ 6</option><option value="8">▢ 8</option>')
i = h.index('<button id="btn-noduli"')
h = h[:i] + ('<button id="btn-raddrizza" class="ico" type="button" hidden aria-label="Raddrizza l\'encefalo" title="Encefalo raddrizzato: piano medio-sagittale per simmetria e inclinazione sull\'asse antero-posteriore del cervello (stima automatica); Ax per le immagini originali"><b style="font-size:12px;line-height:18px">🧠⟂</b></button>\n        '
             '<button id="btn-sm" class="ico" type="button" hidden aria-label="Lesioni sclerosi multipla" title="Lesioni iperintense FLAIR/STIR (stima automatica) e confronto con il precedente: in rosso le nuove"><b style="font-size:12px;line-height:18px">🧠 SM</b></button>\n        ') + h[i:]
a = '<div id="nod-pannello" class="eco-pannello cfia-pannello nod-pannello" hidden></div>'
assert h.count(a) == 1
h = h.replace(a, a + '\n<div id="sm-pannello" class="eco-pannello cfia-pannello sm-pannello" hidden></div>')
open(p, 'w').write(h)

p = W + '/style.css'; c = open(p).read()
c += """/* 11/11: pannello delle lesioni SM con elenco scorrevole */
.sm-pannello .sm-lista{max-height:40vh;overflow:auto}
"""
open(p, 'w').write(c)
print('patch applicata')

# 7) il precedente si ricostruisce anche su un attuale raddrizzato (immagini virtuali) e il confronto non perde il raddrizzamento
p = W + '/app.js'; s = open(p).read()
rep("  const r = f.resl, im = decodificaDicom(await caricaRaw(r.src));",
    "  const r = f.resl, im = r.src.virt ? (r.src.obl ? fettaObliqua(r.src.vol, r.src.obl, r.src.t) : fettaPiano(r.src.vol, r.src.piano, r.src.t)) : decodificaDicom(await caricaRaw(r.src));")
rep("|| a.img.rgb || b.img.rgb || a.piano || (b.piano && b.piano !== 'riallineato')) {",
    "|| a.img.rgb || b.img.rgb || (a.piano && a.piano !== 'obliqua') || (b.piano && b.piano !== 'riallineato')) {")
rep("""  await impostaRiquadri(2);
  await selezionaSerie(curIdx, 0); await selezionaSerie(scelta, 1);""", """  const dritto = P(0).piano === 'obliqua' && P(0).sIdx === curIdx ? { frames: P(0).frames, idx: P(0).idx } : null;   // encefalo raddrizzato: resta
  await impostaRiquadri(2);
  await selezionaSerie(curIdx, 0); await selezionaSerie(scelta, 1);
  if (dritto) { const a0 = P(0); a0.token++; a0.piano = 'obliqua'; a0.frames = dritto.frames; a0.cache.clear(); a0.img = null; await mostraDi(0, dritto.idx, { sincro: false }); }""")
# 8) in automatico all'apertura degli esami dell'encefalo (1×1, serie assiale volumetrica)
rep("function aggiornaPulsantiNeuro() {", """async function autoNeuro() {
  try {
    if (!esameNeuro() || V.n !== 1 || MPR.attivo) return;
    const p = P(0); if (!p.img?.ipp || p.piano || p.frames.length < 40 || pianoNativo(p.img) !== 'assiale' || !/^(CT|MR)$/.test(p.img.modalita || '')) return;
    await raddrizzaEncefalo(0, { auto: true });
  } catch (e) { console.warn('raddrizzamento automatico', e); }
}
function aggiornaPulsantiNeuro() {""")
rep("      await apriCaso(decodeURIComponent(id));   // 11/11: all'apertura un solo riquadro (niente confronto automatico)",
    "      await apriCaso(decodeURIComponent(id));   // 11/11: all'apertura un solo riquadro (niente confronto automatico)\n      autoNeuro();")
rep("    if (!CL.finestra) await disposizioneClient();   // 11/11: 1×1 all'apertura, salvo una disposizione salvata dall'utente",
    "    if (!CL.finestra) { await disposizioneClient(); autoNeuro(); }   // 11/11: 1×1 all'apertura, salvo una disposizione salvata dall'utente")
open(p, 'w').write(s)
print('patch 7-8 applicata')
