# Matriz única, multi-gerencia y planeación post-cierre — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la Matriz de talleres en el único documento autorizable, enlazarla directamente a su versión de rutas, permitir consulta multi-gerencia sin edición, mostrar los ajustes post-cierre dentro de la matriz y eliminar todo rastro del workflow de rutas, incluidas sus columnas históricas.

**Architecture:** La Matriz General conserva el workflow `EDUCACION_MEDICA_MATRIZ`; la versión de rutas queda como planeación operativa sin workflow y se enlaza con `matrices_generales.id_ruta_version`. El envío de la matriz cierra la planeación; devolverla la reabre; cerrarla la mantiene en `Cerrada` para que los cambios reales sigan por `ajustes_post_cierre`. El calendario multi-gerencia es de solo consulta y la edición exige una sola gerencia.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core, SQL Server (scripts manuales), React 19, TypeScript, Vite, TanStack Table, xUnit, Moq, FluentAssertions.

---

## Decisiones incorporadas (30-oct-2026)

- [x] `MatrizGeneral` tendrá `IdRutaVersion` como FK directa a `rutas_versiones`.
- [x] Matriz, ruta y selección siempre operan por **mes completo**; el periodo de la matriz es el primer día del mes.
- [x] Se mantiene el flujo de **ajustes post-cierre** con permiso y motivo; no se reabre ni se reautoriza la matriz.
- [x] La vista Matriz debe mostrar los cambios post-cierre realizados sobre talleres, visitas o la versión de rutas.
- [x] Se eliminan las columnas históricas de workflow de `rutas_versiones` (`id_workflow`, `id_paso_actual`, `id_estado`) y se actualiza el script de creación limpia `0016`.
- [x] No se usan migraciones EF. Los cambios de esquema son scripts manuales numerados.
- [x] No se aplica ningún script a una base de datos sin autorización explícita del usuario.
- [x] No se crea una segunda versión de matriz ni un flujo de reautorización.

## Invariantes que debe respetar la implementación

1. **Un mes = una selección = una matriz general por gerencia.** `matrices_generales.periodo` siempre es el primer día del mes y `UQ_matrices_generales_gerencia_periodo` sigue vigente.
2. **La matriz apunta a una versión concreta de rutas.** `id_ruta_version` debe pertenecer a la misma gerencia y al mismo mes que la matriz.
3. **La matriz es el único documento con workflow.** No quedan endpoints, DTOs, tipos frontend ni pendientes de bandeja para el workflow de rutas.
4. **La planeación posterior al cierre no se bloquea.** Si la ruta está `Cerrada`, los cambios se permiten con `educacion_medica.rutas.puede_ajustar` y motivo, y se registran en `ajustes_post_cierre`.
5. **Los ajustes post-cierre son visibles en la matriz.** La vista y la impresión deben poder identificar qué cambió, cuándo, quién y por qué.
6. **Multi-gerencia es solo consulta.** Matriz, versiones, cotización, generación y edición requieren exactamente una gerencia.
7. **No se eliminan columnas de workflow de selección ni de matriz.** Solo las de `rutas_versiones`.

---

## Mapa de archivos

### Base de datos

| Archivo | Acción |
|---|---|
| `lefarma.database/educacion-medica/0016_20261007-1200_educacion-medica_create-esquema-completo.lefarma.sql` | Modificar: agregar `matrices_generales.id_ruta_version`; quitar columnas de workflow de `rutas_versiones`. |
| `lefarma.database/educacion-medica/0042_20261030-1200_educacion-medica_matriz-id-ruta-version.lefarma.sql` | Crear: columna, FK, índice, descripción y backfill para bases existentes. |
| `lefarma.database/educacion-medica/0043_20261030-1300_educacion-medica_drop-workflow-rutas.lefarma.sql` | Crear: eliminar columnas históricas de workflow de `rutas_versiones`. |

### Backend

| Archivo | Acción |
|---|---|
| `Domain/Entities/EducacionMedica/MatrizGeneral.cs` | Agregar `IdRutaVersion`. |
| `Infrastructure/Data/Configurations/EducacionMedica/MatrizGeneralConfiguration.cs` | Mapear FK e índice. |
| `Domain/Entities/EducacionMedica/RutaVersion.cs` | Quitar `IWorkflowEntity`, `IdWorkflow`, `IdPasoActual`, `IdEstado`, `EstadoWorkflow`. |
| `Infrastructure/Data/Configurations/EducacionMedica/RutaVersionConfiguration.cs` | Quitar mapeos de workflow. |
| `Features/EducacionMedica/TalleresService.cs` | Enlazar matriz con versión de rutas y validar mes/gerencia. |
| `Features/EducacionMedica/MatrizTalleresService.cs` | Usar `matriz.IdRutaVersion`, sincronizar estados y exponer ajustes post-cierre. |
| `Features/EducacionMedica/RutasService.cs` | Eliminar workflow; conservar planeación y ajustes. |
| `Features/EducacionMedica/IRutasService.cs` | Eliminar métodos de workflow. |
| `Features/EducacionMedica/RutasController.cs` | Eliminar endpoints de workflow de rutas. |
| `Features/EducacionMedica/AprobacionesService.cs` | Quitar versiones de rutas de la bandeja. |
| `Features/EducacionMedica/DTOs/WorkflowDtos.cs` | Eliminar `RutaVersionDto`. |
| `Features/EducacionMedica/DTOs/MatrizDtos.cs` | Agregar datos de enlace y ajustes post-cierre. |
| `Features/EducacionMedica/DTOs/CalendarioDtos.cs` | Agregar `IdGerencias`. |
| `Features/EducacionMedica/CalendarioService.cs` | Filtrar por lista de gerencias. |
| `Features/EducacionMedica/AsignadorEspecialistasService.cs` | Sugerencia contextual para visita asignada. |
| `Features/EducacionMedica/IAsignadorEspecialistasService.cs` | Nueva firma. |
| `Features/EducacionMedica/CalendarioController.cs` | Parámetro `idRutaVisita` en sugerencias. |

### Frontend

| Archivo | Acción |
|---|---|
| `src/apps/educacion-medica/services/educacionMedica.api.ts` | Quitar endpoints de workflow de rutas; agregar parámetro de sugerencia. |
| `src/apps/educacion-medica/types/educacionMedica.types.ts` | Quitar `RutaVersionDto` y tipo `rutas`; agregar tipos de ajustes. |
| `src/apps/educacion-medica/components/documentoEntidad.ts` | Quitar `rutas`. |
| `src/apps/educacion-medica/components/DocumentoFirmaModal.tsx` | Dejar de aceptar `rutas`. |
| `src/apps/educacion-medica/components/DocumentoHistorialModal.tsx` | Corregir historial de matriz y quitar rutas. |
| `src/apps/educacion-medica/pages/taller/BandejaAprobacionesPage.tsx` | Quitar tipo/filtro/detalle/acciones de rutas. |
| `src/apps/educacion-medica/pages/calendario/CalendarioPage.tsx` | Multi-gerencia, solo lectura, matriz separada, quitar workflow de rutas y Resumen. |
| `src/apps/educacion-medica/pages/calendario/components/CalendarioFiltros.tsx` | MultiSelect de gerencias; quitar responsables. |
| `src/apps/educacion-medica/pages/calendario/components/CalendarioInspector.tsx` | Modo solo lectura y sugerencia contextual. |
| `src/apps/educacion-medica/pages/calendario/components/ResponsablesSheet.tsx` | Crear: colaboradores en móvil. |
| `src/apps/educacion-medica/pages/calendario/components/MatrizPanel.tsx` | Ajustes post-cierre y enlace de versión. |
| `src/apps/educacion-medica/pages/taller/components/MatrizTalleresTable.tsx` | Indicador de ajustes post-cierre. |
| `src/apps/educacion-medica/pages/taller/components/MatrizPrintDocument.tsx` | Incluir ajustes post-cierre. |
| `src/apps/educacion-medica/pages/calendario/components/CalendarioMatriz.tsx` | Eliminar si solo lo usa el modo Resumen. |

---

## Task 1: Base de datos — enlazar MatrizGeneral con RutaVersion

**Files:**
- Create: `lefarma.database/educacion-medica/0042_20261030-1200_educacion-medica_matriz-id-ruta-version.lefarma.sql`
- Modify: `lefarma.database/educacion-medica/0016_20261007-1200_educacion-medica_create-esquema-completo.lefarma.sql`
- Modify: `lefarma.backend/src/Lefarma.API/Domain/Entities/EducacionMedica/MatrizGeneral.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/EducacionMedica/MatrizGeneralConfiguration.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/MatrizTalleresServiceTests.cs`

**Step 1: Crear el script idempotente**

Contenido mínimo esperado:

```sql
IF COL_LENGTH('educacion_medica.matrices_generales', 'id_ruta_version') IS NULL
BEGIN
    ALTER TABLE educacion_medica.[matrices_generales]
        ADD [id_ruta_version] int NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_matrices_generales_ruta_version'
      AND parent_object_id = OBJECT_ID('educacion_medica.[matrices_generales]')
)
BEGIN
    ALTER TABLE educacion_medica.[matrices_generales]
        ADD CONSTRAINT [FK_matrices_generales_ruta_version]
        FOREIGN KEY ([id_ruta_version])
        REFERENCES educacion_medica.[rutas_versiones] ([id_ruta_version]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_matrices_generales_ruta_version'
      AND object_id = OBJECT_ID('educacion_medica.[matrices_generales]')
)
BEGIN
    CREATE INDEX [IX_matrices_generales_ruta_version]
        ON educacion_medica.[matrices_generales] ([id_ruta_version]);
END;
```

Backfill para matrices históricas: buscar la versión de rutas vinculada por `talleres → rutas_visitas → rutas → rutas_versiones`, validando gerencia y mes completos:

```sql
UPDATE m
SET m.id_ruta_version = x.id_ruta_version
FROM educacion_medica.[matrices_generales] m
CROSS APPLY (
    SELECT TOP 1 rv.id_ruta_version
    FROM educacion_medica.[talleres] t
    JOIN educacion_medica.[rutas_visitas] v ON v.id_ruta_visita = t.id_ruta_visita
    JOIN educacion_medica.[rutas] r ON r.id_ruta = v.id_ruta
    JOIN educacion_medica.[rutas_versiones] rv ON rv.id_ruta_version = r.id_ruta_version
    JOIN educacion_medica.[selecciones_mensuales] s ON s.id_seleccion_mensual = rv.id_seleccion_mensual
    WHERE t.id_matriz_general = m.id_matriz_general
      AND t.activo = 1
      AND rv.id_tipo_gerencia = m.id_tipo_gerencia
      AND DATEFROMPARTS(YEAR(s.fecha_seleccion), MONTH(s.fecha_seleccion), 1) = m.periodo
      AND rv.estado NOT IN ('Archivada', 'Cancelada', 'Rechazada')
    ORDER BY rv.version DESC
) x
WHERE m.id_ruta_version IS NULL;
```

Agregar `MS_Description` para `id_ruta_version`.

**Step 2: Actualizar `0016` para instalación limpia**

En `CREATE TABLE educacion_medica.[matrices_generales]` agregar:

```sql
[id_ruta_version] int NULL,
```

Agregar FK e índice:

```sql
CONSTRAINT [FK_matrices_generales_ruta_version]
    FOREIGN KEY ([id_ruta_version])
    REFERENCES educacion_medica.[rutas_versiones] ([id_ruta_version]),
```

```sql
IF NOT EXISTS (... 'IX_matrices_generales_ruta_version')
    CREATE INDEX [IX_matrices_generales_ruta_version]
        ON educacion_medica.[matrices_generales] ([id_ruta_version]);
```

Agregar `MS_Description` en la sección de `matrices_generales`.

**Step 3: Entidad y configuración**

En `MatrizGeneral.cs`:

```csharp
public int? IdRutaVersion { get; set; }
```

En `MatrizGeneralConfiguration.cs`:

```csharp
builder.Property(e => e.IdRutaVersion).HasColumnName("id_ruta_version");

builder.HasOne<RutaVersion>()
    .WithMany()
    .HasForeignKey(e => e.IdRutaVersion)
    .HasConstraintName("FK_matrices_generales_ruta_version")
    .OnDelete(DeleteBehavior.NoAction);

builder.HasIndex(e => e.IdRutaVersion)
    .HasDatabaseName("IX_matrices_generales_ruta_version");
```

**Step 4: Compilar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`.
Expected: compila sin errores.

**Step 5: No ejecutar el script**

No aplicar `0042` ni `0016` a ninguna base de datos. Solo dejar los scripts listos.

---

## Task 2: Base de datos — eliminar columnas históricas de workflow de rutas

**Files:**
- Create: `lefarma.database/educacion-medica/0043_20261030-1300_educacion-medica_drop-workflow-rutas.lefarma.sql`
- Modify: `lefarma.database/educacion-medica/0016_20261007-1200_educacion-medica_create-esquema-completo.lefarma.sql`
- Modify: `lefarma.backend/src/Lefarma.API/Domain/Entities/EducacionMedica/RutaVersion.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/EducacionMedica/RutaVersionConfiguration.cs`

**Step 1: Crear script de eliminación idempotente**

```sql
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_rutas_versiones_id_estado'
      AND object_id = OBJECT_ID('educacion_medica.[rutas_versiones]')
)
BEGIN
    DROP INDEX [IX_rutas_versiones_id_estado]
        ON educacion_medica.[rutas_versiones];
END;

IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_workflow') IS NOT NULL
    ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_workflow];

IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_paso_actual') IS NOT NULL
    ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_paso_actual];

IF COL_LENGTH('educacion_medica.rutas_versiones', 'id_estado') IS NOT NULL
    ALTER TABLE educacion_medica.[rutas_versiones] DROP COLUMN [id_estado];
```

Antes de ejecutarlo en una base real, revisar si existen constraints/defaults con nombres `DF_rutas_versiones_*`; si existen, el script debe eliminarlos antes de las columnas. No ejecutar todavía.

**Step 2: Actualizar `0016`**

Eliminar de `CREATE TABLE educacion_medica.[rutas_versiones]`:

```sql
[id_workflow] int NULL,
[id_paso_actual] int NULL,
[id_estado] int NULL,
```

Eliminar sus `MS_Description`. El resto de la tabla (`estado`, `fecha_confirmacion`, auditoría, FK a selección) se conserva.

**Step 3: Quitar workflow de la entidad**

`RutaVersion.cs` debe quedar sin:

- `using Lefarma.API.Domain.Interfaces.Config;`
- `using Lefarma.API.Shared.Constants;`
- `: IWorkflowEntity`
- `IdWorkflow`, `IdPasoActual`, `IdEstado`
- `EstadoWorkflow`
- implementación explícita de `IWorkflowEntity`
- `ObtenerTipoEntidad()`

Conservar `Estado`, `FechaConfirmacion`, auditoría y `Rutas`.

**Step 4: Quitar mapeos de configuración**

En `RutaVersionConfiguration.cs` eliminar:

```csharp
builder.Property(e => e.IdWorkflow)...
builder.Property(e => e.IdPasoActual)...
builder.Property(e => e.IdEstado)...
builder.HasOne(e => e.EstadoWorkflow)...
```

**Step 5: Compilar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`.
Expected: fallará en los servicios que aún usan las propiedades; continuar con Task 3.

---

## Task 3: Backend — usar la versión enlazada y validar mes completo

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/TalleresService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/MatrizTalleresService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/DTOs/MatrizDtos.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/MatrizTalleresServiceTests.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/TalleresServiceTests.cs`

**Step 1: Escribir primero las pruebas de mes/gerencia**

Casos mínimos:

- Crear taller de noviembre en gerencia IMSS → matriz `periodo = 2026-11-01`, `IdRutaVersion` de una versión de noviembre IMSS.
- Intentar enlazar una versión de diciembre o de otra gerencia → error claro, sin guardar.
- Matriz existente con `IdRutaVersion = null` + taller vinculado → se rellena.
- `GetRevisionAsync` sin `idRutaVersion` usa `matriz.IdRutaVersion`.

Run: `dotnet test --filter "FullyQualifiedName~MatrizTalleresServiceTests"` en `lefarma.backend`.
Expected: fallan las pruebas nuevas.

**Step 2: Cambiar la firma de creación de matriz**

En `TalleresService`:

```csharp
private async Task<MatrizGeneral> GetOrCreateMatrizGeneralAsync(
    int idTipoGerencia,
    DateOnly periodo,
    int? idRutaVersion,
    int idUsuario,
    CancellationToken ct)
```

Reglas:

- Si `idRutaVersion` viene, cargar `RutaVersion` y su `SeleccionMensual`.
- Validar `SeleccionMensual.IdTipoGerencia == idTipoGerencia`.
- Validar que el mes de `SeleccionMensual` sea exactamente `periodo`.
- Si la matriz ya existe y su `IdRutaVersion` es null, asignarlo.
- Si ya existe con otra versión, no sobrescribir silenciosamente: lanzar error de inconsistencia.
- Si no viene versión, dejar `IdRutaVersion = null` solo para históricos; no inventar una.

**Step 3: Pasar la versión desde los callers**

En `CrearAsync`/`CrearExtraordinarioAsync`, resolver la versión así:

- Si el taller tiene `IdRutaVisita`, obtener `RutaVisita → Ruta → IdRutaVersion`.
- Si no, buscar la versión no archivada de la selección de la gerencia/mes.
- Pasar el `int?` a `GetOrCreateMatrizGeneralAsync`.

No confiar en `DateTime.UtcNow` para el mes: usar la fecha del taller y la fecha de la selección.

**Step 4: `GetRevisionAsync` usa el enlace directo**

Orden de resolución:

1. `idRutaVersion` explícito del request.
2. `matriz.IdRutaVersion`.
3. Fallback legado por gerencia/mes solo si `matriz.IdRutaVersion` es null.

Validar siempre:

```csharp
version.IdTipoGerencia == matriz.IdTipoGerencia
periodoDe(version.IdSeleccionMensual) == matriz.Periodo
```

**Step 5: Exponer el enlace en DTOs**

En `MatrizGeneralResumenDto` agregar `IdRutaVersion`, `Version`, `EstadoRutaVersion`. Quitar duplicados de `MatrizTalleresDetalleDto` si ya no son necesarios.

**Step 6: Ejecutar pruebas**

Run: `dotnet test --filter "FullyQualifiedName~MatrizTalleresServiceTests|FullyQualifiedName~TalleresServiceTests"` en `lefarma.backend`.
Expected: pasan.

---

## Task 4: Backend — eliminar el workflow de rutas

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/RutasService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/IRutasService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/RutasController.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/AprobacionesService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/DTOs/WorkflowDtos.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/RutasServiceTests.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/AprobacionesServiceTests.cs`

**Step 1: Escribir pruebas de ausencia de workflow**

- `IRutasService` ya no expone `GetVersionInfoAsync`, `FirmarVersionAsync`, `GetHistorialVersionAsync`.
- `RutasController` no compila con endpoints de firma/historial/versión.
- `AprobacionesService.GetDocumentosAsync` no devuelve `Tipo = "rutas"`.
- La bandeja solo devuelve `seleccion` y `matriz`.

Run: `dotnet test --filter "FullyQualifiedName~RutasServiceTests|FullyQualifiedName~AprobacionesServiceTests"`.
Expected: fallan o no compilan hasta implementar.

**Step 2: Limpiar `RutasService`**

Eliminar dependencias y métodos:

- `IWorkflowEngine`, `IWorkflowResolver`, `IWorkflowRepository`, `IWorkflowQueryService`, `IProfileService`, `IJefeInmediatoResolver`.
- `ResolverWorkflowAsync`
- `ValidarFirmaUsuarioAsync`
- `FirmarVersionAsync`
- `GetHistorialVersionAsync`
- `GetVersionInfoAsync`
- `ArmarVersionDtoAsync`
- `ValidarCoberturaVersionAsync` si solo la usaba el workflow; si se conserva para otra validación, dejarla.

`GenerarAsync`:

- No resolver workflow.
- No escribir `IdWorkflow`/`IdPasoActual`/`IdEstado`.
- Validar versión activa por `Estado == RutaVersion.EstadoCreada`.
- Conservar la validación de creador si aplica.
- Mantener la creación de `RutaVersion` con `EstadoCreada`.

`ValidarRutaEditableAsync`:

```csharp
if (ruta.Estado != Ruta.EstadoCreada)
{
    throw new InvalidOperationException(
        $"Solo una ruta en Creada es editable (estado actual: {ruta.Estado}).");
}
```

Los ajustes post-cierre siguen entrando por la rama `ruta.Estado == Ruta.EstadoCerrada` con permiso y motivo.

**Step 3: Limpiar interfaz, controlador y DTO**

- `IRutasService`: eliminar los tres métodos de workflow y sus `using` de `ErrorOr`/workflow DTOs.
- `RutasController`: eliminar `GET version`, `POST firmar`, `GET historial`.
- `WorkflowDtos.cs`: eliminar `RutaVersionDto`.
- `AprobacionesService`: eliminar el bloque de `RutasVersiones` y `VersionRutas` del DTO si queda sin uso.

**Step 4: Compilar y probar**

Run: `dotnet build` en `lefarma.backend/src/Lefarma.API`.
Run: `dotnet test --filter "FullyQualifiedName~RutasServiceTests|FullyQualifiedName~AprobacionesServiceTests"` en `lefarma.backend`.
Expected: compila y pasan.

---

## Task 5: Backend — sincronizar matriz con planeación

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/MatrizTalleresService.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/MatrizTalleresServiceTests.cs`

**Step 1: Escribir pruebas de transición**

- ENVIAR la matriz deja `RutaVersion.Estado = Cerrada` y todas sus `Ruta.Estado = Cerrada`.
- DEVOLVER al paso inicial deja `RutaVersion.Estado = Creada` y rutas `Creada`.
- CERRAR mantiene `RutaVersion.Estado = Cerrada`.
- Los ajustes posteriores sobre una ruta `Cerrada` siguen permitidos con permiso/motivo.
- No se modifican rutas de otras gerencias/meses.

**Step 2: Implementar sincronización**

En `MatrizTalleresService.FirmarAsync`, después de ejecutar la acción y antes de `SaveChangesAsync`:

```csharp
await SincronizarPlaneacionConMatrizAsync(matriz, pasoResultante, codigoAccion, idUsuario, ct);
```

Regla:

- `pasoResultante.EsInicio == true` o acción `DEVOLVER` → `Creada`.
- Cualquier otro avance (`ENVIAR`, `AUTORIZAR`, `CERRAR`) → `Cerrada`.
- `RECHAZAR`/`CANCELAR` → mantener `Cerrada` para no ocultar visitas; la cancelación de rutas es un flujo aparte.
- `FechaConfirmacion`: se asigna al pasar a `Cerrada` y se limpia al volver a `Creada`.

Fuente de rutas a actualizar:

1. Si `matriz.IdRutaVersion` existe, esa versión y sus rutas.
2. Si no, las versiones vinculadas por `talleres → rutas_visitas → rutas`.
3. No actualizar rutas fuera de esa matriz.

**Step 3: Ejecutar pruebas**

Run: `dotnet test --filter "FullyQualifiedName~MatrizTalleresServiceTests"` en `lefarma.backend`.
Expected: pasan.

---

## Task 6: Backend — calendario multi-gerencia

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/DTOs/CalendarioDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/CalendarioService.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/CalendarioServiceTests.cs`

**Step 1: Agregar prueba de dos gerencias**

- Con `IdGerencias = [1, 2]` y sin `IdSeleccion`, devuelve visitas de ambas gerencias del mes completo.
- Con `IdGerencias = [1]`, solo devuelve la gerencia 1.
- Sin `IdSeleccion`, no duplica visitas de versiones archivadas/canceladas/rechazadas.
- Un usuario sin `verTodas` sigue limitado a sus visitas.

**Step 2: Implementar**

En `CalendarioFiltro`:

```csharp
public List<int>? IdGerencias { get; set; }
```

En `CalendarioService.GetCalendarioAsync`:

```csharp
if (filtro.IdGerencias is { Count: > 0 })
{
    query = query.Where(x =>
        x.s.IdTipoGerencia.HasValue &&
        filtro.IdGerencias.Contains(x.s.IdTipoGerencia.Value));
}
```

Mantener `IdGerencia` para compatibilidad. El rango `Desde/Hasta` sigue siendo el mes completo que envía el frontend.

**Step 3: Ejecutar pruebas**

Run: `dotnet test --filter "FullyQualifiedName~CalendarioServiceTests"`.
Expected: pasan.

---

## Task 7: Backend — sugerencia contextual para visitas asignadas

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/IAsignadorEspecialistasService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/AsignadorEspecialistasService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/CalendarioController.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/AsignadorEspecialistasServiceTests.cs`

**Step 1: Escribir pruebas**

- Sin `idRutaVisita`: solo visitas sin especialista (comportamiento actual).
- Con `idRutaVisita` de una visita asignada: devuelve una alternativa distinta al especialista actual.
- La alternativa respeta capacidad/día/semana y elegibilidad por gerencia.
- Si no hay mejor alternativa, devuelve lista vacía.
- Tras reasignar, la siguiente consulta devuelve una sugerencia recalculada.

**Step 2: Extender firma**

```csharp
Task<List<SugerenciaEspecialistaDto>> GetSugerenciasAsync(
    int idSeleccionMensual,
    DateOnly? desde,
    DateOnly? hasta,
    int? idRutaVisita = null,
    CancellationToken ct = default);
```

Reglas:

- Cargar la visita indicada aunque tenga especialista.
- Excluir `visita.IdEspecialista` de los candidatos.
- Reutilizar el scoring actual (`misma ciudad`, `cerca`, `menor carga`).
- No devolver al especialista actual como “sugerencia”.

**Step 3: Exponer el parámetro**

En `CalendarioController.GetSugerencias` agregar `[FromQuery] int? idRutaVisita`.

**Step 4: Probar**

Run: `dotnet test --filter "FullyQualifiedName~AsignadorEspecialistasServiceTests"`.
Expected: pasan.

---

## Task 8: Backend — ajustes post-cierre visibles en la matriz

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/DTOs/MatrizDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/MatrizTalleresService.cs`
- Test: `lefarma.backend/tests/Lefarma.UnitTests/Features/EducacionMedica/MatrizTalleresServiceTests.cs`

**Step 1: Escribir pruebas**

- Una matriz cerrada con un ajuste `MOVER_VISITA` devuelve `AjustesPostCierre` con hospital, fecha, acción, motivo y usuario.
- Un ajuste de `EDITAR_TALLER` aparece asociado a su taller.
- Un ajuste de `CANCELAR_VERSION` aparece asociado a la versión.
- La matriz sigue en estado `Cerrada`; no se reabre ni cambia de paso.

**Step 2: Agregar DTO**

```csharp
public class MatrizAjustePostCierreDto
{
    public int IdAjuste { get; set; }
    public string EntidadTipo { get; set; } = string.Empty;
    public int IdEntidad { get; set; }
    public int? IdTaller { get; set; }
    public string? Hospital { get; set; }
    public string Accion { get; set; } = string.Empty;
    public string? ValoresAntes { get; set; }
    public string? ValoresDespues { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public int IdUsuario { get; set; }
    public string? NombreUsuario { get; set; }
    public DateTime FechaAjuste { get; set; }
}
```

Agregar a `MatrizTalleresDetalleDto`:

```csharp
public List<MatrizAjustePostCierreDto> AjustesPostCierre { get; set; } = [];
```

**Step 3: Cargar ajustes**

En `ArmarDetalleAsync`:

- Obtener ids de talleres de la matriz.
- Obtener ids de visitas de esos talleres.
- Consultar `AjustesPostCierre` donde:
  - `TALLER` + ids de talleres,
  - `RUTA_VISITA` + ids de visitas,
  - `RUTA_VERSION` + `matriz.IdRutaVersion`.
- Resolver nombres de usuario.
- Mapear hospital/taller cuando aplique.
- Ordenar por `FechaAjuste` descendente.

**Step 4: Probar**

Run: `dotnet test --filter "FullyQualifiedName~MatrizTalleresServiceTests"`.
Expected: pasan.

---

## Task 9: Frontend — quitar workflow de rutas de API, tipos y bandeja

**Files:**
- Modify: `lefarma.frontend/src/apps/educacion-medica/services/educacionMedica.api.ts`
- Modify: `lefarma.frontend/src/apps/educacion-medica/types/educacionMedica.types.ts`
- Modify: `lefarma.frontend/src/apps/educacion-medica/components/documentoEntidad.ts`
- Modify: `lefarma.frontend/src/apps/educacion-medica/components/DocumentoFirmaModal.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/components/DocumentoHistorialModal.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/taller/BandejaAprobacionesPage.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/CalendarioPage.tsx`

**Step 1: API y tipos**

Eliminar:

- `educacionMedicaApi.rutas.version`
- `educacionMedicaApi.rutas.firmarVersion`
- `educacionMedicaApi.rutas.historialVersion`
- `RutaVersionDto`
- `PendienteAprobacion['tipo']` deja de incluir `'rutas'`
- `PendienteAprobacion.versionRutas`

**Step 2: Documentos**

- `TipoDocumentoEm = 'seleccion' | 'matriz'`.
- `ENTIDAD_ARCHIVOS` sin `rutas`.
- `DocumentoFirmaModal` y `DocumentoHistorialModal` sin rama de rutas.
- `DocumentoHistorialModal` para `matriz` usa `educacionMedicaApi.matricesTalleres.historial(idEntidad)`.
- Para `seleccion` mantiene `seleccionesMensuales.historial`.

**Step 3: Bandeja**

- `FiltrosBandeja['tipo'] = 'todos' | 'seleccion' | 'matriz'`.
- Eliminar opción “Rutas” del filtro.
- Eliminar estado `rutasVersion`, detalle de versión y llamadas a `rutas.*`.
- `confirmarAccion` solo maneja `seleccion` y `matriz`.
- Navegación sin caso `rutas`.

**Step 4: Calendario**

- Quitar imports y estados de workflow de rutas:
  - `DocumentoHeaderCard`, `DocumentoFirmaModal`, `DocumentoHistorialModal` de rutas.
  - `RutaVersionDto`, `AccionWorkflow`, `RutaVersionDto`.
  - `versionInfo`, `accionesWorkflowRutas`, `accionesFirmaRutas`, `accionEnviarRutas`, `accionesModalRutas`.
  - `modalFirma`, `modalHistorial`, `guardandoWorkflow`.
  - `firmarVersionRutas`.
- Conservar `versionRuta` y `versionesDisponibles` como filtro de lectura.
- `estadoVersionSeleccionada` se deriva de `versionesDisponibles` y `RutaDto.estado`.

**Step 5: Compilar**

Run: `npm run build` en `lefarma.frontend`.
Expected: compila.

---

## Task 10: Frontend — calendario multi-gerencia y solo consulta

**Files:**
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/CalendarioPage.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/CalendarioFiltros.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/CalendarioInspector.tsx`
- Create: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/ResponsablesSheet.tsx`

**Step 1: Estado multi-gerencia**

Reemplazar `idGerencia: string` por:

```ts
const [idGerencias, setIdGerencias] = useState<string[]>([]);
const multiGerencia = idGerencias.length !== 1;
```

Reglas:

- `idGerencias = []` significa “todas” y se considera multi-gerencia (solo consulta) si existe más de una gerencia en el mes.
- `idGerencias.length === 1` habilita selección mensual, versión, matriz, cotización y edición.
- `idGerencias.length > 1` limpia `idSeleccionActiva` y `seleccionContexto`.

**Step 2: Filtros**

- Eliminar de `CalendarioFiltros` las props `mostrarResponsables`, `idEjecutivo`, `idEspecialista`, `ejecutivos`, `especialistas` y sus selects.
- Agregar `MultiSelect` de gerencias dentro del popover de Filtros, no en la barra principal.
- Opciones: todas las gerencias; valor vacío = todas.
- Mostrar chip compacto “Todas las gerencias” o “2 gerencias”.

**Step 3: Colaboradores**

- Mantener el rail de escritorio tal como está.
- Crear `ResponsablesSheet.tsx` para móvil con tabs Ejecutivos/Especialistas y la misma lista `RailPersona`.
- Agregar botón “Colaboradores” visible en móvil que abra el sheet.
- No volver a poner ejecutivos/especialistas dentro de `CalendarioFiltros`.

**Step 4: Solo lectura**

Agregar a `CalendarioInspector`:

```ts
soloLectura?: boolean;
```

Cuando sea `true`:

- Ocultar/deshabilitar “Aplicar” de ejecutivo y especialista.
- Ocultar “Reprogramar visita”.
- Ocultar “Crear taller”.
- Ocultar “Solicitar cambio” y acciones de ajuste.
- Mantener detalle, talleres y actividad.

En `CalendarioPage`:

```tsx
<CalendarioInspector
  ...
  soloLectura={multiGerencia}
/>
```

También:

- `puedeGestionarRutas` no debe habilitar generación/matriz en multi-gerencia.
- `puedeCotizar` no debe habilitar cotización en multi-gerencia.
- `capturaBloqueada` solo aplica con una gerencia.

**Step 5: Matriz solo con una gerencia**

```ts
const gerenciaMatrizId =
  idGerencias.length === 1 ? Number(idGerencias[0]) : null;
```

El CTA de matriz se deshabilita con mensaje “Selecciona una gerencia para abrir la matriz”.

**Step 6: Compilar**

Run: `npm run build`.
Expected: compila.

---

## Task 11: Frontend — simplificación visual y matriz separada

**Files:**
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/CalendarioPage.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/MatrizPanel.tsx`
- Delete: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/CalendarioMatriz.tsx` si ya no tiene referencias.

**Step 1: Modos**

- `ModoCalendario = 'calendario' | 'tabla' | 'matriz'`.
- `MODOS` solo contiene `Calendario` y `Tabla`.
- `Resumen` se elimina.
- `Matriz` deja de ser tab y pasa a CTA destacado “Abrir matriz”.
- `vista=matriz` sigue siendo válido por URL.
- `vista=resumen` legado cae a calendario.

**Step 2: Matriz separada**

- Agregar botón grande “Abrir matriz” en la cabecera o barra superior, con icono `Presentation`.
- `MatrizPanel` se renderiza a ancho completo.
- `MatrizPanel` muestra “Volver al calendario” usando `onVerCalendario`.
- Eliminar la fila/espaciado de tabs de matriz.

**Step 3: Conservar Tabla**

- `CalendarioTabla` sigue como vista de nivel superior.
- No moverla dentro de Matriz en esta iteración.
- No eliminar `CalendarioTabla`.

**Step 4: Encabezado de rutas**

- Quitar el bloque `DocumentoHeaderCard` de rutas.
- Mantener el selector compacto de versión como filtro.
- No mostrar Firmar/Historial de rutas.
- El encabezado de matriz conserva `DocumentoHeaderCard` con Firmar/Imprimir/Historial.

**Step 5: Compilar**

Run: `npm run build`.
Expected: compila.

---

## Task 12: Frontend — sugerencia contextual y ajustes en matriz

**Files:**
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/CalendarioPage.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/CalendarioInspector.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/calendario/components/MatrizPanel.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/taller/components/MatrizTalleresTable.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/pages/taller/components/MatrizPrintDocument.tsx`
- Modify: `lefarma.frontend/src/apps/educacion-medica/types/educacionMedica.types.ts`

**Step 1: Sugerencia contextual**

- Agregar estado `sugerenciaContextual`.
- Si la visita seleccionada tiene especialista, consultar `calendario.sugerencias(idSeleccion, desde, hasta, idRutaVisita)`.
- Pasar esa sugerencia al inspector.
- En inspector, mostrar sugerencia para visita sin especialista y para visita asignada.
- Texto del botón: “Asignar” si no tiene; “Reasignar” si ya tiene.
- Después de `asignarEspecialista`, incrementar `refrescoRutas` para recalcular.

**Step 2: Tipos de ajustes**

Agregar a `educacionMedica.types.ts`:

```ts
export interface MatrizAjustePostCierre {
  idAjuste: number;
  entidadTipo: string;
  idEntidad: number;
  idTaller?: number | null;
  hospital?: string | null;
  accion: string;
  valoresAntes?: string | null;
  valoresDespues?: string | null;
  motivo: string;
  idUsuario: number;
  nombreUsuario?: string | null;
  fechaAjuste: string;
}
```

Agregar `ajustesPostCierre: MatrizAjustePostCierre[]` a `MatrizTalleresDetalle`.

**Step 3: Mostrar ajustes post-cierre**

En `MatrizPanel`:

- Si `matriz.ajustesPostCierre.length > 0`, mostrar tarjeta “Ajustes post-cierre” debajo de `SaludMatrizCard`.
- Tabla compacta: fecha, hospital/taller, acción, antes → después, motivo, usuario.
- Badge “Ajuste post-cierre” en filas afectadas de `MatrizTalleresTable`.
- La matriz no cambia de estado por estos ajustes.

En `MatrizPrintDocument`:

- Incluir una sección de ajustes post-cierre si existen.
- No alterar las firmas ni el estado de la matriz.

**Step 4: Compilar y lint**

Run: `npm run build`.
Run: `npm run lint`.
Expected: sin errores nuevos.

---

## Task 13: Verificación integral

**Step 1: Backend**

Run en `lefarma.backend`:

```bash
dotnet build
dotnet test --filter "FullyQualifiedName~EducacionMedica"
```

Expected:

- Build OK.
- Pruebas de Educación Médica en verde.
- Suite completa puede conservar los 6 fallos RH preexistentes; documentarlos, no atribuirlos a este cambio.

**Step 2: Frontend**

Run en `lefarma.frontend`:

```bash
npm run build
npm run lint
```

Expected:

- Build OK.
- Lint sin errores nuevos en archivos tocados.

**Step 3: Smoke con DevToken**

Headers:

```text
X-Dev-Token: lefarma-dev-token-2024
X-Dev-User-Id: 70
```

Verificar:

- `GET /api/educacion-medica/calendario?idGerencias=1&idGerencias=2&desde=2026-11-01&hasta=2026-11-30` devuelve ambas gerencias.
- `GET /api/educacion-medica/calendario/sugerencias?idSeleccion=...&idRutaVisita=...` devuelve una alternativa distinta al especialista actual.
- `GET /api/educacion-medica/aprobaciones` no devuelve `tipo = "rutas"`.
- Los endpoints `rutas/version`, `rutas/version/{id}/firmar` y `rutas/version/{id}/historial` responden 404.
- La matriz devuelve `idRutaVersion` y `ajustesPostCierre`.

**Step 4: Revisión de base de datos sin ejecutar**

- Confirmar que `0042` y `0043` son idempotentes por lectura.
- Confirmar que `0016` crea instalaciones limpias con `matrices_generales.id_ruta_version` y sin columnas de workflow en `rutas_versiones`.
- No aplicar scripts sin autorización.

**Step 5: Documentación**

Actualizar:

- `lefarma.docs/educacion-medica/reglas-negocio.md`: matriz única, bloqueo al enviar, reapertura al devolver, ajustes post-cierre y multi-gerencia solo consulta.
- `lefarma.docs/educacion-medica/decisiones/00006_workflow-seleccion-y-rutas.md`: nota de que el workflow de rutas quedó eliminado y que la matriz es el único documento autorizable.
- `lefarma.docs/educacion-medica/tareas/00024_workflow-matriz-unico-multigerencia.md`: crear/actualizar checklist de ejecución si se decide mantener el plan dentro del módulo.

No commitear salvo que el usuario lo pida.

---

## Fuera de alcance

- Crear una segunda versión de matriz o reautorización post-cierre.
- Eliminar columnas de workflow de `selecciones_mensuales` o `matrices_generales`.
- Aplicar scripts SQL a `LefarmaDev2` u otra base.
- Migraciones EF.
- Rediseñar el flujo de workflow de la matriz.
- Eliminar la vista Tabla; se conserva por ahora.
- Cambiar la lógica de ajustes post-cierre más allá de mostrarla en matriz.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Matrices históricas sin `id_ruta_version` | Backfill por talleres/visitas/rutas; dejar null si no hay evidencia. |
| Versión de rutas de otro mes/gerencia | Validación explícita en `TalleresService` y `MatrizTalleresService`. |
| Duplicados de visitas al consultar multi-gerencia | Filtrar estados archivados/cancelados/rechazados y usar rango de mes completo. |
| Ajustes post-cierre ocultos | DTO explícito + tarjeta y badge en Matriz. |
| Eliminar columnas usadas por código | Compilar y ejecutar pruebas antes de cualquier script; el script no se aplica en esta tarea. |
| Multi-gerencia con acciones de edición | `soloLectura` en inspector y ocultamiento de CTAs de versión/matriz/cotización. |
| Bandeja con pendientes de rutas | Eliminar bloque backend y tipo/filtro frontend; prueba de no regresión. |

## Estado de implementación (30-oct-2026)

Implementado en código:

- [x] Scripts `0042` y `0043` creados; `0016` actualizado.
- [x] `MatrizGeneral.IdRutaVersion` en entidad/configuración/DTOs.
- [x] `RutaVersion` sin workflow; configuración y `WorkflowEngine` limpiados.
- [x] Enlace matriz-ruta en `TalleresService` y validación de mes/gerencia.
- [x] Sincronización matriz → planeación al enviar/devolver/cerrar.
- [x] Workflow de rutas eliminado de servicio, controlador, bandeja y frontend.
- [x] Calendario multi-gerencia y sugerencias contextuales.
- [x] Ajustes post-cierre expuestos en matriz y su impresión.
- [x] Matriz como CTA separado; Resumen eliminado; Tabla conservada.
- [x] Colaboradores en rail de escritorio y sheet móvil.
- [x] Build backend, 267 pruebas de Educación Médica, build frontend y lint focalizado.

Pendiente de verificación operativa:

- [ ] Aplicar `0042` y `0043` en la base de datos (no se ejecutaron).
- [ ] Smoke de endpoints contra base migrada.
- [ ] Revisar los 6 fallos preexistentes de RH en la suite completa (ajenos a Educación Médica).
