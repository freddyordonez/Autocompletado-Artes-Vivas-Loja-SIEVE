
const NodoDoble = require('./NodoDoble');

/**
 * Estructura de datos dinámica para la gestión
 * de navegación bidireccional.
 */
class ListaDobleNavegacion {
    constructor() {
        this.cabeza = null;
        this.cola = null;
        this.actual = null;
        this.longitud = 0;
    }

    /**
     * Inserta un nuevo registro al final de la lista.
     * Complejidad: O(1)
     */
    insertar(dato) {
        const nuevoNodo = new NodoDoble(dato);

        if (this.cabeza === null) {
            this.cabeza = nuevoNodo;
            this.cola = nuevoNodo;
            this.actual = nuevoNodo;
        } else {
            nuevoNodo.anterior = this.cola;
            this.cola.siguiente = nuevoNodo;
            this.cola = nuevoNodo;
        }

        this.longitud++;
        return nuevoNodo;
    }

    /**
     * Avanza al siguiente nodo.
     * Complejidad: O(1)
     */
    avanzar() {
        if (this.actual && this.actual.siguiente) {
            this.actual = this.actual.siguiente;
            return this.actual.dato;
        }

        return null;
    }

    /**
     * Retrocede al nodo anterior.
     * Complejidad: O(1)
     */
    retroceder() {
        if (this.actual && this.actual.anterior) {
            this.actual = this.actual.anterior;
            return this.actual.dato;
        }

        return null;
    }

    /**
     * Obtiene el dato del nodo actual.
     */
    obtenerActual() {
        return this.actual ? this.actual.dato : null;
    }

    /**
     * Elimina el nodo actual y reconecta los enlaces.
     * Complejidad: O(1)
     */
    eliminarActual() {
        if (this.actual === null) {
            return false;
        }

        const nodoAEliminar = this.actual;
        const anterior = nodoAEliminar.anterior;
        const siguiente = nodoAEliminar.siguiente;

        if (anterior !== null) {
            anterior.siguiente = siguiente;
        } else {
            this.cabeza = siguiente;
        }

        if (siguiente !== null) {
            siguiente.anterior = anterior;
            this.actual = siguiente;
        } else {
            this.cola = anterior;
            this.actual = anterior;
        }

        // Liberar referencias del nodo eliminado.
        nodoAEliminar.anterior = null;
        nodoAEliminar.siguiente = null;

        this.longitud--;

        // Si la lista quedó vacía, reiniciar los punteros.
        if (this.longitud === 0) {
            this.cabeza = null;
            this.cola = null;
            this.actual = null;
        }

        return true;
    }

    /**
     * Busca un elemento por su ID.
     * Complejidad: O(n)
     */
    buscarPorId(id) {
        let actual = this.cabeza;

        while (actual !== null) {
            if (actual.dato && actual.dato.id === id) {
                return actual.dato;
            }

            actual = actual.siguiente;
        }

        return null;
    }

    /**
     * Vacía la lista.
     */
    vaciar() {
        let actual = this.cabeza;

        while (actual !== null) {
            const siguiente = actual.siguiente;
            actual.anterior = null;
            actual.siguiente = null;
            actual = siguiente;
        }

        this.cabeza = null;
        this.cola = null;
        this.actual = null;
        this.longitud = 0;
    }

    /**
     * Inserta un nodo inmediatamente después del nodo actual.
     * Complejidad: O(1)
     */
    insertarDespuesDeActual(datos) {
        const nuevoNodo = new NodoDoble(datos);

        // Si la lista está vacía.
        if (this.cabeza === null) {
            this.cabeza = nuevoNodo;
            this.cola = nuevoNodo;
            this.actual = nuevoNodo;
            this.longitud++;

            return nuevoNodo;
        }

        // Si no existe un nodo actual.
        if (this.actual === null) {
            return null;
        }

        const siguiente = this.actual.siguiente;

        // Conectar el nuevo nodo con sus vecinos.
        nuevoNodo.anterior = this.actual;
        nuevoNodo.siguiente = siguiente;

        this.actual.siguiente = nuevoNodo;

        if (siguiente !== null) {
            siguiente.anterior = nuevoNodo;
        } else {
            this.cola = nuevoNodo;
        }

        this.longitud++;

        return nuevoNodo;
    }
}

module.exports = ListaDobleNavegacion;
