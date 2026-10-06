# BITIRO Simulador

Simulador web libre del robot educativo **IROH**, desarrollado como parte del ecosistema BITIRO.

🌐 **Simulador:** https://simulador.nulljinx.com  
📦 **Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  
🎓 **BITIRO Lab:** https://bitiro-piloto.nulljinx.com/

---

## ¿Qué es BITIRO Simulador?

BITIRO Simulador permite programar, observar y experimentar con un robot IROH desde el navegador.

La idea central es simple:

> **El simulador reproduce el robot y su entorno; no resuelve la actividad por el estudiante.**

Si el programa indica avanzar, el robot intenta avanzar.  
Si gira fuera de la línea, se sale de la línea.  
Si una condición está mal programada, el comportamiento también será incorrecto.

El objetivo es que estudiantes puedan **probar, observar, equivocarse, modificar y volver a intentar**.

No requiere iniciar sesión y funciona completamente en el navegador.

---

## Probar ahora

👉 https://simulador.nulljinx.com

Selecciona una pista, escribe o modifica el programa y pulsa **Ejecutar**.

El editor utiliza una sintaxis inspirada en Arduino y en las funciones utilizadas por el robot IROH.

Ejemplo:

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
}

void loop() {
    avanzar(30);
}
