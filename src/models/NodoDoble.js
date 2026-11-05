class NodoDoble {
/**
   * Clase que representa un nodo con referencia bidireccional.
   * @param {Object} dato - Objeto de dominio del proyecto ABP.
   */
  constructor(dato) {
    this.dato = dato;       // Almacena la información del sitio turístico o consulta
    this.siguiente = null;  // Puntero hacia el nodo posterior
    this.anterior = null;   // Puntero hacia el nodo anterior
  }
}

module.exports = NodoDoble;