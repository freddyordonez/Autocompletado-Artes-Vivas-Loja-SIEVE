const input = document.getElementById('searchInput');
const policySelect = document.getElementById('policySelect');
const metrics = document.getElementById('metrics');
const resultsList = document.getElementById('resultsList');
const compareBody = document.getElementById('compareBody');

let timer = null;

function renderComparativa(comp) {
  if (!comp) return;
  const rows = [
    { label: 'SIEVE', st: comp.sieve },
    { label: 'LRU', st: comp.lru },
    { label: 'FIFO', st: comp.fifo },
  ];

  compareBody.innerHTML = rows
    .map(
      ({ label, st }) => `
      <tr>
        <td><strong>${label}</strong></td>
        <td>${st.size} / ${st.capacity}</td>
        <td>${st.hits}</td>
        <td>${st.misses}</td>
        <td>${st.hitRate}%</td>
      </tr>`
    )
    .join('');
}

async function ejecutarBusqueda() {
  const q = input.value.trim();
  const policy = policySelect.value;

  if (!q) {
    resultsList.innerHTML = '';
    metrics.textContent = `Estado: listo | Política activa: ${policy.toUpperCase()}`;
    return;
  }

  const res = await fetch(`/api/autocompletar?q=${encodeURIComponent(q)}&limit=8&policy=${encodeURIComponent(policy)}`);
  const data = await res.json();

  metrics.textContent = `[${data.policy.toUpperCase()}] ${data.source} | ${data.elapsedMs} ms | Hit Rate: ${data.cache.hitRate}% (${data.cache.hits} hits / ${data.cache.misses} misses)`;
  renderComparativa(data.comparativa);

  resultsList.innerHTML = data.results
    .map(
      (item) => `
      <li>
        <strong>${item.nombre_lugar}</strong>
        <span>${item.categoria || ''} — ${item.zona || ''} (${item.anio || ''})</span>
      </li>`
    )
    .join('');
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(ejecutarBusqueda, 120);
});

policySelect.addEventListener('change', () => {
  if (input.value.trim()) {
    ejecutarBusqueda();
  } else {
    metrics.textContent = `Estado: listo | Política activa: ${policySelect.value.toUpperCase()}`;
  }
});

fetch('/api/comparativa')
  .then((r) => r.json())
  .then(renderComparativa)
  .catch(() => {});