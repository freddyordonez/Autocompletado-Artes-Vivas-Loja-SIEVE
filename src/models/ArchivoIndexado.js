'use strict';

/**
 * ArchivoIndexado.js
 * ---------------------------------------------------------------------------
 * Búsqueda en ARCHIVO usando un índice ordenado en disco (idea clásica de
 * "archivo indexado"), sin cargar los registros en memoria.
 *
 * Se usan dos archivos:
 *
 *  1) ARCHIVO DE DATOS (.ndjson): un registro JSON por línea, en cualquier
 *     orden (por ejemplo, el orden original del dataset).
 *
 *  2) ARCHIVO ÍNDICE (.idx): una entrada de tamaño FIJO (24 bytes) por registro,
 *     ORDENADA por clave con MergeSort:
 *
 *        bytes  0..15  clave (texto UTF-8, relleno con ceros)
 *        bytes 16..19  offset: posición del registro en el archivo de datos (UInt32 LE)
 *        bytes 20..21  longitud del registro en bytes (UInt16 LE)
 *        bytes 22..23  reservado
 *
 * Como cada entrada mide lo mismo, la entrada número i está en la posición
 * i * 24 del archivo. Eso permite hacer BÚSQUEDA BINARIA directamente sobre el
 * disco: cada paso lee solo 24 bytes (fs.readSync con posición), y al final se
 * lee un único registro del archivo de datos.
 *
 * La búsqueda SECUENCIAL, en cambio, lee el archivo de datos por bloques y
 * convierte cada línea hasta encontrar la clave.
 *
 * Límites de este diseño: claves de hasta 16 bytes, archivo de datos de hasta
 * 4 GB y registros de hasta 65 535 bytes.
 *
 * Uso:
 *   ArchivoIndexado.escribirDatos('datos.ndjson', registros);
 *   const archivo = new ArchivoIndexado('datos.ndjson', 'datos_id.idx', 'id');
 *   archivo.construirIndice();   // se hace una vez
 *   archivo.abrir();
 *   archivo.buscarBinario('LOJ-01550');     // registro o null
 *   archivo.buscarSecuencial('LOJ-01550');  // mismo resultado, mucho más lento
 *   archivo.cerrar();
 */
const fs = require('node:fs');
const MergeSort = require('./MergeSort');

const TAM_CLAVE = 16;
const TAM_ENTRADA = 24;
const TAM_BLOQUE = 64 * 1024; // bloque de lectura de la búsqueda secuencial

class ArchivoIndexado {
  /**
   * @param {string} rutaDatos  archivo .ndjson con los registros
   * @param {string} rutaIndice archivo .idx (se crea en construirIndice)
   * @param {string} campo      campo por el que se indexa (clave de texto)
   */
  constructor(rutaDatos, rutaIndice, campo = 'id') {
    this.rutaDatos = rutaDatos;
    this.rutaIndice = rutaIndice;
    this.campo = campo;
    this.fdDatos = null;
    this.fdIndice = null;
    this.total = 0;
    this._entrada = Buffer.alloc(TAM_ENTRADA); // buffer reutilizado en cada lectura
    this.reiniciarContadores();
  }

  /** Escribe los registros como NDJSON (un JSON por línea). */
  static escribirDatos(ruta, registros) {
    const lineas = new Array(registros.length);
    for (let i = 0; i < registros.length; i++) lineas[i] = JSON.stringify(registros[i]);
    fs.writeFileSync(ruta, lineas.join('\n') + '\n');
  }

  /** Contadores de trabajo realizado en disco y en comparaciones. */
  reiniciarContadores() {
    this.lecturas = 0;      // llamadas a fs.readSync
    this.bytesLeidos = 0;   // bytes traídos desde el archivo
    this.comparaciones = 0; // comparaciones de claves
  }

  /**
   * Crea el archivo índice: lee los datos una vez, ordena las claves con
   * MergeSort y escribe las entradas de 24 bytes. Se paga una sola vez.
   * @returns {{registros:number, msLectura:number, msOrdenar:number, msEscritura:number, bytesIndice:number}}
   */
  construirIndice() {
    const medir = () => process.hrtime.bigint();
    const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

    // 1) Leer el archivo de datos y anotar clave, posición y longitud de cada línea.
    let t = medir();
    const datos = fs.readFileSync(this.rutaDatos);
    const entradas = [];
    let inicio = 0;
    while (inicio < datos.length) {
      let fin = datos.indexOf(10, inicio); // 10 = salto de línea
      if (fin === -1) fin = datos.length;
      if (fin > inicio) {
        const registro = JSON.parse(datos.toString('utf8', inicio, fin));
        const clave = String(registro[this.campo]);
        if (Buffer.byteLength(clave) > TAM_CLAVE) throw new RangeError(`La clave "${clave}" supera ${TAM_CLAVE} bytes`);
        entradas.push({ clave, offset: inicio, longitud: fin - inicio });
      }
      inicio = fin + 1;
    }
    const msLectura = ms(t);

    // 2) Ordenar las entradas por clave con nuestro MergeSort.
    t = medir();
    const ordenadas = MergeSort.ordenar(entradas, MergeSort.crearComparador(['clave']));
    const msOrdenar = ms(t);

    // 3) Escribir el índice en disco con entradas de tamaño fijo.
    t = medir();
    const buffer = Buffer.alloc(ordenadas.length * TAM_ENTRADA); // inicia en ceros
    for (let i = 0; i < ordenadas.length; i++) {
      const p = i * TAM_ENTRADA;
      buffer.write(ordenadas[i].clave, p, TAM_CLAVE, 'utf8');
      buffer.writeUInt32LE(ordenadas[i].offset, p + 16);
      buffer.writeUInt16LE(ordenadas[i].longitud, p + 20);
    }
    fs.writeFileSync(this.rutaIndice, buffer);
    const msEscritura = ms(t);

    return { registros: ordenadas.length, msLectura, msOrdenar, msEscritura, bytesIndice: buffer.length };
  }

  /** Abre los dos archivos para consultarlos. */
  abrir() {
    this.fdDatos = fs.openSync(this.rutaDatos, 'r');
    this.fdIndice = fs.openSync(this.rutaIndice, 'r');
    const tamano = fs.fstatSync(this.fdIndice).size;
    if (tamano % TAM_ENTRADA !== 0) throw new Error('El índice está dañado (tamaño no múltiplo de 24 bytes)');
    this.total = tamano / TAM_ENTRADA;
    return this;
  }

  cerrar() {
    if (this.fdDatos !== null) fs.closeSync(this.fdDatos);
    if (this.fdIndice !== null) fs.closeSync(this.fdIndice);
    this.fdDatos = this.fdIndice = null;
  }

  /**
   * Búsqueda BINARIA sobre el índice en disco. Complejidad: O(log n) lecturas.
   * @returns {object|null} el registro o null si la clave no existe
   */
  buscarBinario(valor) {
    const buscado = String(valor);
    let bajo = 0;
    let alto = this.total - 1;

    while (bajo <= alto) {
      const medio = bajo + ((alto - bajo) >>> 1);
      const entrada = this._leerEntrada(medio); // 24 bytes desde el disco
      this.comparaciones++;
      const r = MergeSort.compararValores(entrada.clave, buscado);
      if (r === 0) return this._leerRegistro(entrada.offset, entrada.longitud);
      if (r < 0) bajo = medio + 1;
      else alto = medio - 1;
    }
    return null;
  }

  /**
   * Búsqueda SECUENCIAL sobre el archivo de datos (sin usar el índice).
   * Complejidad: O(n) registros leídos y convertidos.
   * @returns {object|null}
   */
  buscarSecuencial(valor) {
    const buscado = String(valor);
    const bloque = Buffer.allocUnsafe(TAM_BLOQUE);
    let posicion = 0;
    let resto = Buffer.alloc(0); // línea incompleta al final de un bloque

    for (;;) {
      const leidos = fs.readSync(this.fdDatos, bloque, 0, TAM_BLOQUE, posicion);
      if (leidos === 0) break;
      posicion += leidos;
      this.lecturas++;
      this.bytesLeidos += leidos;

      const datos = resto.length ? Buffer.concat([resto, bloque.subarray(0, leidos)]) : bloque.subarray(0, leidos);
      let inicio = 0;
      for (;;) {
        const fin = datos.indexOf(10, inicio);
        if (fin === -1) break;
        if (fin > inicio) {
          this.comparaciones++;
          const registro = JSON.parse(datos.toString('utf8', inicio, fin));
          if (String(registro[this.campo]) === buscado) return registro;
        }
        inicio = fin + 1;
      }
      resto = Buffer.from(datos.subarray(inicio)); // copia: el bloque se reutiliza
    }

    if (resto.length) { // última línea sin salto de línea final
      this.comparaciones++;
      const registro = JSON.parse(resto.toString('utf8'));
      if (String(registro[this.campo]) === buscado) return registro;
    }
    return null;
  }

  // -------------------------- utilidades privadas --------------------------

  /** Lee la entrada i del índice (posición i * 24). */
  _leerEntrada(i) {
    fs.readSync(this.fdIndice, this._entrada, 0, TAM_ENTRADA, i * TAM_ENTRADA);
    this.lecturas++;
    this.bytesLeidos += TAM_ENTRADA;
    let fin = 0;
    while (fin < TAM_CLAVE && this._entrada[fin] !== 0) fin++; // la clave termina en el primer cero
    return {
      clave: this._entrada.toString('utf8', 0, fin),
      offset: this._entrada.readUInt32LE(16),
      longitud: this._entrada.readUInt16LE(20),
    };
  }

  /** Lee un registro del archivo de datos conociendo su posición y longitud. */
  _leerRegistro(offset, longitud) {
    const buffer = Buffer.allocUnsafe(longitud);
    fs.readSync(this.fdDatos, buffer, 0, longitud, offset);
    this.lecturas++;
    this.bytesLeidos += longitud;
    return JSON.parse(buffer.toString('utf8'));
  }
}

module.exports = ArchivoIndexado;
