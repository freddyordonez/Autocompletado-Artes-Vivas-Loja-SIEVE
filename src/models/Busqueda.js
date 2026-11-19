'use strict';

const MergeSort = require('./MergeSort');

/**
 * Busqueda.js
 * ---------------------------------------------------------------------------
 * Búsqueda secuencial O(n) y búsqueda binaria O(log n) sobre arreglos de
 * registros en memoria, implementadas desde cero.
 *
 *  - secuencial(): recorre el arreglo de principio a fin. NO necesita datos
 *    ordenados. Usa igualdad estricta (===), que es lo más barato posible.
 *  - binaria():    descarta la mitad del arreglo en cada paso. EXIGE que el
 *    arreglo esté ordenado por el mismo campo y con el mismo criterio de
 *    MergeSort (MergeSort.compararValores).
 *  - limiteInferior()/limiteSuperior()/rango(): variantes de la búsqueda
 *    binaria para campos con valores repetidos (por ejemplo nombre_lugar).
 *
 * Métrica de "trabajo": todas las funciones suman a Busqueda.comparaciones el
 * número de comparaciones que realizaron. Es una medida independiente del
 * computador, ideal para comparar algoritmos (el tiempo en ms depende del equipo).
 *
 * Uso:
 *   const MergeSort = require('./MergeSort');
 *   const Busqueda = require('./Busqueda');
 *   const porId = MergeSort.ordenar(registros, MergeSort.crearComparador(['id']));
 *   const i = Busqueda.binaria(porId, 'id', 'LOJ-01550');   // índice o -1
 */
class Busqueda {
  /**
   * Búsqueda secuencial (lineal). Complejidad: O(n).
   *   Mejor caso: 1 comparación | Promedio: n/2 | Peor caso (no existe): n
   * @returns {number} índice del primer registro que coincide, o -1
   */
  static secuencial(arreglo, campo, valor) {
    const n = arreglo.length;
    for (let i = 0; i < n; i++) {
      if (arreglo[i][campo] === valor) {
        Busqueda.comparaciones += i + 1;
        return i;
      }
    }
    Busqueda.comparaciones += n;
    return -1;
  }

  /**
   * Búsqueda binaria (iterativa). Complejidad: O(log n).
   * Máximo de comparaciones: floor(log2(n)) + 1.
   * Con valores repetidos devuelve el índice de UNO de ellos (use rango() para todos).
   * @param {Array} arreglo ORDENADO ascendentemente por `campo` con MergeSort
   * @returns {number} índice del registro, o -1 si no existe
   */
  static binaria(arreglo, campo, valor) {
    let bajo = 0;
    let alto = arreglo.length - 1;
    let comparaciones = 0;

    while (bajo <= alto) {
      const medio = bajo + ((alto - bajo) >>> 1); // evita desbordes y no usa decimales
      comparaciones++;
      const r = MergeSort.compararValores(arreglo[medio][campo], valor);
      if (r === 0) {
        Busqueda.comparaciones += comparaciones;
        return medio;
      }
      if (r < 0) bajo = medio + 1; // el valor buscado está en la mitad derecha
      else alto = medio - 1;       // el valor buscado está en la mitad izquierda
    }
    Busqueda.comparaciones += comparaciones;
    return -1;
  }

  /**
   * Primer índice cuyo valor es MAYOR O IGUAL que `valor` (lower bound).
   * Si todos son menores devuelve arreglo.length. Complejidad: O(log n).
   */
  static limiteInferior(arreglo, campo, valor) {
    let bajo = 0;
    let alto = arreglo.length;
    let comparaciones = 0;
    while (bajo < alto) {
      const medio = bajo + ((alto - bajo) >>> 1);
      comparaciones++;
      if (MergeSort.compararValores(arreglo[medio][campo], valor) < 0) bajo = medio + 1;
      else alto = medio;
    }
    Busqueda.comparaciones += comparaciones;
    return bajo;
  }

  /**
   * Primer índice cuyo valor es ESTRICTAMENTE MAYOR que `valor` (upper bound).
   * Complejidad: O(log n).
   */
  static limiteSuperior(arreglo, campo, valor) {
    let bajo = 0;
    let alto = arreglo.length;
    let comparaciones = 0;
    while (bajo < alto) {
      const medio = bajo + ((alto - bajo) >>> 1);
      comparaciones++;
      if (MergeSort.compararValores(arreglo[medio][campo], valor) <= 0) bajo = medio + 1;
      else alto = medio;
    }
    Busqueda.comparaciones += comparaciones;
    return bajo;
  }

  /**
   * Ubica TODOS los registros con ese valor en un arreglo ordenado por `campo`.
   * Devuelve { inicio, fin, cantidad }: los registros son arreglo[inicio .. fin-1].
   * Complejidad: O(log n), sin recorrer los registros encontrados.
   */
  static rango(arreglo, campo, valor) {
    const inicio = Busqueda.limiteInferior(arreglo, campo, valor);
    const fin = Busqueda.limiteSuperior(arreglo, campo, valor);
    return { inicio, fin, cantidad: fin - inicio };
  }

  /**
   * Cuenta cuántos registros tienen ese valor recorriendo TODO el arreglo.
   * Complejidad: O(n) siempre (no puede detenerse antes porque puede haber más).
   */
  static contarSecuencial(arreglo, campo, valor) {
    const n = arreglo.length;
    let cantidad = 0;
    for (let i = 0; i < n; i++) {
      if (arreglo[i][campo] === valor) cantidad++;
    }
    Busqueda.comparaciones += n;
    return cantidad;
  }

  /** Pone en cero el contador de comparaciones. */
  static reiniciar() {
    Busqueda.comparaciones = 0;
  }
}

Busqueda.comparaciones = 0; // acumulador global de comparaciones realizadas

module.exports = Busqueda;