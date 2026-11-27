'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const MergeSort = require('../src/models/MergeSort');

// Generador pseudoaleatorio con semilla: las pruebas siempre usan los mismos datos.
function crearAleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('MergeSort - casos básicos', () => {
  test('1. Ordena números ascendente', () => {
    assert.deepEqual(MergeSort.ordenar([5, 3, 9, 1, 3, 7]), [1, 3, 3, 5, 7, 9]);
  });

  test('2. Casos límite: vacío y un elemento', () => {
    assert.deepEqual(MergeSort.ordenar([]), []);
    assert.deepEqual(MergeSort.ordenar([42]), [42]);
  });

  test('3. No modifica el arreglo original y devuelve uno nuevo', () => {
    const original = [3, 1, 2];
    const resultado = MergeSort.ordenar(original);
    assert.deepEqual(original, [3, 1, 2]);
    assert.notEqual(resultado, original);
  });

  test('4. Entradas ya ordenadas, inversas y con todos los valores iguales', () => {
    assert.deepEqual(MergeSort.ordenar([1, 2, 3, 4]), [1, 2, 3, 4]);
    assert.deepEqual(MergeSort.ordenar([4, 3, 2, 1]), [1, 2, 3, 4]);
    assert.deepEqual(MergeSort.ordenar([7, 7, 7]), [7, 7, 7]);
  });

  test('5. Valida los parámetros', () => {
    assert.throws(() => MergeSort.ordenar('hola'), TypeError);
    assert.throws(() => MergeSort.ordenar([1], 'no soy función'), TypeError);
    assert.throws(() => MergeSort.crearComparador([]), TypeError);
    assert.throws(() => MergeSort.crearComparador([{ campo: 'x', orden: 'arriba' }]), RangeError);
  });
});

describe('MergeSort - texto', () => {
  test('6. Alfabético en español: ignora tildes y mayúsculas', () => {
    const r = MergeSort.ordenar(['Zeta', 'Árbol', 'abeja', 'Ángel', 'angel']);
    assert.deepEqual(r, ['abeja', 'angel', 'Ángel', 'Árbol', 'Zeta']);
  });
});

describe('MergeSort - múltiples criterios', () => {
  const registros = [
    { id: 'a', visitas: 100, nombre: 'Parque Jipiro' },
    { id: 'b', visitas: 300, nombre: 'Teatro Bolívar' },
    { id: 'c', visitas: 300, nombre: 'Catedral' },
    { id: 'd', visitas: 100, nombre: 'Árbol Milenario' },
    { id: 'e', visitas: 200, nombre: 'Vilcabamba' },
  ];

  test('7. Visitas de mayor a menor y, en empate, nombre alfabético', () => {
    const cmp = MergeSort.crearComparador([{ campo: 'visitas', orden: 'desc' }, 'nombre']);
    const r = MergeSort.ordenar(registros, cmp).map((x) => x.id);
    assert.deepEqual(r, ['c', 'b', 'e', 'd', 'a']);
  });

  test('8. Los valores nulos van siempre al final (asc y desc)', () => {
    const datos = [{ v: 2 }, { v: null }, { v: 1 }, {}];
    const asc = MergeSort.ordenar(datos, MergeSort.crearComparador([{ campo: 'v', orden: 'asc' }]));
    const desc = MergeSort.ordenar(datos, MergeSort.crearComparador([{ campo: 'v', orden: 'desc' }]));
    assert.deepEqual(asc.slice(0, 2).map((x) => x.v), [1, 2]);
    assert.deepEqual(desc.slice(0, 2).map((x) => x.v), [2, 1]);
  });

  test('9. Es estable: los empates conservan su orden original', () => {
    const cmp = MergeSort.crearComparador(['visitas']); // solo un criterio, hay empates
    const r = MergeSort.ordenar(registros, cmp).map((x) => x.id);
    assert.deepEqual(r, ['a', 'd', 'e', 'b', 'c']); // a antes que d; b antes que c
  });
});

describe('MergeSort - volumen', () => {
  test('10. 20 000 números aleatorios: salen ordenados y sin perder elementos', () => {
    const azar = crearAleatorio(2026);
    const datos = Array.from({ length: 20000 }, () => Math.floor(azar() * 1000));
    const r = MergeSort.ordenar(datos);
    assert.equal(r.length, datos.length);
    assert.ok(MergeSort.estaOrdenado(r));
    // Misma suma y mismo conteo por valor => es una permutación del original
    const cuenta = new Map();
    for (const x of datos) cuenta.set(x, (cuenta.get(x) || 0) + 1);
    for (const x of r) cuenta.set(x, cuenta.get(x) - 1);
    for (const v of cuenta.values()) assert.equal(v, 0);
  });

  test('11. Dataset real artes_vivas_loja.json (si está cargado)', (t) => {
    const ruta = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');
    if (!fs.existsSync(ruta) || fs.statSync(ruta).size === 0) return t.skip('artes_vivas_loja.json vacío');
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const cmp = MergeSort.crearComparador([{ campo: 'fecha', orden: 'desc' }, 'nombre_lugar', 'id']);
    const r = MergeSort.ordenar(datos, cmp);
    assert.equal(r.length, datos.length);
    assert.ok(MergeSort.estaOrdenado(r, cmp));
    assert.equal(new Set(r.map((x) => x.id)).size, datos.length); // ningún registro se perdió ni se duplicó
  });
});
