'use strict';

class NodoTrie {
  constructor() {
    this.children = new Map(); // char -> NodoTrie
    this.items = []; // registros asociados a este prefijo/nodo
    this.isEndOfWord = false;
  }
}

module.exports = NodoTrie;