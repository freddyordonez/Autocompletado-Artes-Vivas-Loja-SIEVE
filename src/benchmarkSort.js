'use strict';
/**
 * benchmarkSort.js
 * ---------------------------------------------------------------------------
 * Benchmark del algoritmo MergeSort (src/models/MergeSort.js) sobre el dataset
 * data/artes_vivas_loja.json.
 *
 * Qué hace:
 *  1. Carga el dataset y muestra los registros ANTES de ordenar.
 *  2. Ordena con varios criterios y muestra los registros DESPUÉS.
 *  3. Mide, para cada criterio:
 *       - Tiempo de ejecución en milisegundos (ms), con varias repeticiones.
 *       - Memoria heap con process.memoryUsage().heapUsed (inicial, pico y final).
 *       - Número de comparaciones realizadas.
 *  4. Verifica que el resultado esté ordenado y no pierda registros.
 *  5. Mide cómo crece el tiempo al aumentar la cantidad de registros (n log n).
 *
 * Ejecución (desde la carpeta del proyecto):
 *   npm run benchmark
 *   node --expose-gc src/benchmarkSort.js            (recomendado: mediciones de memoria más estables)
 *   node --expose-gc src/benchmarkSort.js --repeticiones 10 --filas 5
 */

const fs = require('node:fs');
const path = require('node:path');
const MergeSort = require('./models/MergeSort');

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const RUTA_DATASET = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');

/** Criterios de ordenamiento a evaluar (todos terminan en "id" para un orden totalmente determinista). */
const CRITERIOS = [
  {
    nombre: 'A) Fecha (más reciente primero) > Nombre A-Z > Id',
    criterios: [{ campo: 'fecha', orden: 'desc' }, { campo: 'nombre_lugar', orden: 'asc' }, 'id'],
  },
  {
    nombre: 'B) Nombre A-Z > Categoría A-Z > Fecha (más reciente primero) > Id',
    criterios: ['nombre_lugar', 'categoria', { campo: 'fecha', orden: 'desc' }, 'id'],
  },
  {
    nombre: 'C) Categoría A-Z > Zona A-Z > Año (más reciente primero) > Nombre A-Z > Id',
    criterios: ['categoria', 'zona', { campo: 'anio', orden: 'desc' }, 'nombre_lugar', 'id'],
  },
];

const TAMANOS_ESCALA = [1000, 5000, 10000, 25000, 50000];
const COLUMNAS_VISTA = ['id', 'fecha', 'nombre_lugar', 'categoria', 'zona'];
const INTERVALO_MUESTREO = 2000; // cada cuántas comparaciones se mide el heap para estimar el pico

// ---------------------------------------------------------------------------
// Argumentos de línea de comandos
// ---------------------------------------------------------------------------
function leerArgumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1 || i + 1 >= process.argv.length) return porDefecto;
  const valor = parseInt(process.argv[i + 1], 10);
  return Number.isInteger(valor) && valor > 0 ? valor : porDefecto;
}
const REPETICIONES = leerArgumento('repeticiones', 5);
const FILAS_VISTA = leerArgumento('filas', 8);

// ---------------------------------------------------------------------------
// Utilidades de medición
// ---------------------------------------------------------------------------

/** Fuerza una recolección de basura si se ejecutó con --expose-gc (mediciones más limpias). */
function limpiarMemoria() {
  if (typeof global.gc === 'function') global.gc();
}

/** Tiempo de una función en milisegundos, con resolución de nanosegundos. */
function medirMs(funcion) {
  const inicio = process.hrtime.bigint();
  const resultado = funcion();
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  return { ms, resultado };
}

const mediana = (valores) => {
  // Se usa el propio MergeSort (no el ordenamiento nativo) para ordenar las mediciones.
  const v = MergeSort.ordenar(valores);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const aMB = (bytes) => bytes / 1024 / 1024;
const fmt = (n, d = 3) => n.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Copia los primeros n registros del dataset (copia manual, sin métodos de ordenamiento). */
function primeros(datos, n) {
  const copia = new Array(n);
  for (let i = 0; i < n; i++) copia[i] = datos[i];
  return copia;
}

/** Envuelve un comparador para contar cuántas veces se llama. */
function contar(comparador) {
  const f = (a, b) => { f.llamadas++; return comparador(a, b); };
  f.llamadas = 0;
  return f;
}

/**
 * Ordena una vez y estima la memoria heap con process.memoryUsage().heapUsed:
 *   inicial = antes de ordenar | pico = máximo visto durante el ordenamiento | final = al terminar.
 * El pico se muestrea cada INTERVALO_MUESTREO comparaciones, por eso es una estimación.
 */
function medirHeap(datos, comparador) {
  limpiarMemoria();
  const inicial = process.memoryUsage().heapUsed;
  let pico = inicial;
  let llamadas = 0;

  const conMuestreo = (a, b) => {
    if (++llamadas % INTERVALO_MUESTREO === 0) {
      const h = process.memoryUsage().heapUsed;
      if (h > pico) pico = h;
    }
    return comparador(a, b);
  };

  const resultado = MergeSort.ordenar(datos, conMuestreo);
  const final = process.memoryUsage().heapUsed; // el resultado sigue referenciado aquí
  if (final > pico) pico = final;
  return { inicial, pico, final, resultado };
}

/** Comprueba que el resultado esté ordenado y sea una permutación del original (mismos ids). */
function verificar(original, resultado, comparador) {
  if (resultado.length !== original.length) return false;
  if (!MergeSort.estaOrdenado(resultado, comparador)) return false;
  const cuenta = new Map();
  for (const r of original) cuenta.set(r.id, (cuenta.get(r.id) || 0) + 1);
  for (const r of resultado) {
    const c = cuenta.get(r.id);
    if (!c) return false;
    cuenta.set(r.id, c - 1);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------
function mostrarMuestra(titulo, datos, campos) {
  console.log(`\n${titulo}`);
  const filas = [];
  for (let i = 0; i < FILAS_VISTA && i < datos.length; i++) {
    const fila = {};
    for (const c of campos) fila[c] = datos[i][c];
    filas.push(fila);
  }
  console.table(filas);
}

function linea(caracter = '=') {
  console.log(caracter.repeat(78));
}

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(RUTA_DATASET) || fs.statSync(RUTA_DATASET).size === 0) {
    console.error(`No se encontró contenido en ${RUTA_DATASET}`);
    process.exit(1);
  }
  const datos = JSON.parse(fs.readFileSync(RUTA_DATASET, 'utf8'));

  linea();
  console.log('  BENCHMARK DE ORDENAMIENTO - MergeSort (implementación propia)');
  console.log('  Dataset: artes_vivas_loja.json (registros sintéticos de lugares reales de Loja)');
  linea();
  console.log(`Registros: ${datos.length.toLocaleString('es-EC')} | Node ${process.version} | Repeticiones: ${REPETICIONES}`);
  if (typeof global.gc !== 'function') {
    console.log('Aviso: sin --expose-gc la memoria varía más entre ejecuciones. Use: npm run benchmark');
  }

  mostrarMuestra(`ANTES de ordenar (primeros ${FILAS_VISTA} registros, orden original del archivo):`, datos, COLUMNAS_VISTA);

  // Calentamiento: deja que el motor optimice el código antes de medir.
  MergeSort.ordenar(primeros(datos, 5000), MergeSort.crearComparador(CRITERIOS[0].criterios));

  const resumen = [];
  for (const caso of CRITERIOS) {
    const comparador = MergeSort.crearComparador(caso.criterios);

    // 1) Tiempo: varias repeticiones sin muestreo de memoria para no alterar el resultado.
    const tiempos = [];
    let ordenado = null;
    for (let r = 0; r < REPETICIONES; r++) {
      limpiarMemoria();
      const m = medirMs(() => MergeSort.ordenar(datos, comparador));
      tiempos.push(m.ms);
      ordenado = m.resultado;
    }

    // 2) Comparaciones: una pasada con el comparador envuelto.
    const contador = contar(comparador);
    MergeSort.ordenar(datos, contador);

    // 3) Memoria heap: una pasada con muestreo de process.memoryUsage().heapUsed.
    const heap = medirHeap(datos, comparador);

    const correcto = verificar(datos, ordenado, comparador);

    linea('-');
    console.log(caso.nombre);
    mostrarMuestra(`DESPUÉS de ordenar (primeros ${FILAS_VISTA} registros):`, ordenado, COLUMNAS_VISTA);
    console.log(`Tiempo (ms):  mediana ${fmt(mediana(tiempos))} | mín ${fmt(Math.min(...tiempos))} | máx ${fmt(Math.max(...tiempos))}`);
    console.log(`Heap usado (heapUsed):  inicial ${fmt(aMB(heap.inicial))} MB | pico ${fmt(aMB(heap.pico))} MB | final ${fmt(aMB(heap.final))} MB`);
    console.log(`Memoria adicional (pico - inicial): ${fmt(aMB(heap.pico - heap.inicial))} MB`);
    console.log(`Comparaciones: ${contador.llamadas.toLocaleString('es-EC')}`);
    console.log(`Verificación (ordenado y sin perder registros): ${correcto ? 'CORRECTA' : 'FALLÓ'}`);

    resumen.push({
      criterio: caso.nombre.slice(0, 2),
      'tiempo mediana (ms)': Number(mediana(tiempos).toFixed(3)),
      'heap inicial (MB)': Number(aMB(heap.inicial).toFixed(2)),
      'heap pico (MB)': Number(aMB(heap.pico).toFixed(2)),
      'heap final (MB)': Number(aMB(heap.final).toFixed(2)),
      comparaciones: contador.llamadas,
      verificado: correcto ? 'sí' : 'NO',
    });
    if (!correcto) process.exitCode = 1;
  }

  linea();
  console.log(`RESUMEN con ${datos.length.toLocaleString('es-EC')} registros`);
  console.table(resumen);

  // Escalabilidad: n log2(n) es la cantidad teórica de comparaciones de Merge Sort.
  linea();
  console.log('ESCALABILIDAD (criterio A): las comparaciones deben crecer como n·log2(n); la razón se mantiene casi constante');
  const cmpA = MergeSort.crearComparador(CRITERIOS[0].criterios);
  const escala = [];
  for (const n of TAMANOS_ESCALA) {
    if (n > datos.length) continue;
    const parte = primeros(datos, n);
    const tiempos = [];
    for (let r = 0; r < REPETICIONES; r++) {
      limpiarMemoria();
      tiempos.push(medirMs(() => MergeSort.ordenar(parte, cmpA)).ms);
    }
    const contador = contar(cmpA);
    MergeSort.ordenar(parte, contador);
    escala.push({
      registros: n,
      'tiempo mediana (ms)': Number(mediana(tiempos).toFixed(3)),
      comparaciones: contador.llamadas,
      'n·log2(n)': Math.round(n * Math.log2(n)),
      'comparaciones / (n·log2 n)': Number((contador.llamadas / (n * Math.log2(n))).toFixed(3)),
      'µs por comparación': Number(((mediana(tiempos) * 1000) / contador.llamadas).toFixed(3)),
    });
  }
  console.table(escala);
  linea();
}

main();
