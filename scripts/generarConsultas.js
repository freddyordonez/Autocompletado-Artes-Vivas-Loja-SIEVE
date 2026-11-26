'use strict';
/**
 * Generador de consultas SINTÉTICAS para el FIAVL 2026.
 * Autor: Joaquín Moscol — Grupo 4, Estructura de Datos (UNL)
 *
 * Simula a personas escribiendo en el buscador durante el festival:
 *  - Popularidad tipo Zipf: pocas obras se buscan muchísimo (como en la vida real).
 *  - Horas pico: la gente busca más entre 16:00 y 21:00.
 *  - La gente busca sobre todo lo que se presenta ese día o en los próximos días.
 *  - Un porcentaje de búsquedas son errores de tipeo que nunca se repiten
 *    (justo el caso donde SIEVE expulsa rápido y LRU no).
 *
 * Uso:   node scripts/generarConsultas.js            (50 000 consultas)
 *        node scripts/generarConsultas.js 10000      (cantidad personalizada)
 * Salida: data/fiavl2026_consultas.json
 */
const fs = require('node:fs');
const path = require('node:path');

const CANTIDAD = Number(process.argv[2]) || 50000;
const SEMILLA = 2026;               // misma semilla => mismos datos siempre
const PORCENTAJE_TYPOS = 0.12;      // 12 % de búsquedas "de una sola vez"

const RUTA_EVENTOS = path.join(__dirname, '..', 'data', 'fiavl2026_eventos.json');
const RUTA_SALIDA = path.join(__dirname, '..', 'data', 'fiavl2026_consultas.json');

// ---------- Aleatorio con semilla (mulberry32) ----------
function crearAleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = crearAleatorio(SEMILLA);
const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));
const elegir = (arr) => arr[Math.floor(azar() * arr.length)];

// Quita tildes y pasa a minúsculas, igual que el Trie
const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------- Datos base ----------
const eventos = JSON.parse(fs.readFileSync(RUTA_EVENTOS, 'utf8'));

// Una obra puede tener varias funciones: la popularidad se asigna por obra.
const obras = [...new Set(eventos.map((e) => e.nombre))];
// Orden de popularidad: barajado con la semilla (Fisher-Yates)
for (let i = obras.length - 1; i > 0; i--) {
  const j = Math.floor(azar() * (i + 1));
  [obras[i], obras[j]] = [obras[j], obras[i]];
}
const pesoObra = new Map(obras.map((nombre, i) => [nombre, 1 / (i + 1)])); // Zipf, alfa = 1

const DIAS = Array.from({ length: 11 }, (_, i) => 12 + i); // 12..22 de noviembre
const ZONAS_USUARIO = ['Centro histórico', 'Jipiro (norte)', 'San Sebastián', 'El Valle', 'La Argelia (sur)', 'Visitante de fuera de Loja'];

// Hora con picos en la tarde/noche
function horaConPico() {
  const r = azar();
  if (r < 0.15) return entero(7, 11);   // mañana
  if (r < 0.35) return entero(12, 15);  // mediodía
  if (r < 0.85) return entero(16, 21);  // pico
  return entero(22, 23);                // noche
}

// Elige una función según popularidad y cercanía al día de la búsqueda
function elegirEvento(dia) {
  const candidatos = eventos.filter((e) => {
    const d = Number(e.fecha.slice(8, 10));
    return d >= dia && d <= dia + 2; // hoy o los próximos 2 días
  });
  const lista = candidatos.length ? candidatos : eventos;
  const total = lista.reduce((s, e) => s + pesoObra.get(e.nombre), 0);
  let r = azar() * total;
  for (const e of lista) {
    r -= pesoObra.get(e.nombre);
    if (r <= 0) return e;
  }
  return lista.at(-1);
}

function typoAleatorio() {
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  let t = '';
  for (let i = 0, n = entero(3, 7); i < n; i++) t += letras[Math.floor(azar() * letras.length)];
  return t;
}

// ---------- Generación ----------
const consultas = [];
for (let i = 1; i <= CANTIDAD; i++) {
  const dia = elegir(DIAS);
  const hora = horaConPico();
  const fechaHora = `2026-11-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(entero(0, 59)).padStart(2, '0')}:00-05:00`;
  const usuario = `U${String(entero(1, 8000)).padStart(4, '0')}`;

  let texto;
  let evento = null;
  if (azar() < PORCENTAJE_TYPOS) {
    texto = typoAleatorio();
  } else {
    evento = elegirEvento(dia);
    const nombre = normalizar(evento.nombre);
    texto = nombre.slice(0, entero(2, Math.min(10, nombre.length))); // lo que alcanzó a escribir
  }

  consultas.push({
    id: `Q-${String(i).padStart(6, '0')}`,
    fecha_hora: fechaHora,
    usuario,
    zona_usuario: elegir(ZONAS_USUARIO),
    texto_escrito: texto,
    evento_id: evento ? evento.id : null,
    evento_nombre: evento ? evento.nombre : null,
    tipo_dato: 'sintético',
  });
}

// Ordenadas por fecha, como un registro real de un servidor
consultas.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

fs.writeFileSync(RUTA_SALIDA, '[\n' + consultas.map((c) => JSON.stringify(c)).join(',\n') + '\n]\n');

// ---------- Resumen ----------
const conteo = new Map();
for (const c of consultas) if (c.evento_nombre) conteo.set(c.evento_nombre, (conteo.get(c.evento_nombre) || 0) + 1);
const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
const unicos = new Set(consultas.map((c) => c.texto_escrito)).size;

console.log(`✔ ${consultas.length} consultas sintéticas -> ${path.relative(process.cwd(), RUTA_SALIDA)}`);
console.log(`  Funciones reales usadas: ${eventos.length} (${obras.length} obras)`);
console.log(`  Textos distintos escritos: ${unicos}`);
console.log('  Obras más buscadas:');
top.forEach(([n, c], i) => console.log(`   ${i + 1}. ${n} (${c})`));
