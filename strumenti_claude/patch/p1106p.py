# 1.212: scheda della RM cardiaca rifatta (risultati in evidenza, passi numerati, misure fuori dai limiti,
# misure nel referto)
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)
a = open(R + 'web/app.js', encoding='utf-8').read()

INIZIO = '  box.innerHTML = `<div class="riga eco-testa" title="Trascina per spostare il pannello"><b>❤ RM cardiaca</b>'
FINE = 'Controlla sempre i contorni: il bordo automatico è un aiuto, non una misura certificata.</p>`;'
i, j = a.find(INIZIO), a.find(FINE)
if i < 0 or j < 0 or a.count(INIZIO) != 1 or a.count(FINE) != 1 or j < i: sys.exit('ERRORE: modello della scheda non trovato')
j += len(FINE)

NUOVO = r'''  const K = cifreCmr(), RM = righeMisureCmr(K), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x)), fuori = RM.filter((r) => r.fuori);
  const trovaR = (id) => RM.find((r) => r.id === id), freccia = (r) => (r.fuori === 'alto' ? '↑' : r.fuori === 'basso' ? '↓' : '');
  const tile = (r, tit) => (r ? `<div class="cmr-kpi ${r.fuori ? 'ko' : r.rif ? 'ok' : ''}" title="${esc(r.rifT ? 'Riferimento ' + r.rifT : '')}"><span class="k-tit">${tit}</span><b class="k-val">${esc(r.testo)}${r.fuori ? ` <span class="k-freccia">${freccia(r)}</span>` : ''}</b><span class="k-sub">${esc(r.sub)}</span></div>` : '');
  const feVs = trovaR('vs_fe');
  box.innerHTML = `<div class="riga eco-testa cmr-testa" title="${FIN_ALTRE.cmr ? '' : 'Trascina per spostare il pannello'}"><b>❤ RM cardiaca</b><span class="eco-breve small ${feVs?.fuori ? 'ko' : 'muted'}">${esc(CMR.stato || (feVs ? `FE VS ${feVs.testo}${feVs.fuori ? ' ' + freccia(feVs) : ''}` : ''))}</span><span class="spacer"></span><button class="ghost piccolo" id="cmr-finestra" title="${FIN_ALTRE.cmr ? 'Rimetti la scheda nella pagina' : 'Apri la scheda in una finestra separata (spostala su un altro monitor)'}">${FIN_ALTRE.cmr ? '⤓' : '⧉'}</button><button class="ghost piccolo" id="cmr-riduci" title="Riduci o espandi">${CMR.ridotto ? '▴' : '▾'}</button><button class="ghost piccolo" id="cmr-chiudi" title="Chiudi">✕</button></div>
    ${eco ? `<p class="avviso small" id="cmr-multieco">${esc(MSG_MULTIECO)}</p>` : CMR.noSax ? `<p class="avviso small" id="cmr-nosax">${esc(msgNoSax())}</p>` : ''}
    ${K.vs || K.vd ? `<div class="cmr-kpis">${tile(feVs, 'FE VS')}${tile(trovaR('vs_edv'), 'VTD VS')}${tile(trovaR('vd_fe'), 'FE VD')}${trovaR('vs_massa') ? tile(trovaR('vs_massa'), 'Massa VS') : tile(trovaR('vd_edv'), 'VTD VD')}</div>
      ${fuori.length ? `<p class="cmr-allarme">⚠ Fuori dai limiti di riferimento: ${esc(fuori.map((r) => `${r.breve} ${r.fuori === 'alto' ? '↑' : '↓'}`).join(', '))}</p>` : ''}`
      : '<p class="cmr-vuoto small">Traccia i ventricoli (passo 1) per vedere qui frazione di eiezione, volumi e massa, con i valori fuori dai limiti segnalati.</p>'}
    <section class="cmr-sez"><h4><span class="cmr-n">1</span> Contorni</h4>
      <div class="riga"><button class="piccolo cmr-auto" id="cmr-auto" title="Trova da solo le cavità dei due ventricoli sulla pila di asse corto e le segue in tutte le fette e le fasi"${CMR.lavoro || eco ? ' disabled' : ''}>✳ Traccia VS e VD in automatico</button></div>
      <div class="eco-scelte"><select id="cmr-modo" aria-label="Misura">${Object.entries({ vs: '1 · VS: clic nella cavità', vd: '2 · VD: clic nella cavità', man: 'Correggi un contorno a mano', epi: '3 · Epicardio del VS (massa)', flusso: '4 · Flusso (contrasto di fase)', anulus: '5 · Escursione dell\'anulus (MAPSE, TAPSE)', atrio: '6 · Atri (area e volume)', lge: '7 · Enhancement tardivo (LGE)' }).map(([k, n]) => `<option value="${k}"${k === CMR.modo ? ' selected' : ''}>${n}</option>`).join('')}</select>
        ${CMR.modo === 'anulus' ? `<select id="cmr-anulus">${Object.entries({ 'mapse-s': 'MAPSE settale', 'mapse-l': 'MAPSE laterale', tapse: 'TAPSE' }).map(([k, n]) => `<option value="${k}"${k === CMR.anulus.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
        ${CMR.modo === 'atrio' ? `<select id="cmr-atrio">${Object.entries({ as4: 'Atrio sinistro · 4 camere', as2: 'Atrio sinistro · 2 camere', ad4: 'Atrio destro · 4 camere' }).map(([k, n]) => `<option value="${k}"${k === CMR.atrio.vista ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
        ${CMR.modo === 'lge' ? `<select id="cmr-lgen" title="Soglia: media del remoto + n DS">${[2, 3, 5, 6].map((n) => `<option value="${n}"${n === CMR.lge.n ? ' selected' : ''}>${n} DS</option>`).join('')}</select><span class="small">passo: <b>${{ epi: '1 epicardio', endo: '2 endocardio', remoto: '3 remoto' }[CMR.lge.fase]}</b></span>` : ''}
        ${CMR.modo === 'man' ? `<select id="cmr-manv"><option value="vs"${CMR.manV !== 'vd' ? ' selected' : ''}>VS</option><option value="vd"${CMR.manV === 'vd' ? ' selected' : ''}>VD</option></select>` : ''}</div>
      <p class="small muted cmr-aiuto">${esc(AIUTO_CMR[CMR.modo])}${CMR.punti.length ? ` <b>${CMR.punti.length} punti.</b>` : ''}</p>
      <div class="cmr-soglia small"><label title="Soglia tra sangue e miocardio: più bassa = cavità più grande">Soglia <input type="range" id="cmr-k" min="0.35" max="0.75" step="0.05" value="${CMR.k}"> <b>${virgola(CMR.k, 2)}</b></label>
        <label><input type="checkbox" id="cmr-riempi"${CMR.riempi ? ' checked' : ''}> papillari e trabecole nella cavità del VS</label></div></section>
    ${CMR.sax ? `<section class="cmr-sez"><h4><span class="cmr-n">2</span> Fasi e fette</h4>
      <div class="small muted">${CMR.sax.length} fette di asse corto · ${virgola(CMR.passo, 1)} mm tra le fette · ${nf} fasi${fase ? ` · aperta: <b>${fase}</b>` : ''}</div>
      ${CMR.ed != null ? `<div class="cmr-fasi small"><label>Fine diastole <select id="cmr-ed">${opz(CMR.ed)}</select></label><button class="ghost piccolo" id="cmr-vai-ed" title="Vai alla fine diastole">Vai</button>
        <label>Fine sistole <select id="cmr-es">${opz(CMR.es)}</select></label><button class="ghost piccolo" id="cmr-vai-es" title="Vai alla fine sistole">Vai</button></div>
        ${htmlCurvaCmr()}<div class="cmr-legenda small"><span style="--c:${CMR_COL.vs}">VS</span><span style="--c:${CMR_COL.vd}">VD</span><span class="muted">volume nel ciclo</span></div>` : ''}
      ${righeTab ? `<div class="cmr-tab-box"><table class="tab eco-tab"><thead><tr><th>Fetta</th><th>VS cm² FD/FS</th><th>VD cm² FD/FS</th><th>Epi</th></tr></thead><tbody>${righeTab}</tbody></table></div><p class="muted small">Spunta solo le fette con il ventricolo (alla base escludi quelle con l'atrio o il tratto di efflusso).</p>` : ''}</section>` : ''}
    <section class="cmr-sez"><h4><span class="cmr-n">${CMR.sax ? 3 : 2}</span> Paziente e altre misure</h4>
      <div class="eco-scelte small cmr-paz"><label>Sesso <select id="cmr-sesso"><option value="">—</option><option value="M"${CMR.sesso === 'M' ? ' selected' : ''}>Uomo</option><option value="F"${CMR.sesso === 'F' ? ' selected' : ''}>Donna</option></select></label>
        <label>Altezza <input type="number" id="cmr-h" min="100" max="230" value="${CMR.altezza ?? ''}" style="width:64px"> cm</label><label>Peso <input type="number" id="cmr-w" min="20" max="250" value="${CMR.peso ?? ''}" style="width:64px"> kg</label>${ris.bsa ? `<span class="cmr-sc">SC ${virgola(ris.bsa, 2)} m²</span>` : ''}</div>
      ${!ris.bsa ? '<p class="small muted">Con altezza e peso i volumi e la massa si indicizzano e si confrontano con i limiti di riferimento.</p>' : ''}
      ${CMR.modo === 'flusso' ? `<div class="eco-scelte small"><label>venc <input type="number" id="cmr-venc" min="10" max="800" value="${CMR.flusso.venc ?? ''}" style="width:64px"> cm/s</label><label><input type="checkbox" id="cmr-segno"${CMR.flusso.segno < 0 ? ' checked' : ''}> inverti il verso</label></div>` : ''}
      <details class="small" id="cmr-ecv-box"${CMR.ecvAperto ? ' open' : ''}><summary>T1 e volume extracellulare (ECV)</summary>
        <p class="muted">Misura con la ROI (strumento ROI) il T1 in ms del setto e del sangue nelle mappe T1 prima e dopo il gadolinio e scrivi i valori.</p>
        <div class="eco-scelte">${[['t1m', 'T1 miocardio pre'], ['t1b', 'T1 sangue pre'], ['t1mp', 'T1 miocardio post'], ['t1bp', 'T1 sangue post'], ['hct', 'Ematocrito %']].map(([k, n]) => `<label>${n} <input type="number" data-ecv="${k}" value="${CMR.ecv[k] ?? ''}" style="width:64px"></label>`).join('')}</div></details></section>
    ${RM.length || altre.length ? `<section class="cmr-sez cmr-risultati"><h4>📊 Risultati</h4>
      ${RM.length ? `<table class="tab cmr-ris-tab"><thead><tr><th>Misura</th><th>Valore</th><th>Indicizzato</th><th>Riferimento</th></tr></thead><tbody>${RM.map((r) => `<tr class="${r.fuori ? 'fuori' : ''}"><td>${esc(r.nome)}</td><td class="num">${esc(r.testo)}${r.fuori ? ` <b>${freccia(r)}</b>` : ''}</td><td class="num">${esc(r.idx)}</td><td class="num muted">${esc(r.rifT)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${altre.length ? `<ul class="small eco-ris">${altre.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="muted small">Riferimenti: adulti, bSSFP, ${CMR.sesso === 'M' ? 'uomini' : CMR.sesso === 'F' ? 'donne' : 'sesso non indicato (limiti più larghi tra i due sessi)'}; Kawel-Boehm et al., J Cardiovasc Magn Reson 2020.</p></section>` : ''}
    <div class="cmr-azioni"><button class="piccolo primario" id="cmr-copia" title="Porta nel referto la tabella delle misure, con i riferimenti e i valori fuori dai limiti"${RM.length || altre.length ? '' : ' disabled'}>📋 Misure nel referto</button><button class="ghost piccolo" id="cmr-modello" title="Inserisce nel referto lo schema del referto di RM cardiaca con le misure fatte">Modello di referto</button><button class="ghost piccolo" id="cmr-bull" title="Cinetica segmentaria del VS (17 segmenti) e frazione di eiezione nella scheda Σ">Cinetica (Σ)</button>${ris.righe.length || Object.keys(CMR.lge.fette).length ? '<button class="ghost piccolo" id="cmr-azzera">Cancella le misure</button>' : ''}</div>
    <details class="small cmr-note"><summary>Metodo e riferimenti</summary><p class="muted">Volumi: somma delle aree × distanza tra le fette (Simpson sulla pila di asse corto). FE del VS: ≤ 40% ridotta, 41-49% lievemente ridotta, ≥ 50% conservata (ESC 2021). Limiti di riferimento (media ± 2 DS, adulti, bSSFP): Kawel-Boehm et al., J Cardiovasc Magn Reson 2020, tabella 2 per il VS (papillari nella massa) e tabella 10 per il VD; dipendono anche dall'età e dal metodo (papillari nella cavità o nella massa). Controlla sempre i contorni: il bordo automatico è un aiuto, non una misura certificata.</p></details>`;'''
a = a[:i] + NUOVO + a[j:]

FUNZ = r'''// ---- RM cardiaca: cifre principali, limiti di riferimento e misure per il referto
// Adulti, bSSFP, media ± 2 DS (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020: VS tabella 2, papillari nella massa;
// VD tabella 10). Volumi e massa indicizzati sulla superficie corporea (Mosteller).
const RIF_CMR = {
  M: { vs_edv: [50, 108], vs_esv: [11, 47], vs_fe: [49, 79], vs_massa: [39, 85], vd_edv: [53, 123], vd_esv: [17, 59], vd_fe: [42, 72] },
  F: { vs_edv: [50, 96], vs_esv: [10, 40], vs_fe: [52, 79], vs_massa: [30, 68], vd_edv: [48, 104], vd_esv: [13, 48], vd_fe: [46, 74] },
};
function cifreCmr() {
  const out = { bsa: CM.superficieCorporea(CMR.altezza, CMR.peso) };
  if (CMR.ed == null || CMR.es == null) return out;
  for (const v of ['vs', 'vd']) {
    const vol = volumiCmr(v); if (!vol || !(vol[CMR.ed] > 0)) continue;
    const edv = vol[CMR.ed], esv = vol[CMR.es];
    out[v] = { edv, esv, sv: edv - esv, fe: (edv - esv) / edv * 100 };
    if (v === 'vs' && CMR.sax) {
      const incl = CMR.sax.filter((x) => inclusa('vs', x.si)), conEpi = incl.filter((x) => CMR.epi[x.si]);
      if (conEpi.length && conEpi.length === incl.length) out.vs.massa = incl.reduce((s, x) => s + Math.max(0, CMR.epi[x.si].area - areaCmr('vs', x.si, CMR.ed)), 0) * CMR.passo / 1000 * 1.05;
    }
  }
  return out;
}
function rifCmr(id) {
  const m = RIF_CMR.M[id], f = RIF_CMR.F[id]; if (!m) return null;
  return CMR.sesso === 'M' ? m : CMR.sesso === 'F' ? f : [Math.min(m[0], f[0]), Math.max(m[1], f[1])];
}
function righeMisureCmr(K) {
  const out = [], f0 = (x, n = 0) => virgola(x, n), bsa = K.bsa;
  const fuoriDa = (x, r) => (r && x != null ? (x < r[0] ? 'basso' : x > r[1] ? 'alto' : null) : null);
  for (const v of ['vs', 'vd']) {
    const d = K[v]; if (!d) continue;
    const S = v === 'vs' ? 'VS' : 'VD', nomeV = v === 'vs' ? 'ventricolo sinistro' : 'ventricolo destro';
    { const r = rifCmr(v + '_fe'), fu = fuoriDa(d.fe, r);
      out.push({ id: v + '_fe', nome: `Frazione di eiezione del ${nomeV}`, breve: `FE ${S} ${f0(d.fe)}%`, testo: `${f0(d.fe)}%`, idx: '', rif: r, rifT: r ? `${r[0]}–${r[1]}%` : '', fuori: fu,
        sub: fu ? `fuori dai limiti (${r[0]}–${r[1]}%)` : v === 'vs' ? (d.fe <= 40 ? 'ridotta' : d.fe < 50 ? 'lievemente ridotta' : 'conservata') : 'nei limiti' }); }
    for (const [k, nome, x] of [['edv', 'Volume telediastolico', d.edv], ['esv', 'Volume telesistolico', d.esv], ['sv', 'Gittata sistolica', d.sv]]) {
      const r = k === 'sv' ? null : bsa ? rifCmr(`${v}_${k}`) : null, xi = bsa ? x / bsa : null, fu = fuoriDa(xi, r);
      out.push({ id: `${v}_${k}`, nome: `${nome} del ${nomeV}`, breve: `${k === 'edv' ? 'VTD' : k === 'esv' ? 'VTS' : 'GS'} ${S} ${bsa ? f0(xi) + ' mL/m²' : f0(x) + ' mL'}`, testo: `${f0(x)} mL`, idx: bsa ? `${f0(xi)} mL/m²` : '', rif: r, rifT: r ? `${r[0]}–${r[1]} mL/m²` : '', fuori: fu,
        sub: fu ? `${f0(xi)} mL/m² · fuori dai limiti` : bsa ? `${f0(xi)} mL/m²${r ? ' · nei limiti' : ''}` : 'non indicizzato' });
    }
    if (v === 'vs' && d.massa != null) {
      const r = bsa ? rifCmr('vs_massa') : null, xi = bsa ? d.massa / bsa : null, fu = fuoriDa(xi, r);
      out.push({ id: 'vs_massa', nome: 'Massa del ventricolo sinistro', breve: `massa VS ${bsa ? f0(xi) + ' g/m²' : f0(d.massa) + ' g'}`, testo: `${f0(d.massa)} g`, idx: bsa ? `${f0(xi)} g/m²` : '', rif: r, rifT: r ? `${r[0]}–${r[1]} g/m²` : '', fuori: fu,
        sub: fu ? `${f0(xi)} g/m² · fuori dai limiti` : bsa ? `${f0(xi)} g/m² · nei limiti` : 'non indicizzata' });
    }
  }
  return out;
}
// misure per il referto: elenco (entra anche nel PDF, in Word e nella stampa) e testo semplice
function misureRefertoCmr(ris) {
  const RM = righeMisureCmr(cifreCmr()), altre = ris.righe.filter((x) => !/^Ventricolo (sinistro|destro):/.test(x));
  const sesso = CMR.sesso === 'M' ? 'uomini' : CMR.sesso === 'F' ? 'donne' : 'sesso non indicato';
  const riga = (r) => `${r.nome}: ${r.testo}${r.idx ? ` (${r.idx})` : ''}${r.rifT ? ` · riferimento ${r.rifT}` : ''}`;
  const segno = (r) => (r.fuori === 'alto' ? '↑ sopra il limite' : r.fuori === 'basso' ? '↓ sotto il limite' : '');
  const fonte = `Riferimenti: adulti, bSSFP, ${sesso} (Kawel-Boehm et al., J Cardiovasc Magn Reson 2020). Volumi con il metodo di Simpson sulla pila di asse corto.`;
  const fuori = RM.filter((r) => r.fuori);
  const html = `<h3>Misure di RM cardiaca</h3><ul>${RM.map((r) => `<li>${esc(riga(r))}${r.fuori ? ` — <b>${segno(r)}</b>` : ''}</li>`).join('')}${altre.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    + (fuori.length ? `<p><b>Fuori dai limiti di riferimento:</b> ${esc(fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; '))}.</p>` : '')
    + `<p><i>${esc(fonte)}</i></p>`;
  const testo = ['MISURE DI RM CARDIACA', ...RM.map((r) => `- ${riga(r)}${r.fuori ? ' — ' + segno(r) : ''}`), ...altre.map((x) => `- ${x}`),
    ...(fuori.length ? [`Fuori dai limiti di riferimento: ${fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; ')}.`] : []), fonte].join('\n');
  return { html, testo, fuori };
}
'''
a = sost(a, "function pannelloCmr() {", FUNZ + "function pannelloCmr() {", 'funzioni cmr', 1) if a.count("function pannelloCmr() {") == 1 else sys.exit('pannelloCmr')

# referto: misure (elenco) e modello + misure; cmrAlReferto accetta testo e html
a = sost(a, "  $('#cmr-modello').onclick = () => cmrAlReferto(modelloRefertoCmr(ris), true);",
  "  $('#cmr-modello').onclick = () => { const m = misureRefertoCmr(ris), t = modelloRefertoCmr(ris) + (m.fuori.length ? `\\nValori fuori dai limiti di riferimento: ${m.fuori.map((r) => r.breve + (r.fuori === 'alto' ? ' ↑' : ' ↓')).join('; ')}.` : '');\n"
  "    cmrAlReferto({ testo: t + '\\n\\n' + m.testo, html: t.split('\\n').filter((r) => r.trim()).map((r) => `<p>${esc(r)}</p>`).join('') + m.html }); };\n"
  "  $('#cmr-sesso')?.addEventListener('change', (e) => { CMR.sesso = e.target.value || null; disegna(); pannelloCmr(); });", 'modello')
a = sost(a, "  $('#cmr-copia')?.addEventListener('click', () => cmrAlReferto(ris.righe.join('. ') + '.', false));",
  "  $('#cmr-copia')?.addEventListener('click', () => { const m = misureRefertoCmr(ris); cmrAlReferto({ testo: m.testo, html: m.html }); });", 'copia')
VECCHIA = a[a.find("async function cmrAlReferto(testo, aCapo) {"):a.find("function inserisciNelReferto(testo) {")]
if not VECCHIA: sys.exit('cmrAlReferto')
a = a.replace(VECCHIA, '''async function cmrAlReferto({ testo, html }) {
  if (CLIENT && !$('#dlg-referto')?.open) await apriReferto();
  if ($('#dlg-referto')?.open) { aggiungiAlEditor(html || String(testo).split('\\n').filter((r) => r.trim()).map((r) => `<p>${esc(r)}</p>`).join('')); salvaBozzaReferto(); avvisoBreve('Inserito nel referto.'); return; }
  const q = $('#q-referto'); if (!q) return;
  q.value = (q.value.trim() ? q.value.trim() + '\\n\\n' : '') + testo; q.closest('details')?.setAttribute('open', ''); q.dispatchEvent(new Event('input', { bubbles: true }));
  avvisoBreve('Inserito nel referto.');
}
''')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)

c = open(R + 'web/style.css', encoding='utf-8').read()
if '.cmr-kpis{' not in c:
    c += '''
/* 1.212 scheda RM cardiaca rifatta */
#cmr-pannello{width:min(460px,calc(100vw - 28px));max-height:80vh;padding:0 14px 0}
#cmr-pannello .cmr-testa{position:sticky;top:0;z-index:2;background:var(--pan);padding:10px 0 8px;margin:0;border-bottom:1px solid var(--bord);gap:6px}
#cmr-pannello .cmr-testa b{font-size:1.05em;white-space:nowrap}
#cmr-pannello .eco-breve.ko{color:var(--ko);font-weight:600}
.cmr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin:12px 0 8px}
.cmr-kpi{display:flex;flex-direction:column;gap:2px;padding:9px 11px;border-radius:12px;background:var(--pan2);border:1px solid var(--bord);border-left:4px solid var(--acc)}
.cmr-kpi.ok{border-left-color:var(--ok)}.cmr-kpi.ko{border-left-color:var(--ko);background:color-mix(in srgb,var(--ko) 9%,var(--pan2))}
.cmr-kpi .k-tit{font-size:.7em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.cmr-kpi .k-val{font-size:1.5em;line-height:1.1;font-variant-numeric:tabular-nums}
.cmr-kpi.ko .k-val,.cmr-kpi.ko .k-sub{color:var(--ko)}.cmr-kpi.ok .k-sub{color:var(--ok)}
.cmr-kpi .k-sub{font-size:.76em;color:var(--mut)}
.cmr-allarme{margin:4px 0 8px;padding:7px 10px;border-radius:9px;background:color-mix(in srgb,var(--ko) 12%,transparent);color:var(--ko);font-size:.88em;font-weight:600}
.cmr-vuoto{margin:12px 0;padding:12px;border:1px dashed var(--bord);border-radius:12px;text-align:center;color:var(--mut)}
.cmr-sez{border-top:1px solid var(--bord);padding:11px 0 8px}
.cmr-sez h4{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:.92em}
.cmr-n{display:inline-grid;place-items:center;width:21px;height:21px;border-radius:50%;background:var(--acc);color:#fff;font-size:.78em;font-weight:700;flex:none}
#cmr-pannello .eco-scelte{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
#cmr-pannello #cmr-modo{flex:1 1 220px;min-width:0}
#cmr-pannello .cmr-auto{width:100%;margin-bottom:6px;font-weight:600}
.cmr-aiuto{margin:6px 0;line-height:1.4}
.cmr-soglia{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;margin-top:4px}
.cmr-soglia input[type=range]{width:120px;vertical-align:middle}
.cmr-fasi{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 2px}
.cmr-fasi label{display:flex;align-items:center;gap:5px}
.cmr-fasi button+label{margin-left:8px}
.cmr-legenda{display:flex;gap:12px;align-items:center;margin-bottom:4px}
.cmr-legenda span[style]::before{content:"";display:inline-block;width:16px;height:3px;border-radius:2px;background:var(--c);margin-right:5px;vertical-align:middle}
.cmr-tab-box{max-height:240px;overflow:auto;border:1px solid var(--bord);border-radius:9px;margin:8px 0 4px}
#cmr-pannello .cmr-tab-box .eco-tab{width:100%;margin:0;border-collapse:collapse}
#cmr-pannello .cmr-tab-box thead th{position:sticky;top:0;background:var(--pan2);z-index:1}
.cmr-paz .cmr-sc{padding:2px 8px;border-radius:999px;background:var(--pan2);border:1px solid var(--bord)}
.cmr-ris-tab{width:100%;border-collapse:collapse;font-size:.86em;margin:2px 0 6px}
.cmr-ris-tab th{text-align:left;font-size:.8em;color:var(--mut);font-weight:600;border-bottom:1px solid var(--bord);padding:4px 6px}
.cmr-ris-tab td{padding:4px 6px;border-bottom:1px solid color-mix(in srgb,var(--bord) 60%,transparent)}
.cmr-ris-tab td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.cmr-ris-tab tr.fuori td{color:var(--ko);background:color-mix(in srgb,var(--ko) 8%,transparent)}
.cmr-ris-tab tr.fuori td:first-child{box-shadow:inset 3px 0 0 var(--ko)}
.cmr-azioni{position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;gap:6px;padding:10px 0 12px;margin-top:4px;background:var(--pan);border-top:1px solid var(--bord)}
.cmr-azioni .primario{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
.cmr-azioni .primario:disabled{opacity:.5}
.cmr-note{margin:2px 0 12px}.cmr-note summary{cursor:pointer;color:var(--mut)}
.eco-pannello.in-finestra#cmr-pannello{width:auto;max-height:none;padding:0 20px}
.in-finestra .cmr-tab-box{max-height:none}
.in-finestra .cmr-kpi .k-val{font-size:1.8em}
'''
    open(R + 'web/style.css', 'w', encoding='utf-8').write(c)

en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
for k, v in {
  'Contorni': 'Contours', 'Fasi e fette': 'Phases and slices', 'Paziente e altre misure': 'Patient and other measurements', '📊 Risultati': '📊 Results',
  'Metodo e riferimenti': 'Method and references', '📋 Misure nel referto': '📋 Measurements to report', 'Riduci o espandi': 'Collapse or expand',
  'Misura': 'Measurement', 'Valore': 'Value', 'Indicizzato': 'Indexed', 'Riferimento': 'Reference', 'Sesso': 'Sex', 'Uomo': 'Man', 'Donna': 'Woman',
  'volume nel ciclo': 'volume over the cycle', 'Vai': 'Go', 'Vai alla fine diastole': 'Go to end-diastole', 'Vai alla fine sistole': 'Go to end-systole',
  'FE VS': 'LV EF', 'FE VD': 'RV EF', 'VTD VS': 'LV EDV', 'VTD VD': 'RV EDV', 'Massa VS': 'LV mass',
  'conservata': 'preserved', 'lievemente ridotta': 'mildly reduced', 'ridotta': 'reduced', 'nei limiti': 'within limits', 'non indicizzato': 'not indexed', 'non indicizzata': 'not indexed',
  'fuori dai limiti ({x}–{x}%)': 'outside limits ({x}–{x}%)', '{x} mL/m² · fuori dai limiti': '{x} mL/m² · outside limits', '{x} mL/m² · nei limiti': '{x} mL/m² · within limits',
  '{x} g/m² · fuori dai limiti': '{x} g/m² · outside limits', '{x} g/m² · nei limiti': '{x} g/m² · within limits',
  '⚠ Fuori dai limiti di riferimento: {x}': '⚠ Outside reference limits: {x}',
  'Traccia i ventricoli (passo 1) per vedere qui frazione di eiezione, volumi e massa, con i valori fuori dai limiti segnalati.': 'Trace the ventricles (step 1) to see ejection fraction, volumes and mass here, with values outside the limits flagged.',
  'Con altezza e peso i volumi e la massa si indicizzano e si confrontano con i limiti di riferimento.': 'With height and weight, volumes and mass are indexed and compared with the reference limits.',
  '{x} fette di asse corto · {x} mm tra le fette · {x} fasi': '{x} short-axis slices · {x} mm between slices · {x} phases',
  'Porta nel referto la tabella delle misure, con i riferimenti e i valori fuori dai limiti': 'Add the measurement table to the report, with references and values outside the limits',
  'Frazione di eiezione del ventricolo sinistro': 'Left ventricular ejection fraction', 'Frazione di eiezione del ventricolo destro': 'Right ventricular ejection fraction',
  'Volume telediastolico del ventricolo sinistro': 'Left ventricular end-diastolic volume', 'Volume telesistolico del ventricolo sinistro': 'Left ventricular end-systolic volume',
  'Gittata sistolica del ventricolo sinistro': 'Left ventricular stroke volume', 'Volume telediastolico del ventricolo destro': 'Right ventricular end-diastolic volume',
  'Volume telesistolico del ventricolo destro': 'Right ventricular end-systolic volume', 'Gittata sistolica del ventricolo destro': 'Right ventricular stroke volume',
  'Massa del ventricolo sinistro': 'Left ventricular mass',
}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('scheda cmr OK')
