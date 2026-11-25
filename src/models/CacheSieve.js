'use strict';

const ListaDoble = require('./ListaDoble');

class CacheSieve {
  constructor(capacity = 500) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('La capacidad de la caché debe ser un entero positivo.');
    }
    this.capacity = capacity;
    this.map = new Map(); // key -> NodoDoble
    this.list = new ListaDoble();
    this.hand = null;
    this.hits = 0;
    this.misses = 0;
  }

  size() {
    return this.map.size;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return null;
    }
    node.visited = true; // Lazy promotion sin reordenar la lista
    this.hits++;
    return node.value;
  }

  _evict() {
    if (this.list.length === 0) return;

    let current = this.hand || this.list.tail;
    let steps = 0;
    const maxSteps = this.list.length * 3 + 5;

    while (current && steps < maxSteps) {
      if (!current.visited) {
        const nextCandidate = current.prev || this.list.tail;
        this.list.removeNode(current);
        this.map.delete(current.key);
        this.hand = this.map.size > 0 ? nextCandidate : null;
        return;
      }
      current.visited = false;
      current = current.prev || this.list.tail;
      steps++;
    }

    // Respaldo de seguridad si todos estaban visitados
    const evicted = this.list.removeTail();
    if (evicted) {
      this.map.delete(evicted.key);
      this.hand = this.list.tail;
    }
  }

  put(key, value) {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.visited = true;
      return;
    }

    if (this.map.size >= this.capacity) {
      this._evict();
    }

    const newNode = this.list.insertAtHead(key, value);
    newNode.visited = false;
    this.map.set(key, newNode);
    if (!this.hand) {
      this.hand = this.list.tail;
    }
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.size(),
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0,
    };
  }
}

module.exports = CacheSieve;
