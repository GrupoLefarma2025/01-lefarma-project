---
fecha_creacion: 2026-08-10 13:54
fecha_modificacion: 2026-08-10 13:54
resumen: Planificación del módulo Educación Médica (proceso Talleres Médicos en Hospitales): schema de base de datos, backend y frontend.
---

# 00001 — Esquema de datos del módulo Educación Médica

## Índice

- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
- [[#Fase 0 — Planificación|Fase 0 — Planificación]]
- [[#Fase 1 — Base de datos|Fase 1 — Base de datos]]
  - [[#1.1 Schema educacion_medica (script 0002)|1.1 Schema]]
  - [[#1.2 Catálogo + 11 tablas operacionales (script 0003) — el porqué de cada columna|1.2 Catálogo + 11 tablas operacionales]]
  - [[#1.3 Documentación en la base (MS_Description)|1.3 Documentación en la base]]
  - [[#1.4 Reglas de diseño — cada regla con su solución|1.4 Reglas de diseño]]
- [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#2.1 Catálogo de endpoints — cada endpoint y por qué existe|2.1 Endpoints]]
  - [[#2.2 Catálogos (Slice 1)|2.2 Catálogos]]
  - [[#2.3 Taller completo (Slice 2, proceso core)|2.3 Taller completo]]
- [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#3.1 Catálogo de pantallas — cada pantalla, su origen y quién la usa|3.1 Pantallas]]
  - [[#3.2 Permisos — cada permiso y por qué existe|3.2 Permisos]]
- [[#Anexo — Archivos originales|Anexo — Archivos originales]]
- [[#Referencias técnicas|Referencias técnicas]]

## Decisión

El módulo Educación Médica **no tenía nada en la base de datos**, por lo que esta decisión crea el schema `educacion_medica` en Lefarma y planifica, por fases, todo lo necesario para ponerlo en marcha: **base de datos → backend → frontend**.

- **Documentos fuente** (formularios e instructivos): `referencias/pdf-to-md/`.
- **Scripts de base de datos** (schema, tablas, índices): `lefarma.database/educacion-medica/`.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Propuesta, formularios extraídos, decisiones de diseño | Documento aprobado + ADR creado |
| **1** | Base de datos | Schema (0002), tablas operacionales + MS_Description (0003), índices | Scripts aplicados en dev/prod, columnas y descripciones visibles en SSMS |
| **2** | Backend | Catálogos (Slice 1) y Taller completo (Slice 2) | API funcionando, validación cross-DB, taller end-to-end |
| **3** | Frontend | Pantallas catálogos y pantallas del taller | Flujo completo de usuario desde la SPA |

---

## Fase 0 — Planificación

> Tareas: [[tareas/00001_esquema-datos-educacion-medica#Fase 0 — Planificación]]

**Qué es:** convertir los procesos de negocio (`ASK-CEM-DDP-001` Talleres Médicos, `ASK-VEN-DDP-001` Ventas IMSS) y sus formularios en un modelo de datos.

**Decisiones tomadas y por qué:**

1. **Schema propio `educacion_medica` en Lefarma, no en Asokam.**
   *Por qué:* el módulo no tenía nada en BD; los catálogos ya viven en Asokam y son de otra app. Un schema propio aísla el módulo y no arriesga a las demás apps. Si Asokam migra, el módulo no se ve afectado.

2. **Catálogos de Asokam reutilizados por código (FK lógica), nunca duplicados.**
   *Por qué:* `genContactosCat` (4,856 hospitales) y `genProductosCat` (117) son la única fuente de verdad. Duplicarlos crearía dos verdades que se desincronizan.

3. **Cada tabla operacional traza a un formulario (FOR-002…008).**
   *Por qué:* el papel que reemplaza define las columnas. Si el formulario cambia, sabemos exactamente qué tabla tocar.

4. **1 catálogo + 11 tablas, no más.**
   *Por qué:* cubren el ciclo completo del taller (programa anual → selección mensual → matriz → materiales → asistencia → aprobaciones → evidencias). Ventas IMSS (Slice 3) no tiene tablas aún: requiere su propia decisión (00002).

---

## Fase 1 — Base de datos

> Tareas: [[tareas/00001_esquema-datos-educacion-medica#Fase 1 — Base de datos]]

### 1.1 Schema `educacion_medica` (script 0002)

**Decisión:** schema nuevo en Lefarma DB. **Por qué:** nada del módulo existía; el schema aísla el diseño y los permisos.

### 1.2 Catálogo + 11 tablas operacionales (script 0003) — el porqué de cada columna

Cada tabla traza a un formulario; la columna "Origen" cita el campo del formulario. Las columnas de auditoría (`id_*`, `fecha_creacion/modificacion`, `id_usuario_*`) son convención del repo y no se repiten aquí; `activo` (baja lógica) solo va en las **tablas madre** (agregados) — las hijas se borran físicamente (ver §1.4).

> **Cómo leer las citas:** cada celda indica el **archivo fuente** (nombre completo en `referencias/pdf-to-md/`, ej. `ASK-CEM-FOR-002 Base de Datos de Hospitales.md`); el texto entre comillas es **literal** de ese archivo.

#### 1.2.0 Catálogo `tipo_gerencia` — ¿qué es la gerencia y por qué un catálogo?

**¿Qué es `tipo_gerencia`?** Los documentos dividen la operación de ventas en **equipos de venta distintos**: la *Gerencia de Ventas IMSS* (ataca las unidades médicas del IMSS) y la *Gerencia de Ventas Descentralizados* (Secretarías de Salud, instituciones descentralizadas, institutos y distribuidores). Cada gerencia tiene **metas, ejecutivos y reportes separados**:
- IDT-003: *"Se deben programar al menos 64 talleres en el mes en IMSS y la misma cantidad en Descentralizados"*.
- FOR-003: *"Gerencia: escribir si es de gerencia IMSS o descentralizados"* y separa `especialistas_disponibles_imss` / `especialistas_disponibles_descentralizados`.
- ASK-VEN-FOR-001 (metas): además de IMSS y Descentralizados existe **Privado** (*"Gerencia Privado"*).

**¿Por qué catálogo y no un VARCHAR?** (a) es un conjunto cerrado y pequeño de valores del negocio; (b) la misma gerencia se usa en 3 tablas (`hospital_extension`, `programas_anuales`, `selecciones_mensuales`) y un catálogo garantiza el mismo texto en todas; (c) es extensible si aparece otra gerencia.

**Validación contra Asokam (2026-08-10):** se consultó `genContactosCat` (4,856 hospitales) — **NO existe ningún campo de gerencia** en la tabla. Por eso el catálogo es propio del módulo y se crea **antes** que `hospital_extension` (que le hace **FK física**, misma BD).

| Columna | Qué guarda | Porqué |
|---|---|---|
| `id_tipo_gerencia` | PK del catálogo | FK física desde las tablas que usan gerencia |
| `descripcion` | `IMSS` · `Descentralizado` · `Privado` | Valores documentados (FOR-002/003/005 y VEN-FOR-001); UNIQUE, extensible |

Semilla del catálogo (script 0003): `IMSS`, `Descentralizado`, `Privado`.

#### 1.2.1 `hospital_extension` — FOR-002 (Base de Datos de Hospitales)

**Porqué existe:** el hospital YA existe en `genContactosCat` (Asokam). Esta tabla **extiende** 1:1 ese catálogo con lo que el módulo calcula: las anestesias. El papel pide subtotales por columna; si alguien los captura a mano, se equivoca — por eso las columnas son `PERSISTED` (la BD calcula y guarda, cero error manual).

| Columna | Qué guarda | Porqué / fórmula (fuente: `ASK-CEM-FOR-002 Base de Datos de Hospitales.md` en `referencias/pdf-to-md/Formularios/`) |
|---|---|---|
| `id_hospital` | Código del hospital en Asokam | FK lógica → `genContactosCat.codigoContacto` (UNIQUE 1:1). No se duplica el hospital, solo se extiende. Se llama `id_` porque referencia a la tabla `hospitales` de Asokam, no porque sea un id propio |
| `fecha` | Fecha de la base | Encabezado FOR-002, campo **"Año"**: *"escribir el año al que corresponde la base de datos"* (*"la fecha del año al cual corresponde la base de datos"*). Guardamos `DATE` para capturar el año y poder filtrar |
| `id_tipo_gerencia` | Gerencia del hospital | FK física → catálogo `tipo_gerencia` (§1.2.0). El hospital pertenece a un equipo de ventas (IMSS/Descentralizado) y eso define a qué gerencia se reporta. Encabezado FOR-002: *"indicar el tipo de gerencia: IMSS o Descentralizado"*  |
| `con_sia` | `1` con SIA, `0` sin SIA | **SIA = Servicio Integral de Anestesia** (glosario: [[referencias/pdf-to-md/Roles/Roles y Abreviaturas]]). Es si el hospital **cuenta con ese servicio** (donde los talleres de anestesia tienen mercado). El concentrado anual clasifica: *"SIA (se visitarán) / sin SIA (venta directa)"*. Encabezado FOR-002: *"Con SIA: marcar si se trata de hospitales con SIA"* . **No existe en Asokam** — es dato del módulo |
| `numero_quirofanos` | N° de quirófanos | **Única captura manual** : dato físico del hospital, no se puede derivar |
| `anestesias_totales` | AT | **AT = NQ × 2.5 × 250** . Los factores son supuestos del negocio: **2.5 = cirugías promedio por día**, **250 = días laborables al año** |
| `anestesias_generales` | AG | **AG = AT × 30%**  |
| `anestesias_regionales` | AR | **AR = AT × 70%** . Nota: AG + AR = 100% del total |
| `anestesias_epidurales` | AE | **AE = AR × 35%**  |
| `anestesias_subdurales` | AS | **AS = AR × 45%**  |
| `anestesias_mixtas_obesos` | MO | **MO = AR × 2%**  |
| `anestesias_mixtas_no_obesos` | MNO | **MNO = AR × 18%** . Nota: AE + AS + MO + MNO = 100% de las regionales |

> **Para qué se usan estos cálculos:** estimar el tamaño del mercado de anestesia de cada hospital (cuántas cirugías/anestesias al año) y así priorizar dónde conviene dar talleres. El formulario no explica el origen de los porcentajes; son la distribución de tipos de anestesia que el negocio asume como fija.

#### 1.2.2 `programas_anuales` — FOR-003 (Programa Anual de Talleres)

**Porqué existe:** planificar el año: qué producto se promociona, en qué periodo, en qué hospitales y con qué meta.

| Columna | Qué guarda | Porqué / fórmula (fuente: `ASK-CEM-FOR-003 Programa Anual de Talleres Médicos.md` en `referencias/pdf-to-md/Formularios/`) |
|---|---|---|
| `fecha` | Fecha del programa | El programa es anual (*"escribir el año correspondiente al programa"*); `DATE` para capturar el año |
| `definicion` | Objetivo del programa | La fila "Definición" del formato  |
| `periodo_inicio` / `periodo_fin` | Meses 1–12 (CHECK) | El formato permite promocionar por periodos (renglones 3–4); los meses son TINYINT porque solo hay 12 |
| `id_tipo_gerencia` | Gerencia del programa | FK física → catálogo `tipo_gerencia` : un programa pertenece a un equipo de ventas |
| `tipo_hospital` | `Con SIA` / `Sin SIA` | Los hospitales objetivo se clasifican por SIA |
| `numero_hospitales` | N° de hospitales objetivo al año | Cuántos se visitarán en el año |
| `meta_al_anio` | Meta anual | **Meta = N° hospitales × 1.5** : el negocio asume **1.5 talleres por hospital al año** |
| `productos_a_promocionar` | CSV de claves | Las 6 líneas de producto Asokam marcadas con "x" : R-III, R-II, R-I, B-27G, B-22G, T |
| `semanas_trabajo` | Semanas laboradas | Resumen de capacidad, dato capturado  |
| `talleres_semana` | Talleres por semana | **= Total / Semanas de trabajo** , calculado en servicio |
| `talleres_especialista` | Talleres/especialista/semana | Dato capturado  |
| `especialistas_necesarios` | Especialistas requeridos | **= Talleres/semana ÷ Talleres/especialista** (el papel tiene error tipográfico en la fórmula, esta es la correcta) |
| `especialistas_disponibles_imss` / `_descentralizados` | Disponibles por gerencia | Dato capturado por gerencia |
| `especialistas_a_contratar` | Déficit de capacidad | Si necesarios > disponibles |

#### 1.2.3 `programas_anuales_detalles` — FOR-003 (tabla principal)

**Porqué existe:** un programa cubre **muchos hospitales × muchos productos** (N:M). `UNIQUE (id_programa, codigo_hospital, codigo_producto)` evita filas duplicadas del formato. `ON DELETE CASCADE`: es hija, se borra con el programa (regla: sin soft-delete en hijas).

| Columna | Qué guarda | Porqué |
|---|---|---|
| `id_hospital` | Hospital incluido | FK lógica → `genContactosCat.codigoContacto` (validada en servicio) |
| `id_producto` | Producto a promocionar | FK lógica → `genProductosCat.codigoProducto` (validada en servicio) |

#### 1.2.4 `selecciones_mensuales` — FOR-004 (Anexo 1 del IDT-003)

**Porqué existe:** la reunión del **día 15** de cada mes donde GG/GV eligen los hospitales a visitar. El formato FOR-004 no tiene PDF propio; fue digitalizado desde el **Anexo 1 del instructivo IDT-003** → [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos]]. El instructivo define reglas que la tabla guarda:

| Columna | Qué guarda | Porqué / regla |
|---|---|---|
| `fecha_seleccion` | Fecha de la reunión | Día 15 del mes (regla del proceso) |
| `tipo_gerencia` | `IMSS` / `Descentralizado` | Una selección por gerencia |
| `fecha_inicio_vigencia` / `fecha_fin_vigencia` | Ventana de 45 días | Los hospitales elegidos se visitan **en los próximos 45 días calendario** (instructivo) |
| `talleres_objetivo_mes` | Meta del mes | **≥ 64 talleres/mes por gerencia** (regla documentada) |

#### 1.2.5 `selecciones_mensuales_hospitales` — FOR-004 (listado, Anexo 1 del IDT-003)

**Porqué existe:** N:M selección × hospital. Las columnas geográficas están **denormalizadas** a propósito: la regla agrupa hospitales **por zona (mín. 4 hospitales/viaje)** y la consulta de agrupación no debe ir a Asokam cada vez.

| Columna | Qué guarda | Porqué |
|---|---|---|
| `id_hospital` | Hospital elegido | FK lógica → `genContactosCat.codigoContacto` |
| `region` / `entidad_federativa` / `ciudad_municipio` | Ubicación | La regla agrupa hospitales **por zona (mín. 4 hospitales/viaje)** y la consulta no debe ir a Asokam cada vez. **Validado en Asokam:** la región sale de `genContactosCat.zona` (CDMX NORTE, NORESTE, OCCIDENTE…); el estado se resuelve con `codigoEstado` → `genEstadosCat.nombreEstado`; el **municipio NO existe** en Asokam → se captura en el módulo |
| `id_ejecutivo` | A quién se asigna | FK lógica → `app.Usuarios` (EV) |
| `producto_a_promocionar` | Producto del mes | Lo que se promocionará en esas visitas |
| `observaciones` | Notas de la reunión | Prioridad / contexto de la selección |

#### 1.2.6 `talleres` — FOR-005 (Matriz) + FOR-006 (Calendario) + FOR-008 (encabezado)

**Porqué existe:** es el **aggregate root** del proceso: una fila por taller médico programado, con su logística y su ciclo de firmas. Los formularios que alimentan sus columnas:

| Columna | Qué guarda | Porqué / origen |
|---|---|---|
| `id_seleccion_hospital` | Origen | Trazabilidad: de qué selección mensual salió el taller |
| `id_hospital` + `region`/`entidad_federativa`/`ciudad_municipio` | Hospital y ubicación | Misma fuente validada que §1.2.5 (`zona`, `genEstadosCat`, municipio capturado) |
| `numero_participantes` | Asistentes estimados | FOR-005 #6 |
| `id_ejecutivo` | Coordinador | FK lógica → `app.Usuarios` (EV; FOR-005 #7) |
| `id_especialista` | Quién imparte | FK lógica → `app.Usuarios` (EP; FOR-008 encabezado) |
| `unidad_medica` / `lugar` | Dónde | FOR-008 encabezado |
| `fecha_taller` / `hora_taller` | Cuándo | FOR-005 #8–9, FOR-006 |
| `requiere_equipo_proyeccion` + `tipo_equipo_proyeccion` (`Propio`/`Rentado`) | Logística de proyección | FOR-005 #10–11 |
| `estado` | State machine | Ciclo de firmas del papel: **Borrador → Elaborado → Revisado → Autorizado → Programado → EnCurso → Realizado/Cancelado** (CHECK en BD + transiciones validadas en servicio) |
| `observaciones` | Notas | Campo libre del formato |

#### 1.2.7 `taller_recursos` — FOR-005 (columnas de recursos y costos)

**Porqué existe:** la Matriz tiene 4 grupos de recursos — **Muestras, Folletos, Gastos de envío, Box lunch** — y todos comparten la misma forma (cantidad × costo unitario). Una tabla **polimórfica** con `tipo_recurso` en vez de 4 tablas casi idénticas. El **Costo Total** del taller es la suma de los 4 (fuente: `ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — *"producto + folleto impreso + gastos de envío + box lunch"*).

| Columna | Qué guarda | Porqué |
|---|---|---|
| `tipo_recurso` | `Producto` / `Folleto` / `Envio` / `BoxLunch` | Discriminador polimórfico |
| `id_producto` | Producto (solo `Producto`) | FK lógica → `genProductosCat` (muestras) |
| `descripcion` | Texto libre | Proveedor / notas |
| `tipo_envio` | `Interno` / `Externo` | Solo `Envio` (FOR-005 #16) |
| `cantidad` | Piezas o servicios | FOR-005 #13–14, #18 |
| `costo_unitario` | $MXN | FOR-005 #15, #17, #19 |
| `subtotal` | cantidad × costo | Lo calcula el servicio (no computed: depende del detalle) |
| — | `talleres.costo_total` | SUM de subtotales en el servicio al mutar recursos (regla 1.4) |

#### 1.2.8 `taller_materiales` — FOR-007 (Anexo 2 del IDT-004)

**Porqué existe:** el formato donde el **Ejecutivo firma de recibido** el material del taller (producto, folletos, registro de asistencia, dulces, equipo). El FOR-007 no tiene PDF propio; fue digitalizado desde el **Anexo 2 del instructivo IDT-004** → [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos]].

> **Decisión declarada (no derivada):** en el papel, el formato es una **lista de hasta 8 renglones** (cada uno con su fecha/hospital). Decidimos **1 solicitud por taller** (`UNIQUE id_taller` fuerza 1:1) porque la unidad de trabajo real es el taller y simplifica el flujo de entrega; si algún día un taller requiere varios renglones de material, se quita el UNIQUE y se vuelve 1:N sin tocar el resto.

La coordinación de entrega (regla IDT-004: CDMX 4:30–6:30 p.m. / foránea por paquetería 7 días antes con carta porte) se valida en servicio.

| Columna | Qué guarda | Porqué |
|---|---|---|
| `fecha_entrega` | Fecha del formato | FOR-007 |
| `cargo_puesto` | Puesto de quien entrega | Firma de entrega |
| `nombre_producto` / `cantidad_producto` | Producto y cantidad | FOR-007 |
| `incluye_lista_asistencia` / `incluye_flayers` / `incluye_equipo_computo` / `incluye_proyector` / `incluye_dulces` / `incluye_modelo_anatomico` | Checklist de material | El formato pide marcar Sí/No cada ítem; 6 bits en vez de 6 tablas |
| `nombre_ejecutivo_recepcion` | Firma de recibido | FOR-007: confirma que el EV recibió el material |

#### 1.2.9 `taller_asistencias` — FOR-008 (Registro de Asistencia)

**Porqué existe:** la lista firmada de médicos que asistieron al taller. `numero` con CHECK 1–20 = el formulario tiene **exactamente 20 filas**. La observación del formato (médico líder +/−) vive en `observaciones`.

| Columna | Qué guarda | Porqué |
|---|---|---|
| `numero` | No. en lista | 1–20 (CHECK), límite del formato |
| `nombre_medico` | Médico | FOR-008 #9 |
| `cedula_profesional` | Cédula | **Adición del sistema** (el papel no la pide): identifica al médico líder para tecnovigilancia |
| `puesto_medico` | Puesto | FOR-008 #10 (ej. jefe de anestesiología) |
| `telefono_celular` / `correo_electronico` | Contacto | FOR-008 #11–12 |
| `firma_url` | Firma escaneada | FOR-008 #13: la firma en papel se fotografía/escanea; guardamos la URL |
| `observaciones` | Médico líder +/− | FOR-008 #13 (guía): registrar quién es líder positivo/negativo del producto |

#### 1.2.10 `taller_aprobaciones` — pie de firmas del proceso (no es formulario)

**Porqué existe:** todos los formularios del proceso cierran con **Elaboró / Revisó / Autorizó** (firma + puesto + fecha). En vez de sobrescribir el estado, cada firma es un **registro de log**: quién firmó, cuándo y en qué rol. La última firma autorizada mueve el `estado` del taller.

| Columna | Qué guarda | Porqué |
|---|---|---|
| `rol_firma` | `Elaboro` / `Reviso` / `Autorizo` | Los 3 roles del pie de firmas |
| `id_usuario` | Quién firma | FK lógica → `app.Usuarios` |
| `puesto` | Puesto declarado | FOR-005 pie de firmas (ej. Gerente de Ventas) |
| `estado` | `Pendiente` / `Aprobado` / `Rechazado` | El flujo permite rechazar con comentario |
| `comentario` | Motivo | Por qué se aprobó/rechazó |
| `fecha_firma` | Cuándo | NULL mientras `Pendiente` |

#### 1.2.11 `taller_evidencias` — proceso (no es formulario)

**Porqué existe:** foto/video/documento de que el taller se impartió. Lo necesitan auditoría y los roles de post-venta (**Control de Quejas / Tecnovigilancia**) cuando hay un incidente con un dispositivo mostrado en taller.

| Columna | Qué guarda | Porqué |
|---|---|---|
| `tipo_evidencia` | `foto` / `video` / `documento` | Discriminador |
| `archivo_url` | Archivo | Se guarda la URL del storage (patrón del repo) |
| `fecha_evidencia` | Cuándo se capturó | FOR-008 / contexto del evento |

**Relaciones:**

```
Asokam (catálogos, FK lógica por código)          Lefarma (schema educacion_medica)
─────────────────────────────────────             ─────────────────────────────────
genContactosCat  ──1:1──▶ hospital_extension
genContactosCat  ──1:N──▶ programas_anuales_detalles ◀──1:N── programas_anuales
genProductosCat  ──1:N──▶ programas_anuales_detalles
                      selecciones_mensuales ──1:N──▶ selecciones_mensuales_hospitales
                                              └────1:N──▶ talleres (aggregate root)
                                                          ├──1:N──▶ taller_recursos
                                                          ├──1:1──▶ taller_materiales
                                                          ├──1:N──▶ taller_asistencias
                                                          ├──1:N──▶ taller_aprobaciones
                                                          └──1:N──▶ taller_evidencias
```

Madres (agregados): `programas_anuales`, `selecciones_mensuales`, `talleres`, `hospital_extension`. Hijas: todo lo demás. Catálogo: `tipo_gerencia` (FK física desde 3 tablas).

#### 1.2.12 Validación contra Asokam (2026-08-10) — qué existe y qué se creó

Antes de fijar columnas se consultó la BD real (`Asokam` en 192.168.4.2, solo lectura):

| Campo que necesita el módulo | ¿Existe en Asokam? | Fuente |
|---|---|---|
| Hospital | ✅ | `genContactosCat.codigoContacto` (PK, 4,856 filas) |
| CLUES | ✅ | `genContactosCat.clues` |
| Región / zona | ✅ | `genContactosCat.zona` (valores: CDMX NORTE, CDMX SUR, NORESTE, NOROESTE, OCCIDENTE, OTE-PTE, SURESTE, SIN REGION) |
| Estado (nombre) | ✅ (con JOIN) | `genContactosCat.codigoEstado` (código) → `genEstadosCat.nombreEstado` (32 estados) |
| Ciudad | ✅ | `genContactosCat.ciudad` |
| Municipio | ❌ no existe | Se captura en el módulo |
| **Tipo de gerencia** | ❌ no existe | **Se creó el catálogo propio `tipo_gerencia`** (§1.2.0) |
| **SIA (con_sia)** | ❌ no existe | Columna propia del módulo (BIT) |
| Quirófanos | ❌ no existe | Columna propia del módulo |
| Producto | ✅ | `genProductosCat.codigoProducto` |
| Usuario (firmas/captura) | ✅ | `app.Usuarios` |

### 1.3 Documentación en la base (`MS_Description`)

**Decisión:** cada schema, tabla y columna se documenta con extended properties dentro del propio script 0003. **Por qué:** consultable con SQL, visible en SSMS, idempotente, no depende de un archivo aparte.

### 1.4 Reglas de diseño — cada regla con su solución

| Regla | Por qué existe | Solución implementada / propuesta |
|---|---|---|
| **FKs lógicas cross-DB** | SQL Server no permite FK física hacia otra base | Validación de existencia en el servicio (ej. `_asokamDb.Hospitales.AnyAsync(...)`) **+ índices** en las columnas `id_*` de Lefarma (script 0004) y verificación de índices en Asokam (`genContactosCat.codigoContacto`, `genProductosCat.codigoProducto`) para que las consultas cross-DB sean rápidas. **Excepción:** `tipo_gerencia` es catálogo propio de la misma BD → **FK física** |
| `activo` solo en tablas madre | Los hijos (recursos, asistencias, evidencias) se borran físicamente, no se soft-deletean | `DELETE` directo en hijas al quitar registros; sin columna `activo` (menos código muerto) |
| `costo_total` NO es computed | El costo vive en otra tabla (recursos) y cambia con el detalle | Se calcula en el servicio al mutar `taller_recursos` (SUM en memoria) y se persiste en el taller; sin trigger ni fórmula en la BD |
| `estado` con CHECK en `talleres` | State machine explícita del ciclo de vida | CHECK con los 8 estados + validación de transiciones en el servicio (la BD rechaza valores inválidos, el servicio rechaza saltos ilegales) |
| Scripts numerados DbUp (0002, 0003) | Pipeline del repo: orden por id, guards idempotentes, `app.SchemaVersions` | Cada cambio nuevo = script `0004_...` con guards `IF NOT EXISTS`; nunca editar un script ya aplicado |

---

## Fase 2 — Backend

> Tareas: [[tareas/00001_esquema-datos-educacion-medica#Fase 2 — Backend]]

**Decisiones y por qué:**

1. **Sin capa Repository** — los servicios inyectan `ApplicationDbContext` + `AsokamDbContext` directos.
   *Por qué:* `DbSet<T>` ya es un Repository y `DbContext` ya es Unit of Work; envolverlos duplica abstracción. Para tests se usa EF InMemory (patrón ya existente en el repo).

2. **4 DbSets read-only en `AsokamDbContext`** (Hospitales, Productos, Gerencias, EquiposVentas).
   *Por qué:* son catálogos de consulta; nunca se escriben desde este módulo.

3. **Validación cross-DB en servicio** — las FK lógicas se validan al crear/actualizar.
   *Por qué:* la BD no puede garantizar la integridad entre bases; el servicio es la frontera de confianza.

### 2.1 Catálogo de endpoints — cada endpoint y por qué existe

Prefijo: `/api/educacion-medica`. Cada endpoint digitaliza una operación que hoy se hace en papel (referencia al formulario).

#### Catálogos (Slice 1)

| Endpoint | Qué hace | Porqué (operación que digitaliza) | Validaciones |
|---|---|---|---|
| `GET /hospitales` | Lista hospitales + cálculos | FOR-002: la base de datos por año/gerencia/SIA | Filtros: gerencia, con/sin SIA, año; paginación |
| `GET /hospitales/{codigo}` | Detalle 1 hospital | FOR-002 fila | — |
| `POST /hospitales` | Alta hospital + extensión | FOR-002 fila nueva | **Valida `codigoContacto` en Asokam**; solo captura quirófanos y encabezado; la BD calcula AT/AG/AR/AE/AS/MO/MNO (PERSISTED) |
| `PUT /hospitales/{codigo}` | Edita extensión | FOR-002 corrección | Misma validación; recálculo automático al cambiar quirófanos |
| `DELETE /hospitales/{codigo}` | Soft delete | Baja de la base | `activo = 0` (madre) |
| `GET /ejecutivos` | Ejecutivos y especialistas | Estructura organizacional (Roles: EV/EP/GV) | Read-only desde `app.Usuarios` (Asokam) |
| `GET /productos` | Catálogo de productos | FOR-003/005 usan claves R-III…T | Read-only desde `genProductosCat` (Asokam) |

#### Programa Anual (Slice 2)

| Endpoint | Qué hace | Porqué | Validaciones |
|---|---|---|---|
| `GET /programas-anuales` · `POST /programas-anuales` | Listar / crear | FOR-003 fila "Definición" | `anio` requerido; periodo 1–12 |
| `GET/PUT/DELETE /programas-anuales/{id}` | CRUD cabecera | FOR-003 edición | `meta_al_anio` lo calcula el servicio (= hospitales × 1.5) |
| `POST/DELETE /programas-anuales/{id}/detalles` | Añade hospital×producto | FOR-003 tabla principal | Valida hospital y producto en Asokam; UNIQUE anti-duplicado |

#### Selección Mensual (Slice 2)

| Endpoint | Qué hace | Porqué | Validaciones |
|---|---|---|---|
| `GET /selecciones-mensuales` · `POST /selecciones-mensuales` | Listar / crear | Reunión día 15 (FOR-004/IDT-003) | `fecha_seleccion`; vigencia 45 días calculada |
| `GET/PUT/DELETE /selecciones-mensuales/{id}` | CRUD cabecera | IDT-003 | Regla **≥ 64 talleres/mes** advertida en servicio |
| `POST/DELETE /selecciones-mensuales/{id}/hospitales` | Elige hospitales | Listado de la reunión | Valida hospital en Asokam; avisa si < 4 por zona |

#### Talleres (Slice 2 — proceso core)

| Endpoint | Qué hace | Porqué | Validaciones |
|---|---|---|---|
| `GET /talleres` · `POST /talleres` | Listar / crear | FOR-005 fila de Matriz | Crea en estado `Borrador` |
| `GET/PUT/DELETE /talleres/{id}` | CRUD | FOR-005 edición | DELETE solo si no ha salido de `Borrador` |
| `POST /talleres/{id}/estado` | Transición de estado | Ciclo de firmas Borrador→…→Realizado | **Valida el salto** (ej. `Borrador→Revisado` se rechaza) |
| `GET/POST/PUT/DELETE /talleres/{id}/recursos` | Recursos del taller | FOR-005 grupos de recursos | `tipo_recurso` válido; recalcula `costo_total` (SUM) al mutar |
| `GET/PUT /talleres/{id}/materiales` | Solicitud/entrega de material | FOR-007 + IDT-004 | 1:1 (UNIQUE); regla de entrega CDMX/foránea |
| `GET/POST/DELETE /talleres/{id}/asistencias` | Lista de médicos | FOR-008 | CHECK 1–20; firma_url al capturar |
| `POST /talleres/{id}/aprobaciones` | Firma Elaboró/Revisó/Autorizó | Pie de firmas de los formularios | Rol válido, permiso del rol firmante; log inmutable |
| `GET/POST/DELETE /talleres/{id}/evidencias` | Evidencias post-taller | Auditoría / CQ / Tecnovigilancia | Solo después de `Realizado` |

### 2.2 Catálogos (Slice 1)
Hospitales (con cálculos automáticos), Ejecutivos (read-only), Productos (read-only).

### 2.3 Taller completo (Slice 2, proceso core)
Programas Anuales, Selecciones Mensuales, Talleres con state machine, recursos + costo, materiales, asistencias, aprobaciones, evidencias.

---

## Fase 3 — Frontend

> Tareas: [[tareas/00001_esquema-datos-educacion-medica#Fase 3 — Frontend]]
> Pantallas derivadas de los formularios de `referencias/pdf-to-md/` (cada fila cita su formulario de origen).

**Decisión y por qué:** seguir el patrón de las apps existentes (`createAppRoutes` + `SidebarMenuItemConfig` + `services/*.api.ts` sobre el axios central). *Por qué:* consistencia con RH/CxP, reutiliza auth y permisos del hub.

### 3.1 Catálogo de pantallas — cada pantalla, su origen y quién la usa

Roles según [[referencias/pdf-to-md/Roles/Roles y Abreviaturas]] y los responsables que asignan los formularios e instructivos (pies de firma y flujos): **CRUD** = gestión completa · **R/W** = captura · **R** = lectura · **A** = aprueba/autoriza. Siglas: DC (Dirección Corporativa), GG (Gerente General), GV (Gerente de Ventas), EV (Ejecutivo de Ventas), EP (Especialista de Producto), AEM (Aux. Admin. Ed. Médica), CA (Coord. Admin.), EE (Ejec. Estadística).

#### Catálogos (Slice 1)

| Pantalla | Ruta | Formulario que reemplaza | Qué hace | Roles |
|---|---|---|---|---|
| **Hospitales** | `/catalogos/hospitales` | FOR-002 | Tabla CLUES + quirófanos; **calcula AT/AG/AR/AE/AS/MO/MNO solos** (el usuario solo captura quirófanos); filtros gerencia/SIA/año | GG/GV: CRUD · AEM/CA: R/W · EV/EP: R |
| **Ejecutivos** | `/catalogos/ejecutivos` | Roles y Abreviaturas | Catálogo de EV/EP/GV con zona y gerencia (read-only desde Asokam) | GG: CRUD · CA: R/W · EV/EP: R (propio) |
| **Productos** | `/catalogos/productos` | FOR-001/FOR-005 (productos) | Catálogo de claves R-III…T (read-only desde Asokam) | GG/CA: CRUD · GV/EV/EP: R |

#### Taller completo (Slice 2)

| Pantalla | Ruta | Formulario que reemplaza | Qué hace | Roles |
|---|---|---|---|---|
| **Programa Anual** | `/talleres/programa-anual` | FOR-003 | Plan anual: periodos, hospitales, **meta = N° × 1.5**, resumen de capacidad; firmas | GV/CEM: CRUD · AEM: R/W · GG: A · EV/EP: R |
| **Selección Mensual** | `/talleres/seleccion` | FOR-004 + IDT-003 | Reunión día 15: elige hospitales, agrupa por zona (mín 4/viaje), meta ≥64/mes; botón Autorizar | GV: R/W · GG: A · EV: R (asignación) · AEM: R |
| **Calendario** | `/talleres/calendario` | FOR-006 | Programación mensual por día/especialista/ejecutivo (lo elabora AEM el día 17) | AEM: CRUD · CEM/GG: A · GV/EP/EV: R |
| **Matriz de Talleres** (TallerDetail) | `/talleres/matriz` | FOR-005 | Datos del taller + recursos + **resumen de costos + Costo Total** + autorizaciones. En la SPA, los detalles del taller se agrupan como **tabs** de un solo detalle (Matriz · Materiales · Asistencia · Aprobaciones · Evidencias) sin perder la trazabilidad a los formularios | EV: R/W · GV: A · CA: A (costos) · DC: A · AEM: R/W |
| **Asistencia** (tab de TallerDetail) | `/talleres/asistencia` | FOR-008 | Lista 1–20 con firma escaneada; contador automático; observación médico líder +/− | EP/EV: R/W (en sitio) · AEM/GV: R |
| **Solicitud Materiales** (tab de TallerDetail) | `/talleres/materiales` | FOR-007 + IDT-004 | Solicitud/entrega: checklist (lista, flayers, cómputo, proyector, dulces, modelo), estatus, firma de recibido | AEM: CRUD · CA/Aux. Almacén: R/W · EV: R/W (recibe) · GG/DC: R |
| **Evidencias** (tab de TallerDetail) | — (dentro de TallerDetail) | Proceso | Fotos/videos/documentos post-taller | EP/EV: captura · CQ/TECNO: R |

> **Ventas IMSS (Metas, Plan de Trabajo, Reporte Semanal, Reporte de Visitas, Indicador)** queda fuera de este ADR: requiere la decisión 00002 y sus propias tablas. Ver [[referencias/pdf-to-md/Procesos/Proceso de Ventas IMSS]].

### 3.2 Permisos — cada permiso y por qué existe

Patrón del repo: `baseapp.hub.puede_ver_*` para el tile del hub; `app.recurso.puede_*` para el acceso por pantalla (`usePermission` + `PermissionGuard`, ver `apps/rh/`). Backend: `[HasPermission(Permissions.<Modulo>.<Accion>)]`.

| Permiso | Qué habilita | Porqué / rol que lo usa |
|---|---|---|
| `baseapp.hub.puede_ver_educacion_medica` | Muestra el tile del módulo en el hub | Llave de entrada (ya registrado en `apps/_registry.ts`); sin él el módulo es invisible |
| `educacion_medica.hospitales.puede_ver` | Ver pantalla Hospitales | EV/EP consultan la base para preparar visitas (matriz R) |
| `educacion_medica.hospitales.puede_gestionar` | Crear/editar/eliminar hospitales | GG/GV mantienen la base (CRUD) y AEM/CA capturan (R/W) |
| `educacion_medica.ejecutivos.puede_ver` | Ver catálogo de ejecutivos | Consulta organizacional |
| `educacion_medica.ejecutivos.puede_gestionar` | Editar ejecutivos | GG (CRUD) y CA (R/W) |
| `educacion_medica.productos.puede_ver` | Ver productos | Todos consultan claves |
| `educacion_medica.productos.puede_gestionar` | Editar productos | GG/CA (CRUD) |
| `educacion_medica.programas.puede_ver` | Ver Programa Anual | EV/EP (R) |
| `educacion_medica.programas.puede_gestionar` | Crear/editar programa | GV/CEM (CRUD) y AEM (R/W) |
| `educacion_medica.programas.puede_autorizar` | Firmar Autorizó del programa | GG (A) |
| `educacion_medica.selecciones.puede_ver` | Ver Selección Mensual | EV (asignación) y AEM (R) |
| `educacion_medica.selecciones.puede_gestionar` | Elegir hospitales | GV (R/W) |
| `educacion_medica.selecciones.puede_autorizar` | Firmar la selección | GG (A) |
| `educacion_medica.talleres.puede_ver` | Ver talleres/calendario | GV/EP/EV (R en calendario) |
| `educacion_medica.talleres.puede_capturar` | Crear/editar taller + recursos + asistencia | EV (R/W Matriz), EP/EV (R/W Asistencia) |
| `educacion_medica.talleres.puede_revisar` | Firmar Revisó + mover estado | GV (A) y CA (A costos) |
| `educacion_medica.talleres.puede_autorizar` | Firmar Autorizó final | DC (A) |
| `educacion_medica.materiales.puede_gestionar` | CRUD solicitud de material | AEM (CRUD) y CA/Aux. Almacén (R/W) |
| `educacion_medica.materiales.puede_confirmar` | Firma de recibido del ejecutivo | EV (R/W recibe) |
| `educacion_medica.evidencias.puede_gestionar` | Subir/borrar evidencias | EP/EV tras `Realizado` |

**Regla de asignación:** un rol acumula permisos según su papel en los flujos de los instructivos (IDT-003: GV selecciona y GG firma; IDT-004: AEM gestiona material y EV confirma recibo; FOR-005: EV elabora, GV/CA revisan, DC autoriza). La autorización (`puede_autorizar`) **no** incluye captura: separación de funciones como en el papel (quien elabora no autoriza).

---

## Anexo — Archivos originales

> Documentos fuente de esta decisión. Los originales viven en `referencias/` (pdf-to-md = `lefarma.docs/educacion-medica/referencias/pdf-to-md/`).

### Procesos y diagramas
- [[referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales]] — proceso `ASK-CEM-DDP-001` (fuente del ciclo completo)
- [[referencias/pdf-to-md/Procesos/Proceso de Ventas IMSS]] — proceso `ASK-VEN-DDP-001` (fuera de alcance, Fase futura)
- [[referencias/pdf-to-md/Diagramas/Diagrama del Proceso de Talleres Médicos]]
- [[referencias/pdf-to-md/Diagramas/Diagrama del Proceso de Ventas]]
- [[referencias/pdf-to-md/Diagramas/Diagrama del Proceso de Ventas Descentralizado]]

### Formularios (definen las columnas)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales]] → `hospital_extension` (fórmulas de anestesias)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-003 Programa Anual de Talleres Médicos]] → `programas_anuales(_detalles)` (meta = N° hospitales × 1.5)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos]] → `selecciones_mensuales(_hospitales)` (digitalizado desde el Anexo 1 del IDT-003)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos]] → `talleres` + `taller_recursos` (costos y autorizaciones)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos]] → `talleres` (programación)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos]] → `taller_materiales` (digitalizado desde el Anexo 2 del IDT-004; el 1:1 por taller es decisión declarada en §1.2.8)
- [[referencias/pdf-to-md/Formularios/ASK-CEM-FOR-008 Registro de Asistencia]] → `taller_asistencias` (lista de asistencia 1–20)

### Instructivos (reglas de proceso)
- [[referencias/pdf-to-md/Instructivos/Elaboración del Concentrado Anual de Talleres Médicos]]
- [[referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos]] — regla 45 días y ≥64 talleres/mes
- [[referencias/pdf-to-md/Instructivos/Impartición de Talleres Médicos]]
- [[referencias/pdf-to-md/Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos]] — regla CDMX/foránea
- [[referencias/pdf-to-md/Instructivos/Preparación y Autorización de Material de Talleres Médicos]]

### Roles y formularios
- [[referencias/pdf-to-md/Roles/Roles y Abreviaturas]] — glosario de actores (DC, GG, GV, EV, EP, AEM, CA, EE…)
- [[referencias/pdf-to-md/README]] — índice completo de pdf-to-md

### Versiones "limpias" de formularios (para extracción de columnas)
- `referencias/pdf-to-md/Educacion_medica/` y `referencias/pdf-to-md/Ventas/`

## Referencias técnicas

- `lefarma.database/educacion-medica/0002_20260805-0935_educacion-medica_create-schema.lefarma.dev.prod.sql`
- `lefarma.database/educacion-medica/0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql`
- [[tareas/00001_esquema-datos-educacion-medica]] — tareas por fase
- `lefarma.frontend/src/apps/_registry.ts` — permiso hub ya registrado
