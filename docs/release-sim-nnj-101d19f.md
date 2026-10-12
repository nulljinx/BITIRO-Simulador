# SIM-NNJ-101d19f — baseline publicado

**Producción actual** (`https://simulador.nulljinx.com`): cuatro archivos publicados, verificados por HTTPS público el 2026-10-12. El resto de los archivos servidos coincide byte a byte con la rama `release/sim-ui-release-4`.

```text
5cf59457497cb3c0ec19b977d6d4eaa6972a1c50dcbfb8587a7a1b85dbf79145  index.html
d9883a89415b0f7d8dfdec2ebeedf0902058c7b7964b83d34cd15f65e464e9f1  simulator.js
d80ddd1f64019c07c60d55572433647a499cd932e1df4a84e1c08556ad1784e6  styles.css
0e434c0643a558336f4805161b822e565c6540ba4ecad420d691b73b30ea5900  ui-shell.js
```

Origen: `release/sim-ui-release-4` (`1a555ea`, tag `sim-ui-release-4-deployed`) + Guía por temas y menú «Más» simplificado de `main` (`24bde5d`, `5f5e16a`, `101d19f`). **No coincide con ningún commit de `main`**: conserva el sonar a 9,83 cm y la base de ruedas de 12 cm de la release, sin `iroh-visual.js` ni `assets/iroh/`.

No deducir la versión publicada a partir de HEAD de `main`; la identidad válida son los SHA-256 anteriores.
