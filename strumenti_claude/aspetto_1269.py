# aspetto_1269.py: modifiche dell'aspetto (1.269) a index.html, app.js, style.css, en.json, pubblica.command.
# Ogni sostituzione deve trovare il testo esatto una volta, altrimenti lo script si ferma senza scrivere nulla.
import json, re, sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
file = {k: open(W + k, encoding='utf-8').read() for k in ['index.html', 'app.js', 'style.css']}
pub = '/Volumes/Caloggero/piattaforma-quiz/cloud/pubblica.command'; file['pub'] = open(pub, encoding='utf-8').read()
def sost(k, a, b):
    n = file[k].count(a)
    if n != 1: sys.exit(f'{k}: trovato {n} volte: {a[:90]!r}')
    file[k] = file[k].replace(a, b)

ICO = {
  'cappello': '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  'scudo': '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  'archivio': '<path d="M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 0 2 2h12"/><path d="M8 7h6"/>',
  'provetta': '<path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 14h9"/>',
  'scansione': '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><ellipse cx="12" cy="12" rx="5" ry="6"/><path d="M12 6v12M9 9.5c2 1 4 1 6 0M9 14.5c2-1 4-1 6 0"/>',
  'monitor': '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 13l3-4 3 3 4-5"/>',
  'grafico': '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  'persone': '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.4 5 2.7 5 5.8"/>',
  'aperto': '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="16" r="1.4"/>',
  'check': '<path d="m5 12 4 4 10-10"/>',
  'cubo': '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  'fiamma': '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z"/>',
  'bersaglio': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  'medaglia': '<circle cx="12" cy="14" r="6"/><path d="M8.5 9.5 6 3h4l2 4 2-4h4l-2.5 6.5"/><path d="m10 14 1.5 1.5L14.5 12"/>',
}
def ico(n, cl='hv-ico-svg', s=20): return f'<svg class="{cl}" viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICO[n]}</svg>'

# ------------------------------------------------------------------ pagina iniziale
sost('index.html', '<p class="hv-fiducia"><span>🎓 Solo per la formazione</span><span>🛡 Nessun dato di pazienti</span><span>📚 Casi da archivi pubblici</span><span>🧪 Versione dimostrativa</span></p>',
  f'<p class="hv-fiducia"><span>{ico("cappello", s=16)}Solo per la formazione</span><span>{ico("scudo", s=16)}Nessun dato di pazienti</span><span>{ico("archivio", s=16)}Casi da archivi pubblici</span><span>{ico("provetta", s=16)}Versione dimostrativa</span></p>\n'
  '    <ul class="hv-numeri" aria-label="La piattaforma in numeri"><li><b data-num="casi">134</b><span>casi clinici</span></li><li><b data-num="metodiche">6</b><span>metodiche</span></li><li><b data-num="distretti">18</b><span>distretti</span></li><li><b>100%</b><span>open source</span></li></ul>')
sost('index.html', '<figure class="hv-foto"><picture>', '<figure class="hv-foto"><div class="hv-finestra"><div class="hv-barra" aria-hidden="true"><i></i><i></i><i></i><span>radio-quiz.it</span></div><picture>')
sost('index.html', 'loading="lazy" decoding="async"></picture>\n      <figcaption>',
  'loading="lazy" decoding="async"></picture>'
  f'<span class="hv-chip hv-chip-1" aria-hidden="true">{ico("check", s=15)}Correzione immediata</span><span class="hv-chip hv-chip-2" aria-hidden="true">{ico("cubo", s=15)}MPR e 3D</span><span class="hv-chip hv-chip-3" aria-hidden="true">{ico("scansione", s=15)}Casi reali e anonimi</span></div>\n      <figcaption>')
GAL = [('tc', 'TC', 'torace', 'LIDC-IDRI · CC BY 3.0'), ('rm', 'RM', 'encefalo', 'Vestibular-Schwannoma-SEG · CC BY 4.0'), ('rx', 'RX', 'torace', 'COVID-19-AR · CC BY 4.0'),
       ('mammo', 'Mammografia', 'proiezione obliqua', 'CMMD · CC BY 4.0'), ('eco', 'Ecografia', 'fegato', 'CMB-MEL · CC BY 4.0'), ('pet', 'PET-TC', 'MIP total body', 'Lung-PET-CT-Dx · CC BY 4.0')]
gal = '\n'.join(f'      <figure class="hv-tessera"><picture><source type="image/webp" srcset="img/galleria/{f}.webp"><img src="img/galleria/{f}.jpg" alt="{m}, {d}" width="480" height="480" loading="lazy" decoding="async"></picture><figcaption><b>{m}</b> <span>{d}</span></figcaption></figure>' for f, m, d, _ in GAL)
sost('index.html', '    <h2 class="hv-tit">Che cosa trovi</h2>',
  '    <h2 class="hv-tit">Immagini vere, da archivi pubblici</h2>\n'
  '    <p class="hv-nota">Esami anonimi di collezioni con licenza aperta, nelle metodiche che userai in reparto.</p>\n'
  f'    <div class="hv-galleria">\n{gal}\n    </div>\n'
  '    <p class="hv-fonti muted small">Fonti, tutte da The Cancer Imaging Archive: ' + '; '.join(f'{m}: {s}' for _, m, _, s in GAL) + '.</p>\n'
  '    <h2 class="hv-tit">Che cosa trovi</h2>')
for vecchio, n in [('<b>🩻 Casi reali e anonimi</b>', 'scansione'), ('<b>🖥 Visualizzatore DICOM completo</b>', 'monitor'), ('<b>📈 I tuoi progressi</b>', 'grafico'),
                   ('<b>👩‍🏫 Docenti a tua scelta</b>', 'persone'), ('<b>🔓 Solo open source</b>', 'aperto'), ('<b>🎓 Per tutti</b>', 'cappello')]:
    testo = re.sub(r'^<b>\S+ ', '', vecchio)[:-4]
    sost('index.html', vecchio, f'<i class="hv-ico">{ico(n)}</i><b>{testo}</b>')
# home dello studente: scheda dell'allenamento accanto ai progressi
sost('index.html', '  <div id="gioco-card" class="gioco-card" hidden></div>', '  <div id="gioco-card" class="gioco-card" hidden></div>\n  <section id="allenamento-card" class="all-card" hidden aria-label="Il tuo allenamento"></section>')

# ------------------------------------------------------------------ app.js
# telefono: niente cursore automatico nel modulo d'accesso (portava la pagina sul modulo, saltando la presentazione)
sost('app.js', '  if (primo) setTimeout(() => primo.focus(), 50);',
  '  if (primo) setTimeout(() => { if (matchMedia(\'(min-width: 901px)\').matches) primo.focus({ preventScroll: true }); else if (accessoToccato) primo.closest(\'.accesso-scheda\')?.scrollIntoView({ behavior: \'smooth\', block: \'start\' }); }, 50);')
sost('app.js', 'function pannelloAccesso(nome) {', "let accessoToccato = false; addEventListener('pointerdown', () => { accessoToccato = true; }, { once: true, capture: true });\nfunction pannelloAccesso(nome) {")
# scritte sull'immagine: la prima riga a sinistra non si sovrappone a quelle a destra (telefono)
sost('app.js', """  tl.forEach((t, i) => testoContorno(t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));
  ctx.textAlign = 'right';
  if (img) [`${img.cols}×${img.rows}`, `Zoom ${Math.round(p.zoom * 100)}%`].forEach((t, i) => testoContorno(t, R.x + R.w - (i === 0 && chiudibile ? 30 : 10), R.y + 8 + i * 15, '#d8e2ee'));""",
"""  const destra = img ? [`${img.cols}×${img.rows}`, `Zoom ${Math.round(p.zoom * 100)}%`] : [];
  const largD = destra.length ? Math.max(...destra.map((t) => ctx.measureText(t).width)) + (chiudibile ? 20 : 0) + 22 : 0;
  const taglia = (t, max) => { if (max < 40 || ctx.measureText(t).width <= max) return t; let s = t; while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1); return s.trimEnd() + '…'; };
  tl.forEach((t, i) => testoContorno(i < destra.length ? taglia(t, R.w - 10 - largD) : t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));
  ctx.textAlign = 'right';
  destra.forEach((t, i) => testoContorno(t, R.x + R.w - (i === 0 && chiudibile ? 30 : 10), R.y + 8 + i * 15, '#d8e2ee'));""")
# esito: anello del punteggio, giudizio e conteggio di giuste, sbagliate e mancate
sost('app.js', """    $('#q-esito').innerHTML = `<div class="punteggio" style="color:${r.perfetta ? 'var(--ok)' : r.punteggio >= 50 ? 'var(--warn)' : 'var(--ko)'}">
      ${solo ? 'Punteggio del referto' : r.perfetta ? 'Risposta esatta' : 'Punteggio'}: ${r.punteggio}%</div>""",
"""    const livEsito = r.perfetta ? 'ok' : r.punteggio >= 50 ? 'medio' : 'ko', nEs = (k) => (r.esito || []).filter((e) => e.stato === k).length;
    $('#q-esito').innerHTML = `<div class="esito-testa ${livEsito}"><div class="esito-anello" style="--p:${Math.max(0, Math.min(100, r.punteggio))}" role="img" aria-label="${r.punteggio}%"><span>${r.punteggio}<small>%</small></span></div>
      <div class="esito-titoli"><div class="punteggio" style="color:${r.perfetta ? 'var(--ok)' : r.punteggio >= 50 ? 'var(--warn)' : 'var(--ko)'}">
      ${solo ? 'Punteggio del referto' : r.perfetta ? 'Risposta esatta' : 'Punteggio'}: ${r.punteggio}%</div>
      <p class="esito-giudizio">${r.perfetta ? 'Ottima lettura: tutto giusto.' : r.punteggio >= 80 ? 'Quasi: manca poco.' : r.punteggio >= 50 ? 'Buona base: rivedi i punti mancati.' : 'Da rivedere: guarda dove si vede il reperto.'}</p>
      ${!solo && r.esito?.length ? `<p class="esito-conti"><span class="ok">✓ ${nEs('corretta')} ${nEs('corretta') === 1 ? 'giusta' : 'giuste'}</span>${nEs('errata') ? `<span class="ko">✗ ${nEs('errata')} ${nEs('errata') === 1 ? 'sbagliata' : 'sbagliate'}</span>` : ''}${nEs('mancata') ? `<span class="medio">○ ${nEs('mancata')} ${nEs('mancata') === 1 ? 'mancata' : 'mancate'}</span>` : ''}</p>` : ''}</div></div>""")
# l'azione «mostra il reperto / caso successivo» va sotto la testa dell'esito
sost('app.js', "{ const pt = qs1('#q-esito .punteggio'), az = document.createElement('div'); az.className = 'esito-azioni';",
  "{ const pt = qs1('#q-esito .esito-testa') || qs1('#q-esito .punteggio'), az = document.createElement('div'); az.className = 'esito-azioni';")
# scheda dell'allenamento: obiettivo del giorno, giorni di fila, calendario delle ultime 12 settimane, traguardi
sost('app.js', "  $('#btn-logbook').onclick = () => apriLogbook().catch((e) => alert('Logbook non disponibile: ' + e.message));\n}",
"""  $('#btn-logbook').onclick = () => apriLogbook().catch((e) => alert('Logbook non disponibile: ' + e.message));
  disegnaAllenamento();
}
// 1.269: allenamento. Tutto dai tentativi già salvati (GIOCO.storico): nessun dato nuovo sul server. L'obiettivo del giorno
// si sceglie qui e resta nel browser.
const giornoDi = (d) => String(d || '').slice(0, 10);
const giornoLocale = (t) => { const d = new Date(t), p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function datiAllenamento(g) {
  const perGiorno = new Map();
  for (const r of g.storico || []) { const k = giornoDi(r.data); if (!k) continue; if (!perGiorno.has(k)) perGiorno.set(k, new Set()); perGiorno.get(k).add(r.caso); }
  const oggiK = giornoLocale(Date.now()), ieriK = giornoLocale(Date.now() - 864e5);
  const fila = (da) => { let n = 0, t = new Date(da + 'T12:00:00').getTime(); while (perGiorno.has(giornoLocale(t))) { n++; t -= 864e5; } return n; };
  const attuale = perGiorno.has(oggiK) ? fila(oggiK) : perGiorno.has(ieriK) ? fila(ieriK) : 0;
  let record = 0; for (const k of perGiorno.keys()) { const prima = giornoLocale(new Date(k + 'T12:00:00').getTime() - 864e5); if (!perGiorno.has(prima)) record = Math.max(record, fila(k)); }
  const metodiche = new Set((g.storico || []).map((r) => ELENCO.find((c) => c.id === r.caso)).filter(Boolean).map(metodicaDi));
  return { perGiorno, oggi: perGiorno.get(oggiK)?.size || 0, attuale, record, metodiche };
}
function obiettivoGiorno() { try { return Math.max(1, Math.min(20, +localStorage.getItem('rq-obiettivo') || 3)); } catch { return 3; } }
function disegnaAllenamento() {
  const box = $('#allenamento-card'), g = GIOCO; if (!box) return;
  box.hidden = !g || !ELENCO?.length; if (box.hidden) return;
  const a = datiAllenamento(g), ob = obiettivoGiorno(), fatto = Math.min(a.oggi, ob), pc = Math.round((fatto / ob) * 100);
  // calendario: 12 settimane, colonne da lunedì a domenica, l'ultima colonna è questa settimana
  const oggi = new Date(), lun = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7)), celle = [];
  let tot = 0;
  for (let s = 11; s >= 0; s--) for (let d = 0; d < 7; d++) {
    const t = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() - s * 7 + d), k = giornoLocale(t.getTime()), n = a.perGiorno.get(k)?.size || 0, futuro = t > oggi;
    tot += n; celle.push(`<i class="${futuro ? 'fut' : n >= 5 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : n === 1 ? 'l1' : ''}" title="${esc(t.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }))}: ${n} ${n === 1 ? 'caso' : 'casi'}"></i>`);
  }
  const TUTTE = ['TC', 'RM', 'RX', 'Mammografia', 'Ecografia', 'Medicina nucleare'], nM = TUTTE.filter((m) => a.metodiche.has(m)).length;
  const traguardi = [
    ['Primo caso', g.casiRisolti, 1], ['10 casi', g.casiRisolti, 10], ['50 casi', g.casiRisolti, 50], ['100 casi', g.casiRisolti, 100],
    ['Prima risposta esatta', g.perfetti, 1], ['5 esatte di fila', g.migliore, 5], ['3 giorni di fila', a.record, 3], ['7 giorni di fila', a.record, 7],
    ['Tutte le metodiche', nM, TUTTE.length],
  ];
  const presi = traguardi.filter(([, v, s]) => v >= s).length;
  box.innerHTML = `<div class="all-blocco all-obiettivo"><div class="all-anello${fatto >= ob ? ' pieno' : ''}" style="--p:${pc}"><span><b>${a.oggi}</b><small>/${ob}</small></span></div>
      <div><h3>Obiettivo di oggi</h3><p class="muted small">${fatto >= ob ? 'Raggiunto: ottimo lavoro.' : `${ob - fatto} ${ob - fatto === 1 ? 'caso' : 'casi'} per arrivarci`}</p>
      <label class="small muted">Casi al giorno <select id="all-ob">${[1, 2, 3, 5, 10].map((n) => `<option${n === ob ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div></div>
    <div class="all-blocco all-fila"><span class="all-fiamma${a.attuale ? ' accesa' : ''}">${ICO_FIAMMA}</span><div><h3>${a.attuale} ${a.attuale === 1 ? 'giorno' : 'giorni'} di fila</h3>
      <p class="muted small">${a.attuale ? (a.oggi ? 'Anche oggi ci sei.' : 'Fai un caso oggi per non interrompere la serie.') : 'Fai un caso oggi per iniziare una serie.'} Record: ${a.record}.</p></div></div>
    <div class="all-blocco all-cal"><h3>Ultime 12 settimane <span class="muted small">· ${tot} ${tot === 1 ? 'caso' : 'casi'}</span></h3><div class="all-griglia" role="img" aria-label="Casi svolti ogni giorno nelle ultime 12 settimane">${celle.join('')}</div>
      <p class="all-legenda muted small">meno <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> più</p></div>
    <div class="all-blocco all-traguardi"><h3>Traguardi <span class="muted small">· ${presi} di ${traguardi.length}</span></h3><ul>${traguardi.map(([n, v, s]) => `<li class="${v >= s ? 'preso' : ''}" title="${esc(n)}: ${Math.min(v, s)} / ${s}">${ICO_MEDAGLIA}<span>${esc(n)}</span>${v >= s ? '' : `<small>${Math.min(v, s)}/${s}</small>`}</li>`).join('')}</ul></div>`;
  $('#all-ob').onchange = (e) => { try { localStorage.setItem('rq-obiettivo', e.target.value); } catch {} disegnaAllenamento(); };
}
""" + f"const ICO_FIAMMA = '{ico('fiamma', 'all-ico', 26)}', ICO_MEDAGLIA = '{ico('medaglia', 'all-ico', 22)}';\n")
# pagina iniziale: numeri della piattaforma da versione.json (scritti alla pubblicazione)
sost('app.js', 'function pannelloAccesso(nome) {', """function numeriVetrina() {
  fetch('/versione.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
    if (!v) return; for (const el of qsAll('.hv-numeri [data-num]')) { const n = v[el.dataset.num]; if (Number.isFinite(n) && n > 0) el.textContent = String(n); }
  }).catch(() => {});
}
function pannelloAccesso(nome) {
  if (!numeriVetrina.fatto) { numeriVetrina.fatto = true; numeriVetrina(); }""")

# ------------------------------------------------------------------ pubblica: numeri della vetrina in versione.json
sost('pub', """printf '{"versione":"%s","numero":%s,"data":"%s","mpr3d":"%s"}\\n' "${VERSIONE}" "${NUMERO}" "$(date '+%Y-%m-%d %H:%M')" "${H_MPR}" > "${STATICO}/versione.json\"""",
"""NUMERI=$(node -e '
const fs = require("fs"), p = require("path"), d = process.argv[1]; let casi = 0; const met = new Set(), dis = new Set();
for (const c of fs.readdirSync(d)) { const f = p.join(d, c, "caso.json"); if (!fs.existsSync(f)) continue; let j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (j.visibile === false) continue; casi++; if (j.modalita && j.modalita !== "Altro") met.add(j.modalita); if (j.distretto) dis.add(j.distretto); }
process.stdout.write(`,"casi":${casi},"metodiche":${met.size},"distretti":${dis.size}`);' "${CASI}" 2>/dev/null || true)
printf '{"versione":"%s","numero":%s,"data":"%s","mpr3d":"%s"%s}\\n' "${VERSIONE}" "${NUMERO}" "$(date '+%Y-%m-%d %H:%M')" "${H_MPR}" "${NUMERI}" > "${STATICO}/versione.json\"""")

# ------------------------------------------------------------------ style.css: livello finale
file['style.css'] += open('/Volumes/Caloggero/strumenti_claude/aspetto_1269.css', encoding='utf-8').read()

# ------------------------------------------------------------------ traduzioni
en = json.load(open(W + 'lingua/en.json', encoding='utf-8'))
nuove = {'Solo per la formazione': 'Training only', 'Nessun dato di pazienti': 'No patient data', 'Casi da archivi pubblici': 'Cases from public archives', 'Versione dimostrativa': 'Demo version',
  'casi clinici': 'clinical cases', 'metodiche': 'modalities', 'distretti': 'body regions', 'open source': 'open source', 'La piattaforma in numeri': 'The platform in numbers',
  'Correzione immediata': 'Instant feedback', 'MPR e 3D': 'MPR and 3D', 'Casi reali e anonimi': 'Real, anonymous cases',
  'Immagini vere, da archivi pubblici': 'Real images from public archives', 'Esami anonimi di collezioni con licenza aperta, nelle metodiche che userai in reparto.': 'Anonymous exams from openly licensed collections, in the modalities you will use on the ward.',
  'torace': 'chest', 'encefalo': 'brain', 'proiezione obliqua': 'oblique view', 'fegato': 'liver', 'MIP total body': 'whole-body MIP', 'Mammografia': 'Mammography', 'Ecografia': 'Ultrasound',
  'Visualizzatore DICOM completo': 'Complete DICOM viewer', 'I tuoi progressi': 'Your progress', 'Docenti a tua scelta': 'Teachers of your choice', 'Solo open source': 'Open source only', 'Per tutti': 'For everyone',
  'Il tuo allenamento': 'Your training', 'Obiettivo di oggi': "Today's goal", 'Raggiunto: ottimo lavoro.': 'Reached: great work.', '{x} casi per arrivarci': '{x} cases to go', '{x} caso per arrivarci': '{x} case to go',
  'Casi al giorno': 'Cases per day', '{x} giorni di fila': '{x} days in a row', '{x} giorno di fila': '{x} day in a row', 'Anche oggi ci sei.': 'You are here today too.',
  'Fai un caso oggi per non interrompere la serie.': 'Do a case today to keep the streak going.', 'Fai un caso oggi per iniziare una serie.': 'Do a case today to start a streak.', 'Record: {x}.': 'Record: {x}.',
  'Ultime 12 settimane': 'Last 12 weeks', '· {x} casi': '· {x} cases', '· {x} caso': '· {x} case', 'meno': 'less', 'più': 'more', 'Traguardi': 'Milestones', '· {x} di {x}': '· {x} of {x}',
  'Primo caso': 'First case', '10 casi': '10 cases', '50 casi': '50 cases', '100 casi': '100 cases', 'Prima risposta esatta': 'First exact answer', '5 esatte di fila': '5 exact in a row',
  '3 giorni di fila': '3 days in a row', '7 giorni di fila': '7 days in a row', 'Tutte le metodiche': 'All modalities',
  'Casi svolti ogni giorno nelle ultime 12 settimane': 'Cases done each day in the last 12 weeks',
  'Ottima lettura: tutto giusto.': 'Great reading: all correct.', 'Quasi: manca poco.': 'Almost there.', 'Buona base: rivedi i punti mancati.': 'Good basis: review what you missed.',
  'Da rivedere: guarda dove si vede il reperto.': 'To review: look where the finding is visible.', '✓ {x} giuste': '✓ {x} correct', '✓ {x} giusta': '✓ {x} correct', '✗ {x} sbagliate': '✗ {x} wrong', '✗ {x} sbagliata': '✗ {x} wrong',
  '○ {x} mancate': '○ {x} missed', '○ {x} mancata': '○ {x} missed'}
for k, v in nuove.items(): en.setdefault(k, v)
en_txt = json.dumps(en, ensure_ascii=False)
fonti = 'Fonti, tutte da The Cancer Imaging Archive: ' + '; '.join(f'{m}: {s}' for _, m, _, s in GAL) + '.'
en.setdefault(fonti, 'Sources, all from The Cancer Imaging Archive: ' + '; '.join(f'{ {"Mammografia": "Mammography", "Ecografia": "Ultrasound"}.get(m, m)}: {s}' for _, m, _, s in GAL) + '.')
en_txt = json.dumps(en, ensure_ascii=False)

for k in ['index.html', 'app.js', 'style.css']: open(W + k, 'w', encoding='utf-8').write(file[k])
open(pub, 'w', encoding='utf-8').write(file['pub'])
open(W + 'lingua/en.json', 'w', encoding='utf-8').write(en_txt)
print('fatto')
