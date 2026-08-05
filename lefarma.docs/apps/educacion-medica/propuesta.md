# Propuesta — App Educación Médica

> **Estado:** Borrador para revisión
> **Fecha:** 2026-08-05
> **Alcance:** Construcción del módulo Educación Médica end-to-end
> **Documentación fuente:** [`pantallas.md`](./pantallas.md), [`vault/`](./vault/), [`extracted/`](./extracted/)

---

## 1. Resumen ejecutivo

El módulo Educación Médica digitaliza dos procesos de negocio documentados en `ASK-CEM-DDP-001` y `ASK-VEN-DDP-001`:

1. **Talleres Médicos en Hospitales** — ciclo completo: programa anual → selección mensual → matriz → solicitud de materiales → impartición → asistencia → evaluación.
2. **Ventas IMSS** — metas → plan de trabajo → reportes → indicador de cumplimiento.

La spec define **16 pantallas** (`pantallas.md`), 8 roles (DC, GG, GV, EV, EP, AEM, CA, EE) y una matriz de permisos por pantalla. Hoy el frontend solo tiene scaffold (un dashboard placeholder).

**Decisiones clave de esta propuesta:**

- ✅ **Reutilizar catálogos de Asokam** (no duplicar): hospitales (`genContactosCat`), productos (`genProductosCat`), usuarios (`app.Usuarios`), gerencias, etc.
- ✅ **Tablas operacionales nuevas en Lefarma DB**, schema `educacion_medica` (11 tablas).
- ✅ **Arquitectura multi-DbContext** ya establecida en el backend; extender el patrón existente.
- ✅ **Implementación incremental en 3 slices** — no construir 16 pantallas de golpe.

---

## 2. Contexto y verificación

### 2.1 Estado actual del módulo

| Componente | Estado |
|---|---|
| Documentación de negocio (`vault/`) | ✅ Completa (8 instructivos, 8 formularios ASK-CEM/ASK-VEN, 3 diagramas) |
| Spec de pantallas (`pantallas.md`) | ✅ Completa (16 pantallas, matriz de roles) |
| Frontend | ⚠️ Solo scaffold: `EducacionMedicaRoutes.tsx`, `menuItems.tsx`, dashboard placeholder |
| Backend | ❌ No existe `Features/EducacionMedica/` |
| SQL | ❌ No existe schema `educacion_medica` |

### 2.2 Patrones del proyecto a replicar (verificados en código)

La app de referencia es **`rh/`** (no `cxp/`, que es solo mount point). Backend de referencia: `Features/Rh/SolicitudesPersonal/`. Convenciones:

- **Backend (RH, histórico)**: thin Controller → IService + Service (`ErrorOr<T>`) → Repository específico → Entity POCO + EF Configuration. Envelope `ApiResponse<T>={Success,Message,Data,Errors}`. Todos los servicios heredan `BaseService`.
- **Backend (Educación Médica, esta propuesta)**: thin Controller → IService + Service (`ErrorOr<T>`) → **DbContext directo** (sin capa Repository). Ver §3.4.
- **Frontend**: `createAppRoutes({...})` + `SidebarMenuItemConfig[]` + `services/*.api.ts` envolviendo cliente axios central (`shared/api/apiClient.ts`). Páginas CRUD siguiendo `rh/pages/TiposSolicitudList.tsx`.
- **Auth/Permisos**: `DynamicPermissionPolicyProvider` lee `app.Permisos` desde Asokam al vuelo (sin restart). `[HasPermission("x")]` existe pero está **comentado** en controllers — listo para activar.
- **SQL**: `lefarma.database/` con scripts numerados, snake_case, `id_X IDENTITY PK`, `activo`, `fecha_creacion/modificacion`, guards idempotentes.

### 2.3 Correcciones al `AGENTS.md` (verificado en código)

- 🔴 Las policies `RequireAdministrator/RequireManager/RequireFinance` **no existen**. Solo `DynamicPermissionPolicyProvider`.
- 🔴 `[HasPermission(...)]` está **comentado** en los 16 controllers que lo usan.
- 🟡 Las tablas `rh.*` **no están en ningún script SQL** del repo (se crearon off-repo).

---

## 3. Arquitectura propuesta

### 3.1 Multi-DbContext (patrón existente)

El backend ya registra 3 DbContexts en `Program.cs`:

| DbContext | DB (dev) | Hoy mapea |
|---|---|---|
| `ApplicationDbContext` | `LefarmaDev` | Catálogos propios, RH, Operaciones, CxP, Auth影子 |
| `AsokamDbContext` | `AsokamDev` | `app.Usuarios/Roles/Permisos/Sesiones/Documentos` |
| `AsistenciasDbContext` | `AsistenciasDev` | Reloj checador |

Servicios como `VacacionesService` ya inyectan ambos contexts por constructor — **patrón establecido**.

### 3.2 Extensión para Educación Médica

**A. Agregar 4 DbSets read-only a `AsokamDbContext`** (catálogos Asokam):
- `Hospitales` → `dbo.genContactosCat` (4,856 hospitales con CLUES)
- `Productos` → `dbo.genProductosCat` (117 productos)
- `Gerencias` → `dbo.genGerenciasCat` (5 gerencias)
- `EquiposVentas` → `dbo.crmEquipoVentasCat`

Más sus POCOs en `Domain/Entities/Asokam/` y Configurations en `Infrastructure/Data/Configurations/Asokam/`.

**B. Crear feature `Features/EducacionMedica/`** con sub-carpetas por agregado (Talleres, ProgramasAnuales, SeleccionesMensuales). Servicios inyectan `ApplicationDbContext` (tablas operacionales) + `AsokamDbContext` (catálogos) **directamente, sin capa Repository** (ver §3.4).

**C. FKs lógicas cross-DB**: SQL Server no soporta FKs físicas cross-DB. La validación de existencia se hace en el servicio (ej: `_asokamDb.Hospitales.AnyAsync(h => h.CodigoContacto == req.CodigoHospital)`).

### 3.3 Estructura de archivos

```
lefarma.backend/src/Lefarma.API/
├── Domain/
│   ├── Entities/EducacionMedica/         ← NUEVO (Taller, TallerRecurso, ...)
│   └── Entities/Asokam/                  ← EXTENDIDO (Hospital, Producto, Gerencia, EquipoVentas)
├── Infrastructure/Data/
│   ├── Configurations/EducacionMedica/   ← NUEVO
│   ├── Configurations/Asokam/            ← NUEVO (para catálogos nuevos)
│   ├── ApplicationDbContext.cs           ← MODIFICADO (+ DbSets educacion_medica)
│   └── AsokamDbContext.cs                ← MODIFICADO (+ 4 DbSets catálogos)
├── Features/EducacionMedica/             ← NUEVO
│   ├── Talleres/                         (Controller + IService + Service + DTOs)
│   ├── ProgramasAnuales/
│   └── SeleccionesMensuales/
└── Shared/Constants/AuthorizationConstants.cs  ← MODIFICADO (+ Permissions.EducacionMedica.*)

lefarma.database/
├── 027_create_educacion_medica.sql       ← NUEVO (schema + 11 tablas)
└── 028_seed_permisos_educacion_medica.sql ← NUEVO (permisos en app.Permisos)

lefarma.frontend/src/apps/educacion-medica/  (scaffold existe)
├── EducacionMedicaRoutes.tsx             ← MODIFICADO (+ rutas)
├── menuItems.tsx                         ← MODIFICADO (+ entradas)
├── services/educacionMedica.api.ts       ← NUEVO
├── pages/                                ← NUEVO (una por pantalla)
└── components/                           ← NUEVO (modales, tabs)
```

> **Nota:** a diferencia de `Features/Rh/`, Educación Médica **no crea** `Domain/Interfaces/EducacionMedica/` ni `Infrastructure/Data/Repositories/EducacionMedica/`. Ver §3.4.

### 3.4 Sin capa Repository (decisión explícita)

**Decisión:** los servicios de Educación Médica inyectan `ApplicationDbContext` y `AsokamDbContext` directamente. No se crea interfaz `IXxxRepository` ni clase `XxxRepository` por entidad.

**Fundamento técnico:**
1. `DbSet<T>` ya es un Repository y `DbContext` ya es un Unit of Work — envolverlos en otra capa es duplicar la abstracción sin ganancia.
2. Mockear `DbSet` no testea el SQL real. Para tests, usar `EF Core InMemory` o `SQLite in-memory` (mecanismo que el repo ya emplea en `Lefarma.UnitTests`).
3. El proyecto ya tiene `BaseRepository<T>` disponible pero `TipoSolicitudRepository` (RH) no lo hereda — el patrón está instalado a medias y genera archivos anémicos.

**Cuándo sí justifica un Repository (casos honestos, ninguno aplica aquí):**
- Queries complejas reutilizadas por 2+ servicios → extraer como método privado o servicio dedicado.
- Agregado con invariantes que se violan si accedes entidad por entidad → el servicio orquesta.
- Múltiples fuentes de datos → encapsular en servicio, no en repo genérico.

**Tradeoff aceptado:** Educación Médica queda como excepción respecto a `Features/Rh/` (que sí usa repos). Si el equipo lo ve bien, RH puede migrarse después.

**Plantilla del servicio:**

```csharp
public class TallerService : BaseService
{
    private readonly ApplicationDbContext _appDb;
    private readonly AsokamDbContext _asokamDb;

    public TallerService(
        ApplicationDbContext appDb,
        AsokamDbContext asokamDb,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _appDb = appDb;
        _asokamDb = asokamDb;
    }

    public async Task<ErrorOr<TallerResponse>> CreateAsync(
        CreateTallerRequest req, CancellationToken ct)
    {
        // Validación cross-DB directa
        var hospitalExiste = await _asokamDb.Hospitales
            .AnyAsync(h => h.CodigoContacto == req.CodigoHospital, ct);
        if (!hospitalExiste) return CommonErrors.NotFound("Hospital");

        var taller = new Taller(...);
        _appDb.Talleres.Add(taller);
        await _appDb.SaveChangesAsync(ct);
        return await MapToResponse(taller);
    }
}
```

### 3.5 Migraciones de base de datos con DbUp (decisión explícita)

**Decisión:** Las migraciones de schema/data se versionan con [DbUp](https://dbup.github.io/)
(librería .NET, gratis, open source, mantenida hace 15 años), orquestadas desde
`multiappcli.ps1 sql`. NO se usa `dotnet ef migrations` (sigue prohibido por
`AGENTS.md`) ni scripts SQL numerados manualmente.

**Por qué DbUp y no casero:**

| Necesidad | DbUp | Casero PS/.NET |
|---|---|---|
| Tracking por ambiente | ✅ nativo (`app.SchemaVersions` por DB) | A construir |
| Multi-DB / multi-server | ✅ nativo (1 corrida por connString) | A construir |
| Transacciones por script | ✅ `WithTransactionPerScript` | A construir |
| Idempotencia | ✅ nativo (no reaplica) | A construir |
| Drift detection | ⚠️ con `WithScriptFilter` (~30 líneas) | A construir |
| Mantenimiento | Comunidad | Nuestro (semanas) |

**Estructura de archivos (nueva):**

```
lefarma.backend/src/Lefarma.Migrations/      ← proyecto console .NET nuevo
├── Lefarma.Migrations.csproj                  (DbUp-sqlserver 8.0.0)
├── Program.cs                                 (~200 líneas, status/apply/diff/list)
└── migrations.config.json                     (ambientes + routing app→DBs)

lefarma.database/                              ← reorganizada
├── README.md                                  (convención nueva)
├── _shared/{schema,alter,data}/               (aplica a TODAS las DBs)
├── educacion-medica/{schema,alter,data}/      (aplica a Lefarma + Asokam)
├── rh/{schema,alter,data}/                    (aplica a Lefarma)
└── [scripts viejos 000_*..024_*, 06_*, 06B_*]  (no se tocan)

multiappcli.ps1                                ← agregar `sql` al ValidateSet
```

**Naming convention:** `<id>_<fecha>-hora_<app>_<slug>.sql`
- `<id>` 4 dígitos autoincremental global (`0001`, `0002`, ...). Determina el orden de aplicación.
- `<fecha>-hora` `YYYYMMDD-HHMM` — informativa, para histórico.
- `<app>` y `<slug>` redundantes con carpeta + descriptivos.

Ejemplos:
```
0001_20260805-0930_shared_initial-schema-app.sql
0002_20260805-0935_educacion-medica_create-schema.sql
0003_20260806-1045_educacion-medica_create-talleres.sql
```

**Routing app → DBs:** definido en `migrations.config.json` (sección `Routing`).
Cada carpeta de app se aplica solo a las DBs especificadas. Override por script
vía header `-- Target: AsokamDev, LefarmaDev`.

**Comandos disponibles (vía `multiappcli.ps1 sql`):**

```powershell
.\multiappcli.ps1 sql help
.\multiappcli.ps1 sql status dev                          # pendientes en dev
.\multiappcli.ps1 sql status dev --app educacion-medica   # filtrar por app
.\multiappcli.ps1 sql apply  dev                          # aplica TODO pendiente
.\multiappcli.ps1 sql apply-one dev --id 20260805-0935-create-educacion-medica
.\multiappcli.ps1 sql diff qa prod                        # qué tiene QA que prod no
.\multiappcli.ps1 sql list dev                            # ya aplicado en dev
.\multiappcli.ps1 sql tui dev                             # menú interactivo (OGC)
```

**Setup inicial (una sola vez):**

1. `cd lefarma.backend; dotnet build src/Lefarma.Migrations/Lefarma.Migrations.csproj`
2. `Install-Module Microsoft.PowerShell.ConsoleGuiTools -Scope CurrentUser -Force` (para TUI)
3. `.\multiappcli.ps1 sql apply dev` (crea `app.SchemaVersions` + aplica scripts pendientes)

**Lo que DbUp da free:** tracking por DB, multi-server (Asistencias en
`192.168.1.5` sin código extra), idempotencia, transacciones, logging con colores.

**Lo que seguimos manteniendo nosotros (~150 líneas total):** `Program.cs` del
migrador, sub-comando `sql` en `multiappcli.ps1`, TUI con `Out-ConsoleGridView`.

---

---

## 4. Modelo de datos

### 4.1 Catálogos reutilizables de Asokam (read-only)

| Catálogo Educación Médica | Tabla Asokam | Filas | Campo PK |
|---|---|---|---|
| Hospitales / Unidades médicas | `dbo.genContactosCat` | 4,856 | `codigoContacto` |
| Usuarios / Ejecutivos / Especialistas | `app.Usuarios` | — | `IdUsuario` |
| Roles | `app.Roles` + `app.UsuariosRoles` | — | `IdRol` |
| Productos (Raquimix, Tesiakit, etc.) | `dbo.genProductosCat` | 117 | `codigoProducto` |
| Equipos de ventas | `dbo.crmEquipoVentasCat` | 3 | `codigoEquipoCRM` |
| Instituciones (IMSS, ISSSTE, SEDESA…) | `dbo.genInstitucionesCat` | 15 tipos | `codigoInstitucion` |
| Gerencias (IMSS / Descentralizado) | `dbo.genGerenciasCat` | 5 | — |
| Regiones × Delegación | `dbo.genRegionesXDelegacionCat` | 61 | — |
| Estados | `dbo.genEstadosCat` | — | — |
| Unidades compradoras | `dbo.genUnidadesCompradorasCat` | — | — |

`genContactosCat` es LA tabla de hospitales — 76 columnas con `clues`, `delegacion`, `region`, `codigoEstado`, `ciudad`, `latitud/longitud`, `tipo`, `zona`. Cubre todo lo que pide el `ASK-CEM-FOR-002`, salvo los cálculos de anestesias.

### 4.2 Tablas operacionales nuevas en schema `educacion_medica`

11 tablas, distribuidas por proceso del taller:

| # | Tabla | Origen ASK | Tipo | Propósito |
|---|---|---|---|---|
| 1 | `hospital_extension` | FOR-002 | 1:1 extiende `genContactosCat` | Cálculos de anestesias (AT, AG, AR) |
| 2 | `programas_anuales` | FOR-003 | Aggregate | Planificación anual estratégica |
| 3 | `programas_anuales_detalles` | FOR-003 | N:M | Programa × hospital × producto |
| 4 | `selecciones_mensuales` | FOR-004 | Aggregate | Reunión del día 15 |
| 5 | `selecciones_mensuales_hospitales` | FOR-004 | N:M | Selección × hospital |
| 6 | `talleres` | FOR-005 | **Aggregate root** | La "Matriz" del taller |
| 7 | `taller_recursos` | FOR-005 | 1:N | Muestras/folletos/envío/box lunch/equipo |
| 8 | `taller_materiales` | FOR-007 | 1:1 | Solicitud y entrega |
| 9 | `taller_asistencias` | FOR-008 | 1:N | Lista de médicos (hasta 20) |
| 10 | `taller_aprobaciones` | — | 1:N | Flujo Elaboró/Revisó/Autorizó (auditable) |
| 11 | `taller_evidencias` | — | 1:N | Fotos y documentos post-taller |

El DDL completo está en el script `027_create_educacion_medica.sql` (pendiente de crear tras aprobación de esta propuesta).

### 4.3 State machine del Taller (validación en servicio)

```
Borrador → Elaborado → Revisado → Autorizado → Programado → EnCurso → Realizado
                                                                  ↘ Cancelado
```

Cada transición de firma registra en `taller_aprobaciones`: `rol_firma` (Elaboro/Reviso/Autorizo), `codigo_usuario`, `estado` (Pendiente/Firmado/Rechazado), `comentario`, `fecha_firma`.

### 4.4 Decisiones de diseño

| Decisión | Justificación |
|---|---|
| `hospital_extension` 1:1 separada | No invadir `genContactosCat` en Asokam. Si migra, fácil de mergear. |
| Columnas `PERSISTED` para AT/AG/AR | Fórmulas fijas del `ASK-CEM-FOR-002`. La BD las calcula y guarda. |
| `estado` con `CHECK` en `talleres` | State machine explícito; el servicio valida transiciones. |
| `taller_recursos` polimórfico | 1 tabla con `tipo_recurso` en vez de 5 tablas separadas. Menos JOINs. |
| `taller_materiales` UNIQUE en `id_taller` | Garantiza 1:1 sin compartir PK. |
| `taller_aprobaciones` como log | Trazabilidad total de quién firmó qué y cuándo. |
| `costo_total` NO es computed | Vive en otra tabla (recursos); se actualiza desde el servicio o trigger. |
| FKs lógicas cross-DB | SQL Server no soporta FKs físicas cross-DB; validar en servicio. |
| `activo` solo en tablas "madre" | Los hijos (recursos, asistencias) se borran, no se soft-deletean. |

---

## 5. Plan de implementación por slices

**Principio:** NO construir 16 pantallas de golpe. La app entrega valor real con ~9 pantallas, no 16.

### Slice 1 — Catálogos (CRUD base, sin dependencias)
- Pantallas: Hospitales (con cálculos automáticos), Ejecutivos (read-only desde Asokam), Productos (read-only desde Asokam)
- Habilita: todo lo demás
- Esfuerzo: **Bajo** — CRUD puro + 1 read-only de Asokam
- Verificación: alta de hospital, listado de productos, cálculo AT/AG/AR

### Slice 2 — Talleres Médicos (proceso core)
- Pantallas: Selección Mensual → Programa Anual → Calendario → Taller (Matriz + Asistencia + Materiales + Aprobaciones como tabs de una pantalla) → Evidencias
- Cubre `ASK-CEM-DDP-001` end-to-end
- Esfuerzo: **Medio** — state machine + costos + aprobaciones
- Verificación: crear un taller de principio a fin, firmar, registrar asistencia, calcular costo total

### Slice 3 — Ventas IMSS (proceso paralelo)
- Pantallas: Metas → Plan de Trabajo → Reporte Semanal → Reporte Visitas → Indicador
- Cubre `ASK-VEN-DDP-001`
- Esfuerzo: **Medio**
- Verificación: crear meta anual, plan mensual, capturar visita, calcular indicador

**Reducción 16 → 9 pantallas**: combinando las 4-5 pantallas de gestión del taller en una sola pantalla `TallerDetail` con tabs.

---

## 6. Riesgos y decisiones pendientes

### 6.1 Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `genContactosCat` (4,856 filas) contiene ruido (no todos son hospitales objetivo) | Alta | Filtrar por `tipo`/`clasificacion` en consulta; o crear `hospital_extension` solo para los marcados como talleres |
| Cross-DB queries pueden ser lentas si no hay índices en Asokam | Media | Verificar índices en `genContactosCat.codigoContacto`, `genProductosCat.codigoProducto`; usar query raw con JOIN cross-DB si EF es lento |
| Activación de `[HasPermission]` puede romper endpoints hoy abiertos | Alta | Por slice: primero crear features sin `[HasPermission]` (consistentes con resto del backend), activar al final del slice |
| `crmEquipoVentasCat.codigoUsuariosMiembros` es VARCHAR con lista de IDs (anti-patrón) | Alta | Parsear en el servicio; no intentar normalizar Asokam |
| Schema `rh` no está en scripts del repo — podemos repetir el error | Media | SÍ crear `027_create_educacion_medica.sql` desde el inicio |

### 6.2 Decisiones pendientes (requieren input)

1. **¿Sembrado inicial de hospitales?** `genContactosCat` tiene 4,856 contactos — ¿están ya filtrados a hospitales IMSS/Descentralizados o hay que etiquetar/limpiar?

2. **¿`hospital_extension` vive en `educacion_medica` o agregamos columnas a `genContactosCat` en Asokam?**
   - Propuesta: `educacion_medica` (limpio, no invasivo). Pendiente confirmar.

3. **¿Backend usa DevToken bypass durante desarrollo?** Hoy `DevToken` impersona user_id=1. Confirmar que ese usuario tenga permisos `educacion-medica.*` o crear rol específico.

4. **¿Reportes / KPIs (Fase 5) en esta fase o diferidos?** La spec los define (`ASK-KPI-VEN-001`, indicadores de satisfacción). Propongo diferir a Slice 4 opcional.

---

## 7. Próximos pasos

1. **Revisar y aprobar esta propuesta** — decisiones de §6.2.
2. **Aplicar migraciones iniciales en dev:**
   ```powershell
   cd lefarma.backend
   dotnet build src/Lefarma.Migrations/Lefarma.Migrations.csproj
   cd ..
   .\multiappcli.ps1 sql status dev    # ver qué va a aplicar
   .\multiappcli.ps1 sql apply dev     # aplicar
   ```
3. **Para Slice 1**, plan detallado (formato `lefarma.docs/plans/`) con tasks paso a paso.
4. **Ejecución incremental** slice por slice, con verificación al final de cada uno.

---

## 8. Referencias

- [`pantallas.md`](./pantallas.md) — spec de las 16 pantallas con matriz de roles
- [`vault/Procesos/Talleres Médicos en Hospitales.md`](./vault/Procesos/Talleres%20M%C3%A9dicos%20en%20Hospitales.md) — proceso `ASK-CEM-DDP-001`
- [`vault/Instructivos/`](./vault/Instructivos/) — 8 instructivos de trabajo
- [`vault/Formularios/`](./vault/Formularios/) — 8 formularios ASK-CEM/ASK-VEN-FOR
- [`vault/Roles/Roles y Abreviaturas.md`](./vault/Roles/Roles%20y%20Abreviaturas.md) — roles y permisos

### Memoria de sesión (Engram)
- `educacion-medica/estado-del-modulo` — inventario inicial
- `educacion-medica/catalogos-asokam-reutilizables` — catálogos verificados en BD
- `educacion-medica/arquitectura-multi-db` — decisión cross-DB + patrón DbContext
- `lefarma/patrones-implementacion-apps` — patrones del backend/frontend para replicar
