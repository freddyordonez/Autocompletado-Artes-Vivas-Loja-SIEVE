'use strict';
/**
 * benchmarkBusqueda.js
 * ---------------------------------------------------------------------------
 * Prueba de estrés: búsqueda SECUENCIAL O(n) vs búsqueda BINARIA O(log n).
 *
 * Experimentos:
 *   1) Arreglo en memoria, búsqueda exacta por `id` (clave única).
 *        - Caso promedio (ids que existen), peor caso para la secuencial (id que no existe)
 *          y mejor caso para la secuencial (el id está en la primera posición).
 *        - Se incluye el COSTO DE ORDENAR (MergeSort) y el punto de equilibrio:
 *          cuántas consultas hacen falta para que ordenar "se pague solo".
 *   2) Arreglo en memoria, conteo por `nombre_lugar` (valores repetidos):
 *        recorrido completo O(n) vs rango binario O(log n).
 *   3) Archivo indexado en disco: lectura secuencial del archivo de datos vs
 *        búsqueda binaria sobre el índice .idx (ver models/ArchivoIndexado.js).
 *
 * Métricas por consulta:
 *   - Tiempo (µs) con process.hrtime.bigint()
 *   - Comparaciones (medida independiente del computador)
 *   - Tiempo de CPU (µs) con process.cpuUsage() y ciclos estimados
 *       (ciclos ≈ tiempo de CPU × frecuencia nominal del procesador; es una ESTIMACIÓN)
 *   - Memoria: process.memoryUsage().heapUsed
 *   - En archivo: lecturas a disco y bytes leídos
 *
 * Ejecución:
 *   npm run benchmark:busqueda
 *   node --expose-gc src/benchmarkBusqueda.js --tamanos 1000,10000,100000 --consultas 300
 *
 * Opciones:
 *   --tamanos  lista de tamaños separados por coma   (por defecto 1000,5000,10000,50000,100000,500000)
 *   --consultas  consultas por prueba                (por defecto 200)
 *   --repeticiones  repeticiones de cada medición    (por defecto 3)
 *   --archivo-max  tamaño máximo de la prueba en archivo (por defecto 100000)
 *   --sin-archivo  omite el experimento 3
 *   --conservar    deja los archivos .ndjson/.idx en data/indexado/ para inspeccionarlos
 *   --sin-informe  no escribe resultados/busqueda_resultados.md
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const MergeSort = require('./models/MergeSort');
const Busqueda = require('./models/Busqueda');
const ArchivoIndexado = require('./models/ArchivoIndexado');

// ---------------------------------------------------------------------------
// Configuración y argumentos
// ---------------------------------------------------------------------------
const RUTA_DATASET = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');
const CARPETA_INDEXADO = path.join(__dirname, '..', 'data', 'indexado');
const CARPETA_RESULTADOS = path.join(__dirname, '..', 'resultados');
const MIN_MS_LOTE = 10; // cada medición dura al menos 10 ms para superar el ruido del reloj

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : porDefecto;
}
const bandera = (nombre) => process.argv.includes(`--${nombre}`);
const entero = (texto, porDefecto) => {
  const v = parseInt(texto, 10);
  return Number.isInteger(v) && v > 0 ? v : porDefecto;
};

const TAMANOS = String(argumento('tamanos', '1000,5000,10000,50000,100000,500000'))
  .split(',').map((x) => entero(x.trim(), 0)).filter((x) => x > 0);
const CONSULTAS = entero(argumento('consultas', 200), 200);
const REPETICIONES = entero(argumento('repeticiones', 3), 3);
const ARCHIVO_MAX = entero(argumento('archivo-max', 100000), 100000);
const SIN_ARCHIVO = bandera('sin-archivo');
const CONSERVAR = bandera('conservar');
const SIN_INFORME = bandera('sin-informe');
const MHZ = (os.cpus()[0] && os.cpus()[0].speed) || 0; // frecuencia nominal; 0 si el sistema no la informa

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const limpiarMemoria = () => { if (typeof global.gc === 'function') global.gc(); };
const mediana = (v) => { const o = MergeSort.ordenar(v); const m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const mb = (bytes) => bytes / 1024 / 1024;
const redondear = (x, d = 2) => Number(x.toFixed(d));
const fmt = (x) => x.toLocaleString('es-EC', { maximumFractionDigits: 3 }); // formato español: 1.234,5
const miles = (x, d = 0) => x.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d });
const linea = (c = '=') => console.log(c.repeat(86));

function crearAleatorio(semilla) { // generador con semilla: mismas consultas en cada ejecución
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Devuelve n registros. Hasta 50 000 usa los reales; si se piden más, se clonan
 * registros reales con ids nuevos (LOJ-50001, LOJ-50002...) y se mezclan.
 */
function generarRegistros(base, n) {
  const salida = new Array(n);
  let maximo = 0;
  for (const r of base) { const v = parseInt(r.id.slice(4), 10); if (v > maximo) maximo = v; }
  for (let i = 0; i < n; i++) {
    if (i < base.length) salida[i] = base[i];
    else salida[i] = { ...base[i % base.length], id: 'LOJ-' + String(maximo + (i - base.length) + 1).padStart(5, '0') };
  }
  if (n > base.length) { // mezcla Fisher-Yates para que el orden no favorezca a ningún método
    const azar = crearAleatorio(2026);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); const t = salida[i]; salida[i] = salida[j]; salida[j] = t; }
  }
  return salida;
}

/**
 * Mide el costo POR CONSULTA de `buscar` sobre una lista de consultas.
 * Si un lote es muy corto se repite varias veces hasta durar >= MIN_MS_LOTE.
 * @returns {{us:number, cpuUs:number, comparaciones:number}} medianas por consulta
 */
function medirPorConsulta(buscar, consultas, repeticiones) {
  const Q = consultas.length;
  const lote = (vueltas) => { for (let v = 0; v < vueltas; v++) for (let i = 0; i < Q; i++) buscar(consultas[i]); };

  let t0 = process.hrtime.bigint();
  lote(1); // calentamiento y calibración
  const ms1 = Number(process.hrtime.bigint() - t0) / 1e6;
  const vueltas = ms1 >= MIN_MS_LOTE ? 1 : Math.min(20000, Math.ceil(MIN_MS_LOTE / Math.max(ms1, 0.0005)));

  const tiempos = [];
  const cpus = [];
  for (let r = 0; r < repeticiones; r++) {
    const cpu0 = process.cpuUsage();
    t0 = process.hrtime.bigint();
    lote(vueltas);
    const dt = Number(process.hrtime.bigint() - t0) / 1e3; // µs
    const cpu = process.cpuUsage(cpu0);
    tiempos.push(dt / (vueltas * Q));
    cpus.push((cpu.user + cpu.system) / (vueltas * Q));
  }

  Busqueda.reiniciar();
  lote(1);
  return { us: mediana(tiempos), cpuUs: mediana(cpus), comparaciones: Busqueda.comparaciones / Q };
}

/** Texto claro de quién gana y por cuántas veces (la secuencial puede ganar en el mejor caso). */
const ganador = (usSecuencial, usBinaria) => {
  const r = usSecuencial / usBinaria;
  return r >= 1 ? `binaria ${miles(r, 1)} veces` : `secuencial ${miles(1 / r, 1)} veces`;
};

const ciclos = (cpuUs) => (MHZ > 0 ? Math.round(cpuUs * MHZ) : null); // µs × (ciclos/µs)

/**
 * Calentamiento: ejecuta las búsquedas muchas veces con datos pequeños para que el motor de
 * JavaScript (V8) las optimice ANTES de medir. Sin esto, el primer tamaño sale distorsionado.
 */
function calentar(base) {
  const registros = generarRegistros(base, 2000);
  const ordenado = MergeSort.ordenar(registros, MergeSort.crearComparador(['id']));
  const porNombre = MergeSort.ordenar(registros, MergeSort.crearComparador(['nombre_lugar', 'id']));
  for (let i = 0; i < 30000; i++) {
    const id = registros[i % registros.length].id;
    Busqueda.secuencial(registros, 'id', id);
    Busqueda.binaria(ordenado, 'id', id);
    Busqueda.binaria(ordenado, 'id', 'SIN-REGISTRO');
    if (i % 10 === 0) {
      Busqueda.contarSecuencial(registros, 'nombre_lugar', registros[i % 50].nombre_lugar);
      Busqueda.rango(porNombre, 'nombre_lugar', registros[i % 50].nombre_lugar);
    }
  }
  Busqueda.reiniciar();
}

// ---------------------------------------------------------------------------
// Resultados acumulados (para consola y para el informe .md)
// ---------------------------------------------------------------------------
const informe = [];
function tabla(titulo, filas, nota) {
  // Los números se muestran en formato español (1.234,5) tanto en consola como en el informe.
  const legibles = filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'number' ? fmt(v) : v])));
  console.log(`\n${titulo}`);
  console.table(legibles);
  if (nota) console.log(nota);
  informe.push({ titulo, filas: legibles, nota });
}

function filaMarkdown(valores) { return '| ' + valores.join(' | ') + ' |'; }
function tablaMarkdown(filas) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  return [filaMarkdown(cols), filaMarkdown(cols.map(() => '---')), ...filas.map((f) => filaMarkdown(cols.map((c) => String(f[c]))))].join('\n');
}

// ---------------------------------------------------------------------------
// Experimento 1: búsqueda exacta por id en memoria
// ---------------------------------------------------------------------------
function experimentoMemoria(base) {
  const promedio = [];
  const peor = [];
  const mejor = [];
  const resumen = [];
  let verificado = true;

  for (const n of TAMANOS) {
    const registros = generarRegistros(base, n);

    // Índice ordenado por id (costo único): se mide tiempo y heapUsed.
    const cmpId = MergeSort.crearComparador(['id']);
    limpiarMemoria();
    const heap0 = process.memoryUsage().heapUsed;
    const tiemposOrden = [];
    let ordenado = null;
    const vecesOrden = n <= 100000 ? REPETICIONES : 1;
    for (let r = 0; r < vecesOrden; r++) {
      const t0 = process.hrtime.bigint();
      ordenado = MergeSort.ordenar(registros, cmpId);
      tiemposOrden.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const heap1 = process.memoryUsage().heapUsed;
    const msOrdenar = mediana(tiemposOrden);

    // Consultas: ids que existen, ids que no existen y el id de la primera posición.
    const azar = crearAleatorio(n);
    const existentes = [];
    const inexistentes = [];
    for (let i = 0; i < CONSULTAS; i++) {
      existentes.push(registros[Math.floor(azar() * n)].id);
      inexistentes.push('SIN-REGISTRO-' + i);
    }
    const primeros = new Array(CONSULTAS).fill(registros[0].id);

    // Verificación: las dos búsquedas deben dar el mismo registro.
    for (const v of [...existentes.slice(0, 50), ...inexistentes.slice(0, 20), registros[0].id]) {
      const a = Busqueda.secuencial(registros, 'id', v);
      const b = Busqueda.binaria(ordenado, 'id', v);
      if (a === -1 ? b !== -1 : (b === -1 || ordenado[b].id !== registros[a].id)) verificado = false;
    }

    const seq = (v) => Busqueda.secuencial(registros, 'id', v);
    const bin = (v) => Busqueda.binaria(ordenado, 'id', v);
    const caso = (consultas) => ({ s: medirPorConsulta(seq, consultas, REPETICIONES), b: medirPorConsulta(bin, consultas, REPETICIONES) });
    const cProm = caso(existentes);
    const cPeor = caso(inexistentes);
    const cMejor = caso(primeros);

    const equilibrio = cProm.s.us > cProm.b.us ? Math.ceil((msOrdenar * 1000) / (cProm.s.us - cProm.b.us)) : null;
    const fila = (c, extra = {}) => ({
      registros: n,
      'secuencial (µs)': redondear(c.s.us, 3),
      'binaria (µs)': redondear(c.b.us, 3),
      'más rápida': ganador(c.s.us, c.b.us),
      'comparaciones sec.': redondear(c.s.comparaciones, 1),
      'comparaciones bin.': redondear(c.b.comparaciones, 1),
      'ahorro comparaciones': fmt(redondear((1 - c.b.comparaciones / c.s.comparaciones) * 100, 3)) + ' %',
      ...extra,
    });

    promedio.push(fila(cProm, {
      ...(MHZ > 0 ? { 'ciclos est. sec.': miles(ciclos(cProm.s.cpuUs)), 'ciclos est. bin.': miles(ciclos(cProm.b.cpuUs)) } : {}),
      'CPU sec. (µs)': redondear(cProm.s.cpuUs, 3),
      'CPU bin. (µs)': redondear(cProm.b.cpuUs, 3),
    }));
    peor.push(fila(cPeor));
    mejor.push(fila(cMejor));
    resumen.push({
      registros: n,
      'ordenar índice (ms)': redondear(msOrdenar, 2),
      'heap índice (MB)': redondear(mb(heap1 - heap0), 2),
      'equilibrio (consultas)': equilibrio === null ? 'n/a' : miles(equilibrio),
      'log2(n) teórico': redondear(Math.log2(n), 1),
      'n/2 teórico': miles(n / 2),
    });
    console.log(`  n = ${miles(n)} listo`);
  }

  tabla('1A) MEMORIA - caso PROMEDIO (ids que existen). Costo por consulta', promedio);
  tabla('1B) MEMORIA - PEOR caso de la secuencial (id que no existe: recorre los n registros)', peor);
  tabla('1C) MEMORIA - MEJOR caso de la secuencial (el id está en la primera posición)', mejor,
    'La secuencial puede ganar en este caso: encuentra el dato con 1 comparación. Es un caso raro, no el esperado.');
  tabla('1D) COSTO DE INDEXAR (ordenar con MergeSort) y punto de equilibrio', resumen,
    'Equilibrio = consultas necesarias para que el tiempo de ordenar se compense con el ahorro de cada búsqueda binaria.');
  return { verificado, promedio, peor };
}

// ---------------------------------------------------------------------------
// Experimento 2: conteo por nombre_lugar (valores repetidos)
// ---------------------------------------------------------------------------
function experimentoRango(base) {
  const filas = [];
  let verificado = true;
  const nombres = [...new Set(base.map((r) => r.nombre_lugar))];

  for (const n of TAMANOS) {
    const registros = generarRegistros(base, n);
    const ordenado = MergeSort.ordenar(registros, MergeSort.crearComparador(['nombre_lugar', 'id']));
    for (const nombre of nombres.slice(0, 5)) {
      if (Busqueda.rango(ordenado, 'nombre_lugar', nombre).cantidad !== Busqueda.contarSecuencial(registros, 'nombre_lugar', nombre)) verificado = false;
    }
    const consultas = nombres; // los 27 lugares distintos
    const seq = (v) => Busqueda.contarSecuencial(registros, 'nombre_lugar', v);
    const bin = (v) => Busqueda.rango(ordenado, 'nombre_lugar', v);
    const s = medirPorConsulta(seq, consultas, REPETICIONES);
    const b = medirPorConsulta(bin, consultas, REPETICIONES);
    filas.push({
      registros: n,
      'recorrido completo (µs)': redondear(s.us, 3),
      'rango binario (µs)': redondear(b.us, 3),
      'más rápido': ganador(s.us, b.us),
      'comparaciones rec.': redondear(s.comparaciones, 1),
      'comparaciones bin.': redondear(b.comparaciones, 1),
      'ahorro comparaciones': fmt(redondear((1 - b.comparaciones / s.comparaciones) * 100, 3)) + ' %',
    });
    console.log(`  n = ${miles(n)} listo`);
  }
  tabla('2) MEMORIA - contar registros de un lugar (nombre_lugar repetido): recorrido O(n) vs rango binario O(log n)', filas,
    'El rango binario encuentra dónde empieza y dónde termina el grupo sin recorrerlo, aunque tenga miles de registros.');
  return verificado;
}

// ---------------------------------------------------------------------------
// Experimento 3: archivo indexado en disco
// ---------------------------------------------------------------------------
function experimentoArchivo(base) {
  const carpeta = CONSERVAR ? CARPETA_INDEXADO : fs.mkdtempSync(path.join(os.tmpdir(), 'indexado-'));
  fs.mkdirSync(carpeta, { recursive: true });
  const filas = [];
  const construccion = [];
  let verificado = true;
  const consultasArchivo = Math.min(CONSULTAS, 50);

  for (const n of TAMANOS.filter((x) => x <= ARCHIVO_MAX)) {
    const registros = generarRegistros(base, n);
    const rutaDatos = path.join(carpeta, `registros_${n}.ndjson`);
    const rutaIndice = path.join(carpeta, `registros_${n}_id.idx`);
    ArchivoIndexado.escribirDatos(rutaDatos, registros);

    const archivo = new ArchivoIndexado(rutaDatos, rutaIndice, 'id');
    const info = archivo.construirIndice();
    archivo.abrir();

    const azar = crearAleatorio(n + 1);
    const ids = [];
    for (let i = 0; i < consultasArchivo; i++) ids.push(registros[Math.floor(azar() * n)].id);

    for (const id of ids.slice(0, 10)) { // las dos búsquedas deben traer el mismo registro
      const a = archivo.buscarSecuencial(id);
      const b = archivo.buscarBinario(id);
      if (!a || !b || a.id !== id || b.id !== id) verificado = false;
    }
    if (archivo.buscarBinario('SIN-REGISTRO') !== null || archivo.buscarSecuencial('SIN-REGISTRO') !== null) verificado = false;

    const seq = (v) => { archivo.buscarSecuencial(v); };
    const bin = (v) => { archivo.buscarBinario(v); };

    archivo.reiniciarContadores();
    const s = medirPorConsulta(seq, ids, 2);
    archivo.reiniciarContadores(); ids.forEach(seq);
    const lecturasSeq = archivo.lecturas / ids.length;
    const bytesSeq = archivo.bytesLeidos / ids.length;

    const b = medirPorConsulta(bin, ids, REPETICIONES);
    archivo.reiniciarContadores(); ids.forEach(bin);
    const lecturasBin = archivo.lecturas / ids.length;
    const bytesBin = archivo.bytesLeidos / ids.length;

    const comparacionesSeq = (() => { archivo.reiniciarContadores(); ids.forEach(seq); return archivo.comparaciones / ids.length; })();
    const comparacionesBin = (() => { archivo.reiniciarContadores(); ids.forEach(bin); return archivo.comparaciones / ids.length; })();

    filas.push({
      registros: n,
      'tamaño datos (MB)': redondear(mb(fs.statSync(rutaDatos).size), 2),
      'secuencial (ms)': redondear(s.us / 1000, 3),
      'binaria (ms)': redondear(b.us / 1000, 4),
      'más rápida': ganador(s.us, b.us),
      'registros leídos sec.': miles(comparacionesSeq),
      'comparaciones bin.': redondear(comparacionesBin, 1),
      'lecturas disco sec.': miles(lecturasSeq, 0),
      'lecturas disco bin.': redondear(lecturasBin, 1),
      'KB leídos sec.': miles(bytesSeq / 1024, 0),
      'KB leídos bin.': redondear(bytesBin / 1024, 3),
    });
    construccion.push({
      registros: n,
      'índice (KB)': redondear(info.bytesIndice / 1024, 1),
      'leer datos (ms)': redondear(info.msLectura, 1),
      'ordenar claves con MergeSort (ms)': redondear(info.msOrdenar, 1),
      'escribir índice (ms)': redondear(info.msEscritura, 1),
    });
    archivo.cerrar();
    console.log(`  n = ${miles(n)} listo`);
  }

  if (!CONSERVAR) fs.rmSync(carpeta, { recursive: true, force: true });
  tabla(`3A) ARCHIVO INDEXADO - tiempo por consulta (promedio de ${consultasArchivo} ids que existen)`, filas,
    'Los archivos quedan en la caché del sistema operativo (lecturas "calientes"). En un disco frío la diferencia sería aún mayor.');
  tabla('3B) ARCHIVO INDEXADO - costo único de construir el índice (.idx)', construccion);
  return verificado;
}

// ---------------------------------------------------------------------------
// Análisis automático con los números medidos
// ---------------------------------------------------------------------------
function analisis(resultados, verificado) {
  const ultimo = resultados.promedio[resultados.promedio.length - 1];
  const primero = resultados.promedio[0];
  const lineas = [
    `Con ${miles(ultimo.registros)} registros, la búsqueda secuencial necesitó ${fmt(ultimo['comparaciones sec.'])} comparaciones por consulta y la binaria ${fmt(ultimo['comparaciones bin.'])}: ` +
      `un ahorro de ${ultimo['ahorro comparaciones']} y una respuesta más rápida: ${ultimo['más rápida']}.`,
    `Al crecer de ${miles(primero.registros)} a ${miles(ultimo.registros)} registros (${miles(ultimo.registros / primero.registros)} veces más datos), ` +
      `la secuencial pasó de ${fmt(primero['comparaciones sec.'])} a ${fmt(ultimo['comparaciones sec.'])} comparaciones (crece con n), ` +
      `mientras que la binaria pasó de ${fmt(primero['comparaciones bin.'])} a ${fmt(ultimo['comparaciones bin.'])} (crece con log2 n).`,
    'El tiempo de la secuencial crece más rápido que n cuando el arreglo deja de caber en la memoria caché del procesador: recorrer muchos objetos dispersos en memoria es más lento por registro.',
    'Ordenar el índice tiene un costo único O(n log n); se compensa cuando se hacen muchas consultas (ver tabla 1D).',
    'Si el dato buscado está en las primeras posiciones, la secuencial puede ganar (tabla 1C): O(n) describe el caso promedio y el peor, no el mejor.',
    `Verificación de resultados (ambas búsquedas devuelven el mismo registro): ${verificado ? 'CORRECTA' : 'FALLÓ'}.`,
  ];
  linea();
  console.log('ANÁLISIS');
  lineas.forEach((l) => console.log(' - ' + l));
  informe.push({ titulo: 'Análisis', lineas });
}

function escribirInforme(base, verificado) {
  fs.mkdirSync(CARPETA_RESULTADOS, { recursive: true });
  const cpu = os.cpus()[0] ? os.cpus()[0].model : 'desconocido';
  const partes = [
    '# Resultados: búsqueda secuencial vs binaria',
    '',
    `- Fecha: ${new Date().toISOString()}`,
    `- Node ${process.version} | ${os.platform()} ${os.arch()} | CPU: ${cpu}${MHZ ? ` (${MHZ} MHz nominales)` : ''}`,
    `- Dataset base: ${miles(base.length)} registros | consultas por prueba: ${CONSULTAS} | repeticiones: ${REPETICIONES}`,
    `- Tamaños probados: ${TAMANOS.map((t) => miles(t)).join(', ')}`,
    '',
    'Los tiempos dependen del equipo; las **comparaciones** son comparables entre equipos.',
    '',
  ];
  for (const bloque of informe) {
    partes.push(`## ${bloque.titulo}`, '');
    if (bloque.filas) partes.push(tablaMarkdown(bloque.filas), '');
    if (bloque.nota) partes.push(`> ${bloque.nota}`, '');
    if (bloque.lineas) partes.push(...bloque.lineas.map((l) => `- ${l}`), '');
  }
  const ruta = path.join(CARPETA_RESULTADOS, 'busqueda_resultados.md');
  fs.writeFileSync(ruta, partes.join('\n'));
  console.log(`\nInforme guardado en: ${ruta}`);
  if (!verificado) console.log('ATENCIÓN: hubo diferencias entre las búsquedas.');
}

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(RUTA_DATASET) || fs.statSync(RUTA_DATASET).size === 0) {
    console.error(`No se encontró contenido en ${RUTA_DATASET}`);
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(RUTA_DATASET, 'utf8'));
  calentar(base);

  linea();
  console.log('  PRUEBA DE ESTRÉS: BÚSQUEDA SECUENCIAL O(n) vs BÚSQUEDA BINARIA O(log n)');
  linea();
  console.log(`Dataset base: ${miles(base.length)} registros | Node ${process.version}`);
  console.log(`Tamaños: ${TAMANOS.map((t) => miles(t)).join(', ')} | consultas: ${CONSULTAS} | repeticiones: ${REPETICIONES}`);
  console.log(`CPU: ${os.cpus()[0] ? os.cpus()[0].model : 'desconocido'}${MHZ ? ` (${MHZ} MHz)` : ' (frecuencia no informada: sin ciclos estimados)'}`);
  if (typeof global.gc !== 'function') console.log('Aviso: sin --expose-gc la memoria varía más. Use: npm run benchmark:busqueda');
  console.log(`Tamaños mayores a ${miles(base.length)} se generan clonando registros reales con ids nuevos.`);

  console.log('\nExperimento 1: memoria, búsqueda exacta por id');
  const r1 = experimentoMemoria(base);
  console.log('\nExperimento 2: memoria, conteo por nombre_lugar');
  const ok2 = experimentoRango(base);
  let ok3 = true;
  if (!SIN_ARCHIVO) {
    console.log('\nExperimento 3: archivo indexado');
    ok3 = experimentoArchivo(base);
  }

  const verificado = r1.verificado && ok2 && ok3;
  analisis(r1, verificado);
  if (!SIN_INFORME) escribirInforme(base, verificado);
  if (!verificado) process.exitCode = 1;
}

main();
