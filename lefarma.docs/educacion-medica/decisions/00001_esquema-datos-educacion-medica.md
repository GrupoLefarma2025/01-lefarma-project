# 00001 — Esquema de datos del módulo Educación Médica

- **Estado:** Implementada (scripts 0002 y 0003 creados; 0003 pendiente de aplicar)
- **Fecha:** 2026-08-10
- **Ámbito:** Schema `educacion_medica`, 11 tablas operacionales, documentación en la base
- **Decisión tomada por:** Diseño de datos en conjunto con la propuesta aprobada del módulo

---

## 1. Contexto / Problema

El módulo Educación Médica digitaliza dos procesos de negocio documentados en `ASK-CEM-DDP-001` (Talleres Médicos en Hospitales) y `ASK-VEN-DDP-001` (Ventas IMSS). Para operarlo se necesitaban tablas nuevas. El problema: **no existía ningún objeto del módulo en la base de Lefarma** — ni schema, ni tablas; el frontend solo tenía scaffold.

Los catálogos maestros (hospitales, productos, usuarios) ya viven en la base **Asokam** y son la única fuente de verdad.

## 2. Qué tablas existían al día de hoy (antes de esta decisión)

### En Asokam (reutilizadas como catálogos read-only, NO se duplican)

| Catálogo | Tabla Asokam | Filas aprox. | Campo PK |
|---|---|---|---|
| Hospitales / Unidades médicas | `dbo.genContactosCat` | 4,856 | `codigoContacto` |
| Productos (Raquimix, Tesiakit…) | `dbo.genProductosCat` | 117 | `codigoProducto` |
| Usuarios / Ejecutivos / Especialistas | `app.Usuarios` | — | `IdUsuario` |
| Roles | `app.Roles` + `app.UsuariosRoles` | — | `IdRol` |
| Equipos de ventas | `dbo.crmEquipoVentasCat` | 3 | `codigoEquipoCRM` |
| Instituciones | `dbo.genInstitucionesCat` | 15 | `codigoInstitucion` |
| Gerencias | `dbo.genGerenciasCat` | 5 | — |
| Regiones × Delegación | `dbo.genRegionesXDelegacionCat` | 61 | — |

### En Lefarma (base del módulo)

- **No existía** el schema `educacion_medica`.
- **No existía** ninguna tabla operacional del módulo.
- El script `0002` creó el schema; el `0003` crea las 11 tablas.

## 3. Decisión

1. Crear un **schema propio `educacion_medica`** en la base Lefarma, separado de Asokam.
2. Crear **11 tablas operacionales** derivadas de los formularios del negocio.
3. Las columnas se toman **directamente de los formularios** (código de referencia ASK-CEM-FOR-xxx) y de los instructivos.
4. Los **catálogos se referencian por código (FK lógica)**, nunca por FK física cross-DB.
5. Documentar schema, tablas y columnas **dentro de la propia base** con extended properties `MS_Description`.

## 4. Base de las columnas (de qué formulario salió cada tabla)

| Tabla | Origen | Qué aportó el documento |
|---|---|---|
| `hospital_extension` | ASK-CEM-FOR-002 (Base de Datos de Hospitales) | Año, tipo gerencia, con SIA, quirófanos y fórmulas de anestesias |
| `programas_anuales` | ASK-CEM-FOR-003 (Programa Anual) | Planificación anual: metas y periodos |
| `programas_anuales_detalles` | ASK-CEM-FOR-003 | Qué hospital × qué producto entran al programa |
| `selecciones_mensuales` | ASK-CEM-FOR-004 (Selección de Hospitales) + Instructivo "Selección Mensual" | Reunión del día 15: elección mensual de hospitales |
| `selecciones_mensuales_hospitales` | ASK-CEM-FOR-004 | Hospitales elegidos + ejecutivo asignado |
| `talleres` | ASK-CEM-FOR-005 (Matriz de Talleres) + Instructivo "Impartición" | La "Matriz": datos del taller, estado del ciclo de vida |
| `taller_recursos` | ASK-CEM-FOR-005 | Muestras, folletos, envíos, box lunch, equipo (recursos del taller) |
| `taller_materiales` | ASK-CEM-FOR-007 (Material para Talleres) + Instructivo "Solicitud y Entrega de Materiales" | Solicitud y entrega de material (1:1 con el taller) |
| `taller_asistencias` | ASK-CEM-FOR-008 (Registro de Asistencia) | Lista de médicos asistentes (hasta 20) |
| `taller_aprobaciones` | Proceso ASK-CEM-DDP-001 (no es un formulario) | Log de firmas Elaboró/Revisó/Autorizó — trazabilidad |
| `taller_evidencias` | Proceso ASK-CEM-DDP-001 (no es un formulario) | Fotos y documentos post-taller |

## 5. Cómo se relacionan las tablas entre sí

```
genContactosCat (Asokam) 1────1 hospital_extension          ← FK lógica codigo_hospital
genContactosCat (Asokam) 1────N programas_anuales_detalles  ← FK lógica codigo_hospital
genProductosCat (Asokam) 1────N programas_anuales_detalles  ← FK lógica codigo_producto

programas_anuales 1────N programas_anuales_detalles
selecciones_mensuales 1────N selecciones_mensuales_hospitales
selecciones_mensuales_hospitales 1────N talleres            ← nace un taller por selección+hospital

talleres 1────N taller_recursos
talleres 1────1 taller_materiales                            ← UNIQUE id_taller garantiza 1:1
talleres 1────N taller_asistencias
talleres 1────N taller_aprobaciones                          ← log de firmas
talleres 1────N taller_evidencias
```

Agregados (madre): `programas_anuales`, `selecciones_mensuales`, `talleres`. Hijas: todo lo demás.

## 6. Decisiones técnicas y su porqué

| Decisión | Por qué |
|---|---|
| Schema propio `educacion_medica` | No invadir Asokam (`genContactosCat` tiene 76 columnas y es de otra app). Limpio y reversible. |
| `hospital_extension` 1:1 separada | Los cálculos de anestesias son del módulo; si Asokam migra, se mergea fácil. |
| Columnas `PERSISTED` (AT/AG/AR/AE/AS/MO/MNO) | Fórmulas fijas del FOR-002 (AT = NQ × 2.5 × 250; AG = AT × 30%; …). La BD calcula y guarda: cero errores manuales, consultas rápidas. |
| `estado` con CHECK en `talleres` | State machine explícita del proceso (Borrador → Elaborado → Revisado → Autorizado → Programado → EnCurso → Realizado/Cancelado); el servicio valida transiciones. |
| `taller_recursos` polimórfico | 1 tabla con `tipo_recurso` en vez de 5 tablas (muestras, folletos, envíos, box lunch, equipo). Menos JOINs y menos código. |
| `taller_materiales` UNIQUE `id_taller` | Garantiza la relación 1:1 sin compartir la PK. |
| `taller_aprobaciones` como log (no update) | Trazabilidad total de quién firmó qué y cuándo (auditoría). |
| `costo_total` NO es columna computed | Vive en otra tabla (recursos); se calcula en el servicio para no acoplar fórmulas a la BD. |
| FKs lógicas cross-DB | SQL Server no soporta FKs físicas hacia otra base; la validación de existencia se hace en el servicio. |
| `activo` solo en tablas madre | Los hijos (recursos, asistencias, evidencias) se borran físicamente, no se soft-deletean. |
| Scripts numerados DbUp (0002, 0003) | Pipeline establecido en el repo; orden por id global, guards idempotentes, `app.SchemaVersions`. |
| Documentación con `MS_Description` | Consultable con SQL, visible en SSMS, idempotente, no depende de un archivo aparte. |

## 7. Fuentes de la decisión (de qué documento se sacó la información)

> Convención: cada referencia de negocio (ASK-*) se enlaza con wikilink de Obsidian al documento fuente en `referencias/`. La vault de Obsidian es la carpeta raíz `lefarma.docs/educacion-medica/`.

| Información | Documento fuente | Enlace |
|---|---|---|
| Proceso completo del taller y su ciclo | Talleres Médicos en Hospitales (ASK-CEM-DDP-001) + Diagrama del Proceso | [[referencias/vault/Procesos/Talleres Médicos en Hospitales]] · [[referencias/vault/Diagramas/Diagrama del Proceso de Talleres Médicos]] |
| Columnas de hospital_extension y fórmulas | ASK-CEM-FOR-002 Base de Datos de Hospitales | [[referencias/vault/Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales]] |
| Columnas de programas_anuales y detalles | ASK-CEM-FOR-003 Programa Anual | [[referencias/vault/Formularios/ASK-CEM-FOR-003 Programa Anual de Talleres Médicos]] |
| Columnas de selecciones mensuales | ASK-CEM-FOR-004 + Instructivo de Selección Mensual | [[referencias/vault/Referencias/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos]] · [[referencias/vault/Instructivos/Selección Mensual de Hospitales para Talleres Médicos]] |
| Columnas de talleres y recursos | ASK-CEM-FOR-005 Matriz de Talleres | [[referencias/vault/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos]] |
| Columnas de taller_materiales | ASK-CEM-FOR-007 Material para Talleres + Instructivo de Solicitud y Entrega | [[referencias/vault/Referencias/ASK-CEM-FOR-007 Material para Talleres Médicos]] · [[referencias/vault/Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos]] |
| Columnas de taller_asistencias | ASK-CEM-FOR-008 Registro de Asistencia | [[referencias/vault/Formularios/ASK-CEM-FOR-008 Registro de Asistencia]] |
| Catálogos de Asokam a reutilizar | Propuesta del módulo §4.1 (verificados en BD) | [[referencias/propuesta]] |
| Las 11 tablas y sus relaciones | Propuesta del módulo §4.2 | [[referencias/propuesta]] |
| State machine del taller | Propuesta §4.3 + instructivos | [[referencias/propuesta]] · [[referencias/vault/Instructivos/Impartición de Talleres Médicos]] |
| Decisiones de diseño | Propuesta §4.4 | [[referencias/propuesta]] |
| Convenciones SQL del repo | AGENTS.md + scripts existentes | `lefarma.database/`, `AGENTS.md` |

> Las versiones "limpias" de los formularios usadas para extraer columnas están en `lefarma.docs/educacion-medica/referencias/extracted/`.

## 8. Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechazó |
|---|---|
| Agregar columnas directamente a `genContactosCat` (Asokam) | Invade la base de otra app; riesgo de romper otras apps; Asokam puede migrar. |
| Una tabla por tipo de recurso (muestras, folletos, envíos, box lunch, equipo) | 5 tablas casi idénticas, más JOINs y más código para el mismo dato. |
| FK físicas hacia Asokam | Imposible en SQL Server entre bases distintas; se valida en servicio. |
| `costo_total` calculado en la BD | Acopla fórmulas de negocio al esquema; el costo vive en recursos y cambia con el detalle. |

## 9. Consecuencias

- **Positivas:** módulo aislado, catálogos sin duplicar, esquema documentado en la propia base, scripts reproducibles en dev y prod.
- **Negativas / riesgos:** `genContactosCat` (4,856 filas) contiene ruido — hay que filtrar por tipo/clasificación; las consultas cross-DB dependen de índices en Asokam; si el negocio cambia las fórmulas de anestesias, hay que alterar columnas PERSISTED con un script nuevo.

## 10. Referencias

- `lefarma.database/educacion-medica/0002_20260805-0935_educacion-medica_create-schema.lefarma.dev.prod.sql`
- `lefarma.database/educacion-medica/0003_20260806-1556_educacion-medica_create-tablas-operacionales.lefarma.sql`
- [[referencias/propuesta]]
- [[referencias/pantallas]]
- [[referencias/vault/Procesos/Talleres Médicos en Hospitales]] (proceso ASK-CEM-DDP-001)
- `lefarma.docs/educacion-medica/referencias/vault/` (Procesos, Formularios, Instructivos, Referencias, Diagramas)
- `lefarma.docs/educacion-medica/referencias/extracted/` (formularios procesados)
