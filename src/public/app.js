const input = document.getElementById('searchInput');
const metrics = document.getElementById('metrics');
const resultsList = document.getElementById('resultsList');

let timer = null;

input.addEventListener('input', () => {
  clearTimeout(timer);
  const q = input.value.trim();
  if (!q) {
    resultsList.innerHTML = '';
    metrics.textContent = 'Estado: listo';
    return;
  }

  timer = setTimeout(async () => {
    const res = await fetch(`/api/autocompletar?q=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    metrics.textContent = `${data.source} | ${data.elapsedMs} ms | Hit Rate: ${data.cache.hitRate}% (${data.cache.hits} hits / ${data.cache.misses} misses)`;

    resultsList.innerHTML = data.results
      .map(
        (item) => `
        <li>
          <strong>${item.nombre_lugar}</strong>
          <span>${item.categoria || ''} — ${item.zona || ''} (${item.anio || ''})</span>
        </li>`
      )
      .join('');
  }, 120);
});