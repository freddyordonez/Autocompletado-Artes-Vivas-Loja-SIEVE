'use strict';

class NodoDoble {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.visited = false;
    this.prev = null;
    this.next = null;
  }
}

module.exports = NodoDoble;