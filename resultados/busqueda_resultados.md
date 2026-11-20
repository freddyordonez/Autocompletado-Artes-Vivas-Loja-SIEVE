# Resultados: búsqueda secuencial vs binaria

- Fecha: 2026-11-20T01:43:27.656Z
- Node v26.10.0 | win32 x64 | CPU: AMD Ryzen AI 7 350 w/ Radeon 860M               (1996 MHz nominales)
- Dataset base: 50.000 registros | consultas por prueba: 200 | repeticiones: 3
- Tamaños probados: 1.000, 5.000, 10.000, 50.000, 100.000, 500.000

Los tiempos dependen del equipo; las **comparaciones** son comparables entre equipos.

## 1A) MEMORIA - caso PROMEDIO (ids que existen). Costo por consulta

| registros | secuencial (µs) | binaria (µs) | más rápida | comparaciones sec. | comparaciones bin. | ahorro comparaciones | ciclos est. sec. | ciclos est. bin. | CPU sec. (µs) | CPU bin. (µs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 1,402 | 0,242 | binaria 5,8 veces | 484,6 | 8,9 | 98,163 % | 4.277 | 0 | 2,143 | 0 |
| 5.000 | 7,501 | 0,313 | binaria 24,0 veces | 2.533,3 | 11,2 | 99,557 % | 21.386 | 0 | 10,714 | 0 |
| 10.000 | 17,032 | 0,355 | binaria 48,0 veces | 5.073 | 12,3 | 99,758 % | 49.900 | 0 | 25 | 0 |
| 50.000 | 127,721 | 0,445 | binaria 286,8 veces | 24.112,3 | 14,7 | 99,939 % | 309.380 | 0 | 155 | 0 |
| 100.000 | 913,317 | 0,56 | binaria 1.631,6 veces | 50.333,7 | 15,8 | 99,969 % | 1.716.560 | 0 | 860 | 0 |
| 500.000 | 10.579,076 | 0,635 | binaria 16.653,0 veces | 240.417,9 | 17,9 | 99,993 % | 20.898.120 | 0 | 10.470 | 0 |

## 1B) MEMORIA - PEOR caso de la secuencial (id que no existe: recorre los n registros)

| registros | secuencial (µs) | binaria (µs) | más rápida | comparaciones sec. | comparaciones bin. | ahorro comparaciones |
| --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 1,347 | 0,063 | binaria 21,5 veces | 1.000 | 10 | 99 % |
| 5.000 | 7,292 | 0,08 | binaria 90,8 veces | 5.000 | 13 | 99,74 % |
| 10.000 | 19,138 | 0,084 | binaria 226,9 veces | 10.000 | 14 | 99,86 % |
| 50.000 | 124,713 | 0,094 | binaria 1.320,6 veces | 50.000 | 16 | 99,968 % |
| 100.000 | 1.380,33 | 0,146 | binaria 9.459,9 veces | 100.000 | 17 | 99,983 % |
| 500.000 | 7.940,436 | 0,165 | binaria 48.109,5 veces | 500.000 | 19 | 99,996 % |

## 1C) MEMORIA - MEJOR caso de la secuencial (el id está en la primera posición)

| registros | secuencial (µs) | binaria (µs) | más rápida | comparaciones sec. | comparaciones bin. | ahorro comparaciones |
| --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 0,004 | 0,21 | secuencial 47,4 veces | 1 | 9 | -800 % |
| 5.000 | 0,005 | 0,288 | secuencial 56,5 veces | 1 | 12 | -1.100 % |
| 10.000 | 0,005 | 0,224 | secuencial 43,5 veces | 1 | 10 | -900 % |
| 50.000 | 0,005 | 0,379 | secuencial 75,0 veces | 1 | 15 | -1.400 % |
| 100.000 | 0,005 | 0,418 | secuencial 80,7 veces | 1 | 15 | -1.400 % |
| 500.000 | 0,005 | 0,513 | secuencial 102,1 veces | 1 | 17 | -1.600 % |

> La secuencial puede ganar en este caso: encuentra el dato con 1 comparación. Es un caso raro, no el esperado.

## 1D) COSTO DE INDEXAR (ordenar con MergeSort) y punto de equilibrio

| registros | ordenar índice (ms) | heap índice (MB) | equilibrio (consultas) | log2(n) teórico | n/2 teórico |
| --- | --- | --- | --- | --- | --- |
| 1.000 | 0,43 | 0,05 | 372 | 10 | 500 |
| 5.000 | 2,9 | 0,27 | 403 | 12,3 | 2.500 |
| 10.000 | 6,69 | 0,55 | 402 | 13,3 | 5.000 |
| 50.000 | 53 | 2,32 | 417 | 15,6 | 25.000 |
| 100.000 | 117,18 | 4,62 | 129 | 16,6 | 50.000 |
| 500.000 | 821,23 | 7,63 | 78 | 18,9 | 250.000 |

> Equilibrio = consultas necesarias para que el tiempo de ordenar se compense con el ahorro de cada búsqueda binaria.

## 2) MEMORIA - contar registros de un lugar (nombre_lugar repetido): recorrido O(n) vs rango binario O(log n)

| registros | recorrido completo (µs) | rango binario (µs) | más rápido | comparaciones rec. | comparaciones bin. | ahorro comparaciones |
| --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 2,072 | 1,74 | binaria 1,2 veces | 1.000 | 20 | 98,004 % |
| 5.000 | 12,415 | 2,045 | binaria 6,1 veces | 5.000 | 24,6 | 99,509 % |
| 10.000 | 29,279 | 2,296 | binaria 12,8 veces | 10.000 | 26,8 | 99,732 % |
| 50.000 | 218,959 | 2,793 | binaria 78,4 veces | 50.000 | 31,4 | 99,937 % |
| 100.000 | 1.081,693 | 2,946 | binaria 367,2 veces | 100.000 | 33,1 | 99,967 % |
| 500.000 | 6.805,83 | 3,507 | binaria 1.940,4 veces | 500.000 | 38 | 99,992 % |

> El rango binario encuentra dónde empieza y dónde termina el grupo sin recorrerlo, aunque tenga miles de registros.

## 3A) ARCHIVO INDEXADO - tiempo por consulta (promedio de 50 ids que existen)

| registros | tamaño datos (MB) | secuencial (ms) | binaria (ms) | más rápida | registros leídos sec. | comparaciones bin. | lecturas disco sec. | lecturas disco bin. | KB leídos sec. | KB leídos bin. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 0,21 | 0,362 | 0,022 | binaria 16,4 veces | 519 | 9,1 | 2 | 10,1 | 142 | 0,426 |
| 5.000 | 1,04 | 1,688 | 0,026 | binaria 64,4 veces | 2.563 | 11,5 | 9 | 12,5 | 574 | 0,481 |
| 10.000 | 2,08 | 3,588 | 0,028 | binaria 127,9 veces | 5.336 | 12,6 | 18 | 13,6 | 1.172 | 0,507 |
| 50.000 | 10,41 | 17,285 | 0,033 | binaria 528,8 veces | 25.435 | 14,9 | 85 | 15,9 | 5.458 | 0,562 |
| 100.000 | 20,82 | 28,32 | 0,038 | binaria 737,1 veces | 42.129 | 15,8 | 141 | 16,8 | 9.012 | 0,582 |

> Los archivos quedan en la caché del sistema operativo (lecturas "calientes"). En un disco frío la diferencia sería aún mayor.

## 3B) ARCHIVO INDEXADO - costo único de construir el índice (.idx)

| registros | índice (KB) | leer datos (ms) | ordenar claves con MergeSort (ms) | escribir índice (ms) |
| --- | --- | --- | --- | --- |
| 1.000 | 23,4 | 9,2 | 0,5 | 1 |
| 5.000 | 117,2 | 12,5 | 2,7 | 1,5 |
| 10.000 | 234,4 | 17,1 | 5,9 | 2 |
| 50.000 | 1.171,9 | 48,9 | 42 | 7,7 |
| 100.000 | 2.343,8 | 111,5 | 90,4 | 10,1 |

## Análisis

- Con 500.000 registros, la búsqueda secuencial necesitó 240.417,9 comparaciones por consulta y la binaria 17,9: un ahorro de 99,993 % y una respuesta más rápida: binaria 16.653,0 veces.
- Al crecer de 1.000 a 500.000 registros (500 veces más datos), la secuencial pasó de 484,6 a 240.417,9 comparaciones (crece con n), mientras que la binaria pasó de 8,9 a 17,9 (crece con log2 n).
- El tiempo de la secuencial crece más rápido que n cuando el arreglo deja de caber en la memoria caché del procesador: recorrer muchos objetos dispersos en memoria es más lento por registro.
- Ordenar el índice tiene un costo único O(n log n); se compensa cuando se hacen muchas consultas (ver tabla 1D).
- Si el dato buscado está en las primeras posiciones, la secuencial puede ganar (tabla 1C): O(n) describe el caso promedio y el peor, no el mejor.
- Verificación de resultados (ambas búsquedas devuelven el mismo registro): CORRECTA.
