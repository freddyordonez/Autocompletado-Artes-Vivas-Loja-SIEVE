const readline = require('node:readline/promises');
const ListaDobleNavegacion = require('./models/ListaDobleNavegacion');

/**
 * Interfaz interactiva en consola para la lista doblemente enlazada
 * del proyecto "Autocompletado Turístico de Loja" (Grupo 4).
 * Ejecutar con:  npm run menu   (o  node src/menu.js)
 */

// ---------- Colores ANSI (funcionan en PowerShell / Windows Terminal) ----------
const c = {
  reset: '\x1b[0m',
  negrita: '\x1b[1m',
  tenue: '\x1b[2m',
  verde: '\x1b[32m',
  amarillo: '\x1b[33m',
  azul: '\x1b[34m',
  magenta: '\x1b[35m',
  cian: '\x1b[36m',
  rojo: '\x1b[31m',
  gris: '\x1b[90m',
  fondoVerde: '\x1b[42m\x1b[30m',
};
const pintar = (color, texto) => `${color}${texto}${c.reset}`;

// Ancho visible (sin contar los códigos de color)
const ancho = (texto) => texto.replace(/\x1b\[[0-9;]*m/g, '').length;
const rellenar = (texto, n) => texto + ' '.repeat(Math.max(0, n - ancho(texto)));
const recortar = (texto, n) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto);

const ANCHO = 62;

function caja(lineas, color = c.cian) {
  const borde = (izq, der) => pintar(color, izq + '─'.repeat(ANCHO) + der);
  console.log(borde('╭', '╮'));
  for (const l of lineas) console.log(pintar(color, '│') + ' ' + rellenar(l, ANCHO - 1) + pintar(color, '│'));
  console.log(borde('╰', '╯'));
}

// ---------- Datos iniciales ----------
const lista = new ListaDobleNavegacion();
const iniciales = [
  { id: 1, nombre: 'Catedral Diocesana de Loja', categoria: 'Arquitectura y Religión', visitas: 1250 },
  { id: 2, nombre: 'Parque Nacional Podocarpus', categoria: 'Ecoturismo y Naturaleza', visitas: 3400 },
  { id: 3, nombre: 'Puerta de la Ciudad', categoria: 'Monumento Histórico', visitas: 5100 },
  { id: 4, nombre: 'Parque Recreacional Jipiro', categoria: 'Parques y Recreación', visitas: 4800 },
  { id: 5, nombre: 'Calle Lourdes', categoria: 'Patrimonio Colonial', visitas: 2300 },
];
iniciales.forEach((d) => lista.insertar(d));

let mensaje = pintar(c.verde, `✔ Se cargaron ${lista.longitud} destinos turísticos de Loja.`);

// ---------- Dibujo de la pantalla ----------
function dibujarEncabezado() {
  caja([
    pintar(c.negrita, '  🧭  AUTOCOMPLETADO TURÍSTICO DE LOJA'),
    pintar(c.gris, '      Lista doblemente enlazada · Navegación bidireccional'),
    pintar(c.gris, '      Estructura de Datos · UNL · Grupo 4'),
  ]);
}

function dibujarLista() {
  console.log();
  console.log(pintar(c.negrita, '  LISTA') + pintar(c.gris, `   (${lista.longitud} nodos · cabeza arriba, cola abajo)`));
  console.log();

  if (lista.longitud === 0) {
    console.log(pintar(c.gris, '      cabeza → null ← cola       (la lista está vacía)'));
    return;
  }

  let nodo = lista.cabeza;
  let posicion = 1;
  while (nodo !== null) {
    const esActual = nodo === lista.actual;
    const etiquetas = [];
    if (nodo === lista.cabeza) etiquetas.push('cabeza');
    if (nodo === lista.cola) etiquetas.push('cola');

    const texto = ` ${String(nodo.dato.id).padStart(2)} │ ${recortar(nodo.dato.nombre, 34)} `;
    const bloque = esActual ? pintar(c.fondoVerde, rellenar(texto, 42)) : rellenar(texto, 42);
    const marca = esActual ? pintar(c.verde + c.negrita, '◀ cursor') : '';
    const extremos = etiquetas.length ? pintar(c.amarillo, `[${etiquetas.join(' y ')}]`) + ' ' : '';

    console.log(`  ${pintar(c.gris, String(posicion).padStart(2))}  ${bloque} ${extremos}${marca}`);

    if (nodo.siguiente !== null) {
      console.log(pintar(c.gris, '            ▲ anterior   ▼ siguiente'));
    }
    nodo = nodo.siguiente;
    posicion++;
  }
}

function dibujarActual() {
  const d = lista.obtenerActual();
  console.log();
  if (!d) {
    caja([pintar(c.gris, 'Sin destino seleccionado')], c.gris);
    return;
  }
  const maxVisitas = Math.max(...[...recorrer()].map((x) => x.visitas || 0), 1);
  const largoBarra = Math.round(((d.visitas || 0) / maxVisitas) * 30);
  caja([
    pintar(c.negrita, `📍 ${d.nombre}`),
    `${pintar(c.gris, 'ID:')} ${d.id}    ${pintar(c.gris, 'Categoría:')} ${d.categoria ?? '—'}`,
    `${pintar(c.gris, 'Visitas:')} ${pintar(c.amarillo, '█'.repeat(largoBarra))}${pintar(c.gris, '░'.repeat(30 - largoBarra))} ${d.visitas ?? 0}`,
  ], c.verde);
}

function* recorrer() {
  for (let n = lista.cabeza; n !== null; n = n.siguiente) yield n.dato;
}

function dibujarMenu() {
  console.log();
  const op = (tecla, texto) => `${pintar(c.cian + c.negrita, `[${tecla}]`)} ${texto}`;
  console.log(`  ${rellenar(op('A', '◀ Retroceder'), 30)}${op('D', 'Avanzar ▶')}`);
  console.log(`  ${rellenar(op('1', 'Agregar al final'), 30)}${op('2', 'Insertar después del cursor')}`);
  console.log(`  ${rellenar(op('3', 'Eliminar destino actual'), 30)}${op('4', 'Buscar por ID')}`);
  console.log(`  ${rellenar(op('5', 'Ver métodos de utilidad'), 30)}${op('6', 'Vaciar lista')}`);
  console.log(`  ${op('0', 'Salir')}`);
  console.log();
  if (mensaje) console.log(`  ${mensaje}\n`);
}

function pantalla() {
  console.clear();
  dibujarEncabezado();
  dibujarLista();
  dibujarActual();
  dibujarMenu();
}

// ---------- Acciones ----------
async function pedirDestino(rl) {
  const nombre = (await rl.question(pintar(c.cian, '  Nombre del lugar: '))).trim();
  if (!nombre) return null;
  const categoria = (await rl.question(pintar(c.cian, '  Categoría: '))).trim() || 'Sin categoría';
  const visitas = Number(await rl.question(pintar(c.cian, '  Visitas: '))) || 0;
  const id = Math.max(0, ...[...recorrer()].map((d) => d.id)) + 1;
  return { id, nombre, categoria, visitas };
}

async function ejecutar(opcion, rl) {
  switch (opcion) {
    case 'a': {
      const d = lista.retroceder();
      mensaje = d ? pintar(c.verde, `◀ Retrocediste a: ${d.nombre}`) : pintar(c.amarillo, '⚠ Ya estás en la cabeza (retroceder devolvió null).');
      break;
    }
    case 'd': {
      const d = lista.avanzar();
      mensaje = d ? pintar(c.verde, `▶ Avanzaste a: ${d.nombre}`) : pintar(c.amarillo, '⚠ Ya estás en la cola (avanzar devolvió null).');
      break;
    }
    case '1': {
      const d = await pedirDestino(rl);
      if (!d) { mensaje = pintar(c.amarillo, '⚠ Operación cancelada: el nombre está vacío.'); break; }
      lista.insertar(d);
      mensaje = pintar(c.verde, `✔ "${d.nombre}" se agregó al final (cola). O(1)`);
      break;
    }
    case '2': {
      if (typeof lista.insertarDespuesDeActual !== 'function') {
        mensaje = pintar(c.rojo, '✖ Esta versión de la lista no tiene insertarDespuesDeActual().');
        break;
      }
      const d = await pedirDestino(rl);
      if (!d) { mensaje = pintar(c.amarillo, '⚠ Operación cancelada: el nombre está vacío.'); break; }
      lista.insertarDespuesDeActual(d);
      mensaje = pintar(c.verde, `✔ "${d.nombre}" se insertó después del cursor. O(1)`);
      break;
    }
    case '3': {
      const d = lista.obtenerActual();
      if (!lista.eliminarActual()) { mensaje = pintar(c.amarillo, '⚠ No hay nada que eliminar.'); break; }
      mensaje = pintar(c.verde, `✔ Se eliminó "${d.nombre}" y se reconectaron los punteros. O(1)`);
      break;
    }
    case '4': {
      const id = Number(await rl.question(pintar(c.cian, '  ID a buscar: ')));
      const d = lista.buscarPorId(id);
      mensaje = d
        ? pintar(c.verde, `🔎 Encontrado (ID ${id}): ${d.nombre} · ${d.categoria}. O(n)`)
        : pintar(c.amarillo, `⚠ No existe un destino con ID ${id}.`);
      break;
    }
    case '5': {
      const vacia = lista.estaVacia ?? (lista.longitud === 0);
      mensaje = [
        pintar(c.magenta, 'Métodos de utilidad:'),
        `  longitud     = ${pintar(c.amarillo, lista.longitud)}`,
        `  estaVacia    = ${pintar(c.amarillo, vacia)}`,
        `  cabeza.dato  = ${lista.cabeza ? lista.cabeza.dato.nombre : 'null'}`,
        `  cola.dato    = ${lista.cola ? lista.cola.dato.nombre : 'null'}`,
      ].join('\n  ');
      break;
    }
    case '6': {
      const r = (await rl.question(pintar(c.rojo, '  ¿Seguro que quieres vaciar la lista? (s/n): '))).trim().toLowerCase();
      if (r === 's') { lista.vaciar(); mensaje = pintar(c.verde, '✔ Lista vaciada.'); }
      else mensaje = pintar(c.gris, 'Operación cancelada.');
      break;
    }
    default:
      mensaje = pintar(c.amarillo, `⚠ Opción "${opcion}" no válida.`);
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('close', () => process.exit(0));

  while (true) {
    pantalla();
    const opcion = (await rl.question(pintar(c.negrita, '  Elige una opción ➜ '))).trim().toLowerCase();
    if (opcion === '0' || opcion === 'q') break;
    await ejecutar(opcion, rl);
  }

  console.clear();
  console.log(pintar(c.verde, '\n  👋 ¡Gracias por usar el sistema turístico de Loja!\n'));
  rl.close();
}

main();
