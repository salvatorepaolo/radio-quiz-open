// Test dei test (mutation testing) con StrykerJS (Apache-2.0). Stryker introduce piccoli errori nel codice, uno alla volta
// («mutanti»: > che diventa >=, + che diventa -, una condizione rovesciata, un ritorno svuotato) e per ognuno riesegue i test:
// un mutante che nessun test nota indica un controllo che manca. Lavora su una copia (cloud/.stryker-tmp), mai sui file veri.
// Lento: si lancia ogni tanto, sul Mac. Uso: bash piattaforma-quiz/qualita/mutazioni.sh
// Parti scelte: anonimizzazione (privacy) e correzione delle risposte (punteggi), le più delicate.
export default {
  mutate: [
    'web/anonimizza.js',
    'api/logica.mjs:102-140',      // valuta, tipoOpzione: punteggio delle risposte a scelta
    'api/logica.mjs:346-640',      // comunicazione dell'esito, referto libero, punto sulla figura, controlli del caso, difficoltà
  ],
  testRunner: 'command',
  commandRunner: { command: 'node --test test/anonimizza.test.mjs test/anonimizza-fuzz.test.mjs test/logica.test.mjs test/logica-avvisi.test.mjs' },
  // nella copia solo ciò che serve a quei test
  ignorePatterns: ['**', '!api/**', '!web/anonimizza.js', '!web/lib/dicomParser.min.js', '!test/anonimizza.test.mjs', '!test/anonimizza-fuzz.test.mjs',
    '!test/logica.test.mjs', '!test/logica-avvisi.test.mjs', '!test/aiuti/**', '!test/fixture/**', '!package.json'],
  concurrency: 6,
  timeoutMS: 20000,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: '../qualita/mutazioni/index.html' },
  jsonReporter: { fileName: '../qualita/mutazioni/mutazioni.json' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
