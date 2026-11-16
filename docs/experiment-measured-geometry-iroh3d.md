# Experimento: geometría medida del IROH y modelo visual 3D

> **Estado: preservado, no activo en producción.** Esta línea vive en la rama local `experiment/measured-geometry-iroh3d`, creada exactamente en `6f4d6a742f9322cdd40d988f4c51be1ad0a73e49` (el `main` anterior a SIM-NOFIRVI-1). Es un registro de preservación; no es una release.

## Qué contiene

- Geometría medida: separación de ruedas **10 cm**, origen funcional del sonar **7,40 cm** (6,50 + 0,90).
- Modelo visual IROH 3D (`?robot=iroh`): `iroh-visual.js`, `assets/iroh/iroh-render-v1.js`, `tools/build-iroh-render-asset.mjs`.
- Pruebas asociadas (`tests/physical-geometry.cjs`, `tests/iroh-visual*.{cjs,mjs}`, `tests/perf/iroh-*`) y goldens `tests/golden/*` calculados con esa geometría.
- Documentación: `docs/physical-geometry.md`, `docs/iroh-3d-integration.md`.

## Cómo recuperarlo

```bash
git worktree add ../BITIRO-Simulador-experiment experiment/measured-geometry-iroh3d
```

No se fusiona con el runtime oficial (rueda 12 cm, sonar 9,83 cm, HEAD-CANVAS) sin una decisión explícita: las dos líneas usan geometrías y goldens distintos.

## Manifiesto de preservación (SHA-256 de los blobs en `6f4d6a7`)

### Geometría medida y visual IROH 3D (runtime)

| Archivo | SHA-256 |
|---|---|
| `assets/iroh/iroh-render-v1.js` | `c27720e1f7fcfa7dc2c5049dfac6f3f67c5ee4c15bbfa9feddd67b2219af7783` |
| `calibration.js` | `8fc00eedb20627c5593f99e1a7b41f1cfc1aea5ca5a102e72ea34e922e494f5a` |
| `extra-tracks.js` | `3e530b770c223feadc69ce5a9b4cd1ae92c34811c9cbea2c525971916c6d83e7` |
| `iroh-runtime.js` | `83d3f714df1ce54b427c9963ae2841deb0b6dcd224e024088c86b70d40e42a2a` |
| `iroh-visual.js` | `8b65d4b55f84c0af41a64e8cdba6e90c4f969cb85979dafa26aa20bb493dd798` |
| `renderer3d.js` | `fc791ea24e6a44d2c9f2f83e5b440652323d4b1cb10f453705599b93c589cee4` |
| `simulator.js` | `67cb436d10953e4465311daff6e416dee288ee9f0928f3b3817ab7b7c8f09ca4` |
| `strike-physics.js` | `5196d184932f313072f1fb8c8c09c93e34c4db17327e3abcc9860575b4d7c64d` |
| `styles.css` | `d80ddd1f64019c07c60d55572433647a499cd932e1df4a84e1c08556ad1784e6` |
| `tokens.css` | `da6a5a10c0e9d0966f3e7b8a60c54a7b1608549a72983ccadea9b67771303eea` |
| `tracks.js` | `fbdae9bda13e4081f2f244aa82999c1078c8fc00f3ea4d30b7caea082e03de6b` |

### Herramienta de generación del asset

| Archivo | SHA-256 |
|---|---|
| `tools/build-iroh-render-asset.mjs` | `46c0549e4fed2e328305a0674f157570c6af90d821dbdcf6553db8d15f73b868` |

### Pruebas y goldens asociados

| Archivo | SHA-256 |
|---|---|
| `tests/golden/oval_continuous.json` | `9e62b1f7d096a55ed1cb54666677cce3dfcebfb38732ed2b4fe59854f59307f1` |
| `tests/golden/runtime.json` | `89677eb5de3b96d3b60919b443ff1c6280a7fdb1a05f85610cb7589ef8042895` |
| `tests/golden/s01_demo_strike.json` | `9e475a8a419f7bf5dd4de5363f618b0da307cbf9adef4a0ff7efadd04b2d0aef` |
| `tests/golden/s01_straight.json` | `11a10471e35abf1ebe3770a7f9c17e615313bcff04367c03879680f392d5f019` |
| `tests/golden/s01_turn.json` | `49ffe2fdb379b45bcec55b0d1c6292e67c9e56e1f31a0412c84c0e1838534520` |
| `tests/golden/s02_three_sensors.json` | `c6d4f1dfe9c263caa6f1b1c8b3461446eaf7142e771619f0e3d03e6e18c73214` |
| `tests/golden/sensor-model-legacy-hashes.json` | `c8b4625160d51c210ba3872c2f8287de690e78239a0f3470cf1e264ecfc4e8dc` |
| `tests/golden/servo_sweep.json` | `7b87c9da081b1f35bd4876e91596bef5b5ab6d6a7796b4badbb48f381da08b1b` |
| `tests/golden/sonar_range.json` | `52cacf90e5321c9e4b859acf5684f9b85b1b500d20e38cfc6f0f329ae067edee` |
| `tests/golden/storage.json` | `43112abb99aa9cb9f85c56276eae7d4840a2b80610ecee15edeefd337efbadd9` |
| `tests/iroh-visual-ui.mjs` | `3549e3376b7247b9171f35474b80f230fd20461c60102808a484c4d67146f823` |
| `tests/iroh-visual.cjs` | `1e0ce55937949d05fa4549eed00323989d48f32a7c573d344b6d5fbd595e3078` |
| `tests/perf/iroh-ab-node.cjs` | `2a59fd0d8186f5976d75a4b2bb9a268738766b450986e273b08d6e740c26a6c0` |
| `tests/perf/iroh-ab.mjs` | `1d2cc31ea63697a0f0e14a46d37ce8854a00ba07333a4423cd61e87e466b1b7d` |
| `tests/perf/iroh-render-svg.cjs` | `85eca28390ca97af0a08046301e0668bd24e550d9d3e5fc642ba96a74373e475` |
| `tests/perf/iroh-world.cjs` | `844eed5a300ec30881a3d20440008a37c689f3ae6011466b1b1859f755f12d37` |
| `tests/physical-geometry.cjs` | `00be5f2c28bf541f1f41cb9a39253faf74469f485026bf2d278c6993b8875e37` |
| `tests/sim1/wheelbase-probe.cjs` | `bbf926bca8bcce938a21a1d11e29f7f992de72f7cdf3ecd4c632cbc94f6f200f` |

### Documentación

| Archivo | SHA-256 |
|---|---|
| `LEEME.md` | `bc49070c9efe7e5a1985abc73f58fffe6f20f642afbf23be41e031b1221b073f` |
| `README.md` | `8af9b38a4f0dd3dddce784e5b43642f2357cc39211e5e78855184af68c09dc41` |
| `docs/architecture.md` | `3d62bf4cbcf0d78f7d0fa5117e6fd34d595d9e062b5f56c8e1e589d803d4a12a` |
| `docs/iroh-3d-integration.md` | `1f2ea58cb6052e73efb88545aa75e5c0867a7ebf3d3e86456e4620e91f608bd2` |
| `docs/known-limitations.md` | `d7443ac0b62e087163fe95c4cdfd8c494ede2ae0226c158153384b8096680f63` |
| `docs/physical-geometry.md` | `b3ba81937f5a8e634d330fc3b51592a21e898d5ec8fa4784b6a263c42eecfd63` |

Total: 36 archivos.
