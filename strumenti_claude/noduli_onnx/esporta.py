#!/usr/bin/env python3
"""esporta.py: MONAI lung_nodule_ct_detection (RetinaNet 3D, Apache 2.0) → ONNX per il visualizzatore scaricabile.
Ingresso: finestra [1,1,X,Y,Z] RAS, 0,703×0,703×1,25 mm, HU −1024..300 → 0..1. Uscite: per ogni livello (3) classificazione
e regressione dei box. Ancore, decodifica e NMS sono rifatte in JavaScript (cloud/web/noduli-client.js)."""
import os, sys, json, torch
from monai.bundle import ConfigParser
R = os.path.expanduser('~/.radioquiz-ia/monai/lung_nodule_ct_detection')
cp = ConfigParser(); cp.read_config(os.path.join(R, 'configs', 'inference.json')); cp['bundle_root'] = R; cp['device'] = "$torch.device('cpu')"
rete = cp.get_parsed_content('network_def'); st = torch.load(os.path.join(R, 'models', 'model.pt'), map_location='cpu')
if isinstance(st, dict) and 'model' in st: st = st['model']
rete.load_state_dict(st); rete.eval()
class Piatta(torch.nn.Module):
    def __init__(s, r): super().__init__(); s.r = r
    def forward(s, x):
        o = s.r(x)
        cls = o[s.r.cls_key] if isinstance(o, dict) else o[0]; box = o[s.r.box_reg_key] if isinstance(o, dict) else o[1]
        return tuple(cls) + tuple(box)
m = Piatta(rete).eval()
X, Y, Z = [int(v) for v in (sys.argv[1:4] if len(sys.argv) > 3 else (192, 192, 80))]
x = torch.zeros(1, 1, X, Y, Z)
with torch.no_grad():
    out = m(x)
print('uscite', [tuple(t.shape) for t in out])
nomi = [f'cls{i}' for i in range(len(out) // 2)] + [f'box{i}' for i in range(len(out) // 2)]
dyn = {'x': {2: 'X', 3: 'Y', 4: 'Z'}} | {n: {2: f'{n}_X', 3: f'{n}_Y', 4: f'{n}_Z'} for n in nomi}
torch.onnx.export(m, x, 'noduli.onnx', input_names=['x'], output_names=nomi, dynamic_axes=dyn, opset_version=17, do_constant_folding=True, dynamo=False)
print('scritto noduli.onnx', os.path.getsize('noduli.onnx') // 1024, 'kB')
json.dump({'anchor': cp['anchor_generator'], 'size_divisible': cp['size_divisible'], 'uscite': [list(t.shape) for t in out], 'nomi': nomi}, open('noduli.json', 'w'), indent=1)
