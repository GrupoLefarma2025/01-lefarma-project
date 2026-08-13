---
fecha_creacion: 2026-08-10 17:45
fecha_modificacion: 2026-08-10 17:50
resumen: Documento maestro único del módulo Educación Médica — brief + proceso AS-IS (32 pasos detallados) + reglas de negocio (TO-BE) + modelo de datos y dependencias del legacy (Asokam).
---

# Reglas de Negocio — Módulo Educación Médica

Documento de referencia **único y maestro** que consolida el contexto, el proceso actual (AS-IS, con los 32 pasos detallados y sus citas literales), las reglas de la digitalización (TO-BE) y el modelo de datos del módulo **Educación Médica**, que digitaliza el proceso **Talleres Médicos en Hospitales** (`ASK-CEM-DDP-001`).

- Para el **diseño técnico** (schema, tablas, endpoints, pantallas, permisos): [[decisiones/00001_esquema-datos-educacion-medica]].

---

## 1. Contexto y objetivo

El proceso **Talleres Médicos en Hospitales** (`ASK-CEM-DDP-001`) se ejecuta hoy **100% en papel**, a través de 7 formularios físicos (FOR-002 a FOR-008): base de hospitales, programa anual, selección mensual, matriz del taller, calendario, solicitud de materiales y registro de asistencia. El ciclo completo —desde la planeación anual hasta las firmas de autorización y las evidencias post-taller— depende de captura manual, cálculos a mano (anestesias, costos) y circulación de papel entre roles. Es **lento** y propenso a errores de captura.

**Objetivo:** digitalizar el ciclo completo en una aplicación, de modo que el proceso deje de depender de papel. El módulo **reemplaza los 7 formularios por pantallas**, automatiza los cálculos manuales (anestesias AT/AG/AR…, costo total del taller) y centraliza firmas, asistencia y evidencias.

> Fuente: `Procesos/Talleres Médicos en Hospitales.md` — *"Proceso general para realizar Talleres Médicos en Hospitales con personal médico en hospitales del sistema público de salud."*

---

## 2. Métricas de éxito y beneficios

### Métricas del sistema (comprometidas)

Las garantiza el equipo que construye el módulo:

- El ciclo completo de Talleres Médicos (programa anual → selección mensual → taller → firmas → asistencia → evidencias) opera **end-to-end en la app**.
- Los roles del proceso (GG, GV, EV, EP, AEM, CA, DC) **usan la app en lugar de los formularios en papel**.
- **Cero formularios en papel** para el proceso Talleres Médicos.

### Beneficios del área (no comprometidos)

Dependen de la operación, no del software:

- Cumplir la meta configurable de **~128 sesiones/mes** _(configurable)_ (repartidas IMSS / ISSSTE / Otros, todo parametrizable).
- **Visibilidad y control de costos** por taller (muestras, folletos, box lunch, envíos).
- **Reducción del tiempo de ciclo** de un taller.

---

## 3. Alcance y audiencia

### 3.1 Alcance

**Dentro del alcance (IN):**
- Proceso **Talleres Médicos en Hospitales** (`ASK-CEM-DDP-001`): catálogos (hospitales, ejecutivos, productos), programa anual, selección mensual, talleres con state machine de firmas, recursos y costos, materiales, asistencias, aprobaciones y evidencias.

**Fuera del alcance (OUT):**
- Proceso **Ventas IMSS** (`ASK-VEN-DDP-001`): requiere su propia decisión (ADR 00002) y sus propias tablas.

### 3.2 Audiencia / Stakeholders

| Rol | Sigla | Qué hace en el módulo |
|-----|-------|----------------------|
| Director Corporativo | DC | Autoriza talleres (firma final) |
| Gerente General | GG | Autoriza programas y selecciones mensuales |
| Gerente de Ventas | GV | CRUD de programas/selecciones, revisa talleres |
| Ejecutivo de Ventas | EV | Captura el taller, recibe materiales, asiste |
| Especialista de Producto | EP | Imparte el taller, captura asistencia y evidencias |
| Aux. Admin. Ed. Médica | AEM | Calendario, solicitud de materiales, captura |
| Coord. Admin. | CA | Revisa costos y materiales |

### 3.3 Timeline / Fases del proyecto

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Planificación (ADR 00001) | ✅ Hecha |
| 1 | Base de datos — schema `educacion_medica`, catálogo + 11 tablas operacionales | Planificada |
| 2 | Backend — catálogos (Slice 1) + taller completo (Slice 2) | Pendiente |
| 3 | Frontend — pantallas de catálogos + pantallas del taller | Pendiente |

---

## 4. Proceso actual (AS-IS)

Reconstrucción del flujo operativo tal como ocurre hoy —enteramente sobre papel y correo electrónico, sin sistema transaccional— elaborada a partir de los documentos resguardados en `referencias/pdf-to-md/` (Procesos + Instructivos + Formularios). Cada regla va respaldada con cita literal (nombre del archivo fuente + texto entre comillas) del instructivo o formulario correspondiente. Donde el material fuente no documenta algo, se marca como "no documentado" en lugar de suponer.

### Notas de alcance y fuentes

- Documento maestro: `Procesos/Talleres Médicos en Hospitales.md`, código **ASK-CEM-DDP-001**, versión 02, fecha 02-feb-2024. Lo define como: *"Proceso general para realizar Talleres Médicos en Hospitales con personal médico en hospitales del sistema público de salud."* (`Procesos/Talleres Médicos en Hospitales.md`)
- Instructivos que lo detallan (todos en `Instructivos/`): **IDT-001** Preparación/Autorización de Material, **IDT-002** Concentrado Anual, **IDT-003** Selección Mensual, **IDT-004** Solicitud y Entrega de Materiales, **IDT-005** Impartición.
- Actores según `Roles/Roles y Abreviaturas.md`. **Nota importante:** los roles **CQ (Control de Quejas)** y **TECNO (Tecnovigilancia)** NO intervienen en ningún paso de este proceso; aparecen solo en el catálogo de roles de Ventas IMSS. La única mención de "quejas" en el proceso es como *tema obligatorio de la presentación* (IDT-001 §5.1, punto "6. Atención de quejas"), no como actor.
- El proceso maestro lista **5 fases**: (1) Preparación y autorización de material, (2) Selección de hospitales y planeación, (3) Preparación y autorización de viáticos, (4) Ejecución, (5) Evaluación (`Procesos/Talleres Médicos en Hospitales.md`). El walkthrough siguiente (§4.3) las conserva pero las **ordena cronológicamente** tal como ocurren en el año (en noviembre corren en paralelo la Fase 1 y la Fase 2; la Fase 3 —viáticos— ocurre embebida en la programación mensual).

### Diagrama de texto del flujo general (inicio → fin)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE A · PLANIFICACIÓN ANUAL (noviembre, para el año siguiente)             │
│                                                                             │
│  A1 — Preparación del material didáctico [IDT-001]   ┐ paralelo            │
│    CEM revisa → GG aprueba → DIG diseña →           │ entre noviembre      │
│    CEM+EP+I&D revisan → DC autoriza → Quality Web   │ y diciembre          │
│                                                     │                      │
│  A2 — Concentrado anual de hospitales [IDT-002]     ┘                      │
│    CEM pide BD → EE arma BD (FOR-001) →                                            │
│    reunión GG+GV+EE (3ª sem nov) → FOR-002 + FOR-003 → DC autoriza                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE B · SELECCIÓN MENSUAL (día 15 de cada mes) [IDT-003]                   │
│                                                                             │
│  GG + GV reunión día 15 → FOR-004 (selección, firma GG+GV) →                          │
│  GV notifica a EV → EV visita hospital + Speech → llena FOR-005 (Matriz) →             │
│  GV concentra FOR-005 (firma) → envía día 15 al AEM                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE C · PROGRAMACIÓN, COSTOS, VIÁTICOS Y MATERIALES (día 15→20+) [IDT-004]│
│                                                                             │
│  AEM cuesta FOR-005 + hace Calendario (FOR-006) día 17 →                             │
│  CA revisa costos → firma → DC autoriza Matriz (≤ día 20) → AEM                       │
│   ├─ CA genera Pedido Interno → Aux. Almacén → material al AEM                       │
│   ├─ Aux.Pagos → DC autoriza (martes) → Tesorero deposita box lunch → AEM             │
│   └─ AEM solicita viáticos [ASK-GGE-IDT-001]                                          │
│  AEM arma paquetes → entrega (CDMX 4:30-6:30 p.m. / foránea 7 días + carta porte) →   │
│  EV recibe y firma FOR-007                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE D · IMPARTICIÓN (día del taller) [IDT-005]                            │
│                                                                             │
│  Víspera: EV confirma cita + box lunch; EP revisa material                           │
│  Día T: EV+EP llegan 1h antes → montaje (EV) + prueba equipo (EP) →                   │
│  EP recibe/bienvenida + EV entrega box lunch → FOR-008 (Registro de Asistencia)        │
│  EP imparte al 80% de asistentes: teórica (máx 15 min) → práctica (modelo) →          │
│    Q&A → encuesta QR → despedida                                                      │
│  Cierre: EV recoge equipo + fotos + envía FOR-008 al AEM; con Jefe de Servicio        │
│  entregan muestras/sobrantes y notifican incidencias                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE E · CIERRE, EVIDENCIAS E INDICADORES [DDP-001 Fase 5]                 │
│                                                                             │
│  AEM registra documentación en BD + elabora indicadores →                            │
│    correo a CEM, GV y GG                                                              │
│  CEM presenta INDICADORES SEMANALMENTE a GG y DC                                      │
│    (talleres realizados vs. programados, producto entregado,                          │
│     satisfacción, médicos asistentes, adscritos, residentes) → FIN                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Las 5 fases

| Fase | Qué pasa | Formulario(s) | Quién autoriza |
|------|----------|---------------|----------------|
| **A — Planificación anual** (noviembre) | Material didáctico + concentrado anual de hospitales + programa anual | FOR-001/002/003 | **DC** autoriza programa y material |
| **B — Selección mensual** (día 15) | GG+GV eligen hospitales de los próximos 45 días; EV visita y captura la matriz | FOR-004, FOR-005 | **GG+GV** firman la selección |
| **C — Programación, costos y materiales** (día 15→20) | AEM cuesta + arma calendario; CA revisa costos; DC autoriza matriz; pedido de material; pago de box lunch; entrega al EV | FOR-005 (costos), FOR-006, FOR-007 | **CA** revisa costos; **DC** autoriza matriz y box lunch (martes) |
| **D — Impartición** (día del taller) | EV+EP llegan 1h antes; registro de asistencia; EP imparte (inicia al 80% de asistentes); fotos de evidencia | FOR-008 | Cada médico firma su asistencia |
| **E — Cierre e indicadores** | AEM registra documentación + elabora indicadores; CEM los presenta semanalmente a GG+DC | — | **GG+DC** reciben el reporte semanal |

### 4.2 Los 10 puntos de aprobación / decisión

| # | Punto de decisión / aprobación | Quién autoriza | Disparador (qué lo activa) | Estado que provoca | Cita fuente |
|---|---|---|---|---|---|
| D1 | Autorización del **material didáctico** (presentación de producto) | **DC** (previa aprobación GG y revisión EP/I&D) | CEM envía la presentación diseñada y revisada | Material usable en el año; se resguarda en Quality Web | `Instructivos/Preparación y Autorización de Material de Talleres Médicos.md` §5.5 *"obtiene su autorización"* |
| D2 | Autorización del **Programa Anual** (FOR-001, FOR-002, FOR-003) | **DC** | CEM presenta los tres formatos tras la reunión de la 3ª semana de noviembre | Programa anual cerrado; arranque del ciclo operativo | `Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md` §5.4 *"obtiene su autorización"* |
| D3 | **Revisión trimestral** y reautorización del programa | GG/GV/DC | Acuerdo comercial nuevo con un Sia o fin de trimestre | Programa actualizado y autorizado | `Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md` (Nota tras detalle 5.3): *"Si durante el año se realizan acuerdos comerciales con algún SIA… se deberá actualizar y autorizar el programa. El programa deberá revisarse trimestralmente…"* |
| D4 | **Selección mensual** y firma de FOR-004 | **GG firma** y solicita firma de los **GV** | Reunión del día 15 (o siguiente día laboral) | FOR-004 firmado → notificación a EV | `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` §5.1.3 *"firma los formatos de cada gerencia y solicita a los Gerentes de ventas que firmen"* |
| D5 | **¿Acepta el hospital el taller?** | Jefe de servicio de Anestesia (decisión externa) | EV visita el hospital y aplica el Speech (ASK-CEM-ANE-001) | "Acepta" → EV registra en FOR-005; "No acepta" → GV reagenda visita | `Procesos/Talleres Médicos en Hospitales.md` nodo P2D *"¿Acepta taller?"* y §5.2.2 de IDT-003 |
| D6 | **Firma/concentración de FOR-005** (Matriz mensual) | **GV** firma; **CA** revisa costos; **DC** autoriza | EV envía FOR-005; AEM cuesta; CA revisa | Matriz autorizada → se generan pedido, calendario, viáticos y pago | `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` §5.2.3 y `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.2 *"a más tardar el día 20 de cada mes, la Matriz autorizada"* |
| D7 | **Autorización semanal de box lunch** | **DC** (los martes) | Auxiliar de Pagos presenta el importe | Depósitos del Tesorero a proveedor/EV | `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.5 *"Presenta los días martes de cada semana a Dirección el importe de box lunch para su autorización"* |
| D8 | **Recepción conforme del material** (FOR-007) | **EV** firma | Entrega presencial (CDMX 4:30–6:30 p.m.) o foránea (7 días antes + carta porte) | Material apto para el taller; si no está completo, AEM+CA gestionan para tenerlo 1 día antes | `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.9 y nota |
| D9 | **Umbral de inicio del taller** | **EP** (regla: 80 % de participantes) | Llegada de asistentes | Inicio del taller (4 etapas) | `Instructivos/Impartición de Talleres Médicos.md` §5.2.1 *"Una vez que se cuente con el 80% de los participantes, inicia el taller médico"* |
| D10 | **Reporte semanal de indicadores** a la autoridad | **GG + DC** (reciben, no firman) | CEM consolida indicadores cada semana | Seguimiento del cumplimiento; retroalimentación al programa anual | `Procesos/Talleres Médicos en Hospitales.md` Fase 5, nodo P5B |

### 4.3 Walkthrough paso a paso (32 pasos)

> Convención de firmas de documento (no confundir con firmas de operación): todos los instructivos/formularios llevan bloque **Elaboró / Revisó / Autorizó** a pie de página, donde quien **Autoriza** siempre es el **Director Corporativo (Lic. Héctor Vélez Rivera)** y quien **Elabora** es el Analista de métodos y procedimientos (Ing. Javier Páez Aldaco). Eso es la firma del *documento controlado*, no del *contenido operativo*. Las firmas **operativas** (sobre el contenido del formato) se indican en el campo "Aprobación" de cada paso.

---

#### FASE A1 — Preparación del material didáctico (anual, noviembre) · Instructivo ASK-CEM-IDT-001

**Paso 1 — Revisión anual de presentaciones de producto**
- **Quién lo hace:** CEM (Coordinador de Educación Médica), junto con EP, Especialista de Anestesiología e I&D (Coordinador de Investigación y Desarrollo).
- **Qué hace:** Revisa las presentaciones de producto que los EP usarán el próximo año, identificando si se actualizan o se crean nuevas. Las presentaciones deben incluir 7 temas obligatorios: *"1. Lefarma y Asokam líderes en México en dispositivos para anestesia. 2. Producto a presentar… 3. Propuestas de valor del producto y normas de calidad… 4. Cuáles son los beneficios… 5. Evolución y mejora continua del producto basada en la retroalimentación de los médicos. 6. Atención de quejas. 7. Datos de contacto de Asokam."* (`Instructivos/Preparación y Autorización de Material de Talleres Médicos.md`, §5.1).
- **Por qué se hace así:** Ocurre en ventana fija — *"Revisa en la primera semana del mes de noviembre las presentaciones"* (§5.1).
- **Qué pasa después:** Si la presentación existe y está OK, va directo a revisión conjunta; si no, CEM la (re)elabora.
- **Aprobación:** No es punto de firma operativa.

**Paso 2 — Revisión/aprobación GG y diseño gráfico**
- **Quién lo hace:** CEM → GG → DIG (Diseñador Gráfico).
- **Qué hace:** CEM coordina con GG la revisión y aprobación de la presentación y, el mismo día de la autorización, envía al DIG para que la diseñe en la **plantilla autorizada ASK-CBA-FOR-001**. DIG la elabora y la devuelve al CEM.
- **Por qué se hace así:** Ventanas fijas — *"Coordina con el Gerente General la revisión y aprobación de la presentación en un periodo de tiempo máximo de 2 días"* (§5.2); *"en un periodo máximo de 2 días laborables, elabora la presentación en la plantilla autorizada"* (§5.3).
- **Qué pasa después:** CEM recibe la presentación diseñada para revisión conjunta.
- **Aprobación:** **GG aprueba** el contenido; **DIG** firma el diseño. No se cita firma formal de GG sobre el archivo en este subpaso (la firma operativa explícita llega en el paso 4 con DC).

**Paso 3 — Revisión conjunta de la presentación**
- **Quién lo hace:** CEM junto con EP, Especialista de Anestesiología, I&D y GG.
- **Qué hace:** Revisan la presentación diseñada. Si identifican mejoras, CEM solicita por correo al DIG ajustes, y el ciclo diseño→revisión se repite.
- **Por qué se hace así:** Plazo y bucle documentados — *"la revisan en un periodo máximo de 2 días laborables… En caso de identificar mejoras, solicita inmediatamente por correo electrónico al diseñador gráfico realizar mejoras a la presentación"* (§5.4).
- **Qué pasa después:** Presentación finalizada → envío a DC.
- **Aprobación:** Revisión técnica conjunta (EP, I&D, GG); no es firma de autorización terminal.

**Paso 4 — Autorización de Dirección Corporativa**
- **Quién lo hace:** CEM → DC (Dirección Corporativa).
- **Qué hace:** CEM envía la presentación a DC, quien la revisa y **autoriza**.
- **Por qué se hace así:** Plano y verbo exactos — *"Envía máximo al otro día laboral a Dirección Corporativa para su revisión y obtiene su autorización"* (§5.5). Corresponde a la decisión *"CEM: Presenta material para talleres al Gerente General y a Dirección Corporativa para su autorización"* del diagrama del proceso maestro (`Procesos/Talleres Médicos en Hospitales.md`, Fase 1, nodo P1E).
- **Qué pasa después:** CEM solicita el resguardo en la plataforma documental.
- **Aprobación:** **Punto de autorización: DC autoriza** la presentación de producto.

**Paso 5 — Resguardo en Quality Web**
- **Quién lo hace:** CEM (solicita) → Analista de Métodos y Procedimientos (ejecuta), con copia al Gerente de Calidad.
- **Qué hace:** El Analista registra la presentación en la plataforma **Quality Web** (catálogo de documentos: revisores, aprobadores, proceso, código, versión, tipo, elaborador, origen, accesos) en máximo 1 día laboral.
- **Por qué se hace así:** *"Solicita por correo electrónico al Gerente de Calidad con copia al Analista de Métodos y Procedimientos que resguarde la presentación en la plataforma documental"* (§5.6); pasos 1–7 de registro en Quality Web (§5.7).
- **Qué pasa después:** Material autorizado y disponible para el ciclo anual. Termina el instructivo IDT-001.
- **Aprobación:** No.

---

#### FASE A2 — Concentrado anual de hospitales y programa (anual, noviembre) · Instructivo ASK-CEM-IDT-002

**Paso 6 — Solicitud de la base de datos de hospitales**
- **Quién lo hace:** CEM → EE (Ejecutivo de Estadística).
- **Qué hace:** CEM solicita por **correo electrónico**, en la **primera semana de noviembre**, la base de datos actualizada de Hospitales del Sistema Público de Salud. Los datos requeridos incluyen: nombre del hospital, entidad, municipio, institución/unidad de negocio, nivel de atención, delegación/UMAE, número de quirófanos, si cuenta con **Sia**, y estimación de procedimientos anestésicos desglosados (general, regional, epidural, subdural, mixta) (`Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md`, §5.1 y "Detalle del paso 5.1").
- **Por qué se hace así:** *"Solicita por correo electrónico en la primera semana de noviembre la base de datos actualizada de Hospitales del sistema Público de Salud"* (§5.1).
- **Qué pasa después:** EE prepara la base en 5 días hábiles.
- **Aprobación:** No.

**Paso 7 — Elaboración de la base de datos (FOR-001)**
- **Quién lo hace:** EE (Ejecutivo de Estadística).
- **Qué hace:** Construye el formato **ASK-CEM-FOR-001 "Base de datos de Hospitales del Sistema Público de Salud"** en 5 días hábiles. Cálculos clave: *"AT = NQ × 2.5 × 250"* (anestesias totales; NQ=n.º de quirófanos, 2.5=cirugías/día, 250=días laborables/año); *"Anestesias Generales = AT × 30%"*; *"Anestesias Regionales = AT × 70%"*; y subtipos Epidural 35%, Subdural 45%, Mixta 20% (Anexo 2, §6–8). Finalmente hace Pareto 70/30 sobre el n.º de procedimientos anestésicos (Anexo 2, §11). Se envía al CEM.
- **Por qué se hace así:** *"Prepara la base de datos en 5 días hábiles y envía el formato ASK-CEM-FOR-001 al coordinador"* (§5.2).
- **Qué pasa después:** CEM convoca la reunión anual.
- **Aprobación:** No.

**Paso 8 — Reunión anual de selección y elaboración de FOR-002 y FOR-003**
- **Quién lo hace:** CEM coordina; asisten GG, Gerentes de Ventas (GV) y EE.
- **Qué hace:** Reunión en la **tercera semana de noviembre**. EE presenta las BD de cada gerencia; los **GV analizan y determinan los hospitales a visitar** con criterios documentales:
  - *"1.1. Número de anestesias/año del hospital (Pareto 70/30)"*
  - *"1.2. Número de hospitales por municipio, costos de traslado y distancias"*
  - *"1.3. Tipo de hospital (hospital escuela, Gineco, Pediátrico)"*
  - *"1.4. Si cuenta con Sia"*
  - *"1.5. Índice de inseguridad de la localidad o reporte de cualquier incidente de visitas anteriores"*
  - *"1.6. Cualquier otro criterio relevante con base a la experiencia y conocimiento de los hospitales por parte del gerente y ejecutivos"*

  Registran los hospitales en **FOR-002 "Base de Datos de Hospitales para Talleres Médicos"** (§5.3 y detalle). Después:
  - Determinan la **frecuencia de talleres por hospital** según la demanda de productos.
  - Establecen el **total anual**: *"Total de talleres = Número de hospitales × 1.5 talleres"* (detalle paso 5.3, punto 4).
  - Elaboran **FOR-003 "Programa Anual de Talleres Médicos"** considerando *"4.1. El plan anual de ventas"*, *"4.2. Productos que se deben promocionar durante el año para cumplir el objetivo de ventas"* y *"4.3. Productos que se deben generar la demanda para la licitación a finales del año"*.
  - *"Firman de conformidad los formatos correspondientes"* (detalle paso 5.3, punto 6).
- **Por qué se hace así:** *"Coordina reunión en la tercera semana de noviembre con Gerentes de Ventas, Gerente General y Ejecutivo de Estadística para elaborar la 'Base de datos de Hospitales para Talleres Médicos' y el 'Programa anual de Talleres Médicos'"* (§5.3).
- **Qué pasa después:** CEM presenta los documentos a DC. **Regla de mantenimiento del programa:** *"Si durante el año se realizan acuerdos comerciales con algún Sia que requiera talleres médicos, se deberá actualizar y autorizar el programa. El programa deberá revisarse trimestralmente para supervisar el avance de hospitales ya visitados y actualizar la programación"* (Nota tras §detalle 5.3).
- **Aprobación:** **Firma operativa de los formatos FOR-002 y FOR-003** por el equipo en la reunión (GG + GV).

**Paso 9 — Autorización anual de DC**
- **Quién lo hace:** CEM → DC.
- **Qué hace:** CEM presenta a DC tres documentos y obtiene su autorización: (1) FOR-001 Base de datos del Sistema Público, (2) FOR-002 Base de datos para Talleres Médicos, (3) FOR-003 Programa Anual.
- **Por qué se hace así:** *"Presenta a Dirección Corporativa los documentos y obtiene su autorización"* (§5.4); documentos listados en "Detalle del paso 5.4".
- **Qué pasa después:** Programa anual autorizado. Termina el instructivo IDT-002. El año operativo arranca con la selección mensual.
- **Aprobación:** **Punto de autorización terminal anual: DC autoriza** FOR-001/FOR-002/FOR-003.

---

#### FASE B — Selección mensual (día 15 de cada mes) · Instructivo ASK-CEM-IDT-003

**Paso 10 — Reunión mensual de selección de hospitales**
- **Quién lo hace:** GG con los GV (Gerentes de Ventas).
- **Qué hace:** Reunión para seleccionar los hospitales de los próximos 45 días, con base en FOR-002 y FOR-003. Reglas de selección (todas literales de §5.1.2):
  - *"Priorizan hospitales en función de su valor de mercado y su ubicación geográfica."*
  - *"Agrupa hospitales por zonas geográficas para que, en un mismo viaje foráneo, el ejecutivo de ventas visite varios hospitales y programe mínimo 4 hospitales para taller médico."*
  - *"Se deben programar al menos 64 talleres en el mes en IMSS y la misma cantidad en Descentralizados."*
  - *"La cuota de talleres por especialista de producto es de al menos 4 hospitales y 6 talleres por semana."*
  - *"En el mes se pueden programar hasta 3 viajes foráneos por especialista por mes."*
  - *"En caso que la operación lo demande, se pueden hacer más viajes foráneos en el mes. Esto se documentará…"*
  - *"Seleccionan de manera preferente, hospitales en los cuales aún no se han hecho talleres en el año. En los que ya se han realizado, se priorizará aquellos en los que ha pasado más tiempo desde el último taller."*
- **Por qué se hace así:** Cadencia fija — *"Realiza reunión los días 15 de cada mes, con los Gerentes de Ventas para seleccionar los hospitales que se visitarán en los próximos 45 días calendario. Nota: en caso de que el día 15 no se labore, la reunión se llevará a cabo el siguiente día laboral"* (§5.1.1). El alcance confirma el horizonte: *"seleccionar mensualmente los hospitales que serán visitados en los próximos 45 días calendario"* (§2 Objetivo).
- **Qué pasa después:** GG firma los formatos de cada gerencia.
- **Aprobación:** No aquí (la firma va en el paso 11).

**Paso 11 — Firma de FOR-004 "Selección de Hospitales para Talleres Médicos"**
- **Quién lo hace:** GG firma; solicita a cada GV que firme su formato.
- **Qué hace:** Completa y firma el **FOR-004** (Anexo 1 de IDT-003), con columnas: Región, Hospital, Estado, Ciudad/Municipio, Ejecutivo, Producto a promocionar, Observaciones; bloque Elaboró/Revisó/Autorizó (`Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md`, Anexo 1; y `Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md`).
- **Por qué se hace así:** *"Al final de la reunión firma los formatos de cada gerencia y solicita a los Gerentes de ventas que firmen su respectivo formato"* (§5.1.3).
- **Qué pasa después:** GV notifica a sus EV.
- **Aprobación:** **Firma operativa de FOR-004: GG + GV.**

**Paso 12 — Notificación a los Ejecutivos de Ventas**
- **Quién lo hace:** GV → EV.
- **Qué hace:** GV envía por **correo electrónico** a sus EV, anexando FOR-004, indicando qué hospitales visitar.
- **Por qué se hace así:** *"Notifica por correo electrónico los días 15 de cada mes a los ejecutivos de Ventas a su cargo, los hospitales que deberán visitar. Anexa el formato 'ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos'"* (§5.2.1).
- **Qué pasa después:** EV agenda y ejecuta la visita de promoción.
- **Aprobación:** No.

**Paso 13 — Visita al hospital para promover el taller y llenado de FOR-005**
- **Quién lo hace:** EV (Ejecutivo de Ventas).
- **Qué hace:** Visita los hospitales asignados, se reúne con el **Jefe de servicio de Anestesia** y ejecuta el **Speech** (ASK-CEM-ANE-001). Si el hospital acepta el taller, registra en **FOR-005 "Matriz de Talleres Médicos"** los campos: *"1. Gerencia: IMSS o Descentralizados · 2. Región · 3. Hospital · 4. Estado · 5. Ciudad/Municipio · 6. No. de participantes · 7. Nombre del ejecutivo · 8. Fecha de taller · 9. Hora del taller médico · 10. ¿Requiere equipo de proyección? · 11. Nombre del Producto · 12. Cantidad (piezas) de producto"* (§5.2.2). Envía FOR-005 al GV.
- **Por qué se hace así:** Es el mecanismo documentado de captura y el punto de decisión del hospital — el diagrama del proceso maestro modela la bifurcación *"¿Acepta taller?"* con salidas "Acepta" → registra en plataforma/Matrix, y "No acepta" → *"Notifica al GV para que reagende la visita para ofrecer el taller médico"* (`Procesos/Talleres Médicos en Hospitales.md`, nodos P2D/P2E/P2F).
- **Qué pasa después:** GV revisa y concentra la Matriz.
- **Aprobación:** No (decisión del hospital, no firma corporativa).

> **Nota de campo (2026-08-10):** El instructivo IDT-003 (v02, 2024) documenta que solo el **EV** captura FOR-005. En la operación real actual, **ambos roles capturan hospitales**: el EV (vendedor) carga unos y el EP (educador) carga otros. La captura no es exclusiva del EV. (Fuente: entrevista con el área; no reflejada en los instructivos vigentes.)

**Paso 14 — Concentración de FOR-005 y envío al AEM**
- **Quién lo hace:** GV.
- **Qué hace:** Revisa las matrices que recibe; si hay errores, contacta al EV para corregir; si todo está bien, las **concentra en una sola matriz**, la **firma** y la envía por correo al AEM.
- **Por qué se hace así:** *"Recibe por correo electrónico los formatos 'Matriz de Talleres Médicos' y los revisa. Si todo está bien los concentra en una sola matriz, firma el formato y lo envía por correo electrónico el día 15 de cada mes al Auxiliar Administrativo de Educación Médica. De lo contrario contacta al Ejecutivo de Ventas para corregir la información registrada en el formato."* (§5.2.3). Es el **fin del instructivo IDT-003** ("Termina instrucción").
- **Qué pasa después:** El AEM inicia el ciclo de costeo, viáticos y materiales.
- **Aprobación:** **Firma operativa de FOR-005: GV** (concentrado).

---

#### FASE C — Programación, costos, viáticos y materiales (día 15→20+) · Instructivo ASK-CEM-IDT-004

**Paso 15 — Recepción de FOR-005, registro de costos y elaboración del Calendario (FOR-006)**
- **Quién lo hace:** AEM (Auxiliar Administrativo de Educación Médica).
- **Qué hace:** El **día 15** recibe FOR-005 firmada por GV y: (1) registra los costos totales en FOR-005 de *"1.1 Muestras de Producto · 1.2 Folletos · 1.3 Gastos de envío · 1.4 Box lunch"*; (2) envía FOR-005 al CA para revisión; (3) el **día 17** elabora el **FOR-006 "Calendario de Talleres Médicos"** y lo envía por correo a GV, EP y GG.
- **Por qué se hace así:** *"Recibe el día 15 de cada mes, por correo electrónico la Matriz de Talleres Médicos firmada por los Gerentes de Ventas y realiza las siguientes actividades… Realiza calendario de Talleres Médicos los días 17 de cada mes y lo envía por correo electrónico a los Gerentes de ventas, Especialistas de producto y al Gerente General"* (§5.1).
- **Qué pasa después:** CA revisa los costos.
- **Aprobación:** No.

**Paso 16 — Revisión de costos por Coordinador Administrativo**
- **Quién lo hace:** CA (Coordinador Administrativo).
- **Qué hace:** Recibe FOR-005 y revisa que los costos cumplan las políticas. Si hay desviación, regresa al AEM; si está correcto, **firma** la Matriz y la envía a DC.
- **Por qué se hace así:** *"Recibe la matriz y revisa que todos los costos estén de acuerdo a las políticas establecidas. Si todo está bien firma la Matriz y la envía inmediatamente por correo electrónico a Dirección Corporativa para su autorización"* (§5.2).
- **Qué pasa después:** DC autoriza (o no) la Matriz.
- **Aprobación:** **Firma de FOR-005: CA** (revisión de costos).

**Paso 17 — Autorización de la Matriz por DC y devolución al AEM**
- **Quién lo hace:** DC → AEM.
- **Qué hace:** DC revisa y autoriza FOR-005. CA la devuelve autorizada al AEM.
- **Por qué se hace así:** Plazo y SLA explícitos — *"Envía por correo electrónico a más tardar el día 20 de cada mes, la Matriz autorizada al Auxiliar Administrativo de Educación Médica"* (§5.2).
- **Qué pasa después:** AEM dispara tres sub-flujos paralelos (material, box lunch, viáticos).
- **Aprobación:** **Punto de autorización mensual: DC autoriza** FOR-005 (Matriz). Corresponde a la Fase 3 del proceso maestro — *"AEM:… Obtiene autorización de GG, Coordinador Administrativo y Dirección Corporativa"* y *"Una vez autorizada la Matriz, genera los viáticos y obtiene autorización de GG, CA y DC"* (`Procesos/Talleres Médicos en Hospitales.md`, Fase 3, nodos P3A/P3B).

**Paso 18 — Solicitud de material, viáticos y pago de box lunch (AEM)**
- **Quién lo hace:** AEM.
- **Qué hace:** Una vez autorizada la Matriz: (1) envía FOR-005 al **Tesorero** para programar el pago de box lunch; (2) solicita por correo al **CA** el material para el Taller Médico (anexa la Matriz); (3) actualiza el Calendario (FOR-006) y lo envía al EP y al CA; (4) solicita los **viáticos** según el instructivo **ASK-GGE-IDT-001** *"Solicitud y aprobación de viáticos"*.
- **Por qué se hace así:** Literales de §5.3: *"Envía por correo al Tesorero la Matriz para que programe el pago del box lunch"*, *"Solicita por correo al Coordinador Administrativo el material para Taller Médico"*, *"Actualiza el calendario de los talleres médicos"*, *"Solicita los viáticos de acuerdo a lo establecido en la instrucción de trabajo ASK-GGE-IDT-001"*.
- **Qué pasa después:** CA procesa el pedido interno (paso 19); arranca el ciclo de pago de box lunch (paso 20).
- **Aprobación:** No (las autorizaciones de viáticos son parte de ASK-GGE-IDT-001, fuera del alcance de este proceso).

**Paso 19 — Pedido interno de material (CA → Aux. Almacén)**
- **Quién lo hace:** CA.
- **Qué hace:** Genera el **"Pedido interno"** con la información de FOR-005, lo **firma**, lo envía por correo al **Auxiliar Administrativo de Almacén** anexando la Matriz firmada por DC, y da seguimiento a la entrega del material al AEM.
- **Por qué se hace así:** §5.4 íntegro: *"Genera el formato 'Pedido interno'… Firma el formato. Envía el formato por correo electrónico al Auxiliar Administrativo de Almacén. Anexa la Matriz firmada por Dirección. Da seguimiento a la entrega del material al Auxiliar Administrativo de Educación Médica."*
- **Qué pasa después:** El material llega al AEM.
- **Aprobación:** **Firma del Pedido interno: CA.**

**Paso 20 — Ciclo semanal de pago de box lunch**
- **Quién lo hace:** Auxiliar de Pagos → DC (autoriza) → Tesorero Corporativo → Auxiliar de Pagos → AEM.
- **Qué hace:** El Auxiliar de Pagos **programa semanalmente** los pagos de box lunch en el formato **ASK-TES-FOR-001 "Depósito box lunch para Talleres Médicos IMSS y Descentralizados"** (registra: periodo de la semana, depositar a —proveedor o EV—, monto, fecha, ejecutivo que comprueba). Envía al Tesorero Corporativo; los **martes** presenta el importe a **DC** para autorización; tras la reunión, reenvía el formato autorizado al Tesorero, copiando al Gerente de Administración y Finanzas y al Auditor Corporativo. El Tesorero verifica, deposita y devuelve comprobantes al Auxiliar de Pagos, quien los reenvía al AEM.
- **Por qué se hace así:** §5.5–5.7. Citation literal de §5.5: *"Presenta los días martes de cada semana a Dirección el importe de box lunch para su autorización. Envía por correo electrónico el día martes, después de la reunión con Dirección, el formato autorizado al Tesorero Corporativo. Copia en el correo al Gerente de administración y finanzas y al Auditor Corporativo."*
- **Qué pasa después:** Comprobantes de depósito llegan al AEM (para la comprobación del EV).
- **Aprobación:** **Punto de autorización semanal: DC autoriza** el importe de box lunch (martes).

**Paso 21 — Recepción del material y armado de paquetes**
- **Quién lo hace:** AEM.
- **Qué hace:** Recibe el material y **firma de recibido en la Orden de Remisión**. Forma paquetes con: *"1. Producto · 2. Folletos · 3. Registro de asistencia · 4. Dulces · 5. Computadora y/o proyector en caso de aplicar"* (§5.8).
- **Por qué se hace así:** §5.8 íntegro.
- **Qué pasa después:** Coordina la entrega al EV según modalidad.
- **Aprobación:** **Firma de recibido en Orden de Remisión: AEM.**

**Paso 22 — Entrega de material (CDMX 4:30–6:30 p.m. / foránea 7 días con carta porte)**
- **Quién lo hace:** AEM (coordina) → EV (recibe).
- **Qué hace:** Dos modalidades, ambas regladas:
  - **CDMX y área metropolitana:** *"informa a los Ejecutivos de Ventas y a los Gerentes de Ventas para la entrega del material del taller Médico en un horario de 4:30 a 6:30 de la tarde"* (§5.8, modalidad 1).
  - **Foránea:** AEM se presenta en la sucursal del proveedor de paquetería y *"envía los paquetes 7 días calendario antes del Taller Médico"*; además *"Envía 7 días calendario antes del Taller por correo electrónico al Ejecutivo de Ventas: (1) Carta porte, (2) Número de piezas que van por paquete, (3) Fecha de cuando puede recoger los paquetes"* (§5.8, modalidad 2). Excepción documentada: *"Para la opción foránea, si el número de equipos es de 5 o menos, se los puede llevar el Especialista de producto; de lo contrario se requerirán los servicios del proveedor de paquetería"* (Nota de §5.8).
- **Por qué se hace así:** Reglas textuales de §5.8 arriba.
- **Qué pasa después:** El EV recibe y verifica.
- **Aprobación:** No (la firma del EV va en el paso 23).

**Paso 23 — Recepción del material y firma de FOR-007**
- **Quién lo hace:** EV.
- **Qué hace:** Recibe y verifica *"1. Cantidad y condiciones de los productos. 2. En caso de aplicar, funcionamiento adecuado del equipo de cómputo y audiovisual"* (§5.9). Si todo está bien, **firma** el **FOR-007 "Material para Talleres Médicos"** y lo entrega al AEM. En modalidad foránea, envía copia firmada por correo **el mismo día**. El FOR-007 registra por renglón: Fecha, Hospital, Cargo/Puesto, Nombre del Producto, Cantidad de Producto, Lista de asistencia (Sí/No), Flayers, Equipo de cómputo (Sí/No), Proyector (Sí/No), Dulces (Sí/No), Modelo anatómico (Sí/No), Observaciones (`Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos.md`).
- **Por qué se hace así:** §5.9 íntegro y nota: *"En caso de talleres foráneos, si el Ejecutivo indica que no recibió la totalidad de los recursos y materiales, el Auxiliar Administrativo de Educación Médica en conjunto con el Coordinador Administrativo realizan las acciones pertinentes para que el material esté completo un día antes del taller."* **Termina el instructivo IDT-004**.
- **Qué pasa después:** Material en poder del EV; arranca la fase de impartición.
- **Aprobación:** **Firma operativa de FOR-007: EV** (recibe material).

---

#### FASE D — Impartición (día del taller) · Instructivo ASK-CEM-IDT-005

**Paso 24 — Confirmación de la cita y preparación logística (víspera)**
- **Quién lo hace:** EV.
- **Qué hace:** **Un día antes del taller:** confirma cita (lugar, n.º de asistentes, horario); si hay cambio, lo notifica al EP por teléfono; coordina con el proveedor la entrega del **box lunch** en el hospital, o si no hay proveedor, compra los insumos y prepara los box lunch. Antes de salir, revisa el paquete: *"(1) Producto, (2) Folletos, (3) Registro de asistencia, (4) Proyector (si aplica), (5) Box lunch completos (si aplica)"* (§5.1.1).
- **Por qué se hace así:** §5.1.1 íntegro: *"Un día antes del taller Médico (EV): 1. Confirma con el contacto la cita y obtiene el lugar, número de asistentes y horario. 2. En caso de cambio, notifica inmediatamente por teléfono al especialista de producto…"*.
- **Qué pasa después:** EV acude al hospital.
- **Aprobación:** No.

**Paso 25 — Revisión de material del Especialista (EP)**
- **Quién lo hace:** EP.
- **Qué hace:** Antes de salir verifica: *"(1) Modelo anatómico, (2) Botella de agua de 250 ml para el funcionamiento del modelo anatómico, (3) Computadora con pila cargada, (4) Presentación, (5) Apuntador laser"* (§5.1.2).
- **Por qué se hace así:** §5.1.2 íntegro.
- **Qué pasa después:** EV y EP acuden juntos al hospital.
- **Aprobación:** No.

**Paso 26 — Llegada (1 h antes), montaje y prueba**
- **Quién lo hace:** EV + EP (llegada); EV (montaje); EP (prueba).
- **Qué hace:** Se presentan **1 hora antes** del inicio, piden acceso a la sala/auditorio. EV notifica por **WhatsApp** al GV. EV organiza la sala (prepara dispositivos/materiales promocionales, montaje, acomoda y **fotografía** los box lunch, prepara **FOR-008**). EP prueba cómputo/audiovisual, revisa presentación y prepara el modelo anatómico (§5.1.3–5.1.5).
- **Por qué se hace así:** *"El día del taller, se presentan en conjunto, 1 hora antes del inicio… El EV notifica por WhatsApp al Gerente de ventas que ya se encuentra en el lugar y con el contacto"* (§5.1.3); *"Acomoda los box lunch y les toma fotos"* (§5.1.4).
- **Qué pasa después:** Reciben a los asistentes.
- **Aprobación:** No.

**Paso 27 — Recepción de participantes, registro y box lunch (FOR-008)**
- **Quién lo hace:** EP (bienvenida) + EV (box lunch).
- **Qué hace:** EP da la bienvenida y pide a los asistentes que se registren en **FOR-008 "Registro de Asistencia"** (campos: Nombre, Puesto, Teléfono celular, Correo electrónico, Firma; encabezado con Fecha, Hora de inicio/fin, Tema, Nombre del Especialista, Institución, Unidad médica, Lugar). EV entrega el box lunch a cada asistente al registrarse y **verifica** que el n.º de asistentes registrados coincida con los presentes.
- **Por qué se hace así:** §5.1.6 y §5.1.7 — *"Recibe y da la bienvenida a los participantes a medida que lleguen y solicita que se registren en el formato 'Registro de Asistencia'"*; *"Entrega el box lunch a cada asistente al momento de realizar su registro de asistencia. Revisa que el número de asistentes registrados en el formato… coincida con el número de asistentes en la sala o auditorio"*.
- **Qué pasa después:** Inicia el taller.
- **Aprobación:** **Firma de cada médico asistente** en FOR-008 (firma individual del participante; guía de llenado campo 13: *"Firma del Médico que se registró"*).

**Paso 28 — Impartición del taller (umbral 80 %, 4 etapas)**
- **Quién lo hace:** EP.
- **Qué hace:** Inicia cuando hay **80 %** de participantes con un speech de bienvenida y la dinámica de **4 etapas**: *"(1) Exposición teórica: se presentará el producto y sus cualidades. (2) Presentación práctica: se demostrará el uso del producto con modelo anatómico. (3) Sesión de preguntas y respuestas… (4) Llenado de encuesta de satisfacción: los asistentes completarán la encuesta al finalizar"* (§5.2.1). La presentación del producto dura **máximo 15 minutos**: *"Realiza la presentación del producto (duración máxima 15 min)"* (§5.2.2). La encuesta de satisfacción se llena vía **código QR** del área de Calidad: *"Solicita a los asistentes llenar la encuesta de satisfacción compartiendo el código QR proporcionado por el área de Calidad"* (§5.2.2).
- **Por qué se hace así:** *"Una vez que se cuente con el 80% de los participantes, inicia el taller médico"* (§5.2.1).
- **Qué pasa después:** EP se despide; EV cierra la logística.
- **Aprobación:** No (la satisfacción se captura por encuesta QR, no por firma).

**Paso 29 — Cierre logístico y evidencias**
- **Quién lo hace:** EV.
- **Qué hace:** Recoge y resguarda equipo y materiales (si es foráneo, los resguarda para el siguiente taller); toma **fotografías del taller como evidencia** y las envía por correo al AEM **anexando FOR-008**.
- **Por qué se hace así:** *"Toma fotografías del taller como evidencia y las envía por correo electrónico al Auxiliar Administrativo de Educación Médica, anexando el 'Registro de Asistencia'"* (§5.2.2). Corresponde al nodo P4E del proceso maestro: *"EV: Realiza Ficha técnica de los Hospitales y la envía al AEM. Anexa: lista de asistencia y lista de entrega de producto"* (`Procesos/Talleres Médicos en Hospitales.md`).
- **Qué pasa después:** Cierre presencial con el Jefe de Servicio.
- **Aprobación:** No.

**Paso 30 — Cierre con el Jefe de Servicio**
- **Quién lo hace:** EV + EP con el **Jefe de Servicio**.
- **Qué hace:** EV presenta al EP (si aplica); notifican incidencias; entregan **muestras de producto** al Jefe de Servicio; si sobran, entregan también box lunch y/o folletos; agradecen el apoyo y se retiran. *"Termina instrucción"* (IDT-005).
- **Por qué se hace así:** §5.2.3 completo: *"Notifican cualquier incidencia ocurrida durante el taller. 3. Entregan muestras del producto al Jefe de servicio; si sobran, también entregan box lunch y/o folletos."*
- **Qué pasa después:** El AEM cierra el ciclo con el registro y los indicadores.
- **Aprobación:** No formal (entrega de muestras sin formato de firma explícito en este paso — la entrega de producto se documenta en FOR-007 y FOR-008).

---

#### FASE E — Cierre, evidencias e indicadores · `Procesos/Talleres Médicos en Hospitales.md` (Fase 5)

**Paso 31 — Recepción de documentación, registro y elaboración de indicadores**
- **Quién lo hace:** AEM.
- **Qué hace:** Recibe la documentación (FOR-008, fotografías, lista de entrega de producto), la registra en la base de datos y elabora los indicadores. Envía la BD por correo a **CEM, GV y GG**.
- **Por qué se hace así:** Del diagrama del proceso maestro: *"AEM: Recibe documentación, la registra en la base de datos y elabora indicadores. Envía BD por correo a: CEM, Gerentes de Ventas y Gerente General"* (`Procesos/Talleres Médicos en Hospitales.md`, Fase 5, nodo P5A).
- **Qué pasa después:** El CEM presenta los indicadores.
- **Aprobación:** No.

**Paso 32 — Presentación semanal de indicadores a GG y DC**
- **Quién lo hace:** CEM → GG + DC.
- **Qué hace:** Presenta **semanalmente** los indicadores: *"1. No. talleres realizados vs. programados. 2. No. de producto entregado. 3. Resultados de satisfacción de los talleres. 4. No. de médicos que acudieron al taller. 5. No. de médicos adscritos. 6. No. de médicos residentes"* (`Procesos/Talleres Médicos en Hospitales.md`, Fase 5, nodo P5B).
- **Por qué se hace así:** *"CEM: Presenta semanalmente a GG y DC los indicadores"* (P5B).
- **Qué pasa después:** **FIN del ciclo** de un taller. El proceso regresa a la Fase B el siguiente día 15 para la nueva selección mensual, y trimestralmente se revisa el avance del programa anual (Nota de IDT-002).
- **Aprobación:** No es firma; es **punto de seguimiento/reporte** a la autoridad (GG+DC).

### 4.4 Formularios usados (FOR-002 a FOR-008) — quién los llena y quién los firma

> Todos los formularios controlados llevan a pie de página el bloque **Elaboró (Analista de Métodos y Procedimientos) / Revisó (Gerente de Calidad + Gerente General) / Autorizó (Director Corporativo)**. Esa es la firma del *documento controlado*. En la columna **"Firma operativa (contenido)"** se indica quién firma el *contenido* durante la operación.

| Código | Nombre | Para qué sirve (qué captura) | Quién lo llena (operativamente) | Firma operativa (contenido) | Cita fuente |
|--------|--------|------------------------------|--------------------------------|------------------------------|-------------|
| **FOR-002** | Base de Datos de Hospitales (para Talleres Médicos) | Filtra y registra los hospitales objetivo del año: CLUES, Estado, Municipio, Clave Institución, Nombre, N.º de quirófanos, y anestesias (Totales `AT=NQ×2.5×250`, Generales `30%`, Regionales `70%`, Epidurales `35%` de AR, Subdurales `45%` de AR, Mixtas obesos `2%` de AR, mixtas no obesos `18%` de AR) | GV en la reunión anual (3ª sem nov), con EE y CEM | Firma GG + GV "de conformidad" | `Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales.md`; `Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md` §5.3 |
| **FOR-003** | Programa Anual de Talleres Médicos | Programa anual: Definición, Inicio/Fin (periodo), Gerencia, Hospitales Objetivo (con/sin Sia), N.º de hospitales, Meta (`= N.º hospitales × 1.5`), **productos a promocionar** (R-III, R-II, R-I, B-27G, B-22G, T marcados con "x"), Total, y resumen de capacidad (semanas de trabajo, talleres/semana, talleres/especialista, especialistas necesarios/disponibles/a contratar) | Equipo en la reunión anual (GV + GG + CEM + EE) | Firma GG + GV; autorización DC | `Formularios/ASK-CEM-FOR-003 Programa Anual de Talleres Médicos.md`; `Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md` §5.3 |
| **FOR-004** | Selección de Hospitales para Talleres Médicos | Selección mensual: No., Región, Hospital, Estado, Ciudad/Municipio, Ejecutivo, Producto a promocionar, Observaciones; bloque Elaboró/Revisó/Autorizó | GV (contenido) en la reunión del día 15 | **GG firma** y **GV firma** su formato | `Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md`; `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` §5.1.3 y Anexo 1 |
| **FOR-005** | Matriz de Talleres Médicos | Planeación logística y **costos** de cada taller: No., Región, Hospital, Estado, Ciudad/Municipio, **No. de participantes**, Ejecutivo, Fecha, Hora, ¿Equipo proyección? (Sí/No; propio/rentado), Producto (muestras), Cantidad piezas, Folletos (cant. + costo unit.), Envío (interno/externo + costo), Box lunch (n.º servicios + costo unit.); y tabla "Costo por Recurso Solicitado" con **Costo Total** | EV captura los datos de la visita (datos 1–12 de §5.2.2); AEM agrega los costos | **GV firma** el concentrado; **CA firma** revisión de costos; **DC autoriza** | `Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md`; `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` §5.2.2; `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.1–5.2 |
| **FOR-006** | Calendario de Talleres Médicos | Agenda mensual por semana: Ciudad, Especialista asignado, y por día (Lun–Dom) el EV/Hospital/fecha-hora que visita | AEM (elabora el **día 17** de cada mes) | Sin bloque de firma operativa explícito en el formato (lo cita el IDT-004 §5.1; a pie de página firma el Elaboró/Revisó/Autorizó del documento controlado) | `Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md`; `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.1 *"Realiza calendario de Talleres Médicos los días 17 de cada mes"* |
| **FOR-007** | Material para Talleres Médicos | Acuse del material entregado al EV por taller: Fecha, Hospital, Cargo/Puesto, Nombre del Producto, Cantidad, Lista de asistencia (Sí/No), Flayers, Equipo de cómputo (Sí/No), Proyector (Sí/No), Dulces (Sí/No), Modelo anatómico (Sí/No), Observaciones; línea "Nombre y Firma del Ejecutivo que recibe" | AEM lo prepara; EV verifica | **Firma el EV** al recibir; foráneo: envía copia firmada el mismo día | `Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos.md`; `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.9 |
| **FOR-008** | Registro de Asistencia | Lista de asistencia al taller: encabezado (Fecha, Hora inicio/fin, Tema, Institución, Unidad médica, Lugar, Especialista, Ejecutivo) + tabla por asistente (Nombre, Puesto, Teléfono, Correo, Firma) + Observaciones (marca médico líder positivo/negativo) | EP/EV facilitan el llenado durante el registro | **Firma cada médico asistente** (guía de llenado, campo 13) | `Formularios/ASK-CEM-FOR-008 Registro de Asistencia.md`; `Instructivos/Impartición de Talleres Médicos.md` §5.1.4, §5.1.6–5.1.7, §5.2.2 |

**Otros formatos referenciados** (no solicitados en el alcance, pero citados por los instructivos): **FOR-001** Base de datos de Hospitales del Sistema Público de Salud (la llena el EE, paso 7); **ASK-CBA-FOR-001** Plantilla de Presentación Asokam (la usa el DIG, paso 2); **ASK-TES-FOR-001** Depósito box lunch (la llena el Auxiliar de Pagos, paso 20); **ASK-CEM-ANE-001** Speech para promover el Taller Médico (lo usa el EV, paso 13); **Pedido interno** y **Orden de Remisión** (sin código propio, pasos 19 y 21).

### 4.5 Observaciones finales y vacíos documentados

- **CQ / TECNO (Control de Quejas / Tecnovigilancia):** **no intervienen** en ningún paso del proceso ASK-CEM-DDP-001. La única aparición de "quejas" es como **tema obligatorio de la presentación** (IDT-001 §5.1, "6. Atención de quejas") y como **eje de un indicador** del producto, no como actor del flujo. Las incidencias que ocurran *durante* el taller se "notifican" al Jefe de Servicio (IDT-005 §5.2.3) pero el instructivo **no documenta** un handoff formal a CQ/TECNO.
- **Ficha técnica del hospital:** el diagrama del proceso maestro menciona *"EV: Realiza Ficha técnica de los Hospitales y la envía al AEM"* (nodo P4E), pero **ningún instructivo** detalla el formato/código de esa ficha técnica ni sus campos. **No documentado**.
- **FOR-006 (Calendario):** el formato **no incluye bloque de firma operativa** explícita (solo el de documento controlado). Quién firma/aprueba el calendario como tal es **no documentado** de forma explícita.
- **Reunión GG+GV del día 15:** el proceso maestro (nodo P2A) describe que el CEM *"Presenta a GG y DC para aprobación"* y *"Envía programa al GV IMSS y Descentralizados"*, mientras que IDT-003 (la versión vigente, v02) coloca la reunión mensual como **GG + GV** sin CEM presente. Esta leve discrepancia entre el proceso maestro (v02, 02-feb-2024) y el instructivo IDT-003 (v02, 24-abr-2024) **no está reconciliada** en las fuentes; asumo como vigente lo de IDT-003 (más reciente y específico).
- **Toda la operación es papel + correo electrónico:** no se menciona sistema transaccional; el "registro en plataforma Forms" aparece en el nodo P2E del diagrama maestro, pero IDT-003 (v02) lo reescribe como captura directa en FOR-005. El resguardo documental controlado vive en **Quality Web** (IDT-001 §5.7).

### 4.6 Mapa de archivos fuente leídos (ruta relativa bajo `lefarma.docs/educacion-medica/referencias/pdf-to-md/`)

- `Procesos/Talleres Médicos en Hospitales.md` — proceso maestro ASK-CEM-DDP-001 v02
- `Roles/Roles y Abreviaturas.md` — glosario de actores
- `Instructivos/Preparación y Autorización de Material de Talleres Médicos.md` — ASK-CEM-IDT-001 v02 (Fase A1)
- `Instructivos/Elaboración del Concentrado Anual de Talleres Médicos.md` — ASK-CEM-IDT-002 v02 (Fase A2)
- `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` — ASK-CEM-IDT-003 v02 (Fase B)
- `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` — ASK-CEM-IDT-004 v01 (Fase C)
- `Instructivos/Impartición de Talleres Médicos.md` — ASK-CEM-IDT-005 v01 (Fase D)
- `Formularios/ASK-CEM-FOR-002 … 003 … 004 … 005 … 006 … 007 … 008 *.md` — formatos operativos (Fases A2, B, C, D)

---

## 5. Reglas de la digitalización (TO-BE)

Esta es la **sección central**: las reglas de negocio que el módulo implementa (algunas heredadas del papel, otras nuevas de la operación real o de la digitalización). Los valores marcados _(configurable)_ se ajustan en cualquier momento sin tocar código (§7).

### 5.1 Captura de hospitales — EV y EP

- **Ambos roles capturan hospitales**: el **EV** (vendedor) y el **EP** (educador).
- **⚠️ Discrepancia con el papel:** el instructivo IDT-003 (v02, 2024) documenta que **solo el EV** captura FOR-005 (`Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md`). En la **operación real actual ambos roles capturan**; la captura no es exclusiva del EV. El módulo refleja la operación real, no el papel.

### 5.2 Capacidad por persona _(configurable)_

| Regla | Valor |
|-------|-------|
| Máximo de visitas/día por persona | **3** _(configurable)_ |
| Máximo de visitas/semana por persona | **8** _(configurable)_ (a la vez objetivo y techo) |

### 5.3 Pareo EV + EP

- Cada visita/ruta **empareja 1 vendedor (EV) + 1 educador (EP)**. El módulo gestiona las tablas de pareo.

### 5.4 Distribución por zonas

- Se **agrupan los hospitales de la misma zona por persona** para minimizar desplazamiento.
- Las **salidas y llegadas deben caer dentro del horario laboral**.
- Las zonas de visita se **calculan por GPS** (§5.8), no se heredan del catálogo.

### 5.5 Propuesta del sistema → corrección humana (draft→select)

- **El sistema propone una distribución draft (optimizada)** respetando capacidad (§5.2), pareo (§5.3) y zonas (§5.4).
- **Los humanos seleccionan/corrigen** la asignación final. El sistema no asigna en automático; propone.

### 5.6 Contenido de cada taller / visita

Cada taller lleva:

- **Box lunch**
- **Folletos**
- **Productos + cantidad** (muestras)
- **Equipo de proyección** (propio o rentado)

> Fuente: `Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — recursos producto + folleto + gastos de envío + box lunch; `ASK-CEM-FOR-007` — checklist de material.

### 5.7 Cuotas de sesiones _(configurable)_

| Regla | Valor |
|-------|-------|
| Total mensual | **~128 sesiones/mes** _(configurable en cualquier momento)_ |
| Split por institución | IMSS / ISSSTE / Otros — **todos configurables** |

> **Nota de reconciliación:** el instructivo IDT-003 cita *"al menos 64 talleres en el mes en IMSS y la misma cantidad en Descentralizados"* (`Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md`), es decir, 64 + 64 = 128. La digitalización **no fija defaults por institución**: 128 es el total configurable y el reparto IMSS/ISSSTE/Otros se parametriza. No se inventan valores por segmento.

### 5.8 Clasificación por institución (derivable de Asokam)

La clasificación **se deriva de la jerarquía** de `genContactosCat.codigoContactoPrincipal` → contactos institucionales padre:

| codigoContactoPrincipal | Institución | Unidades hijas |
|--------------------------|-------------|----------------|
| **364** | IMSS | 79 |
| **370** | ISSSTE | 8 |
| **385** | Bienestar | 4,225 |

La **lógica de clasificación YA EXISTE** en `dbo.vwDiarioDeVentas` (`CASE ClienteAgrupado`):

| Condición | Clasificación |
|-----------|---------------|
| `codigocontacto = 364` | IMSS |
| `codigocontacto = 385` | Bienestar |
| `codigocontacto = 370` | ISSSTE |
| `tipoventaprivado = 'SIA IMSS'` | SIA IMSS |
| `tipo = 'Gobierno'` AND `codigoOportunidad <> 0` | Instituciones |
| `tipo = 'Gobierno'` | Descentralizado |
| (else) | Privado |

**El módulo REUTILIZA esta lógica**; no la reimplementa desde cero.

### 5.9 Zonas de visita (calculadas, no heredadas)

- `genContactosCat.zona` está **97.6% vacío** → inutilizable.
- Las **zonas de visita se CALCULAN** vía **clustering GPS** sobre `latitud` / `longitud` (que están **100% poblados**).

### 5.10 Roles EV/EP y equipos (module-owned)

Asokam **NO** tiene fuerza de ventas:

- `app.Roles` es solo admin/finanzas; 105/111 usuarios son "Usuario Estandar".
- `app.Usuarios.Puesto` está **100% "Sin asignar"**.
- `crmEquipoVentasCat` está **vacío / no confiable**.

→ El módulo **crea su propia** distinción de roles (**EV / EP / GV**) y las tablas de pareo EV+EP, con **FK lógica → `app.Usuarios.IdUsuario`**.

---

## 6. Modelo de datos y dependencias del legacy (Asokam)

Investigación de la BD Asokam (2026-08-10): el módulo es **más greenfield de lo asumido**. Asokam da identidad de hospitales/productos/usuarios, pero **no** las dimensiones de negocio. El diseño técnico vive en [[decisiones/00001_esquema-datos-educacion-medica]].

### 6.1 Heredado de Asokam (FK lógica, reutilizable)

- `dbo.genContactosCat` — identidad del hospital (`codigoContacto`), nombre, ciudad, `codigoEstado`, **`latitud/longitud` (100% poblado)**, `clues`.
- `dbo.genProductosCat` — productos.
- `dbo.genEstadosCat` — estados.
- `app.Usuarios` — usuarios (`IdUsuario`).

### 6.2 Creado por el módulo (greenfield — Asokam no lo tiene)

| Dimensión | Estado | Solución |
|-----------|--------|----------|
| Clasificación por institución | ✅ **Derivable** | Jerarquía `codigoContactoPrincipal` + lógica `vwDiarioDeVentas` (§5.8) |
| Zonas de visita | ⚠️ **Calculada** | `genContactosCat.zona` está 97.6% vacío → clustering GPS sobre lat/long (§5.9) |
| Roles EV/EP y equipos | ⚠️ **Module-owned** | `app.Roles` no tiene fuerza de ventas; `crmEquipoVentasCat` vacío → roles y pareo propios (§5.10) |
| SIA, quirófanos | ⚠️ **Module-owned** | No existen en Asokam; columnas propias en `hospital_extension` |
| Tipo de gerencia | ⚠️ **Module-owned** | Catálogo propio `tipo_gerencia` (IMSS / Descentralizado / Privado) |

> **Magnitud:** los hospitales se organizan **jerárquicamente** bajo 3 contactos institucionales padre (IMSS 364 / ISSSTE 370 / Bienestar 385) con miles de unidades hijas (79 / 8 / 4,225). El módulo cura cuáles son sedes reales de taller (UMAE/HGZ) vs almacenes/distribuidores. Detalle técnico: [[decisiones/00001_esquema-datos-educacion-medica]] §1.2.12.

### 6.3 Catálogo — mapeo Educación Médica ↔ Asokam (autoritativo)

| Catálogo Educación Médica | Tabla Asokam |
|---------------------------|--------------|
| Hospitales / Unidades médicas (CLUES) | `dbo.genContactosCat` |
| Usuarios / Ejecutivos / Especialistas | `app.Usuarios` |
| Roles | `app.Roles` + `app.UsuariosRoles` |
| Productos | `dbo.genProductosCat` |
| Equipos de ventas | `dbo.crmEquipoVentasCat` ⚠️ no confiable — vacío |
| Instituciones (IMSS, ISSSTE, SEDESA…) | `dbo.genInstitucionesCat` |
| Gerencias (IMSS / Descentralizado) | `dbo.genGerenciasCat` |
| Regiones × Delegación | `dbo.genRegionesXDelegacionCat` |
| Estados | `dbo.genEstadosCat` |
| Clasificación de clientes (vista) | `dbo.vwDiarioDeVentas` (`CASE ClienteAgrupado`) |

**Fuera de alcance:** `genEstatusEventosCat`, `genTiposEventosCat` (licitaciones), `genUnidadesCompradorasCat` (procurement IMSS).

---

## 7. Parámetros configurables

Consolidado de todos los valores que el área puede ajustar **en cualquier momento** sin tocar código:

| Parámetro | Default referencial | Notas |
|-----------|---------------------|-------|
| Total de sesiones/mes | **~128** | Instructivo IDT-003 cita 64 IMSS + 64 Descentralizados = 128; en el módulo es solo el total configurable |
| Split por institución | IMSS / ISSSTE / Otros | Todos configurables; no hay defaults fijos por segmento |
| Máx visitas/día por persona | **3** | Techo de capacidad diaria |
| Máx visitas/semana por persona | **8** | A la vez objetivo y techo |

---

## 8. Referencias

- Diseño técnico (schema, tablas, endpoints, pantallas, permisos): [[decisiones/00001_esquema-datos-educacion-medica]]
- Proceso fuente: [[referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales]]
- Instructivos: [[referencias/pdf-to-md/Instructivos/]] (IDT-001 a IDT-005: Preparación de Material, Concentrado Anual, Selección Mensual, Solicitud y Entrega de Materiales, Impartición)
- Formularios: [[referencias/pdf-to-md/Formularios/]] (FOR-002 a FOR-008: Base de Datos de Hospitales, Programa Anual, Selección de Hospitales, Matriz, Calendario, Material, Registro de Asistencia)
- Roles y abreviaturas: [[referencias/pdf-to-md/Roles/Roles y Abreviaturas]]
