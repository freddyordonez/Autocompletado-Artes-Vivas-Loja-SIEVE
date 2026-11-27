const input = document.getElementById('searchInput');
const policySelect = document.getElementById('policySelect');
const metrics = document.getElementById('metrics');
const resultsList = document.getElementById('resultsList');
const compareBody = document.getElementById('compareBody');
const cacheBadge = document.getElementById('cacheBadge');

let timer = null;
let requestSeq = 0; // descarta respuestas viejas si llegan fuera de orden
const lastSnapshot = {}; // por política: { hits, misses } de la última respuesta

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Etiqueta dinámica #cacheBadge: HIT · POLÍTICA / MISS · Trie ---------- */

function setBadge(state, text, pulse = true) {
  if (!cacheBadge) return;
  cacheBadge.dataset.state = state;
  cacheBadge.textContent = text;
  cacheBadge.classList.remove('is-pulse');
  if (pulse) {
    void cacheBadge.offsetWidth; // reinicia la animación
    cacheBadge.classList.add('is-pulse');
  }
}

function setBadgeIdle() {
  setBadge('idle', `EN ESPERA · ${policySelect.value.toUpperCase()}`, false);
}

/**
 * Decide si la respuesta salió de la caché (HIT) o del Trie (MISS).
 * 1) Banderas booleanas explícitas, si el backend las envía.
 * 2) Texto de `data.source` (el mismo que se muestra en #metrics).
 * 3) Respaldo: si los hits de la política aumentaron respecto a la respuesta anterior.
 */
function resolveHit(data, policy) {
  for (const key of ['hit', 'cacheHit', 'fromCache']) {
    if (typeof data[key] === 'boolean') return data[key];
  }

  const src = String(data.source ?? '').toLowerCase();
  if (/miss|trie|árbol|arbol/.test(src)) return false;
  if (/hit|cach/.test(src)) return true;

  const c = data.cache || {};
  const prev = lastSnapshot[policy];
  return Boolean(prev && Number(c.hits) > Number(prev.hits));
}

/* ---------- Tabla comparativa ---------- */

function markActiveRow() {
  const active = policySelect.value.toLowerCase();
  Array.from(compareBody.rows).forEach((row) => {
    const label = (row.cells[0]?.textContent || '').trim().toLowerCase();
    row.classList.toggle('is-active', label === active);
  });
}

function renderComparativa(comp) {
  if (!comp) return;
  const rows = [
    { label: 'SIEVE', st: comp.sieve },
    { label: 'LRU', st: comp.lru },
    { label: 'FIFO', st: comp.fifo },
  ];

  compareBody.innerHTML = rows
    .map(({ label, st }) => {
      const pct = Math.max(0, Math.min(100, parseFloat(st.hitRate) || 0));
      return `
      <tr>
        <td><strong>${label}</strong></td>
        <td>${st.size} / ${st.capacity}</td>
        <td>${st.hits}</td>
        <td>${st.misses}</td>
        <td>${st.hitRate}% <span class="meter" aria-hidden="true"><b style="width:${pct}%"></b></span></td>
      </tr>`;
    })
    .join('');

  markActiveRow();
}

/* ---------- Búsqueda ---------- */

async function ejecutarBusqueda() {
  const q = input.value.trim();
  const policy = policySelect.value;
  const seq = ++requestSeq;

  if (!q) {
    resultsList.innerHTML = '';
    metrics.textContent = `Estado: listo | Política activa: ${policy.toUpperCase()}`;
    setBadgeIdle();
    return;
  }

  try {
    const res = await fetch(`/api/autocompletar?q=${encodeURIComponent(q)}&limit=8&policy=${encodeURIComponent(policy)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (seq !== requestSeq) return; // llegó una respuesta más nueva

    const usedPolicy = String(data.policy || policy);
    const c = data.cache || {};

    metrics.textContent = `[${usedPolicy.toUpperCase()}] ${data.source} | ${data.elapsedMs} ms | Hit Rate: ${c.hitRate}% (${c.hits} hits / ${c.misses} misses)`;

    const isHit = resolveHit(data, usedPolicy.toLowerCase());
    lastSnapshot[usedPolicy.toLowerCase()] = { hits: c.hits, misses: c.misses };
    setBadge(isHit ? 'hit' : 'miss', isHit ? `HIT · ${usedPolicy.toUpperCase()}` : 'MISS · Trie');

    renderComparativa(data.comparativa);

    const results = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0) {
      resultsList.innerHTML = `<li class="empty"><strong>Sin coincidencias</strong><span>Ningún nombre del catálogo empieza con «${escapeHtml(q)}».</span></li>`;
      return;
    }

    resultsList.innerHTML = results
      .map(
        (item) => `
      <li>
        <strong>${escapeHtml(item.nombre_lugar)}</strong>
        <span>${escapeHtml(item.categoria || '')} — ${escapeHtml(item.zona || '')} (${escapeHtml(item.anio || '')})</span>
      </li>`
      )
      .join('');
  } catch (err) {
    if (seq !== requestSeq) return;
    metrics.textContent = `Estado: sin conexión con /api/autocompletar (${err.message})`;
    setBadge('error', 'ERROR · API');
  }
}

/* ---------- Eventos ---------- */

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(ejecutarBusqueda, 120);
});

policySelect.addEventListener('change', () => {
  markActiveRow();
  if (input.value.trim()) {
    ejecutarBusqueda();
  } else {
    metrics.textContent = `Estado: listo | Política activa: ${policySelect.value.toUpperCase()}`;
    setBadgeIdle();
  }
});

// Atajos de ejemplo: rellenan el buscador y lanzan la consulta (repítelos para ver HIT).
document.querySelectorAll('[data-q]').forEach((btn) => {
  btn.addEventListener('click', () => {
    input.value = btn.dataset.q || '';
    input.focus();
    clearTimeout(timer);
    ejecutarBusqueda();
  });
});

/* ---------- Arranque ---------- */

setBadgeIdle();
markActiveRow();

fetch('/api/comparativa')
  .then((r) => r.json())
  .then(renderComparativa)
  .catch(() => {});