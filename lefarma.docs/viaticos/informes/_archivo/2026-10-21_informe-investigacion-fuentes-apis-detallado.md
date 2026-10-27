---
fecha_creacion: 2026-10-21
fecha_modificacion: 2026-10-21
autor: Brandom Ledesma
resumen: Informe de investigación sobre las fuentes de datos y las APIs del módulo de viáticos de Grupo Lefarma. Documenta qué se usa hoy, qué se puede contratar y qué falta para que el importe firmado sea también el importe comprado. Se apoya en el código, los scripts SQL, los ADR, el concentrado real de octubre 2026 y la documentación oficial de los proveedores.
---

# Viáticos — Informe de investigación: fuentes y APIs

**Elaboró:** Brandom Ledesma  
**Fecha:** 21 de octubre de 2026  
**Organización:** Grupo Lefarma · Tecnología  
**Formato:** informe de investigación (versión PDF en `2026-10-21_informe-investigacion-fuentes-apis.pdf`)

---

## 1. Resumen ejecutivo

El módulo de viáticos ya cubre el ciclo operativo: captura, cálculo, autorización, concentrado y evidencia. La brecha principal no es funcional, sino de **suministro de precios**: el importe que hoy se firma es un estimado de planeación, no una tarifa comprada.

Cinco hallazgos:

1. **Cobertura funcional completa.** 17 endpoints, 7 tablas y un flujo que va del borrador al concentrado FOR-008, con folio, estados, ajustes y evidencia.
2. **Dependencia externa alta.** El motor consulta 10 servicios; 9 se usan sin contrato ni SLA. Solo INEGI, SCT y CNE son fuentes oficiales, y la SCT no ofrece API: se lee su formulario.
3. **El gasto se concentra en dos rubros.** Vuelos (49.8% del total) y hospedaje (19.1%). En vuelos no hay proveedor: el precio sale de una fórmula etiquetada como estimado.
4. **Hay deuda de cumplimiento.** Nominatim prohíbe el autocompletado y la interfaz busca mientras se escribe; el demo de OSRM es no comercial y la aplicación es corporativa.
5. **La salida es contractual, no técnica.** Contratar un API de vuelos (Amadeus o Duffel), uno de hospedaje (Booking o Duffel Stays) y uno de rutas/casetas (Google Routes o TollGuru); el estimado interno queda como control.

> **Hallazgo crítico:** el importe que hoy se firma es un **estimado de planeación**, no una tarifa comprada. La diferencia entre firmar y comprar no está medida: no existe hoy una comparación sistemática entre el estimado y el boleto pagado.

---

## 2. Alcance, método y límites

**Qué se revisó**

- Código backend de Viáticos: controladores, motor de costos, geocodificación, casetas, capturas y Google Places.
- Código frontend: wizard, mapa Leaflet, tablas de cotización, importador y contrato JSON.
- Scripts SQL de Viáticos: tablas, folio, configuración, municipios y permisos.
- ADR-00003, ADR-00007 y ADR-00013; reglas de negocio; formatos FOR-001/FOR-008; cinco libros históricos.
- Documentación oficial y precios de lista de los proveedores evaluados.

**Cómo se verificó**

- Lectura estática y trazo del flujo de datos: qué endpoint llama a qué servicio y con qué respaldo.
- Conciliación con el concentrado de octubre 2026: 20 viajes, 5 viajeros, $276,357 MXN.
- Contraste de cada servicio externo contra su política o página oficial, consultada el 21-oct-2026.
- Separación explícita entre dato publicado, dato estimado y dato histórico.

**Límites**

No se tuvo acceso a contratos, facturación ni logs de tráfico de los proveedores. Los precios de lista pueden cambiar. El concentrado histórico cubre un mes y cinco viajeros de CDMX: no es una muestra representativa de todas las rutas.

---

## 3. Contexto y proceso

Viáticos no es un formulario aislado: es la **Fase 3** del ciclo mensual de talleres médicos. La matriz autorizada dispara tres subflujos: material, box lunch y viáticos.

| Paso | Qué ocurre | Evidencia |
|---|---|---|
| 1. Matriz mensual FOR-005 | El AEM costea los talleres; GV firma, CA revisa y DC autoriza. | `reglas-negocio.md`, fase C |
| 2. Solicitud de viáticos | Conforme a ASK-GGE-IDT-001; el formato ASK-ADM-FOR-001 captura transporte, alimentos, hospedaje, gasolina, casetas, taxis y avión. | ADR-00003, §Contexto |
| 3. Autorización en cadena | Gerente de Ventas, Coordinador Administrativo, Gerente General y Dirección Corporativa. | `reglas-negocio.md`, D6 |
| 4. Ejecución del viaje | El viajero compra y conserva comprobantes; FOR-006 (calendario) y FOR-007 (recibido). | Formatos del proceso |
| 5. Concentrado FOR-008 | Se consolidan los viajes del periodo; firman CA, GG, GAF y DC. | Concentrado octubre 2026 |

**Roles:** AEM/EV/EP solicitan y ejecutan; GV firma la matriz y revisa; CA revisa costos y concentra; GG/DC autorizan; Tesorería paga y comprueba.

> **Documento faltante:** el instructivo **ASK-GGE-IDT-001** "Solicitud y aprobación de viáticos" no está digitalizado en el set. Su contenido se reconstruye por referencias; es la principal laguna documental del proceso.

### 3.1 Volumen y estructura del gasto (octubre 2026)

20 viajes de cinco personas, todos con origen en CDMX. El promedio por viaje es de **$13,818 MXN**; 14 viajes incluyen vuelo.

| Rubro | Importe (MXN) | Participación | Lectura |
|---|---:|---:|---|
| Costo boleto avión | 137,630 | 49.8% | 14 viajes; promedio $9,831 por viaje con vuelo |
| Hospedaje | 52,896 | 19.1% | Rubro tipo tabulador; sensible a la ciudad |
| Taxi | 44,250 | 16.0% | Traslados urbanos y a terminales |
| Comida | 25,100 | 9.1% | Costo diario por viajero |
| Costo boleto autobús | 16,481 | 6.0% | Seis viajes sin vuelo |
| Gasolina / casetas | 0 | 0.0% | No hubo viajes en auto propio en el periodo |
| **Total** | **276,357** | **100%** | |

**Por viajero:**

| Viajero | Viajes | Total MXN | % del mes |
|---|---:|---:|---:|
| César Martín García Alonso | 6 | 74,154 | 26.8% |
| Juan Pablo Peña Portillo | 4 | 85,473 | 30.9% |
| Santiago García Gutiérrez | 5 | 82,268 | 29.8% |
| Ángel Remedios Cadena Barrera | 2 | 8,646 | 3.1% |
| Roberto Cruz Guerrero | 3 | 25,816 | 9.3% |
| **Total** | **20** | **276,357** | **100%** |

> **Dónde duele un error de precio:** vuelo y hospedaje concentran **69% del gasto**. Un error de 10% en vuelos mueve el presupuesto mensual más que todos los taxis juntos.

---

## 4. Qué está implementado

El módulo es una SPA React sobre una API .NET con SQL Server. Cotiza por persona, arma seis propuestas, guarda la opción elegida y la lleva al concentrado.

**Flujo:** Wizard (personas, ruta, fechas, modo, puntos) → Motor (ruta, opciones, hoteles, totales) → Evidencia (fuente, precio, URL, captura) → Salida (borrador, folio, autorización, FOR-008).

**Piezas técnicas**

- Frontend React 19 + Vite; mapa Leaflet con teselas OSM; tablas TanStack.
- API .NET 10 con JWT y permisos; 17 endpoints bajo `/api/viaticos`.
- SQL Server, esquema `viaticos`: solicitudes, opciones, ajustes, eventos, municipios y configuración.
- Capturas con Playwright headless y almacenamiento en `wwwroot/media`.

**Reglas de oro**

- Ninguna opción se muestra sin `fuente`; si es cálculo propio, lleva `estimado: true`.
- El folio nace antes del INSERT: `VIA-{sam}-{0000}` con secuencia de SQL Server.
- Los ajustes guardan valor anterior, valor nuevo y motivo.
- La solicitud guarda un `datos_json` completo y columnas planas para el concentrado.

**Modelo de datos**

| Tabla | Qué guarda | Clave de auditoría |
|---|---|---|
| `solicitudes` | Maestro: folio, periodo, gerencia, estado y `datos_json` | `fecha_creacion` / modificación |
| `solicitud_opciones` | Oferta, precio, moneda, URL, fuente y captura | `fue_elegida`, `capturada_en` |
| `solicitud_ajustes` | Campo, valor anterior, valor nuevo y motivo | `id_usuario_admin` |
| `solicitud_eventos` | Bitácora append-only del workflow | `id_usuario`, `payload_json` |
| `municipios_cat` / `config` | Catálogos y parámetros del motor | Sin auditoría de cambios |

### 4.1 Estados, permisos y trazabilidad

**Estados:** `borrador → enviada → autorizada` / `autorizada_con_ajustes` / `rechazada`.

**Permisos:**

| Permiso | Qué habilita | Rol que lo tiene hoy |
|---|---|---|
| `viaticos.solicitar` | Crear, editar y enviar la solicitud | SuperAdministrador |
| `viaticos.autorizar` | Bandeja, autorizar, rechazar y concentrado | SuperAdministrador |
| `viaticos.ver_todos` | Ver solicitudes de otras personas | SuperAdministrador |
| `viaticos.ajustar` | Modificar un importe con motivo | SuperAdministrador |

**Lo que sí queda auditado:** quién creó, envió, autorizó, rechazó o ajustó; qué opción se eligió, con precio, moneda, URL, fuente y captura fechada; qué campo cambió un ajuste; el folio y el periodo.

**Lo que no:** la fuente del precio histórico de los Excel; la tarifa realmente comprada y su comparación contra el estimado; el CFDI y la conciliación post-gasto; los cambios a `config_parametros` (sin columnas de auditoría).

> **Permisos hoy:** solo SuperAdministrador tiene los cuatro permisos. La matriz de roles sigue pendiente (ADR-00013); sin ella, el módulo no puede operar fuera del piloto.

---

## 5. Fuentes de datos

### 5.1 Mapa de fuentes

| Capa | Fuente | Qué aporta | Runtime | Estado |
|---|---|---|---|---|
| Geografía base | INEGI WSCatGeo + Natural Earth | 2,478 municipios y polígono de México | No | Oficial / estático |
| Direcciones y mapa | Nominatim + Photon + teselas OSM | Búsqueda, geocodificación inversa y mapa | Sí | Comunidad / política OSM |
| Rutas | OSRM (demo público) | Km, tiempo y trazado de carretera | Sí | Demo no comercial |
| Casetas | SCT · Rutas Punto a Punto | Plazas, km y tarifa de automóvil | Sí | Oficial sin API |
| Combustible | CNE · precios de gasolinas | Precio promedio nacional | Sí | Oficial XML |
| Hospedaje | Google Places / OSM / link Booking | Nombres, rating, cercanía y enlace | Sí / opcional | Comercial / OSM |
| Precios de referencia | Seeds SHCP, SEMOVI, aerolíneas y buses | Tabuladores y tarifas base | No | Interno, envejece |
| Evidencia | Playwright + PNG | Captura visual de la oferta | Sí | Legal / ToS |
| Histórico | Excel de octubre 2026 | Calibración y pruebas de regresión | No | Interno, sin fuente |

> Solo tres capas descansan en una fuente oficial, y solo dos de esas tres son legibles por máquina de forma estable. La única capa con contrato comercial posible es **Google Places**, y está apagada por defecto.

### 5.2 Catálogos internos

- **`viaticos.municipios_cat`:** 2,478 municipios y demarcaciones de las 32 entidades, cargados desde INEGI WSCatGeo el 7-oct-2026. La clave INEGI distingue homónimos (Oaxaca tiene dos "San Juan Mixtepec"). Un job semanal carga OSM en staging; el catálogo no depende de OSM en runtime.
- **`viaticos.config_parametros`:** 43 claves clave/valor: 3 de Google Places, 4 de costos generales, 9 de hospedaje por ciudad y 27 de taxi (base/km por ciudad, tarifas SEMOVI CDMX y perímetros de Xalapa). Se editan en BD y el motor las cachea 5 minutos.

**Semillas en código**

| Semilla | Contenido | Riesgo |
|---|---|---|
| Ciudades y terminales | 9 ciudades, 8 aeropuertos y 9 centrales de autobús | Cobertura limitada a las rutas sembradas |
| Líneas y aerolíneas | ETN, ADO, Primera Plus; VivaAerobus, Volaris, Aeroméxico | Tarifas base y factores, no tarifas publicadas |
| Casetas | 7 corredores con total y $1.40/km como respaldo | El peaje real cambia por plaza y vehículo |
| Tabuladores | Hospedaje SHCP, comida $600/día, taxi SEMOVI | Sin fecha de vigencia ni revisión programada |

> **No existe el catálogo del ADR-00003.** La tabla `viatico_tarifas`, su seed y su CRUD nunca se implementaron. El ADR-00013 lo confirma: la arquitectura documentada como "catálogo único" no es la que opera. Lo que opera es un motor de costos con seeds y fuentes externas.

### 5.3 Geografía

- **INEGI WSCatGeo:** servicio oficial, sin token. Entrega claves y nombres; la carga inicial no trae centroides, así que las coordenadas se completan al geocodificar.
- **Natural Earth 1:10m:** polígono de México simplificado (~500 m), embebido en el frontend; candado para rechazar puntos fuera del país. No depende de red.
- **Nominatim + Photon:** Nominatim busca y hace geocodificación inversa; Photon entra solo si Nominatim no devuelve nada. Ambos viven detrás de un proxy con 1 req/s, caché de 6 h y candado de país.
- **Overpass + teselas OSM:** Overpass lista hoteles cuando Google Places no está configurado; las teselas pintan el mapa Leaflet. Servicios comunitarios, sin SLA.

> La geocodificación define los kilómetros; los kilómetros definen gasolina, casetas y taxi. Un error de 30 km en un tramo puede mover el estimado más que un ajuste de tarifa.

### 5.4 Precios de referencia

| Rubro | Fuente | Valor vigente en el código | Uso |
|---|---|---|---|
| Hospedaje CDMX | Tabulador SHCP (seed) | $3,533 / noche | Techo de referencia |
| Hospedaje GDL / MTY | Tabulador SHCP (seed) | $2,006 / $2,353 por noche | Techo de referencia |
| Comida | Configuración | $600 / día | Costo por viajero |
| Gasolina | CNE (promedio nacional) | Magna / premium del día | Costo por km |
| Taxi CDMX | SEMOVI (oficial) | Libre $8.74 + $4.28/km | Traslado urbano |
| Taxi Xalapa | Seed Veracruz | $38.50 perímetro; $50 + $10/km fuera | Traslado urbano |
| Casetas | SCT / seed | Plaza real o $1.40/km | Peaje por tramo |
| Vuelo | Fórmula propia | $690 + $1.45 × km, factor por aerolínea | Estimado fase 1 |
| Autobús | Fórmula + seed | $250 + $1.05 × km, factor por línea | Estimado / respaldo |

> Son **valores de referencia**, no precios de mercado. El propio ADR-00003 lo advertía: "valores de referencia, no precios reales". La interfaz los marca como estimado, pero el usuario puede confundir un techo de tabulador con una tarifa disponible.

### 5.5 Evidencia histórica

**Qué contienen:** cinco libros por viajero (César, Juan Pablo, Santiago, Ángel y Roberto) más el concentrado y el archivo de vuelos; 20 viajes de octubre 2026, origen CDMX, duración de 1 a 5 días; rutas multi-ciudad (Cancún–Playa del Carmen, Los Mochis–Guasave–Culiacán–Mazatlán, Veracruz–Cardel–Córdoba–Xalapa); importes reales por rubro, sin proveedor, clase tarifaria ni fecha de compra.

**Qué falta para convertirlos en datos:** columna de `fuente` (aerolínea, agencia, OTA) y de `captura`; desglose de impuestos, equipaje y cargos; fecha de cotización y de compra; normalización de nombres de ciudad (aparecen "AGUACALIENTES" y "GUERRERO" con errores); llave de correlación con el folio del módulo.

El concentrado se congeló como fixture de regresión (`octubre2026.ts`). Eso protege los importes históricos, pero no los convierte en una fuente de precios: siguen siendo 20 observaciones de un mes.

---

## 6. APIs del módulo

### 6.1 API interna (17 endpoints)

| Método | Ruta | Propósito | Permiso |
|---|---|---|---|
| POST | `/api/viaticos/solicitudes` | Crear borrador con folio | `viaticos.solicitar` |
| GET | `/api/viaticos/solicitudes/mis` | Mis solicitudes | Autenticado |
| GET | `/api/viaticos/solicitudes/{id}` | Detalle de la solicitud | Dueño o `ver_todos` |
| PUT | `/api/viaticos/solicitudes/{id}/opciones` | Guardar opciones elegidas | Dueño o `ver_todos` |
| PUT | `/api/viaticos/solicitudes/{id}` | Actualizar borrador | Dueño o `ver_todos` |
| DELETE | `/api/viaticos/solicitudes/{id}` | Eliminar borrador | Dueño |
| POST | `/api/viaticos/solicitudes/{id}/enviar` | Enviar a autorización | Dueño |
| GET | `/api/viaticos/solicitudes` | Bandeja de autorización | `viaticos.autorizar` |
| POST | `/api/viaticos/solicitudes/{id}/autorizar` | Autorizar | `viaticos.autorizar` |
| POST | `/api/viaticos/solicitudes/{id}/rechazar` | Rechazar con motivo | `viaticos.autorizar` |
| POST | `/api/viaticos/solicitudes/{id}/ajustes` | Ajustar importe o campo | `viaticos.ajustar` |
| POST | `/api/viaticos/costos-ruta/calcular` | Calcular propuesta de ruta | Autenticado |
| POST | `/api/viaticos/capturas` | Capturar URL de oferta | Autenticado |
| GET | `/api/viaticos/capturas/{archivo}` | Servir PNG de evidencia | Autenticado |
| GET | `/api/viaticos/geocodificar` | Geocodificar dirección o punto | **Anónimo** |
| GET | `/api/viaticos/resolver-liga` | Resolver liga corta de mapas | **Anónimo** |
| GET | `/api/viaticos/municipios` | Catálogo de municipios | Autenticado |

### 6.2 Motor de costos

El cálculo es stateless: recibe personas, lugares, fechas y modo; normaliza, rutea, genera opciones, arma seis propuestas y devuelve totales con su origen.

| Etapa | Qué hace | Fuente o regla |
|---|---|---|
| 1. Normalizar | Personas, lugares, fechas, modo, auto propio y horario laboral | Entrada del wizard |
| 2. Rutar | Km, tiempo y trazado entre puntos | OSRM; si falla, seed de distancia |
| 3. Opcionar | Auto, renta, bus, avión, taxi y transporte público | Seeds + ClickBus + Distribusion + SCT + CNE |
| 4. Proponer | Barata, rápida, equilibrada y tipo 1/2/3 (carro, bus, avión) | Motor de costos |
| 5. Hospedar | Hoteles cercanos con rating y distancia | Google Places; si no, Nominatim/Overpass |
| 6. Declarar | Precio, moneda, URL, nota, fuente y bandera de estimado | Contrato de salida |

**Fortaleza:** cada opción declara `fuente` y `estimado`; si un proveedor cae, el motor baja a seed y lo dice. La interfaz muestra la fuente en la tabla.

**Límite:** el motor no reserva ni compra. La "URL de compra" es un enlace profundo, no una tarifa confirmada. Tampoco compara el estimado contra el boleto pagado.

### 6.3 Servicios externos

| Servicio | Uso | Auth | Caché / timeout | Respaldo |
|---|---|---|---|---|
| OSRM | Ruta carretera | Ninguna | 8 s; sin caché | Seed de distancia |
| Nominatim | Búsqueda y reversa | User-Agent | 1 req/s; 12 s; 6 h | Photon |
| Photon | Búsqueda tolerante | User-Agent | 1 req/s; 12 s; 6 h | Ninguno |
| Overpass | Hoteles | Ninguna | 8 s; 3 espejos | Nominatim |
| SCT SIBUAC | Casetas | Sesión (cookie) | 24 h; sin timeout explícito | Seed $1.40/km |
| CNE | Gasolina | Ninguna | 15 s; 1 h | Seed 23.5 / 25.5 |
| Google Places | Hoteles | API key | 6 h; sin timeout | OSM |
| ClickBus | Autobuses | Ninguna | 10 s | Seed bus |
| Distribusion | Autobuses | `retailerPartnerNumber` | 10 s | Seed bus |
| Teselas OSM | Mapa | Ninguna | Según headers | Sin respaldo |

> Nueve de diez servicios se consumen sin contrato ni SLA. Solo Google Places tiene una relación comercial posible; hoy está apagado por defecto.

### 6.4 Contrato con el agente de investigación

El módulo define un contrato JSON Schema draft 2020-12 (`cotizacion-viajes.schema.json`) para que un agente externo entregue una cotización con cobertura declarada y evidencia.

Campos raíz: `version`, `consulta`, `cobertura_declarada`, `transportistas_no_encontrados`, `opciones`.

Reglas:

- `transportistas_no_encontrados` es obligatorio, aunque vaya vacío: es el mecanismo de honestidad de cobertura.
- `precio: null` solo se admite si `fuente` es literalmente "estimado".
- Fechas ISO 8601 con zona; URL de compra y capturas reales; `consultado_en` por opción.
- El importador valida sin dependencias y rechaza campos extra.

> Es un acuerdo para que un **agente externo** investigue y entregue un JSON. No es una API de precios: no hay endpoint, credencial, SLA ni refresco automático. Su valor es la disciplina de cobertura y evidencia.

### 6.5 Capturas y evidencia

**Flujo:** hasta 10 URLs por llamada → validación (http/https, sin IP interna, sin dominios prohibidos) → Playwright headless (2 en paralelo, 30 s por página) → PNG en `wwwroot/media` ligado a la opción.

| Control | Hoy | Lectura |
|---|---|---|
| Esquema | Solo http/https | Bloquea `file:`, `data:` y metadatos |
| Destinos internos | Loopback, RFC1918, CGNAT, `.local` | Protección anti-SSRF |
| Dominios prohibidos | `booking.com` y `expedia.com` | Decisión de plan: no scraping a OTAs |
| Lista blanca | Vacía por defecto | Cada captura lleva aviso; poblar antes de producción |
| Timeout | 55 s duro por proceso | Evita procesos colgados |

> Capturar una página de terceros no equivale a tener derecho a hacerlo. La lista blanca vacía y la ausencia de retención son deuda: definan dominios permitidos, plazo de conservación y redacción de datos personales.

---

## 7. Proveedores evaluados

### 7.1 Vuelos

Hoy el precio del vuelo es una fórmula ($690 + $1.45/km, con factores por aerolínea), no una tarifa. Es la brecha de mayor impacto económico del módulo.

| Opción | Cobertura | Costo de referencia | Esfuerzo | Veredicto |
|---|---|---|---|---|
| Fórmula actual | Ninguna tarifa real | $0 | — | Estimar y etiquetar |
| Amadeus Self-Service | 400+ aerolíneas | Prueba: 2,000 búsquedas/mes gratis; producción: pay-as-you-go con cuota gratuita | Bajo | **Recomendado para cotizar** |
| Duffel | 500+ aerolíneas | $3 USD por orden + 1% de managed content | Medio | Recomendado si se compra |
| Directo / NDC por aerolínea | Por convenio | Contrato y volumen | Alto | Solo con volumen |

**Validar low-cost mexicanas:** Amadeus advierte que su entorno de pruebas no incluye algunas aerolíneas de bajo costo ni American Airlines, Delta y British Airways. Antes de firmar, hay que probar VivaAerobus y Volaris en producción. Duffel no garantiza por sí mismo la presencia de esas rutas: se valida con una búsqueda real.

**Por qué Amadeus primero:** menor barrera de entrada (cuenta self-service, cuota gratuita mensual y ambiente de pruebas). Permite cotizar sin construir una agencia de viajes. Duffel entra cuando el alcance incluya reservar y gestionar órdenes.

### 7.2 Hospedaje

Google Places da hoteles reales, cercanía y calificación, pero no tarifa ni disponibilidad. El precio sigue saliendo del tabulador.

| Opción | Qué aporta | Acceso | Costo | Veredicto |
|---|---|---|---|---|
| Google Places (hoy) | Nombre, dirección, rating, cercanía | API key; opcional | Text Search Enterprise: USD $35 / 1,000 | Descubrimiento, no precio |
| Booking.com Demand API | Inventario y disponibilidad de Booking | Solo Managed Affiliate Partner | Comisión / convenio | Mejor cobertura; contrato |
| Duffel Stays | 1.6 M propiedades; reserva | Cuenta Duffel | Profit share por estancia | Una sola integración con vuelos |
| OSM / Nominatim | Nombres y ubicación | Público | $0 | Respaldo |

> **Contradicción operativa:** el servicio de capturas prohíbe `booking.com` y `expedia.com`, pero el motor genera enlaces de búsqueda a Booking. El enlace es válido; la captura no. Si Booking se vuelve fuente, la evidencia debe ser la respuesta del API, no un pantallazo.

### 7.3 Autobuses

Los operadores mexicanos no exponen APIs públicas de tarifa. En la práctica se llega por agregadores; hoy el código usa dos sin contrato y cae a semillas.

| Opción | Qué aporta | Acceso | Riesgo | Veredicto |
|---|---|---|---|---|
| ClickBus adapter (hoy) | Horarios, precio y asientos | Endpoint tipo adapter, sin llave | Alto: sin contrato ni documentación pública | Negociar o retirar |
| Distribusion (hoy) | Conexiones de su red | `retailerPartnerNumber` de ejemplo | Alto: número demo, sin credencial | Contratar y validar MX |
| ClickBus / Busbud / Distribusion | Inventario y reserva | Convenio B2B | Medio: cobertura por corredor | Elegir uno y firmar |
| Semillas ETN / ADO / Primera Plus | Respaldo cuando falla el conector | Código | Medio: tarifa base, no publicada | Mantener etiquetado |

> Si el conector falla, el motor devuelve la semilla pero conserva la etiqueta de respaldo. La interfaz debe hacer evidente que el precio **no** es de venta.

### 7.4 Rutas y casetas

La ruta se calcula con el demo público de OSRM y las casetas se raspan del formulario de la SCT. Ambos funcionan, pero ninguno es una base contractual para producción.

| Opción | Qué aporta | Costo | Esfuerzo | Veredicto |
|---|---|---|---|---|
| OSRM demo (hoy) | Km, tiempo y trazado | $0 | — | Reemplazar |
| OSRM self-host | Mismo motor, bajo control | Infraestructura + operación | Alto | Si el volumen lo justifica |
| Google Routes API | Tráfico y `tollInfo` en México | Por llamada; peaje a tarifa alta | Bajo | **Recomendado para casetas** |
| TollGuru | Plazas, vehículo y ruta | USD $80/mes hasta 5,000 transacciones | Medio | Alternativa competitiva |
| SCT SIBUAC | Plazas y tarifas oficiales | $0 | Parser HTML | Cruce de auditoría |

> La política del demo de OSRM dice: "restricted to reasonable, non-commercial use-cases. Do not exceed 1 request per second." Lefarma es una aplicación corporativa; el demo no es la base correcta.

### 7.5 Tipo de cambio y servicios vecinos

Hoy todo el cálculo está en MXN. En cuanto entre un proveedor que cotice en USD —vuelos, hospedaje o casetas— hace falta una tasa oficial y fechada.

| Servicio | Uso | Acceso | Costo | Estado |
|---|---|---|---|---|
| Banxico SIE | Tipo de cambio FIX USD/MXN | Token de 64 caracteres | Gratuito; 80 consultas/min y 40,000/día | Recomendado |
| INEGI WSCatGeo | Municipios y claves | Sin token | Gratuito | En uso |
| SAT · CFDI | Comprobación post-gasto | Certificados / proveedor | Variable | No implementado |
| Clara u otra tarjeta corporativa | Transacciones y conciliación | Cliente y mTLS | Comercial | Fuera de alcance |

> Guardar la tasa y la fecha **en la cotización**. Nunca recalcular una cotización histórica con la tasa de hoy: cambia el importe firmado y rompe la auditoría.

---

## 8. Riesgos y cumplimiento

### 8.1 Matriz de riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| OSRM demo bloqueado o cambiado | Alta | Medio | Contratar routing o self-host; caché por par origen-destino |
| Nominatim bloquea por autocompletado | Media | Alto | Búsqueda explícita (Enter/botón) o geocoder comercial |
| La SCT cambia su formulario | Alta | Medio | Pruebas de parser + Google Routes/TollGuru como respaldo |
| ClickBus/Distribusion dejan de responder | Alta | Medio | Convenio, caché corta y etiqueta de estimado |
| Fuga de la llave de Google | Media | Alto | Key Vault, restricciones por API/IP y alertas de gasto |
| Seeds envejecidos | Alta | Medio | Fecha de vigencia por clave y revisión mensual |
| Captura de páginas sin derecho | Media | Alto | Lista blanca, permiso expreso y retención |
| Abuso de geocodificación anónima | Media | Medio | Autenticar, limitar por usuario y por IP |

> **Riesgo silencioso:** los respaldos funcionan; si un servicio cae, el motor devuelve una semilla. El problema es que el usuario puede firmar un estimado creyendo que es una tarifa. La mitigación no es técnica: es etiquetar la confianza en la interfaz y en el PDF.

### 8.2 OpenStreetMap: tres políticas, tres brechas

| Servicio | Lo que exige la política | Lo que hace hoy el módulo | Acción |
|---|---|---|---|
| Nominatim | Máximo 1 req/s; prohibido el autocompletado; poder cambiar de proveedor | Proxy con 1 req/s y caché 6 h, pero la UI busca a los 400 ms de teclear; endpoint anónimo | Búsqueda con Enter/botón o geocoder comercial |
| OSRM demo | Uso razonable, **no comercial**; máximo 1 req/s; sin garantía | App corporativa; llamadas por cálculo; sin contrato | Contratar routing o self-host |
| Teselas OSM | URL exacta `tile.openstreetmap.org`; User-Agent/Referer; caché ≥ 7 días; sin descarga masiva | Usa `{s}.tile.openstreetmap.org`, un patrón que la política desaconseja; atribución presente | Corregir URL o contratar proveedor de teselas |

Citas que importan:

> Nominatim: "Auto-complete search … you must not implement such a service on the client side using the API."
>
> OSRM: "restricted to reasonable, non-commercial use-cases."

No son recomendaciones: son condiciones de uso.

**Lo que ya está bien:** el backend identifica la app con User-Agent, respeta 1 req/s en geocodificación, cachea 6 h, acota a México y deduplica. La base técnica existe; falta alinear la UX y el consumo corporativo.

### 8.3 Riesgos de datos y de negocio

- **Estimado vs. comprado:** el módulo no reserva ni compra. El importe firmado puede diferir del boleto pagado. No hay medición de esa varianza.
- **Cobertura declarada, pero solo en el prompt:** el contrato del agente exige declarar transportistas no encontrados; en runtime, el motor no muestra una línea de cobertura por cotización.
- **Datos que envejecen:** las semillas no tienen fecha de vigencia. El hospedaje es el rubro más sensible: un tabulador de 2025 aplicado a 2026 distorsiona el 19% del gasto.
- **Muestra histórica sesgada:** 20 viajes, 5 viajeros, origen CDMX, un mes. Sirve para regresión, no para concluir tarifas de todas las rutas ni de otras gerencias.

**Qué medir:** % de opciones con fuente viva, varianza estimado vs. comprado y % de cotizaciones con captura. Sin esos tres indicadores, el módulo no puede demostrar que está mejorando.

### 8.4 Seguridad y privacidad

| Activo | Riesgo | Control actual | Recomendación |
|---|---|---|---|
| Geocodificación | Proxy abierto a Internet | Anónimo; 1 req/s; caché | Exigir JWT y limitar por usuario |
| Resolvedor de ligas | SSRF / open redirect | Lista blanca de hosts y saltos | Mantener y auditar |
| Llave de Google | Exposición y gasto | Texto plano en `config_parametros` | Key Vault + restricciones + alertas |
| Capturas PNG | Contenido de terceros y PII | Anti-SSRF y dominios prohibidos | Retención 90 días y redacción |
| Datos del viajero | Nombre, SAM, ruta y fechas | JWT y permisos | Minimizar y enmascarar en logs |
| Configuración | Cambios sin rastro | Solo `fecha_creacion` | Columnas de auditoría e historial |

---

## 9. Recomendaciones

### 9.1 Hoja de ruta

| Horizonte | Acciones | Resultado esperado |
|---|---|---|
| **0–30 días** | Cambiar el buscador a Enter/botón o contratar geocoder; corregir la URL de teselas o contratar proveedor; etiquetar confianza (viva/seed/estimado); fecha de vigencia por semilla; mover la llave de Google a secreto y autenticar geocoding. | Cumplimiento OSM y confianza visible en la cotización. |
| **30–90 días** | Integrar Amadeus (cotización) o Duffel (cotización + reserva); integrar casetas con Google Routes o TollGuru; contratar ClickBus/Distribusion o retirar el rótulo "en vivo"; agregar tipo de cambio Banxico; definir política de capturas. | Precio de vuelo y caseta con fuente contractual; varianza medible. |
| **90–180 días** | API de hospedaje (Booking Demand o Duffel Stays); reserva y conciliación con CFDI; observatorio de precios por corredor y temporada; SLA, alertas y tablero; evaluar TMC u OBT corporativo. | Operación con reserva, conciliación y SLA. |

**Indicadores:** % de opciones con fuente viva; varianza estimado vs. comprado; % de cotizaciones con captura; latencia p95 y costo por cotización.

### 9.2 Cinco decisiones que se piden al negocio

| # | Decisión | Por qué importa | Quién decide |
|---|---|---|---|
| 1 | ¿El módulo cotiza o también compra? | Determina Amadeus (cotizar) vs. Duffel/TMC (reservar y gestionar). | Dirección + Finanzas |
| 2 | ¿Cuál es el importe oficial: el estimado interno o la cotización del proveedor? | Hoy se firma un estimado; si el proveedor manda, cambia el flujo de autorización. | Dirección Corporativa |
| 3 | ¿Se contrata routing/geocoding/teselas o se autoaloja? | Cierra la deuda de cumplimiento OSM y la dependencia de demos. | Tecnología + Compras |
| 4 | ¿Quién es dueño del catálogo de precios y de su revisión mensual? | Sin dueño, las semillas envejecen y el estimado pierde credibilidad. | Administración |
| 5 | ¿Cuál es la política de evidencia y retención de capturas? | Define qué se puede capturar, por cuánto tiempo y con qué redacción. | Legal + Seguridad |

> Si no se decide, el módulo seguirá funcionando como un **cotizador de referencia**: útil para planear, insuficiente para comprar y difícil de defender ante auditoría cuando el boleto pagado difiera del estimado.

---

## 10. Anexos

### 10.1 Configuración y secretos

43 claves en `viaticos.config_parametros`: Google Places (3), costos generales (4), hospedaje (9) y taxi (27).

| Secreto | Dónde vive | Riesgo |
|---|---|---|
| Llave Google | `config_parametros` (texto) | Alto |
| Cadena SQL | `appsettings` / entorno | Medio |
| JWT | `appsettings` / entorno | Medio |
| SMTP | `appsettings` / entorno | Medio |

> La tabla solo tiene `fecha_creacion`. No hay usuario, fecha de modificación ni historial. Un cambio de tarifa no deja rastro de quién lo hizo.

### 10.2 Fuentes consultadas

**Internas**

- **F1** Backend Viáticos: `Features/Viaticos/*.cs` (controladores, `CalculoCostosRuta`, `GeocodificarService`, `CasetasRutaService`, `GooglePlacesService`, `CapturasService`). 21-oct-2026.
- **F2** Frontend Viáticos: `src/apps/viaticos/**` (`PuntoMapaPicker`, `MapaPunto`, servicios, páginas, fixtures). 21-oct-2026.
- **F3** Scripts SQL: `lefarma.database/viaticos/0002–0014, 0100`. 21-oct-2026.
- **F4** ADR-00003 "Estimador de viáticos por catálogo configurable".
- **F5** ADR-00007 "Búsqueda y cotización de viáticos".
- **F6** ADR-00013 "Planeación personal y handoff a viáticos".
- **F7** `reglas-negocio.md` (fases, roles y viáticos).
- **F8** Concentrado `VIATICOS EDUCACION MEDICA OCTUBRE 2026` (FOR-008).
- **F9** `VUELOS EDUCACION MEDICA OCTUBRE 2026` y libros por viajero.
- **F10** Prompt `busqueda-viaticos.md` v1.0.0.
- **F11** Schema `cotizacion-viajes.schema.json`.
- **F12** Manual institucional `manual_modulo_rh.pdf` (referencia de formato).

**Externas** (consultadas el 21-oct-2026)

- **F13** INEGI, Catálogo Único de Claves Geoestadísticas: <https://inegi.org.mx/servicios/catalogounico.html>
- **F14** Nominatim Usage Policy: <https://operations.osmfoundation.org/policies/nominatim/>
- **F15** OSM Tile Usage Policy: <https://operations.osmfoundation.org/policies/tiles/>
- **F16** OSRM Demo server: <https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server>
- **F17** SICT, Rutas Punto a Punto: <https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdEscogeRuta>
- **F18** Amadeus Self-Service Pricing: <https://developers.amadeus.com/pricing>
- **F19** Amadeus Flight Offers Search: <https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search>
- **F20** Duffel Pricing: <https://duffel.com/pricing>
- **F21** Duffel API: <https://duffel.com/docs>
- **F22** Booking.com Demand API: <https://developers.booking.com/demand/docs>
- **F23** Google Places API billing: <https://developers.google.com/maps/documentation/places/web-service/usage-and-billing>
- **F24** Google Routes API, tolls: <https://developers.google.com/maps/documentation/routes/calculate_toll_fees>
- **F25** TollGuru Toll API pricing: <https://tollguru.com/toll-api-pricing-plans>
- **F26** Distribusion API: <https://docs.distribusion.com/>
- **F27** Banxico SIE API: <https://www.banxico.org.mx/SieAPIRest/service/v1>
- **F28** CNE, precios de gasolinas: <https://publicacionexterna.azurewebsites.net/publicaciones/prices>

### 10.3 Glosario

- **AEM:** Administrador de Educación Médica.
- **ADR:** Architecture Decision Record.
- **API:** Application Programming Interface.
- **ASK-GGE-IDT-001:** instructivo de solicitud y aprobación de viáticos (no digitalizado).
- **CA:** Coordinador Administrativo.
- **CFDI:** Comprobante Fiscal Digital por Internet.
- **CNE:** Comisión Nacional de Energía.
- **DC:** Dirección Corporativa.
- **EV / EP:** Ejecutivo de Ventas / Especialista.
- **FOR-005 / 006 / 007 / 008:** Matriz mensual / Calendario / Recibido / Concentrado.
- **GG:** Gerente General.
- **GV:** Gerente de Ventas.
- **JSON:** JavaScript Object Notation.
- **JWT:** JSON Web Token.
- **mTLS:** autenticación mutua por certificado.
- **MXN:** peso mexicano.
- **NDC:** New Distribution Capability.
- **Nominatim / Photon:** geocodificadores sobre OpenStreetMap.
- **OSM:** OpenStreetMap.
- **OSRM:** Open Source Routing Machine.
- **OTA:** Online Travel Agency (Booking, Expedia).
- **Overpass:** consulta de objetos de OpenStreetMap por área.
- **SCT / SICT:** Secretaría de Infraestructura, Comunicaciones y Transportes.
- **Seed:** valor de respaldo embebido en el código, no una tarifa publicada.
- **SLA:** acuerdo de nivel de servicio.
- **SPA:** Single Page Application.
- **SSRF:** Server-Side Request Forgery.
- **TMC:** Travel Management Company.
- **UI / UX:** interfaz de usuario / experiencia de usuario.
- **Varianza:** diferencia entre el importe estimado y el realmente pagado.
- **Viático:** recursos para transporte, hospedaje y alimentación fuera del lugar de adscripción.

---

**Cierre.** El módulo resolvió lo difícil de la operación: capturar, calcular, autorizar y concentrar con evidencia. Lo que sigue no es más pantalla: es sustituir la fórmula por una tarifa y medir la diferencia. Empezar por vuelos y casetas: son el mayor gasto y la mayor brecha de fuente.
