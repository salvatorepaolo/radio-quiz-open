// Strumenti di preparazione dei casi sul Mac (strumenti/controlla.py e strumenti/anteprime.py), provati su casi INVENTATI
// in una cartella temporanea (strumenti_prova.py). Senza il Python con pydicom e numpy si salta (PYTHON_RQ su GitHub).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url)), PY = process.env.PYTHON_RQ || path.join(os.homedir(), '.radioquiz-ia/venv/bin/python');
const presente = fs.existsSync(PY) && spawnSync(PY, ['-c', 'import pydicom, numpy'], { encoding: 'utf8' }).status === 0;
test('controlla.py e anteprime.py: dati del paziente bloccati senza ripeterli, avvisi, anteprime in HU senza dati', { skip: !presente && 'manca il Python con pydicom' }, () => {
  const r = spawnSync(PY, ['-m', 'unittest', '-v', 'strumenti_prova'], { cwd: QUI, encoding: 'utf8', timeout: 600000 });
  assert.equal(r.status, 0, (r.stderr || '').slice(-3000));
  assert.match(r.stderr, /Ran 7 tests/);
});
