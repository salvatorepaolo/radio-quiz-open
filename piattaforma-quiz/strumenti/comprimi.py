#!/usr/bin/env python3
"""Compressione SENZA PERDITA delle immagini dei casi (JPEG Lossless, processo 14 SV1,
1.2.840.10008.1.2.4.70), che il visualizzatore legge già. Le TC si riducono circa della metà.

    ~/.radioquiz-ia/venv/bin/python strumenti/comprimi.py caso-064     # un caso
    ~/.radioquiz-ia/venv/bin/python strumenti/comprimi.py --tutti      # tutti i casi
    ... --prova                                                        # solo il conto, senza scrivere

Solo immagini a un canale (MONOCHROME1/2), 8 o 16 bit, non compresse, un fotogramma.
Ogni file compresso viene decodificato di nuovo e confrontato pixel per pixel con l'originale:
se anche un solo valore è diverso, o se compaiono campi nuovi nell'intestazione, il file resta com'era.
"""
import os, sys, tempfile
import numpy as np, pydicom, gdcm

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASI = os.path.join(BASE, "casi")
NON_COMPRESSE = {"1.2.840.10008.1.2", "1.2.840.10008.1.2.1"}
LOSSLESS = "1.2.840.10008.1.2.4.70"


def adatto(ds):
    return (str(ds.file_meta.get("TransferSyntaxUID", "")) in NON_COMPRESSE and "PixelData" in ds
            and int(ds.get("SamplesPerPixel", 1) or 1) == 1 and str(ds.get("PhotometricInterpretation", "")) in ("MONOCHROME1", "MONOCHROME2")
            and int(ds.get("BitsAllocated", 0) or 0) in (8, 16) and int(ds.get("NumberOfFrames", 1) or 1) == 1)


def comprimi(p, scrivi=True):
    ds = pydicom.dcmread(p)
    if not adatto(ds):
        return None
    prima = os.path.getsize(p)
    r = gdcm.ImageReader(); r.SetFileName(p)
    if not r.Read():
        return None
    ch = gdcm.ImageChangeTransferSyntax()
    ch.SetTransferSyntax(gdcm.TransferSyntax(gdcm.TransferSyntax.JPEGLosslessProcess14_1))
    ch.SetInput(r.GetImage())
    if not ch.Change():
        return None
    fd, tmp = tempfile.mkstemp(suffix=".dcm", dir=os.path.dirname(p)); os.close(fd)
    try:
        w = gdcm.ImageWriter(); w.SetFileName(tmp); w.SetFile(r.GetFile()); w.SetImage(ch.GetOutput())
        if not w.Write():
            return None
        g = pydicom.dcmread(tmp)
        if str(g.file_meta.TransferSyntaxUID) != LOSSLESS:
            return None
        # da GDCM si prende solo il flusso compresso: l'intestazione resta quella originale (GDCM aggiunge
        # campi obbligatori vuoti come PatientBirthDate o AccessionNumber, che qui non servono)
        ds.PixelData = g.PixelData
        ds["PixelData"].VR = "OB"
        ds["PixelData"].is_undefined_length = True
        ds.file_meta.TransferSyntaxUID = LOSSLESS
        ds.save_as(tmp, enforce_file_format=True)
        nuovo = pydicom.dcmread(tmp)
        # stessa immagine, pixel per pixel
        if not np.array_equal(pydicom.dcmread(p).pixel_array, nuovo.pixel_array):
            return "diverso"
        # nessun campo nuovo nell'intestazione
        extra = {e.keyword or str(e.tag) for e in nuovo} - {e.keyword or str(e.tag) for e in pydicom.dcmread(p, stop_before_pixels=True)} - {"PixelData"}
        if extra:
            return "campi nuovi: " + ", ".join(sorted(extra))
        dopo = os.path.getsize(tmp)
        if dopo >= prima * 0.95:
            return None                     # non conviene
        if scrivi:
            os.replace(tmp, p); tmp = None
        return (prima, dopo)
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def main():
    a = sys.argv[1:]
    prova = "--prova" in a
    casi = sorted(d for d in os.listdir(CASI) if d.startswith("caso-")) if "--tutti" in a else [x for x in a if x.startswith("caso-")]
    if not casi:
        print(__doc__); sys.exit(1)
    tp = td = n = 0
    for c in casi:
        cp = cd = cn = 0; prob = []
        for rad, _, files in os.walk(os.path.join(CASI, c, "serie")):
            for f in files:
                if not f.endswith(".dcm"):
                    continue
                try:
                    x = comprimi(os.path.join(rad, f), scrivi=not prova)
                except Exception as e:
                    x = f"errore {e}"
                if isinstance(x, tuple):
                    cp += x[0]; cd += x[1]; cn += 1
                elif isinstance(x, str):
                    prob.append(f"{f}: {x}")
        if cn:
            print(f"{c}: {cn} immagini, {cp / 1e6:.0f} → {cd / 1e6:.0f} MB ({100 * cd / cp:.0f}%)")
        for x in prob[:3]:
            print("   lasciato com'era:", x)
        tp += cp; td += cd; n += cn
    if n:
        print(f"Totale: {n} immagini, {tp / 1e9:.2f} → {td / 1e9:.2f} GB{' (prova: nessun file scritto)' if prova else ''}")


if __name__ == "__main__":
    main()
