/* ============================================================
   Analisi didattica: calcoli puri sui risultati (nessun DOM).
   Usata dal cruscotto dei docenti; provabile anche in Node.

   Definizioni
   - Si analizza di regola il PRIMO tentativo di ogni persona su
     ogni caso: i tentativi successivi risentono della discussione.
   - Un'opzione è "giusta" per una persona se l'ha scelta ed è un
     reperto (principale/secondario), o se NON l'ha scelta ed è un
     distrattore.
   - Discriminazione (D): % di giusti nella metà migliore del
     gruppo − % nella metà peggiore (ordinati per punteggio medio
     su tutti i casi). D ≥ 0,3 buona, 0,1–0,3 discreta, < 0,1 scarsa,
     negativa = l'opzione inganna i più bravi (spesso è ambigua).
     Calcolata solo con almeno 4 persone.
   - Reperti secondari mancati: tra chi ha trovato il reperto
     principale, quanti non hanno indicato ciascun secondario
     ("satisfaction of search").
   - Calibrazione: % di scelte corrette per livello di sicurezza
     dichiarato (sicuro / probabile / ipotesi).
   ============================================================ */

export const giusta = (o) => (o.tipo === 'distrattore' ? !o.s : !!o.s);
const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const mediana = (a) => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y), m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const pct = (n, d) => (d ? n / d : null);

/** Ricostruisce l'istantanea delle opzioni per i risultati salvati prima che esistesse. */
function opzioniDi(r, caso) {
  if (Array.isArray(r.opzioni) && r.opzioni.length) return r.opzioni;
  if (!caso) return [];
  const scelte = String(r.scelte || '').split(' | ');
  return caso.opzioni.map((o) => ({ t: o.testo, tipo: o.tipo, s: scelte.includes(o.testo) }));
}
/** Distretto di un'opzione: quello del referto guidato, altrimenti il distretto del caso. */
function areaDi(o, caso) {
  const z = Number.isInteger(o.z) ? o.z : caso?.opzioni?.find((x) => x.testo === o.t)?.sezione;
  return (Number.isInteger(z) && caso?.sezioni?.[z]) || caso?.distretto || 'Non classificato';
}

/** Tiene solo il primo tentativo per persona e caso (o tutti, se primoSolo = false). */
export function selezionaTentativi(risultati, primoSolo = true) {
  const ordinati = [...risultati].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (!primoSolo) return ordinati;
  const visti = new Set(), out = [];
  for (const r of ordinati) {
    const chi = r.account || r.nome || '?';
    const k = `${chi}#${r.caso}`;
    if (r.tentativo != null ? r.tentativo !== 1 : visti.has(k)) { visti.add(k); continue; }
    if (visti.has(k)) continue;
    visti.add(k); out.push(r);
  }
  return out;
}

export function calcola({ casi, risultati }, { primoSolo = true, soloSpecializzandi = true } = {}) {
  const perCaso = new Map(casi.map((c) => [c.id, c]));
  let righe = selezionaTentativi(risultati, primoSolo)
    .filter((r) => !soloSpecializzandi || !r.ruolo || r.ruolo === 'specializzando')
    .map((r) => ({ ...r, chi: r.account || r.nome || '?', opz: opzioniDi(r, perCaso.get(r.caso)) }));

  // punteggio medio di ogni persona (per la discriminazione)
  const perPersona = new Map();
  for (const r of righe) {
    if (!perPersona.has(r.chi)) perPersona.set(r.chi, { chi: r.chi, nome: r.nome || r.chi, righe: [] });
    perPersona.get(r.chi).righe.push(r);
  }
  const mediaPersona = new Map([...perPersona.values()].map((p) => [p.chi, media(p.righe.map((r) => r.punteggio))]));

  // ---------------- casi
  const analisiCasi = casi.map((c) => {
    const rr = righe.filter((r) => r.caso === c.id);
    const n = rr.length;
    // gruppi per la discriminazione: metà migliore e peggiore tra chi ha risposto a questo caso
    const ordinate = [...rr].sort((a, b) => mediaPersona.get(b.chi) - mediaPersona.get(a.chi));
    const meta = Math.floor(ordinate.length / 2);
    const alti = new Set(ordinate.slice(0, meta).map((r) => r.chi));
    const bassi = new Set(ordinate.slice(ordinate.length - meta).map((r) => r.chi));

    const opzioni = c.opzioni.map((o) => {
      const voci = rr.map((r) => ({ r, x: r.opz.find((y) => y.t === o.testo) })).filter((v) => v.x);
      const scelte = voci.filter((v) => v.x.s);
      const conf = { sicuro: 0, probabile: 0, ipotesi: 0 };
      for (const v of scelte) if (conf[v.x.conf] !== undefined) conf[v.x.conf]++;
      const ok = (v) => giusta({ ...v.x, tipo: o.tipo });
      const pa = pct(voci.filter((v) => alti.has(v.r.chi) && ok(v)).length, voci.filter((v) => alti.has(v.r.chi)).length);
      const pb = pct(voci.filter((v) => bassi.has(v.r.chi) && ok(v)).length, voci.filter((v) => bassi.has(v.r.chi)).length);
      return {
        testo: o.testo, tipo: o.tipo, n: voci.length,
        scelta: pct(scelte.length, voci.length),             // quanti l'hanno scelta
        corretti: pct(voci.filter(ok).length, voci.length),   // quanti l'hanno trattata bene (difficoltà)
        discriminazione: voci.length >= 4 && meta >= 2 && pa != null && pb != null ? pa - pb : null,
        conf, convinti: o.tipo === 'distrattore' ? conf.sicuro : 0,  // errori dichiarati "sicuro"
      };
    });

    // reperti secondari mancati da chi ha trovato il principale
    const principali = c.opzioni.filter((o) => o.tipo === 'principale').map((o) => o.testo);
    const trovato = rr.filter((r) => principali.length && principali.every((t) => r.opz.find((y) => y.t === t)?.s));
    const secondari = c.opzioni.filter((o) => o.tipo === 'secondario').map((o) => ({
      testo: o.testo,
      mancato: pct(trovato.filter((r) => !r.opz.find((y) => y.t === o.testo)?.s).length, trovato.length),
    }));
    const almenoUno = pct(trovato.filter((r) => c.opzioni.some((o) => o.tipo === 'secondario' && !r.opz.find((y) => y.t === o.testo)?.s)).length, trovato.length);

    // serie viste: frazione media di immagini scorse per serie
    const serie = new Map();
    for (const r of rr) for (const s of r.dettagli?.serie || []) {
      if (!serie.has(s.descrizione)) serie.set(s.descrizione, []);
      serie.get(s.descrizione).push(s.totale ? s.viste / s.totale : 0);
    }
    const conDettagli = rr.filter((r) => r.dettagli);
    // referto guidato: punteggio per distretto (stessa formula del punteggio del caso)
    const sezioni = (c.sezioni || []).map((nome, k) => {
      const testi = c.opzioni.filter((o) => o.sezione === k), punti = [];
      for (const r of rr) {
        let tp = 0, fp = 0, g = 0;
        for (const o of testi) { const x = r.opz.find((y) => y.t === o.testo); if (!x) continue; const rep = o.tipo !== 'distrattore'; if (rep) g++; if (x.s && rep) tp++; if (x.s && !rep) fp++; }
        if (testi.length) punti.push(g ? Math.max(0, (tp - fp) / g) * 100 : fp ? 0 : 100);
      }
      return { nome, punteggio: media(punti), n: punti.length };
    });
    // immagini chiave scelte da ciascuno (con le note delle frecce)
    const chiavi = rr.filter((r) => r.dettagli?.chiavi?.length).map((r) => ({ nome: r.nome || r.chi, punteggio: r.punteggio, chiavi: r.dettagli.chiavi }));
    return {
      sezioni, chiavi,
      id: c.id, titolo: c.titolo, distretto: c.distretto, modalita: c.modalita, visibile: c.visibile, n,
      punteggio: media(rr.map((r) => r.punteggio)), perfette: pct(rr.filter((r) => r.perfetta).length, n),
      tempo: mediana(conDettagli.map((r) => r.dettagli.tempoAttivo || r.dettagli.tempo).filter((x) => x > 0)),
      usoMpr: pct(conDettagli.filter((r) => r.dettagli.mpr).length, conDettagli.length),
      usoMisure: pct(conDettagli.filter((r) => r.dettagli.misure > 0).length, conDettagli.length),
      usoRoi: pct(conDettagli.filter((r) => r.dettagli.roi > 0).length, conDettagli.length),
      usoConfronto: pct(conDettagli.filter((r) => r.dettagli.confronto).length, conDettagli.length),
      opzioni, principaleTrovato: pct(trovato.length, n), secondari, secondariMancatiAlmenoUno: almenoUno,
      serie: [...serie].map(([descrizione, v]) => ({ descrizione, aperta: pct(v.length, conDettagli.length), scorsa: media(v) }))
        .sort((a, b) => b.aperta - a.aperta),
    };
  });

  // ---------------- specializzandi
  const persone = [...perPersona.values()].map((p) => {
    const rr = p.righe;
    const scelteConConf = rr.flatMap((r) => r.opz.filter((o) => o.s && o.conf));
    const calibrazione = Object.fromEntries(['sicuro', 'probabile', 'ipotesi'].map((l) => {
      const x = scelteConConf.filter((o) => o.conf === l);
      return [l, { n: x.length, corrette: pct(x.filter((o) => o.tipo !== 'distrattore').length, x.length) }];
    }));
    const aree = new Map();
    for (const r of rr) {
      const c = perCaso.get(r.caso) || {};
      const k = [c.distretto, c.modalita].filter(Boolean).join(' · ') || 'Non classificato';
      if (!aree.has(k)) aree.set(k, []);
      aree.get(k).push(r.punteggio);
    }
    const sec = rr.flatMap((r) => r.opz.filter((o) => o.tipo === 'secondario'));
    const conDettagli = rr.filter((r) => r.dettagli);
    return {
      chi: p.chi, nome: p.nome, n: rr.length,
      punteggio: media(rr.map((r) => r.punteggio)), perfette: pct(rr.filter((r) => r.perfetta).length, rr.length),
      curva: rr.map((r) => ({ data: r.data, caso: r.caso, punteggio: r.punteggio })),
      ultimo: rr.at(-1)?.data || '',
      calibrazione, secondariTrovati: pct(sec.filter((o) => o.s).length, sec.length),
      distrattoriConvinti: rr.reduce((n, r) => n + r.opz.filter((o) => o.tipo === 'distrattore' && o.s && o.conf === 'sicuro').length, 0),
      tempo: mediana(conDettagli.map((r) => r.dettagli.tempoAttivo || r.dettagli.tempo).filter((x) => x > 0)),
      usoMpr: pct(conDettagli.filter((r) => r.dettagli.mpr).length, conDettagli.length),
      aree: [...aree].map(([area, v]) => ({ area, n: v.length, punteggio: media(v) })).sort((a, b) => a.punteggio - b.punteggio),
    };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));

  // ---------------- mappa degli errori: per distretto e distrattori più scelti
  const aree = new Map(), distrattori = new Map(), mancati = new Map();
  for (const r of righe) {
    const c = perCaso.get(r.caso); if (!c) continue;
    for (const o of r.opz) {
      const area = areaDi(o, c);
      const a = aree.get(area) || { area, reperti: 0, mancati: 0, distrattori: 0, scelti: 0, convinti: 0, persone: new Set() };
      a.persone.add(r.chi);
      if (o.tipo === 'distrattore') {
        a.distrattori++; if (o.s) { a.scelti++; if (o.conf === 'sicuro') a.convinti++; }
        const k = `${r.caso}|${o.t}`, d = distrattori.get(k) || { caso: r.caso, titolo: c.titolo, area, testo: o.t, n: 0, scelti: 0 };
        d.n++; if (o.s) d.scelti++; distrattori.set(k, d);
      } else {
        a.reperti++; if (!o.s) a.mancati++;
        const k = `${r.caso}|${o.t}`, m = mancati.get(k) || { caso: r.caso, titolo: c.titolo, area, testo: o.t, tipo: o.tipo, n: 0, mancati: 0 };
        m.n++; if (!o.s) m.mancati++; mancati.set(k, m);
      }
      aree.set(area, a);
    }
  }
  const errori = {
    aree: [...aree.values()].map((a) => ({ area: a.area, persone: a.persone.size, reperti: a.reperti, mancati: pct(a.mancati, a.reperti), distrattori: a.distrattori,
      scelti: pct(a.scelti, a.distrattori), convinti: a.convinti }))
      .sort((x, y) => ((y.mancati ?? 0) + (y.scelti ?? 0)) - ((x.mancati ?? 0) + (x.scelti ?? 0))),
    distrattori: [...distrattori.values()].filter((d) => d.scelti).map((d) => ({ ...d, frazione: d.scelti / d.n }))
      .sort((x, y) => y.frazione - x.frazione || y.scelti - x.scelti).slice(0, 25),
    // reperti corretti non indicati più spesso (principali prima a parità)
    mancati: [...mancati.values()].filter((m) => m.mancati).map((m) => ({ ...m, frazione: m.mancati / m.n }))
      .sort((x, y) => y.frazione - x.frazione || (x.tipo === 'principale' ? -1 : 0) - (y.tipo === 'principale' ? -1 : 0) || y.mancati - x.mancati).slice(0, 40),
  };
  return { casi: analisiCasi, persone, errori, totale: righe.length };
}
