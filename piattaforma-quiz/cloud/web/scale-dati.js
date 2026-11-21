// Scale e classificazioni internazionali: definizioni, calcoli e disegni cliccabili (prostata, mammella, fegato, bull's eye).
// Modulo puro: nessun accesso alla pagina né allo stato del visualizzatore, così si prova con `node --test`
// (test/scale.test.mjs). Lo carica scale.js, che a sua volta si carica solo quando si aprono le scale.
// Estratto da app.js nella 1.248 senza modifiche al contenuto.
const virgola = (x, d) => x.toFixed(d).replace('.', ',');


// ---- disegni cliccabili per le scale: settori della prostata (PI-RADS v2.1) e quadranti della mammella
// Prostata: tre sezioni assiali (base, terzo medio, apice) viste dai piedi come in RM: destra del
// paziente a sinistra, anteriore in alto. Ogni metà è divisa in spicchi; il centro è la zona di transizione.
const NOMI_SETT = { AFS: 'stroma fibromuscolare anteriore', TZa: 'zona di transizione anteriore', TZp: 'zona di transizione posteriore', CZ: 'zona centrale',
  PZa: 'zona periferica anteriore', PZpl: 'zona periferica posterolaterale', PZpm: 'zona periferica posteromediale' };
const LIVELLI_PROSTATA = { base: 'base', medio: 'terzo medio', apice: 'apice' };
function settoriProstata() {
  // [codice, raggio interno, raggio esterno, angolo da, angolo a] — angoli da anteriore (0°) a posteriore (180°)
  const anello = [['PZa', 0.6, 1, 40, 95], ['PZpl', 0.6, 1, 95, 145], ['PZpm', 0.6, 1, 145, 180], ['AFS', 0.6, 1, 0, 40]];
  return {
    base: [...anello, ['TZa', 0.12, 0.6, 0, 90], ['TZp', 0.12, 0.6, 90, 135], ['CZ', 0.12, 0.6, 135, 180]],
    medio: [...anello, ['TZa', 0.12, 0.6, 0, 90], ['TZp', 0.12, 0.6, 90, 180]],
    apice: [...anello.map((x) => (x[0] === 'AFS' ? x : [x[0], 0.5, 1, x[3], x[4]])), ['TZa', 0.12, 0.5, 0, 90], ['TZp', 0.12, 0.5, 90, 180]],
  };
}
function svgProstata(scelti = []) {
  const W = 150, RX = 60, RY = 46, out = [], S = settoriProstata();
  const pt = (cx, cy, lato, r, a, sc) => { const t = a * Math.PI / 180; return `${(cx + lato * r * RX * sc * Math.sin(t)).toFixed(1)},${(cy - r * RY * sc * Math.cos(t)).toFixed(1)}`; };
  Object.entries(S).forEach(([liv, settori], n) => {
    const cx = 80 + n * W, cy = 120, sc = liv === 'apice' ? 0.8 : liv === 'medio' ? 0.95 : 1;
    out.push(`<text x="${cx}" y="${cy + RY + 26}" class="sm-tit">${LIVELLI_PROSTATA[liv]}</text>`);
    for (const lato of [-1, 1]) for (const [c, r0, r1, a0, a1] of settori) {
      const id = `${liv}-${c}-${lato < 0 ? 'dx' : 'sn'}`, p = [];
      for (let a = a0; a <= a1; a += 5) p.push(pt(cx, cy, lato, r1, a, sc));
      for (let a = a1; a >= a0; a -= 5) p.push(pt(cx, cy, lato, r0, a, sc));
      const m = pt(cx, cy, lato, (r0 + r1) / 2, (a0 + a1) / 2, sc).split(',');
      out.push(`<path d="M${p.join('L')}Z" class="sm-s${scelti.includes(id) ? ' on' : ''} sm-${c.slice(0, 2)}" data-s="${id}"><title>${descriviSettore(id)}</title></path>`,
        `<text x="${m[0]}" y="${+m[1] + 3}" class="sm-et">${c.replace(/^(PZ|TZ)/, '')}</text>`);
    }
    out.push(`<circle cx="${cx}" cy="${cy}" r="${(0.12 * RY * sc).toFixed(1)}" class="sm-uretra"/>`);
  });
  // vescicole seminali sopra la base, sfintere uretrale esterno sotto l'apice
  for (const lato of [-1, 1]) { const id = `SV-${lato < 0 ? 'dx' : 'sn'}`;
    out.push(`<ellipse cx="${80 + lato * 34}" cy="40" rx="30" ry="12" class="sm-s sm-SV${scelti.includes(id) ? ' on' : ''}" data-s="${id}"><title>${descriviSettore(id)}</title></ellipse>`); }
  out.push(`<text x="80" y="18" class="sm-tit">vescicole seminali</text>`,
    `<circle cx="${80 + 2 * W}" cy="44" r="13" class="sm-s sm-US${scelti.includes('US') ? ' on' : ''}" data-s="US"><title>${descriviSettore('US')}</title></circle>`,
    `<text x="${80 + 2 * W}" y="22" class="sm-tit">sfintere uretrale</text>`,
    `<text x="8" y="210" class="sm-or">D</text><text x="${2 * W + 146}" y="210" class="sm-or" text-anchor="end">S</text><text x="${80 + W}" y="${120 - RY - 6}" class="sm-or">anteriore</text>`);
  return `<svg viewBox="0 0 ${2 * W + 160} 215" class="scala-mappa" role="img" aria-label="Mappa dei settori della prostata PI-RADS v2.1">${out.join('')}</svg>`;
}
function descriviSettore(id) {
  if (id === 'US') return 'sfintere uretrale esterno';
  const [a, b, c] = id.split('-');
  if (a === 'SV') return `vescicola seminale ${b === 'dx' ? 'destra' : 'sinistra'}`;
  return `${LIVELLI_PROSTATA[a]}, ${NOMI_SETT[b]} ${c === 'dx' ? 'destra' : 'sinistra'}`;
}
const sigla = (id) => { const [a, b, c] = id.split('-'); return id === 'US' ? 'US' : a === 'SV' ? `SV ${b}` : `${b} ${a} ${c}`; };

// Mammella: vista frontale come guardando la paziente (la mammella destra a sinistra), orologio
// come un quadrante normale per entrambe: nella destra i quadranti esterni sono dalle 6 alle 12 passando per le 9.
function svgMammella(punto) {
  const out = [], CY = 122;
  for (const [lato, cx] of [['dx', 100], ['sn', 300]]) {
    const est = lato === 'dx' ? -1 : 1, aT = est < 0 ? -45 : 45;   // prolungamento ascellare verso ore 10:30 (destra) o 1:30 (sinistra)
    const tx = cx + est * 96 * Math.SQRT1_2, ty = CY - 96 * Math.SQRT1_2;
    out.push(`<text x="${cx}" y="14" class="sm-tit">mammella ${lato === 'dx' ? 'destra' : 'sinistra'}</text>`,
      `<ellipse cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" rx="30" ry="13" transform="rotate(${-aT} ${tx.toFixed(0)} ${ty.toFixed(0)})" class="sm-coda"/>`,
      `<circle cx="${cx}" cy="${CY}" r="78" class="sm-mamm"/>`,
      `<line x1="${cx - 78}" y1="${CY}" x2="${cx + 78}" y2="${CY}" class="sm-asse"/><line x1="${cx}" y1="${CY - 78}" x2="${cx}" y2="${CY + 78}" class="sm-asse"/>`,
      `<circle cx="${cx}" cy="${CY}" r="16" class="sm-areola"/>`);
    for (let h = 1; h <= 12; h++) { const t = h * Math.PI / 6; out.push(`<text x="${(cx + 88 * Math.sin(t)).toFixed(0)}" y="${(CY + 3 - 88 * Math.cos(t)).toFixed(0)}" class="sm-ora">${h}</text>`); }
    const q = (dy, di) => `<text x="${cx + est * (di ? -40 : 40)}" y="${CY + dy}" class="sm-q">${dy < 0 ? 'QS' : 'QI'}${di ? 'I' : 'E'}</text>`;
    out.push(q(-36, 0), q(-36, 1), q(48, 0), q(48, 1));
  }
  if (punto) out.push(`<circle cx="${punto.x}" cy="${punto.y}" r="6" class="sm-punto"/>`);
  return `<svg viewBox="0 0 400 215" class="scala-mappa sm-mammella" role="img" aria-label="Mammelle: clicca dove si trova la lesione">${out.join('')}</svg>`;
}
// dal punto cliccato: lato, ora, quadrante (o retroareolare / prolungamento ascellare)
function sedeMammella(x, y) {
  const lato = x < 200 ? 'dx' : 'sn', cx = lato === 'dx' ? 100 : 300, dx = x - cx, dy = y - 122, r = Math.hypot(dx, dy);
  const est = lato === 'dx' ? -1 : 1, nome = `mammella ${lato === 'dx' ? 'destra' : 'sinistra'}`;
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;   // 0° = ore 12, in senso orario
  if (r > 80) {
    const centro = est < 0 ? 315 : 45, scarto = Math.min(Math.abs(ang - centro), 360 - Math.abs(ang - centro));
    return r < 128 && scarto < 22 ? { lato, x: +x.toFixed(1), y: +y.toFixed(1), testo: `${nome}, prolungamento ascellare`, breve: 'prolungamento ascellare' } : null;
  }
  if (r <= 18) return { lato, x: +x.toFixed(1), y: +y.toFixed(1), testo: `${nome}, regione retroareolare`, breve: 'retroareolare' };
  const ora = Math.round(ang / 30) % 12 || 12, sup = dy < 0, esterno = dx * est > 0;
  const vicino = (a) => Math.min(Math.abs(ang - a), 360 - Math.abs(ang - a)) < 8;
  let quad;
  if (vicino(0)) quad = 'unione dei quadranti superiori (QQSS)';
  else if (vicino(180)) quad = 'unione dei quadranti inferiori (QQII)';
  else if (vicino(90) || vicino(270)) quad = esterno ? 'unione dei quadranti esterni (QQEE)' : 'unione dei quadranti interni';
  else quad = { 'true,true': 'quadrante supero-esterno (QSE)', 'true,false': 'quadrante supero-interno (QSI)', 'false,true': 'quadrante infero-esterno (QIE)', 'false,false': 'quadrante infero-interno (QII)' }[`${sup},${esterno}`];
  const breve = quad.match(/\(([^)]+)\)/)?.[1] || quad;
  return { lato, ora, quad, breve, x: +x.toFixed(1), y: +y.toFixed(1), testo: `${nome}, ${quad}, ore ${ora}` };
}
// Fegato: segmenti di Couinaud in una vista frontale schematica (destra del paziente a sinistra).
// Vene sovraepatiche destra, media e sinistra/legamento falciforme dividono i settori; il piano portale
// divide i segmenti superiori da quelli inferiori. Il segmento I (caudato) è posteriore, al centro.
const SEGM_FEGATO = { S1: 'I (lobo caudato)', S2: 'II', S3: 'III', S4a: 'IVa', S4b: 'IVb', S5: 'V', S6: 'VI', S7: 'VII', S8: 'VIII' };
const descriviSegmento = (id) => `segmento ${SEGM_FEGATO[id] || id}`;
const siglaSegmento = (id) => ({ S4a: 'S4a', S4b: 'S4b' }[id] || id);
function svgFegato(scelti = []) {
  const forma = 'M18,78 C30,40 90,20 170,20 C240,20 320,30 382,62 C392,70 380,84 360,94 C320,116 270,142 228,170 C190,195 150,205 110,203 C70,200 38,182 24,150 C14,125 12,100 18,78 Z';
  const reg = [['S7', 0, 0, 100, 108], ['S6', 0, 108, 100, 130], ['S8', 100, 0, 88, 108], ['S5', 100, 108, 88, 130], ['S4a', 188, 0, 70, 108], ['S4b', 188, 108, 70, 130],
    ['S2', 258, 0, 150, 78], ['S3', 258, 78, 150, 160]];
  const cen = { S7: [55, 70], S6: [62, 155], S8: [145, 62], S5: [145, 160], S4a: [222, 62], S4b: [222, 140], S2: [310, 55], S3: [300, 105] };
  const out = [`<defs><clipPath id="cl-fegato"><path d="${forma}"/></clipPath></defs>`, `<g clip-path="url(#cl-fegato)">`];
  for (const [id, x, y, w, h] of reg) out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="sm-s${scelti.includes(id) ? ' on' : ''}" data-s="${id}"><title>${descriviSegmento(id)}</title></rect>`);
  out.push('</g>', `<path d="${forma}" class="sm-contorno"/>`,
    `<ellipse cx="200" cy="112" rx="22" ry="12" class="sm-s sm-caudato${scelti.includes('S1') ? ' on' : ''}" data-s="S1"><title>${descriviSegmento('S1')} (posteriore)</title></ellipse>`);
  for (const [id, [x, y]] of Object.entries(cen)) out.push(`<text x="${x}" y="${y}" class="sm-et sm-seg">${SEGM_FEGATO[id]}</text>`);
  out.push(`<text x="200" y="115" class="sm-et sm-seg">I</text>`,
    '<line x1="100" y1="6" x2="100" y2="210" class="sm-vena"/><line x1="188" y1="6" x2="188" y2="210" class="sm-vena"/><line x1="258" y1="6" x2="258" y2="210" class="sm-vena"/><line x1="10" y1="108" x2="258" y2="108" class="sm-vena porta"/><line x1="258" y1="78" x2="395" y2="78" class="sm-vena porta"/>',
    '<text x="100" y="222" class="sm-or">v. sovraepatica dx</text><text x="186" y="222" class="sm-or">v. media</text><text x="262" y="222" class="sm-or">v. sinistra / falciforme</text>',
    '<text x="8" y="14" class="sm-or" text-anchor="start">D</text><text x="392" y="14" class="sm-or" text-anchor="end">S</text>');
  return `<svg viewBox="0 0 400 228" class="scala-mappa sm-fegato" role="img" aria-label="Segmenti epatici di Couinaud: clicca i segmenti occupati">${out.join('')}</svg>`;
}
// ---- bull's eye del ventricolo sinistro: 17 segmenti AHA (Cerqueira et al., Circulation 2002), anteriore in alto,
// setto a sinistra, laterale a destra; punteggio di cinetica ASE/EACVI 2015
const SEGM_VS = { 1: 'basale anteriore', 2: 'basale anterosettale', 3: 'basale inferosettale', 4: 'basale inferiore', 5: 'basale inferolaterale', 6: 'basale anterolaterale',
  7: 'medio anteriore', 8: 'medio anterosettale', 9: 'medio inferosettale', 10: 'medio inferiore', 11: 'medio inferolaterale', 12: 'medio anterolaterale',
  13: 'apicale anteriore', 14: 'apicale settale', 15: 'apicale inferiore', 16: 'apicale laterale', 17: 'apice' };
const CINETICA = { 1: 'normocinesia', 2: 'ipocinesia', 3: 'acinesia', 4: 'discinesia', nv: 'non valutabile' };
const COLORI_CIN = { 1: '#3fa45b', 2: '#e3b341', 3: '#e0533d', 4: '#9b59d0', nv: '#6b7480' };
// territori coronarici abituali (con variabilità individuale, soprattutto all'apice)
const TERRITORIO_VS = { IVA: [1, 2, 7, 8, 13, 14, 17], CDx: [3, 4, 9, 10, 15], Cx: [5, 6, 11, 12, 16] };
function svgBullseye(val = {}, pennello = '2') {
  const cx = 120, cy = 120, R = [0, 22, 48, 74, 100];
  const p = (r, a) => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
  const settore = (r0, r1, a0, a1) => { const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
    return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r1},${r1} 0 0 0 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${r0},${r0} 0 0 1 ${x3.toFixed(1)},${y3.toFixed(1)} Z`; };
  const out = [];
  const seg = (id, d, [tx, ty]) => { const v = val[id], col = v ? COLORI_CIN[v] : null;
    out.push(`<path d="${d}" class="sm-s be-s${v ? ' be-on' : ''}" data-s="${id}"${col ? ` style="fill:${col}"` : ''}><title>${id}. ${SEGM_VS[id]}${v ? ': ' + CINETICA[v] : ''}</title></path>`,
      `<text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" class="sm-et be-n">${id}</text>`); };
  // anelli basale (1-6) e medio (7-12): 60° ciascuno, il segmento 1 centrato in alto; si procede verso il setto (sinistra)
  for (const [base, r0, r1] of [[1, R[3], R[4]], [7, R[2], R[3]]])
    for (let k = 0; k < 6; k++) { const a0 = 60 + k * 60, a1 = a0 + 60, m = (r0 + r1) / 2; seg(base + k, settore(r0, r1, a0, a1), p(m, a0 + 30)); }
  // anello apicale (13-16): 90° ciascuno
  for (let k = 0; k < 4; k++) { const a0 = 45 + k * 90, a1 = a0 + 90, m = (R[1] + R[2]) / 2; seg(13 + k, settore(R[1], R[2], a0, a1), p(m, a0 + 45)); }
  const v17 = val[17];
  out.push(`<circle cx="${cx}" cy="${cy}" r="${R[1]}" class="sm-s be-s${v17 ? ' be-on' : ''}" data-s="17"${v17 ? ` style="fill:${COLORI_CIN[v17]}"` : ''}><title>17. apice${v17 ? ': ' + CINETICA[v17] : ''}</title></circle>`,
    `<text x="${cx}" y="${cy + 3}" class="sm-et be-n">17</text>`,
    `<text x="${cx}" y="12" class="sm-or">anteriore</text><text x="${cx}" y="236" class="sm-or">inferiore</text>`,
    `<text x="10" y="${cy}" class="sm-or" transform="rotate(-90 10 ${cy})">setto</text><text x="230" y="${cy}" class="sm-or" transform="rotate(90 230 ${cy})">laterale</text>`);
  const pal = Object.entries(CINETICA).map(([k, t], i) => `<g data-p="${k}" class="be-p${String(pennello) === k ? ' on' : ''}" transform="translate(248,${24 + i * 26})"><rect width="18" height="18" rx="3" style="fill:${COLORI_CIN[k]}"/><text x="24" y="13" class="sm-or" style="text-anchor:start">${k === 'nv' ? '' : k + ' · '}${t}</text></g>`).join('');
  return `<svg viewBox="0 0 390 242" class="scala-mappa sm-bullseye" role="img" aria-label="Bull's eye a 17 segmenti: scegli il punteggio a destra e clicca i segmenti">${out.join('')}${pal}
    <text x="248" y="${24 + 5 * 26 + 6}" class="sm-or" style="text-anchor:start">scegli il punteggio,</text><text x="248" y="${24 + 5 * 26 + 18}" class="sm-or" style="text-anchor:start">poi clicca i segmenti</text><text x="248" y="${24 + 5 * 26 + 30}" class="sm-or" style="text-anchor:start">(di nuovo per togliere)</text></svg>`;
}
const descriviBullseye = (val) => { const g = {}; for (const [s, v] of Object.entries(val || {})) (g[v] ||= []).push(+s);
  return Object.keys(g).length ? Object.entries(g).sort().map(([v, l]) => `${CINETICA[v]}: ${l.sort((a, b) => a - b).map((x) => SEGM_VS[x]).join(', ')}`).join('; ') : 'Nessun segmento valutato: scegli il punteggio e clicca sui segmenti.'; };
const SEDE_FEGATO = (v) => (v.sede?.length ? `${v.sede.length > 1 ? 'segmenti' : 'segmento'} ${v.sede.map((x) => SEGM_FEGATO[x].replace(/ \(.*/, '')).join('-')}${v.sede.includes('S1') ? ' (caudato)' : ''}` : '');
const SCALE = {
  renal: {
    nome: 'RENAL (nefrometria)', metodiche: ['TC', 'RM'], fonte: 'Kutikov e Uzzo, J Urol 2009',
    intro: 'Complessità anatomica di una massa renale solida (pianificazione della nefrectomia parziale).',
    campi: [
      { id: 'r', nome: 'R · diametro massimo', tipo: 'mm' },
      { id: 'e', nome: 'E · componente esofitica', scelte: [[1, '≥ 50% esofitica'], [2, '< 50% esofitica'], [3, 'completamente endofitica']] },
      { id: 'n', nome: 'N · distanza dal sistema collettore o dal seno (mm)', tipo: 'mm' },
      { id: 'a', nome: 'A · faccia', scelte: [['a', 'anteriore (a)'], ['p', 'posteriore (p)'], ['x', 'né anteriore né posteriore (x)']], senzaPunti: true },
      { id: 'l', nome: 'L · rispetto alle linee polari', scelte: [[1, 'interamente sopra la polare superiore o sotto la inferiore'], [2, 'attraversa una linea polare'], [3, '> 50% oltre la linea polare, oppure tra le due linee polari, oppure attraversa la linea mediana assiale']] },
      { id: 'h', nome: 'h · tocca l\'arteria o la vena renale principale', scelte: [['', 'no'], ['h', 'sì (suffisso h)']], senzaPunti: true },
    ],
    calcola: (v) => {
      if (!(v.r > 0) || !v.e || !(v.n >= 0) || !v.l) return null;
      const R = v.r <= 40 ? 1 : v.r < 70 ? 2 : 3, N = v.n >= 7 ? 1 : v.n > 4 ? 2 : 3, tot = R + +v.e + N + +v.l;
      const cl = tot <= 6 ? 'bassa complessità (4-6)' : tot <= 9 ? 'complessità intermedia (7-9)' : 'alta complessità (10-12)';
      return { valore: `${tot}${v.a || ''}${v.h || ''}`, testo: `RENAL ${tot}${v.a || ''}${v.h || ''}: ${cl}. R ${R}, E ${v.e}, N ${N}, L ${v.l}.` };
    },
  },
  padua: {
    nome: 'PADUA (masse renali)', metodiche: ['TC', 'RM'], fonte: 'Ficarra et al., Eur Urol 2009',
    intro: 'Rischio di complicanze della chirurgia conservativa del rene.',
    campi: [
      { id: 'pol', nome: 'Sede longitudinale', scelte: [[1, 'polo superiore o inferiore'], [2, 'medio-renale']] },
      { id: 'eso', nome: 'Componente esofitica', scelte: [[1, '≥ 50%'], [2, '< 50%'], [3, 'endofitica']] },
      { id: 'rim', nome: 'Margine renale', scelte: [[1, 'laterale'], [2, 'mediale']] },
      { id: 'seno', nome: 'Seno renale', scelte: [[1, 'non coinvolto'], [2, 'coinvolto']] },
      { id: 'vie', nome: 'Sistema collettore', scelte: [[1, 'non coinvolto'], [2, 'dislocato o infiltrato']] },
      { id: 'd', nome: 'Diametro massimo', tipo: 'mm' },
      { id: 'faccia', nome: 'Faccia', scelte: [['a', 'anteriore'], ['p', 'posteriore']], senzaPunti: true },
    ],
    calcola: (v) => {
      if (!v.pol || !v.eso || !v.rim || !v.seno || !v.vie || !(v.d > 0)) return null;
      const D = v.d <= 40 ? 1 : v.d <= 70 ? 2 : 3, tot = +v.pol + +v.eso + +v.rim + +v.seno + +v.vie + D;
      return { valore: `${tot}${v.faccia || ''}`, testo: `PADUA ${tot}${v.faccia || ''}: ${tot <= 7 ? 'basso rischio (6-7)' : tot <= 9 ? 'rischio intermedio (8-9)' : 'alto rischio (≥ 10)'} di complicanze.` };
    },
  },
  bosniak: {
    nome: 'Bosniak 2019 (masse cistiche renali)', metodiche: ['TC', 'RM'], fonte: 'Silverman et al., Radiology 2019',
    intro: 'Scegli il reperto peggiore della lesione: la categoria è quella più alta.',
    campi: [
      { id: 'q', nome: 'Reperto peggiore', scelte: [
        ['I', 'Parete sottile (≤ 2 mm) e liscia, liquido semplice, niente setti né calcificazioni'],
        ['II', 'Pochi (1-3) setti sottili (≤ 2 mm) lisci; o calcificazioni; TC: omogenea ≥ 70 HU senza mdc, omogenea 21-30 HU in fase portale, o non captante > 20 HU; RM: omogenea marcatamente iperintensa in T1 con soppressione del grasso (circa 2,5 volte il parenchima), o omogenea marcatamente iperintensa in T2 non captante; o troppo piccola per caratterizzarla'],
        ['IIF', 'Parete o setti lisci minimamente ispessiti (3 mm) e captanti; o molti (≥ 4) setti sottili lisci captanti; RM: cisti eterogeneamente iperintensa in T1 con soppressione del grasso'],
        ['III', 'Una o più pareti o setti spessi (≥ 4 mm) o irregolari (protrusione convessa ≤ 3 mm a margini ottusi) captanti'],
        ['IV', 'Uno o più noduli captanti (protrusione ≥ 4 mm a margini ottusi, o di qualsiasi dimensione a margini acuti)']] },
    ],
    calcola: (v) => v.q && ({ valore: v.q, testo: `Bosniak ${v.q}: ${{ I: 'benigna, nessun controllo', II: 'benigna, nessun controllo', IIF: 'controllo a 6 e 12 mesi, poi ogni anno fino a 5 anni (malignità circa 10%)', III: 'chirurgia o sorveglianza attiva (malignità circa 50%)', IV: 'chirurgia (malignità circa 90%)' }[v.q]}.` }),
  },
  tirads: {
    nome: 'ACR TI-RADS (noduli tiroidei)', metodiche: ['Ecografia'], fonte: 'Tessler et al., J Am Coll Radiol 2017',
    intro: 'Somma dei punti delle cinque categorie; il diametro decide se fare l\'agoaspirato.',
    campi: [
      { id: 'c', nome: 'Composizione', scelte: [[0, 'cistico o quasi del tutto cistico'], [0, 'spongiforme'], [1, 'misto cistico-solido'], [2, 'solido o quasi del tutto solido']] },
      { id: 'e', nome: 'Ecogenicità', scelte: [[0, 'anecogeno'], [1, 'iper- o isoecogeno'], [2, 'ipoecogeno'], [3, 'marcatamente ipoecogeno']] },
      { id: 's', nome: 'Forma (in assiale)', scelte: [[0, 'più largo che alto'], [3, 'più alto che largo']] },
      { id: 'm', nome: 'Margini', scelte: [[0, 'netti'], [0, 'mal definiti'], [2, 'lobulati o irregolari'], [3, 'estensione extratiroidea']] },
      { id: 'f', nome: 'Spot iperecogeni (somma se più tipi)', multi: true, scelte: [[0, 'nessuno o grandi artefatti a coda di cometa'], [1, 'macrocalcificazioni'], [2, 'calcificazione periferica (a guscio)'], [3, 'spot iperecogeni puntiformi']] },
      { id: 'd', nome: 'Diametro massimo', tipo: 'mm' },
    ],
    calcola: (v) => {
      if ([v.c, v.e, v.s, v.m].some((x) => x === undefined || x === '')) return null;
      const pt = +v.c + +v.e + +v.s + +v.m + (v.f || []).reduce((a, b) => a + +b, 0);
      const tr = pt === 0 ? 1 : pt <= 2 ? 2 : pt === 3 ? 3 : pt <= 6 ? 4 : 5;
      const soglie = { 3: [25, 15], 4: [15, 10], 5: [10, 5] }[tr];
      let ind = tr <= 2 ? 'nessun agoaspirato' : '';
      if (soglie) ind = !(v.d > 0) ? `agoaspirato se ≥ ${virgola(soglie[0] / 10, 1)} cm, controllo se ≥ ${virgola(soglie[1] / 10, 1)} cm` : v.d >= soglie[0] ? 'agoaspirato' : v.d >= soglie[1] ? 'controllo ecografico' : 'nessun agoaspirato né controllo';
      return { valore: `TR${tr}`, testo: `ACR TI-RADS TR${tr} (${pt} punti, ${['', 'benigno', 'non sospetto', 'lievemente sospetto', 'moderatamente sospetto', 'altamente sospetto'][tr]})${v.d > 0 ? `, ${virgola(v.d / 10, 1)} cm` : ''}: ${ind}.` };
    },
  },
  pirads: {
    nome: 'PI-RADS v2.1 (prostata)', metodiche: ['RM'], fonte: 'Turkbey et al., Eur Urol 2019 (ACR PI-RADS v2.1)',
    intro: 'Una lesione alla volta. Zona periferica: comanda la diffusione (DWI/ADC), la perfusione (DCE) porta il 3 a 4. Zona di transizione: comanda il T2, la DWI porta il 2 a 3 (DWI ≥ 4) e il 3 a 4 (DWI 5). 4 o 5 dipende da diametro ≥ 1,5 cm o estensione extraprostatica.',
    campi: [
      { id: 'sede', nome: 'Sede: clicca sul disegno i settori occupati dalla lesione (mappa PI-RADS v2.1)', tipo: 'prostata' },
      { id: 'z', nome: 'Zona della lesione', scelte: [['pz', 'periferica (PZ)'], ['tz', 'di transizione (TZ)']] },
      { id: 'dwi', nome: 'DWI / ADC', scelte: [
        [1, 'normale su ADC e su b alto'],
        [2, 'ipointensità lineare o a cuneo su ADC e/o iperintensità lineare o a cuneo su b alto'],
        [3, 'focale ipointensa su ADC e/o iperintensa su b alto; può essere marcata su una delle due, non su entrambe'],
        ['45', 'focale marcatamente ipointensa su ADC e marcatamente iperintensa su b alto'],
        ['X', 'non diagnostica (artefatti)']] },
      { id: 't2pz', nome: 'T2 (zona periferica)', se: (v) => v.z === 'pz', scelte: [
        [1, 'iperintensità uniforme (normale)'],
        [2, 'ipointensità lineare, a cuneo o diffusa lieve, a margini sfumati'],
        [3, 'segnale eterogeneo o ipointensità moderata rotondeggiante non circoscritta'],
        ['45', 'focolaio o massa circoscritta, omogenea, moderatamente ipointensa, confinata alla prostata']] },
      { id: 't2tz', nome: 'T2 (zona di transizione)', se: (v) => v.z === 'tz', scelte: [
        [1, 'zona di transizione normale o nodulo rotondo completamente capsulato («nodulo tipico»)'],
        [2, 'nodulo per lo più capsulato, o nodulo omogeneo circoscritto senza capsula, o area lievemente ipointensa tra noduli'],
        [3, 'segnale eterogeneo con margini sfumati (e ciò che non rientra in 2, 4 o 5)'],
        ['45', 'area lenticolare o non circoscritta, omogenea, moderatamente ipointensa']] },
      { id: 'dce', nome: 'DCE (perfusione)', scelte: [['neg', 'negativa: nessuna captazione precoce focale, o diffusa, o corrispondente a un nodulo di IPB'], ['pos', 'positiva: captazione focale precoce che corrisponde al reperto T2/DWI'], ['', 'non eseguita (biparametrica)']] },
      { id: 'd', nome: 'Diametro massimo della lesione', tipo: 'mm' },
      { id: 'epe', nome: 'Estensione extraprostatica o comportamento invasivo certi', scelte: [['', 'no'], ['si', 'sì']] },
      { id: 'psa', nome: 'PSA (facoltativo)', tipo: 'num', unita: 'ng/ml' },
      { id: 'vl', nome: 'Prostata: diametro longitudinale (facoltativo)', tipo: 'mm' },
      { id: 'vt', nome: 'Prostata: diametro trasverso', tipo: 'mm' },
      { id: 'vap', nome: 'Prostata: diametro antero-posteriore', tipo: 'mm' },
    ],
    calcola: (v) => {
      if (!v.z || !v.dwi) return v.sede?.length ? { valore: '', testo: `Sede: ${v.sede.map(descriviSettore).join('; ')}. Completa zona e DWI per la categoria.` } : null;
      const grande = (v.d >= 15) || v.epe === 'si';
      const val = (x) => (x === '45' ? (grande ? 5 : 4) : +x);
      if ((v.dwi === '45' || v[v.z === 'pz' ? 't2pz' : 't2tz'] === '45') && !(v.d > 0) && v.epe !== 'si') return { valore: '', testo: 'Indica il diametro della lesione (4 o 5 dipende da 1,5 cm) o l\'estensione extraprostatica.' };
      let cat, perche;
      if (v.z === 'pz') {
        const base = v.dwi === 'X' ? (v.t2pz ? val(v.t2pz) : null) : val(v.dwi);
        if (base == null) return null;
        cat = base === 3 && v.dce === 'pos' ? 4 : base;
        perche = `zona periferica, ${v.dwi === 'X' ? `DWI non diagnostica: T2 ${base}` : `DWI ${base}`}${base === 3 ? `, DCE ${v.dce === 'pos' ? 'positiva (→ 4)' : v.dce === 'neg' ? 'negativa' : 'non eseguita'}` : ''}`;
      } else {
        if (!v.t2tz) return null;
        const t2 = val(v.t2tz), dwi = v.dwi === 'X' ? null : val(v.dwi);
        cat = t2 === 2 && dwi >= 4 ? 3 : t2 === 3 && dwi === 5 ? 4 : t2;
        perche = `zona di transizione, T2 ${t2}${dwi ? `, DWI ${dwi}` : ', DWI non diagnostica'}${cat !== t2 ? ` (→ ${cat})` : ''}`;
      }
      const sig = ['', 'molto bassa: tumore clinicamente significativo altamente improbabile', 'bassa: improbabile', 'intermedia: dubbio', 'alta: probabile', 'molto alta: altamente probabile'][cat];
      let extra = '';
      if (v.vl > 0 && v.vt > 0 && v.vap > 0) {
        const vol = v.vl * v.vt * v.vap * 0.52 / 1000;
        extra = ` Volume prostatico ${vol.toFixed(0)} ml (ellissoide)`;
        if (v.psa > 0) { const dens = v.psa / vol; extra += `, PSA density ${virgola(dens, 2)} ng/ml/ml${dens >= 0.15 ? ' (≥ 0,15: aumenta il sospetto, utile soprattutto nel PI-RADS 3)' : ''}`; }
        extra += '.';
      }
      const sede = v.sede?.length ? ` Sede: ${v.sede.map(descriviSettore).join('; ')} (${v.sede.map(sigla).join(', ')}).` : '';
      return { valore: `PI-RADS ${cat}`, testo: `PI-RADS ${cat} (${perche}${v.d > 0 ? `, ${virgola(v.d / 10, 1)} cm` : ''}): probabilità ${sig}.${sede}${extra}` };
    },
  },
  mammella: {
    nome: 'Mammella: sede della lesione (quadranti) e BI-RADS', metodiche: ['Mammografia', 'Ecografia', 'RM'], fonte: 'ACR BI-RADS Atlas, 5ª edizione (2013)',
    intro: 'Clicca sul disegno dove si trova la lesione: lato, quadrante e ora vengono dal punto (orologio come guardando la paziente). Aggiungi la distanza dal capezzolo e la profondità, poi la categoria BI-RADS.',
    campi: [
      { id: 'sede', nome: 'Sede: clicca sul disegno (la paziente vista di fronte; lascia vuoto se l\'esame è negativo)', tipo: 'mammella' },
      { id: 'acr', nome: 'Composizione (solo mammografia)', scelte: [['a', 'A: quasi interamente adiposa'], ['b', 'B: aree sparse di tessuto fibroghiandolare'], ['c', 'C: eterogeneamente densa'], ['d', 'D: estremamente densa']] },
      { id: 'dist', nome: 'Distanza dal capezzolo', tipo: 'mm' },
      { id: 'prof', nome: 'Profondità', scelte: [['anteriore', 'terzo anteriore'], ['medio', 'terzo medio'], ['posteriore', 'terzo posteriore']] },
      { id: 'd', nome: 'Diametro massimo', tipo: 'mm' },
      { id: 'br', nome: 'Categoria BI-RADS', scelte: [['0', '0: incompleto, servono altri esami'], ['1', '1: negativo'], ['2', '2: benigno'], ['3', '3: probabilmente benigno'], ['4a', '4A: sospetto basso'], ['4b', '4B: sospetto moderato'], ['4c', '4C: sospetto alto'], ['5', '5: altamente suggestivo di malignità'], ['6', '6: malignità accertata con biopsia']] },
    ],
    calcola: (v) => {
      if (!v.sede && !v.br) return null;
      const g = { 0: 'completare con altri esami di imaging o confronto con i precedenti', 1: 'controllo di screening secondo l\'età', 2: 'controllo di screening secondo l\'età', 3: 'controllo ravvicinato a 6 mesi (probabilità di malignità ≤ 2%)',
        '4a': 'biopsia (probabilità di malignità > 2% e ≤ 10%)', '4b': 'biopsia (> 10% e ≤ 50%)', '4c': 'biopsia (> 50% e < 95%)', 5: 'biopsia (≥ 95%)', 6: 'terapia chirurgica o oncologica appropriata' };
      const parti = v.sede ? [v.sede.testo] : [v.br === '1' ? 'Esame negativo' : 'Sede non indicata'];
      if (v.dist > 0) parti.push(`a ${virgola(v.dist / 10, 1)} cm dal capezzolo`);
      if (v.prof) parti.push(`terzo ${v.prof}`);
      let t = parti.join(', ').replace(/^./, (c) => c.toUpperCase());
      if (v.d > 0) t += `; diametro massimo ${virgola(v.d / 10, 1)} cm`;
      t += '.';
      if (v.acr) t += ` Composizione ACR ${v.acr.toUpperCase()}.`;
      if (v.br) t += ` BI-RADS ${v.br.toUpperCase()}: ${g[v.br]}.`;
      return { valore: v.br ? `BI-RADS ${v.br.toUpperCase()}` : v.sede.breve, testo: t };
    },
  },
  segmenti: {
    nome: 'Fegato: sede della lesione (segmenti di Couinaud)', metodiche: ['TC', 'RM', 'Ecografia'], fonte: 'Couinaud 1957; nomenclatura di Brisbane 2000',
    intro: 'Clicca i segmenti occupati dalla lesione (di nuovo per toglierli). Le vene sovraepatiche separano i settori, il piano portale i segmenti superiori da quelli inferiori; il caudato (I) è posteriore. Una lesione per scheda.',
    campi: [
      { id: 'sede', nome: 'Sede: segmenti occupati', tipo: 'fegato' },
      { id: 'd', nome: 'Diametro massimo', tipo: 'mm' },
      { id: 'n', nome: 'Lesioni', scelte: [['1', 'singola'], ['2-3', '2-3'], ['molte', 'multiple (> 3)']] },
      { id: 'nat', nome: 'Natura più probabile', scelte: [['cisti', 'cisti semplice'], ['angioma', 'emangioma'], ['ifn', 'iperplasia nodulare focale'], ['adenoma', 'adenoma'], ['hcc', 'epatocarcinoma'], ['ccc', 'colangiocarcinoma intraepatico'], ['meta', 'metastasi'], ['ascesso', 'ascesso'], ['steatosi', 'steatosi o risparmio focale'], ['nd', 'non caratterizzabile: servono altri esami']] },
    ],
    calcola: (v) => {
      if (!v.sede?.length) return null;
      const nat = { cisti: 'cisti semplice', angioma: 'emangioma', ifn: 'iperplasia nodulare focale', adenoma: 'adenoma', hcc: 'epatocarcinoma', ccc: 'colangiocarcinoma intraepatico', meta: 'metastasi', ascesso: 'ascesso', steatosi: 'steatosi o risparmio focale', nd: 'non caratterizzabile' }[v.nat];
      let t = `${v.n === 'molte' ? 'Lesioni multiple, la maggiore al' : v.n === '2-3' ? 'Lesioni (2-3), la maggiore al' : 'Lesione focale al'} ${SEDE_FEGATO(v)}`;
      if (v.d > 0) t += `, diametro massimo ${virgola(v.d / 10, 1)} cm`;
      if (nat) t += v.nat === 'nd' ? '; non caratterizzabile con questo esame' : `; aspetto di ${nat}`;
      return { valore: v.sede.map(siglaSegmento).join(', '), testo: t + '.' };
    },
  },
  cinetica: {
    nome: 'Cinetica segmentaria del ventricolo sinistro (bull\'s eye, 17 segmenti)', metodiche: ['Ecocardio', 'Ecografia', 'RM', 'TC'], fonte: 'Cerqueira et al., Circulation 2002 (modello AHA); Lang et al., J Am Soc Echocardiogr 2015 (ASE/EACVI)',
    intro: 'Per ogni segmento visibile si dà il punteggio di cinetica: 1 normocinesia, 2 ipocinesia, 3 acinesia (nessun ispessimento), 4 discinesia (movimento paradosso). L\'indice di cinetica (WMSI) è la media dei segmenti valutati: 1 = normale. In apicale 4 camere si vedono setto inferiore e parete anterolaterale; per gli altri segmenti servono 2 e 3 camere e le sezioni in asse corto.',
    campi: [
      { id: 'seg', nome: 'Bull\'s eye: scegli il punteggio a destra, poi clicca i segmenti', tipo: 'bullseye' },
      { id: 'fe', nome: 'Frazione di eiezione (stima, facoltativa)', tipo: 'num', unita: '%' },
    ],
    calcola: (v) => {
      const segs = Object.entries(v.seg || {}).filter(([, x]) => ['1', '2', '3', '4'].includes(String(x)));
      if (!segs.length && !(v.fe > 0)) return null;
      const parti = [];
      if (segs.length) {
        const wmsi = segs.reduce((t, [, x]) => t + +x, 0) / segs.length;
        const anom = segs.filter(([, x]) => +x > 1);
        parti.push(anom.length ? `Alterazioni della cinetica: ${descriviBullseye(Object.fromEntries(anom))}.` : `Cinetica segmentaria conservata nei ${segs.length} segmenti valutati.`);
        if (anom.length) {
          const terr = Object.entries(TERRITORIO_VS).filter(([, l]) => anom.some(([s]) => l.includes(+s))).map(([t]) => ({ IVA: 'discendente anteriore', CDx: 'coronaria destra', Cx: 'circonflessa' }[t]));
          parti.push(`Territorio ${terr.length > 1 ? 'di più arterie' : 'dell\'arteria'} ${terr.join(', ')} (distribuzione abituale).`);
        }
        const nv = Object.values(v.seg || {}).filter((x) => x === 'nv').length;
        parti.push(`WMSI ${virgola(wmsi, 2)} su ${segs.length} segmenti${nv ? ` (${nv} non valutabili)` : ''}${segs.length < 17 ? '' : ''}.`);
        var valore = `WMSI ${virgola(wmsi, 2)}`;
      }
      if (v.fe > 0) parti.push(`Frazione di eiezione stimata ${Math.round(v.fe)}%: ${v.fe <= 40 ? 'ridotta (≤ 40%)' : v.fe < 50 ? 'lievemente ridotta (41-49%)' : 'conservata (≥ 50%)'}.`);
      return { valore: valore || `FE ${Math.round(v.fe)}%`, testo: parti.join(' ') };
    },
  },
  lirads: {
    nome: 'LI-RADS v2018 TC/RM (fegato a rischio)', metodiche: ['TC', 'RM'], fonte: 'ACR CT/MRI LI-RADS v2018',
    intro: 'Solo nei pazienti a rischio di epatocarcinoma (cirrosi, epatite B cronica, epatocarcinoma pregresso), non sotto i 18 anni né nella cirrosi congenita o vascolare. Prima le categorie dirette (LR-1, 2, M, TIV), poi i criteri maggiori: APHE non ad anello, dimensione, wash-out non periferico, capsula, crescita oltre la soglia.',
    campi: [
      { id: 'sede', nome: 'Sede: segmenti occupati', tipo: 'fegato' },
      { id: 'rischio', nome: 'Paziente a rischio di epatocarcinoma', scelte: [['si', 'sì'], ['no', 'no']] },
      { id: 'pre', nome: 'Categoria diretta', scelte: [['algo', 'nessuna: usa i criteri maggiori'], ['nc', 'non valutabile per qualità o fasi mancanti (LR-NC)'], ['1', 'sicuramente benigna (LR-1: cisti, angioma tipico…)'], ['2', 'probabilmente benigna (LR-2)'], ['m', 'maligna non specifica per HCC (LR-M: APHE ad anello, wash-out periferico, restrizione «a bersaglio»…)'], ['tiv', 'tumore in vena (LR-TIV): tessuto che impregna nel lume venoso']] },
      { id: 'd', nome: 'Diametro (esterno a esterno, fase in cui il margine è più netto)', tipo: 'mm', se: (v) => v.pre === 'algo' },
      { id: 'aphe', nome: 'Iperenhancement in fase arteriosa (APHE) non ad anello', scelte: [['si', 'sì'], ['no', 'no']], se: (v) => v.pre === 'algo' },
      { id: 'wo', nome: 'Wash-out non periferico (portale o tardiva)', scelte: [['si', 'sì'], ['no', 'no']], se: (v) => v.pre === 'algo' },
      { id: 'caps', nome: 'Capsula che impregna', scelte: [['si', 'sì'], ['no', 'no']], se: (v) => v.pre === 'algo' },
      { id: 'cresc', nome: 'Crescita oltre la soglia (≥ 50% in ≤ 6 mesi)', scelte: [['si', 'sì'], ['no', 'no o nessun precedente']], se: (v) => v.pre === 'algo' },
      { id: 'anc', nome: 'Criteri ancillari (facoltativi)', scelte: [['', 'nessuno o in equilibrio'], ['su', 'favorevoli alla malignità: sale di una categoria, al massimo LR-4'], ['giu', 'favorevoli alla benignità: scende di una categoria']], se: (v) => v.pre === 'algo' },
    ],
    calcola: (v) => {
      const sede = v.sede?.length ? ` Sede: ${SEDE_FEGATO(v)}.` : '';
      if (v.rischio === 'no') return { valore: 'non applicabile', testo: `LI-RADS non applicabile: il paziente non è a rischio di epatocarcinoma; la lesione si descrive e si caratterizza senza categoria LI-RADS.${sede}` };
      if (!v.rischio || !v.pre) return v.sede?.length ? { valore: '', testo: `Sede: ${SEDE_FEGATO(v)}. Completa la scheda per la categoria.` } : null;
      const G = { 'NC': 'ripetere o completare l\'esame entro 3 mesi', 1: 'proseguire la sorveglianza ecografica ogni 6 mesi', 2: 'proseguire la sorveglianza; valutare un controllo entro 6 mesi', 3: 'controllo con TC o RM multifasica a 3-6 mesi',
        4: 'discussione multidisciplinare: controllo entro 3 mesi o biopsia', 5: 'epatocarcinoma certo: discussione multidisciplinare per il trattamento, la biopsia non serve', M: 'maligna, non specifica per epatocarcinoma: discussione multidisciplinare, di solito biopsia', TIV: 'tumore in vena: discussione multidisciplinare (stadiazione e trattamento)' };
      let cat;
      if (v.pre !== 'algo') cat = { nc: 'NC', 1: 1, 2: 2, m: 'M', tiv: 'TIV' }[v.pre];
      else {
        if (!(v.d > 0) || !v.aphe || !v.wo || !v.caps || !v.cresc) return { valore: '', testo: 'Completa diametro e criteri maggiori.' + sede };
        const d = v.d, f = (v.wo === 'si') + (v.caps === 'si') + (v.cresc === 'si');
        if (v.aphe === 'no') cat = d < 20 ? (f >= 2 ? 4 : 3) : (f >= 1 ? 4 : 3);
        else if (d < 10) cat = f >= 1 ? 4 : 3;
        else if (d < 20) cat = f >= 2 ? 5 : f === 1 ? (v.caps === 'si' ? 4 : 5) : 3;
        else cat = f >= 1 ? 5 : 4;
        if (v.anc === 'su' && cat < 4) cat++;
        else if (v.anc === 'giu' && cat > 1) cat--;
      }
      const perche = v.pre === 'algo' ? ` (${Math.round(v.d)} mm, APHE ${v.aphe === 'si' ? 'non ad anello presente' : 'assente'}${v.wo === 'si' ? ', wash-out' : ''}${v.caps === 'si' ? ', capsula' : ''}${v.cresc === 'si' ? ', crescita oltre la soglia' : ''}${v.anc === 'su' ? ', ancillari di malignità' : v.anc === 'giu' ? ', ancillari di benignità' : ''})` : '';
      return { valore: `LR-${cat}`, testo: `LI-RADS LR-${cat}${perche}: ${G[cat]}.${sede}` };
    },
  },
  lrtr: {
    nome: 'LI-RADS dopo trattamento (LR-TR)', metodiche: ['TC', 'RM'], fonte: 'ACR LI-RADS v2018 Treatment Response',
    intro: 'Per una lesione già trattata con terapie locoregionali (ablazione, TACE, radioembolizzazione, radioterapia). Si guarda il tessuto che impregna nella o lungo la zona trattata.',
    campi: [
      { id: 'sede', nome: 'Sede: segmenti della zona trattata', tipo: 'fegato' },
      { id: 'tr', nome: 'Trattamento', scelte: [['abl', 'ablazione (radiofrequenza, microonde)'], ['tace', 'chemioembolizzazione (TACE)'], ['tare', 'radioembolizzazione (TARE)'], ['rt', 'radioterapia stereotassica']] },
      { id: 'r', nome: 'Aspetto della zona trattata', scelte: [['nv', 'non valutabile (qualità o fasi insufficienti)'], ['nonvit', 'nessuna impregnazione, o solo l\'impregnazione attesa dopo il trattamento'], ['eq', 'impregnazione atipica, non tipica del trattamento né di tumore vitale'], ['vit', 'tessuto nodulare, a massa o spesso e irregolare con APHE, wash-out o impregnazione simile a prima del trattamento']] },
      { id: 'd', nome: 'Diametro del tessuto vitale (se presente)', tipo: 'mm', se: (v) => v.r === 'vit' },
    ],
    calcola: (v) => {
      if (!v.r) return null;
      const C = { nv: ['LR-TR non valutabile', 'ripetere o completare l\'esame'], nonvit: ['LR-TR non vitale', 'proseguire i controlli (di solito ogni 3 mesi nel primo anno)'], eq: ['LR-TR equivoco', 'controllo ravvicinato entro 3 mesi'], vit: ['LR-TR vitale', 'discussione multidisciplinare per ritrattamento'] }[v.r];
      const tr = { abl: 'ablazione', tace: 'TACE', tare: 'radioembolizzazione', rt: 'radioterapia' }[v.tr];
      return { valore: C[0], testo: `${C[0]}${tr ? ` dopo ${tr}` : ''}${v.r === 'vit' && v.d > 0 ? `, tessuto vitale di ${Math.round(v.d)} mm` : ''}: ${C[1]}.${v.sede?.length ? ` Sede: ${SEDE_FEGATO(v)}.` : ''}` };
    },
  },
  uslirads: {
    nome: 'US LI-RADS (ecografia di sorveglianza)', metodiche: ['Ecografia'], fonte: 'ACR US LI-RADS v2017',
    intro: 'Ecografia di sorveglianza nel paziente a rischio di epatocarcinoma. Categoria per l\'esame (US-1, 2, 3) e punteggio di visualizzazione (A, B, C).',
    campi: [
      { id: 'sede', nome: 'Sede dell\'osservazione più significativa (facoltativa)', tipo: 'fegato' },
      { id: 'oss', nome: 'Osservazioni', scelte: [['nessuna', 'nessuna, o solo reperti sicuramente benigni (cisti, angioma noto…)'], ['si', 'osservazione non sicuramente benigna']] },
      { id: 'd', nome: 'Diametro dell\'osservazione', tipo: 'mm', se: (v) => v.oss === 'si' },
      { id: 'tv', nome: 'Trombosi venosa nuova (porta o sovraepatiche)', scelte: [['no', 'no'], ['si', 'sì']] },
      { id: 'vis', nome: 'Visualizzazione', scelte: [['A', 'A: nessuna limitazione o minima'], ['B', 'B: limitazioni moderate (possono sfuggire piccole lesioni)'], ['C', 'C: limitazioni gravi (possono sfuggire lesioni importanti)']] },
    ],
    calcola: (v) => {
      if (!v.oss || !v.tv) return null;
      if (v.oss === 'si' && !(v.d > 0) && v.tv !== 'si') return { valore: '', testo: 'Indica il diametro dell\'osservazione.' };
      const cat = v.tv === 'si' || v.d >= 10 ? 3 : v.oss === 'si' ? 2 : 1;
      const G = { 1: 'negativa: ripetere l\'ecografia di sorveglianza a 6 mesi', 2: 'sottosoglia (< 10 mm): ripetere l\'ecografia a 3-6 mesi', 3: 'positiva: TC o RM multifasica con mdc' }[cat];
      return { valore: `US-${cat}${v.vis ? ` VIS-${v.vis}` : ''}`, testo: `US LI-RADS US-${cat}${v.oss === 'si' && v.d > 0 ? ` (osservazione di ${Math.round(v.d)} mm${v.sede?.length ? ` al ${SEDE_FEGATO(v)}` : ''})` : ''}${v.tv === 'si' ? ', trombosi venosa nuova' : ''}: ${G}.${v.vis ? ` Visualizzazione ${v.vis}${v.vis === 'C' ? ': valutare TC o RM anche se l\'ecografia è negativa' : ''}.` : ''}` };
    },
  },
  steatosi: {
    nome: 'Steatosi epatica in TC senza mdc', metodiche: ['TC'], fonte: 'Kodama et al., AJR 2007; Boyce et al., AJR 2010',
    intro: 'Solo sulla TC senza mdc. Misura con la ROI la densità del fegato (lobo destro, lontano dai vasi, almeno 1 cm²) e della milza.',
    campi: [
      { id: 'f', nome: 'Densità del fegato', tipo: 'num', unita: 'HU' },
      { id: 'm', nome: 'Densità della milza (facoltativa)', tipo: 'num', unita: 'HU' },
    ],
    calcola: (v) => {
      if (v.f == null || v.f === '') return null;
      const f = +v.f, dif = v.m != null && v.m !== '' ? f - +v.m : null;
      const grave = f < 40, lieve = dif != null && dif < -10;
      const giud = grave ? 'steatosi moderata-grave (fegato < 40 HU: grasso epatico circa ≥ 30%)' : lieve ? 'steatosi (fegato meno milza < −10 HU)' : dif != null && dif < 0 ? 'possibile steatosi lieve (fegato poco meno denso della milza)' : 'nessuna steatosi significativa';
      return { valore: grave ? 'moderata-grave' : lieve ? 'presente' : 'assente/lieve', testo: `Fegato ${Math.round(f)} HU${dif != null ? `, milza ${Math.round(+v.m)} HU (differenza ${dif > 0 ? '+' : ''}${Math.round(dif)} HU)` : ''}: ${giud}. La TC non vede bene la steatosi lieve: per quantificare servono RM (frazione di grasso, PDFF) o elastografia/CAP.` };
    },
  },
  lungrads: {
    nome: 'Lung-RADS v2022 (screening del tumore polmonare)', metodiche: ['TC'], fonte: 'ACR Lung-RADS v2022',
    intro: 'Solo per la TC a basse dosi di screening. Il nodulo che decide è quello di categoria più alta. Diametro = media tra asse lungo e corto, arrotondata al decimo di mm; per i parzialmente solidi conta anche la componente solida.',
    campi: [
      { id: 't', nome: 'Reperto', scelte: [['0', 'nessun nodulo, o noduli con calcificazione benigna o grasso (amartoma)'], ['solido', 'nodulo solido'], ['parz', 'nodulo parzialmente solido'], ['vetro', 'nodulo a vetro smerigliato puro'], ['endo', 'nodulo endobronchiale (segmentario o più prossimale)']] },
      { id: 'st', nome: 'Rispetto ai precedenti', scelte: [['base', 'primo esame (baseline)'], ['nuovo', 'nuovo'], ['cresc', 'in crescita (> 1,5 mm in 12 mesi)'], ['stab', 'stabile da almeno 3 mesi']], se: (v) => ['solido', 'parz', 'vetro'].includes(v.t) },
      { id: 'd', nome: 'Diametro medio del nodulo', tipo: 'mm', se: (v) => ['solido', 'parz', 'vetro'].includes(v.t) },
      { id: 'ds', nome: 'Diametro medio della componente solida', tipo: 'mm', se: (v) => v.t === 'parz' },
      { id: 'pf', nome: 'Nodulo solido iuxtapleurico o perifissurale liscio, ovale-triangolare, < 10 mm', scelte: [['', 'no'], ['si', 'sì']], se: (v) => v.t === 'solido' },
      { id: 'x', nome: 'Altri segni di malignità (spiculature, linfonodi ingranditi, crescita con componente solida, metastasi…)', scelte: [['', 'no'], ['si', 'sì: 4X se la categoria è 3 o 4']] },
    ],
    calcola: (v) => {
      if (!v.t) return null;
      let cat;
      if (v.t === '0') cat = '1';
      else if (v.t === 'endo') cat = '4A';
      else {
        if (!v.st || !(v.d > 0) || (v.t === 'parz' && v.ds == null)) return { valore: '', testo: 'Completa stato, diametro e (se parzialmente solido) componente solida.' };
        const d = v.d, ds = +v.ds || 0, nuovo = v.st === 'nuovo' || v.st === 'cresc';
        if (v.st === 'stab') cat = '2';
        else if (v.t === 'solido') {
          if (v.pf === 'si' && d < 10) cat = '2';
          else if (v.st === 'base') cat = d < 6 ? '2' : d < 8 ? '3' : d < 15 ? '4A' : '4B';
          else if (v.st === 'nuovo') cat = d < 4 ? '2' : d < 6 ? '3' : d < 8 ? '4A' : '4B';
          else cat = d < 8 ? '4A' : '4B';
        } else if (v.t === 'parz') {
          if (!nuovo) cat = d < 6 ? '2' : ds < 6 ? '3' : ds < 8 ? '4A' : '4B';
          else cat = d < 6 ? '3' : ds < 4 ? '4A' : '4B';
        } else cat = d < 30 ? '2' : '3';
      }
      if (v.x === 'si' && ['3', '4A', '4B'].includes(cat)) cat = '4X';
      const G = { 1: 'negativo: TC a basse dosi a 12 mesi', 2: 'benigno: TC a basse dosi a 12 mesi', 3: 'probabilmente benigno: TC a basse dosi a 6 mesi', '4A': 'sospetto: TC a basse dosi a 3 mesi; PET-TC se c\'è una componente solida ≥ 8 mm', '4B': 'molto sospetto: TC del torace con o senza mdc, PET-TC e/o campionamento tissutale', '4X': 'molto sospetto per altri segni: TC del torace, PET-TC e/o campionamento tissutale' };
      return { valore: `Lung-RADS ${cat}`, testo: `Lung-RADS ${cat}${v.d > 0 && !['0', 'endo'].includes(v.t) ? ` (${{ solido: 'nodulo solido', parz: 'nodulo parzialmente solido', vetro: 'nodulo a vetro smerigliato' }[v.t]} di ${virgola(+v.d, 1)} mm${v.t === 'parz' ? `, componente solida ${virgola(+v.ds || 0, 1)} mm` : ''})` : ''}: ${G[cat]}.` };
    },
  },
  orads: {
    nome: 'O-RADS US v2022 (masse annessiali)', metodiche: ['Ecografia'], fonte: 'ACR O-RADS US v2022 (Strachowski et al., Radiology 2023)',
    intro: 'Una lesione alla volta, la più sospetta. Color score: 1 nessun flusso, 2 minimo, 3 moderato, 4 molto vascolarizzato. Le lesioni classiche benigne (endometrioma, dermoide, cisti emorragica, paraovarica, idrosalpinge, cisti d\'inclusione peritoneale) con aspetto tipico sono O-RADS 2 sotto i 10 cm.',
    campi: [
      { id: 't', nome: 'Tipo di lesione', scelte: [
        ['fis', 'fisiologica: follicolo o corpo luteo ≤ 3 cm (premenopausa)'],
        ['class', 'lesione classica benigna con aspetto tipico'],
        ['sempl', 'cisti semplice'],
        ['unil', 'uni- o biloculare, parete liscia, senza componente solida (non semplice)'],
        ['unirr', 'uni- o biloculare con parete interna irregolare (< 3 mm), senza componente solida'],
        ['mult', 'multiloculare a pareti e setti lisci, senza componente solida'],
        ['multirr', 'multiloculare con parete o setti irregolari, senza componente solida'],
        ['unisol', 'uni- o biloculare con componente solida'],
        ['multsol', 'multiloculare con componente solida'],
        ['solliscia', 'solida (≥ 80%) a contorno liscio'],
        ['solirr', 'solida a contorno irregolare'],
        ['asc', 'ascite e/o noduli peritoneali']] },
      { id: 'd', nome: 'Diametro massimo', tipo: 'mm', se: (v) => ['class', 'sempl', 'unil', 'mult'].includes(v.t) },
      { id: 'cs', nome: 'Color score', scelte: [['1', '1: nessun flusso'], ['2', '2: flusso minimo'], ['3', '3: flusso moderato'], ['4', '4: molto vascolarizzata']], se: (v) => ['mult', 'unisol', 'multsol', 'solliscia'].includes(v.t) },
      { id: 'pp', nome: 'Componente solida (uni- o biloculare)', scelte: [['13', '1-3 proiezioni papillari, o solida non papillare'], ['4', '≥ 4 proiezioni papillari']], se: (v) => v.t === 'unisol' },
    ],
    calcola: (v) => {
      if (!v.t) return null;
      const d = +v.d || 0, cs = +v.cs || 0; let cat;
      if (['class', 'sempl', 'unil', 'mult'].includes(v.t) && !(d > 0)) return { valore: '', testo: 'Indica il diametro massimo.' };
      if (['mult', 'unisol', 'multsol', 'solliscia'].includes(v.t) && !cs) return { valore: '', testo: 'Indica il color score.' };
      switch (v.t) {
        case 'fis': cat = 1; break;
        case 'class': case 'sempl': case 'unil': cat = d < 100 ? 2 : 3; break;
        case 'unirr': cat = 3; break;
        case 'mult': cat = d < 100 && cs < 4 ? 3 : 4; break;
        case 'multirr': cat = 4; break;
        case 'unisol': if (!v.pp) return { valore: '', testo: 'Indica la componente solida.' }; cat = v.pp === '4' || cs >= 3 ? 5 : 4; break;
        case 'multsol': cat = cs >= 3 ? 5 : 4; break;
        case 'solliscia': cat = cs === 1 ? 3 : cs === 4 ? 5 : 4; break;
        default: cat = 5;
      }
      const G = { 1: 'normale: nessun controllo', 2: 'quasi certamente benigna (rischio < 1%): controllo secondo il tipo di lesione', 3: 'basso rischio (1-10%): ecografia specialistica o RM, gestione ginecologica', 4: 'rischio intermedio (10-50%): ecografia specialistica o RM (O-RADS MRI), valutazione del ginecologo oncologo', 5: 'alto rischio (≥ 50%): ginecologo oncologo' };
      return { valore: `O-RADS ${cat}`, testo: `O-RADS US ${cat}${d > 0 ? ` (${virgola(d / 10, 1)} cm)` : ''}: ${G[cat]}.` };
    },
  },
  aast: {
    nome: 'AAST 2018: traumi di milza, fegato e rene (TC)', metodiche: ['TC'], fonte: 'Kozar et al., J Trauma Acute Care Surg 2018',
    intro: 'Spunta tutte le lesioni presenti: il grado è quello più alto. Con lesioni multiple di grado III o più si sale di un grado. Lesione vascolare = pseudoaneurisma o fistola arterovenosa; sanguinamento attivo = stravaso di mdc che aumenta in fase tardiva.',
    campi: [
      { id: 'o', nome: 'Organo', scelte: [['milza', 'milza'], ['fegato', 'fegato'], ['rene', 'rene']] },
      { id: 'gm', nome: 'Lesioni della milza', multi: true, senzaPunti: true, se: (v) => v.o === 'milza', scelte: [
        ['1a', 'I · ematoma sottocapsulare < 10% della superficie'], ['1b', 'I · lacerazione < 1 cm di profondità'], ['1c', 'I · raccolta perisplenica senza altre lesioni'],
        ['2a', 'II · ematoma sottocapsulare 10-50%'], ['2b', 'II · ematoma intraparenchimale < 5 cm'], ['2c', 'II · lacerazione 1-3 cm'],
        ['3a', 'III · ematoma sottocapsulare > 50%, o sottocapsulare/intraparenchimale rotto'], ['3b', 'III · ematoma intraparenchimale ≥ 5 cm'], ['3c', 'III · lacerazione > 3 cm'],
        ['4a', 'IV · lesione vascolare o sanguinamento attivo confinato nella capsula'], ['4b', 'IV · lacerazione dei vasi segmentari o ilari con devascolarizzazione > 25%'],
        ['5a', 'V · milza frantumata'], ['5b', 'V · lesione vascolare con sanguinamento attivo oltre la milza, nel peritoneo']] },
      { id: 'gf', nome: 'Lesioni del fegato', multi: true, senzaPunti: true, se: (v) => v.o === 'fegato', scelte: [
        ['1a', 'I · ematoma sottocapsulare < 10% della superficie'], ['1b', 'I · lacerazione < 1 cm di profondità'],
        ['2a', 'II · ematoma sottocapsulare 10-50%'], ['2b', 'II · ematoma intraparenchimale < 10 cm'], ['2c', 'II · lacerazione 1-3 cm, lunga ≤ 10 cm'],
        ['3a', 'III · ematoma sottocapsulare > 50%, o rotto'], ['3b', 'III · ematoma intraparenchimale > 10 cm'], ['3c', 'III · lacerazione > 3 cm'], ['3d', 'III · lesione vascolare o sanguinamento attivo confinato nel parenchima'],
        ['4a', 'IV · distruzione del 25-75% di un lobo'], ['4b', 'IV · sanguinamento attivo oltre il fegato, nel peritoneo'],
        ['5a', 'V · distruzione > 75% di un lobo'], ['5b', 'V · lesione venosa iuxtaepatica (cava retroepatica, vene sovraepatiche centrali)']] },
      { id: 'gr', nome: 'Lesioni del rene', multi: true, senzaPunti: true, se: (v) => v.o === 'rene', scelte: [
        ['1a', 'I · ematoma sottocapsulare e/o contusione senza lacerazione'],
        ['2a', 'II · ematoma perirenale confinato nella fascia di Gerota'], ['2b', 'II · lacerazione ≤ 1 cm senza stravaso urinario'],
        ['3a', 'III · lacerazione > 1 cm senza rottura del sistema collettore né stravaso urinario'], ['3b', 'III · lesione vascolare o sanguinamento attivo confinato nella fascia di Gerota'],
        ['4a', 'IV · lacerazione nel sistema collettore con stravaso urinario, o lacerazione della pelvi / rottura del giunto'], ['4b', 'IV · lesione dell\'arteria o della vena segmentaria'], ['4c', 'IV · sanguinamento attivo oltre la fascia di Gerota'], ['4d', 'IV · infarto segmentario o completo da trombosi, senza sanguinamento'],
        ['5a', 'V · lacerazione o avulsione dell\'arteria o della vena renale principale, o loro trombosi'], ['5b', 'V · rene frantumato, senza parenchima riconoscibile'], ['5c', 'V · rene devascolarizzato con sanguinamento attivo']] },
      { id: 'mult', nome: 'Lesioni multiple di grado ≥ III nello stesso organo', scelte: [['', 'no'], ['si', 'sì (+1 grado, fino a IV)']] },
    ],
    calcola: (v) => {
      const l = v.o === 'milza' ? v.gm : v.o === 'fegato' ? v.gf : v.o === 'rene' ? v.gr : null;
      if (!l?.length) return null;
      let g = Math.max(...l.map((x) => +x[0]));
      if (v.mult === 'si' && g >= 3 && g < 4) g = 4;
      const R = ['', 'I', 'II', 'III', 'IV', 'V'][g];
      return { valore: `AAST ${R}`, testo: `Trauma ${{ milza: 'splenico', fegato: 'epatico', rene: 'renale' }[v.o]}, grado AAST ${R}${g >= 4 ? ': grave, valutare con il chirurgo il trattamento (angioembolizzazione o chirurgia secondo la stabilità emodinamica)' : g === 3 ? ': moderato; nel paziente stabile di solito trattamento conservativo, attenzione alle lesioni vascolari' : ': lieve, di solito trattamento conservativo'}.` };
    },
  },
  genant: {
    nome: 'Genant (fratture vertebrali da fragilità)', metodiche: ['RX', 'TC', 'RM'], fonte: 'Genant et al., J Bone Miner Res 1993',
    intro: 'Semiquantitativo, una vertebra per scheda, nella proiezione laterale o nella ricostruzione sagittale. Misura le altezze anteriore, media e posteriore; per il crollo (riduzione uniforme) serve l\'altezza di una vertebra vicina integra.',
    campi: [
      { id: 'liv', nome: 'Vertebra', scelte: ['D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'L1', 'L2', 'L3', 'L4', 'L5'].map((x) => [x, x]), senzaPunti: true },
      { id: 'ha', nome: 'Altezza anteriore', tipo: 'mm' },
      { id: 'hm', nome: 'Altezza media (centro del soma)', tipo: 'mm' },
      { id: 'hp', nome: 'Altezza posteriore', tipo: 'mm' },
      { id: 'rif', nome: 'Altezza posteriore di una vertebra vicina integra (per il crollo)', tipo: 'mm' },
    ],
    calcola: (v) => {
      const h = [v.ha, v.hm, v.hp].map(Number);
      if (!h.every((x) => x > 0)) return v.liv ? { valore: '', testo: `${v.liv}: misura le tre altezze.` } : null;
      const [a, m, p] = h, max = Math.max(a, m, p), min = Math.min(a, m, p);
      let rid = 1 - min / max, tipo = a === min ? 'a cuneo' : m === min ? 'biconcava' : 'posteriore';
      if (v.rif > 0 && 1 - max / v.rif > rid) { rid = 1 - max / v.rif; tipo = 'da crollo (riduzione di tutte le altezze)'; }
      const pc = Math.round(rid * 100), g = pc < 20 ? 0 : pc <= 25 ? 1 : pc <= 40 ? 2 : 3;
      return { valore: `Genant ${g}`, testo: `${v.liv || 'Vertebra'}: riduzione di altezza del ${pc}%${g ? `, deformità ${tipo}` : ''}: Genant ${g} (${['nessuna frattura (< 20%)', 'frattura lieve (20-25%)', 'frattura moderata (25-40%)', 'frattura grave (> 40%)'][g]}).${g ? ' Una frattura vertebrale da fragilità indica osteoporosi grave: segnalarla e consigliare la valutazione per la terapia.' : ''}` };
    },
  },
  fazekas: {
    nome: 'Fazekas (iperintensità della sostanza bianca)', metodiche: ['RM'], fonte: 'Fazekas et al., AJR 1987',
    intro: 'Sulle immagini FLAIR o T2. Si danno due punteggi: periventricolare e sostanza bianca profonda.',
    campi: [
      { id: 'pv', nome: 'Periventricolare', scelte: [['0', '0: assenti'], ['1', '1: «cappucci» ai corni frontali o sottile linea'], ['2', '2: alone liscio'], ['3', '3: iperintensità irregolari che si estendono nella sostanza bianca profonda']] },
      { id: 'dp', nome: 'Sostanza bianca profonda', scelte: [['0', '0: assenti'], ['1', '1: focolai puntiformi'], ['2', '2: focolai che iniziano a confluire'], ['3', '3: ampie aree confluenti']] },
    ],
    calcola: (v) => {
      if (v.pv == null || v.dp == null) return null;
      const dp = +v.dp;
      return { valore: `Fazekas ${v.pv}/${v.dp}`, testo: `Fazekas periventricolare ${v.pv}, sostanza bianca profonda ${v.dp}: ${dp === 0 ? 'nessuna leucoencefalopatia' : dp === 1 ? 'lieve, comune con l\'età' : dp === 2 ? 'moderata: malattia dei piccoli vasi significativa' : 'grave: malattia dei piccoli vasi estesa (rischio di ictus, decadimento cognitivo e cadute)'}.` };
    },
  },
  mcdonald: {
    nome: 'McDonald 2017 (sclerosi multipla)', metodiche: ['RM'], fonte: 'Thompson et al., Lancet Neurol 2018; MAGNIMS-CMSC-NAIMS 2021',
    intro: 'Lesioni iperintense in T2/FLAIR di almeno 3 mm. Disseminazione nello spazio (DIS): almeno una lesione in 2 delle 4 sedi tipiche. Disseminazione nel tempo (DIT): lesioni con e senza impregnazione nello stesso esame, oppure una lesione nuova (T2 o captante) a un controllo, oppure bande oligoclonali nel liquor. La lesione sintomatica conta. Diagnosi solo con un quadro clinico compatibile e dopo aver escluso alternative.',
    campi: [
      { id: 'pv', nome: 'Periventricolare (a contatto con i ventricoli, perpendicolari: «dita di Dawson»)', scelte: [['si', 'sì'], ['no', 'no']] },
      { id: 'jc', nome: 'Corticale o iuxtacorticale (che tocca la corteccia, fibre a U)', scelte: [['si', 'sì'], ['no', 'no']] },
      { id: 'it', nome: 'Sottotentoriale (tronco, peduncoli, cervelletto)', scelte: [['si', 'sì'], ['no', 'no']] },
      { id: 'sc', nome: 'Midollo spinale', scelte: [['si', 'sì'], ['no', 'no'], ['nv', 'non studiato']] },
      { id: 'gd', nome: 'Lesioni con e senza impregnazione nello stesso esame', scelte: [['si', 'sì'], ['no', 'no'], ['nv', 'senza mdc']] },
      { id: 'nuova', nome: 'Lesione nuova in T2 o captante rispetto a un esame precedente', scelte: [['si', 'sì'], ['no', 'no'], ['nv', 'nessun precedente']] },
      { id: 'ocb', nome: 'Bande oligoclonali nel liquor', scelte: [['si', 'presenti'], ['no', 'assenti'], ['nv', 'non note']] },
      { id: 'clin', nome: 'Quadro clinico', scelte: [['1-1', '1 attacco, 1 lesione clinica (CIS)'], ['1-2', '1 attacco, ≥ 2 lesioni cliniche'], ['2-1', '≥ 2 attacchi, 1 lesione clinica'], ['2-2', '≥ 2 attacchi, ≥ 2 lesioni cliniche']] },
      { id: 'cvs', nome: 'Segno della vena centrale (SWI/T2*)', scelte: [['si', 'nella maggior parte delle lesioni (≥ 40% o almeno 3-6 lesioni)'], ['no', 'raro o assente'], ['nv', 'non valutabile']] },
      { id: 'vasc', nome: 'Aspetti da sofferenza vascolare', scelte: [['no', 'no'], ['si', 'sì: lesioni puntiformi sottocorticali e profonde, fibre a U e corpo calloso risparmiati, età > 50 anni o fattori di rischio']] },
    ],
    calcola: (v) => {
      if (!v.pv || !v.jc || !v.it || !v.sc) return null;
      const sedi = [['pv', 'periventricolare'], ['jc', 'corticale/iuxtacorticale'], ['it', 'sottotentoriale'], ['sc', 'midollo']].filter(([k]) => v[k] === 'si').map(([, n]) => n);
      const dis = sedi.length >= 2;
      const ditVie = [v.gd === 'si' && 'lesioni con e senza impregnazione', v.nuova === 'si' && 'lesione nuova al controllo', v.ocb === 'si' && 'bande oligoclonali (sostituiscono la DIT)'].filter(Boolean);
      const dit = ditVie.length > 0;
      let diag = '';
      if (v.clin) {
        const serveDis = v.clin === '2-1' || v.clin === '1-1', serveDit = v.clin === '1-2' || v.clin === '1-1';
        const ok = (!serveDis || dis) && (!serveDit || dit);
        diag = ok ? ' → criteri di McDonald 2017 SODDISFATTI (se non c\'è una diagnosi migliore)'
          : (() => { const m = [serveDis && !dis && 'la disseminazione nello spazio', serveDit && !dit && 'la disseminazione nel tempo'].filter(Boolean); return ` → criteri NON ancora soddisfatti: ${m.length > 1 ? 'mancano' : 'manca'} ${m.join(' e ')}; un controllo RM può ${m.length > 1 ? 'mostrarle' : 'mostrarla'}`; })();
      }
      const note = [v.cvs === 'si' && 'il segno della vena centrale nella maggior parte delle lesioni sostiene la demielinizzazione', v.cvs === 'no' && 'il segno della vena centrale raro o assente fa pensare ad altro (vascolare, emicrania)',
        v.vasc === 'si' && 'gli aspetti da sofferenza vascolare suggeriscono la diagnosi differenziale (Fazekas, malattia dei piccoli vasi): lesioni periventricolari a «cappuccio», puntiformi, senza coinvolgimento iuxtacorticale né del corpo calloso'].filter(Boolean);
      return { valore: dis && dit ? 'DIS+DIT' : dis ? 'DIS' : dit ? 'DIT' : 'no', testo: `McDonald 2017: disseminazione nello spazio ${dis ? 'presente' : 'assente'} (${sedi.length}/4 sedi${sedi.length ? ': ' + sedi.join(', ') : ''}); disseminazione nel tempo ${dit ? 'presente (' + ditVie.join('; ') + ')' : 'non dimostrata'}${diag}.${note.length ? ' ' + note.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.' : ''}` };
    },
  },
  recist: {
    nome: 'RECIST 1.1 (risposta dei tumori solidi)', metodiche: ['TC', 'RM'], fonte: 'Eisenhauer et al., Eur J Cancer 2009',
    intro: 'Lesioni bersaglio: al massimo 5 (2 per organo), misurabili: ≥ 10 mm di asse lungo; linfonodi ≥ 15 mm di asse corto (si misura l\'asse corto). Somma dei diametri: assi lunghi delle lesioni + assi corti dei linfonodi. Le misure si prendono con lo strumento RECIST. All\'esame basale basta la somma attuale.',
    campi: [
      { id: 'sa', nome: 'Somma dei diametri, esame attuale', tipo: 'mm' },
      { id: 'sb', nome: 'Somma dei diametri, esame basale (vuoto se questo è il basale)', tipo: 'mm' },
      { id: 'sn', nome: 'Nadir: somma più piccola dei controlli precedenti (vuoto = basale)', tipo: 'mm' },
      { id: 'cr', nome: 'Lesioni bersaglio scomparse?', scelte: [['no', 'no'], ['si', 'sì: scomparse le lesioni non linfonodali e linfonodi bersaglio < 10 mm di asse corto']] },
      { id: 'nt', nome: 'Lesioni non bersaglio', scelte: [['nessuna', 'nessuna al basale'], ['scomparse', 'scomparse (linfonodi < 10 mm)'], ['presenti', 'presenti, non in progressione'], ['pd', 'progressione inequivocabile']] },
      { id: 'nu', nome: 'Nuove lesioni', scelte: [['no', 'no'], ['si', 'sì (inequivocabili)']] },
    ],
    calcola: (v) => {
      if (!(v.sa >= 0) || v.sa === '' || v.sa == null) return null;
      const sa = +v.sa;
      if (!(v.sb > 0)) return { valore: 'basale', testo: `RECIST 1.1, esame basale: somma dei diametri delle lesioni bersaglio ${virgola(sa, 0)} mm.` };
      if (!v.nt || !v.nu) return null;
      const sb = +v.sb, sn = v.sn > 0 ? Math.min(+v.sn, sb) : sb;
      const dB = (sa - sb) / sb * 100, dN = sn > 0 ? (sa - sn) / sn * 100 : 0;
      // risposta delle lesioni bersaglio
      let tgt;
      if (sn > 0 && dN >= 20 && sa - sn >= 5) tgt = 'PD';
      else if (sa === 0 || v.cr === 'si') tgt = 'CR';
      else if (dB <= -30) tgt = 'PR';
      else tgt = 'SD';
      // risposta complessiva (tabella 1 di RECIST 1.1)
      let tot;
      if (v.nu === 'si' || tgt === 'PD' || v.nt === 'pd') tot = 'PD';
      else if (tgt === 'CR') tot = v.nt === 'scomparse' || v.nt === 'nessuna' ? 'CR' : 'PR';
      else if (tgt === 'PR') tot = 'PR';
      else tot = 'SD';
      const nomi = { CR: 'risposta completa (CR)', PR: 'risposta parziale (PR)', SD: 'malattia stabile (SD)', PD: 'progressione di malattia (PD)' };
      const motivo = v.nu === 'si' ? 'nuove lesioni' : v.nt === 'pd' ? 'progressione inequivocabile delle lesioni non bersaglio' : tgt === 'PD' ? `somma +${virgola(dN, 0)}% (+${virgola(sa - sn, 0)} mm) dal nadir` : '';
      return { valore: tot, testo: `RECIST 1.1: somma dei diametri ${virgola(sa, 0)} mm (basale ${virgola(sb, 0)} mm, ${dB >= 0 ? '+' : ''}${virgola(dB, 0)}%${sn !== sb ? `; nadir ${virgola(sn, 0)} mm, ${dN >= 0 ? '+' : ''}${virgola(dN, 0)}%` : ''}). Risposta complessiva: ${nomi[tot]}${motivo ? ` per ${motivo}` : ''}.` };
    },
  },
  fleischner: {
    nome: 'Fleischner 2017 (noduli polmonari incidentali)', metodiche: ['TC'], fonte: 'MacMahon et al., Radiology 2017',
    intro: 'Solo noduli incidentali in adulti ≥ 35 anni: non per screening, pazienti oncologici o immunodepressi. Diametro = media tra asse lungo e corto.',
    campi: [
      { id: 't', nome: 'Tipo', scelte: [['solido', 'solido'], ['vetro', 'vetro smerigliato puro'], ['parz', 'parzialmente solido']] },
      { id: 'num', nome: 'Numero', scelte: [['1', 'singolo'], ['n', 'multipli']] },
      { id: 'd', nome: 'Diametro medio', tipo: 'mm' },
      { id: 'r', nome: 'Rischio del paziente (solo noduli solidi)', scelte: [['basso', 'basso'], ['alto', 'alto (fumo, esposizioni, familiarità, enfisema, fibrosi, lobo superiore, spiculato)']] },
    ],
    calcola: (v) => {
      if (!v.t || !v.num || !(v.d > 0)) return null;
      const d = v.d, mult = v.num === 'n'; let r;
      if (v.t === 'solido') {
        if (!v.r) return null;
        const alto = v.r === 'alto';
        if (d < 6) r = alto ? 'TC facoltativa a 12 mesi' : 'nessun controllo di routine';
        else if (d <= 8) r = mult ? 'TC a 3-6 mesi, poi valutare TC a 18-24 mesi' : alto ? 'TC a 6-12 mesi, poi TC a 18-24 mesi' : 'TC a 6-12 mesi, poi valutare TC a 18-24 mesi';
        else r = mult ? 'TC a 3-6 mesi, poi valutare TC a 18-24 mesi' : 'valutare TC a 3 mesi, PET-TC o campionamento tissutale';
      } else if (mult) r = d < 6 ? 'TC a 3-6 mesi; se stabili, valutare TC a 2 e 4 anni' : 'TC a 3-6 mesi; gestione in base al nodulo più sospetto';
      else if (v.t === 'vetro') r = d < 6 ? 'nessun controllo di routine' : 'TC a 6-12 mesi per confermare la persistenza, poi ogni 2 anni fino a 5 anni';
      else r = d < 6 ? 'nessun controllo di routine' : 'TC a 3-6 mesi; se invariato con componente solida < 6 mm, TC annuale per 5 anni';
      return { valore: '', testo: `Fleischner 2017, nodulo ${{ solido: 'solido', vetro: 'a vetro smerigliato', parz: 'parzialmente solido' }[v.t]}${mult ? ' (multipli)' : ''} di ${Math.round(d)} mm${v.t === 'solido' ? `, rischio ${v.r}` : ''}: ${r}.` };
    },
  },
  deauville: {
    nome: 'Deauville (linfoma, PET-TC FDG)', metodiche: ['Medicina nucleare'], fonte: 'Barrington et al., J Clin Oncol 2014 (Lugano); Meignan et al., Leuk Lymphoma 2009',
    intro: 'Captazione della sede di malattia più captante rispetto al pool ematico del mediastino e al fegato. Misura con la ROI: la lesione (SUVmax), il mediastino (ROI nell\'arco aortico o nell\'aorta discendente, senza la parete) e il fegato (ROI di circa 3 cm nel lobo destro, lontano dalle lesioni); per i due riferimenti usa sempre lo stesso valore (SUVmean). Si usa in interim e a fine trattamento; alla stadiazione serve solo come riferimento.',
    campi: [
      { id: 'cap', nome: 'Captazione nelle sedi di malattia', scelte: [['no', 'nessuna captazione residua'], ['si', 'captazione residua']] },
      { id: 'l', nome: 'Lesione più captante: SUVmax', tipo: 'num', unita: 'SUV', daROI: 'max', se: (v) => v.cap === 'si' },
      { id: 'm', nome: 'Pool ematico mediastinico: SUVmean', tipo: 'num', unita: 'SUV', daROI: 'media', se: (v) => v.cap === 'si' },
      { id: 'f', nome: 'Fegato: SUVmean', tipo: 'num', unita: 'SUV', daROI: 'media', se: (v) => v.cap === 'si' },
      { id: 'n', nome: 'Nuove lesioni di sicura natura linfomatosa', scelte: [['no', 'no'], ['si', 'sì']] },
      { id: 'fase', nome: 'Momento dell\'esame', scelte: [['base', 'stadiazione (basale)'], ['interim', 'interim (durante la terapia)'], ['fine', 'fine trattamento']] },
    ],
    calcola: (v) => {
      if (!v.cap || !v.n || !v.fase) return null;
      let p, perche;
      if (v.n === 'si') { p = 5; perche = 'nuove lesioni'; }
      else if (v.cap === 'no') { p = 1; perche = 'nessuna captazione sopra il fondo'; }
      else {
        if (!(v.l > 0) || !(v.m > 0) || !(v.f > 0)) return null;
        const l = +v.l, m = +v.m, f = +v.f;
        if (l <= m) { p = 2; perche = `SUVmax ${virgola(l, 1)} ≤ mediastino ${virgola(m, 1)}`; }
        else if (l <= f) { p = 3; perche = `SUVmax ${virgola(l, 1)} > mediastino ${virgola(m, 1)} e ≤ fegato ${virgola(f, 1)}`; }
        else if (l < 2 * f) { p = 4; perche = `SUVmax ${virgola(l, 1)} moderatamente > fegato ${virgola(f, 1)} (${virgola(l / f, 1)} volte)`; }
        else { p = 5; perche = `SUVmax ${virgola(l, 1)} marcatamente > fegato ${virgola(f, 1)} (${virgola(l / f, 1)} volte; soglia pratica ≥ 2 volte)`; }
        if (m >= f) perche += ' · attenzione: il mediastino non dovrebbe superare il fegato, ricontrolla le ROI';
      }
      const giud = v.fase === 'base' ? 'alla stadiazione il Deauville non classifica la risposta: il valore serve come confronto per gli esami successivi'
        : p <= 3 ? `risposta metabolica completa${p === 3 && v.fase === 'interim' ? ' (il punteggio 3 in interim è di solito risposta completa; in alcuni protocolli di de-escalation è considerato inadeguato)' : ''}`
        : p === 4 || (p === 5 && v.n !== 'si') ? `${v.fase === 'fine' ? 'malattia metabolica residua (risposta parziale se la captazione è ridotta rispetto alla basale; nessuna risposta se invariata; progressione se aumentata)' : 'risposta metabolica parziale se ridotta rispetto alla basale, altrimenti nessuna risposta o progressione'}`
        : 'progressione metabolica (nuove lesioni)';
      return { valore: String(p), testo: `Deauville ${p} (${perche}): ${giud}.` };
    },
  },
};

export { virgola, NOMI_SETT, LIVELLI_PROSTATA, settoriProstata, svgProstata, descriviSettore, sigla, svgMammella, sedeMammella, SEGM_FEGATO, descriviSegmento, siglaSegmento, svgFegato, SEGM_VS, CINETICA, COLORI_CIN, TERRITORIO_VS, svgBullseye, descriviBullseye, SEDE_FEGATO, SCALE };
