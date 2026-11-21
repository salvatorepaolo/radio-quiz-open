#!/usr/bin/env python3
"""quantizza.py: versione compressa del modello dei noduli (int8, QDQ statico per canale) per il visualizzatore scaricabile.
Calibrazione su finestre di TC del torace NON usate nella valutazione. Uso: quantizza.py crop1.raw crop2.raw ..."""
import sys, json, os, numpy as np
from onnxruntime.quantization import quantize_static, QuantFormat, QuantType, CalibrationDataReader, CalibrationMethod
from onnxruntime.quantization.shape_inference import quant_pre_process
QUI = os.path.dirname(os.path.abspath(__file__))
W = (192, 192, 80)
def finestre(raw):
    m = json.load(open(raw + '.json')); d = m['d']
    hu = np.fromfile(raw, '<i2').reshape(d).astype(np.float32)
    x = np.clip((hu + 1024) / 1324, 0, 1)
    rng = np.random.default_rng(0); out = []
    for _ in range(4):
        s = [rng.integers(0, max(1, d[a] - W[a] + 1)) for a in range(3)]
        f = np.zeros(W, np.float32); p = x[s[0]:s[0]+W[0], s[1]:s[1]+W[1], s[2]:s[2]+W[2]]
        f[:p.shape[0], :p.shape[1], :p.shape[2]] = p; out.append(f[None, None])
    return out
class Lettore(CalibrationDataReader):
    def __init__(s, files): s.dati = iter([{'x': f} for r in files for f in finestre(r)])
    def get_next(s): return next(s.dati, None)
src = os.path.join(QUI, 'noduli.onnx'); pre = os.path.join(QUI, 'noduli_pre.onnx'); dst = os.path.join(QUI, 'noduli_int8.onnx')
import onnx
nome = onnx.load(src, load_external_data=False).graph.input[0].name
class L2(Lettore):
    def __init__(s, files): s.dati = iter([{nome: f} for r in files for f in finestre(r)])
quant_pre_process(src, pre, skip_symbolic_shape=True)
quantize_static(pre, dst, L2(sys.argv[1:]), quant_format=QuantFormat.QDQ, per_channel=True,
                activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, op_types_to_quantize=['Conv'],
                calibrate_method=CalibrationMethod.MinMax, extra_options={'ActivationSymmetric': False, 'WeightSymmetric': True})
print('fatto', os.path.getsize(dst) / 1e6, 'MB')
