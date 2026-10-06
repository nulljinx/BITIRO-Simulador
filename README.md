# BITIRO Simulador

Simulador web libre del robot educativo **IROH**, desarrollado como parte del ecosistema BITIRO.

**Probar en línea:** https://simulador.nulljinx.com  
**Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  
**BITIRO Lab:** https://bitiro-piloto.nulljinx.com/

---

## ¿Qué es BITIRO Simulador?

BITIRO Simulador es un entorno web para **programar, observar y experimentar** con un robot IROH desde el navegador.

La idea central del proyecto es:

> **El simulador reproduce el robot y su entorno; no resuelve la actividad por el estudiante.**

Si el programa indica avanzar, el robot intenta avanzar.  
Si gira fuera de la línea, se sale de la línea.  
Si una condición está mal programada, el comportamiento también será incorrecto.

La intención es que estudiantes puedan:

**probar → observar → equivocarse → modificar → volver a intentar**

No requiere iniciar sesión ni un backend para ejecutar la simulación.

---

## Probar ahora

Abre:

**https://simulador.nulljinx.com**

Selecciona una pista, escribe o modifica el programa y pulsa **Ejecutar**.

El editor utiliza un subconjunto de sintaxis Arduino/C++ y funciones del robot IROH.

Ejemplo:

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
}

void loop() {
    avanzar(30);
}
