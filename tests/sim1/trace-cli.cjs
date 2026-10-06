/* Proceso limpio: imprime la traza JSON de un escenario (uso: node trace-cli.cjs <nombre>). */
'use strict';
const {S}=require('./scenarios.cjs');
process.stdout.write(JSON.stringify(S[process.argv[2]]()));
