# lefarma.database — Migraciones SQL

Migraciones SQL versionadas con [DbUp](https://dbup.github.io/), orquestadas por
`multiappcli.ps1 sql`.

## Cómo ver el estado

```powershell
# Desde la raíz del proyecto:
.\multiappcli.ps1 sql status dev      # qué falta aplicar en dev
.\multiappcli.ps1 sql status prod     # qué falta aplicar en prod
.\multiappcli.ps1 sql list dev        # qué ya está aplicado en dev
.\multiappcli.ps1 sql diff qa prod    # qué tiene QA que prod no
```

## Cómo aplicar

```powershell
.\multiappcli.ps1 sql apply dev                                # aplica TODO lo pendiente en dev
.\multiappcli.ps1 sql apply dev -SqlArgs "--app","educacion-medica"  # solo una app
.\multiappcli.ps1 sql apply dev -SqlArgs "--id","20260805-0935-create-talleres"  # uno específico
```

Para entorno **productivo** el comando pide confirmación antes de ejecutar.

## Estructura de carpetas

```
lefarma.database/
├── _shared/                          ← aplica a TODAS las DBs del ambiente
│   ├── schema/                         (CREATE TABLE, CREATE PROC, CREATE INDEX)
│   ├── alter/                          (ALTER TABLE, ALTER PROC, modifies)
│   └── data/                           (INSERTs de catálogos, configs, seeds)
│
├── educacion-medica/                 ← aplica a las DBs definidas en Routing
│   ├── schema/
│   ├── alter/
│   └── data/
│
├── rh/                               ← otra app
│   ├── schema/
│   ├── alter/
│   └── data/
│
└── legacy/                           ← CONVENCIÓN ANTERIOR (000_*..026_*, 06_*)
                                        Ya aplicados en todos los ambientes.
                                        DbUp NO los lee. Solo referencia histórica.
```

**3 tipos de scripts (sub-carpetas):**

| Carpeta | Cuándo | Ejemplo |
|---|---|---|
| `schema/` | Creación de tablas, procedures, índices, sinónimos, vistas | `20260805-0935-create-talleres.sql` |
| `alter/` | Modificación de lo anterior (ALTER TABLE, ALTER PROC) | `20260810-1740-add-taller-estado-cancelado-index.sql` |
| `data/` | INSERTs de datos (catálogos, permisos, configuraciones) | `20260806-1100-seed-permisos.sql` |

## Naming convention

```
<id>_<fecha>-hora_<app>_<slug>.sql
```

- `<id>` — numérico autoincremental, **4 dígitos** comenzando en `0001`. Global (no por carpeta). El siguiente = máximo existente + 1.
- `<fecha>-hora` — `YYYYMMDD-HHMM` (fecha y hora en 24h del momento de creación). El guion separa fecha de hora.
- `<app>` — nombre de la app (la misma que la carpeta contenedora): `_shared`, `educacion-medica`, `rh`, `cxp`, etc. Redundante con la carpeta pero útil al ver el archivo aislado.
- `<slug>` — kebab-case describiendo qué hace.

**Ejemplos:**

```
0001_20260805-0930_shared_initial-schema-app.sql
0002_20260805-0935_educacion-medica_create-schema.sql
0003_20260806-1045_educacion-medica_create-talleres.sql
0004_20260806-1520_educacion-medica_seed-permisos.sql
0005_20260810-0800_rh_add-empleado-jefe-override-index.sql
```

**Reglas del ID:**

- El ID es **global** entre todos los scripts nuevos (carpetas app/). No reinicia por app ni por tipo.
- Es responsabilidad del dev: antes de crear un script, mirar el ID más alto existente y sumar 1.
- DbUp aplica en **orden alfabético**, que con el ID al inicio = orden de creación = orden cronológico.
- La fecha-hora es informativa (para debug/histórico), no determina el orden — el ID sí.
- **Nunca reutilices un ID** aunque el script se haya borrado — queda reservado para siempre en `app.SchemaVersions`.

## Routing de scripts a DBs

Cada app está asociada a una o más DBs en `lefarma.backend/src/Lefarma.Migrations/migrations.config.json`
(sección `Routing`). Un script en `educacion-medica/` por defecto va a todas las DBs
donde esa app aplica.

Si un script específico debe ir solo a una DB distinta (override), agrega un header
en el SQL:

```sql
-- Target: AsokamDev
-- Tipo: data
INSERT INTO app.Permisos (codigo, descripcion) VALUES (...)
```

El migrador lee el header `-- Target:` y aplica el script solo a esas DBs
(separadas por comas si son varias).

## Convención del script

Cada script debe ser **idempotente en lo posible** (DbUp no reaplica scripts ya
corridos, pero si algo se cancela a mitad, conviene poder re-ejecutar):

```sql
-- ============================================================
-- 0003_20260806-1045_educacion-medica_create-talleres.sql
-- Descripción: Tabla talleres (aggregate root Educación Médica).
-- App: educacion-medica
-- Tipo: schema
-- Target: LefarmaDev, LefarmaQA, LefarmaProd
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'educacion_medica')
    EXEC('CREATE SCHEMA educacion_medica');
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('educacion_medica.talleres'))
BEGIN
    CREATE TABLE educacion_medica.talleres (
        -- columnas
    );
END
GO
```

**Notas:**
- Cada statement `CREATE/ALTER` lleva su propio guard `IF NOT EXISTS`.
- Usar `GO` entre bloques (DbUp respeta el batch separator).
- Las transacciones las maneja DbUp (`WithTransactionPerScript`) — no
  envuelvas todo el script en `BEGIN TRAN` manual.

## Tabla de tracking

DbUp crea y mantiene `app.SchemaVersions` automáticamente en cada DB:

| Columna | Tipo | Descripción |
|---|---|---|
| `ScriptName` | nvarchar | Id del script (filename sin `.sql`) |
| `Applied` | datetime | Cuándo se aplicó |

Esta tabla es el **source of truth** por ambiente. No la modifiques a mano.

## Migración desde la convención vieja

Los scripts `000_*` hasta `026_*`, `06_*`, `06B_*` ya están aplicados en todos
los ambientes y se movieron a `lefarma.database/legacy/`. Quedan como referencia
histórica y **DbUp NO los lee** (solo escanea carpetas app/).

La tabla `app.SchemaVersions` arranca vacía — los scripts nuevos se registran
a medida que se aplican.

> **Nota:** algunos docs históricos en `lefarma.docs/plans/` y `openspec/changes/`
> pueden referenciar paths viejos tipo `lefarma.database/017_create_*.sql`.
> Esos paths ahora están en `lefarma.database/legacy/`. Los docs no se actualizaron
> porque son snapshots cerrados de cambios ya entregados.

## Setup inicial (una sola vez)

```powershell
# 1. Build del migrador
cd lefarma.backend
dotnet build src/Lefarma.Migrations/Lefarma.Migrations.csproj

# 2. Aplicar todo lo pendiente en dev (crea SchemaVersions + aplica scripts)
cd ..
.\multiappcli.ps1 sql apply dev
```

Si prefieres ver antes de tocar:
```powershell
.\multiappcli.ps1 sql status dev
```

## Configuración

- `lefarma.backend/src/Lefarma.Migrations/migrations.config.json` —
  ambientes (dev/qa/prod), connection strings, y routing app → DBs.
- Variable de entorno `MIGRATIONS_CONFIG_PATH` para usar otra config (ej. CI).

## Reglas

1. **Nunca modifies un script ya aplicado.** DbUp detecta el cambio por nombre,
   no por contenido. Si necesitas cambiar algo, crea un script `alter/` nuevo.
2. **Nunca borres un script ya aplicado.** Misma razón.
3. **El orden lo da el nombre** — si necesitas forzar que A aplique antes que B,
   asegúrate de que A tenga timestamp menor.
4. **Un script = una idea.** Si necesitas crear 3 tablas relacionadas, mejor
   1 solo script que 3 separados (transaccionalidad).
5. **Commitea el .sql** — los scripts son código, viven en git.
