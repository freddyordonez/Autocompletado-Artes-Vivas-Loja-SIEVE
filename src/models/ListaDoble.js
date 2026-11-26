'use strict';

const NodoDoble = require('./NodoDoble');

class ListaDoble {
  constructor() {
    this.head = null; // Más reciente (inserciones van aquí)
    this.tail = null; // Más antiguo (evicción inicia cerca de la cola)
    this.length = 0;
  }

  insertAtHead(key, value) {
    const node = new NodoDoble(key, value);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.length++;
    return node;
  }

  removeNode(node) {
    if (!node) return null;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
    this.length = Math.max(0, this.length - 1);
    return node;
  }

  removeTail() {
    if (!this.tail) return null;
    return this.removeNode(this.tail);
  }
}

module.exports = ListaDoble;