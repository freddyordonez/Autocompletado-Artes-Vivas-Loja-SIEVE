const ListaDobleNavegacion = require('./models/ListaDobleNavegacion');

/**
 * Módulo principal de ejecución - Avance 4 ABP (Estructura de Datos)
 * Proyecto: Autocompletado Turístico de Loja con Política de Caché SIEVE
 */
function iniciarSistema() {
  console.log('======================================================');
  console.log('  AUTOCOMPLETADO TURÍSTICO DE LOJA - CACHÉ SIEVE      ');
  console.log('  Universidad Nacional de Loja · Carrera de Computación');
  console.log('  Grupo 4                                             ');
  console.log('======================================================\n');

  // Inicialización de la estructura de navegación bidireccional para el historial
  const historialBusqueda = new ListaDobleNavegacion();

  console.log('[Sistema] Registrando consultas de sitios turísticos y comercios...');
  
  historialBusqueda.insertar({ 
    id: 1, 
    nombre: 'Catedral Diocesana de Loja', 
    categoria: 'Arquitectura y Religión',
    visitas: 1250 
  });
  
  historialBusqueda.insertar({ 
    id: 2, 
    nombre: 'Parque Nacional Podocarpus', 
    categoria: 'Ecoturismo y Naturaleza',
    visitas: 3400 
  });
  
  historialBusqueda.insertar({ 
    id: 3, 
    nombre: 'Puerta de la Ciudad', 
    categoria: 'Monumento Histórico',
    visitas: 5100 
  });

  // Demostración del cursor activo y navegación
  console.log('\n[Cursor Activo Inicial]:', historialBusqueda.obtenerActual());

  console.log('\n--- Probando Navegación hacia Adelante (Avanzar) ---');
  console.log('Siguiente destino:', historialBusqueda.avanzar());
  console.log('Siguiente destino:', historialBusqueda.avanzar());
  
  // Intento de superar el límite superior
  console.log('Intento de avance adicional (debe ser null):', historialBusqueda.avanzar());

  console.log('\n--- Probando Navegación hacia Atrás (Retroceder) ---');
  console.log('Destino anterior:', historialBusqueda.retroceder());
  
  console.log('\n[Sistema] Ejecución de demostración completada con éxito.');

 // Demostración de los nuevos métodos de utilidad
  console.log('\n--- Probando Métodos de Utilidad ---');
  console.log('Total de elementos en el historial:', historialBusqueda.longitud);
  console.log('¿La lista está vacía?:', historialBusqueda.estaVacia);
  console.log('Buscando elemento con ID 1:', historialBusqueda.buscarPorId(1));
  
}

// Ejecutar simulación
iniciarSistema();