// Controllo del codice di radio-quiz con ESLint (open source, licenza MIT). Solo sul Mac: non si pubblica.
// Regole scelte per trovare ERRORI veri (nomi non definiti, variabili mai usate, confronti sbagliati,
// codice irraggiungibile, assegnazioni inutili), non per imporre uno stile.
// Si lancia con lint.sh.
import js from '@eslint/js';
import globals from 'globals';
const regole = {
  ...js.configs.recommended.rules,
  // codice rimasto inutilizzato: avviso, non blocca (va tolto con calma, file per file)
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'eqeqeq': ['error', 'smart'],
  'no-self-compare': 'error',
  'no-unreachable-loop': 'error',
  'no-constant-binary-expression': 'error',
  'no-template-curly-in-string': 'warn',
  'no-unmodified-loop-condition': 'error',
  'no-useless-assignment': 'warn',
  // espressioni regolari che puliscono di proposito i caratteri di controllo; \- in fondo alla classe è innocuo
  'no-control-regex': 'off',
  'no-useless-escape': 'off',
  'no-dupe-else-if': 'error',
};
const config = [
  { ignores: ['web/lib/**', 'web/casi/**', '**/*.min.js', '**/node_modules/**', '.web-pub/**', 'cdk.out/**', 'mpr3d/**', 'web/backup_vista/**', '**/*.bak*'] },
  { files: ['web/**/*.js'], languageOptions: { ecmaVersion: 2024, sourceType: 'module',
      globals: { ...globals.browser, dicomParser: 'readonly' } }, rules: regole },
  { files: ['web/client/sw.js'], languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } } },
  { files: ['web/*-worker.js'], languageOptions: { globals: { ...globals.worker } } },
  { files: ['api/**/*.mjs', 'test/**/*.mjs', '*.mjs'], languageOptions: { ecmaVersion: 2024, sourceType: 'module',
      globals: { ...globals.node } }, rules: regole },
  // nei test dicomParser è messo in globalThis come nel browser
  { files: ['test/**/*.mjs'], languageOptions: { globals: { dicomParser: 'readonly' } } },
  // codice eseguito DENTRO la pagina con page.evaluate (Playwright)
  { files: ['test/browser.test.mjs', 'test/**/prova*.mjs'], languageOptions: { globals: { ...globals.browser } } },
];
export default config;   // si lancia da ../cloud con -c (lint.sh): i percorsi sono relativi a quella cartella
