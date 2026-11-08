# Mejora UX de colisiones para NNJ: avisos de contacto y guía

Estado: **DESPLEGADO_Y_VERIFICADO en producción (SIM-UX-V1).**
- Commit UX: `5f427d6ee46113b4af1bda69f2cb3d1780ce32f0` (rama local `integrate/firvi-2025-head-canvas`, base `b06052b`).
- Despliegue: SIM-UX-V1, manual, 2026-11-08 00:01:01 (-03); solo se publicaron `index.html` y `simulator.js`.
- Verificación: 30/30 archivos runtime por HTTPS coinciden con `5f427d6`. Registro completo en [`current-baseline.md`](current-baseline.md).
- El despliegue no implicó push ni merge a GitHub.

(Lo que sigue es el informe original de la mejora, escrito antes de la publicación; se conserva sin cambios.)

**No se modificó la física** (`strike-physics.js`, geometría, radios, puntuación, contadores internos ni registros): solo el texto de `ui.feedback` y la guía.
Contexto: el bloqueo observado por un NNJ en el simulador público es una colisión válida con la caja todavía en la trayectoria (diagnóstico previo, documentado aparte); lo que sí fallaba era un mensaje obsoleto en pantalla.

## 1 · Cómo se actualizaba `ui.feedback` (antes)

Se escribía en cuatro sitios de `simulator.js` y **nunca se retiraba** al terminar el contacto: barrido que mueve una caja, servo bloqueado, empuje por traslación y robot bloqueado. El único modo de que desapareciera era que otro mensaje lo reemplazara. Resultado medido en la interfaz real: tras retroceder, la pantalla seguía diciendo «La caja no tiene espacio para desplazarse: el robot se detuvo…» (con `enContacto=false` y `bloqueoGarra=false`).

## 2 · Qué se corrigió

Solo mensajes obsoletos, con tres reglas:

1. **Un aviso vigente nunca se retira.** Mientras el robot siga bloqueado **o tocando** el obstáculo (a ≤ 1 cm: un bloqueo deja al robot en la última pose válida, a menos de un paso del contacto), el aviso permanece, aunque el programa haya dejado de dar órdenes y por mucho que pase el tiempo. No se esconde ninguna colisión real.
2. **Solo se reemplaza el texto exacto que este módulo escribió.** Un error, una calibración o cualquier otro mensaje posterior nunca se pisa.
3. **El resumen de un desplazamiento distingue «mover» de «despejar».**

Los textos **activos** no cambian (varias pruebas y la guía dependen de ellos).

| Situación | Antes | Después |
|---|---|---|
| La garra mueve o empuja un objeto | «Garra: contactó una caja y la está desplazando.» / «Garra: empuja una caja por contacto.» (se quedaba hasta otro mensaje) | igual mientras ocurre. Al terminar el barrido: «**La caja está a 19 cm de su posición inicial. Comprueba que el camino esté despejado.**» (variantes: «a menos de 1 cm», «El prisma…»; con varias cajas en el escenario, «La caja que tocó la garra está a…»; si la garra tocó varias cajas, «Se movieron N objetos respecto de su posición inicial. Comprueba…» **sin cifra**). Los mensajes rutinarios de órdenes de la garra no lo pisan durante 3 s |
| El cuerpo o la garra bloquean al robot (caja sin espacio, fija, giro con la garra tocando) | «… el robot se detuvo. Cambia la trayectoria de tu programa o mueve la garra para apartarlo.» (indefinidamente) | igual mientras siga bloqueado o tocando. Cuando el contacto termina (≥ 0,6 s sin tocar): «**Contacto liberado. Comprueba que el camino esté despejado antes de avanzar.**» |
| La garra queda bloqueada por un fijo o sin espacio | «El golpe encontró un obstáculo fijo.» / «El golpe se detuvo: falta espacio…» (indefinidamente) | igual mientras siga bloqueada. Si se libera sin orden nueva: «**La garra ya no toca el obstáculo.**». Si hay orden nueva, aparece el mensaje de la orden |

**Mover ≠ despejar (contadores y etiquetas).** No existe ningún contador ni etiqueta visible de «cajas movidas» (`movedCount` y `collisionCount` son internos y no se tocaron). La puntuación FIRVI ya distingue «desplazado» de «trayectoria liberada» (tres evidencias) y no se cambió. El único texto que podía confundirse era «la está desplazando»; el resumen nuevo dice a cuántos cm de su posición inicial está la caja tocada y pide comprobar el camino. **Significado de la cifra:** distancia actual, en línea recta, de ESA caja a su posición inicial en el escenario (no un acumulado de varias cajas ni lo que movió solo ese barrido). Solo se da cuando el aviso se refiere a una caja identificada; con varias cajas tocadas, o si no se puede atribuir, el mensaje no lleva cifra. El simulador **no** afirma que el camino quedó libre: no conoce la trayectoria que seguirá el programa del NNJ.

## 3 · Guía

`index.html`, tema 6 «Moviendo sus mecanismos»: tarjeta nueva **«Apartar un obstáculo con la garra»** (sin bloques de código ejecutables: la prueba de la guía fija los 6 programas copiables). Contiene:
- Los 5 pasos: detectar con el sonar, acercarse a una distancia adecuada, hacer un barrido controlado, comprobar que ya no está delante y recuperar la línea (o retroceder y reintentar).
- **Mover no es despejar.**
- **La distancia importa**: la garra llega a ≈ 22 cm del centro y el sonar está más adelante; en S01, barrer al leer 10 cm movió la caja ≈ 19 cm y el robot siguió; al leer 12 cm la garra ya tocaba la caja, la movió 1 cm y el robot la empujó hasta el borde. «La distancia adecuada depende de cómo llega el robot y de la forma del obstáculo.»
- **Por qué se bloquea un giro**: si la garra toca una caja mientras el robot gira, el robot se detiene (no puede empujar una caja girando); retroceder o mover la garra antes de girar.
- Una «Prueba» propuesta (barrer al leer 10 y al leer 12 cm).

## 4 · Archivos

| Archivo | Cambio |
|---|---|
| `simulator.js` | +62 −7: `noteContact`, `settleContactNote`, `endActivity`, `movedSummary`, `commandNote`, `stillTouching`; los cuatro puntos donde se escribían avisos; una llamada por tick en `update()`; reinicio de `contactNote` en `resetRobot` |
| `index.html` | +14: tarjeta de la guía (sin cambios en este ajuste) |
| `tests/contact-messages.cjs` (nuevo) | 11 pruebas de los mensajes (ver §5) |
| `tests/ux-engine-unchanged.cjs` (nuevo) | el motor es idéntico al de la base `b06052b` |
| `tests/contact-messages-ui.mjs` (nuevo) | Playwright antes/después (`SERVE_ROOT`, `LABEL`, `OUT_DIR`, `CASE`) |
| `docs/ux-mensajes-colision.md`, `docs/ux-mensajes-colision/playwright/` | este informe y la evidencia antes/después |
| `docs/known-limitations.md` | sección «Interfaz · avisos de contacto» |

No se modificó ningún otro archivo de la aplicación (`strike-physics.js`, `scenario-props.js`, `firvi-*.js`, `renderer3d.js`, `iroh-runtime.js`, etc.).

## 5 · Pruebas

| Prueba | Resultado |
|---|---|
| `tests/contact-messages.cjs` | 11/11. Aviso que **permanece**: caja sin espacio (40 s más), robot detenido tocando la caja sin dar órdenes, servo bloqueado (30 s más). Aviso que **se retira**: retroceder tras caja sin espacio, retroceder tras giro con la garra tocando, garra liberada sin orden nueva. Un mensaje ajeno no se pisa. Resumen «La caja está a 19 cm de su posición inicial» (lectura 10 cm; la cifra coincide con la distancia real de esa caja en ese instante) y «a 1 cm» (12 cm) en S01; con varias cajas, la cifra es la de la caja tocada y no la de otra; dos cajas tocadas o un objeto no atribuible → sin cifra; «El prisma que tocó la garra…» en FIRVI A (2 prismas). Los avisos activos no cambian de texto |
| `tests/ux-engine-unchanged.cjs` | copia pristina de la base `b06052b` frente al árbol de trabajo, comparados cada 0,05 s: pose, ruedas, garra, base de cada obstáculo, `collisionCount`, `movedCount`, `striker.blocked` y registro físico. **Idénticos.** Versión completa (9 escenarios, con FIRVI A y B completos: 3500 muestras cada uno) ejecutada antes del ajuste final de textos; tras él, versión rápida (7 escenarios) también idéntica (el ajuste solo cambió cadenas de texto). Solo se excluye el texto de `feedback` |
| Pruebas rápidas del repositorio (`tests/*.cjs` y `tests/sim1/*.cjs`) | todas con código 0 (incluye `runtime-servo`, `strike-audit`, `firvi-2025`, `guide-content` con la tarjeta nueva, `ui-contract`, `ui-shell`, `syntax`, `smoke`, `regression`); verificadas también sobre una copia limpia de la base con solo los archivos de este commit |
| Interfaz del repositorio (Chromium) | `guide-ui`, `firvi-2025-ui` (15), `firvi-competition-ui` (11), `firvi-scoring-ui` (6), `firvi-ui-final` (16), `calibration-ui`, `head-compat-ui`, `brand-logo-ui`: todas con código 0 |
| No repetido (motor intacto) | pruebas masivas de física |

**Playwright (`tests/contact-messages-ui.mjs`, copia pristina de la base `b06052b` frente a este árbol).** Evidencia en `docs/ux-mensajes-colision/playwright/` (capturas y `antes-*.json` / `despues-*.json` con cada mensaje y su tiempo simulado):

| Caso | Antes | Después |
|---|---|---|
| S01, barrido al leer 10 cm | termina en «Garra: centro.» | «La caja está a 19 cm de su posición inicial. Comprueba que el camino esté despejado.» |
| S01, barrido al leer 12 cm | «La caja no tiene espacio…» (el robot sigue detenido contra la caja) | idéntico: **el aviso vigente se conserva** |
| Retroceso tras la colisión (1,5 s tras terminar el contacto) | «La caja no tiene espacio para desplazarse: el robot se detuvo…» (obsoleto) | «**Contacto liberado. Comprueba que el camino esté despejado antes de avanzar.**» |
| Giro con la garra tocando (caja en (40, 80)); luego retrocede | queda «La garra tocó una caja durante un giro: el robot se detuvo…» | «**Contacto liberado. Comprueba que el camino esté despejado antes de avanzar.**» |
| 0 errores de JavaScript, 0 violaciones de CSP, 0 recursos fallidos | ✔ | ✔ |

**FIRVI A y B nominales en Chromium** (ronda completa, calibración incluida): 220 puntos + 80 pendientes del juez, 2 barridos, 0 contactos, sin errores de JavaScript, recursos faltantes ni violaciones de CSP. Con el prisma, la interfaz muestra «El prisma que tocó la garra está a 21 cm de su posición inicial. Comprueba que el camino esté despejado.». Esa verificación usó un arnés experimental de Playwright que no forma parte de este commit.

Nota: en la interfaz el avance del tiempo depende del reloj de pared, así que entre ejecuciones de Playwright pueden variar algunos instantes o eventos (p. ej. si aparece o no un bloqueo de giro durante el seguimiento de línea); la comparación **determinista** del motor es `ux-engine-unchanged.cjs`.

Guía en la interfaz real: `docs/ux-mensajes-colision/playwright/guia-apartar-un-obstaculo.png` (y `.txt` con el texto).

## 6 · Limitaciones que permanecen (sin cambios)

Este cambio **no** resuelve ni oculta ninguna limitación física: la colisión de cuerpo de 8,3 cm es una suposición del simulador, la regla de «giro con la garra tocando» sigue deteniendo al robot (ahora la guía la explica) y un NNJ puede elegir una distancia de barrido insuficiente. Las limitaciones del programa de referencia de FIRVI se documentan aparte (diagnóstico previo, fuera de este commit). Propias de este cambio:
- Los avisos se evalúan por tick de simulación y por geometría (≤ 1 cm): un robot detenido a 1–2 cm de un obstáculo ve «Contacto liberado. Comprueba que el camino esté despejado antes de avanzar.» aunque avanzar de nuevo volvería a bloquearse (aparecería entonces el aviso de bloqueo): por eso el texto pide comprobar el camino.
- La cifra del resumen es la distancia actual de la caja tocada a su posición inicial en el escenario (en línea recta), no lo que movió solo ese barrido; así lo dice el texto («está a X cm de su posición inicial»).
- Los textos activos siguen siendo los de la física/UI previa; no se reescribieron para no romper pruebas ni la guía.
- Estos cambios solo llegan a los NNJ cuando se publiquen `simulator.js` e `index.html`; hasta entonces el simulador público conserva el comportamiento anterior.
