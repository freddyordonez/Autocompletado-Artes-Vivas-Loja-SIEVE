'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const MergeSort = require('../src/models/MergeSort');
const Busqueda = require('../src/models/Busqueda');
const ArchivoIndexado = require('../src/models/ArchivoIndexado');

const RUTA_DATASET = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');
const hayDataset = fs.existsSync(RUTA_DATASET) && fs.statSync(RUTA_DATASET).size > 0;

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

const registrosDe = (claves) => claves.map((id) => ({ id }));

describe('Búsqueda secuencial', () => {
  test('1. Encuentra el índice y cuenta las comparaciones (posición + 1)', () => {
    const datos = registrosDe(['d', 'a', 'c', 'b']);
    Busqueda.reiniciar();
    assert.equal(Busqueda.secuencial(datos, 'id', 'c'), 2);
    assert.equal(Busqueda.comparaciones, 3);
  });

  test('2. Si no existe devuelve -1 tras recorrer los n registros', () => {
    const datos = registrosDe(['d', 'a', 'c', 'b']);
    Busqueda.reiniciar();
    assert.equal(Busqueda.secuencial(datos, 'id', 'z'), -1);
    assert.equal(Busqueda.comparaciones, 4);
  });

  test('3. Arreglo vacío', () => {
    assert.equal(Busqueda.secuencial([], 'id', 'a'), -1);
  });
});

describe('Búsqueda binaria', () => {
  const ordenado = MergeSort.ordenar(registrosDe(['m', 'c', 'x', 'a', 'k', 'z', 'f']), MergeSort.crearComparador(['id']));

  test('4. Encuentra cada elemento de un arreglo ordenado', () => {
    for (let i = 0; i < ordenado.length; i++) {
      assert.equal(Busqueda.binaria(ordenado, 'id', ordenado[i].id), i);
    }
  });

  test('5. Devuelve -1 si el valor no está (antes, en medio y después)', () => {
    assert.equal(Busqueda.binaria(ordenado, 'id', '0'), -1);
    assert.equal(Busqueda.binaria(ordenado, 'id', 'g'), -1);
    assert.equal(Busqueda.binaria(ordenado, 'id', '~'), -1);
  });

  test('6. Casos límite: vacío y un elemento', () => {
    assert.equal(Busqueda.binaria([], 'id', 'a'), -1);
    assert.equal(Busqueda.binaria(registrosDe(['a']), 'id', 'a'), 0);
    assert.equal(Busqueda.binaria(registrosDe(['a']), 'id', 'b'), -1);
  });

  test('7. Nunca supera floor(log2 n) + 1 comparaciones', () => {
    const azar = crearAleatorio(7);
    const datos = Array.from({ length: 1000 }, (_, i) => ({ id: 'ID-' + String(i * 3).padStart(5, '0') }));
    const limite = Math.floor(Math.log2(datos.length)) + 1;
    for (let k = 0; k < 300; k++) {
      Busqueda.reiniciar();
      Busqueda.binaria(datos, 'id', 'ID-' + String(Math.floor(azar() * 3200)).padStart(5, '0'));
      assert.ok(Busqueda.comparaciones <= limite, `usó ${Busqueda.comparaciones} > ${limite}`);
    }
  });

  test('8. Funciona con texto con tildes ordenado por MergeSort', () => {
    const nombres = registrosDe(['Árbol', 'abeja', 'Ángel', 'Zeta', 'ñandú', 'oso']);
    const ord = MergeSort.ordenar(nombres, MergeSort.crearComparador(['id']));
    for (const n of nombres) assert.equal(ord[Busqueda.binaria(ord, 'id', n.id)].id, n.id);
  });

  test('9. Funciona con números', () => {
    const ord = MergeSort.ordenar([{ v: 30 }, { v: 10 }, { v: 20 }], MergeSort.crearComparador(['v']));
    assert.equal(Busqueda.binaria(ord, 'v', 20), 1);
    assert.equal(Busqueda.binaria(ord, 'v', 25), -1);
  });
});

describe('Búsqueda por rango (valores repetidos)', () => {
  const datos = MergeSort.ordenar(
    registrosDe(['b', 'a', 'c', 'b', 'b', 'a', 'd']).map((r) => ({ nombre: r.id })),
    MergeSort.crearComparador(['nombre'])
  ); // a a b b b c d

  test('10. Ubica todos los registros iguales', () => {
    assert.deepEqual(Busqueda.rango(datos, 'nombre', 'b'), { inicio: 2, fin: 5, cantidad: 3 });
    assert.deepEqual(Busqueda.rango(datos, 'nombre', 'a'), { inicio: 0, fin: 2, cantidad: 2 });
    assert.deepEqual(Busqueda.rango(datos, 'nombre', 'd'), { inicio: 6, fin: 7, cantidad: 1 });
  });

  test('11. Valor inexistente: cantidad 0', () => {
    assert.equal(Busqueda.rango(datos, 'nombre', 'bb').cantidad, 0);
    assert.equal(Busqueda.rango(datos, 'nombre', 'z').cantidad, 0);
  });

  test('12. Coincide con el conteo secuencial', () => {
    for (const v of ['a', 'b', 'c', 'd', 'x']) {
      assert.equal(Busqueda.rango(datos, 'nombre', v).cantidad, Busqueda.contarSecuencial(datos, 'nombre', v));
    }
  });
});

describe('Dataset real', () => {
  test('13. Ambas búsquedas coinciden en 1 000 consultas (existentes e inexistentes)', (t) => {
    if (!hayDataset) return t.skip('artes_vivas_loja.json vacío');
    const base = JSON.parse(fs.readFileSync(RUTA_DATASET, 'utf8'));
    const porId = MergeSort.ordenar(base, MergeSort.crearComparador(['id']));
    const azar = crearAleatorio(99);
    for (let k = 0; k < 1000; k++) {
      const valor = k % 5 === 0 ? 'NO-EXISTE-' + k : base[Math.floor(azar() * base.length)].id;
      const iSeq = Busqueda.secuencial(base, 'id', valor);
      const iBin = Busqueda.binaria(porId, 'id', valor);
      if (iSeq === -1) assert.equal(iBin, -1);
      else assert.equal(porId[iBin].id, base[iSeq].id);
    }
  });

  test('14. El conteo por nombre_lugar coincide entre rango binario y recorrido completo', (t) => {
    if (!hayDataset) return t.skip('artes_vivas_loja.json vacío');
    const base = JSON.parse(fs.readFileSync(RUTA_DATASET, 'utf8'));
    const porNombre = MergeSort.ordenar(base, MergeSort.crearComparador(['nombre_lugar', 'id']));
    const nombres = new Set(base.map((r) => r.nombre_lugar));
    let total = 0;
    for (const nombre of nombres) {
      const cantidad = Busqueda.rango(porNombre, 'nombre_lugar', nombre).cantidad;
      assert.equal(cantidad, Busqueda.contarSecuencial(base, 'nombre_lugar', nombre));
      total += cantidad;
    }
    assert.equal(total, base.length);
  });
});

describe('Archivo indexado', () => {
  let carpeta;
  let archivo;
  let registros;

  before(() => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'indexado-test-'));
    registros = Array.from({ length: 600 }, (_, i) => ({ id: 'LOJ-' + String((i * 7919) % 100000).padStart(5, '0'), nombre: 'Lugar ñandú ' + i }));
    const datos = path.join(carpeta, 'datos.ndjson');
    ArchivoIndexado.escribirDatos(datos, registros);
    archivo = new ArchivoIndexado(datos, path.join(carpeta, 'datos_id.idx'), 'id');
    archivo.construirIndice();
    archivo.abrir();
  });

  after(() => {
    archivo.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  test('15. El índice tiene una entrada de 24 bytes por registro', () => {
    assert.equal(archivo.total, 600);
    assert.equal(fs.statSync(archivo.rutaIndice).size, 600 * 24);
  });

  test('16. Binaria y secuencial encuentran el mismo registro', () => {
    for (const r of [registros[0], registros[299], registros[599]]) {
      assert.deepEqual(archivo.buscarBinario(r.id), r);
      assert.deepEqual(archivo.buscarSecuencial(r.id), r);
    }
  });

  test('17. Una clave inexistente devuelve null', () => {
    assert.equal(archivo.buscarBinario('LOJ-NO'), null);
    assert.equal(archivo.buscarSecuencial('LOJ-NO'), null);
  });

  test('18. La binaria lee muy pocas veces el disco', () => {
    archivo.reiniciarContadores();
    archivo.buscarBinario(registros[123].id);
    const lecturasBinaria = archivo.lecturas;
    assert.ok(lecturasBinaria <= Math.floor(Math.log2(600)) + 2, `lecturas: ${lecturasBinaria}`);
    assert.ok(archivo.comparaciones <= Math.floor(Math.log2(600)) + 1);

    archivo.reiniciarContadores();
    archivo.buscarSecuencial('LOJ-NO'); // peor caso: lee todo el archivo
    assert.equal(archivo.comparaciones, 600);
    assert.ok(archivo.bytesLeidos > lecturasBinaria * 24);
  });
});
