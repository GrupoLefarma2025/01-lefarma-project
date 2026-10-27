---
fecha_creacion: 2026-10-21
fecha_modificacion: 2026-10-21
autor: Brandom Rafael Ledesma Muñoz
resumen: Informe de control de calidad del proceso de viáticos de Grupo Lefarma. Explica, sin tecnicismos, dónde se pierde el control del precio, qué APIs se consultarían para investigar costos reales (vuelos, hospedaje, autobuses, rutas/casetas y tipo de cambio) y qué decisiones se piden. La versión detallada y técnica se conserva en _archivo/.
---

# Viáticos — Control de calidad y APIs para costos reales

**Elaboró:** Brandom Rafael Ledesma Muñoz  
**Fecha:** 21 de octubre de 2026  
**Área:** Grupo Lefarma · Calidad  
**Versión PDF:** `2026-10-21_informe-viaticos-calidad-y-apis.pdf`

---

## 1. Las APIs para investigar costos

### 1.1 Qué es una API

Es una **interfaz: un acuerdo entre dos sistemas para intercambiar información**. No es una base de datos ni una lista de precios. Es la ventanilla con reglas: un sistema pide algo concreto y el otro responde en un formato acordado. Por ejemplo: “dame los vuelos de esta ruta y fecha” y el proveedor devuelve horarios, disponibilidad y condiciones.

- **Un contrato:** define qué se puede pedir y cómo se responde.
- **Un intermediario:** no guarda los datos; los pide a otro sistema.
- **Un formato común:** las respuestas llegan ordenadas y se pueden comparar.

### 1.2 Mapa de APIs por tipo de costo

| Tipo de costo | Fuente que se consulta | Qué se le pregunta | Qué devuelve | Costo |
|---|---|---|---|---|
| Vuelos | Algoritmo propio + tarifas de referencia | Ruta, fecha y aerolínea | Precio estimado por aerolínea | **$0** |
| Hospedaje | Tabulador + OpenStreetMap | Destino y noches | Tarifa de referencia y hoteles cercanos | **$0** |
| Autobús | Algoritmo propio + portales públicos | Ruta y fecha | Línea, horario y precio estimado | **$0** |
| Ruta y casetas | OSRM + SCT | Ruta en auto | Km, tiempo y casetas oficiales | **$0** |
| Direcciones | OpenStreetMap | Hospital o terminal | Coordenadas | **$0** |

### 1.3 Vuelos, hoteles y taxis

**Vuelos**

- Hoy: algoritmo propio con tarifas de referencia.
- Opciones: Duffel (prueba gratis), Travelpayouts (precios cacheados) y Amadeus Enterprise (solo contrato).
- Decisión: Duffel para el piloto.

**Hoteles**

- Hoy: tabulador + Google Places (nombres y rating).
- Opciones: Google Places (5,000 gratis/mes), Duffel Stays (prueba) y Booking Demand (socio).
- Decisión: Google Places + Duffel Stays.

**Taxis**

- Hoy: tarifas SEMOVI/Xalapa + OSRM.
- Opciones: Google Routes (10,000 gratis/mes), TaxiFareFinder (API beta) y Uber/DiDi (solo enlaces).
- Decisión: Google Routes + tarifas locales.

### 1.4 Autobuses, rutas y casetas

**Autobuses**

- Algoritmo propio con líneas conocidas y portales públicos de consulta.
- ClickBus o Distribusion solo si se necesita precio y asientos en vivo.

**Rutas y casetas**

- OSRM para la ruta y el catálogo de la SCT para las plazas de cobro.
- Google Routes o TollGuru solo si se necesita cobertura total y garantía.

> Regla práctica: primero se usan las fuentes actuales; las alternativas se evalúan solo si hacen falta.

### 1.5 De dónde salen los datos

| Dato | De dónde sale | Cómo se usa |
|---|---|---|
| Kilómetros | OSRM: ruta entre los puntos | Distancia del tramo |
| Gasolina | CNE: precio promedio nacional | Litros = km ÷ 12; costo = litros × precio |
| Casetas | SCT: plazas y tarifas oficiales | Suma de plazas; si no hay, $1.40/km |
| Hospedaje | Tabulador por ciudad | Noches × tarifa |
| Taxi | Tarifa local (SEMOVI/Xalapa) | Base + km × tarifa |
| Vuelo y autobús | Fórmula propia | Base + km × factor |

> SCT y CNE son datos oficiales; kilómetros, vuelos y autobuses son estimaciones.

### 1.6 Cómo se calcula un viaje

| Concepto | Fórmula |
|---|---|
| Gasolina | (km ÷ 12) × precio del litro |
| Casetas | Suma de las plazas de la ruta |
| Hospedaje | Noches × tarifa de la ciudad |
| Taxis | Base + (km × tarifa) |
| Total | Suma de todos los conceptos |

> Si falta un dato, se usa un valor de respaldo y se marca como estimado.

### 1.7 Cómo se vería en la práctica

1. **El empleado pide** origen, destino, fechas y personas.
2. **El sistema consulta** vuelos, hotel, autobús y ruta.
3. **Llegan los datos** con fuente, vigencia y condiciones.
4. **Calidad decide** compara, autoriza y guarda evidencia.

| Paso | Qué deja |
|---|---|
| 1 · El empleado pide | Solicitud completa |
| 2 · El sistema consulta | Consulta trazable |
| 3 · Llegan los datos | Dato con fuente y fecha |
| 4 · Calidad decide | Evidencia guardada |

### 1.8 Límites gratis y más opciones

| Fuente | Límite gratis | Qué agrega | ¿La usamos? |
|---|---|---|---|
| Google Maps | 10,000 llamadas/mes por SKU Essentials; 5,000 Pro | Direcciones, lugares, rutas y casetas | Sí, para piloto |
| OpenRouteService | 2,000 rutas/día; 3,000 geocodificaciones/día | Rutas alternativas e isocronas | Solo pruebas |
| Mapbox | 50,000 mapas; 100,000 geocoding/directions al mes | Mapas y rutas | Alternativa |
| Geoapify | 3,000 créditos/día | Geocoding, rutas y POIs | Alternativa comercial |
| OpenCage | 2,500 geocodificaciones/día | Direcciones | Solo pruebas |
| TollGuru | 14 días; 150 transacciones/día | Casetas | Piloto |
| Travelpayouts | Data API con cuenta de afiliado | Precios cacheados de vuelos | Limitado |

> Los límites gratis alcanzan para un piloto; producción exige revisar términos.

### 1.9 Datos de Google Maps que podemos sumar

- **Places:** hoteles, restaurantes, direcciones y calificaciones.
- **Geocoding:** convierte direcciones en coordenadas y viceversa.
- **Routes:** distancia, tiempo, ruta y casetas.
- **Time Zone:** hora local para armar itinerarios.

> Google da 10,000 llamadas al mes por SKU Essentials y 5,000 por SKU Pro. Con cuenta de facturación y límites claros, alcanza para un piloto.

---

## 2. Decisiones

### 2.1 Cinco decisiones que se piden

| # | Decisión | Qué define |
|---|---|---|
| 1 | ¿El módulo solo cotiza o también compra? | Duffel (cotizar y reservar) o una TMC; Amadeus Enterprise solo con contrato. |
| 2 | ¿Qué fuente es la oficial: la estimación interna o la del proveedor? | Define qué dato se firma y cuál se audita. |
| 3 | ¿Nos quedamos con las fuentes actuales o evaluamos un proveedor externo? | Hoy se usan fuentes gratuitas; se evalúa un proveedor solo si aporta cobertura. |
| 4 | ¿Quién es dueño del catálogo de fuentes y tarifas? | Quién lo revisa cada mes y responde por él. |
| 5 | ¿Qué evidencia conservamos y por cuánto tiempo? | Qué se puede defender ante una auditoría. |

> Si no se decide, las APIs por sí solas no cambian el control: sin dueño y sin política, la tarifa sigue siendo un supuesto.

---

## 3. APIs: las que usamos y las que no

| API o fuente | ¿La usamos? | Para qué | Costo | Por qué |
| --- | --- | --- | --- | --- |
| OpenStreetMap | Sí | Direcciones, mapas y hoteles cercanos | $0 | Cobertura nacional y sin contrato. |
| OSRM | Sí | Ruta, kilómetros y tiempo | $0 | Código abierto y suficiente para estimar. |
| SCT / CNE / INEGI | Sí | Casetas, gasolina y municipios | $0 | Fuentes oficiales. |
| Amadeus Enterprise | No | Vuelos | Por solicitud | Self-Service cerró en julio 2026; solo Enterprise con contrato. |
| Duffel | No | Vuelos y hospedaje | $3/orden + 1% | Requiere contrato y volumen. |
| Booking Demand | No | Hospedaje | Comisión | Solo para socios afiliados. |
| ClickBus / Distribusion | No | Autobuses | Convenio | Requieren acuerdo comercial. |
| Google Routes / TollGuru | No | Rutas y casetas | De pago | La SCT ya da las casetas oficiales. |

> Tres fuentes que usamos; cinco alternativas principales que no.

**Elaboró:** Brandom Rafael Ledesma Muñoz · Grupo Lefarma · Calidad · 21 de octubre de 2026
