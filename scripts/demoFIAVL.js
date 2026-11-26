'use strict';
/**
 * DEMO: Dataset FIAVL 2026 + Árbol Trie + Caché SIEVE
 * Autor: Joaquín Moscol — Grupo 4, Estructura de Datos (UNL)
 *
 * Uso:  node scripts/demoFIAVL.js
 *
 * 1. Carga los eventos REALES del festival en el Trie.
 * 2. Muestra búsquedas por prefijo (autocompletado).
 * 3. Pasa las 50 000 consultas SINTÉTICAS por tres estrategias:
 *    sin caché, LRU y SIEVE, y compara aciertos y tiempo.
 */
const fs = require('node:fs');
const path = require('node:path');
const Trie = require('../src/models/Trie');

const RUTA_EVENTOS = path.join(__dirname, '..', 'data', 'fiavl2026_eventos.json');
const RUTA_CONSULTAS = path.join(__dirname, '..', 'data', 'fiavl2026_consultas.json');

if (!fs.existsSync(RUTA_CONSULTAS)) {
  console.log('Primero genera las consultas:  node scripts/generarConsultas.js');
  process.exit(1);
}

const eventos = JSON.parse(fs.readFileSync(RUTA_EVENTOS, 'utf8'));
const consultas = JSON.parse(fs.readFileSync(RUTA_CONSULTAS, 'utf8'));

// ---------- Cachés para comparar (Map + lista doblemente enlazada) ----------
class Nodo {
  constructor(clave, valor) { this.clave = clave; this.valor = valor; this.prev = null; this.next = null; this.visitado = false; }
}
class Lista {
  constructor() { this.cabeza = null; this.cola = null; }
  alInicio(n) { n.prev = null; n.next = this.cabeza; if (this.cabeza) this.cabeza.prev = n; else this.cola = n; this.cabeza = n; }
  quitar(n) {
    if (n.prev) n.prev.next = n.next; else this.cabeza = n.next;
    if (n.next) n.next.prev = n.prev; else this.cola = n.prev;
    n.prev = n.next = null;
  }
}
class CacheLRU {
  constructor(cap) { this.cap = cap; this.mapa = new Map(); this.lista = new Lista(); this.hits = 0; this.misses = 0; }
  get(k) {
    const n = this.mapa.get(k);
    if (!n) { this.misses++; return null; }
    this.hits++; this.lista.quitar(n); this.lista.alInicio(n); // mueve al frente EN CADA acierto
    return n.valor;
  }
  put(k, v) {
    if (this.mapa.size >= this.cap) { const c = this.lista.cola; this.lista.quitar(c); this.mapa.delete(c.clave); }
    const n = new Nodo(k, v); this.lista.alInicio(n); this.mapa.set(k, n);
  }
}
class CacheSIEVE {
  constructor(cap) { this.cap = cap; this.mapa = new Map(); this.lista = new Lista(); this.mano = null; this.hits = 0; this.misses = 0; }
  get(k) {
    const n = this.mapa.get(k);
    if (!n) { this.misses++; return null; }
    this.hits++; n.visitado = true; // solo marca, NO mueve
    return n.valor;
  }
  put(k, v) {
    if (this.mapa.size >= this.cap) {
      let n = this.mano || this.lista.cola;
      while (n.visitado) { n.visitado = false; n = n.prev || this.lista.cola; }
      this.mano = n.prev;
      this.lista.quitar(n); this.mapa.delete(n.clave);
    }
    const n = new Nodo(k, v); this.lista.alInicio(n); this.mapa.set(k, n);
  }
}

// ---------- 1. Cargar el Trie ----------
console.log('\n================ DEMO FIAVL 2026 · Trie + Caché SIEVE ================\n');
let t0 = process.hrtime.bigint();
const trie = new Trie();
for (const e of eventos) trie.insert(e, 'nombre');
const msCarga = Number(process.hrtime.bigint() - t0) / 1e6;

const obras = new Set(eventos.map((e) => e.nombre)).size;
const sedes = new Set(eventos.map((e) => e.sede)).size;
console.log('1) DATASET');
console.log(`   Eventos REALES:      ${eventos.length} funciones · ${obras} obras · ${sedes} sedes`);
console.log(`   Consultas SINTÉTICAS: ${consultas.length.toLocaleString('es-EC')} búsquedas de usuarios`);
console.log(`   Trie construido en ${msCarga.toFixed(2)} ms\n`);

// ---------- 2. Autocompletado ----------
console.log('2) AUTOCOMPLETADO (búsqueda por prefijo, O(L))');
for (const prefijo of ['el', 'gro', 'tec', 'nada', 'zz']) {
  const r = trie.searchPrefix(prefijo, 3);
  const texto = r.length ? r.map((e) => `${e.nombre} (${e.fecha.slice(8)}/nov ${e.hora}, ${e.sede})`).join('\n      ') : '(sin resultados)';
  console.log(`   "${prefijo}" ->\n      ${texto}`);
}

// ---------- 3. Comparar estrategias ----------
function simular(nombre, cache) {
  const inicio = process.hrtime.bigint();
  for (const c of consultas) {
    const clave = Trie.normalizar(c.texto_escrito);
    if (!cache) { trie.searchPrefix(clave, 10); continue; }
    if (cache.get(clave) === null) cache.put(clave, trie.searchPrefix(clave, 10));
  }
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  const tasa = cache ? ((cache.hits / (cache.hits + cache.misses)) * 100).toFixed(1) + ' %' : '—';
  return { estrategia: nombre, 'tasa de aciertos': tasa, 'tiempo total (ms)': ms.toFixed(1) };
}

console.log('\n3) COMPARACIÓN CON 50 000 CONSULTAS');
simular('calentamiento', new CacheSIEVE(50)); // calienta el motor de JavaScript
for (const cap of [50, 200]) {
  console.log(`\n   Capacidad de la caché: ${cap} entradas`);
  console.table([
    simular('Sin caché (solo Trie)', null),
    simular('LRU', new CacheLRU(cap)),
    simular('SIEVE', new CacheSIEVE(cap)),
  ]);
}

console.log('\nConclusión: con pocas obras muy buscadas y muchas búsquedas "de una sola vez",');
console.log('SIEVE mantiene en caché lo popular y descarta rápido lo raro, sin reordenar la lista en cada acierto.\n');
