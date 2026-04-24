---
name: sql-server-query
description: Ejecuta SELECTs y EXECs de funciones/procedimientos almacenados en SQL Server. Solo lectura — nunca ejecuta INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE. Genera archivos .sql y pide confirmación antes de cualquier EXEC. Conexiones configurables en connections.yaml.
category: database
tags: [sql-server, select, read-only, query]
version: 1.0.0
---

# SQL Server Query (Solo Lectura)

Skill para ejecutar queries de **solo lectura** en SQL Server: SELECTs y EXECs de funciones/procedimientos almacenados.

## Reglas Inviolables

- **SOLO** SELECT, EXEC (procedimientos/funciones), sp_help, sp_columns, sp_helptext
- **NUNCA** INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, BULK INSERT, RESTORE, GRANT, DENY, REVOKE
- Si el query contiene palabras prohibidas → **ERROR** y no ejecutar
- EXEC de procedimientos/funciones → **SIEMPRE preguntar** antes de ejecutar
- Queries SELECT puros → Generar .sql y ofrecer ejecutar

## Conexión Lefarma (proyecto principal)

```
Server: 192.168.4.2
Database: Lefarma
User: coreapi
Password: L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!
```

Para este proyecto, tras modificar modelos C# o hacer cambios de backend — SIEMPRE validar contra la estructura real de la BD antes de cerrar la tarea.

## Configuración de Conexiones

Archivo: `~/.hermes/skills/sql-server-query/connections.yaml`

```yaml
connections:
  Lefarma:
    name: Lefarma
    server: 192.168.4.2
    database: Lefarma
    username: coreapi
    password: L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!
    
  Asokam:
    name: Asokam
    server: 192.168.4.2
    database: Asokam
    username: coreapi
    password: L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!
```

Para agregar una conexión nueva, editar el archivo `connections.yaml`.

## Uso

### 1. SELECT simple → generar .sql

```
"Quiero ver los primeros 10 registros de la tabla Productos"
```

**Flujo:**
1. Validar query (sin comandos prohibidos)
2. Generar archivo `query_YYYYMMDD_HHMMSS.sql`
3. Mostrar contenido del archivo
4. Ofrecer: "¿Ejecuto este query? (si/no)"

### 2. SELECT de estructura de tabla

```
"¿Cómo está la estructura de la tabla Productos?"
```

Genera y ofrece ejecutar:
```sql
SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (
    SELECT ku.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
    WHERE tc.TABLE_NAME = '@TABLA' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
WHERE c.TABLE_NAME = '@TABLA'
ORDER BY c.ORDINAL_POSITION;
```

### 3. EXEC de procedimiento almacenado → PREGUNTAR SIEMPRE

```
"Ejecuta sp_help 'Productos'"
```

**Flujo:**
1. Detectar EXEC
2. Validar que sea procedimiento/función (no UPDATE ni otros)
3. **Preguntar**: "¿Ejecuto este procedimiento almacenado? (si/no)"
4. Si sí → ejecutar y mostrar resultados
5. Si no → solo generar .sql

### 4. Comparar modelo C# con tabla SQL

```
"Compara el modelo Producto.cs con la tabla Productos"
```

**Flujo:**
1. Pedir ruta del archivo .cs (o buscarla)
2. Ejecutar query de estructura de la tabla
3. Comparar campos e inferir diferencias
4. Reportar: campos que faltan, tipos diferentes, etc.

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `select <tabla> [limit N]` | SELECT * FROM tabla (con límite) |
| `estructura <tabla>` | Ver estructura de tabla |
| `procedures` | Listar procedimientos almacenados |
| `funciones` | Listar funciones |
| `tablas` | Listar todas las tablas |
| `compare <csFile> <tabla>` | Comparar modelo C# con tabla |
| `exec <sp_name> [params]` | Ejecutar SP (PIDE PERMISO) |

## Palabras Prohibidas (bloqueo total)

```
INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, MERGE, 
BULK INSERT, RESTORE, GRANT, DENY, REVOKE,
INSERT INTO, UPDATE FROM, DELETE FROM, DROP TABLE, DROP COLUMN,
ALTER TABLE, ALTER COLUMN, TRUNCATE TABLE, CREATE TABLE, 
CREATE PROCEDURE, CREATE FUNCTION, CREATE VIEW, CREATE INDEX, CREATE TRIGGER,
xp_cmdshell, sp_executesql con parámetros dinámicos peligrosos
```

## Validación de Query

Antes de ejecutar cualquier cosa:
1. Convertir a uppercase
2. Buscar palabras prohibidas
3. Si encuentra algo → **BLOQUEAR** con mensaje claro
4. Si es SELECT puro → generar .sql
5. Si es EXEC → pedir permiso explícito
