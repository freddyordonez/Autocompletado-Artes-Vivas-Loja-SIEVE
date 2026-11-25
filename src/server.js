'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const Trie = require('./models/Trie');
const CacheSieve = require('./models/CacheSieve');

const app = express();
const PORT = process.env.PORT || 3000;

const datasetPath = path.join(__dirname, '..', 'data', 'artes_vivas_loja.json');
const registros = require(datasetPath);

const trie = new Trie();
for (const reg of registros) {
  trie.insert(reg, 'nombre_lugar');
}

const cache = new CacheSieve(256);

const rootPublic = path.join(__dirname, '..', 'public');
const srcPublic = path.join(__dirname, 'public');
const publicDir = fs.existsSync(path.join(rootPublic, 'index.html')) ? rootPublic : srcPublic;

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/autocompletar', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);

  if (!q) {
    return res.json({ query: q, source: 'NONE', elapsedMs: 0, results: [], cache: cache.stats() });
  }

  const t0 = process.hrtime.bigint();
  const cacheKey = `${Trie.normalizar(q)}::${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    return res.json({
      query: q,
      source: 'HIT',
      elapsedMs: Number(elapsedMs.toFixed(4)),
      results: cached,
      cache: cache.stats(),
    });
  }

  const results = trie.searchPrefix(q, limit);
  cache.put(cacheKey, results);
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  return res.json({
    query: q,
    source: 'MISS',
    elapsedMs: Number(elapsedMs.toFixed(4)),
    results,
    cache: cache.stats(),
  });
});

app.listen(PORT, () => {
  console.log(`Servidor FIAVL Autocompletado SIEVE en http://localhost:${PORT} (${registros.length} registros cargados)`);
});