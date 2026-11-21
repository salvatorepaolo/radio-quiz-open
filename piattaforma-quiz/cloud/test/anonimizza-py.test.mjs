// anonimizza.py (anonimizzazione dei casi sul Mac, Python con pydicom): lancia anonimizza_py_prova.py e controlla
// che gli UID siano gli stessi di web/anonimizza.js (stesso caso, serie fatte in parte sul Mac e in parte nel browser).
// Poi i controlli di privacy del Mac (privacy_mac_prova.py). Senza il Python con pydicom (~/.radioquiz-ia/venv) si salta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dicomFinto } from './aiuti/dicom-finto.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url)), PY = process.env.PYTHON_RQ || path.join(os.homedir(), '.radioquiz-ia/venv/bin/python');   // PYTHON_RQ: su GitHub
const presente = fs.existsSync(PY);
test('anonimizza.py: unittest (dati inventati tolti, pixel e UID, esclusioni)', { skip: !presente && 'manca il Python con pydicom' }, () => {
  const r = spawnSync(PY, [path.join(QUI, 'anonimizza_py_prova.py')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr.slice(-3000));
});
test('UID: anonimizza.py e web/anonimizza.js danno lo stesso UID per lo stesso originale e la stessa chiave', { skip: !presente && 'manca il Python con pydicom' }, async () => {
  const r = spawnSync(PY, [path.join(QUI, 'anonimizza_py_prova.py'), 'Anonimizza.test_uid_stessi_del_browser'], { encoding: 'utf8' });
  const py = (r.stdout + r.stderr).match(/UID_PY (\S+)/)?.[1]; assert.ok(py, r.stderr);
  const WEB = path.join(QUI, '../web');
  { const m = { exports: {} }; new Function('module', 'exports', 'require', fs.readFileSync(path.join(WEB, 'lib/dicomParser.min.js'), 'utf8'))(m, m.exports, createRequire(import.meta.url)); globalThis.dicomParser = m.exports; }
  const A = await import(pathToFileURL(path.join(WEB, 'anonimizza.js')).href);
  const out = await A.anonimizza(dicomFinto().buffer, { idCaso: 'caso-prova-001', sale: 'sale-di-prova' });
  assert.equal(dicomParser.parseDicom(out).string('x0020000e'), py);   // serie 1.2.3.4.5.6.7.3 nell'originale
});
test('controlli di privacy sul Mac: intestazioni (anonimato_intestazioni.py) e testo impresso (anonimato_ocr.py)', { skip: !presente && 'manca il Python con pydicom' }, () => {
  const r = spawnSync(PY, [path.join(QUI, 'privacy_mac_prova.py')], { encoding: 'utf8', timeout: 600000 });
  assert.equal(r.status, 0, r.stderr.slice(-3000));
});
