# Atlante dell'encefalo (strumenti_claude/encefalo)

Giri, lobi e territori arteriosi sopra le RM dell'encefalo nel visualizzatore. Tutto open source.

- **Strutture e giri:** MindSnap di [brainchop](https://github.com/neuroneural/brainchop) (MIT), 104 classi Desikan-Killiany.
  Sul Mac con il pacchetto Python `brainchop`; nel visualizzatore gratuito con `@brainchop/core` (copiato in `web/lib/brainchop/`).
- **Territori arteriosi:** [Digital 3D Brain MRI Arterial Territories Atlas](https://github.com/Chin-Fu-Liu/Arterial_Atlas)
  (Johns Hopkins University, CC BY-SA 4.0), adattato a ogni esame con una thin-plate spline sui centri delle strutture
  (esame ↔ template ICBM 2009c). Se lo scarto mediano supera 6 mm l'atlante non si pubblica.

## Preparazione (una volta)

```bash
python3.14 -m venv .venv && .venv/bin/pip install brainchop nibabel SimpleITK pydicom scipy pillow
mkdir -p atlante && cd atlante
R=https://raw.githubusercontent.com/Chin-Fu-Liu/Arterial_Atlas/main/data
curl -LO $R/Atlas_182/ArterialAtlas.nii && curl -LO $R/Atlas_182/ArterialAtlas_level2.nii && curl -LO $R/ArterialAtlasLables.txt
curl -LO https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009cAsym/tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz
../.venv/bin/brainchop -m mindsnap tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz -o mni_snap.nii.gz
cd .. && .venv/bin/python prepara_atlante.py && .venv/bin/python prepara_web.py   # → web/atlante/
```

## Casi del sito

```bash
.venv/bin/python segmenta_encefalo.py --tutti          # RM encefalo non ancora fatte (una serie 3D per studio)
.venv/bin/python segmenta_encefalo.py caso-tcia-062 --rifai
```

Scrive `casi-free/<caso>/ia/<serie>.{json,lab.gz,art.gz}`; la pubblicazione li porta online come le altre segmentazioni.

Prove: `_video_tutorial/prova_atlante_sito.mjs` (sito, simulatore) e `_video_tutorial/prova_atlante_client.mjs`
(visualizzatore gratuito, calcolo nel browser con WebGPU).
