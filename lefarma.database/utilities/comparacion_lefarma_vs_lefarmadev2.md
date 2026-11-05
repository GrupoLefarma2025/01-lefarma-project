# Comparación de esquema: Lefarma → LefarmaDev2

Generado el 29-oct-2026 por comparación directa de catálogos (`sys.tables`, `sys.columns`, `sys.indexes`, `sys.foreign_keys`, `sys.check_constraints`, `sys.default_constraints`, `sys.sql_modules`) en el servidor **192.168.4.2 (ARTRICENTER-MX)**.

- Origen (producción): **Lefarma**
- Destino (desarrollo): **LefarmaDev2**

Criterios de comparación:

- Tablas: columnas (tipo, largo, precisión, nulabilidad, identidad, collation, default), PRIMARY KEY, índices, UNIQUE, FOREIGN KEY y CHECK.
- Vistas, procedimientos, funciones y triggers: texto normalizado de la definición (sin distinguir espacios ni mayúsculas/minúsculas).
- Índices y constraints se comparan por su **firma** (columnas, unicidad, filtro, acción referencial), no por nombre, para no reportar diferencias solo de nombre.

## Resumen

| | Objetos |
|---|---:|
| Existen en Lefarma y **NO** en LefarmaDev2 | 2 |
| Existen en ambos pero **difieren** | 6 |
| Solo existen en LefarmaDev2 | 41 |

| Tipo | No existen en destino | Difieren | Solo en destino |
|---|---:|---:|---:|
| PROCEDIMIENTO | 1 | 4 | 0 |
| TABLA | 1 | 2 | 40 |
| VISTA | 0 | 0 | 1 |

## 1. Objetos que existen en Lefarma y NO existen en LefarmaDev2

| Tipo | Objeto | Filas en origen | Nota |
|---|---|---:|---|
| PROCEDIMIENTO | `rh.sp_sincroniza_saldos_vacaciones` |  | No existe en el destino |
| TABLA | `mcp_undo.cpy_1_2608e4f264` | 2 | No existe en el destino |

> Estos objetos no se copian: el script de datos trabaja solo con las tablas que ya existen en LefarmaDev2.

## 2. Objetos que existen en ambas bases pero están diferentes

### 2.1 Vistas, procedimientos, funciones y triggers

| Tipo | Objeto | Líneas origen / destino |
|---|---|---|
| PROCEDIMIENTO | `config.sp_ClonarWorkflow` | 423 / 198 |
| PROCEDIMIENTO | `config.sp_ClonarWorkflow_v2` | 193 / 409 |
| PROCEDIMIENTO | `viaticos.sp_actualiza_municipios` | 56 / 83 |
| PROCEDIMIENTO | `viaticos.sp_carga_municipios_osm` | 94 / 121 |

### 2.2 Tablas

#### `educacion_medica.hospital_extension`

Filas: origen **0**, destino **4,825**.

- columna extra en destino es_almacen (bit)
- columna extra en destino es_farmacia (bit)
- columna extra en destino es_sede_taller (bit)
- columna extra en destino es_zona_metropolitana (bit)
- columna extra en destino id_region (int)
- columna fecha: not null→null
- FK extra en destino ['id_region']→educacion_medica.regiones_cat['id_region']

#### `educacion_medica.programas_anuales`

Filas: origen **0**, destino **0**.

- CHECK extra en destino ([periodo_inicio]>=(1) and [periodo_inicio]<=(12) and ([periodo_fin]>=(1) and [periodo_fin]<=(12)))


## 3. Objetos que solo existen en LefarmaDev2

- **educacion_medica** (32): `educacion_medica.ajustes_post_cierre`, `educacion_medica.config_ranking`, `educacion_medica.config_ranking_factores`, `educacion_medica.ejecutivo_region`, `educacion_medica.ejecutivo_suplente`, `educacion_medica.equipos_pareo`, `educacion_medica.especialista_gerencia`, `educacion_medica.especialista_region`, `educacion_medica.matrices_generales`, `educacion_medica.matrices_individuales`, `educacion_medica.parametros_modulo`, `educacion_medica.programas_anuales_detalles`, `educacion_medica.ranking_ejecucion_hospitales`, `educacion_medica.ranking_ejecuciones`, `educacion_medica.regiones_cat`, `educacion_medica.regiones_estados`, `educacion_medica.rutas`, `educacion_medica.rutas_versiones`, `educacion_medica.rutas_visitas`, `educacion_medica.selecciones_mensuales`, `educacion_medica.selecciones_mensuales_hospitales`, `educacion_medica.selecciones_regiones`, `educacion_medica.taller_asistencias`, `educacion_medica.taller_estados_historial`, `educacion_medica.taller_evidencias`, `educacion_medica.taller_materiales`, `educacion_medica.taller_recursos`, `educacion_medica.taller_solicitudes_cambio`, `educacion_medica.talleres`, `educacion_medica.tema_taller`, `educacion_medica.tipo_visita`, `educacion_medica.vw_hospitales_clasificados`
- **mcp_undo** (8): `mcp_undo.cpy_1_0333411b29`, `mcp_undo.cpy_1_035417cdb2`, `mcp_undo.cpy_1_042634305d`, `mcp_undo.cpy_1_065924d679`, `mcp_undo.cpy_1_2202f8e928`, `mcp_undo.cpy_1_5253f76d36`, `mcp_undo.cpy_1_58157ff6b1`, `mcp_undo.cpy_1_58357f9bd8`
- **viaticos** (1): `viaticos.solicitud_origen_em_visita`

> Se conservan: el script de datos no los toca (salvo que sean padres referenciados, en cuyo caso conserva las filas necesarias).

## 4. Impacto en la copia de datos

- Tablas comunes en ambas bases: **104**
- Tablas que el script copia: **98**
- Tablas técnicas que el script excluye (6): `app.SchemaVersions`, `dbo.__EFMigrationsHistory`, `mcp_undo.backups`, `mcp_undo.change_set`, `mcp_undo.ddl_before`, `mcp_undo.row_copy`
- Tablas que el script NO reemplaza completas (6): conserva filas del destino porque tablas que solo existen en el destino dependen de ellas o porque en el origen están vacías: `educacion_medica.hospital_extension`, `educacion_medica.parametros_anestesias`, `educacion_medica.programas_anuales`, `educacion_medica.tipo_gerencia`, `viaticos.municipios_cat`, `viaticos.solicitudes`
- Filas a copiar (origen): **66,048**
- Tablas con diferencias de estructura: **2** (se copian solo las columnas que existen en ambos lados)

| Tabla | Filas origen | Columnas origen/destino | Diferencias |
|---|---:|---:|---:|
| `educacion_medica.hospital_extension` | 0 | 18/23 | 7 |
| `educacion_medica.programas_anuales` | 0 | 22/22 | 1 |

### Tablas donde el origen viene vacío y el destino tiene datos

| Tabla | Filas en destino | Qué hace el script |
|---|---:|---|
| `educacion_medica.hospital_extension` | 4,825 | Conserva las filas del destino (merge) |
| `viaticos.municipios_cat` | 2,478 | Conserva las filas del destino (merge) |
| `educacion_medica.parametros_anestesias` | 8 | Conserva las filas del destino (merge) |
| `educacion_medica.tipo_gerencia` | 4 | Conserva las filas del destino (merge) |

> `educacion_medica.hospital_extension`, `educacion_medica.parametros_anestesias` y `viaticos.municipios_cat` se fusionan a propósito: en Lefarma están vacías y vaciarlas dejaría sin catálogo los módulos que solo existen en Dev2.

### Script de copia

`lefarma.database/utilities/sincronizar_datos_lefarma_a_lefarmadev2.sql`
