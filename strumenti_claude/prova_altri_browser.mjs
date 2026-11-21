// prova_altri_browser.mjs: i test nel browser (cloud/test/browser.test.mjs) anche con il motore di Safari (WebKit)
// e con Firefox, oltre a Chrome. Molti specializzandi usano iPad e iPhone: lì Safari è l'unico motore possibile.
// Uso: node prova_altri_browser.mjs [webkit|firefox]   (riepilogo nel formato di tutti_i_test.sh)
import { spawnSync } from 'node:child_process';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test';
const motori = process.argv[2] ? [process.argv[2]] : ['webkit', 'firefox'];
let pass = 0, fail = 0;
for (const [i, m] of motori.entries()) {
  const r = spawnSync(process.execPath, ['--test', 'browser.test.mjs'], { cwd: T, encoding: 'utf8', env: { ...process.env, BROWSER: m, PORTA_PROVA: String((+process.env.PORTA_PROVA || 19750) + i) }, timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const p = +(out.match(/^ℹ pass (\d+)/m)?.[1] || 0), f = +(out.match(/^ℹ fail (\d+)/m)?.[1] || (r.status ? 1 : 0));
  pass += p; fail += f;
  console.log(`== ${m}: ${p} superati, ${f} falliti`);
  for (const riga of out.split('\n').filter((x) => /^✖ /.test(x)).slice(0, 10)) console.log('   ' + riga);
}
console.log(`ℹ pass ${pass}\nℹ fail ${fail}`);
process.exit(fail ? 1 : 0);
