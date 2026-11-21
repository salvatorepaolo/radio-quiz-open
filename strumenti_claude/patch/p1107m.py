import shutil
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
L = C + 'api/logica.mjs'; A = C + 'web/app.js'; S = C + 'web/style.css'
for f in (L, A, S): shutil.copy(f, f + '.bak_1107m')

def sost(t, a, b, n=1):
    assert t.count(a) == n, (a[:90], t.count(a)); return t.replace(a, b)

l = open(L, encoding='utf-8').read()
l = sost(l, "const numero = (v, max) => {", r'''// statistiche personali dello studente: errori ricorrenti per esame (metodica e distretto) e per tipo di reperto,
// andamento nel tempo e ripasso mirato sui punti deboli. Contano i primi tentativi (come nel confronto con i colleghi).
export function statisticheStudente(mie, casiPerId, visibili) {
  const ord = [...mie].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const primi = {}, migliore = {};
  for (const r of ord) { if (!primi[r.caso]) primi[r.caso] = r; migliore[r.caso] = Math.max(migliore[r.caso] ?? 0, Number(r.punteggio) || 0); }
  const P = Object.values(primi).filter((r) => casiPerId[r.caso]);
  const tecnica = (c, o) => Number.isInteger(o.z) && /tecnica/i.test(c.sezioni?.[o.z]?.nome || '');
  // casi da proporre: prima quelli già sbagliati (da rifare), poi quelli non ancora svolti, dai più semplici
  const ORD = { Base: 0, Intermedio: 1, Avanzato: 2 };
  const daProporre = (ids) => { const vis = new Set(visibili.map((c) => c.id)), dif = Object.fromEntries(visibili.map((c) => [c.id, ORD[c.difficolta] ?? 1]));
    const l = [...new Set(ids)].filter((id) => vis.has(id) && (migliore[id] ?? -1) < 90);
    return l.sort((a, b) => ((migliore[a] ?? -1) >= 0 ? 0 : 1) - ((migliore[b] ?? -1) >= 0 ? 0 : 1) || (dif[a] - dif[b])).slice(0, 10); };
  // per esame
  const aree = {}; let vp = 0, fn = 0, fp = 0, vn = 0, punti = 0;
  for (const r of P) {
    const c = casiPerId[r.caso], zona = METODICA_BREVE(c) || 'Altro';
    const a = (aree[zona] ||= { zona, casi: 0, punti: 0, perfetti: 0, vp: 0, fn: 0, fp: 0, vn: 0 });
    a.casi++; a.punti += Number(r.punteggio) || 0; punti += Number(r.punteggio) || 0; if (r.perfetta) a.perfetti++;
    for (const o of r.opzioni || []) { if (tecnica(c, o)) continue; if (o.tipo === 'distrattore') { if (o.s) { a.fp++; fp++; } else { a.vn++; vn++; } } else if (o.s) { a.vp++; vp++; } else { a.fn++; fn++; } }
  }
  const pc = (x, y) => (x + y ? Math.round(100 * x / (x + y)) : null);
  const perEsame = Object.values(aree).map((a) => ({ zona: a.zona, casi: a.casi, media: Math.round(a.punti / a.casi), perfetti: a.perfetti, mancati: a.fn, inventati: a.fp,
    sens: pc(a.vp, a.fn), spec: pc(a.vn, a.fp), ripasso: daProporre(visibili.filter((c) => METODICA_BREVE(c) === a.zona).map((c) => c.id)) })).sort((x, y) => x.media - y.media);
  // per tipo di reperto e incrocio tipo × esame
  const matrice = analisiTemi(P, casiPerId).filter((t) => t.prove);
  const temi = {};
  for (const t of matrice) { const x = (temi[t.tema] ||= { tema: t.tema, nome: t.nome, prove: 0, errori: 0, mancati: 0, sbagliati: 0, zone: [] }); x.prove += t.prove; x.errori += t.errori; x.mancati += t.mancati; x.sbagliati += t.sbagliati; if (t.errori) x.zone.push({ zona: t.zona, perc: t.perc, errori: t.errori, prove: t.prove }); }
  const perTema = Object.values(temi).map((x) => ({ ...x, perc: x.prove ? Math.round(x.errori / x.prove * 100) : 0, zone: x.zone.sort((a, b) => b.perc - a.perc).slice(0, 3) })).sort((a, b) => b.perc - a.perc || b.errori - a.errori);
  // esempi degli errori (le frasi delle risposte), dai più recenti
  const esempi = {};
  for (const r of [...P].reverse()) { const c = casiPerId[r.caso], zona = METODICA_BREVE(c);
    for (const o of r.opzioni || []) { if (tecnica(c, o)) continue; const atteso = o.tipo !== 'distrattore'; if (atteso ? o.s : !o.s) continue;
      const t = temaOpzione(o.t || '', Number.isInteger(o.z) ? c.sezioni?.[o.z]?.nome || '' : ''); const k = `${t.k}|${zona}`;
      if ((esempi[k] ||= []).length < 3) esempi[k].push({ caso: r.caso, testo: String(o.t || '').slice(0, 160), tipo: atteso ? 'mancato' : 'inventato' }); } }
  // punti deboli: tipo di reperto in un esame con almeno 3 prove, 2 errori e il 30% di errori; con i casi per il ripasso mirato
  const deboli = matrice.filter((t) => t.tema !== 'altro' && t.prove >= 3 && t.errori >= 2 && t.perc >= 30).sort((a, b) => b.perc - a.perc || b.errori - a.errori).slice(0, 6)
    .map((t) => ({ tema: t.tema, nome: t.nome, zona: t.zona, prove: t.prove, errori: t.errori, mancati: t.mancati, sbagliati: t.sbagliati, perc: t.perc,
      esempi: esempi[`${t.tema}|${t.zona}`] || [], casi: daProporre([...t.casi, ...casiPerTema(visibili, t.tema, t.zona)]) }));
  // andamento mensile dei primi tentativi
  const mesi = {}; for (const r of P) { const m = String(r.data).slice(0, 7); const x = (mesi[m] ||= { mese: m, n: 0, punti: 0 }); x.n++; x.punti += Number(r.punteggio) || 0; }
  const andamento = Object.values(mesi).sort((a, b) => a.mese.localeCompare(b.mese)).slice(-12).map((x) => ({ mese: x.mese, casi: x.n, media: Math.round(x.punti / x.n) }));
  return { risposte: mie.length, casi: P.length, media: P.length ? Math.round(punti / P.length) : null, sens: pc(vp, fn), spec: pc(vn, fp), mancati: fn, inventati: fp,
    perEsame, perTema, matrice: matrice.map(({ tema, nome, zona, prove, errori, perc }) => ({ tema, nome, zona, prove, errori, perc })), deboli, andamento };
}
const numero = (v, max) => {''')
l = sost(l, "  // confronto anonimo con i colleghi per metodica (percentile, sensibilità, specificità)\n",
  """  // statistiche personali: errori ricorrenti per esame e per tipo di reperto, andamento e ripasso mirato
  if (parti[1] === 'io' && parti[2] === 'statistiche' && metodo === 'GET') {
    const [righe, casi] = await Promise.all([M.risultati(), M.elencoCasi()]);
    const mie = righe.filter((r) => r.account === io.id), perId = Object.fromEntries(casi.map((c) => [c.id, c]));
    return json(200, statisticheStudente(mie, perId, casi.filter((c) => visibile(c))));
  }
  // confronto anonimo con i colleghi per metodica (percentile, sensibilità, specificità)
""")
open(L, 'w', encoding='utf-8').write(l)

a = open(A, encoding='utf-8').read()
a = sost(a, "    else if (tipo === 'confronto' && CLOUD) { vista('confronto'); await apriConfronto(); }",
  "    else if (tipo === 'confronto' && CLOUD) { vista('confronto'); await apriConfronto(); }\n    else if (tipo === 'mie-statistiche' && CLOUD) { if (!ELENCO.length) ELENCO = await getJSON('/api/casi'); vista('confronto'); await apriStatistiche(); }")
a = sost(a, "const PAGINE_VISITA = new Set(['elenco', 'caso', 'editor', 'nuovo', 'aggiungi', 'analisi', 'esame', 'confronto',",
  "const PAGINE_VISITA = new Set(['elenco', 'caso', 'editor', 'nuovo', 'aggiungi', 'analisi', 'esame', 'confronto', 'mie-statistiche',")
a = sost(a, """    ${CLOUD && !ADMIN ? '<a class="btn ghost" href="#/confronto" title="Percentile, sensibilità e specificità per metodica, confrontati in forma anonima con gli altri iscritti">Confronto con i colleghi</a>' : ''}""",
  """    ${CLOUD && !ADMIN ? '<a class="btn ghost" href="#/mie-statistiche" title="Errori ricorrenti per esame e per tipo di reperto, andamento e ripasso mirato sui punti deboli">📊 Le mie statistiche</a>' : ''}
    ${CLOUD && !ADMIN ? '<a class="btn ghost" href="#/confronto" title="Percentile, sensibilità e specificità per metodica, confrontati in forma anonima con gli altri iscritti">Confronto con i colleghi</a>' : ''}""")
a = sost(a, "// ---------------------------------------------------------------- confronto anonimo con i colleghi\n", r"""// ---------------------------------------------------------------- statistiche personali e ripasso mirato
async function apriStatistiche() {
  const box = $('#confronto-corpo'); box.innerHTML = '<h1>Le mie statistiche</h1><p class="muted">Calcolo…</p>';
  let d; try { d = await getJSON('/api/io/statistiche'); } catch (e) { box.innerHTML = `<h1>Le mie statistiche</h1><p class="stato ko">${esc(e.message)}</p>`; return; }
  const tit = Object.fromEntries(ELENCO.map((c) => [c.id, c.titolo || c.id]));
  const col = (p) => (p == null ? 'var(--mut)' : p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--ko)');
  const colErr = (p) => (p >= 50 ? 'var(--ko)' : p >= 30 ? 'var(--warn)' : 'var(--ok)');
  const barra = (v, c) => `<span class="st-barra"><span style="width:${Math.max(2, v || 0)}%;background:${c}"></span></span>`;
  if (!d.casi) { box.innerHTML = `<h1>Le mie statistiche</h1><div class="vuoto">Non hai ancora risposto a nessun caso a scelta multipla: le statistiche compaiono dopo le prime risposte.</div><p><a href="#/">Torna all'elenco</a></p>`; return; }
  const RIP = {};   // id → casi del ripasso
  const btnRip = (id, casi, testo = 'Ripasso mirato') => { if (!casi?.length) return '<span class="muted small">nessun caso da proporre</span>'; RIP[id] = casi; return `<button class="primary piccolo" data-rip="${esc(id)}">${esc(testo)} · ${casi.length} ${casi.length === 1 ? 'caso' : 'casi'}</button>`; };
  // tutti i punti deboli insieme, a rotazione
  const insieme = []; { const code = d.deboli.map((x) => [...x.casi]); while (insieme.length < 12 && code.some((q) => q.length)) for (const q of code) { const id = q.shift(); if (id && !insieme.includes(id) && insieme.length < 12) insieme.push(id); } }
  const mesi = d.andamento, maxN = Math.max(1, ...mesi.map((m) => m.casi));
  const nomeMese = (m) => { const [y, mm] = m.split('-'); return `${['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][+mm - 1]} ${y.slice(2)}`; };
  const zone = [...new Set(d.matrice.map((x) => x.zona))], temiM = [...new Set(d.matrice.map((x) => x.nome))];
  const cella = (t, z) => { const x = d.matrice.find((m) => m.nome === t && m.zona === z); if (!x) return '<td class="st-vuota"></td>';
    return `<td class="st-cella" style="background:color-mix(in srgb,${colErr(x.perc)} ${Math.round(18 + x.perc * 0.6)}%,transparent)" title="${esc(t)} · ${esc(z)}: ${x.errori} errori su ${x.prove}">${x.prove >= 2 ? x.perc + '%' : '·'}</td>`; };
  box.innerHTML = `<h1>Le mie statistiche</h1>
    <p class="muted">${d.casi} casi a scelta multipla (primo tentativo di ogni caso; ${d.risposte} risposte in tutto). Gli errori sono le affermazioni corrette non scelte (<b>reperti persi</b>) e quelle sbagliate scelte (<b>reperti inventati</b>); le domande sulla tecnica dell'esame non contano.</p>
    <div class="esame-sintesi st-sintesi">
      <div><div class="grande" style="color:${col(d.media)}">${d.media}%</div><small>punteggio medio</small></div>
      <div><div class="grande" style="color:${col(d.sens)}">${d.sens ?? '—'}${d.sens != null ? '%' : ''}</div><small>sensibilità: reperti trovati</small></div>
      <div><div class="grande" style="color:${col(d.spec)}">${d.spec ?? '—'}${d.spec != null ? '%' : ''}</div><small>specificità: errori evitati</small></div>
      <div><div class="grande">${d.mancati} / ${d.inventati}</div><small>reperti persi / inventati</small></div>
    </div>
    <h2>🎯 Punti deboli e ripasso mirato</h2>
    ${d.deboli.length ? `<p>${btnRip('insieme', insieme, 'Ripasso su tutti i punti deboli')} <span class="muted small">prima i casi che hai sbagliato, poi casi nuovi che allenano gli stessi reperti</span></p>
      <div class="st-deboli">${d.deboli.map((x, i) => `<div class="st-debole"><div class="st-d-tit"><b>${esc(x.nome)}</b> <span class="muted">· ${esc(x.zona)}</span><span class="st-d-perc" style="color:${colErr(x.perc)}">${x.perc}%</span></div>
        <div class="small">${x.errori} errori su ${x.prove}: ${x.mancati ? `${x.mancati} ${x.mancati === 1 ? 'reperto perso' : 'reperti persi'}` : ''}${x.mancati && x.sbagliati ? ', ' : ''}${x.sbagliati ? `${x.sbagliati} ${x.sbagliati === 1 ? 'reperto inventato' : 'reperti inventati'}` : ''}</div>
        ${x.esempi.length ? `<ul class="st-esempi small">${x.esempi.map((e) => `<li><span class="st-tipo ${e.tipo}">${e.tipo === 'mancato' ? 'perso' : 'inventato'}</span> «${esc(e.testo)}» <a href="#/caso/${encodeURIComponent(e.caso)}">${esc(tit[e.caso] || 'caso')}</a></li>`).join('')}</ul>` : ''}
        <div>${btnRip('d' + i, x.casi)}</div></div>`).join('')}</div>`
      : '<div class="vuoto">Nessun punto debole evidente: servono almeno 3 prove dello stesso tipo di reperto nello stesso esame, con il 30% di errori.</div>'}
    <h2>Per esame</h2>
    <table class="tab st-tab"><thead><tr><th>Esame</th><th>Casi</th><th>Punteggio medio</th><th title="Reperti presenti che hai indicato">Sensibilità</th><th title="Affermazioni sbagliate che hai evitato">Specificità</th><th>Persi / inventati</th><th></th></tr></thead><tbody>
    ${d.perEsame.map((x, i) => `<tr><td><b>${esc(x.zona)}</b></td><td class="num">${x.casi}</td><td>${barra(x.media, col(x.media))} ${x.media}%</td><td>${x.sens ?? '—'}${x.sens != null ? '%' : ''}</td><td>${x.spec ?? '—'}${x.spec != null ? '%' : ''}</td><td class="num">${x.mancati} / ${x.inventati}</td><td>${x.media < 90 ? btnRip('e' + i, x.ripasso, 'Ripassa') : ''}</td></tr>`).join('')}</tbody></table>
    <h2>Per tipo di reperto</h2>
    <table class="tab st-tab"><thead><tr><th>Tipo di reperto</th><th>Prove</th><th>Errori</th><th>Persi / inventati</th><th>Dove sbagli di più</th></tr></thead><tbody>
    ${d.perTema.map((x) => `<tr><td><b>${esc(x.nome)}</b></td><td class="num">${x.prove}</td><td>${barra(x.perc, colErr(x.perc))} ${x.perc}%</td><td class="num">${x.mancati} / ${x.sbagliati}</td><td class="small">${x.zone.map((z) => `${esc(z.zona)} <span class="muted">${z.perc}%</span>`).join(' · ') || '—'}</td></tr>`).join('')}</tbody></table>
    ${zone.length > 1 && temiM.length > 1 ? `<details class="st-matrice-box"><summary>Incrocio tipo di reperto × esame (percentuale di errori)</summary><div class="st-scorri"><table class="st-matrice"><thead><tr><th></th>${zone.map((z) => `<th>${esc(z)}</th>`).join('')}</tr></thead><tbody>${temiM.map((t) => `<tr><th>${esc(t)}</th>${zone.map((z) => cella(t, z)).join('')}</tr>`).join('')}</tbody></table></div></details>` : ''}
    ${mesi.length > 1 ? `<h2>Andamento</h2><div class="st-mesi">${mesi.map((m) => `<div class="st-mese" title="${m.casi} casi, media ${m.media}%"><div class="st-col"><span style="height:${m.media}%;background:${col(m.media)}"></span></div><b>${m.media}%</b><small>${nomeMese(m.mese)} · ${m.casi}</small></div>`).join('')}</div>` : ''}
    <p class="muted small">Le statistiche sono solo tue: nessun altro le vede in questa forma. <a href="#/confronto">Confronto anonimo con i colleghi</a> · <a href="#/">Torna all'elenco</a></p>`;
  box.querySelectorAll('[data-rip]').forEach((b) => b.onclick = () => {
    const casi = RIP[b.dataset.rip]; if (!casi?.length) return;
    const x = b.dataset.rip.startsWith('d') ? d.deboli[+b.dataset.rip.slice(1)] : b.dataset.rip.startsWith('e') ? d.perEsame[+b.dataset.rip.slice(1)] : null;
    const titolo = x?.nome ? `Ripasso mirato: ${x.nome.toLowerCase()} (${x.zona})` : x?.zona ? `Ripasso: ${x.zona}` : 'Ripasso sui punti deboli';
    iniziaGiro({ tipo: 'ripasso', id: 'mirato-' + b.dataset.rip, titolo, casi }, casi[0]);
  });
}
// ---------------------------------------------------------------- confronto anonimo con i colleghi
""")
open(A, 'w', encoding='utf-8').write(a)

c = open(S, encoding='utf-8').read()
c += '''
/* statistiche personali */
.st-sintesi{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.st-barra{display:inline-block;width:90px;height:8px;border-radius:5px;background:color-mix(in srgb,var(--mut) 22%,transparent);vertical-align:middle;overflow:hidden}
.st-barra>span{display:block;height:100%;border-radius:5px}
.st-tab td{vertical-align:middle}
.st-deboli{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin:10px 0 18px}
.st-debole{border:1px solid var(--bord);border-radius:14px;padding:12px 14px;background:linear-gradient(135deg,color-mix(in srgb,var(--ko) 6%,var(--pan)),var(--pan));display:flex;flex-direction:column;gap:6px}
.st-d-tit{display:flex;align-items:baseline;gap:6px}
.st-d-perc{margin-left:auto;font-size:1.3em;font-weight:700}
.st-esempi{margin:0;padding-left:16px}
.st-esempi li{margin:2px 0}
.st-tipo{display:inline-block;font-size:.75em;font-weight:700;text-transform:uppercase;border-radius:6px;padding:0 5px;margin-right:3px}
.st-tipo.mancato{background:color-mix(in srgb,var(--warn) 25%,transparent)}
.st-tipo.inventato{background:color-mix(in srgb,var(--ko) 22%,transparent)}
.st-scorri{overflow-x:auto}
.st-matrice{border-collapse:collapse;font-size:.85em;margin:8px 0}
.st-matrice th{text-align:left;padding:4px 8px;font-weight:600;white-space:nowrap}
.st-matrice thead th{writing-mode:vertical-rl;transform:rotate(180deg);text-align:left;vertical-align:bottom;max-height:160px}
.st-cella,.st-vuota{min-width:44px;text-align:center;padding:5px;border:1px solid var(--bord)}
.st-mesi{display:flex;gap:10px;align-items:flex-end;overflow-x:auto;padding:6px 0 10px}
.st-mese{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:54px}
.st-col{width:26px;height:90px;background:color-mix(in srgb,var(--mut) 15%,transparent);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden}
.st-col>span{display:block;width:100%;border-radius:6px}
.st-mese small{color:var(--mut);font-size:.72em;white-space:nowrap}
'''
open(S, 'w', encoding='utf-8').write(c)
print('ok')
