# Diseño: Carga de días de vacaciones

**Fecha:** 2026-07-14  
**Autor:** opencode  
**Estado:** Aprobado para implementación

## Resumen

Implementar dos pantallas para administrar días de vacaciones:

1. **Días no laborables / feriados por empresa**: carga de días oficiales por empresa y sucursal, que se replican automáticamente a cada usuario activo de esa empresa/sucursal.
2. **Vacaciones individuales por usuario**: administración de saldos anuales de vacaciones por usuario.

Ambas pantallas se desarrollarán en fases separadas. La Fase 1 se enfoca en los días oficiales y la replicación a usuarios.

---

## Contexto

El sistema ya cuenta con:

- `SolicitudesPersonal` y `TiposSolicitud` para gestionar permisos, vacaciones, incidencias, etc.
- Un componente `MiCalendario.tsx` que consume días no laborables desde un endpoint existente.
- Patrón de carga masiva CSV en proveedores (`ProveedorService.BulkUpload.cs` y `BulkUploadModal.tsx`).

No existe aún una tabla específica para días oficiales de vacaciones ni para vacaciones individuales por fecha.

---

## Decisiones de diseño aprobadas

- **Dos pantallas separadas**, una para días oficiales y otra para vacaciones individuales.
- **Días oficiales** se cargan por empresa/sucursal y se **replican automáticamente** en la tabla de vacaciones de cada usuario.
- **Vacaciones individuales** se manejarán como saldos anuales, con una tabla específica para ello.
- **Campos de fecha separados**: `anio`, `mes`, `dia`, además de un campo `fecha` calculado para joins.
- **No duplicar** datos de aprobación de solicitudes: los detalles de aprobación permanecen en `solicitudes_personales`.

---

## Modelo de datos

### Tabla 1: `rh.dias_oficiales`

Días oficiales de vacaciones / feriados por empresa y sucursal.

| Campo | Tipo | Notas |
|---|---|---|
| `id_dia_oficial` | int PK | Identity |
| `id_empresa` | int FK | Requerido |
| `id_sucursal` | int FK | Requerido |
| `anio` | int | Requerido |
| `mes` | int | Requerido |
| `dia` | int | Requerido |
| `fecha` | date | Requerido, útil para joins y calendario |
| `descripcion` | nvarchar(100) | Opcional, ej. "Año Nuevo" |
| `activo` | bit | Baja lógica |
| `fecha_creacion` | datetime | Default GETDATE() |

**Constraints:**
- `UQ_dias_oficiales_empresa_sucursal_fecha` (único por empresa/sucursal/fecha)
- FK a `catalogos.empresas`
- FK a `catalogos.sucursales`

---

### Tabla 2: `rh.vacaciones_usuarios`

Registro detallado de cada día de vacación asignado a un usuario.

| Campo | Tipo | Notas |
|---|---|---|
| `id_vacacion_usuario` | int PK | Identity |
| `id_usuario` | int FK | Requerido |
| `id_empresa` | int FK | Requerido |
| `id_sucursal` | int FK | Requerido |
| `anio` | int | Requerido |
| `mes` | int | Requerido |
| `dia` | int | Requerido |
| `fecha` | date | Requerido |
| `tipo` | nvarchar(20) | `OFICIAL` o `INDIVIDUAL` |
| `estado` | nvarchar(20) | `ASIGNADO` o `TOMADO` |
| `id_dia_oficial` | int FK nullable | Referencia al día oficial que lo generó |
| `comentarios` | nvarchar(250) | Opcional |
| `activo` | bit | Baja lógica |
| `fecha_creacion` | datetime | Default GETDATE() |

**Constraints:**
- `UQ_vacaciones_usuarios_usuario_fecha` (un usuario no puede tener dos registros activos para la misma fecha)
- FK a `app.Usuarios`
- FK a `catalogos.empresas`
- FK a `catalogos.sucursales`
- FK a `rh.dias_oficiales`

---

### Tabla 3: `rh.saldos_vacaciones_anuales` (Fase 2)

Saldo anual de vacaciones por usuario.

| Campo | Tipo | Notas |
|---|---|---|
| `id_saldo` | int PK | Identity |
| `id_usuario` | int FK | Requerido |
| `id_empresa` | int FK | Requerido |
| `anio` | int | Requerido |
| `dias_asignados` | decimal(5,2) | Default 0 |
| `dias_tomados` | decimal(5,2) | Default 0 |
| `dias_pendientes` | decimal(5,2) | Computado: `dias_asignados - dias_tomados` |
| `activo` | bit | Default 1 |
| `fecha_creacion` | datetime | Default GETDATE() |

**Constraints:**
- `UQ_saldos_vacaciones_usuario_anio` (único por usuario/año)

---

## Reglas de negocio

1. **Replicación oficial → individual**: al insertar días en `rh.dias_oficiales`, el sistema obtiene los usuarios activos de la empresa/sucursal y crea un registro en `rh.vacaciones_usuarios` con `tipo = 'OFICIAL'` y `estado = 'ASIGNADO'` para cada usuario.
2. **Unicidad**: un usuario no puede tener dos registros activos para la misma fecha. Si ya existe, se ignora en la carga masiva.
3. **Baja en cascada lógica**: al desactivar un día oficial, se desactivan los registros `OFICIALES` correspondientes en `rh.vacaciones_usuarios`.
4. **Saldos**: los días individuales aprobados actualizarán `rh.saldos_vacaciones_anuales.dias_tomados` en la Fase 2.

---

## Plan de implementación — Fase 1: Días oficiales por empresa

### Objetivo
Permitir cargar, visualizar y eliminar días oficiales de vacaciones por empresa/sucursal, con replicación automática a `rh.vacaciones_usuarios`.

### Backend

1. **Script SQL**  
   `lefarma.database/026_create_dias_oficiales_y_vacaciones_usuarios.sql`  
   - Crear `rh.dias_oficiales` y `rh.vacaciones_usuarios`.  
   - Agregar índices, FKs y constraints de unicidad.  
   - No usar EF Migrations.

2. **Entidades EF Core**  
   - `Domain/Entities/Rh/DiaOficial.cs`  
   - `Domain/Entities/Rh/VacacionUsuario.cs`

3. **Configuraciones EF Core**  
   - `Infrastructure/Data/Configurations/Rh/DiaOficialConfiguration.cs`  
   - `Infrastructure/Data/Configurations/Rh/VacacionUsuarioConfiguration.cs`

4. **DbContext**  
   - Agregar `DbSet<DiaOficial>` y `DbSet<VacacionUsuario>` en `ApplicationDbContext.cs`.

5. **DTOs**  
   En `Features/Rh/Vacaciones/DTOs/`:  
   - `DiaOficialRequest` (filtros: empresa, sucursal, año, mes)  
   - `DiaOficialResponse`  
   - `CargaDiasOficialesRequest` (carga manual)  
   - `CargaDiasOficialesCsvRow`  
   - `BulkUploadResultResponse`  
   - `VacacionUsuarioResponse`

6. **Servicio**  
   `Features/Rh/Vacaciones/VacacionesService.cs`  
   - `ObtenerDiasOficialesAsync`  
   - `CargarDiasOficialesManualAsync`  
   - `CargarDiasOficialesDesdeCsvAsync`  
   - `EliminarDiaOficialAsync`  
   - `ReplicarDiasOficialesAUsuariosAsync`

7. **Controller**  
   `Features/Rh/Vacaciones/VacacionesController.cs`  
   - `GET api/rh/vacaciones/dias-oficiales`  
   - `POST api/rh/vacaciones/dias-oficiales`  
   - `POST api/rh/vacaciones/dias-oficiales/csv`  
   - `DELETE api/rh/vacaciones/dias-oficiales/{id}`  
   - `GET api/rh/vacaciones/usuarios` (preview)

8. **Permisos**  
   Agregar en `Shared/Constants/AuthorizationConstants.cs`:  
   - `rh.vacaciones.ver`  
   - `rh.vacaciones.cargar`  
   - `rh.vacaciones.eliminar`

9. **Validaciones**  
   - Empresa y sucursal existentes.  
   - Fecha no duplicada para la misma empresa/sucursal.  
   - Año actual o futuro.  
   - CSV con columnas: `dia,mes,anio,descripcion`.

### Frontend

1. **Rutas**  
   Agregar en `src/apps/rh/RhRoutes.tsx`:  
   - `vacaciones/dias-oficiales`

2. **Menú**  
   Agregar en `src/apps/rh/menuItems.tsx`:  
   - Sección "Vacaciones" > "Días oficiales"

3. **Página principal**  
   `src/apps/rh/pages/Vacaciones/DiasOficialesPage.tsx`  
   - Filtros: empresa, sucursal, año.  
   - Botones: agregar manual, cargar CSV, descargar plantilla.  
   - Tabla de días oficiales con `DataTable`.  
   - Calendario visual opcional para ver/refrescar.

4. **Modal de carga manual**  
   `src/apps/rh/components/Vacaciones/CargaManualDiasOficialesModal.tsx`  
   - Empresa, sucursal, año.  
   - Selector de múltiples fechas (calendario o select día/mes + agregar).  
   - Descripción opcional.

5. **Modal de carga masiva**  
   `src/apps/rh/components/Vacaciones/CargaCsvDiasOficialesModal.tsx`  
   - Reutiliza patrón de `BulkUploadModal.tsx`.  
   - Drag & drop CSV.  
   - Preview con `Papa.parse`.  
   - Errores por fila y resumen de carga.

6. **Servicio API**  
   `src/apps/rh/services/vacaciones.api.ts`  
   - `getDiasOficiales`  
   - `createDiasOficiales`  
   - `bulkUploadDiasOficiales`  
   - `deleteDiaOficial`

7. **Tipos**  
   `src/types/vacaciones.types.ts`  
   - `DiaOficialResponse`  
   - `VacacionUsuarioResponse`  
   - `CargaDiasOficialesRequest`  
   - `BulkUploadResult`

8. **Utilidades CSV**  
   Extender `src/utils/csv.ts`:  
   - `VACACIONES_DIAS_OFICIALES_COLUMNS`  
   - `parseDiasOficialesCsv`  
   - `buildDiasOficialesErrorsCsv`

---

## Plan de implementación — Fase 2: Vacaciones individuales por usuario

### Objetivo
Administrar saldos anuales de vacaciones por usuario.

### Backend

1. **Script SQL**  
   `lefarma.database/027_create_saldos_vacaciones_anuales.sql`  
   - Crear `rh.saldos_vacaciones_anuales`.  
   - FKs e índices.

2. **Entidad, configuración y DbSet**  
   - `Domain/Entities/Rh/SaldoVacacionesAnual.cs`  
   - `Infrastructure/Data/Configurations/Rh/SaldoVacacionesAnualConfiguration.cs`  
   - Agregar `DbSet` en `ApplicationDbContext`.

3. **DTOs**  
   - `SaldoVacacionesRequest`  
   - `SaldoVacacionesResponse`  
   - `CargaSaldoVacacionesCsvRow`

4. **Servicio**  
   - `ObtenerSaldosAsync`  
   - `CargarSaldoAsync` (manual)  
   - `CargarSaldosDesdeCsvAsync`  
   - `ActualizarSaldoTomadoAsync` (cuando se aprueba una solicitud de vacaciones)

5. **Controller**  
   - `GET api/rh/vacaciones/saldos`  
   - `POST api/rh/vacaciones/saldos`  
   - `POST api/rh/vacaciones/saldos/csv`  
   - `PUT api/rh/vacaciones/saldos/{id}`

6. **Permisos**  
   - `rh.vacaciones.saldos.ver`  
   - `rh.vacaciones.saldos.cargar`  
   - `rh.vacaciones.saldos.ajustar`

### Frontend

1. **Ruta**  
   - `vacaciones/individuales`

2. **Menú**  
   - Sección "Vacaciones" > "Vacaciones individuales"

3. **Página**  
   `src/apps/rh/pages/Vacaciones/VacacionesIndividualesPage.tsx`  
   - Filtros: empresa, sucursal, usuario, año.  
   - Tabla de saldos: usuario, año, días asignados, días tomados, días pendientes.  
   - Botones: ajustar manual, cargar CSV.

4. **Modal de ajuste manual**  
   - Usuario, año, días asignados, días tomados.

5. **Modal de carga masiva**  
   - CSV con: `id_usuario, anio, dias_asignados, dias_tomados`.

6. **Servicio API y tipos**  
   - Extender `vacaciones.api.ts` y `vacaciones.types.ts`.

---

## Preguntas pendientes

1. **Carga manual de días oficiales**: ¿selector de calendario múltiple, select de día/mes/año + botón agregar, o ambos?  
   *Respuesta esperada: por confirmar.*

2. **Formato de carga masiva**: ¿CSV primero y luego XLSX, o ambos desde el inicio?  
   *Respuesta esperada: por confirmar.*

3. **Cuando se aprueba una solicitud de vacaciones**: ¿debe actualizar automáticamente el saldo anual y/o crear registros en `rh.vacaciones_usuarios`?  
   *Respuesta esperada: por confirmar.*

---

## Notas técnicas

- No usar EF Migrations. Todas las tablas se crean con scripts SQL numerados.  
- Seguir el patrón Controller → Service → Repository del backend.  
- Usar `ErrorOr<T>` y `ToActionResult` para respuestas consistentes.  
- En el frontend, usar React Hook Form + Zod, `DataTable` de TanStack, y el patrón de carga masiva de proveedores.  
- El componente `MiCalendario.tsx` ya puede consumir días no laborables; se puede extender para que use `rh.dias_oficiales`.
