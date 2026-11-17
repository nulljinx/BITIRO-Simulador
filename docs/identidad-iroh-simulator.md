# Identidad de IROH Simulator

> **Estado:** criterios de SIM-IROH-UI-1 (preparada, no desplegada). Este documento fija el nombre, el crédito y las reglas de uso de la mascota. **No** registra el documento de autorización institucional ni su alcance: solo deja constancia de que el responsable declara contar con ella.

## Nombre

- Nombre visible del producto: **IROH Simulator** (cabecera, título de pestaña, «Acerca de», rótulo de escena, encabezado del código inicial, `404.html`).
- Subtítulo: **Simulador libre** (sin «del IROH», que pasó al nombre). Visible desde 768 px.
- Hasta SIM-NOFIRVI-1 el producto se llamaba «BITIRO Simulador». Ese nombre se conserva, **sin reescribir**, en los registros de release, en las cabeceras de los archivos de código (procedencia: BITIRO Lab) y en el nombre del repositorio `BITIRO-Simulador`.
- «IROH» designa al robot educativo simulado. La mascota es un **personaje guía** de la experiencia educativa; no pretende ser una reproducción exacta del robot físico.

## Qué se renombró y qué no

| Se renombró (visible al estudiante) | No se renombró (a propósito) |
|---|---|
| `index.html`: título, marca de la cabecera, rótulo «IROH / S0X / 3D», texto de respaldo de la escena | Identificadores `window.BITIRO_*` y toda la API interna |
| `pages/404.html`: título | Claves de `localStorage`: `bitiro:standalone:code:*`, `bitiro:standalone:scenario:v1:*`, `bitiro:line-calibration:v1` |
| `starters.js`: encabezado del **código inicial nuevo** («// IROH Simulator · …») | Código ya guardado por el alumno (jamás se reescribe) |
| `README.md`, `LEEME.md`, `INICIO-RAPIDO.txt`: título y primera descripción | Cabeceras de archivo («/* BITIRO Simulador · … */»), referencias a BITIRO Lab, `docs/release-*.md` y `docs/pilot-ui-reference.md` |

### Código guardado y código inicial

- El starter anterior (encabezado «// BITIRO Simulador · …») sigue reconocido **exactamente** como no modificado (`isModified` = `false`), de modo que «Restaurar código inicial» no pide confirmación sin motivo.
- `resolve()` no cambia: devuelve el código guardado carácter por carácter, incluido un starter antiguo. No se añade nada a la lista `LEGACY` (eso reescribiría código del alumno).
- Cualquier diferencia de un solo carácter respecto de un starter hace que el código se trate como del alumno.

## Persistencia añadida

Una sola clave nueva: `bitiro:standalone:welcome:v1` (valor `"1"`), escrita al cerrar la bienvenida por cualquier vía, mediante `window.BITIRO_STORAGE`. Si el almacenamiento falla, la bienvenida no se abre sola y sigue disponible desde «Bienvenida» (≥ 768 px) y desde «Acerca de».

## Crédito

«Desarrollado por **nulljinx**», enlazado a `https://nulljinx.com` (`target="_blank"`, `rel="noopener noreferrer"`). Aparece en el pie de la bienvenida (oculto en pantallas pequeñas) y siempre en «Acerca de», que es el acceso para móviles.

## La mascota, su procedencia y las instituciones

### Qué se usa
La **mascota aprobada** (robot azul, ojos luminosos, chaqueta con la inscripción «FUNDACIÓN MUSTAKIS», ruedas amarillas, mano levantada) en tres resoluciones (`assets/iroh-mascot-420/640/960.webp`), más un **isotipo** y tres **favicons** que son recortes de su cabeza, sin chaqueta ni inscripción. No se sustituye por otra mascota ni se crea, por ahora, una variante sin inscripción.

### Procedencia de la ilustración
La ilustración original **fue generada con ChatGPT** (modelo de imagen `gpt-image`, vía OpenAI Media Service), según las credenciales de contenido C2PA firmadas que lleva el archivo original: tipo de origen `trainedAlgorithmicMedia`, creada el 2026-11-16 (18:42:23 UTC).
- Archivo original (se conserva **fuera** del repositorio, sin alterar): SHA-256 `b9dd463b406ff870332b142c5654e185c0597eec42fe7c10c83bd55155e85378`.
- Las derivadas del repositorio se re-encodificaron (recorte, transparencia, optimización) y **no conservan** esas credenciales.

### Origen de la ilustración y titularidad de las marcas
Son cuestiones distintas y no se confunden:
- **Origen de la ilustración:** generada con una herramienta de IA, como se indica arriba. El repositorio **no resuelve ni afirma** la titularidad de los derechos sobre la ilustración generada; ese punto lo documenta el responsable del proyecto.
- **Marcas e identidad institucional:** el nombre y la inscripción «FUNDACIÓN MUSTAKIS» pertenecen a un tercero. El responsable del proyecto **declara contar con la autorización** de Fundación Mustakis para utilizar su identidad en este proyecto. Este repositorio **no incluye ese documento ni ha comprobado su alcance**, y no se registran aquí entidad firmante, fecha, referencia ni condiciones.

### Lo que NO se afirma
- No se afirma alianza, patrocinio, colaboración ni aprobación oficial de ninguna institución distintos de la autorización de uso de identidad que declara el responsable.
- La interfaz no menciona a la Fundación fuera de la inscripción de la propia mascota.

### Licencia
Los assets de la mascota (incluidos el isotipo y los favicons) **no se publican bajo ninguna licencia abierta**. El repositorio sigue sin declarar una licencia de software propia (ver `README.md`), y los recursos de terceros conservan sus derechos. Que el repositorio sea público permite verlo y, según las condiciones de GitHub, bifurcarlo; eso **no** concede permiso de reutilizar la mascota ni la identidad institucional.

### Condición para la publicación pública
Antes de subir esta rama, abrir un Pull Request o desplegar, el responsable debe confirmar que el permiso cubre:
1. el **sitio web** público (`simulador.nulljinx.com` y sus redirecciones);
2. el **repositorio público**, incluida la visibilidad, los forks y los clones;
3. la incorporación de los **derivados** (isotipo, favicons y optimizaciones de la mascota).

Mientras eso no se confirme, la rama es solo local: los siete recursos ya están en commits locales y no deben salir del equipo.

## Tipografía y color

Sin cambios: IBM Plex local y la paleta de `tokens.css`. El simulador conserva su interfaz clara y sus paneles oscuros (escena, editor). La bienvenida es oscura y usa el amarillo de las ruedas **solo** para su acción principal; el resto de la interfaz mantiene el índigo actual.
