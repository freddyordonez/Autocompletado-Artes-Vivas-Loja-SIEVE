'use strict';

/**
 * MergeSort.js
 * ---------------------------------------------------------------------------
 * Ordenamiento por mezcla (Merge Sort) implementado desde cero, sin usar el
 * ordenamiento nativo de JavaScript (ni ningún método que ordene por nosotros).
 *
 * Características:
 *  - Complejidad en tiempo: O(n log n) en el mejor, promedio y peor caso.
 *  - Complejidad en espacio: O(n) (un solo arreglo auxiliar reutilizado).
 *  - ESTABLE: los elementos que empatan conservan su orden original. Gracias a
 *    esto se pueden encadenar criterios y los desempates son predecibles.
 *  - NO modifica el arreglo recibido: devuelve uno nuevo.
 *  - Ordena por MÚLTIPLES CRITERIOS mediante crearComparador().
 *
 * Uso básico:
 *   const MergeSort = require('./MergeSort');
 *   const cmp = MergeSort.crearComparador([
 *     { campo: 'anio', orden: 'desc' },          // 1.º criterio
 *     { campo: 'nombre_lugar', orden: 'asc' },   // desempate alfabético
 *   ]);
 *   const ordenado = MergeSort.ordenar(registros, cmp);
 */
class MergeSort {
  // ------------------------------------------------------------------------
  // API pública
  // ------------------------------------------------------------------------

  /**
   * Ordena un arreglo con Merge Sort y devuelve una copia ordenada.
   * @param {Array} arreglo      Registros a ordenar (no se modifica).
   * @param {Function} comparador (a, b) => negativo | 0 | positivo.
   *                              Por defecto compara valores simples.
   * @returns {Array} Nuevo arreglo ordenado.
   */
  static ordenar(arreglo, comparador = MergeSort.compararValores) {
    if (!Array.isArray(arreglo)) throw new TypeError('ordenar(): se esperaba un arreglo');
    if (typeof comparador !== 'function') throw new TypeError('ordenar(): el comparador debe ser una función');

    const n = arreglo.length;

    // Copia manual: así el arreglo original queda intacto.
    const datos = new Array(n);
    for (let i = 0; i < n; i++) datos[i] = arreglo[i];
    if (n < 2) return datos;

    // Un único arreglo auxiliar reutilizado en todas las mezclas: O(n) de espacio.
    const auxiliar = new Array(n);
    MergeSort._ordenarRango(datos, auxiliar, 0, n - 1, comparador);
    return datos;
  }

  /**
   * Construye un comparador a partir de una lista de criterios.
   * Se evalúan en orden: el siguiente criterio solo se usa si el anterior empata.
   *
   * @param {Array<string|{campo:string, orden?:'asc'|'desc'}>} criterios
   *        Ejemplo: ['categoria', { campo: 'fecha', orden: 'desc' }]
   * @returns {Function} comparador (a, b) => número
   */
  static crearComparador(criterios) {
    if (!Array.isArray(criterios) || criterios.length === 0) {
      throw new TypeError('crearComparador(): se requiere al menos un criterio');
    }

    // Se normaliza una sola vez; así la comparación (que se ejecuta millones de veces) es rápida.
    const campos = [];
    const sentidos = []; // 1 = ascendente, -1 = descendente
    for (const c of criterios) {
      const campo = typeof c === 'string' ? c : c && c.campo;
      const orden = typeof c === 'string' ? 'asc' : (c.orden || 'asc');
      if (!campo) throw new TypeError('crearComparador(): cada criterio necesita "campo"');
      if (orden !== 'asc' && orden !== 'desc') throw new RangeError(`orden inválido: "${orden}" (use "asc" o "desc")`);
      campos.push(campo);
      sentidos.push(orden === 'desc' ? -1 : 1);
    }

    return function comparador(a, b) {
      for (let i = 0; i < campos.length; i++) {
        const va = a[campos[i]];
        const vb = b[campos[i]];

        // Los valores ausentes (null/undefined) van siempre al final, sea cual sea el sentido.
        const aNulo = va === null || va === undefined;
        const bNulo = vb === null || vb === undefined;
        if (aNulo || bNulo) {
          if (aNulo && bNulo) continue;
          return aNulo ? 1 : -1;
        }

        const r = MergeSort.compararValores(va, vb);
        if (r !== 0) return r * sentidos[i];
      }
      return 0; // empate total: Merge Sort estable conserva el orden original
    };
  }

  /**
   * Compara dos valores simples (números, fechas, booleanos o texto).
   * @returns {number} -1, 0 o 1
   */
  static compararValores(a, b) {
    const ta = typeof a;
    const tb = typeof b;

    if (ta === 'number' && tb === 'number') return a < b ? -1 : (a > b ? 1 : 0);
    if (ta === 'string' && tb === 'string') return MergeSort.compararTexto(a, b);
    if (a instanceof Date && b instanceof Date) {
      const x = a.getTime();
      const y = b.getTime();
      return x < y ? -1 : (x > y ? 1 : 0);
    }
    if (ta === 'boolean' && tb === 'boolean') return a === b ? 0 : (a ? 1 : -1);

    // Tipos mezclados: se comparan como texto para mantener un orden total.
    return MergeSort.compararTexto(String(a), String(b));
  }

  /**
   * Compara dos textos en orden alfabético del español, a mano (sin localeCompare):
   *  - ignora mayúsculas y tildes ("Ángel" va junto a "Angel");
   *  - si solo difieren en tildes/mayúsculas, desempata por el texto original
   *    para que el orden sea siempre determinista.
   * Recorre ambos textos letra por letra sin crear textos nuevos, por eso es rápido
   * incluso cuando se llama millones de veces.
   * @returns {number} -1, 0 o 1
   */
  static compararTexto(a, b) {
    const na = a.length;
    const nb = b.length;
    let i = 0;
    let j = 0;

    for (;;) {
      // Siguiente letra "plegada" de cada texto (-1 si ya no quedan letras).
      let x = -1;
      let y = -1;
      while (i < na) {
        const c = a.charCodeAt(i++);
        if (c >= 0x300 && c <= 0x36f) continue; // marca de tilde suelta: se ignora
        x = MergeSort._plegar(c);
        break;
      }
      while (j < nb) {
        const c = b.charCodeAt(j++);
        if (c >= 0x300 && c <= 0x36f) continue;
        y = MergeSort._plegar(c);
        break;
      }

      if (x === -1 || y === -1) {
        if (x === y) break;          // ambos terminaron: son iguales sin tildes ni mayúsculas
        return x === -1 ? -1 : 1;    // el más corto va primero
      }
      if (x !== y) return x < y ? -1 : 1;
    }

    return MergeSort._compararCodigos(a, b); // desempate por el texto original
  }

  /**
   * Verifica que un arreglo cumpla el orden del comparador (útil en pruebas).
   * @returns {boolean}
   */
  static estaOrdenado(arreglo, comparador = MergeSort.compararValores) {
    for (let i = 1; i < arreglo.length; i++) {
      if (comparador(arreglo[i - 1], arreglo[i]) > 0) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------------
  // Núcleo del algoritmo (privado)
  // ------------------------------------------------------------------------

  /**
   * Fase "dividir": parte el rango [izq, der] por la mitad, ordena cada mitad
   * de forma recursiva y luego las mezcla. Profundidad de recursión: log2(n).
   */
  static _ordenarRango(datos, auxiliar, izq, der, cmp) {
    if (izq >= der) return; // caso base: 0 o 1 elemento ya está ordenado

    const medio = izq + ((der - izq) >> 1);
    MergeSort._ordenarRango(datos, auxiliar, izq, medio, cmp);
    MergeSort._ordenarRango(datos, auxiliar, medio + 1, der, cmp);

    // Mejora clásica: si el último de la mitad izquierda ya es <= que el primero de
    // la derecha, las dos mitades forman una secuencia ordenada y no hay que mezclar.
    if (cmp(datos[medio], datos[medio + 1]) <= 0) return;

    MergeSort._mezclar(datos, auxiliar, izq, medio, der, cmp);
  }

  /**
   * Fase "combinar": mezcla las mitades ordenadas [izq..medio] y [medio+1..der].
   * Es estable: en un empate se toma primero el elemento de la mitad izquierda.
   */
  static _mezclar(datos, auxiliar, izq, medio, der, cmp) {
    for (let k = izq; k <= der; k++) auxiliar[k] = datos[k]; // copia del rango a mezclar

    let i = izq;        // recorre la mitad izquierda
    let j = medio + 1;  // recorre la mitad derecha
    let k = izq;        // posición de escritura en datos

    while (i <= medio && j <= der) {
      if (cmp(auxiliar[j], auxiliar[i]) < 0) datos[k++] = auxiliar[j++]; // derecha estrictamente menor
      else datos[k++] = auxiliar[i++];                                    // empate o izquierda menor
    }
    while (i <= medio) datos[k++] = auxiliar[i++]; // sobrantes de la izquierda
    while (j <= der) datos[k++] = auxiliar[j++];   // sobrantes de la derecha
  }

  // ------------------------------------------------------------------------
  // Utilidades para comparar texto (privadas)
  // ------------------------------------------------------------------------

  /** Compara dos textos código por código. @returns {number} -1, 0 o 1 */
  static _compararCodigos(a, b) {
    const n = a.length < b.length ? a.length : b.length;
    for (let i = 0; i < n; i++) {
      const x = a.charCodeAt(i);
      const y = b.charCodeAt(i);
      if (x !== y) return x < y ? -1 : 1;
    }
    return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
  }

  /**
   * Devuelve el código de una letra en minúscula y sin tilde ("Á" -> "a", "ñ" -> "n").
   * Para letras con tilde usa una tabla que se arma una sola vez al cargar el módulo.
   */
  static _plegar(c) {
    if (c < 128) return c >= 65 && c <= 90 ? c + 32 : c; // ASCII: solo pasar a minúscula
    const m = MergeSort._TABLA_TILDES[c];
    return m === undefined ? c : m;
  }
}

// Tabla de letras con tilde (Latin-1 y Latin extendido) -> letra base en minúscula.
MergeSort._TABLA_TILDES = (() => {
  const tabla = {};
  for (let c = 128; c < 592; c++) {
    const base = String.fromCharCode(c).normalize('NFD').charCodeAt(0);
    const minuscula = String.fromCharCode(base).toLowerCase().charCodeAt(0);
    if (minuscula !== c && minuscula < 128) tabla[c] = minuscula;
  }
  return tabla;
})();

module.exports = MergeSort;
