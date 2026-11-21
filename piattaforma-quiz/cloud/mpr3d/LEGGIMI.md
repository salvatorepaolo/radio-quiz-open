# Modulo MPR + 3D (sorgente)

`mpr3d.src.js` usa Cornerstone3D (MIT) e vtk.js (BSD) per l'MPR (assiale, coronale, sagittale,
obliqua, MIP/MinIP/media su strato spesso) e il volume rendering.
Il volume viene costruito dalle fette già decodificate dal visualizzatore 2D, senza altri
caricatori DICOM.

Ricostruire il file usato dal sito (`../web/lib/mpr3d.js`):

    npm install
    npm run build          # crea out/mpr3d.js
    cp out/mpr3d.js ../web/lib/mpr3d.js
