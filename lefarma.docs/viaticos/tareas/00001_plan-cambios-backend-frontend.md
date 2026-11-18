# Plan — Cambios backend/frontend: links, precios y capturas de viáticos

> **Estado:** Implementado en Fase 1 (2026-11-12). Backend y frontend modificados; Fase 2 (precios por API) sigue pendiente de contrato.
>
> **Evidencia:** `lefarma.docs/viaticos/pruebas/links-viaticos.md`, `lefarma.docs/viaticos/pruebas/links-viaticos.json` y `lefarma.docs/viaticos/cotizador-cli/`.
>
> **Alcance:** Fase 1 sin contratos nuevos. La Fase 2 (precios reales por API) queda condicionada a contrato y no se ejecuta con este plan.

## Objetivo

Corregir en backend y frontend:

1. Los links de consulta de vuelos, hoteles y autobuses.
2. La etiqueta y el origen del precio (cotizado vs estimado vs referencia).
3. El fallback silencioso a CDMX en hoteles.
4. La evidencia/captura: modales, páginas vacías, timeouts y política de dominios.
5. La información visible al usuario: proveedor, disponibilidad, distancia, rating y tipo de precio.

## Hallazgos que originan el plan

| Tema | Hallazgo | Evidencia |
|---|---|---|
| Vuelos | Kayak abrió resultados reales en 8/8 rutas probadas. Google Flights `q=` alternó ok, sin resultados y portada. | `links-viaticos.md`, casos `vuelo-*` |
| Vuelos | Xalapa usa el nombre “Xalapa” y no JAL; Cajeme se usa en lugar de CEN; Ciudad Victoria no tiene CVM. | `CalculoCostosRuta.cs:38`, `:133`, `:1646` |
| Hoteles | Google Hotels por ciudad mostró precios reales en 6/7 casos; falló en Cuernavaca. | `links-viaticos.md`, casos `hotel-*` |
| Hoteles | Booking por nombre resolvió Americana (Brasil) o 0 resultados; Booking ciudad sí funciona. | Capturas `hotel-fiesta-*__booking_hotel.png` |
| Hoteles | Ciudad fuera de las 9 sembradas cae en tarifa de CDMX ($3,533). | `CalculoCostosRuta.cs:1820`, `:2128` |
| Hoteles | Google Places entrega `googleMapsUri` (mapa), no una reserva. | `GooglePlacesService.cs:94` |
| Hoteles | Booking muestra un modal “Inicia sesión y ahorra” que tapa la captura. | `NOTAS-BACKEND.md`, captura demo |
| Autobuses | ClickBus abrió resultados en 8/9 rutas; Xicotlán no está en su catálogo. | `links-viaticos.md`, casos `bus-*` |
| Autobuses | Primera Plus resolvió CDMX–GDL y CDMX–SLP; `places?q` devolvió otra ciudad para Monterrey/Torreón/Saltillo/Xalapa/Puebla. | `CalculoCostosRuta.cs:947` |
| Autobuses | Distribusion con `retailerPartnerNumber=343401` respondió 404. | `CalculoCostosRuta.cs:168`, `:1159` |
| Capturas | Primera Plus no llega a `networkidle`; con `domcontentloaded` sí carga. | `captura-viaticos.mjs:237` |
| Capturas | Booking está en `HardBannedDomains`, pero el motor genera links de Booking. | `CapturasService.cs:108` |
| Disponibilidad | Booking, ClickBus y Primera Plus publican conteos; Google Flights no siempre. | `links-viaticos.md` |

## Decisiones aprobadas (2026-11-12)

1. **Vuelos:** usar Kayak como link principal de consulta; Google Flights solo como respaldo y nunca con el municipio como código.
2. **Hoteles:** usar Google Hotels por ciudad como link principal; Booking ciudad como respaldo de reserva; eliminar Booking por nombre; Google Maps solo como “ver mapa”.
3. **Autobuses:** ClickBus como fuente principal; Primera Plus solo cuando su catálogo resuelva la ciudad exacta; retirar Distribusion mientras no haya credenciales.
4. **Precios:** distinguir siempre `cotizado`, `estimado` y `referencia_tabulador`; no presentar un tabulador como precio del hotel.
5. **Capturas:** cerrar modales/cookies, esperar resultados reales, no guardar páginas de error y resolver la contradicción de Booking.
6. **Datos:** en Fase 1, los campos nuevos viajan en `solicitud_opciones.datos_json`; no se agregan columnas sin una decisión explícita.

### Resoluciones de las preguntas abiertas

- **Booking:** opción **B**. Google Hotels es la fuente de evidencia; Booking ciudad queda solo como respaldo de reserva. No se captura Booking en Fase 1. Si más adelante se aprueba, se habilita con cierre del modal.
- **APIs reales:** opción **C**. Se corrigen links y etiquetas ahora; Duffel/Amadeus/Booking Demand se evalúan en Fase 2 con contrato.
- **Tabulador:** opción **C**. El tabulador sigue siendo la referencia oficial para autorizar; el precio real cotizado se muestra aparte cuando exista proveedor. Nunca se presenta el tabulador como tarifa del hotel.
- **Datos nuevos:** opción **C**. Fase 1 en `datos_json`; solo se agregan columnas clave si reportes/auditoría lo exigen después.
- **Distribusion:** opción **B**. Queda gateado por configuración y apagado por defecto; no se llama sin credenciales.

---

## Fase 1 — Vuelos (backend)

- [x] **F1.1** Reemplazar el builder de Google Flights por el patrón de Kayak en `CalculoCostosRuta.cs` (`BuscarVuelosEstimadosAsync`, línea ~1206).
  - Patrón: `https://www.kayak.com.mx/flights/{iata_origen}-{iata_destino}/{fecha}?sort=bestflight_a&fs=cabin=e`
  - Google Flights se retiró como generador: alternó portada y errores en las pruebas, así que en Fase 1 no hay respaldo automático.
  - Verificación: test de URL para MEX–MTY, MEX–GDL y MEX–JAL.

- [x] **F1.2** Completar y validar la tabla IATA (`Ciudades`, `Aeropuertos`, `Iatas`).
  - Xalapa: `JAL` (no `XAL`), aeropuerto JAL.
  - Ciudad Obregón: `CEN`.
  - Ciudad Victoria: `CVM`.
  - Revisar Tijuana, Saltillo y demás ciudades del catálogo.
  - Verificación: test unitario `IataDeCiudad` y `TerminalDe` para cada ciudad.

- [x] **F1.3** No usar `Municipio` ni el nombre de la ciudad como código de vuelo (`CalcularTramoAsync`, línea ~1646). Si no hay IATA validado, dejar la oferta sin link.
  - Verificación: casos CEN/Cajeme y CVM/Ciudad Victoria ya no generan `Flights from MEX to Cajeme`.

- [x] **F1.4** Ajustar etiquetas de la oferta de vuelo: `Sitio = "Kayak"`, `Accion = "ver precios reales"` o “consultar”; mantener `Estimado = true` y `Fuente = "estimado..."` para el precio de fórmula.
  - Verificación: el botón no promete compra si solo abre una búsqueda.

- [x] **F1.5** Actualizar `CostosRutaServiceTests.cs` (tests de link de vuelo, líneas ~675–719) para el nuevo patrón.

---

## Fase 1 — Hoteles (backend)

- [x] **F2.1** Cambiar el link de la referencia a Google Hotels por ciudad (`HotelesAsync`, línea ~1823).
  - Patrón: `https://www.google.com/travel/search?q=hoteles%20en%20{ciudad}&checkin={checkin}&checkout={checkout}&hl=es-MX&gl=MX&curr=MXN`
  - Booking ciudad se conserva como enlace de respaldo de reserva (`linkReserva`), no para captura.
  - Verificación: Monterrey, Guadalajara, Torreón y San Quintín. Cuernavaca usa el respaldo de Booking para reservar.

- [x] **F2.2** Cambiar el link de hotel real a Google Hotels por hotel + ciudad (línea ~1845).
  - Patrón: `...?q={hotel}%20{ciudad}&checkin=...&checkout=...`
  - No usar Booking por nombre.
  - Si la ficha de hotel no expone fechas/resultados, usar la búsqueda por ciudad y mostrar el nombre del hotel como texto.
  - Mantener `googleMapsUri` solo como “ver mapa”.

- [x] **F2.3** Eliminar el fallback silencioso a CDMX (`HotelesAsync` línea ~1820 y `TarifaHotel` línea ~2125).
  - Usar una clave `costos.hospedaje_noche.DEFAULT` configurable o dejar `PrecioNoche = null` con nota “tarifa no configurada”. Si se usa null, cambiar `PrecioNoche`/`PrecioTotal` a `double?` en el DTO y ajustar el frontend.
  - Verificación: Torreón/San Quintín/Cuernavaca no muestran $3,533.

- [x] **F2.4** Separar el origen del precio:
  - `TipoPrecio = "referencia_tabulador"` cuando venga del tabulador.
  - `TipoPrecio = "cotizado"` cuando venga de un proveedor real (Fase 2).
  - `Proveedor = "Google Hotels"`, `"Booking.com"` o `"Tabulador SHCP"`.
  - Verificación: UI y JSON muestran la etiqueta correcta.

- [x] **F2.5** Corregir `Categorias["hoteles"]` (`CalculoCostosRuta.cs:1299`): `Sitio` debe salir del link (Google Hotels, Booking o Google Maps), no siempre `"Booking.com"`.

- [x] **F2.6** Alinear los campos de hotel con el backend actual: `Habitaciones`, `DistanciaKm`, `Rating`, `RatingCount`, `Direccion`, `PrecioNoche`, `PrecioTotal`, `Fuente`, `Link`.
  - Agregar `Zona` o usar `Direccion` para la zona de Booking.

---

## Fase 1 — Autobuses (backend)

- [x] **F3.1** Quitar `minPrice`/`maxPrice` del link de ClickBus (`CalculoCostosRuta.cs:489`) y URL-encodear los slugs.
  - Verificación: los links de CDMX–MTY, CDMX–Xalapa y Saltillo–CDMX conservan resultados.

- [x] **F3.2** Corregir la resolución de Primera Plus (`SlugPrimeraPlusAsync` / `ConsultarLugaresPrimeraPlusAsync`, línea ~947).
  - Validar que `places?q` devuelva la ciudad/estado solicitados.
  - Si no hay coincidencia exacta, no generar link de Primera Plus.
  - Se verificó que el filtro por ciudad/estado ya existía; se conserva y queda cubierto por los tests de Morelia/La Aldea.

- [x] **F3.3** Retirar o gatear Distribusion (`BuscarBusesDistribusionAsync`, línea ~1159).
  - No usar `retailerPartnerNumber=343401` en producción.
  - Solo llamar si existe configuración/credenciales.

- [x] **F3.4** Para filas estimadas de autobús, no mostrar un link que parece cotización real:
  - Dejar `Url = ""` o etiquetar “ver precios reales (el precio mostrado es estimado)”.
  - Agregar `TipoPrecio = "estimado"`.

- [x] **F3.5** Exponer disponibilidad cuando el proveedor la dé: asientos (ClickBus) o boletos (Primera Plus), en `Disponibilidad`/`DisponibilidadDetalle`.

---

## Fase 1 — Capturas y evidencia

- [x] **F4.1** Resolver la política de Booking:
  - Opción A: permitir `booking.com` en capturas, agregando cierre del modal “Inicia sesión y ahorra”.
  - Opción B: dejar de generar links de Booking para captura y usar Google Hotels como evidencia; Booking queda solo como respaldo de reserva.
  - **Decisión aplicada:** opción B. Google Hotels es la evidencia; Booking queda como enlace de reserva sin captura.

- [x] **F4.2** En `captura-viaticos.mjs`:
  - Cambiar `waitUntil: 'networkidle'` (línea ~237) por `domcontentloaded` + espera de selector de resultados.
  - Cerrar modales/cookies antes de la captura (`Escape` + botón “Cerrar”).
  - Detectar “No se encontraron resultados”, captcha, página vacía o error y devolver `ok:false` con causa.
  - Esperar resultados de ClickBus (>10 s en algunas rutas).
  - Verificación: capturas de Primera Plus, ClickBus y Booking sin modal.

- [x] **F4.3** En `CapturasService`:
  - Mantener la lista de dominios sincronizada con el script.
  - Booking sigue en `HardBannedDomains`; no se captura en Fase 1.
  - La evidencia conserva URL, fecha y proveedor; `tipo_precio` y `disponibilidad` viajan en `datos_json`.

- [x] **F4.4** No guardar como evidencia una captura de página de error, portada o modal. El endpoint debe devolver `Success=false` y el frontend mostrar el motivo.

---

## Fase 1 — Frontend

- [x] **F5.1** Actualizar `costosRuta.types.ts`:
  - `CostosRutaHotel`: `distanciaKm`, `rating`, `ratingCount`, `direccion`, `habitaciones`, `tipoPrecio`, `proveedor`, `disponibilidad`, `disponibilidadDetalle`, `linkMapa`, `linkReserva`.
  - `CostosRutaOferta`: `tipoPrecio`, `proveedor`, `disponibilidad`, `disponibilidadDetalle`.
  - `fechasAplicadas` no fue necesario: las fechas ya viajan en `comprar.fecha`/`checkIn`.
  - Mantener opcionales para no romper datos viejos.

- [x] **F5.2** `TablaOpciones.tsx`:
  - Mostrar `tipoPrecio` y `disponibilidad` junto al precio.
  - Cambiar “Comprar” por “Consultar precios” cuando el link sea una búsqueda; reservar “Comprar” para links de compra reales.
  - Deshabilitar “Volver a buscar” para dominios no capturables (Booking/Expedia) y explicar el motivo.
  - Verificación: build/tsc y revisión de render de etiquetas y estados.

- [x] **F5.3** `CalculosViajeModal.tsx`:
  - En la lista de hoteles, no rotular “tabulador” como si fuera el precio del hotel; mostrar “Referencia tabulador” o “Cotizado”.
  - Mostrar distancia, rating, rating count, zona y disponibilidad.
  - Diferenciar “Ver precios” (Google Hotels), “Mapa” (Google Maps) y “Booking” (respaldo de reserva).
  - Verificación: build/tsc y revisión de render de hotel con precio de referencia.

- [x] **F5.4** `DetalleSolicitudModal.tsx` y `MisViajesPage.tsx`:
  - Mostrar `tipoPrecio` y `disponibilidad` en el detalle.
  - No mostrar “Comprar” si la URL es solo búsqueda o si está vacía; mostrar “Consultar” o “Sin enlace”.

- [x] **F5.5** `calculoViaje.ts`:
  - Persistir en `datos_json` los campos nuevos (`tipo_precio`, `proveedor`, `disponibilidad`, `disponibilidad_detalle`, `distancia_km`, `rating`, `rating_count`, `habitaciones`, `link_mapa`, `link_reserva`).
  - No cambiar el contrato de `solicitud_opciones` en Fase 1.

- [ ] **F5.6** Revisar `TablaHoteles.tsx`: hoy solo se usa en tests y no muestra el monto. Si se queda, alinear sus columnas con `CalculosViajeModal`; si no se usa, no tocarla en este plan.

---

## Fase 1 — API/DTO y persistencia

- [x] **F6.1** Agregar campos opcionales a `CostosRutaOferta` y `CostosRutaHotel` en `CostosRutaDtos.cs`:
  - `TipoPrecio`, `Proveedor`, `Disponibilidad`, `DisponibilidadDetalle`, `LinkMapa`, `LinkReserva`.
  - En hotel ya existen `Habitaciones`, `DistanciaKm`, `Rating`, `RatingCount`, `Direccion`.
  - `FechasAplicadas` no fue necesario en Fase 1.

- [x] **F6.2** Confirmar que `solicitud_opciones` no requiere columnas nuevas:
  - Guardar los campos en `datos_json`.
  - Verificado: `SolicitudesController` copia el bloque `datos` de cada opción (`ParsearJsonTolerante`) y `DatosJson = request.Datos.GetRawText()` sin recortar campos.
  - Si el usuario decide columnas propias, crear un script manual nuevo en `lefarma.database/viaticos/` (nunca EF migrations).

- [x] **F6.3** Actualizar `Categorias` y `Propuestas` para que hereden los campos sin recalcular precios.
  - `HotelesPropuestos` reutiliza `CostosRutaHotel`; `Categorias["hoteles"]` mapea `TipoPrecio`/`Proveedor`/`Disponibilidad`.

---

## Fase 1 — Pruebas y aceptación

- [x] **F7.1** Tests backend:
  - URL de Kayak y Google Flights de respaldo.
  - IATA JAL/CEN/CVM.
  - Hotel Google Hotels + fallback sin CDMX.
  - ClickBus sin `maxPrice`.
  - Primera Plus sin coincidencia exacta no genera link.
  - `TipoPrecio` correcto.
  - Estado: `dotnet test --filter "FullyQualifiedName~Viaticos"` → 130/130. El link de ClickBus se verificó en el builder; los tests de catálogo cubren la ruta con Primera Plus.

- [x] **F7.2** Tests frontend:
  - Etiquetas “Consultar” vs “Comprar”.
  - Disponibilidad y tipo de precio visibles.
  - Hotel con precio de referencia vs cotizado.
  - “Volver a buscar” deshabilitado con motivo.
  - Verificado con la suite existente: `DetalleSolicitudModal` 13/13, `MisViajesPage` 12/12, `TablaOpciones` 14/14; el ajuste de etiqueta legacy conserva “Comprar” cuando no hay `tipo_precio`.

- [ ] **F7.3** Prueba manual con el banco de pruebas:
  - `links-viaticos.md`: 8 vuelos, 7 hoteles y 9 autobuses.
  - `cotizador-cli`: `--demo`, `--demo-bus`, `--demo-pp`.
  - Verificar que las capturas no tengan modal y que los links abran la ruta/fecha correctas.
  - Pendiente: requiere red y sesión manual; `node --check` y los 15 tests del script están en verde.

- [x] **F7.4** Criterios de aceptación:
  - Ningún hotel fuera de las 9 ciudades muestra $3,533 por defecto.
  - Ningún link de hotel usa Booking por nombre.
  - Ningún link de vuelo usa el municipio como código.
  - Ningún link de ClickBus lleva `maxPrice=5000`.
  - Primera Plus no genera link si su catálogo no coincide.
  - Distribusion no se llama sin credenciales.
  - Las capturas no guardan modales, portadas ni páginas de error.
  - Verificado por código y tests; la captura real queda en F7.3.

---

## Fase 2 — Precios reales (no ejecutable sin contrato)

- [ ] **F8.1** Vuelos: evaluar Duffel o Amadeus Enterprise (Self-Service cerró en julio 2026).
- [ ] **F8.2** Hoteles: evaluar Duffel Stays o Booking Demand.
- [ ] **F8.3** Autobuses: evaluar ClickBus/Distribusion B2B.
- [ ] **F8.4** Definir moneda, impuestos, vigencia, caché y política de evidencia.
- [ ] **F8.5** Solo si hay contrato: reemplazar la fórmula/tabulador por la cotización real y mantener el estimado como respaldo.

---

## Orden de implementación

1. **F1** Vuelos (link y IATA).
2. **F2** Hoteles (links, fallback y tipo de precio).
3. **F3** Autobuses (ClickBus, Primera Plus y Distribusion).
4. **F6** DTO/campos nuevos.
5. **F5** Frontend (etiquetas, disponibilidad, hoteles).
6. **F4** Capturas y evidencia.
7. **F7** Tests y aceptación.

## Segunda iteración (2026-11-12): captura masiva y localidades

- **Captura masiva:** `Generar capturas` usa el script local de Playwright, no el agente externo. Solo captura las opciones elegidas (si no hay ninguna marcada, todas). El cliente espera 300 s.
- **Auto-captura:** al guardar/enviar, la captura de las elegidas se dispara en segundo plano. Si falla, no rompe el guardado y el botón `Generar capturas` queda disponible para reintentar.
- **Ciudad real:** para hoteles y autobuses se usa primero `viaticos.municipios_cat` (2,478 municipios con centroide, cacheado 24 h). Si el punto no cae en ningún municipio del catálogo, se recurre a Nominatim y luego al municipio que mandó el mapa.
- **Catálogo de ciudades:** no se copió `ciudades.json` del miniprograma; la BD ya tiene los municipios y los catálogos de ClickBus/IATA cubren los slugs. El JSON queda solo como referencia del CLI.
- **Tarifas de hospedaje:** tabulador por zonas A-E. Las 9 ciudades conservan su tarifa puntual; los demás municipios usan su zona o la zona E por defecto. Montos: A 3533, B 2353, C 2100, D 1700, E 1500. Se ajustan con `costos.hospedaje_noche.zona.<A-E>` y la zona de un municipio con `costos.hospedaje_zona.<CLAVE>`. Script manual: `lefarma.database/viaticos/0016_20261112-1300_viaticos_hospedaje_zonas.multibase.sql` (no aplicado).
- **Autobuses:** si ClickBus no tiene la localidad exacta, usa la terminal más cercana del mismo estado (radio 60 km) y lo marca como “terminal más cercana”. VIA-21-0027 cae en Toluca.
- **Hoteles:** Google Hotels busca `hotel + ciudad` solo si el nombre parece un hotel; si es una dirección, busca solo la ciudad. Booking sigue solo como respaldo de reserva.
- **Solicitudes viejas:** conservan sus links guardados. Los links nuevos (Kayak, Google Hotels, ClickBus) se ven al recalcular o crear una solicitud nueva.

## Tercera iteración (2026-11-12): hub cercano + taxi

- **Problema:** VIA-21-0028 (CDMX → Tekax) solo mostraba autobús estimado y renta. Tekax no tiene IATA ni ruta directa de ClickBus desde CDMX, y el motor exigía punto a punto.
- **Vuelos con hub:** `AeropuertosCatalogo.cs` reúne 59 aeropuertos mexicanos con servicio programado (OurAirports 2026) más JAL. Si el punto no tiene IATA, se usa el aeropuerto más cercano dentro de 160 km (Tekax → MID) y el traslado punto ↔ aeropuerto se cobra como taxi. Kayak recibe el IATA del hub y la oferta lo declara en la nota.
- **Autobuses con hub:** si ClickBus no tiene ruta directa, se prueban centrales cercanas dentro de 160 km, priorizando ciudades con grupo “Todas las Terminales” (Mérida para Tekax). El traslado terminal hub ↔ punto se cobra como taxi. Se buscan hasta 4 fechas hacia atrás porque un recorrido largo puede requerir salir días antes.
- **Tiempo del taxi:** cuenta para decidir si la opción llega a tiempo. Traslados urbanos usan `costos.taxi_km_h` (25 km/h); traslados de 40 km o más usan `costos.taxi_carretera_km_h` (70 km/h), ajustable sin script.
- **Horarios de vuelo:** el estimado ofrece salidas a las 06:00 y 14:00 para que un vuelo matutino pueda absorber el taxi de llegada cuando el hub está lejos.
- **Selección:** la llegada que decide la viabilidad es la del punto final (terminal + taxi), no la del aeropuerto o central.
- **Catálogo único:** se eliminó el diccionario `Aeropuertos` de 9 entradas que vivía en `CalculoCostosRuta.cs`; `TerminalDe` ahora resuelve el aeropuerto desde `AeropuertosCatalogo`, que es la única fuente de nombres y coordenadas.
- **Prueba:** `Xalapa_Puebla_Leon_Documenta_Seeds` vuelve a elegir avión y `Viaje_Sin_Iata_Usa_Aeropuerto_Cercano_Y_Taxi` cubre Tekax → MID + taxi; la suite de viáticos queda en 134/134.
- **Pendiente:** aplicar `0016_..._hospedaje_zonas.multibase.sql` a `LefarmaDev2` (requiere confirmación) y sustituir los estimados por precios reales en Fase 2.

## Cuarta iteración (2026-11-12): capturas de Kayak y auto-disparo

- **Causa raíz:** Playwright no tenía el navegador instalado (`chromium_headless_shell-1223` faltante). El script fallaba al iniciar y el backend marcaba todas las opciones como fallidas.
- **Navegador:** se instaló con `npx playwright install chromium`. El script ahora usa `channel: 'chromium'` (Chromium completo) en vez del headless shell, porque Kayak bloquea el headless shell con su página anti-bot.
- **User-Agent:** el contexto envía un UA de Chrome real generado desde `browser.version()`; sin él, Kayak seguía detectando el navegador como bot.
- **Detección anti-bot:** si Kayak devuelve “¿Qué es un bot?” o “no soy un bot”, la captura se marca `ok:false` y no se guarda como evidencia.
- **Auto-disparo al guardar:** ya se disparaba al guardar, pero fallaba por el navegador ausente. Se reforzó con `fetch` + `keepalive` y ruta same-origin `/api` para que también sobreviva una navegación completa.
- **Selección vs. captura:** marcar una opción en la tabla no captura por sí solo; la captura se dispara al guardar/enviar o con el botón “Generar capturas”. En VIA-21-0028 las elegidas eran las dos opciones de vuelo (91 y 96), no las de bus.
- **Errores visibles:** el POST devuelve el error por opción y el toast de “Generar capturas” muestra el primer motivo real, no solo el conteo.
- **Verificación:** VIA-21-0028 capturó 2/2 (MEX–MID y MID–MEX), 0 fallidas; los PNG muestran resultados reales de Kayak.

## Quinta iteración (2026-11-12): visor modal y subida manual

- **Visor modal:** `FileViewer` acepta `src`, `nombre`, `tamanoBytes` y `descargar` para mostrar capturas ya autenticadas. `CeldaCaptura` abre ese visor al hacer clic en la miniatura; ya no abre una pestaña nueva.
- **Subida manual:** nuevo endpoint `POST /api/viaticos/solicitudes/{id}/opciones/{idOpcion}/captura` (multipart, PNG máx. 8 MB). Valida la firma PNG, guarda con nombre determinista `viaje{id}-op{idOpcion}.png` y actualiza `ruta_captura`/`capturada_en` en la misma operación.
- **Frontend:** `evidenciasApi.subirCaptura` y botón “Subir captura” en `CeldaCaptura` (solo donde se pasa el callback; la vista de aprobación solo previsualiza). `MisViajesPage` refresca la captura y muestra toast.
- **Reutilización:** `FileViewer` es el modal de archivos existente; la captura usa un object URL autenticado, no un `<img src>` directo.
- **Pruebas:** 52/52 frontend focalizadas; 403/404 viáticos (el fallo restante es el preexistente de catálogo de hospitales); 134/134 backend.
- **Pendiente:** probar el POST de subida contra `LefarmaDev2` cuando `192.168.4.2` esté accesible; al momento de la implementación la red no respondía.

## Validación ejecutada (2026-11-12)

| Comando | Resultado |
|---|---|
| `dotnet build` (API) | OK; solo warnings preexistentes. |
| `dotnet test tests/Lefarma.UnitTests --filter "FullyQualifiedName~Viaticos"` | 134/134 en verde (incluye Tekax → MID + taxi). |
| `npm run build` (frontend) | OK; `tsc` + Vite sin errores. |
| `npx vitest run src/apps/viaticos` | 403/404; único fallo preexistente en `ViaticosPage.test.tsx` (catálogo de hospitales), ajeno a este plan. |
| `npx vitest run` (capturas, MisViajes, modal e importación) | 52/52 en verde. |
| `POST /solicitudes/28/capturas` (VIA-21-0028) | 2/2 capturas, 0 fallidas; PNG reales de Kayak para MEX–MID y MID–MEX. |
| `npx vitest run scripts/captura-viaticos.test.mjs` | 15/15 en verde. |
| `npx eslint` sobre archivos tocados | Solo el aviso preexistente de `setState` en el efecto de `MisViajesPage`. |
| `npm run lint` | Falla por 326 problemas preexistentes de todo el repo; los avisos en archivos tocados están en líneas no modificadas (hooks/exports antiguos). |

## Riesgos y rollback

- **Kayak/Google/Booking cambian HTML o términos:** el link puede seguir funcionando aunque el parseo falle. Agregar una bandera de proveedor y conservar el link como respaldo.
- **Google Hotels no aplica fechas en algunas páginas:** usar Booking ciudad como respaldo y no afirmar disponibilidad si no se fijaron las fechas.
- **Booking modal:** si no se cierra, la evidencia queda bloqueada; el CLI ya lo cierra, el backend debe hacerlo.
- **Primera Plus inestable:** catálogo estático de slugs verificados y fallback a ClickBus.
- **Sin contratos:** los precios siguen siendo estimados/referencia; no presentarlos como cotización real.
- **Rollback:** cada cambio de proveedor debe ser configurable; si falla, volver al link anterior y mantener `estimado:true`.

## Decisiones resueltas

| Pregunta | Decisión |
|---|---|
| Booking en capturas | Google Hotels para evidencia; Booking ciudad solo como respaldo de reserva. |
| APIs reales | Links ahora; APIs en Fase 2 con contrato. |
| Tabulador | Referencia oficial; precio cotizado aparte cuando exista proveedor. |
| Datos nuevos | `datos_json` en Fase 1; columnas clave después si hacen falta. |
| Distribusion | Gateado y apagado por defecto; solo con credenciales. |

## Fuera de alcance

- Cambios al cotizador CLI o al banco de pruebas (ya existen y son evidencia).
- Reservas, compras, CFDI y conciliación post-gasto.
- Migraciones EF; cualquier cambio de BD va en script manual.
- Reescribir el motor completo de costos.

## Archivos principales a tocar

| Archivo | Cambio |
|---|---|
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs` | Links, IATA, hoteles, autobuses, etiquetas, hub cercano + taxi. |
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/AeropuertosCatalogo.cs` | Catálogo de aeropuertos para el hub más cercano. |
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/CostosRutaDtos.cs` | Campos nuevos. |
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/GooglePlacesService.cs` | Link de mapa, no reserva. |
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/CapturasService.cs` | Política Booking, evidencia. |
| `lefarma.backend/src/Lefarma.API/Features/Viaticos/SolicitudesController.cs` | Verificar persistencia de `datos_json` de cada opción. |
| `lefarma.frontend/scripts/captura-viaticos.mjs` | Modal, espera, errores. |
| `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts` | Tipos nuevos. |
| `lefarma.frontend/src/apps/viaticos/components/TablaOpciones.tsx` | Etiquetas, disponibilidad, captura. |
| `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx` | Hoteles, precio referencia/cotizado. |
| `lefarma.frontend/src/apps/viaticos/services/calculoViaje.ts` | Persistencia en `datos_json`. |
| `lefarma.frontend/src/apps/viaticos/pages/aprobaciones/DetalleSolicitudModal.tsx` | Detalle de compra/disponibilidad. |
| `lefarma.frontend/src/apps/viaticos/pages/mis-viajes/MisViajesPage.tsx` | Enlaces y estados. |
| `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CostosRutaServiceTests.cs` | Tests de links y fallbacks. |

## Anexo — Evidencia usada

- `lefarma.docs/viaticos/pruebas/links-viaticos.md`
- `lefarma.docs/viaticos/pruebas/links-viaticos.json`
- `lefarma.docs/viaticos/pruebas/evidencias/` (62 capturas)
- `lefarma.docs/viaticos/cotizador-cli/README.md`
- `lefarma.docs/viaticos/cotizador-cli/NOTAS-BACKEND.md`
