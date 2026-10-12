#include <KnightRoboticsLibs_Iroh.h>

// SESION 08 - CLASIFICATORIA
// Contar cajas y llegar a la base correcta

int cajas = 0;
int huecos = 0;
int ruta = 0;

// 1. REVISAR LOS SENSORES

bool hayBarra() {
  return lineaIzquierda() &&
         lineaCentral() &&
         lineaDerecha();
}

bool hayHueco() {
  return !lineaIzquierda() &&
         !lineaCentral() &&
         !lineaDerecha();
}

// 2. SEGUIR LA LINEA

void seguirLinea() {
  if (lineaCentral()) {
    avanzar(30);
  }
  else if (lineaIzquierda()) {
    avanzar(10, 30);
  }
  else if (lineaDerecha()) {
    avanzar(30, 10);
  }
  else {
    avanzar(30);
  }
}

// 3. MIRAR Y CONTAR UNA CAJA

void mirarCaja(int angulo) {
  moverServoYaw(angulo);
  pausa(1200);

  if (leerDistanciaSonar() < 20) {
    cajas++;
  }
}

// 4. REVISAR CADA HUECO

void revisarHueco() {
  detenerse();

  if (huecos < 2) {
    huecos++;

    avanzar(30);
    pausa(1000);
    detenerse();

    // Mirar izquierda
    mirarCaja(180);

    // Mirar derecha
    mirarCaja(0);

    // Volver al frente
    moverServoYaw(90);
    pausa(1200);
  }

  avanzar(30);

  while (hayHueco()) {
  }
}

// 5. AVANZAR HASTA UNA BARRA

void buscarBarra() {
  while (!hayBarra()) {
    if (hayHueco()) {
      revisarHueco();
    }
    else {
      seguirLinea();
    }
  }
}

void salirDeBarra() {
  while (hayBarra()) {
    seguirLinea();
  }
}

void siguienteCruce() {
  salirDeBarra();
  buscarBarra();
  detenerse();
  pausa(1000);
}

// 6. GIRAR EN UN CRUCE

// 0 = izquierda
// 1 = derecha

void girar(int lado) {
  avanzar(30);
  pausa(1075);
  detenerse();

  if (lado == 0) {
    girarIzquierda(25);
  }
  else {
    girarDerecha(25);
  }

  pausa(300);

  while (lineaCentral()) {
  }

  pausa(200);

  while (!lineaCentral()) {
  }

  detenerse();
}

// 7. PREPARAR EL ROBOT

void setup() {
  inicializarMovimiento();
  inicializarSensores();
  inicializarPantalla();
  inicializarCabeza();

  moverServoYaw(90);
  pausa(1200);

  botonInicio();
}

// 8. RESOLVER EL DESAFIO

void loop() {

  // PASO 1: Contar las cajas

  buscarBarra();
  detenerse();

  borrarPantalla();
  escribirPantalla(0, 0, "Cajas:");
  escribirPantalla(7, 0, cajas);

  if (cajas == 0) {
    escribirPantalla(0, 1, "SIN CAJAS");
    finPrograma();
  }

  // PASO 2: Elegir la ruta A o B

  // Esperar que los IR esten apagados
  while (
    leerSensorObstaculoIzquierdo() == 1 ||
    leerSensorObstaculoDerecho() == 1
  ) {
    pausa(10);
  }

  // Esperar que activen uno
  while (
    leerSensorObstaculoIzquierdo() ==
    leerSensorObstaculoDerecho()
  ) {
    pausa(10);
  }

  if (leerSensorObstaculoIzquierdo() == 1) {
    ruta = 1;
    escribirPantalla(0, 1, "Linea: A");
  }
  else {
    ruta = 2;
    escribirPantalla(0, 1, "Linea: B");
  }

  detenerse();
  pausa(1000);

  // PASO 3: Buscar la base

  if (cajas == 2) {

    // Base 2: seguir por el centro
    siguienteCruce();
    salirDeBarra();
    buscarBarra();

  }
  else {

    // Elegir el cruce segun la ruta
    int paso = 1;

    while (paso < ruta) {
      siguienteCruce();
      paso++;
    }

    // Bases 1 y 3: una direccion
    // Base 4: dos cruces laterales

    if (cajas > 2) {
      girar(1);
    }
    else {
      girar(0);
    }

    int cruces = 1;

    if (cajas == 4) {
      cruces = 2;
    }

    salirDeBarra();

    while (cruces > 0) {
      buscarBarra();
      detenerse();
      pausa(1000);

      cruces--;

      if (cruces > 0) {
        salirDeBarra();
      }
    }

    // Volver hacia las bases

    if (cajas > 2) {
      girar(0);
    }
    else {
      girar(1);
    }

    salirDeBarra();

    if (ruta == 1) {
      buscarBarra();
      detenerse();
      pausa(1000);
      salirDeBarra();
    }

    buscarBarra();
  }

  // PASO 4: Entrar a la base

  avanzar(30);
  pausa(1800);
  detenerse();

  borrarPantalla();
  escribirPantalla(0, 0, "Base:");
  escribirPantalla(6, 0, cajas);

  finPrograma();
}
