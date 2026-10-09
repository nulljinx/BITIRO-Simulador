# Referencia de interfaz: patrones del BITIRO Lab a trasladar al Simulador

- **Fecha:** 2026-10-06
- **Estado:** inspección y decisión de patrones. No se ha modificado ningún archivo del producto.
- **Fuente inspeccionada (solo lectura):** repositorio local `BITIRO-Lab` (v8.00.0, último commit `a2cb096`). No se modificó nada en BITIRO-Lab.
- **Evidencia visual:** capturas del Lab en `BITIRO-Lab/test-results/` (`premium-s01-1440.png`, `premium-s01-390.png`, `s01-runtime-ejecutando.png`) y capturas propias del simulador v4 actual (1440 y 390 px).
- **Principio:** el Simulador debe reconocerse de inmediato como BITIRO. No se diseña una identidad nueva y se elimina todo lo propio de sesiones pedagógicas.

## 1. Estado actual: v4 frente al Lab

| Aspecto | Simulador v4 (hoy) | BITIRO Lab (referencia) |
|---|---|---|
| Disposición | Encabezado grande («La pista es tu laboratorio»), banda de controles, tarjeta «Tu experimento» y solo después el simulador; en 1440×900 el 3D queda **bajo el pliegue** | Una línea de título, simulador y editor lado a lado y visibles desde el primer pantallazo |
| Controles visibles | 9 botones + 3 selectores + toggles (Calibrar, Demostración, Pausar, Paso, Reiniciar, Golpe, Ocultar editor, velocidad, calidad 3D, rastro) | Cambio de vista, zoom, Restablecer, velocidad, Pausar/Detener, y «Probar código» junto al editor |
| Tipografía | Declara IBM Plex pero **no incluye `@font-face`**: sin la fuente instalada cae a la sans del sistema (se ve en la captura) | IBM Plex Sans y Mono empaquetadas (`@fontsource`) |
| Color de acción | Cobre y verde azulado (paleta anterior) | Azul de acción `#0E0D9F` (hover `#09085F`), superficies cálidas neutras, paneles de instrumento oscuros |
| Bordes y radios | Paneles de ~14 px, bordes de tarjeta | Radios pequeños: paneles 4 px, controles 6 px, flotantes 10 px |
| Editor | `<textarea>` plano en panel oscuro, intro larga | Panel oscuro con barra de archivo, estado «Guardado local», números de línea, resaltado de sintaxis y barra inferior con la acción principal |
| Telemetría | Columna de tarjetas con muchas etiquetas | Columna estrecha junto al 3D: sensor, pulsador, IR, LCD (verde apagado, `#CAD3C2`) |
| Móvil | Se apila, pero con la banda de controles completa | Simulador arriba, barra de ejecución, telemetría colapsable («Sensores y telemetría») y editor debajo |

## 2. Patrones que se trasladan

Cada patrón indica su origen en el Lab para poder verificarlo.

### 2.1 Jerarquía visual y layout
- **Título de una línea con eyebrow** (`.workspace-heading`, 24 px, `letter-spacing -.55px`; eyebrow en mayúsculas de 9,5–11 px). En el Simulador el eyebrow dice `Simulador libre` y el título es la pista elegida; **sin misión, sesión ni progreso**.
- **Rejilla de dos columnas** (`.workspace-grid`: 39 fr / 61 fr entre 1024 y 1439 px; ~41/59 en tablets anchos). El simulador es dominante y el editor queda asociado a su derecha. Espaciado entre paneles: 7–10 px.
- **El workspace ocupa la altura de la ventana** (`height` fijo con `dvh`; paneles internos con scroll propio) para que simulador y editor se vean sin desplazarse.
- **Modo foco / pantalla completa** del simulador (`is-simulation-focused`, atajo `Ctrl + \`): se conserva como control secundario.

### 2.2 Paneles, bordes, radios y espaciado
- Tokens semánticos `--surface-*`, `--border-*`, `--text-*`, `--instrument-*`, `--radius-panel: 4px`, `--radius-control: 6px`, `--radius-floating: 10px`, escala `--space-1…12` (4–48 px), movimiento 130–300 ms con `cubic-bezier(.22,1,.36,1)`.
- Sombras solo en elementos flotantes o de acción (`--shadow-floating`, `--shadow-action`).
- Paneles de instrumento: fondo `#14181D`/`#0B1B32`, línea `#262B31`, texto `#ECE7DD`.

### 2.3 Tipografía
- **IBM Plex Sans** (texto) e **IBM Plex Mono** (código, números, etiquetas técnicas).
- Escala del Lab: display 46, h1 32, h2 24, h3 17, cuerpo 14, etiqueta 12, micro 11, código 13 px. Etiquetas técnicas en mayúsculas con `letter-spacing` de ~.1em.
- **Cambio necesario:** empaquetar las fuentes localmente (ver §5), porque hoy el v4 no las carga.

### 2.4 Lenguaje de botones y controles compactos
- Botón base con borde fino, fondo de panel, hover `--surface-panel-muted` y borde `--border-strong`; **primario** relleno azul de acción con texto blanco y hover más oscuro; deshabilitado en gris de panel.
- Controles de barra compactos: 29–35 px de alto, fuente 10–11 px, icono de 15 px más etiqueta, radio 6 px.
- Conmutador segmentado de cámara (`.camera-mode-switch`: Superior / Perspectiva / Seguir IROH) con `aria-pressed`.
- Zoom `− 100 % +` y pantalla completa como botones de icono.
- Selector de velocidad con icono de velocímetro (`1×`).
- Iconografía: `lucide` (trazo fino). **No se instalará** ninguna librería; se usarán SVG en línea del mismo estilo.

### 2.5 Estados hover y foco
- Hover: cambio de fondo sutil, sin desplazamientos.
- Foco: `outline: 3px solid var(--focus-ring)` (`#2458A6`), `outline-offset: 4px` (reemplaza el actual `#42aaca`/3 px).
- Objetivos táctiles ≥ 44 px en móvil; compactos solo en escritorio.
- `prefers-reduced-motion` respetado (ya existe en v4).

### 2.6 Editor
- Panel oscuro (`bitiro-night`: fondo `#101419`, línea activa `#191F27`, cursor `#FFAF75`, comentarios `#A3AAB2`, palabras clave `#82B6D9`, cadenas `#9FD4AF`, números `#F4C07A`).
- **Barra de archivo** con nombre y estado «Guardado local».
- **Barra inferior** con la acción principal grande: «Probar código» en el Lab; en el Simulador la acción se llama **«Ejecutar»** y es el único botón primario de toda la pantalla.
- Lo que se conserva del v4: el intérprete, los ejemplos y el guardado local por pista (sin cambios de comportamiento).
- No se instala Monaco. El `<textarea>` actual se mantiene en este piloto, con números de línea y resaltado ligeros solo si caben sin dependencias; de lo contrario queda como mejora posterior.

### 2.7 Presentación del simulador y telemetría
- Cabecera del panel: identificador de pista (`S01`), conmutador de cámara, zoom/pantalla completa.
- Rótulo en el lienzo («BITIRO / S01 / 3D · Arrastra para orbitar · rueda para zoom»).
- **Barra de ejecución inferior** (`.runtime-bar`): Restablecer, velocidad, Pausar/Continuar, Paso; a la derecha, estado con punto de color y tiempo (`0.0 s`).
- **Telemetría compacta** en columna estrecha junto al 3D: lecturas de los tres sensores de línea, sonar, LCD 16×2 y estado del golpe. Los controles manuales de IR se mueven a un panel secundario.
- LCD con el aspecto del Lab (fondo `#CAD3C2`, texto `#243127`, `IBM Plex Mono`).

### 2.8 Responsive
Puntos de corte del Lab: **≥ 1440, 1024–1439, 768–1023, ≤ 767, ≤ 520 px**.
- **Escritorio:** dos columnas y workspace de altura de ventana.
- **Tablet:** pestañas Código / Simulador (`workspace-tabs`) o columnas más estrechas.
- **Móvil:** simulador arriba (alto `clamp(220px, 32dvh, 360px)`), barra de ejecución, telemetría **colapsable** («Sensores y telemetría»), editor debajo con su botón de ejecutar. Al ejecutar con éxito, el foco vuelve al simulador; si hay error, al editor.

## 3. Qué NO se copia (propio de sesiones pedagógicas)

Objetivos, misiones y su contador («Objetivos de la misión 0/4»), OA, progreso, mentor y paneles de solución, estados de «completado», mensajes de cumplimiento o evaluación, navegación curricular («Sesión 01», «Mi programa», explorador de sesiones, guía por sesión), tutorial guiado de sesión, cuentas y login, espacios institucionales, Supabase, y los textos pedagógicos de v4 («Tu experimento», «Calibra / Predice / Comprueba», lecciones por pista).

Tampoco se copian los nombres ni elementos de **marcas de aliados institucionales**: el Lab define una paleta institucional (`--mustakis-*`) cuyo azul se usa como color de acción. Para reconocerse como BITIRO se reutiliza el **valor** del azul de acción bajo nombres neutros (`--action-primary`), no los identificadores ni logotipos del aliado. Esto debe confirmarse (ver §6).

## 4. Jerarquía de controles del Simulador

**Visibles siempre (barra principal):**
1. Selector de pista.
2. Selector de cámara (Superior / Perspectiva / Seguir IROH; «Ver robot» queda como cuarta opción).
3. **Ejecutar** (único primario; también `Ctrl + Enter`).
4. Pausar / Continuar.
5. Reiniciar.
6. Paso (+0,1 s), activo solo en pausa.
7. Editor, simulador, LCD y telemetría compacta.

**Secundarios (menú «Más» o panel desplegable):** velocidad, calidad 3D, rastro del recorrido, zoom/pantalla completa, demostración guiada, botón de golpe manual, estímulos IR manuales, plotter original, calibración (banco v1 actual hasta SIM-7), ejemplos de código.

**No aparecen en la vista normal:** deslizadores de parámetros físicos, edición manual de X/Y o del ángulo, parámetros de motores, manipulación directa de sensores, tarjetas informativas. El robot se controla por código.

## 5. Consideraciones de implementación (sin ejecutar nada todavía)

- **Fuentes offline:** copiar los `woff2` latinos de IBM Plex Sans (400/500/600) y Mono (400/500) desde `BITIRO-Lab/node_modules/@fontsource/*` a `assets/fonts/` con `@font-face` y `font-display: swap` (licencia OFL; incluir su texto de licencia). Es copia de archivos, no instalación de dependencias. Peso aproximado: decenas de KB por archivo.
- **Logo:** el Lab usa `public/brand/bitiro-symbol-*.png`; el Simulador ya tiene `assets/bitiro-symbol.png` (128 px). Pendiente decidir el nombre del producto en la barra superior (§6).
- **Tokens:** crear `tokens.css` con nombres semánticos del Lab (sin los alias `mustakis-*` ni las ~100 variables `legacy-color-*`); solo los que el Simulador usa.
- **Compatibilidad con tests:** `smoke.cjs`, `regression.cjs` y `sim1.cjs` usan un DOM simulado que acepta cualquier id; aun así los ids que leen o escriben `simulator.js` y `iroh-runtime.js` (`#src`, `#msg`, `#lcd`, `#track`, `#speed`, `#pause`, `#step`, `#strike`, `#demo`, `#calibrate`, `#ir0`, `#ir1`, `#statusBadge`, etc.) **se conservan**. Cambiar de sitio un control no debe cambiar su id ni su comportamiento.
- **Sin cambios en** física, runtime, goldens, pistas ni claves de `localStorage`.
- **Verificación visual:** capturas con Playwright (ya disponible en el Lab; solo lectura) a 1440, 1024, 768 y 390 px, antes y después.

## 6. Decisiones (resueltas el 2026-10-06)

1. **Alcance de PILOT-1:** rediseño de la interfaz en HTML/CSS/JS plano, sin tocar física, runtime, goldens ni claves de `localStorage`; sin React, Vite ni Three.
2. **Nombre:** «BITIRO Simulador» (mismo símbolo y tipografía que el Lab).
3. **Azul de acción:** se reutiliza el valor `#0E0D9F` bajo el nombre neutro `--action-primary`; sin identificadores ni marcas de aliados.
4. **Calibración v1:** el botón «Calibrar sensores» se **oculta** de la interfaz hasta SIM-7 (el nodo y el diálogo siguen en el DOM porque `simulator.js` los cablea).

## 7. Resultado de PILOT-1 (interfaz)

**Archivos nuevos o modificados:** `index.html` y `styles.css` (reescritos), `tokens.css`, `ui-shell.js`, `assets/fonts/*` (IBM Plex Sans 400/500/600 y Mono 400/500, latín, más la licencia OFL), `tests/ui-contract.cjs`. Ningún script v4 (`simulator.js`, `iroh-runtime.js`, `renderer3d.js`, `calibration.js`, `strike-physics.js`, pistas) fue modificado.

**Qué cambió:**
- Una línea de título; simulador y editor lado a lado y visibles sin desplazarse en 1440×900.
- Barra del simulador: selector de pista, selector de cámara, zoom y pantalla completa. Barra inferior: Ejecutar (solo visible si el editor está oculto o en vistas apiladas), Pausar/Continuar, Paso y Reiniciar, más el tiempo. **Ejecutar** es el único botón primario y vive en la barra inferior del editor (como en el Lab).
- Telemetría compacta: tres sensores de línea, sonar, LCD, golpe y «Más datos» (motores, posición, objetos, relación lectura→acción).
- Menú «Más»: velocidad, calidad 3D, rastro, estímulos IR manuales, demostración guiada, golpe manual y plotter original.
- Editor con barra de archivo, números de línea (los errores del intérprete citan «línea N») y barra inferior con ejemplo y Ejecutar.
- Móvil (≤ 767 px): simulador arriba, controles, estado, telemetría colapsable y editor debajo; tablet apilado.
- Eliminado de la vista: encabezado grande, banda de controles, «Tu experimento», lecciones, pie de página, «Huella de sensores», ocho botones de la banda, texto de calibración en la introducción.

**Compatibilidad:** los ids que usan los scripts se conservan. Cinco nodos ocultos (`#calibrate`, `#calibrationSummary`, `#lessonTitle`, `#lessonGoal`, `#lessonQuestion`) siguen en el DOM dentro de un contenedor `hidden` + `aria-hidden` (sin caja, fuera del orden de tabulación y del árbol de accesibilidad) porque `simulator.js` los lee o escribe y `regression.cjs` los comprueba; se retirarán al extraer el core (SIM-3) y reemplazar la calibración (SIM-7).

**Verificación:**
- `node tests/smoke.cjs`, `regression.cjs`, `sim1.cjs` sin cambios (goldens intactos) y `tests/ui-contract.cjs` (7 comprobaciones; su control negativo detecta un `#workspace` ausente, un error real que apareció durante el trabajo).
- Capturas en Chromium a 1440, 1100, 768 y 390 px; 16 interacciones comprobadas en navegador (ejecutar, pausa/paso, reiniciar, cámara, cambio de pista, error amigable, menú, editor oculto, `Ctrl+Enter`, telemetría móvil y orden en móvil) sin errores de consola ni desbordamiento horizontal. Ese guion usa el Playwright del Lab y no forma parte del repositorio.

**Limitaciones conocidas:**
- La escena 3D (renderer Canvas procedural) recorta parte de la pista en paneles más estrechos que el v4 porque el encuadre no cambió; se resolverá con el renderer de SIM-5.
- El editor sigue siendo un `<textarea>` (sin resaltado de sintaxis ni autocompletado).
- La capa de interfaz usa un `requestAnimationFrame` ligero para sincronizar los números de línea, porque el código cambia también por programa (ejemplos, cambio de pista) sin disparar `input`.

## 8. PILOT-2 — pulido previo al despliegue (actualiza la §7)

Cambios respecto a PILOT-1, sin tocar física, runtime, sensores, sonar, pistas, storage, calibración, `simulator.js`, `renderer3d.js` ni goldens:

- **Teclado en el editor (H1):** `Tab` sigue insertando espacios; `Escape` y luego `Tab` salen del editor y el siguiente `Tab` continúa la navegación; `Mayús+Tab` siempre navega hacia atrás. Implementado en `ui-shell.js` con un listener en captura que corta la propagación hacia el manejador de `simulator.js` solo en esos casos.
- **Ejecutar en vista apilada (H3):** si el programa inicia bien (`.ok` en `#msg`) se desplaza al simulador con `scrollIntoView` (inmediato con `prefers-reduced-motion`), salvo que el canvas ya esté a la vista. Si hay error, nunca se desplaza al simulador: el mensaje queda visible y con foco, y el editor se reabre si estaba oculto. No actúa cuando editor y simulador están visibles a la vez.
- **Canvas dominante y telemetría compacta (H2/M1/M2):** se eliminó la columna lateral de telemetría. Ahora hay una franja bajo el canvas con Línea (I · C · D, una sola lectura), Sonar, Motores I/D, Servo y LCD; «Más datos» (menú emergente) conserva la lectura normalizada, barras, posición, objetos y la relación lectura → acción. El zoom pasó a un control superpuesto en el canvas.
- **Cámara:** `getPerspectiveFitFactor(ancho, alto, altoPistaCm)` (función pura, en `window.BITIRO_UI`) devuelve el factor en [1; 1,25] por el que `ui-shell.js` multiplica la distancia **base** del preset de perspectiva. Se recalcula siempre desde esa base (nunca desde el valor ya ajustado) al cambiar de pista, de cámara o de tamaño; no pisa un zoom hecho por el usuario; al terminar llama a la función existente `updateZoom()`. Tabla medida con la proyección del renderer (S01: 1,22 en canvas vertical; S03: 1,12; pistas de 200 cm: 1,10).
- **Cabecera (M3):** se eliminó la fila «Práctica libre / Simulador libre» (queda un `h1` accesible). «Ocultar/Escribir código» pasó al menú «Más» junto con velocidad, calidad, rastro, IR, demostración, golpe y plotter. Barra superior de 56 px.
- **Táctil y 320 px (M4/M5):** en ≤ 1023 px todos los controles interactivos miden ≥ 44 px (selector de cámara en una fila de cuatro botones iguales); a 320 px no hay desborde horizontal; el eyebrow, el texto de tamaño de pista y el rótulo «Arduino / IROH» se omiten en pantallas ≤ 400 px.
- **Otros:** los textos de 9–10 px de la telemetría pasaron a 11 px o más; en vista apilada solo hay un CTA primario «Ejecutar» (el del editor pasa a estilo secundario).

Tests: `tests/ui-shell.cjs` (función pura, sin acumulación, Escape+Tab, scroll solo apilado, errores) y ampliación de `tests/ui-contract.cjs`.

**Limitaciones conocidas tras PILOT-2:** a 1024×768 la franja de telemetría ocupa dos filas (103 px); el 3D sigue siendo el renderer Canvas procedural (los rótulos «Base izquierda/derecha» del plotter se solapan con las líneas en algunas pistas); el editor es un `<textarea>` sin resaltado de sintaxis; en móvil horizontal (844×390) el robot mide ≈ 44 px.

## 9. PILOT-4 — paridad visual con BITIRO Lab

**Referencia.** La ruta del simulador del Lab en producción exige sesión (`/intermedio/s01` redirige a `/login`), así que se midió el build `dist-e2e` del propio Lab (v8.00.0, la misma versión que producción), servido sin modificar con su `tools/serve.mjs`, y se contrastó con la fuente (`CodeEditor.tsx`, `laboratory.css`, `tokens.css`, `type-floor.css`). Mediciones con Playwright en 1440, 1280, 1024, 768 y 390 px.

**Medidas del Lab trasladadas** (1440 px): toolbar 40 px (`#F7F6F2`), segmentado de cámara con iconos (`#EEF2F3`, borde `#D7DDE0`, botones de 25 px, activo blanco con texto `#09085F`), radio de panel 8 px, panel del simulador con borde `#314652`, proporción simulador/editor 58/42, barra de ejecución ≈ 31 px, editor `#071426` con barra de archivo de 34 px (`#0B1B32`), pie de 46 px con botón secundario (`#262B31`) a la izquierda y «Ejecutar» ocupando el resto, y Monaco a 14 px / 24 px con gutter de 66 px. El Lab aplica un mínimo de 12 px a los controles (`type-floor.css`), igual que el Simulador.

**Diferencias deliberadas.** Sin fila de título ni pestañas curriculares; la telemetría es una franja bajo el canvas (el Lab usa una columna de 238 px, que aquí quitaba ancho al simulador); el zoom queda sobre el canvas (en la toolbar no cabe a 1024 px); y a 1024 px el Simulador mantiene dos columnas (60/40), mientras el Lab apila.

### Editor: técnica
`<textarea>` real (entrada, selección, scroll, teclado, `Escape + Tab`, `Ctrl + Enter`) con el texto transparente **solo** cuando la capa está activa (`.has-hl`; sin JS se ve normal) y, encima, una capa `<pre aria-hidden>` con `pointer-events:none` que pinta el mismo texto coloreado. La selección y el cursor son los nativos del `<textarea>` (la capa queda por encima, así el texto seleccionado conserva su color). La capa se desplaza con `transform` según `scrollTop`/`scrollLeft` y se recorta al área visible; textarea y capa comparten fuente, interlineado, relleno y `tab-size` (14 px / 24 px). El gutter (54 px + 12 px de relleno = 66 px como el Lab) resalta la línea activa y hay un resaltado tenue de línea. Sin dependencias, sin CDN, sin estilos inline (la CSP no cambia).

**Por qué no Monaco.** La paridad visual se consigue sin él: mismos colores, tipografía, interlineado, números de línea, selección y cursor, y alineación comprobada por píxeles (IoU 0,95 con desplazamiento 0,0). Monaco añadiría ≈ 2,3 MB de JS, workers y `style-src 'unsafe-inline'`. Lo que **no** se replica: autocompletado, hover, marcadores de error en línea y guías de sangría (ver limitaciones).

### Colores (tema «bitiro-night» del Lab, medidos en su Monaco)
| Token | Color | Ejemplos |
|---|---|---|
| Función IROH | `#FF9A62` (peso 500) | `avanzar`, `inicializarSensores`, `pausa` |
| Palabra reservada / tipo / `#include` | `#82B6D9` | `void`, `int`, `if`, `true` |
| Cadena y ruta de `#include` | `#9FD4AF` | `"hola"`, `KnightRoboticsLibs_Iroh.h` |
| Comentario | `#A3AAB2` | `// …`, `/* … */` |
| Número | `#F4C07A` | `500`, `3.5` |
| Operador y delimitador | `#DCDCDC` | `= ; , >= && !` |
| Paréntesis, corchetes y llaves | `#FFD700` → `#DA70D6` → `#179FFF` por profundidad; cierre sin abrir `#FF1212` | |
| Texto / variables | `#E8E4DB` | |
| Selección / cursor / línea activa | `#63432E` / `#FFAF75` / `rgba(160,180,210,.07)` | |
| Números de línea | `#8994A2` (activa `#C6C6C6`) | |

**Funciones IROH resaltadas** = exactamente las 33 que reconoce el intérprete (`Object.keys(FN)` de `iroh-runtime.js`, única fuente de verdad): `avanzar`, `retroceder`, `girarDerecha`, `girarIzquierda`, `detenerse`, `pausa`, `finPrograma`, `botonInicio`, `leerSensorLineaIzquierdo`, `leerSensorLineaCentral`, `leerSensorLineaDerecho`, `leerBoton`, `leerDistanciaSonar`, `leerLineaNormalizada`, `leerUmbralLinea`, `lineaIzquierda`, `lineaCentral`, `lineaDerecha`, `leerSensorObstaculoIzquierdo`, `leerSensorObstaculoDerecho`, `escribirPantalla`, `borrarPantalla`, `apagarPantalla`, `prenderPantalla`, `inicializarMovimiento`, `inicializarSensores`, `inicializarCabeza`, `inicializarGolpe`, `inicializarPantalla`, `apagarCabeza`, `moverServoYaw`, `moverServoPitch`, `moverServoGolpe`.

Reglas: solo se colorea una **llamada** (`nombre(`, con espacios opcionales); un nombre sin paréntesis, desconocido o mal escrito (`avansar`, `miFuncion`) conserva el color normal, como en el Lab. **Diferencia con el Lab:** allí una función dentro de un comentario o de una cadena también sale naranja; aquí no. `millis` está en la API del Lab pero no en este intérprete, y `leerLinea`, `leerSonar` y `stroke` no existen en ninguno de los dos: ninguno se colorea.

### LCD
Bisel oscuro (`#2D353C`) con pantalla `#CAD3C2`, retícula tenue de caracteres (16 × 2), texto `IBM Plex Mono` de 12 px y `#243127`. Contenido y semántica 16 × 2 intactos (`<pre id="lcd">` sigue recibiendo exactamente lo que escribe el runtime).

### Resultados medidos (1440 / 1280 / 1024)
| Métrica | Lab | Antes | Después |
|---|---|---|---|
| Alto de toolbar | 40 / 40 / 65 | 45 | 40 |
| Ancho del selector de pista | chip 29 px | 260 / 260 / 220 | 184 / 184 / 150 |
| Proporción simulador/editor | 58/42 · 58/42 · apilado | 62/38 · 60/40 · 60/40 | 58/42 · 58/42 · 60/40 |
| Canvas | 573×602 · 480×424 · 696×457 | 866×636 · 743×456 · 593×470 | 811×636 · 720×456 · 594×483 |
| Telemetría | columna 238 px | 69 · 69 · 103 px | 80 · 80 · 101 px |
| Barra de ejecución | 31 | 43 | 33 |
| Pie del editor | 46 | 51 | 45 |
| Editor (fuente/interlínea) | 14/24 | 13/21,45 | 14/24 |

**Limitaciones.** Sin autocompletado, hover ni marcadores de error en línea (los errores salen en el panel de mensajes); sin guías de sangría ni plegado de código; el cursor es el nativo del navegador (1 px, no 2 px como Monaco); el texto del editor es 14 px y las líneas largas hacen scroll horizontal (como en el Lab); `syntax-highlight.js` es un archivo nuevo que **debe añadirse a la lista de archivos de runtime** en el próximo despliegue.

## 10. NAV-1 — navegación cruzada con BITIRO Lab

> **Actualización `SIM-UI-RELEASE-4` (2026-10-08):** la marca del Simulador ya **no enlaza** a BITIRO Lab: es un `<div class="brand">` sin enlace, foco ni cursor de puntero. El punto «Simulador → Lab» de abajo describe el comportamiento anterior. El panel «Más datos» mencionado en este documento también fue retirado.

- **Lab → Simulador:** en la navegación principal del Lab (`primary-nav`), el enlace «Simulador» va inmediatamente a la derecha de «Inicio» y apunta a `https://simulador.nulljinx.com/`. Es un enlace normal (misma pestaña, sin `target`, sin clase propia, sin estilo de CTA ni estado activo) que hereda la tipografía, el espaciado y el foco de «Inicio». No aparece en la ruta de migas de las sesiones ni en la de los grupos.
- **Simulador → Lab:** la marca completa de la cabecera («BITIRO Simulador / Simulador libre del IROH») enlaza a `https://bitiro-piloto.nulljinx.com/` con `aria-label="BITIRO Simulador: volver a BITIRO Lab"` (el nombre accesible contiene el texto visible). No se añadió ningún botón «Inicio» y la cabecera es idéntica a nivel de píxeles.
- **CSP:** sin cambios. Un enlace de navegación no está regulado por `connect-src`, `script-src`, `form-action` ni `frame-ancestors`; se comprobó con la CSP real de producción (0 violaciones).
- `tests/ui-contract.cjs` fija el destino, el `aria-label`, la ausencia de `target`/`rel`, que la cabecera solo tiene un enlace y que el único URL absoluto de `index.html` es el de la marca.
