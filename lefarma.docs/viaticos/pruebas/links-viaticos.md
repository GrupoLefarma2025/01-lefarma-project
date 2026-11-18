# Banco de pruebas de links de viáticos

- Actualizado: 12/11/2026
- Snapshot del sistema: 11/11/2026
- Fuente de datos: LefarmaDev2 (192.168.4.2)
- Nota de fechas: Las fechas de los casos se movieron a diciembre de 2026 para que los proveedores devuelvan resultados (varias solicitudes reales tenían fechas ya pasadas). Los precios de sistema_actual son el snapshot histórico de la solicitud; no son el precio del día de la prueba. El campo fecha_original conserva la fecha real de la solicitud.

Este archivo se genera desde `links-viaticos.json`. Los links son de consulta, no de reserva, salvo que se indique lo contrario. Las capturas viven en `evidencias/`.
La columna Precio es el primer importe visible; en páginas con filtros puede ser un rango (p. ej., 5000) y no el precio de la ruta.
Los conteos de disponibilidad son los que muestra el buscador y pueden incluir resultados de la zona; no son una reserva.

## Resumen

| Caso | Tipo | Ruta | Fecha | Precio actual | Link actual | Elegido |
|---|---|---|---|---:|---|---|
| `vuelo-mex-mty-2026-11-10` | vuelo | Ciudad de México → Monterrey | 09/12/2026 | 1717.45 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-slp-2026-11-10` | vuelo | Ciudad de México → San Luis Potosí | 10/12/2026 | 1208.51 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SLP%20on%202026-12-10&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-gdl-2026-11-09` | vuelo | Ciudad de México → Guadalajara | 09/12/2026 | 1357.44 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20GDL%20on%202026-12-09&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-trc-2026-12-07` | vuelo | Ciudad de México → Torreón | 07/12/2026 | 1837.18 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20TRC%20on%202026-12-07&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-cen-2026-12-04` | vuelo | Ciudad de México → Ciudad Obregón | 04/12/2026 | 2729.18 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Cajeme%20on%202026-12-04&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-cvm-2026-12-02` | vuelo | Ciudad de México → Ciudad Victoria | 02/12/2026 | 1385.69 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Ciudad%20Victoria%20on%202026-12-02&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-jal-2026-12-16` | vuelo | Ciudad de México → Xalapa | 16/12/2026 | 1028.36 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Xalapa%20on%202026-12-16&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `vuelo-mex-sjd-2026-12-14` | vuelo | Ciudad de México → Los Cabos | 14/12/2026 | 2381.56 | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SJD%20on%202026-12-14&curr=MXN&hl=es-MX) | kayak_vuelos (ok) |
| `hotel-mty-2026-11-09-1n` | hotel | Hotel en Monterrey | 09/12/2026 a 10/12/2026 | 2353 | [abrir](https://www.booking.com/searchresults.es.html?ss=Monterrey&checkin=2026-12-09&checkout=2026-12-10&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `hotel-gdl-2026-11-09-2n` | hotel | Hotel en Guadalajara | 09/12/2026 a 11/12/2026 | 2006 | [abrir](https://www.booking.com/searchresults.es.html?ss=Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `hotel-pue-2026-11-16-1n` | hotel | Hotel en Puebla | 16/12/2026 a 17/12/2026 | 1500 | [abrir](https://www.booking.com/searchresults.es.html?ss=Puebla&checkin=2026-12-16&checkout=2026-12-17&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `hotel-trc-2026-12-07-1n` | hotel | Hotel en Torreón | 07/12/2026 a 08/12/2026 | 3533 | [abrir](https://www.booking.com/searchresults.es.html?ss=Torre%C3%B3n&checkin=2026-12-07&checkout=2026-12-08&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `hotel-sanquintin-2026-12-08-1n` | hotel | Hotel en San Quintín | 08/12/2026 a 09/12/2026 | 3533 | [abrir](https://www.booking.com/searchresults.es.html?ss=San%20Quint%C3%ADn&checkin=2026-12-08&checkout=2026-12-09&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `hotel-cuernavaca-2026-12-01-1n` | hotel | Hotel en Cuernavaca | 01/12/2026 a 02/12/2026 | 3533 | [abrir](https://www.booking.com/searchresults.es.html?ss=Cuernavaca&checkin=2026-12-01&checkout=2026-12-02&group_adults=1&no_rooms=1) | booking_ciudad (ok) |
| `hotel-fiesta-americana-gdl-2026-11-09-2n` | hotel | Hotel en Guadalajara | 09/12/2026 a 11/12/2026 | 2006 | [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1) | google_hotels_ciudad (ok) |
| `bus-cdmx-mty-2026-11-09` | autobus | Ciudad de México → Monterrey | 09/12/2026 | 1044 | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=monterrey-nl-(todas-las-terminales)&departure_date=2026-12-09&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-mty-saltillo-2026-11-11` | autobus | Monterrey → Saltillo | 11/12/2026 | 139 | [abrir](https://www.clickbus.com.mx/trips?departure_place=monterrey-nl-(todas-las-terminales)&arrival_place=saltillo-coah-todas-las-terminales&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-cdmx-slp-2026-11-10` | autobus | Ciudad de México → San Luis Potosí | 10/12/2026 | 559 | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=san-luis-potosi-slp-todas-las-terminales&departure_date=2026-12-10&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-slp-aguascalientes-2026-11-11` | autobus | San Luis Potosí → Aguascalientes | 11/12/2026 | 142 | [abrir](https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&arrival_place=aguascalientes-ags-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-cdmx-pue-2026-11-16` | autobus | Ciudad de México → Puebla | 16/12/2026 | — | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=puebla-pue-todas-las-terminales&departure_date=2026-12-16&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-cdmx-xalapa-2026-11-20` | autobus | Ciudad de México → Xalapa | 16/12/2026 | — | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=caxa-xalapa-ver&departure_date=2026-12-16&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-saltillo-cdmx-2026-11-11` | autobus | Saltillo → Ciudad de México | 11/12/2026 | 1305.37 | [abrir](https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_place=ciudad-de-mexico-df-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | clickbus (ok) |
| `bus-cdmx-xicotlan-2026-10-23` | autobus | Ciudad de México → Xicotlán | 07/12/2026 | 490.92 | — | — |
| `bus-cdmx-torreon-2026-12-07` | autobus | Ciudad de México → Torreón | 07/12/2026 | — | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=torreon-coah-todas-las-terminales&departure_date=2026-12-07&minPrice=0&maxPrice=5000) | clickbus (ok) |

## Disponibilidad del candidato elegido

| Caso | Ruta | Fecha | Proveedor | Disponibilidad | Detalle |
|---|---|---|---|---|---|
| `vuelo-mex-mty-2026-11-10` | Ciudad de México → Monterrey | 09/12/2026 | kayak_vuelos | disponible | 85 de 278 vuelos |
| `vuelo-mex-slp-2026-11-10` | Ciudad de México → San Luis Potosí | 10/12/2026 | kayak_vuelos | disponible | 12 de 144 vuelos |
| `vuelo-mex-gdl-2026-11-09` | Ciudad de México → Guadalajara | 09/12/2026 | kayak_vuelos | disponible | 60 de 268 vuelos |
| `vuelo-mex-trc-2026-12-07` | Ciudad de México → Torreón | 07/12/2026 | kayak_vuelos | disponible | 27 de 61 vuelos |
| `vuelo-mex-cen-2026-12-04` | Ciudad de México → Ciudad Obregón | 04/12/2026 | kayak_vuelos | disponible | 18 de 99 vuelos |
| `vuelo-mex-cvm-2026-12-02` | Ciudad de México → Ciudad Victoria | 02/12/2026 | kayak_vuelos | disponible | 6 de 9 vuelos |
| `vuelo-mex-jal-2026-12-16` | Ciudad de México → Xalapa | 16/12/2026 | kayak_vuelos | disponible | 1 de 38 vuelos |
| `vuelo-mex-sjd-2026-12-14` | Ciudad de México → Los Cabos | 14/12/2026 | kayak_vuelos | disponible | 58 de 394 vuelos |
| `hotel-mty-2026-11-09-1n` | Hotel en Monterrey | 09/12/2026 a 10/12/2026 | google_hotels_ciudad | disponible | 1,414 resultados |
| `hotel-gdl-2026-11-09-2n` | Hotel en Guadalajara | 09/12/2026 a 11/12/2026 | google_hotels_ciudad | disponible | 3,022 resultados |
| `hotel-pue-2026-11-16-1n` | Hotel en Puebla | 16/12/2026 a 17/12/2026 | google_hotels_ciudad | disponible | 456 resultados |
| `hotel-trc-2026-12-07-1n` | Hotel en Torreón | 07/12/2026 a 08/12/2026 | google_hotels_ciudad | disponible | 125 resultados |
| `hotel-sanquintin-2026-12-08-1n` | Hotel en San Quintín | 08/12/2026 a 09/12/2026 | google_hotels_ciudad | disponible | 29 resultados |
| `hotel-cuernavaca-2026-12-01-1n` | Hotel en Cuernavaca | 01/12/2026 a 02/12/2026 | booking_ciudad | disponible | Resultados visibles; precio no normalizado. |
| `hotel-fiesta-americana-gdl-2026-11-09-2n` | Hotel en Guadalajara | 09/12/2026 a 11/12/2026 | google_hotels_ciudad | disponible | 3,022 resultados |
| `bus-cdmx-mty-2026-11-09` | Ciudad de México → Monterrey | 09/12/2026 | clickbus | disponible | 36 asientos disponibles |
| `bus-mty-saltillo-2026-11-11` | Monterrey → Saltillo | 11/12/2026 | clickbus | disponible | 36 asientos disponibles |
| `bus-cdmx-slp-2026-11-10` | Ciudad de México → San Luis Potosí | 10/12/2026 | clickbus | disponible | 36 asientos disponibles |
| `bus-slp-aguascalientes-2026-11-11` | San Luis Potosí → Aguascalientes | 11/12/2026 | clickbus | disponible | 36 asientos disponibles |
| `bus-cdmx-pue-2026-11-16` | Ciudad de México → Puebla | 16/12/2026 | clickbus | disponible | 40 asientos disponibles |
| `bus-cdmx-xalapa-2026-11-20` | Ciudad de México → Xalapa | 16/12/2026 | clickbus | disponible | 12 asientos disponibles |
| `bus-saltillo-cdmx-2026-11-11` | Saltillo → Ciudad de México | 11/12/2026 | clickbus | disponible | 36 asientos disponibles |
| `bus-cdmx-xicotlan-2026-10-23` | Ciudad de México → Xicotlán | 07/12/2026 | — | — | — |
| `bus-cdmx-torreon-2026-12-07` | Ciudad de México → Torreón | 07/12/2026 | clickbus | disponible | 36 asientos disponibles |

## Capturas del sistema

| Proveedor | Permitido | Resultado | Motivo | Recomendación |
|---|---|---|---|---|
| clickbus | sí | ok | Carga resultados; en algunas rutas tarda más de 10 s en pintar viajes. | Esperar el selector de resultados, no solo un tiempo fijo. |
| primera_plus | sí | ok con domcontentloaded / timeout con networkidle | La página no llega a networkidle; con domcontentloaded sí carga. | Cambiar waitUntil a domcontentloaded + espera de resultados. |
| google_flights_q | sí | intermitente: ok, sin_resultados o portada según la corrida | La misma URL alternó resultados y fallos en corridas distintas; en CEN/JAL/CVM/TRC falló. | No usarlo como fuente única; usar Kayak o un API. |
| kayak_vuelos | sí | ok | Abrió resultados reales en todas las rutas probadas; puede pedir validación anti-bot. | Probar con el agente y monitorear bloqueos. |
| google_hotels_ciudad | sí | ok, con excepciones | Aplica bien las fechas en la mayoría de las ciudades; en Cuernavaca no aplicó el calendario en las pruebas. | Fijar las fechas en el calendario; si falla, usar Booking.com. |
| google_hotels_hotel | sí | ok/intermitente | La búsqueda por ciudad es estable; la ficha de hotel a veces no expone el calendario de fechas y a veces muestra resultados de la zona. | Preferir la búsqueda por ciudad + nombre del hotel como texto. |
| booking_ciudad | no | no_permitido | CapturasService.HardBannedDomains prohíbe booking.com. Además, Booking muestra el modal "Inicia sesión y ahorra" que tapa la captura. | Permitirlo con aprobación legal o dejar de usarlo para captura. |
| booking_hotel | no | no_permitido / sin_resultados | Además de la prohibición, por nombre puede resolver otra ciudad (Americana, Brasil). Además, Booking muestra el modal "Inicia sesión y ahorra" que tapa la captura. | Retirarlo del sistema. |
| volaris | sí | ok portada | Sin deep link verificado. | No usar como link de cotización por ahora. |
| vivaaerobus | sí | ok portada | Sin deep link verificado. | No usar como link de cotización por ahora. |
| aeromexico | sí | bloqueado | Access Denied (Akamai). | No usar captura headless. |
| ado | sí | ok portada | Sin deep link verificado. | Evaluar su buscador si se necesita cobertura. |
| distribusion | sí | 404 | retailerPartnerNumber de ejemplo. | Retirarlo hasta tener credenciales. |
| skyscanner | sí | captcha | Redirigió a captcha anti-bot. | No usar captura headless. |
| google_maps | sí | ok | Muestra el mapa del hotel; no es cotización. | Usarlo solo como ver mapa. |
| etn | sí | ok portada | Sin deep link verificado. | Evaluar su buscador si se necesita cobertura. |

## Casos

### vuelo-mex-mty-2026-11-10

**CDMX → Monterrey, solicitud real VIA-6-0026**

- Ruta: Ciudad de México → Monterrey
- Fecha: 09/12/2026
- Hospital/ruta: UMAE Especialidades 25 Nuevo León
- Fecha original de la solicitud: 2026-11-10

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1717.45 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: disponible (Se encontraron 36 resultados)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX)
- Resultado: ok
- Evidencia: Google Flights mostró la ruta en esta corrida; el comportamiento es intermitente.
- Captura actual: [ver](evidencias/vuelo-mex-mty-2026-11-10__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX) | ok | disponible (Se encontraron 36 resultados) | 1959 | De Ciudad de México a Monterrey / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX | [ver](evidencias/vuelo-mex-mty-2026-11-10__google_flights_q.png) | sí (ok) |
| google_flights_q_gl | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX&gl=MX) | ok | disponible (Se encontraron 36 resultados) | 1936 | De Ciudad de México a Monterrey / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20MTY%20on%202026-12-09&curr=MXN&hl=es-MX | [ver](evidencias/vuelo-mex-mty-2026-11-10__google_flights_q_gl.png) | sí (ok) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-MTY/2026-12-09?sort=bestflight_a&fs=cabin=e) | ok | disponible (85 de 278 vuelos) | 371 | MEX a MTY, 9/12 / https://www.kayak.com.mx/flights/MEX-MTY/2026-12-09?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de  | [ver](evidencias/vuelo-mex-mty-2026-11-10__kayak_vuelos.png) | sí (ok) |
| volaris | [abrir](https://www.volaris.com/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | [ver](evidencias/vuelo-mex-mty-2026-11-10__volaris.png) | sí (no_aplica) |
| vivaaerobus | [abrir](https://www.vivaaerobus.com/es-mx) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | [ver](evidencias/vuelo-mex-mty-2026-11-10__vivaaerobus.png) | sí (no_aplica) |
| aeromexico | [abrir](https://www.aeromexico.com/es-mx) | bloqueado | no_verificable (No se pudo verificar.) | — | Access Denied / https://www.aeromexico.com/new/ / Access Denied You don't have permission to access "http://www.aeromexico.com/new/" on this server. Reference # | [ver](evidencias/vuelo-mex-mty-2026-11-10__aeromexico.png) | sí (bloqueado) |
| skyscanner_vuelos | [abrir](https://www.skyscanner.com.mx/transport/flights/mex/mty/091226/?adults=1&adultsv2=1&cabinclass=economy&children=0&currency=MXN&locale=es-MX) | captcha | no_verificable (No se pudo verificar.) | — | Skyscanner redirigió a captcha anti-bot. | [ver](evidencias/vuelo-mex-mty-2026-11-10__skyscanner_vuelos.png) | sí (captcha) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-slp-2026-11-10

**CDMX → San Luis Potosí, solicitud real VIA-6-0025**

- Ruta: Ciudad de México → San Luis Potosí
- Fecha: 10/12/2026
- Hospital/ruta: Hospital Star Médica San Luis Potosí
- Fecha original de la solicitud: 2026-11-10

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1208.51 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: disponible (Se encontraron 9 resultados)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SLP%20on%202026-12-10&curr=MXN&hl=es-MX)
- Resultado: ok
- Evidencia: Google Flights mostró la ruta en esta corrida; el comportamiento es intermitente.
- Captura actual: [ver](evidencias/vuelo-mex-slp-2026-11-10__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SLP%20on%202026-12-10&curr=MXN&hl=es-MX) | ok | disponible (Se encontraron 9 resultados) | 2552 | De Ciudad de México a San Luis Potosí / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SLP%20on%202026-12-10&curr=MXN&hl | [ver](evidencias/vuelo-mex-slp-2026-11-10__google_flights_q.png) | sí (ok) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-SLP/2026-12-10?sort=bestflight_a&fs=cabin=e) | ok | disponible (12 de 144 vuelos) | 1393 | MEX a SLP, 10/12 / https://www.kayak.com.mx/flights/MEX-SLP/2026-12-10?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de | [ver](evidencias/vuelo-mex-slp-2026-11-10__kayak_vuelos.png) | sí (ok) |
| volaris | [abrir](https://www.volaris.com/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |
| vivaaerobus | [abrir](https://www.vivaaerobus.com/es-mx) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-gdl-2026-11-09

**CDMX → Guadalajara, hospital UMAE Jalisco**

- Ruta: Ciudad de México → Guadalajara
- Fecha: 09/12/2026
- Hospital/ruta: UMAE Especialidades Jalisco
- Fecha original de la solicitud: 2026-11-09

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1357.44 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_disponible (La página no muestra resultados para la ruta/fecha.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20GDL%20on%202026-12-09&curr=MXN&hl=es-MX)
- Resultado: intermitente
- Evidencia: Google Flights mostró resultados en una corrida y sin_resultados en otra con la misma URL. Kayak sí mostró vuelos.
- Captura actual: [ver](evidencias/vuelo-mex-gdl-2026-11-09__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20GDL%20on%202026-12-09&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (La página no muestra resultados para la ruta/fecha.) | — | De Ciudad de México a Guadalajara / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20GDL%20on%202026-12-09&curr=MXN&hl=es- | [ver](evidencias/vuelo-mex-gdl-2026-11-09__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-GDL/2026-12-09?sort=bestflight_a&fs=cabin=e) | ok | disponible (60 de 268 vuelos) | 186 | MEX a GDL, 9/12 / https://www.kayak.com.mx/flights/MEX-GDL/2026-12-09?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de  | [ver](evidencias/vuelo-mex-gdl-2026-11-09__kayak_vuelos.png) | sí (ok) |
| volaris | [abrir](https://www.volaris.com/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |
| vivaaerobus | [abrir](https://www.vivaaerobus.com/es-mx) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-trc-2026-12-07

**CDMX → Torreón, hospital UMAE Coahuila**

- Ruta: Ciudad de México → Torreón
- Fecha: 07/12/2026
- Hospital/ruta: UMAE Especialidades Coahuila

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1837.18 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_disponible (La página no muestra resultados para la ruta/fecha.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20TRC%20on%202026-12-07&curr=MXN&hl=es-MX)
- Resultado: sin_resultados
- Evidencia: Google Flights no mostró vuelos MEX-TRC; Kayak sí.
- Captura actual: [ver](evidencias/vuelo-mex-trc-2026-12-07__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20TRC%20on%202026-12-07&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (La página no muestra resultados para la ruta/fecha.) | — | De Ciudad de México a Torreón / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20TRC%20on%202026-12-07&curr=MXN&hl=es-MX / | [ver](evidencias/vuelo-mex-trc-2026-12-07__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-TRC/2026-12-07?sort=bestflight_a&fs=cabin=e) | ok | disponible (27 de 61 vuelos) | 279 | MEX a TRC, 7/12 / https://www.kayak.com.mx/flights/MEX-TRC/2026-12-07?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de  | [ver](evidencias/vuelo-mex-trc-2026-12-07__kayak_vuelos.png) | sí (ok) |
| vivaaerobus | [abrir](https://www.vivaaerobus.com/es-mx) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-cen-2026-12-04

**CDMX → Ciudad Obregón, hospital UMAE Sonora (municipio Cajeme)**

- Ruta: Ciudad de México → Ciudad Obregón
- Fecha: 04/12/2026
- Hospital/ruta: UMAE Especialidades Sonora

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 2729.18 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_verificable (El link usó Cajeme y cayó en la portada.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Cajeme%20on%202026-12-04&curr=MXN&hl=es-MX)
- Resultado: sin_resultados
- Evidencia: El link usa Cajeme: cae en la portada y muestra ofertas genéricas. Con IATA CEN sí funciona.
- Captura actual: [ver](evidencias/vuelo-mex-cen-2026-12-04__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Cajeme%20on%202026-12-04&curr=MXN&hl=es-MX) | sin_resultados | no_verificable (El link usó Cajeme y cayó en la portada.) | — | Link actual: usa Cajeme y cae en la portada; los precios mostrados son ofertas genéricas, no de la ruta. | [ver](evidencias/vuelo-mex-cen-2026-12-04__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-CEN/2026-12-04?sort=bestflight_a&fs=cabin=e) | ok | disponible (18 de 99 vuelos) | 557 | MEX a CEN, 4/12 / https://www.kayak.com.mx/flights/MEX-CEN/2026-12-04?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de  | [ver](evidencias/vuelo-mex-cen-2026-12-04__kayak_vuelos.png) | sí (ok) |
| google_flights_iata | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20CEN%20on%202026-12-04&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (La página no muestra resultados para la ruta/fecha.) | — | De Ciudad de México a Ciudad Obregón / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20CEN%20on%202026-12-04&curr=MXN&hl= | [ver](evidencias/vuelo-mex-cen-2026-12-04__google_flights_iata.png) | sí (sin_resultados) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-cvm-2026-12-02

**CDMX → Ciudad Victoria, hospital Bicentenario 2010**

- Ruta: Ciudad de México → Ciudad Victoria
- Fecha: 02/12/2026
- Hospital/ruta: Hospital Regional de Alta Especialidad en Cd. Victoria

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1385.69 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_disponible (Google no mostró vuelos MEX-CVM en esta corrida.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Ciudad%20Victoria%20on%202026-12-02&curr=MXN&hl=es-MX)
- Resultado: sin_resultados
- Evidencia: Google Flights no mostró vuelos MEX-CVM; Kayak sí.
- Captura actual: [ver](evidencias/vuelo-mex-cvm-2026-12-02__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Ciudad%20Victoria%20on%202026-12-02&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (Google no mostró vuelos MEX-CVM en esta corrida.) | — | Google no muestra resultados MEX-CVM en esa fecha; Kayak sí. | [ver](evidencias/vuelo-mex-cvm-2026-12-02__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-CVM/2026-12-02?sort=bestflight_a&fs=cabin=e) | ok | disponible (6 de 9 vuelos) | 1114 | MEX a CVM, 2/12 / https://www.kayak.com.mx/flights/MEX-CVM/2026-12-02?sort=bestflight_a / Editar formulario Ir a filtros de vuelos Ir a sección de resultados de | [ver](evidencias/vuelo-mex-cvm-2026-12-02__kayak_vuelos.png) | sí (ok) |
| google_flights_iata | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20CVM%20on%202026-12-02&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (Google no mostró vuelos MEX-CVM en esta corrida.) | — | Con IATA CVM Google Flights sigue sin resultados; Kayak sí muestra MEX-CVM. | [ver](evidencias/vuelo-mex-cvm-2026-12-02__google_flights_iata.png) | sí (sin_resultados) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-jal-2026-12-16

**CDMX → Xalapa, caso de IATA faltante (JAL)**

- Ruta: Ciudad de México → Xalapa
- Fecha: 16/12/2026
- Hospital/ruta: Ruta Xalapa (ciudad base)

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 1028.36 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_disponible (La página no muestra resultados para la ruta/fecha.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Xalapa%20on%202026-12-16&curr=MXN&hl=es-MX)
- Resultado: sin_resultados
- Evidencia: Google no mostró vuelos a Xalapa/JAL; sugirió Veracruz. Kayak sí resolvió MEX-JAL.
- Captura actual: [ver](evidencias/vuelo-mex-jal-2026-12-16__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Xalapa%20on%202026-12-16&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (La página no muestra resultados para la ruta/fecha.) | — | De Ciudad de México a Xalapa-Enríquez / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20Xalapa%20on%202026-12-16&curr=MXN | [ver](evidencias/vuelo-mex-jal-2026-12-16__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-JAL/2026-12-16?sort=bestflight_a&fs=cabin=e) | ok | disponible (1 de 38 vuelos) | 2697 | MEX a JAL, 16/12 / https://www.kayak.com.mx/flights/MEX-JAL/2026-12-16?sort=bestflight_a / Editar formulario Ir a filtros de vuelos Ir a sección de resultados d | [ver](evidencias/vuelo-mex-jal-2026-12-16__kayak_vuelos.png) | sí (ok) |
| google_flights_iata | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20JAL%20on%202026-12-16&curr=MXN&hl=es-MX) | sin_resultados | no_verificable (El link no ejecutó la búsqueda; quedó en la portada.) | — | Encuentra vuelos económicos a Jalisco en Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20JAL%20on%202026-12-16&curr=MXN&h | [ver](evidencias/vuelo-mex-jal-2026-12-16__google_flights_iata.png) | sí (sin_resultados) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### vuelo-mex-sjd-2026-12-14

**CDMX → Los Cabos, entrega Marcos Payen**

- Ruta: Ciudad de México → Los Cabos
- Fecha: 14/12/2026
- Hospital/ruta: Entrega Marcos Payen Padilla (Los Cabos)

**Sistema actual**

- Etiqueta: Vuelo (estimado)
- Precio: 2381.56 MXN
- Fuente: estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)
- Estimado: sí
- Disponibilidad actual: no_disponible (La página no muestra resultados para la ruta/fecha.)
- Link: [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SJD%20on%202026-12-14&curr=MXN&hl=es-MX)
- Resultado: intermitente
- Evidencia: Google Flights mostró resultados en una corrida y sin_resultados en otra con la misma URL. Kayak sí mostró vuelos.
- Captura actual: [ver](evidencias/vuelo-mex-sjd-2026-12-14__google_flights_q.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_flights_q | [abrir](https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SJD%20on%202026-12-14&curr=MXN&hl=es-MX) | sin_resultados | no_disponible (La página no muestra resultados para la ruta/fecha.) | — | De Ciudad de México a San José del Cabo / Vuelos de Google / https://www.google.com/travel/flights?q=Flights%20from%20MEX%20to%20SJD%20on%202026-12-14&curr=MXN& | [ver](evidencias/vuelo-mex-sjd-2026-12-14__google_flights_q.png) | sí (sin_resultados) |
| kayak_vuelos | [abrir](https://www.kayak.com.mx/flights/MEX-SJD/2026-12-14?sort=bestflight_a&fs=cabin=e) | ok | disponible (58 de 394 vuelos) | 279 | MEX a SJD, 14/12 / https://www.kayak.com.mx/flights/MEX-SJD/2026-12-14?sort=bestflight_a&fs=cabin%3De / Editar formulario Ir a filtros de vuelos Ir a sección de | [ver](evidencias/vuelo-mex-sjd-2026-12-14__kayak_vuelos.png) | sí (ok) |
| volaris | [abrir](https://www.volaris.com/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |

**Decisión**

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para MEX-MTY, MEX-SLP, MEX-GDL, MEX-JAL, MEX-CVM, MEX-TRC, MEX-SJD y MEX-CEN. Google Flights q= falló o mostró portada en CEN/JAL/CVM/TRC.
- Fallback: Si no hay IATA validado, no generar link. Google Flights solo como respaldo con IATA validado; JAL/CEN/CVM deben ir en la tabla IATA.

### hotel-mty-2026-11-09-1n

**Hotel Monterrey, 1 noche, solicitud real VIA-6-0026**

- Ruta: Hotel en Monterrey
- Fecha: 09/12/2026 a 10/12/2026
- Fecha original de la solicitud: 2026-11-09 a 2026-11-10

**Sistema actual**

- Etiqueta: Hotel en Monterrey (referencia) / Hotel Torre
- Precio: 2353 MXN
- Fuente: seed tabulador SHCP (estimado)
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.); Hotel por nombre: no_verificable (Sin contador de resultados visible.))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=Monterrey&checkin=2026-12-09&checkout=2026-12-10&group_adults=1&no_rooms=1)
- Hotel real por nombre: [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Torre&checkin=2026-12-09&checkout=2026-12-10&group_adults=1&no_rooms=1)
- Resultado: parcial
- Evidencia: Booking ciudad funciona; Booking por nombre de hotel no mostró resultados. Google Hotels mostró precios reales.
- Captura actual: [ver](evidencias/hotel-mty-2026-11-09-1n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Monterrey&checkin=2026-12-09&checkout=2026-12-10&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (1,414 resultados) | 1781 | Busca alojamiento en hoteles de Google en Monterrey / https://www.google.com/travel/search?q=hoteles%20en%20Monterrey&checkin=2026-12-09&checkout=2026-12-10&hl= | [ver](evidencias/hotel-mty-2026-11-09-1n__google_hotels_ciudad.png) | sí (ok) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=Monterrey&checkin=2026-12-09&checkout=2026-12-10&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Resultados de la búsqueda: Monterrey. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Monterrey&checkin=2026-12-09&chec | [ver](evidencias/hotel-mty-2026-11-09-1n__booking_ciudad.png) | no (no_permitido) |
| booking_hotel | [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Torre&checkin=2026-12-09&checkout=2026-12-10&group_adults=1&no_rooms=1) | ok | no_verificable (Sin contador de resultados visible.) | — | Booking.com: Resultados de la búsqueda: Hotel Torre. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Hotel%20Torre&checkin=2026-12-0 | [ver](evidencias/hotel-mty-2026-11-09-1n__booking_hotel.png) | no (no_permitido) |
| google_hotels_hotel | [abrir](https://www.google.com/travel/search?q=Hotel%20Torre%20Monterrey&checkin=2026-12-09&checkout=2026-12-10&hl=es-MX&gl=MX&curr=MXN) | error | no_verificable (No se pudieron fijar las fechas seleccionadas en Google Hotels.) | — | Hotel Torre / Hoteles de Google / https://www.google.com/travel/search?q=Hotel%20Torre%20Monterrey&checkin=2026-12-09&checkout=2026-12-10&hl=es-MX&gl=MX&curr=MX | [ver](evidencias/hotel-mty-2026-11-09-1n__google_hotels_hotel.png) | sí (error) |
| google_maps | [abrir](https://www.google.com/maps/search/Hotel%20Torre%20Monterrey) | ok | disponible (Resultados visibles (prueba manual).) | 726 | Muestra el mapa del hotel (Hotel Torre); no es una página de reserva ni una cotización. | [ver](evidencias/hotel-mty-2026-11-09-1n__google_maps.png) | sí (ok) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### hotel-gdl-2026-11-09-2n

**Hotel Guadalajara, 2 noches, hospital UMAE Jalisco**

- Ruta: Hotel en Guadalajara
- Fecha: 09/12/2026 a 11/12/2026
- Fecha original de la solicitud: 2026-11-09 a 2026-11-11

**Sistema actual**

- Etiqueta: Hotel en Guadalajara (referencia)
- Precio: 2006 MXN
- Fuente: seed tabulador SHCP (estimado)
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.); Hotel por nombre: no_disponible (Resolvió otra ciudad (Americana, Brasil).))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1)
- Resultado: parcial
- Evidencia: Booking ciudad funciona; Booking por nombre resolvió Americana (Brasil). Google Hotels mostró Fiesta Americana a $2,228.
- Captura actual: [ver](evidencias/hotel-gdl-2026-11-09-2n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (3,022 resultados) | 941 | Busca alojamiento en hoteles de Google en Guadalajara / https://www.google.com/travel/search?q=hoteles%20en%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11 | [ver](evidencias/hotel-gdl-2026-11-09-2n__google_hotels_ciudad.png) | sí (ok) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Resultados de la búsqueda: Guadalajara. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Guadalajara&checkin=2026-12-09& | [ver](evidencias/hotel-gdl-2026-11-09-2n__booking_ciudad.png) | no (no_permitido) |
| booking_hotel | [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1) | sin_resultados | no_disponible (Resolvió otra ciudad (Americana, Brasil).) | — | Booking por nombre resolvió Americana (São Paulo, Brasil), no Guadalajara. Los precios visibles no aplican. | [ver](evidencias/hotel-gdl-2026-11-09-2n__booking_hotel.png) | no (no_permitido) |
| google_hotels_hotel | [abrir](https://www.google.com/travel/search?q=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (985 resultados) | 701 | Busca alojamiento en hoteles de Google en Hotel Fiesta Americana / https://www.google.com/travel/search?q=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026- | [ver](evidencias/hotel-gdl-2026-11-09-2n__google_hotels_hotel.png) | sí (ok) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### hotel-pue-2026-11-16-1n

**Hotel Puebla, 1 noche, UMAE Puebla**

- Ruta: Hotel en Puebla
- Fecha: 16/12/2026 a 17/12/2026
- Fecha original de la solicitud: 2026-11-16 a 2026-11-17

**Sistema actual**

- Etiqueta: Hotel en Puebla (referencia)
- Precio: 1500 MXN
- Fuente: seed tabulador SHCP (estimado)
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=Puebla&checkin=2026-12-16&checkout=2026-12-17&group_adults=1&no_rooms=1)
- Resultado: ok
- Evidencia: Booking ciudad y Google Hotels mostraron resultados.
- Captura actual: [ver](evidencias/hotel-pue-2026-11-16-1n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Puebla&checkin=2026-12-16&checkout=2026-12-17&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (456 resultados) | 1121 | Busca alojamiento en hoteles de Google en Puebla De Zaragoza / https://www.google.com/travel/search?q=hoteles%20en%20Puebla&checkin=2026-12-16&checkout=2026-12- | [ver](evidencias/hotel-pue-2026-11-16-1n__google_hotels_ciudad.png) | sí (ok) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=Puebla&checkin=2026-12-16&checkout=2026-12-17&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Hoteles en Puebla. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Puebla&checkin=2026-12-16&checkout=2026-12-17&group_ | [ver](evidencias/hotel-pue-2026-11-16-1n__booking_ciudad.png) | no (no_permitido) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### hotel-trc-2026-12-07-1n

**Hotel Torreón, 1 noche; ciudad NO sembrada (fallback actual a CDMX)**

- Ruta: Hotel en Torreón
- Fecha: 07/12/2026 a 08/12/2026

**Sistema actual**

- Etiqueta: Hotel en Torreón (referencia)
- Precio: 3533 MXN
- Fuente: seed tabulador SHCP (estimado) — fallback CDMX
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=Torre%C3%B3n&checkin=2026-12-07&checkout=2026-12-08&group_adults=1&no_rooms=1)
- Resultado: ok
- Evidencia: Booking ciudad y Google Hotels mostraron resultados. El precio del sistema ($3,533) es el fallback de CDMX y no corresponde a Torreón.
- Captura actual: [ver](evidencias/hotel-trc-2026-12-07-1n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Torre%C3%B3n&checkin=2026-12-07&checkout=2026-12-08&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (125 resultados) | 1760 | Busca alojamiento en hoteles de Google en Torreón / https://www.google.com/travel/search?q=hoteles%20en%20Torre%C3%B3n&checkin=2026-12-07&checkout=2026-12-08&hl | [ver](evidencias/hotel-trc-2026-12-07-1n__google_hotels_ciudad.png) | sí (ok) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=Torre%C3%B3n&checkin=2026-12-07&checkout=2026-12-08&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Resultados de la búsqueda: Torre%C3%B3n. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Torre%C3%B3n&checkin=2026-12-0 | [ver](evidencias/hotel-trc-2026-12-07-1n__booking_ciudad.png) | no (no_permitido) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### hotel-sanquintin-2026-12-08-1n

**Hotel San Quintín, 1 noche; ciudad remota NO sembrada**

- Ruta: Hotel en San Quintín
- Fecha: 08/12/2026 a 09/12/2026

**Sistema actual**

- Etiqueta: Hotel en San Quintín (referencia)
- Precio: 3533 MXN
- Fuente: seed tabulador SHCP (estimado) — fallback CDMX
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=San%20Quint%C3%ADn&checkin=2026-12-08&checkout=2026-12-09&group_adults=1&no_rooms=1)
- Resultado: ok
- Evidencia: Booking ciudad y Google Hotels mostraron resultados. El precio del sistema ($3,533) es el fallback de CDMX.
- Captura actual: [ver](evidencias/hotel-sanquintin-2026-12-08-1n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20San%20Quint%C3%ADn%20Baja%20California&checkin=2026-12-08&checkout=2026-12-09&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (29 resultados) | 1610 | Busca alojamiento en hoteles de Google en San Quintín / https://www.google.com/travel/search?q=hoteles%20en%20San%20Quint%C3%ADn%20Baja%20California&checkin=202 | [ver](evidencias/hotel-sanquintin-2026-12-08-1n__google_hotels_ciudad.png) | sí (ok) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=San%20Quint%C3%ADn&checkin=2026-12-08&checkout=2026-12-09&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Resultados de la búsqueda: San%20Quint%C3%ADn. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=San%20Quint%C3%ADn&check | [ver](evidencias/hotel-sanquintin-2026-12-08-1n__booking_ciudad.png) | no (no_permitido) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### hotel-cuernavaca-2026-12-01-1n

**Hotel Cuernavaca, 1 noche; ciudad NO sembrada**

- Ruta: Hotel en Cuernavaca
- Fecha: 01/12/2026 a 02/12/2026

**Sistema actual**

- Etiqueta: Hotel en Cuernavaca (referencia)
- Precio: 3533 MXN
- Fuente: seed tabulador SHCP (estimado) — fallback CDMX
- Estimado: sí
- Disponibilidad actual: disponible (Referencia (Booking ciudad): disponible (Resultados visibles; precio no normalizado.))
- Referencia por ciudad: [abrir](https://www.booking.com/searchresults.es.html?ss=Cuernavaca&checkin=2026-12-01&checkout=2026-12-02&group_adults=1&no_rooms=1)
- Resultado: ok
- Evidencia: Booking ciudad y Google Hotels mostraron resultados. El precio del sistema ($3,533) es el fallback de CDMX.
- Captura actual: [ver](evidencias/hotel-cuernavaca-2026-12-01-1n__booking_ciudad.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Cuernavaca&checkin=2026-12-01&checkout=2026-12-02&hl=es-MX&gl=MX&curr=MXN) | error | no_verificable (No se pudieron fijar las fechas seleccionadas en Google Hotels.) | — | Busca alojamiento en hoteles de Google en Cuernavaca / https://www.google.com/travel/search?q=hoteles%20en%20Cuernavaca&checkin=2026-12-01&checkout=2026-12-02&h | [ver](evidencias/hotel-cuernavaca-2026-12-01-1n__google_hotels_ciudad.png) | sí (error) |
| booking_ciudad | [abrir](https://www.booking.com/searchresults.es.html?ss=Cuernavaca&checkin=2026-12-01&checkout=2026-12-02&group_adults=1&no_rooms=1) | ok | disponible (Resultados visibles; precio no normalizado.) | — | Booking.com: Resultados de la búsqueda: Cuernavaca. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Cuernavaca&checkin=2026-12-01&ch | [ver](evidencias/hotel-cuernavaca-2026-12-01-1n__booking_ciudad.png) | no (no_permitido) |

**Decisión**

- Proveedor: booking_ciudad
- Patrón: https://www.booking.com/searchresults.es.html?ss={ciudad_destino}&checkin={checkin}&checkout={checkout}&group_adults=1&no_rooms=1
- Motivo: Google Hotels no aplicó las fechas seleccionadas en Cuernavaca durante las pruebas; Booking.com sí las aplica por URL.
- Fallback: Reintentar Google Hotels con el calendario; si sigue fallando, usar Booking.com.

### hotel-fiesta-americana-gdl-2026-11-09-2n

**Búsqueda por nombre: Fiesta Americana Guadalajara, 2 noches**

- Ruta: Hotel en Guadalajara
- Fecha: 09/12/2026 a 11/12/2026
- Fecha original de la solicitud: 2026-11-09 a 2026-11-11

**Sistema actual**

- Etiqueta: Hotel real (Booking por nombre)
- Precio: 2006 MXN
- Fuente: OpenStreetMap/Nominatim + tabulador (estimado)
- Estimado: sí
- Disponibilidad actual: no_verificable (Hotel por nombre: no_disponible (El buscador resolvió otra ciudad (Americana, Brasil).))
- Hotel real por nombre: [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1)
- Resultado: sin_resultados
- Evidencia: Booking por nombre resolvió Americana (São Paulo, Brasil), no Guadalajara. Google Hotels por ciudad sí mostró resultados.
- Captura actual: [ver](evidencias/hotel-fiesta-americana-gdl-2026-11-09-2n__booking_hotel.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| booking_hotel | [abrir](https://www.booking.com/searchresults.es.html?ss=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&group_adults=1&no_rooms=1) | sin_resultados | no_disponible (El buscador resolvió otra ciudad (Americana, Brasil).) | — | Booking.com: Hoteles en Americana. ¡Reserva tu hotel ahora! / https://www.booking.com/searchresults.es.html?ss=Hotel%20Fiesta%20Americana%20Guadalajara&checkin= | [ver](evidencias/hotel-fiesta-americana-gdl-2026-11-09-2n__booking_hotel.png) | no (no_permitido) |
| google_hotels_hotel | [abrir](https://www.google.com/travel/search?q=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (985 resultados) | 701 | Busca alojamiento en hoteles de Google en Hotel Fiesta Americana / https://www.google.com/travel/search?q=Hotel%20Fiesta%20Americana%20Guadalajara&checkin=2026- | [ver](evidencias/hotel-fiesta-americana-gdl-2026-11-09-2n__google_hotels_hotel.png) | sí (ok) |
| google_hotels_ciudad | [abrir](https://www.google.com/travel/search?q=hoteles%20en%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11&hl=es-MX&gl=MX&curr=MXN) | ok | disponible (3,022 resultados) | 941 | Busca alojamiento en hoteles de Google en Guadalajara / https://www.google.com/travel/search?q=hoteles%20en%20Guadalajara&checkin=2026-12-09&checkout=2026-12-11 | [ver](evidencias/hotel-fiesta-americana-gdl-2026-11-09-2n__google_hotels_ciudad.png) | sí (ok) |

**Decisión**

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Google Hotels por ciudad mostró precios reales en Monterrey, Guadalajara, Puebla, Torreón, San Quintín y Cuernavaca, incluso en ciudades fuera del tabulador. Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad como respaldo de reserva; googleMapsUri solo como ver mapa; no usar Booking por nombre. Quitar el fallback silencioso a CDMX.

### bus-cdmx-mty-2026-11-09

**CDMX → Monterrey, solicitud real VIA-6-0026**

- Ruta: Ciudad de México → Monterrey
- Fecha: 09/12/2026
- Fecha original de la solicitud: 2026-11-09
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `monterrey-nl-(todas-las-terminales)`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: 1044 MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (36 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=monterrey-nl-(todas-las-terminales)&departure_date=2026-12-09&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales.
- Captura actual: [ver](evidencias/bus-cdmx-mty-2026-11-09__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=monterrey-nl-(todas-las-terminales)&departure_date=2026-12-09&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 1830 | Boletos de autobús de Ciudad de México a Monterrey / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arr | [ver](evidencias/bus-cdmx-mty-2026-11-09__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=monterrey-nl-(todas-las-terminales)&departure_date=2026-12-09) | ok | disponible (36 asientos disponibles) | 5000 | Boletos de autobús de Ciudad de México a Monterrey / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arr | [ver](evidencias/bus-cdmx-mty-2026-11-09__clickbus_sin_max.png) | sí (ok) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | El catálogo de Primera Plus no resolvió Monterrey (places?q=Monterrey devolvió Morelia). | — | sí (no_aplica) |
| ado | [abrir](https://www.ado.com.mx/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Portada accesible en la prueba; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-mty-saltillo-2026-11-11

**Monterrey → Saltillo, solicitud real VIA-6-0026**

- Ruta: Monterrey → Saltillo
- Fecha: 11/12/2026
- Fecha original de la solicitud: 2026-11-11
- ClickBus: `monterrey-nl-(todas-las-terminales)` → `saltillo-coah-todas-las-terminales`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: 139 MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (36 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=monterrey-nl-(todas-las-terminales)&arrival_place=saltillo-coah-todas-las-terminales&departure_date=2026-12-11&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta; tardó más de 10 s en mostrar los viajes.
- Captura actual: [ver](evidencias/bus-mty-saltillo-2026-11-11__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=monterrey-nl-(todas-las-terminales)&arrival_place=saltillo-coah-todas-las-terminales&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 240 | Boletos de autobús de Monterrey a Saltillo / ClickBus / https://www.clickbus.com.mx/trips?departure_place=monterrey-nl-(todas-las-terminales)&arrival_place=salt | [ver](evidencias/bus-mty-saltillo-2026-11-11__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=monterrey-nl-(todas-las-terminales)&arrival_place=saltillo-coah-todas-las-terminales&departure_date=2026-12-11) | ok | disponible (36 asientos disponibles) | 5000 | La página tardó más de 10 s en mostrar resultados; con 15 s aparecieron. El script debe esperar resultados, no solo un tiempo fijo. | [ver](evidencias/bus-mty-saltillo-2026-11-11__clickbus_sin_max.png) | sí (ok) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Primera Plus no resolvió Monterrey ni Saltillo. | — | sí (no_aplica) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-cdmx-slp-2026-11-10

**CDMX → San Luis Potosí, solicitud real VIA-6-0025**

- Ruta: Ciudad de México → San Luis Potosí
- Fecha: 10/12/2026
- Fecha original de la solicitud: 2026-11-10
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `san-luis-potosi-slp-todas-las-terminales`

**Sistema actual**

- Etiqueta: ClickBus + Primera Plus (en vivo)
- Precio: 559 MXN
- Fuente: ClickBus (en vivo); Primera Plus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (36 asientos disponibles)
- ClickBus: [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=san-luis-potosi-slp-todas-las-terminales&departure_date=2026-12-10&minPrice=0&maxPrice=5000)
- Primera Plus: [abrir](https://viaje.primeraplus.com.mx/search/ciudad-de-mexico/t-san-luis-potosi-central/2026-12-10/p/general-1/departures?lang=spanish&seatsOnResultsDiscounts=true)
- Resultado: ok
- Evidencia: ClickBus y Primera Plus abrieron la ruta con precios reales.
- Captura actual: [ver](evidencias/bus-cdmx-slp-2026-11-10__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=san-luis-potosi-slp-todas-las-terminales&departure_date=2026-12-10&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 1104 | Boletos de autobús de Ciudad de México a San Luis Potosí / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminale | [ver](evidencias/bus-cdmx-slp-2026-11-10__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=san-luis-potosi-slp-todas-las-terminales&departure_date=2026-12-10) | ok | disponible (Resultados visibles (prueba manual).) | 5000 | Boletos de autobús de Ciudad de México a San Luis Potosí / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminale | [ver](evidencias/bus-cdmx-slp-2026-11-10__clickbus_sin_max.png) | sí (ok) |
| primera_plus | [abrir](https://viaje.primeraplus.com.mx/search/ciudad-de-mexico/t-san-luis-potosi-central/2026-12-10/p/general-1/departures?lang=spanish&seatsOnResultsDiscounts=true) | ok | disponible (Muestra horarios/precios con opción de seleccionar.) | 1080 | Las mejores opciones para tus viajes / https://viaje.primeraplus.com.mx/search/ciudad-de-mexico/t-san-luis-potosi-central/2026-12-10/p/general-1/departures?seat | [ver](evidencias/bus-cdmx-slp-2026-11-10__primera_plus.png) | sí (ok) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-slp-aguascalientes-2026-11-11

**San Luis Potosí → Aguascalientes, solicitud real VIA-6-0025**

- Ruta: San Luis Potosí → Aguascalientes
- Fecha: 11/12/2026
- Fecha original de la solicitud: 2026-11-11
- ClickBus: `san-luis-potosi-slp-todas-las-terminales` → `aguascalientes-ags-(todas-las-terminales)`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: 142 MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (36 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&arrival_place=aguascalientes-ags-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales.
- Captura actual: [ver](evidencias/bus-slp-aguascalientes-2026-11-11__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&arrival_place=aguascalientes-ags-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 1586 | Boletos de autobús de San Luis Potosí a Aguascalientes / ClickBus / https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&a | [ver](evidencias/bus-slp-aguascalientes-2026-11-11__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&arrival_place=aguascalientes-ags-(todas-las-terminales)&departure_date=2026-12-11) | ok | disponible (36 asientos disponibles) | 5000 | Boletos de autobús de San Luis Potosí a Aguascalientes / ClickBus / https://www.clickbus.com.mx/trips?departure_place=san-luis-potosi-slp-todas-las-terminales&a | [ver](evidencias/bus-slp-aguascalientes-2026-11-11__clickbus_sin_max.png) | sí (ok) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-cdmx-pue-2026-11-16

**CDMX → Puebla, hospital UMAE Puebla**

- Ruta: Ciudad de México → Puebla
- Fecha: 16/12/2026
- Fecha original de la solicitud: 2026-11-16
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `puebla-pue-todas-las-terminales`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: — MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (40 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=puebla-pue-todas-las-terminales&departure_date=2026-12-16&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales.
- Captura actual: [ver](evidencias/bus-cdmx-pue-2026-11-16__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=puebla-pue-todas-las-terminales&departure_date=2026-12-16&minPrice=0&maxPrice=5000) | ok | disponible (40 asientos disponibles) | 480 | Boletos de autobús de Ciudad de México a Puebla / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arriva | [ver](evidencias/bus-cdmx-pue-2026-11-16__clickbus.png) | sí (ok) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Primera Plus no resolvió Puebla (places?q=Puebla devolvió 0). | — | sí (no_aplica) |
| ado | [abrir](https://www.ado.com.mx/) | ok | no_verificable (Solo portada; no se evaluó búsqueda.) | — | ADO: Boletos de Autobús en Línea y Salida de Autobuses / https://www.ado.com.mx/ / Se ha cargado homePage. PROMOCIONES TERMINALES MIS VIAJES Reimprimir boleto S | [ver](evidencias/bus-cdmx-pue-2026-11-16__ado.png) | sí (ok) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-cdmx-xalapa-2026-11-20

**CDMX → Xalapa, caso base de Xalapa**

- Ruta: Ciudad de México → Xalapa
- Fecha: 16/12/2026
- Fecha original de la solicitud: 2026-11-20
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `caxa-xalapa-ver`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: — MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (12 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=caxa-xalapa-ver&departure_date=2026-12-16&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales.
- Captura actual: [ver](evidencias/bus-cdmx-xalapa-2026-11-20__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=caxa-xalapa-ver&departure_date=2026-12-16&minPrice=0&maxPrice=5000) | ok | disponible (12 asientos disponibles) | 856 | Boletos de autobús de Ciudad de México a Xalapa / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arriva | [ver](evidencias/bus-cdmx-xalapa-2026-11-20__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=caxa-xalapa-ver&departure_date=2026-12-16) | ok | disponible (12 asientos disponibles) | 5000 | Boletos de autobús de Ciudad de México a Xalapa / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arriva | [ver](evidencias/bus-cdmx-xalapa-2026-11-20__clickbus_sin_max.png) | sí (ok) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Primera Plus no resolvió Xalapa. | — | sí (no_aplica) |
| ado | [abrir](https://www.ado.com.mx/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Portada accesible en la prueba; no hay deep link de búsqueda verificado. | — | sí (no_aplica) |
| etn | [abrir](https://www.etn.com.mx/) | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Solo se probó la portada; no hay deep link de búsqueda verificado. | [ver](evidencias/bus-cdmx-xalapa-2026-11-20__etn.png) | sí (no_aplica) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-saltillo-cdmx-2026-11-11

**Saltillo → CDMX: el sistema mostró estimado aunque el link ClickBus sí existe**

- Ruta: Saltillo → Ciudad de México
- Fecha: 11/12/2026
- Fecha original de la solicitud: 2026-11-11
- ClickBus: `saltillo-coah-todas-las-terminales` → `ciudad-de-mexico-df-(todas-las-terminales)`

**Sistema actual**

- Etiqueta: Autobús (estimado)
- Precio: 1305.37 MXN
- Fuente: estimado: sin proveedor de autobuses
- Estimado: sí
- Disponibilidad actual: disponible (36 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_place=ciudad-de-mexico-df-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales; el motor mostró un estimado en la solicitud 26 (bug a revisar).
- Captura actual: [ver](evidencias/bus-saltillo-cdmx-2026-11-11__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_place=ciudad-de-mexico-df-(todas-las-terminales)&departure_date=2026-12-11&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 1759 | Boletos de autobús de Saltillo a Ciudad de México / ClickBus / https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_plac | [ver](evidencias/bus-saltillo-cdmx-2026-11-11__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_place=ciudad-de-mexico-df-(todas-las-terminales)&departure_date=2026-12-11) | ok | disponible (36 asientos disponibles) | 5000 | Boletos de autobús de Saltillo a Ciudad de México / ClickBus / https://www.clickbus.com.mx/trips?departure_place=saltillo-coah-todas-las-terminales&arrival_plac | [ver](evidencias/bus-saltillo-cdmx-2026-11-11__clickbus_sin_max.png) | sí (ok) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Primera Plus no resolvió Saltillo. | — | sí (no_aplica) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

### bus-cdmx-xicotlan-2026-10-23

**CDMX → Xicotlán (Puebla), ciudad fuera del catálogo ClickBus**

- Ruta: Ciudad de México → Xicotlán
- Fecha: 07/12/2026
- Fecha original de la solicitud: 2026-10-23
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `—`

**Sistema actual**

- Etiqueta: Autobús (estimado)
- Precio: 490.92 MXN
- Fuente: estimado: sin proveedor de autobuses
- Estimado: sí
- Disponibilidad actual: no_verificable (No aplica o no hay deep link verificado.)
- Resultado: no_aplica
- Evidencia: Xicotlán no existe en el catálogo de ClickBus ni en Primera Plus; el estimado se queda sin link.

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | ClickBus no tiene Xicotlán en su catálogo (0 resultados). | — | sí (no_aplica) |
| primera_plus | — | no_aplica | no_verificable (No aplica o no hay deep link verificado.) | — | Primera Plus no tiene Xicotlán. | — | sí (no_aplica) |

**Decisión**

- Proveedor: —
- Patrón: 
- Motivo: Ni ClickBus ni Primera Plus tienen Xicotlán en su catálogo; el estimado se queda sin link.
- Fallback: Mantener estimado etiquetado y sin URL.

### bus-cdmx-torreon-2026-12-07

**CDMX → Torreón, hospital UMAE Coahuila**

- Ruta: Ciudad de México → Torreón
- Fecha: 07/12/2026
- ClickBus: `ciudad-de-mexico-df-(todas-las-terminales)` → `torreon-coah-todas-las-terminales`

**Sistema actual**

- Etiqueta: ClickBus (en vivo)
- Precio: — MXN
- Fuente: ClickBus (en vivo)
- Estimado: no
- Disponibilidad actual: disponible (36 asientos disponibles)
- Link: [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=torreon-coah-todas-las-terminales&departure_date=2026-12-07&minPrice=0&maxPrice=5000)
- Resultado: ok
- Evidencia: ClickBus abrió la ruta y mostró precios reales.
- Captura actual: [ver](evidencias/bus-cdmx-torreon-2026-12-07__clickbus.png)

**Candidatos**

| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |
|---|---|---|---|---:|---|---|---|
| clickbus | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=torreon-coah-todas-las-terminales&departure_date=2026-12-07&minPrice=0&maxPrice=5000) | ok | disponible (36 asientos disponibles) | 2804 | Boletos de autobús de Ciudad de México a Torreón / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arriv | [ver](evidencias/bus-cdmx-torreon-2026-12-07__clickbus.png) | sí (ok) |
| clickbus_sin_max | [abrir](https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arrival_place=torreon-coah-todas-las-terminales&departure_date=2026-12-07) | ok | disponible (36 asientos disponibles) | 5000 | Boletos de autobús de Ciudad de México a Torreón / ClickBus / https://www.clickbus.com.mx/trips?departure_place=ciudad-de-mexico-df-(todas-las-terminales)&arriv | [ver](evidencias/bus-cdmx-torreon-2026-12-07__clickbus_sin_max.png) | sí (ok) |

**Decisión**

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}&minPrice=0&maxPrice=5000
- Motivo: ClickBus abrió resultados reales en todas las rutas probadas, incluidas Xalapa, Torreón, Saltillo y San Luis Potosí. El filtro maxPrice no cambió el resultado.
- Fallback: Primera Plus solo si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Quitar Distribusion mientras no haya credenciales.

## Decisiones globales

### vuelo

- Proveedor: kayak_vuelos
- Patrón: https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e
- Motivo: Kayak abrió resultados reales para todas las rutas probadas. Google Flights q= es intermitente: en corridas repetidas alternó ok, sin_resultados y portada para la misma URL; además falló en CEN (Cajeme), JAL (lo interpretó como Jalisco), CVM y TRC.
- Fallback: Sin IATA validado, no generar link. Google Flights solo como respaldo con IATA validado.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarVuelosEstimadosAsync:1206 — Reemplazar el builder de Google Flights por el patrón de Kayak. Exigir IATA de origen y destino.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Ciudades / Aeropuertos / Iatas:38 — Agregar JAL para Xalapa, CEN para Ciudad Obregón y CVM para Ciudad Victoria; revisar todo el mapa IATA.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · CalcularTramoAsync:1646 — No usar el municipio como código de vuelo; usar la tabla IATA y fallar a sin-link si no hay código.

### hotel

- Proveedor: google_hotels_ciudad
- Patrón: https://www.google.com/travel/search?q=hoteles%20en%20{ciudad_destino}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN
- Motivo: Mostró precios reales en ciudades sembradas y no sembradas; Booking por nombre resolvió Americana (Brasil).
- Fallback: Booking ciudad para reserva; googleMapsUri solo como ver mapa; si Google Hotels no aplica las fechas, usar Booking o fijar las fechas en el calendario. Quitar el fallback silencioso a CDMX.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · HotelesAsync:1823 — Cambiar el link de referencia a Google Hotels por ciudad.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · HotelesAsync:1845 — Cambiar el link de hotel real a Google Hotels (hotel + ciudad); no usar Booking por nombre.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Viaticos.GetValueOrDefault / TarifaHotel:1820 — Quitar key ?? CDMX; usar una clave DEFAULT configurable o null con nota de tarifa no configurada.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Categorias[hoteles]:1299 — Asignar Sitio según el link (Google Hotels, Booking, Google Maps), no siempre Booking.com.

### autobus

- Proveedor: clickbus
- Patrón: https://www.clickbus.com.mx/trips?departure_place={slug_clickbus_origen}&arrival_place={slug_clickbus_destino}&departure_date={fecha}
- Motivo: Abrió resultados reales en todas las rutas probadas; el filtro maxPrice no cambió el resultado. Primera Plus funciona solo con slug resuelto.
- Fallback: Primera Plus si su catálogo resuelve la ciudad; si no hay slug, estimado sin link. Distribusion fuera hasta tener credenciales.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarBusesClickBusAsync / ViajesBusSeed:489 — Quitar minPrice/maxPrice del link de ClickBus.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · SlugPrimeraPlusAsync / ConsultarLugaresPrimeraPlusAsync:947 — Validar que places?q devuelva la ciudad solicitada; si no, no generar link de Primera Plus.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarBusesDistribusionAsync:1159 — Quitar o gatear Distribusion; el partner demo responde 404.

### capturas

- Proveedor: google_hotels_ciudad / clickbus / primera_plus
- Patrón: 
- Motivo: Google Hotels, ClickBus y Primera Plus pueden capturarse; Booking está prohibido y Aeroméxico bloquea.
- Fallback: Si el sitio no es capturable, pedir captura manual al usuario.
- Cambio: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CapturasService.cs` · HardBannedDomains:108 — Resolver la contradicción con Booking: permitir con aprobación o dejar de generar links Booking para captura.
- Cambio: `lefarma.frontend/scripts/captura-viaticos.mjs` · captureOne:237 — Cambiar waitUntil networkidle por domcontentloaded + espera de selector de resultados; Primera Plus no llega a networkidle.
- Cambio: `lefarma.frontend/scripts/captura-viaticos.mjs` · captureOne:59 — Mantener la lista de dominios prohibidos sincronizada con CapturasService.

## Cambios al sistema

- [ ] Global vuelo — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarVuelosEstimadosAsync:1206: Reemplazar el builder de Google Flights por el patrón de Kayak. Exigir IATA de origen y destino.
- [ ] Global vuelo — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Ciudades / Aeropuertos / Iatas:38: Agregar JAL para Xalapa, CEN para Ciudad Obregón y CVM para Ciudad Victoria; revisar todo el mapa IATA.
- [ ] Global vuelo — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · CalcularTramoAsync:1646: No usar el municipio como código de vuelo; usar la tabla IATA y fallar a sin-link si no hay código.
- [ ] Global hotel — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · HotelesAsync:1823: Cambiar el link de referencia a Google Hotels por ciudad.
- [ ] Global hotel — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · HotelesAsync:1845: Cambiar el link de hotel real a Google Hotels (hotel + ciudad); no usar Booking por nombre.
- [ ] Global hotel — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Viaticos.GetValueOrDefault / TarifaHotel:1820: Quitar key ?? CDMX; usar una clave DEFAULT configurable o null con nota de tarifa no configurada.
- [ ] Global hotel — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · Categorias[hoteles]:1299: Asignar Sitio según el link (Google Hotels, Booking, Google Maps), no siempre Booking.com.
- [ ] Global autobus — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarBusesClickBusAsync / ViajesBusSeed:489: Quitar minPrice/maxPrice del link de ClickBus.
- [ ] Global autobus — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · SlugPrimeraPlusAsync / ConsultarLugaresPrimeraPlusAsync:947: Validar que places?q devuelva la ciudad solicitada; si no, no generar link de Primera Plus.
- [ ] Global autobus — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` · BuscarBusesDistribusionAsync:1159: Quitar o gatear Distribusion; el partner demo responde 404.
- [ ] Global capturas — `lefarma.backend/src/Lefarma.API/Features/Viaticos/CapturasService.cs` · HardBannedDomains:108: Resolver la contradicción con Booking: permitir con aprobación o dejar de generar links Booking para captura.
- [ ] Global capturas — `lefarma.frontend/scripts/captura-viaticos.mjs` · captureOne:237: Cambiar waitUntil networkidle por domcontentloaded + espera de selector de resultados; Primera Plus no llega a networkidle.
- [ ] Global capturas — `lefarma.frontend/scripts/captura-viaticos.mjs` · captureOne:59: Mantener la lista de dominios prohibidos sincronizada con CapturasService.

## Pendientes

Sin pendientes.

## Cómo probar

1. Abre los links de la columna Link con un navegador normal.
2. Anota el estado (`ok`, `sin_resultados`, `error`, `timeout`, `captcha`, `bloqueado`) y el precio visible.
3. Actualiza `links-viaticos.json` y vuelve a generar este archivo con `node scripts/probar-links.mjs --md-only`.
4. Cuando un patrón quede elegido, marca `elegido: true` y agrega los cambios en `decision.cambios`.
5. El script de Playwright prueba solo los candidatos `pendiente`; usa `--force` para repetir y `--case`/`--proveedor` para acotar.
