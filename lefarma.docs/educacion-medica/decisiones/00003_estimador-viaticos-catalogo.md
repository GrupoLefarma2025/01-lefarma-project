---
fecha_creacion: 2026-08-26 12:00
fecha_modificacion: 2026-08-26 12:00
resumen: ADR para el estimador de viáticos foráneos del módulo Educación Médica. Se decide usar un catálogo interno configurable como única fuente de precios en runtime; las APIs gratuitas y las consultas web solo se usarán para alimentar el catálogo inicial o para actualizaciones puntuales, nunca como dependencia del cálculo cotidiano.
---

# ADR-00003 — Estimador de viáticos foráneos por catálogo configurable

## Status

Proposed

## Índice

1. Decisión
2. Contexto
3. Fases
4. Modelo de datos
5. Endpoints y pantallas
6. Permisos
7. Consecuencias
8. Anexo — Fuentes

## Decisión

Se implementará un **estimador de viáticos para talleres foráneos** basado en un **catálogo interno de tarifas configurable** (`educacion_medica.viatico_tarifas`).

- El sistema calculará cotizaciones **solo leyendo el catálogo**.
- Las APIs gratuitas (Google Routes, OpenRouteService, TollGuru, Amadeus test, etc.) y las consultas manuales a sitios oficiales (CAPUFE, aerolíneas, autobuses) se usarán **únicamente para poblar o actualizar el catálogo**, nunca como dependencia en tiempo de ejecución.
- El modo de transporte de cada viaje es una variable (carro | autobús | avión), no un supuesto fijo. Según el modo se aplican las tarifas correspondientes del catálogo.
- Los valores iniciales se cargarán como **seed referencial**; el área administrativa los ajustará a través de una pantalla de mantenimiento.

Esta decisión separa claramente la **cotización** (presupuesto aprobable) de la **comprobación del gasto real**, que queda fuera de este ADR.

## Contexto

El proceso **Talleres Médicos en Hospitales** (`ASK-CEM-DDP-001`) incluye viajes foráneos cuyos viáticos se solicitan conforme al instructivo **ASK-GGE-IDT-001** *"Solicitud y aprobación de viáticos"*. El documento referenciado **no fue incluido** en el set digitalizado:

> Fuente: `referencias/pdf-to-md/Referencias/ASK-GGE-IDT-001 Solicitud y aprobación de viáticos.md` — *"Documento referenciado... no fue incluido en el set de documentos digitalizados de este vault."*

Sí se conserva el formato **ASK-ADM-FOR-001 "Solicitud de Viáticos"** como Anexo 3 del instructivo de Ventas:

> Fuente: `referencias/pdf-to-md/Instructivos/Elaborar Plan de Trabajo.md` — sección *"Sección: Llenado por el administrador"*: *"Transporte Tipo | Transporte Importe | Alimentos Tipo | Alimentos Importe | Hospedaje | Gasolina | Casetas | Taxis | Avion"*.

El ADR 00001 definió que viáticos y su instructivo propio quedaban **fuera del alcance** del módulo Educación Médica y requerían una decisión aparte:

> Fuente: `decisiones/00001_esquema-datos-educacion-medica.md` §3.1 — *"Proceso Ventas IMSS (`ASK-VEN-DDP-001`): requiere su propia decisión (ADR 00002)"*; implícitamente el mismo criterio aplica a `ASK-GGE-IDT-001` por estar fuera del dominio CEM.

Además, se descartan dos alternativas evaluadas:

1. **Clara API**: es gestión de gasto corporativo (tarjetas, transacciones, CFDI), no cotización. Requiere ser cliente y certificados mTLS.
2. **Scraping en runtime** de ADO, Primera Plus, Uber, Booking, etc.: frágil, viola términos de uso y genera mantenimiento continuo. Google eliminó su crédito fijo de $200 USD/mes en marzo de 2025 y reemplazó el modelo por cupos gratuitos por SKU; el endpoint público de estimación de precios de Uber requiere aprobación comercial y no está disponible para nuevos desarrolladores.

Por tanto, el diseño se basa en catálogos propios con actualización manual o asistida, siguiendo el patrón de **parámetros configurables** ya establecido en `reglas-negocio.md` §7 y el patrón **draft → select** de §5.5.

## Fases

| Fase | Contenido | Verificación |
|---|---|---|
| F1 | Script SQL `viatico_tarifas` + seed referencial | Tabla creada en `educacion_medica`; seed consultable |
| F2 | Backend: API CRUD de tarifas | Tests de integración verifican GET/POST/PUT/DELETE y unicidad `(categoria, clave)` |
| F3 | Frontend: pantalla "Catálogo de tarifas de viáticos" | Filtro por categoría, edición de precio y guardado con permisos |
| F4 | Backend: tablas `viajes_solicitud` y `viajes_estimaciones` + servicio estimador | Test unitario por cada modo de transporte (carro/autobús/avión) |
| F5 | Integración del estimador al flujo de solicitud de viáticos y aprobaciones | Flujo end-to-end manual en ambiente de desarrollo |

Las fases F1-F3 desbloquean valor inmediato: el área puede mantener el catálogo sin depender de desarrolladores. F4-F5 dependen de levantar el detalle operativo de `ASK-GGE-IDT-001` con el área.

## Modelo de datos

### Tabla principal (catálogo)

```sql
CREATE TABLE educacion_medica.viatico_tarifas (
    id_viatico_tarifa          INT PRIMARY KEY IDENTITY(1,1),
    categoria                  VARCHAR(30) NOT NULL, -- GasolinaKm | Caseta | Taxi | Hospedaje | Alimentos | BusRuta | VueloRuta
    clave                      VARCHAR(120) NOT NULL, -- ciudad, corredor, concepto
    descripcion                NVARCHAR(255) NULL,
    precio                     DECIMAL(18,2) NOT NULL,
    unidad                     VARCHAR(20) NOT NULL, -- km | viaje | noche | dia | corredor
    nota_fuente                NVARCHAR(500) NULL,   -- ej. "CAPUFE tarifa Q2-2026", "Amadeus test 2026-08-26"
    activo                     BIT NOT NULL DEFAULT 1,
    fecha_creacion_modificacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    id_usuario_creacion        INT NOT NULL,
    id_usuario_modificacion    INT NOT NULL,
    CONSTRAINT uq_viatico_tarifas_categoria_clave UNIQUE (categoria, clave)
);
```

**Decisiones del modelo:**

- Tabla madre con columnas de auditoría (`activo`, `fecha_creacion_modificacion`, `id_usuario_*`). Los hijos (`viajes_estimaciones`) se borrarán físicamente, siguiendo la regla de base de datos del proyecto.
- Una sola tabla polimórfica con `categoria` en vez de una tabla por rubro; coincide con el patrón usado en `taller_recursos` (ADR 00001 §1.2.7).
- La clave representa el concepto geográfico o de corredor; para hospitales sin corredor específico se usa el factor default configurable (`GasolinaKm`, etc.).

### Tablas futuras (F4)

```sql
educacion_medica.viajes_solicitud      -- agrupa talleres foráneos de una salida
educacion_medica.viajes_estimaciones   -- desglose por categoría, espejo de ASK-ADM-FOR-001 admin
```

### Cálculo del estimado

| Modo | Fórmula | Tarifa usada |
|---|---|---|
| Carro | `km × GasolinaKm + Casetas(corredor)` | `GasolinaKm`, `Caseta` |
| Autobús | `BusRuta(corredor)` | `BusRuta` |
| Avión | `VueloRuta(corredor)` *(referencia)* | `VueloRuta` |
| Siempre | `noches × Hospedaje(ciudad) + días × Alimentos + traslados × Taxi(ciudad)` | `Hospedaje`, `Alimentos`, `Taxi` |

Para los kilómetros en modo carro se propone una primera versión usando las coordenadas GPS de `genContactosCat` (100% pobladas según `reglas-negocio.md` §6.1) con una fórmula de distancia recta más un **factor de circuito configurable** (default ~1.3); si existe un corredor cargado en el catálogo, ese valor overridea el cálculo automático.

## Endpoints y pantallas

### Backend

| Endpoint | Descripción | Regla |
|---|---|---|
| `GET /api/viaticos/tarifas?categoria=` | Listar tarifas, filtrable por categoría | Solo lectura para roles CA, GG, DC |
| `POST /api/viaticos/tarifas` | Crear tarifa | Solo CA/Admin |
| `PUT /api/viaticos/tarifas/{id}` | Actualizar tarifa | Solo CA/Admin |
| `DELETE /api/viaticos/tarifas/{id}` | Desactivar (`activo = 0`) | Solo CA/Admin |
| `POST /api/viaticos/estimaciones` (F4) | Calcular estimado de un viaje | AEM/EV de lectura; editable antes de firmar |

### Frontend

1. **Catálogo de tarifas de viáticos** (`/viaticos/tarifas`): tabla agrupada por `categoria`, con edición inline o modal. Botón para duplicar una tarifa al cambiar vigencia.
2. **Solicitud de viáticos con estimador** (F5): pantalla futura que arma el viaje, elige modo de transporte y muestra el desglose editable antes de enviar a aprobaciones.

## Permisos

Patrón del repo: constantes en backend + `usePermission`/`PermissionGuard` en frontend.

| Permiso | Acción | Roles |
|---|---|---|
| `educacion_medica.viaticos_tarifas.puede_ver` | Ver catálogo | CA, GG, DC, AEM, GV |
| `educacion_medica.viaticos_tarifas.puede_editar` | Crear/modificar/desactivar tarifas | CA |
| `educacion_medica.viaticos.puede_cotizar` (F4) | Generar estimado | AEM, EV |
| `educacion_medica.viaticos.puede_aprobar` (F5) | Firmar solicitud | GV, CA, GG, DC |

## Consecuencias

### Positivas

- **Cero dependencias externas en runtime**: el estimador no se rompe si Google, Uber, Amadeus o CAPUFE cambian sus términos o precios.
- **Auditable y determinista**: cada cotización explica qué tarifa del catálogo usó y quién la actualizó.
- **Alineado con el formato ASK-ADM-FOR-001**: el desglose por categorías (gasolina, casetas, taxis, hospedaje, alimentos, avión) coincide con el formato físico que ya usa la empresa.
- **Rápido de implementar**: F1-F3 son un CRUD sobre una tabla maestra; no requiere integraciones ni certificados.

### Negativas

- **Carga operativa**: el área debe mantener actualizadas las tarifas (CAPUFE cambia trimestralmente; hoteles, autobuses y vuelos varían más).
- **Valores de referencia, no precios reales**: el presupuesto puede diferir del gasto final, especialmente en vuelos y hospedaje.
- **Data inicial desconocida**: la política vigente de viáticos no está documentada en las fuentes; se requiere entrevista con CA/AEM o carga manual desde un Excel/fuentes web.

### Neutras

- Las APIs gratuitas siguen disponibles como **herramienta de carga inicial**; no desaparecen del plan, solo se mueven fuera del flujo cotidiano.
- Una futura integración con Clara (o similar) seguiría siendo viable, pero para **conciliación post-gasto** (CFDI/transacciones), no para estimación.

## Anexo — Fuentes

- `referencias/pdf-to-md/Instructivos/Elaborar Plan de Trabajo.md`, Anexo 3 — *"Sección: Llenado por el administrador ... Transporte Tipo | Transporte Importe | Alimentos Tipo | Alimentos Importe | Hospedaje | Gasolina | Casetas | Taxis | Avion"*.
- `referencias/pdf-to-md/Referencias/ASK-GGE-IDT-001 Solicitud y aprobación de viáticos.md` — *"Documento referenciado... no fue incluido en el set de documentos digitalizados de este vault."*
- `reglas-negocio.md` §5.5 — patrón *"El sistema propone una distribución draft (optimizada)... Los humanos seleccionan/corrigen"*.
- `reglas-negocio.md` §7 — parámetros configurables (`~128 sesiones/mes`, `máx visitas/día`, `máx visitas/semana`).
- `decisiones/00001_esquema-datos-educacion-medica.md` — viáticos fuera de alcance; se requiere ADR propio.
- Google Maps Platform billing changes (marzo 2025): cupos gratuitos por SKU reemplazan al crédito fijo de $200 USD/mes.
- Uber Developers: endpoint `/v1.2/estimates/price` requiere aprobación comercial y no está disponible para nuevos desarrolladores sin contacto de Business Development.
