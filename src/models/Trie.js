'use strict';

const NodoTrie = require('./NodoTrie');

class Trie {
  constructor() {
    this.root = new NodoTrie();
  }

  static normalizar(texto = '') {
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  insert(registro, campo = 'nombre_lugar') {
    if (!registro || !registro[campo]) return;
    const raw = String(registro[campo]).trim();
    const key = Trie.normalizar(raw);
    if (!key) return;

    let current = this.root;
    for (const ch of key) {
      if (!current.children.has(ch)) {
        current.children.set(ch, new NodoTrie());
      }
      current = current.children.get(ch);
      if (current.items.length < 25) {
        current.items.push(registro);
      }
    }
    current.isEndOfWord = true;
  }

  searchPrefix(prefix, limit = 10) {
    const key = Trie.normalizar(prefix);
    if (!key) return [];

    let current = this.root;
    for (const ch of key) {
      if (!current.children.has(ch)) {
        return [];
      }
      current = current.children.get(ch);
    }

    const resultados = [];
    const vistos = new Set();

    const dfs = (node) => {
      if (resultados.length >= limit || !node) return;
      for (const item of node.items) {
        const idKey = item.id || `${item.nombre_lugar}-${item.fecha}`;
        if (!vistos.has(idKey)) {
          vistos.add(idKey);
          resultados.push(item);
          if (resultados.length >= limit) return;
        }
      }
      for (const child of node.children.values()) {
        if (resultados.length >= limit) return;
        dfs(child);
      }
    };

    dfs(current);
    return resultados;
  }
}

module.exports = Trie;