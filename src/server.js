'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const Trie = require('./models/Trie');
const CacheSieve = require('./models/CacheSieve');
const CacheLRU = require('./models/CacheLRU');
const CacheFIFO = require('./models/CacheFIFO');

const app = express();
const PORT = process.env.PORT || 3000;

const datasetPath = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');
const registros = require(datasetPath);

const trie = new Trie();
for (const reg of registros) {
  trie.insert(reg, 'nombre_lugar');
}

const caches = {
  sieve: new CacheSieve(256),
  lru: new CacheLRU(256),
  fifo: new CacheFIFO(256),
};

function getCacheByPolicy(policyParam) {
  const key = String(policyParam || 'sieve').toLowerCase();
  return caches[key] ? { key, instance: caches[key] } : { key: 'sieve', instance: caches.sieve };
}

const candidatosPublic = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '..', 'public'),
  path.join(process.cwd(), 'src', 'public'),
  path.join(process.cwd(), 'public'),
];

const publicDir = candidatosPublic.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || candidatosPublic[0];
console.log('Sirviendo archivos estáticos desde:', publicDir);

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send(`No se encontró index.html en ${publicDir}`);
  }
  return res.sendFile(indexPath);
});

app.get('/api/comparativa', (req, res) => {
  res.json({
    sieve: caches.sieve.stats(),
    lru: caches.lru.stats(),
    fifo: caches.fifo.stats(),
  });
});

app.get('/api/autocompletar', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
  const { key: policy, instance: activeCache } = getCacheByPolicy(req.query.policy);

  if (!q) {
    return res.json({
      query: q,
      policy,
      source: 'NONE',
      elapsedMs: 0,
      results: [],
      cache: activeCache.stats(),
      comparativa: {
        sieve: caches.sieve.stats(),
        lru: caches.lru.stats(),
        fifo: caches.fifo.stats(),
      },
    });
  }

  const t0 = process.hrtime.bigint();
  const cacheKey = `${Trie.normalizar(q)}::${limit}`;
  const cached = activeCache.get(cacheKey);

  if (cached) {
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return res.json({
      query: q,
      policy,
      source: 'HIT',
      elapsedMs: Number(elapsedMs.toFixed(4)),
      results: cached,
      cache: activeCache.stats(),
      comparativa: {
        sieve: caches.sieve.stats(),
        lru: caches.lru.stats(),
        fifo: caches.fifo.stats(),
      },
    });
  }

  const results = trie.searchPrefix(q, limit);
  activeCache.put(cacheKey, results);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  return res.json({
    query: q,
    policy,
    source: 'MISS',
    elapsedMs: Number(elapsedMs.toFixed(4)),
    results,
    cache: activeCache.stats(),
    comparativa: {
      sieve: caches.sieve.stats(),
      lru: caches.lru.stats(),
      fifo: caches.fifo.stats(),
    },
  });
});

app.listen(PORT, () => {
  console.log(`Servidor FIAVL Autocompletado (SIEVE / LRU / FIFO) en http://localhost:${PORT} (${registros.length} registros cargados)`);
});