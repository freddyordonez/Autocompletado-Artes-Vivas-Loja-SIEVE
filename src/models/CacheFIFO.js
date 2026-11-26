'use strict';

const ListaDoble = require('./ListaDoble');

class CacheFIFO {
  constructor(capacity = 256) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('La capacidad de la caché debe ser un entero positivo.');
    }
    this.policy = 'FIFO';
    this.capacity = capacity;
    this.map = new Map();
    this.list = new ListaDoble();
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
    this.hits++;
    return node.value;
  }

  put(key, value) {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      return;
    }

    if (this.map.size >= this.capacity) {
      const evicted = this.list.removeTail();
      if (evicted) {
        this.map.delete(evicted.key);
      }
    }

    const newNode = this.list.insertAtHead(key, value);
    this.map.set(key, newNode);
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      policy: this.policy,
      size: this.size(),
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0,
    };
  }
}

module.exports = CacheFIFO;