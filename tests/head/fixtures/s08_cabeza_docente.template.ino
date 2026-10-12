// BITIRO · S08 «Clasificatoria» · solución de REFERENCIA PARA DOCENTES con cabeza móvil (HEAD-SONAR-POC-1)
// Corregida para la posición inicial publicada (track.start de S08): no llama a salirDeLaBase().
// Usa moverServoYaw() de la cabeza EXPERIMENTAL: el cuerpo NO gira para mirar las cajas.
// Los nombres de las funciones son una propuesta de lo que escribe el estudiante; el simulador no los conoce.
// Los números marcados con (*) se calibran UNA VEZ por versión del robot/simulador (ver CALIBRACION.md).
#include <KnightRoboticsLibs_Iroh.h>

// ---------- Parámetros ----------
int v = {{V}};                       // velocidad al seguir la línea
int acercar = {{ACERCAR}};           // (*) ms que avanza desde que ve el hueco hasta quedar al lado de las cajas
int centrar = {{CENTRAR}};           // (*) ms que avanza para quedar sobre el cruce
int entrar = {{ENTRAR}};             // (*) ms que avanza para entrar a la base
int esperaCabeza = {{ESPERA}};       // (*) ms que espera a que la cabeza llegue (giro máximo 0°→180°). PARÁMETRO VIRTUAL PROVISIONAL: SIN MEDIR en el robot real
int limite = {{LIMITE}};             // el sonar mide menos que esto → hay una caja (cm)

// Posiciones de la cabeza (según el material de S07)
int DERECHA = 0;
int FRENTE = 90;
int IZQUIERDA = 180;

// ---------- Memoria del robot ----------
int cajas = 0;                       // cajas contadas
int gaps = 0;                        // huecos ya revisados
int linea = 0;                       // 1 = línea A, 2 = línea B
int base = 0;                        // base a la que debe llegar

// ---------- Sensores de línea ----------
bool barra() {
  return lineaIzquierda() && lineaCentral() && lineaDerecha();
}

bool hueco() {
  return !lineaIzquierda() && !lineaCentral() && !lineaDerecha();
}

void seguirLinea() {
  bool izq = lineaIzquierda();
  bool centro = lineaCentral();
  bool der = lineaDerecha();
  if (centro) {
    avanzar(v);
  } else if (izq) {
    avanzar(v / 3, v);
  } else if (der) {
    avanzar(v, v / 3);
  } else {
    avanzar(v);
  }
}

void salirDeLaBarra() {
  while (barra()) {
    seguirLinea();
  }
}

// ---------- Cajas: el robot NO se mueve, solo la cabeza ----------
void mirar(int posicion) {
  moverServoYaw(posicion);
  pausa(esperaCabeza);               // el servo necesita tiempo para llegar
}

void contarCajas() {                 // se llama con la cabeza ya en su posición
  if (leerDistanciaSonar() < limite) {
    cajas = cajas + 1;
  }
}

void revisarIzquierda() {
  mirar(IZQUIERDA);
  contarCajas();
}

void revisarDerecha() {
  mirar(DERECHA);
  contarCajas();
}

void revisarGap() {
  detenerse();
  if (gaps < 2) {
    gaps = gaps + 1;
    avanzar(v);
    pausa(acercar);                  // queda el sonar al lado de las cajas
    detenerse();
    revisarIzquierda();
    revisarDerecha();
    mirar(FRENTE);
  }
  avanzar(v);                        // cruza el hueco
  while (hueco()) {
  }
}

// ---------- Cruces ----------
void hastaLaBarra() {
  while (!barra()) {
    if (hueco()) {
      revisarGap();
    } else {
      seguirLinea();
    }
  }
}

void bifurcacion() {                 // UNA vez por cada bifurcación encontrada
  detenerse();
  pausa(1000);
}

void siguienteBifurcacion() {
  salirDeLaBarra();
  hastaLaBarra();
  bifurcacion();
}

void girarSobreElCruce(int lado) {   // lado 0 = izquierda, 1 = derecha
  avanzar(v);
  pausa(centrar);
  detenerse();
  if (lado == 0) {
    girarIzquierda(25);
  } else {
    girarDerecha(25);
  }
  pausa(300);                        // gira un poco
  while (lineaCentral()) {           // hasta salir de la línea actual
  }
  pausa(200);                        // se aleja un poco más del borde
  while (!lineaCentral()) {          // y sigue girando hasta encontrar la siguiente
  }
  detenerse();
}

// ---------- Elegir ruta con los IR ----------
void elegirRuta() {
  while (leerSensorObstaculoIzquierdo() == 1 || leerSensorObstaculoDerecho() == 1) {
    pausa(10);                       // primero deben estar libres: se espera una activación NUEVA
  }
  while (leerSensorObstaculoIzquierdo() == leerSensorObstaculoDerecho()) {
    pausa(10);                       // luego, exactamente un IR activo (ambos activos = no elegir)
  }
  if (leerSensorObstaculoIzquierdo() == 1) {
    linea = 1;                       // IR izquierdo → línea A
  } else {
    linea = 2;                       // IR derecho → línea B
  }
}

// ---------- LCD ----------
void mostrarCajas() {
  borrarPantalla();
  escribirPantalla(0, 0, "Cajas:");
  escribirPantalla(7, 0, cajas);
}

void mostrarLinea() {
  escribirPantalla(0, 1, "Linea:");
  if (linea == 1) {
    escribirPantalla(7, 1, "A");
  } else {
    escribirPantalla(7, 1, "B");
  }
}

void mostrarBase() {
  borrarPantalla();
  escribirPantalla(0, 0, "Base:");
  escribirPantalla(6, 0, base);
}

// ---------- Programa ----------
void setup() {
  inicializarMovimiento();
  inicializarSensores();
  inicializarPantalla();
  inicializarCabeza();
  mirar(FRENTE);
  botonInicio();
}

void loop() {
  // La posición inicial publicada ya está DESPUÉS de la barra inicial: el robot sigue la línea desde el primer instante.
  hastaLaBarra();                    // pasa los dos gaps (cuenta las cajas) y llega a la primera intersección
  detenerse();
  base = cajas;
  mostrarCajas();

  if (cajas == 0) {
    escribirPantalla(0, 1, "SIN CAJAS");
    finPrograma();
  }

  elegirRuta();                      // primero: espera una activación NUEVA y exclusiva de un IR
  mostrarLinea();
  bifurcacion();                     // después: 1 s de parada en la primera intersección

  if (base == 2) {
    siguienteBifurcacion();          // segundo cruce: sigue recto por el tronco
    salirDeLaBarra();
    hastaLaBarra();                  // barra de la base: no es una bifurcación
  } else {
    int cruce = 1;
    while (cruce < linea) {
      siguienteBifurcacion();
      cruce = cruce + 1;
    }
    int lado = 0;
    if (base > 2) {
      lado = 1;
    }
    girarSobreElCruce(lado);
    int columnas = 1;
    if (base == 4) {
      columnas = 2;
    }
    salirDeLaBarra();
    while (columnas > 0) {
      hastaLaBarra();
      bifurcacion();
      columnas = columnas - 1;
      if (columnas > 0) {
        salirDeLaBarra();
      }
    }
    girarSobreElCruce(1 - lado);     // sube hacia la base
    salirDeLaBarra();
    if (linea == 1) {                // viene de A: cruza B antes de la base
      hastaLaBarra();
      bifurcacion();
      salirDeLaBarra();
    }
    hastaLaBarra();                  // barra de la base: no es una bifurcación
  }

  avanzar(v);
  pausa(entrar);
  detenerse();
  mostrarBase();
  finPrograma();
}
