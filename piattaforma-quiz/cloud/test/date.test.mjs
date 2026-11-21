// Date e fusi orari (api/logica.mjs). Le date salvate sono in UTC («AAAA-MM-GG HH:MM»), le scadenze dei compiti sono giorni
// del calendario italiano: la scadenza del 20 finisce alle 23:59 di Roma, con l'ora legale giusta. Si prova a cavallo del
// cambio d'ora (25/10/2026 e 28/03/2027), a fine mese, a fine anno e nel 29 febbraio; e che il risultato non dipenda dal fuso
// orario del server (lo stesso calcolo con TZ=UTC, New York, Tokyo, Kiritimati, Roma).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const LOGICA = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/logica.mjs')).href;
const L = await import(LOGICA);
const U = (s) => Date.parse(s.replace(' ', 'T') + ':00Z');

test('fine della giornata italiana: 23:59 di Roma in UTC, con l\'ora legale', () => {
  for (const [g, atteso] of [
    ['2026-11-20', '2026-11-20 22:59'],   // ora solare (UTC+1)
    ['2026-07-15', '2026-07-15 21:59'],   // ora legale (UTC+2)
    ['2026-10-24', '2026-10-24 21:59'],   // sabato prima del cambio: ancora ora legale
    ['2026-10-25', '2026-10-25 22:59'],   // domenica del cambio: ora solare
    ['2027-03-27', '2027-03-27 22:59'],
    ['2027-03-28', '2027-03-28 21:59'],   // domenica del passaggio all'ora legale
    ['2028-02-29', '2028-02-29 22:59'],
    ['2026-12-31', '2026-12-31 22:59'],
  ]) assert.equal(L.fineGiornoItalia(g), atteso, g);
});

test('giorno di calendario in Italia a cavallo della mezzanotte, di fine mese e di fine anno', () => {
  assert.equal(L.giornoItalia(U('2026-12-31 23:30')), '2027-01-01');   // a Roma è già l'1 gennaio, alle 00:30
  assert.equal(L.giornoItalia(U('2026-12-31 22:59')), '2026-12-31');
  assert.equal(L.giornoItalia(U('2026-07-31 22:10')), '2026-08-01');   // ora legale: mezzanotte di Roma = 22:00 UTC
  assert.equal(L.giornoItalia(U('2026-07-31 21:50')), '2026-07-31');
  assert.equal(L.giornoItalia(U('2028-02-28 23:30')), '2028-02-29');
  assert.equal(L.giornoItalia(U('2026-10-24 22:30')), '2026-10-25');
});

test('compiti: «entro la scadenza» vuol dire entro le 23:59 italiane del giorno indicato', () => {
  const k = { scadenza: '2026-11-20', casi: ['a', 'b'] };
  const st = L.statoCompito(k, [{ caso: 'a', data: '2026-11-20 22:30', punteggio: 80 }, { caso: 'b', data: '2026-11-20 23:30', punteggio: 60 }]);
  assert.equal(st.fatti, 2); assert.equal(st.inTempo, 1, 'alle 23:30 di Roma è in tempo, alle 00:30 del 21 no');
  const estate = L.statoCompito({ scadenza: '2026-07-15', casi: ['a', 'b'] }, [{ caso: 'a', data: '2026-07-15 21:58', punteggio: 80 }, { caso: 'b', data: '2026-07-15 22:10', punteggio: 60 }]);
  assert.equal(estate.inTempo, 1, 'in estate la mezzanotte di Roma è alle 22:00 UTC');
  assert.equal(L.statoCompito({ casi: ['a'] }, [{ caso: 'a', data: '2030-01-01 00:00', punteggio: 1 }]).inTempo, 1, 'senza scadenza è sempre in tempo');
});

test('ripasso: gli intervalli di 1, 7 e 30 giorni non si spostano col cambio dell\'ora, a fine mese e a fine anno', () => {
  const r = (righe, adesso) => L.ripasso(righe.map(([caso, data, perfetta]) => ({ caso, data, perfetta, punteggio: perfetta ? 100 : 40 })), new Date(adesso));
  assert.deepEqual(r([['c', '2026-10-24 12:00', false]], '2026-10-25T11:59:00Z').map((x) => [x.scadenza, x.dovuto]), [['2026-10-25', false]]);
  assert.deepEqual(r([['c', '2026-10-24 12:00', false]], '2026-10-25T12:00:00Z').map((x) => x.dovuto), [true]);
  assert.equal(r([['c', '2026-12-20 10:00', false], ['c', '2026-12-25 10:00', true]], '2027-01-01T10:00:00Z')[0].scadenza, '2027-01-01');   // 7 giorni
  assert.equal(r([['c', '2027-01-31 10:00', false], ['c', '2027-02-01 10:00', true], ['c', '2027-02-08 10:00', true]], '2027-03-01T00:00:00Z')[0].scadenza, '2027-03-10');   // 30 giorni dopo l'8 febbraio
});

function prepara(classi, account) {
  const email = [];
  return { email, cfg: { indirizzo: 'https://esempio.test/', inviaEmail: async (a, oggetto) => { email.push({ a, oggetto }); },
    magazzino: { elencoAccount: async () => account, scriviAccount: async () => {}, eliminaAccount: async () => {}, elencoClassi: async () => classi, risultati: async () => [], elencoCasi: async () => [] } } };
}
const studente = { id: 's1', nome: 'Studente', email: 's1@esempio.test', pw: 'x', ruolo: 'specializzando', ultimoAccesso: '2026-10-01 10:00' };

test('promemoria «due giorni prima»: contati sul calendario italiano, anche poco dopo la mezzanotte e a fine anno', async () => {
  const compiti = (...g) => [{ id: 'k', nome: 'Classe', membri: ['s1'], compiti: g.map((scadenza, i) => ({ id: 'c' + i, titolo: 'Compito ' + scadenza, casi: ['x'], scadenza })) }];
  // 00:30 di Roma del 24 ottobre (22:30 UTC del 23): due giorni dopo è il 26, non il 25
  let { cfg, email } = prepara(compiti('2026-10-25', '2026-10-26'), [studente]);
  await L.promemoria(cfg, new Date('2026-10-23T22:30:00Z'));
  assert.deepEqual(email.map((e) => e.oggetto.match(/scade il (\S+)/)[1]), ['26/10/2026']);
  // 00:30 di Roma del 30 dicembre: il promemoria è per l'1 gennaio
  ({ cfg, email } = prepara(compiti('2026-12-31', '2027-01-01'), [studente]));
  await L.promemoria(cfg, new Date('2026-12-29T23:30:00Z'));
  assert.deepEqual(email.map((e) => e.oggetto.match(/scade il (\S+)/)[1]), ['01/01/2027']);
  // 27 febbraio 2028 a mezzogiorno: due giorni dopo è il 29 (anno bisestile)
  ({ cfg, email } = prepara(compiti('2028-02-29', '2028-03-01'), [studente]));
  await L.promemoria(cfg, new Date('2028-02-27T12:00:00Z'));
  assert.deepEqual(email.map((e) => e.oggetto.match(/scade il (\S+)/)[1]), ['29/02/2028']);
});

test('stessi risultati con il server in qualsiasi fuso orario', () => {
  const codice = `const L = await import(${JSON.stringify(LOGICA)});
    const out = { fine: ['2026-10-25', '2027-03-28', '2026-12-31'].map(L.fineGiornoItalia),
      giorni: [Date.UTC(2026, 11, 31, 23, 30), Date.UTC(2026, 6, 31, 22, 10)].map(L.giornoItalia),
      ripasso: L.ripasso([{ caso: 'c', data: '2026-10-24 23:30', perfetta: false, punteggio: 1 }], new Date(Date.UTC(2026, 9, 25, 23, 0))),
      compito: L.statoCompito({ scadenza: '2026-11-20', casi: ['a'] }, [{ caso: 'a', data: '2026-11-20 23:30', punteggio: 5 }]) };
    console.log(JSON.stringify(out));`;
  const esiti = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Europe/Rome'].map((tz) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', codice], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return [tz, JSON.parse(r.stdout)];
  });
  for (const [tz, v] of esiti.slice(1)) assert.deepEqual(v, esiti[0][1], tz);
});
