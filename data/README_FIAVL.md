# Dataset FIAVL 2026 — Joaquín Moscol (Grupo 4)

## 1. `fiavl2026_eventos.json` — datos REALES
Hay 78 funciones de 66 obras, en 22 sedes, del XI Festival Internacional de Artes Vivas de Loja (12–22 nov 2026).
La información se tomó de la agenda publicada en medios. Cada registro tiene en el campo `fuente` el enlace exacto de donde salió.

| Campo | Ejemplo | Nota |
|---|---|---|
| id | FIAVL-002 | Uno por función (una obra puede tener varias) |
| nombre | El cura sin cabeza | Campo que se indexa en el Trie |
| grupo | Cano Artes Escénicas | `null` si la fuente no lo dice |
| pais | Ecuador | `null` si la fuente no lo dice |
| disciplina | Teatro musical | `null` si la fuente no lo dice |
| sede | Teatro Nacional Benjamín Carrión Mora | |
| zona | Centro histórico | Agrupación aproximada para "zonas cercanas" |
| fecha / hora | 2026-11-12 / 15:00 | |
| precio_usd | 5 | 0 = gratis, `null` = no indicado |
| tipo_dato | real | |

Fuentes: El Universo, Ecuraices, Metro Ecuador, Primicias y kmcero.org (ver campo `fuente`).
La agenda completa tiene más de 400 actividades. Aquí están las que publicaron los medios con nombre, sede y hora.

## 2. `fiavl2026_consultas.json` — datos SINTÉTICOS
Son 50 000 búsquedas simuladas, generadas con `node scripts/generarConsultas.js`:
- **Popularidad Zipf:** pocas obras concentran la mayoría de búsquedas.
- **Horas pico:** la mayoría de búsquedas son entre 16:00 y 21:00.
- **Fechas:** se busca lo que se presenta hoy o en los 2 días siguientes.
- **Errores de tipeo:** el 12 % son búsquedas que no se repiten, que es el caso donde SIEVE gana a LRU.
- **Semilla fija (2026):** siempre se generan los mismos datos, así que los resultados son reproducibles.

## Uso con el Trie
```js
const Trie = require('../src/models/Trie');
const trie = new Trie();
require('../data/fiavl2026_eventos.json').forEach((e) => trie.insert(e, 'nombre'));
trie.searchPrefix('gro'); // -> Grotte (18 y 19 nov, Teatro Segundo Cueva Celi)
```
