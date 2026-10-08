---
fecha_creacion: 2026-10-07 09:40
fecha_modificacion: 2026-10-07 09:40
resumen: Reconcilia el ADR-00003 con la capa de búsqueda y captura/screenshots de cotizaciones de vuelos y hoteles. El catálogo interno (educacion_medica.viatico_tarifas) sigue siendo la única fuente de precios en runtime; la búsqueda web y las capturas son una capa de evidencia que Contextualiza el estimado sinsustituir al catálogo.
---

# ADR-00007 — Búsqueda y cotización de viáticos: capa de evidencia sobre el catálogo

## Status

Accepted

> Este ADR **no reemplaza** el ADR-00003; lo **extiende**. El ADR-00003 (estimador de viáticos por catálogo configurable) sigue vigente para el cálculo. Lo que este ADR define es una capa ortogonal —búsqueda web + capturas/cotizaciones verificables— que se apoya en el catálogo y **no lo sustituye**.

> Reconciliación con el ADR-0003 (texto literal de su §Decisión): *"Las APIs gratuitas y las consultas web solo se usarán para alimentar el catálogo inicial o para actualizaciones puntuales, nunca como dependencia del cálculo cotidiano."*

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Contexto|Contexto]]
- [[#Fases|Fases]]
- [[#Modelo de datos|Modelo de datos]]
- [[#Endpoints y pantallas|Endpoints y pantallas]]
- [[#Permisos|Permisos]]
- [[#Consecuencias|Consecuencias]]
  - [[#Positivas|Positivas]]
  - [[#Negativas|Negativas]]
  - [[#Neutras|Neutras]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

Se implementa una **capa de búsqueda y cotización de vuelos y hoteles** que convive con el catálogo interno, con la siguiente frontera inviolable:

1. **El catálogo interno sigue mandando en el cálculo.** El estimado de viáticos que se firma y se autoriza se computa **únicamente** leyendo `educacion_medica.viatico_tarifas` (ADR-0003). Ningún precio de la capa de búsqueda entra al cálculo del estimado de referencia.

2. **La capa de búsqueda es una ayuda de planeación, no una fuente de verdad.** Su salida es una **propuesta cotizada** con ofertas de vuelos/autobuses/hoteles obtenidas de búsqueda web y Apps, con su `fuente` y su marca `estimado`. Sirve para que la persona elija con información real (no solo tarifas de referencia), pero **no replaces la tabla del catálogo**.

3. **La captura (imagen/URL de la oferta) es la evidencia auditable.** Cada oferta guardada guarda su origen y su captura associated, para poder justificar después ante Controloría/Auditoría el importe cotizado. Esto cubre el hueco que el ADR-0003 dejó abierto: *"Valores de referencia, no precios reales: el presupuesto puede diferir del gasto final, especialmente en vuelos y hospedaje."*

4. **La cotización propuesta nunca se escribe automáticamente en el catálogo.** Alimentar el catálogo con precios reales sigue siendo una decisión humana y periódica (como ya establecía el ADR-0003). La capa de búsqueda genera la *insumo* para esa actualización, pero la carga al catálogo es un acto administrativo explícito, no un efecto colateral de cotizar.

5. **El catálogo mantiene la propiedad del "estimado oficial"; la capa aporta el "cotizado real de la propuesta".** En la interfaz el usuario ve ambos: el estimado de referencia (del catálogo) y, encima, la propuesta cotizada con su desglose por tramo, precios reales y evidencia. Queda explícito cuál es cuál para evitar que un cotizado se confund con el estimado aprobable.

> **Nota de coherencia:** el ADR-0003 sigue siendo el documento canónico del catálogo y del cálculo. Este ADR define la capa adyacente; su §Decisión no contradice el punto del ADR-0003 citado arriba, porque la búsqueda web aquí se usa como **apoyo a la planeación y a la actualización del catálogo**, nunca como dependencia del cálculo cotidiano del estimado. Es decir: la regla del 0003 se mantiene íntegra; esta capa vive "por encima" del cálculo, no "en lugar de" él.

## Contexto

El ADR-0003 decidió que el cálculo de viáticos se base en un catálogo interno y que las fuentes externas (APIs gratuitas, sitios de-released) solo alimentaran la carga inicial y actualizaciones puntuales. El Concentrado de Viáticos real de octubre 2026 muestra por qué esa frontera, por sí sola, no bastaba:

- Los precios de **vuelo** reales del concentrado varían mucho por ruta y por temporada (p. ej. $8,541 Los Mochis–Mazatlán, $13,912 Durango–Aguascalientes, $14,963 Cancún). Una tarifa `VueloRuta` por corredor difícilmente refleja eso sin mantenimiento constante.
- El ADR-0003 ya señalaba la consecuencia negativa: *"Carga operativa: el área debe mantener actualizadas las tarifas... valores de referencia, no precios reales"*. La operación real confirma esa carga.

Al mismo tiempo, el flujo de planeación de rutas (ADR-0004) necesita mostrar a la persona **cuánto costaría realmente** su ruta (vuelo + hospedaje) para elegir entre una u otra forma de transporte, antes de que exista el estimado oficial. Esa pregunta ("¿cuánto me sale de verdad?") solo se responde con precios reales, no solo con el catálogo.

De ahí la necesidad de una capa que:
- dé precios reales de contexto sin depender de ellos para el cálculo oficial,
- deje rastro auditable (capturas) de dónde salió cada precio cotizado,
- y no invada la propiedad del catálogo.

## Fases

| Fase | Contenido | Verificación |
|---|---|---|
| **B1** | Frontend: tipo de oferta (`CostosRutaOferta`) y propuesta (`CostosRutaPropuesta`) con `fuente`/`estimado`/`captura` por oferta | Test unitario del mapper oferta↔propuesta; la oferta conserva su fuente |
| **B2** | Backend: endpoint de cotización de ruta que devuelve ofertas, propuestas, hoteles y tramos, **sin escribir** en `viatico_tarifas` | Test de integración: el endpoint no muta el catálogo; la propuesta se puede rechazar sin efectos |
| **B3** | Captura/evidencia: persistencia de la captura y la URL de cada oferta cotizada, y su asociación a la oferta en la pantalla de propuesta | Test: la oferta guardada expone `fuente` + referencia de captura |
| **B4** | UI: superposición del estimado de catálogo vs la propuesta cotizada, con la etiqueta clara de "estimado (catálogo)" vs "cotizado (captura)" | Test de render: ambas cifras visibles y etiquetadas sin ambigüedad |
| **B5** | Regla de no-escritura: ninguna acción de cotizar actualiza `viatico_tarifas`; la carga al catálogo sigue el flujo administrativo de F2/F3 del ADR-0003 | Test: cotizar un vuelo/hotel deja `viatico_tarifas` intacto |

> B5 es la fase que blinda la reconciliación: es la que garantiza que la capa de búsqueda nunca se convierta en dependencia del cálculo.

## Modelo de datos

Esta capa **no introduce tablas nuevas** para el cálculo; se apoya en el catálogo del ADR-0003 (`viatico_tarifas`) y agrega, como máximo, el registro de evidencia de la oferta cotizada.

### Contrato de la capa de búsqueda/cotización (frontend, yatipado)

```ts
// Oferta individual (vuelo/autobus/hotel) obtenida de búsqueda externa.
interface CostoOferta {
  id: string;
  modo: string;            // bus | avion | auto | hotel
  linea: string;           // linea / ruta / hotel
  servicio: string;
  persona: string;
  tramo: number | null;    // null si no aplica a un tramo
  de: string | null;
  a: string | null;
  precioTxt: string;       // precio como texto de la fuente
  porPersona: boolean;
  costoGrupo: number;
  costoPorPersona: number;
  aTiempo: boolean;        // ¿llega a tiempo segun el horario del viaje?
  noTomable: boolean;      // choca con horario / reglas: no se puede tomar
  fuente: string;          // de donde vino el precio (sitio/app)
  estimado: boolean;       // true = aproximacion de la fuente, no precio firme
  comprar: {               // la "accion de compra" asociada a esta oferta
    url: string;
    sitio: string;
    accion: string;        // como comprar (link, correo, etc.)
    objetivo: string;      // a quien/leer para comprarla
    fecha: string;
  };
}

// Hotel propuesto por tramo.
interface CostoHotel {
  lugar: string;
  ciudad: string;
  checkIn: string;
  checkOut: string;
  noches: number;
  habitaciones: number;
  motivo: string;
  fuente: string;
  link: string;
}

// Propuesta completa por persona (draft→select).
interface CostoPropuesta {
  persona: string;
  clave: string;
  titulo: string;
  cumpleTodos: boolean;      // respeta todas las restricciones del viaje
  salidaOrigen: string;
  llegadaFinal: string;
  margenMinimoMinutos: number;
  costoTotalMxn: number;
  tramos: CostoTramo[];      // desglose por tramo, con el costo ya incluido
  hotelesPropuestos: CostoHotel[];
  incumplimientos: string[];  // por que no cumple (si no cumpleTodos)
  fuentes: string[];           // auditoria: de donde salio cada numero
}
```

### Relación con el catálogo y con el estimado

- El **estimado de referencia** lo produce el motor del ADR-0003 leyendo `educacion_medica.viatico_tarifas`. No lo altera esta capa.
- La **propuesta cotizada** se calcula aparte con los precios reales de las ofertas. El desglose por categoría de una propuesta (`autobus`, `avion`, `hospedaje`, `comida`, `taxi`) es comparable con el concentrado del formato, pero es un **cotizado de referencia de la planeación**, no el estimado oficial.
- Los precios de la propuesta se persisten **con su evidencia** (`fuente`, `captura`/URL, `estimado`) para auditoría, pero en una estructura separada del catálogo. El catálogo (`viatico_tarifas`) sigue siendo el dueño de los precios oficiales.

### Evidencia de la oferta (nuevo, mínimo)

Para poder auditar un importe cotizado se guarda, por oferta adoptada o seleccionada:

| Campo | Qué guarda | Por qué |
|---|---|---|
| `oferta_id` | Identificador de la oferta | Trazabilidad |
| `fuente` | Sitio/app de origen | De dónde vino el precio |
| `url` | Link de la oferta | Reproducir la cotización |
| `captura_url` | Referencia a la imagen/PDF de la oferta | Evidencia auditable del precio en el momento |
| `precio_txt` | Precio como lo mostró la fuente | Preserva el texto original (con IVA/moneda) |
| `estimado` | Bandera precio-firme vs aproximación | Distinguir precio cerrado vs estimado |
| `fecha_captura` | Cuándo se capturó | Los precios cambian; la evidencia es fechada |

> Esta evidencia vive **al lado** de la cotización, no dentro de `viatico_tarifas`. Alimentar el catálogo con un precio real sigue siendo el acto administrativo explícito del ADR-0003 (F2/F3), no un efecto de cotizar.

## Endpoints y pantallas

### Backend

| Endpoint | Descripción | Regla |
|---|---|---|
| `POST /api/viaticos/costos-ruta/calcular` | Calcula la propuesta de ruta por persona: ofertas por tramo, hoteles y totales, con su `fuente`/`estimado`/`captura` | **No escribe** en `viatico_tarifas`. Recurso de lectura/cálculo puro |
| `POST /api/viaticos/costos-ruta/capturas` | Registra/asocia la captura (URL/imagen) de una oferta para su evidencia | Escribe solo evidencia de cotización, **nunca** el catálogo |
| `GET /api/viaticos/costos-ruta/{id}/propuesta` | ReLee una propuesta guardada con su evidencia | Solo lectura |

> **Invariante dura de API:** ningún endpoint de esta capa crea/actualiza filas de `educacion_medica.viatico_tarifas`. Esa escritura sigue siendo exclusivamente de los endpoints CRUD del catálogo del ADR-0003 (`POST/PUT/DELETE /api/viaticos/tarifas`), que son de administración.

### Frontend

1. **Cotizador de ruta con evidencia** (`/viaticos/costos-ruta`): el flujo existente de planeación, ahora etiquetando cada oferta con su `fuente` y `estimado`, y permitiendo adjuntar/ver la **captura** de la oferta seleccionada.
2. **Superposición estimado vs cotizado**: en la vista de propuesta se muestra el **estimado del catálogo** (autorizable) y, aparte, el **cotizado real** (con captura). Ambos etiquetados sin ambigüedad para que nadie confunda uno con otro.
3. **Catálogo de tarifas (del ADR-0003)** (`/viaticos/tarifas`): **sin cambios**; sigue siendo la pantalla que mantiene los precios oficiales. La capa de búsqueda no la toca.

## Permisos

> **Pendiente por decisión del usuario — matriz "quién ve qué".** Por ahora esta capa se despliega **solo para superadmin**; el usuario pospuso explícitamente definir la jerarquía de roles (quién cotiza, quién aprueba, quién ve capturas/precios reales) y este ADR **no la inventa**. Cuando el usuario la defina, esta sección se completa y se añade un ADR de permisos si hace falta.

| Permiso (provisional) | Acción | Roles (provisional) |
|---|---|---|
| `educacion_medica.viaticos_costos_ruta.puede_cotizar` | Generar propuesta cotizada y guardar capturas | **Solo superadmin (provisional)** |
| `educacion_medica.viaticos_costos_ruta.puede_ver_capturas` | Ver evidencia/capturas de precios reales | **Solo superadmin (provisional)** |

Los permisos del **catálogo** (`educacion_medica.viaticos_tarifas.puede_ver` / `.puede_editar`) los define el ADR-0003 y no cambian.

## Consecuencias

### Positivas

- **El estimado oficial no se contamina**: el cálculo sigue siendo determinista y auditable contra el catálogo (beneficio central del ADR-0003 preservado).
- **Planeación con precios reales sin perder el control**: quien planeja la ruta ve lo que costaría de verdad (vuelo/hotel), pero la cifra autorizable sigue viniendo del catálogo.
- **Auditoría de lo cotizado**: cada precio real guardado tiene `fuente`, `url`, `captura` y fecha, así que un importe cotizado puede justificarse después (cierra parcialmente el hueco "valores de referencia, no precios reales" del ADR-0003 para la parte que sí se cotizó).
- **Alineado al concentrado real**: el desglose por categoría (`autobus`, `avion`, `hospedaje`, `comida`, `taxi`) coincide con el formato ASK-ADM-FOR-008 que la empresa ya usa, y con las columnas del fixture de octubre 2026.

### Negativas

- **Dos capas que comparar**: el usuario ve estimado y cotizado; si el etiquetado no es claro puede confundir cuál manda (por eso B4 exige etiquetas explícitas).
- **Mantenimiento de un contrato de oferta aparte**: el tipo `CostoOferta`/`CostoPropuesta` es una estructura nueva que puede divergir del catálogo si no se documenta la frontera.
- **Dependencia de fuentes externas para la *propuesta* (no para el cálculo)**: si Google/Vuelos/Hoteles cambian sus respuestas, la propuesta se degrada — pero el estimado oficial sigue intacto, que es el propósito.
- **Matriz de roles sin definir**: dejando el acceso en solo superadmin, cuando se abra a más roles habrá que definir la jerarquía (hoy es un single-role gate, no una política real).

### Neutras

- **El ADR-0003 no se reescribe**: su texto sigue siendo válido; este ADR solo lo precisa en la frontera búsqueda↔cálculo y añade la capa de evidencia.
- **El catálogo y su CRUD quedan exactamente como están**: la capa es aditiva.
- **La conciliación post-gasto (CFDI/transacciones, tipo Clara) sigue fuera de alcance**, igual que en el ADR-0003; esta capa es de pre-gasto (cotizar antes de viajar).
- **El fixture de octubre 2026** (`viaticos/test/fixtures/octubre2026.ts`) congela los importes históricos como datos de regresión para que las nuevas capas no los muevan sin evidencia.

## Anexo — Fuentes

Citas textuales de fuentes usadas en esta decisión:

- `decisiones/00003_estimador-viaticos-catalogo.md`, §Status — *"Proposed"*.
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Decisión — *"Las APIs gratuitas y las consultas manuales a sitios oficiales (CAPUFE, aerolíneas, autobuses) se usarán **únicamente para poblar o actualizar el catálogo**, nunca como dependencia en tiempo de ejecución."*
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Decisión — *"El sistema calculará cotizaciones **solo leyendo el catálogo**."*
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Consecuencias/Negativas — *"Valores de referencia, no precios reales: el presupuesto puede diferir del gasto final, especialmente en vuelos y hospedaje."*
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Consecuencias/Negativas — *"Carga operativa: el área debe mantener actualizadas las tarifas (CAPUFE cambia trimestralmente; hoteles, autobuses y vuelos varían más)."*
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Decisión — *"Esta decisión separa claramente la **cotización** (presupuesto aprobable) de la **comprobación del gasto real**, que queda fuera de este ADR."*
- `decisiones/00003_estimador-viaticos-catalogo.md`, §Modelo de datos — categorías del catálogo: *"GasolinaKm | Caseta | Taxi | Hospedaje | Alimentos | BusRuta | VueloRuta"* (nota: esta decisión usa las categorías de cálculo; la capa de búsqueda expone sus propias categorías `autobus/avion/hospedaje/comida/taxi` alineadas al formato FOR-008).
- `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` — Capturado: *"Nombre: DANIEL PADILLA | Gerencia: EDUCACION MEDICA | Fecha: 2026-09-01"* (concentrado de 20 viajes).
- `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` — Columnas del formato: *"No. | Solicitante | Fecha | Origen | Destino | Transporte (Costo boleto Autobús / Costo boleto Avión) | Automovil propio (Gasolina / Casetas) | Hospedaje | Comida | Taxi | Total"*.
- `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` — Renglón Total: *"$16,481.00 | $137,630.00 | $- | $- | $52,896.00 | $25,100.00 | $44,250.00 | $276,357.00"* (autobús, avión, gasolina, casetas, hospedaje, comida, taxi, total).
- `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` — Pies de firma: *"REVISÓ | Coordinador Administrative | Gerente General | Gerente de Administración y Finanzas; AUTORIZÓ | Dirección Corporativa"* (la evidencia de la cotización va a la cadena de aprobación del concentrado).
- `decisiones/00004_reparto-y-planificacion-rutas.md`, §Status — *"Accepted"* (la capa de planeación de rutas sobre la que se apoya esta cotización de contexto).
- `decisiones/00001_esquema-datos-educacion-medica.md`, §Decisión — *"Proceso Ventas IMSS (`ASK-VEN-DDP-001`): requiere su propia decisión (ADR 00002)"* (patrón de separar decisiones; esta es la 00007).