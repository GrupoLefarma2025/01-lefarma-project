# Comparación de esquema: Asokam → AsokamDev

Generado el 29-oct-2026 por comparación directa de catálogos (`sys.tables`, `sys.columns`, `sys.indexes`, `sys.foreign_keys`, `sys.check_constraints`, `sys.default_constraints`, `sys.sql_modules`) en el servidor **192.168.4.2 (ARTRICENTER-MX)**.

- Origen (producción): **Asokam**
- Destino (desarrollo): **AsokamDev**

Criterios de comparación:

- Tablas: columnas (tipo, largo, precisión, nulabilidad, identidad, collation, default), PRIMARY KEY, índices, UNIQUE, FOREIGN KEY y CHECK.
- Vistas, procedimientos, funciones y triggers: texto normalizado de la definición (sin distinguir espacios ni mayúsculas/minúsculas).
- Índices y constraints se comparan por su **firma** (columnas, unicidad, filtro, acción referencial), no por nombre, para no reportar diferencias solo de nombre.

## Resumen

| | Objetos |
|---|---:|
| Existen en Asokam y **NO** en AsokamDev | 19 |
| Existen en ambos pero **difieren** | 24 |
| Solo existen en AsokamDev | 0 |

| Tipo | No existen en destino | Difieren | Solo en destino |
|---|---:|---:|---:|
| ESQUEMA | 1 | 0 | 0 |
| FUNCION | 1 | 0 | 0 |
| PROCEDIMIENTO | 8 | 14 | 0 |
| TABLA | 8 | 4 | 0 |
| TRIGGER | 0 | 1 | 0 |
| VISTA | 1 | 5 | 0 |

## 1. Objetos que existen en Asokam y NO existen en AsokamDev

| Tipo | Objeto | Filas en origen | Nota |
|---|---|---:|---|
| ESQUEMA | `viaticos` |  | El esquema no existe en el destino |
| FUNCION | `app.fn_Capitaliza` |  | No existe en el destino |
| PROCEDIMIENTO | `app.sp_enviar_correo` |  | No existe en el destino |
| PROCEDIMIENTO | `app.sp_sincroniza_empleados_usuarios` |  | No existe en el destino |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_GuiasDHL` |  | No existe en el destino |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_GuiasTresGuerras` |  | No existe en el destino |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_Mermas` |  | No existe en el destino |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_Traslados` |  | No existe en el destino |
| PROCEDIMIENTO | `viaticos.sp_actualiza_municipios` |  | No existe en el destino |
| PROCEDIMIENTO | `viaticos.sp_carga_municipios_osm` |  | No existe en el destino |
| TABLA | `app.ConcentradoRespuestaLog` | 0 | **La crea el script** y copia sus datos |
| TABLA | `app.ConcentradoRespuestaOCLog` | 16 | **La crea el script** y copia sus datos |
| TABLA | `app.correo_cuentas` | 1 | **La crea el script** y copia sus datos |
| TABLA | `dbo.envioEmailsCopia` | 13,790 | **La crea el script** y copia sus datos |
| TABLA | `dbo.ligasConferencia` | 6 | **La crea el script** y copia sus datos |
| TABLA | `dbo.test` | 217 | **La crea el script** y copia sus datos |
| TABLA | `viaticos.municipios_cat` | 2,478 | **La crea el script** y copia sus datos |
| TABLA | `viaticos.municipios_osm_staging` | 0 | **La crea el script** y copia sus datos |
| VISTA | `dbo.vwMermas` |  | No existe en el destino |

> Las 8 tablas las crea la **SECCIÓN 0** de `sincronizar_datos_asokam_a_asokamdev.sql`
> con la misma definición del origen (columnas, tipos, IDENTITY, defaults, PK,
> UNIQUE e índices) y después copia sus datos; incluye crear el schema `viaticos`.
> Los demás objetos (función, procedimientos, vista y triggers) no se copian: el
> script solo maneja tablas.

## 2. Objetos que existen en ambas bases pero están diferentes

### 2.1 Vistas, procedimientos, funciones y triggers

| Tipo | Objeto | Líneas origen / destino |
|---|---|---|
| PROCEDIMIENTO | `dbo.SP_ActualizaCamposOdooInterfas` | 72 / 71 |
| PROCEDIMIENTO | `dbo.SP_Jobs_RespaldaBases` | 99 / 84 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_Remisiones` | 63 / 59 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Almacen_ReporteEnvios` | 92 / 73 |
| PROCEDIMIENTO | `dbo.SP_Reportes_CxC_ActualizarEstatusIntentoCxCPagos` | 34 / 34 |
| PROCEDIMIENTO | `dbo.SP_Reportes_CxC_CobranzaRoberto` | 288 / 279 |
| PROCEDIMIENTO | `dbo.SP_Reportes_CxC_TableroCobranza` | 916 / 891 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Estadistica_PendientesXSurtirConInventario` | 198 / 198 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Finanzas_CrearGasto` | 226 / 196 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Inventarios_Kardex` | 97 / 54 |
| PROCEDIMIENTO | `dbo.SP_Reportes_Sistemas_TicketsRS` | 76 / 70 |
| PROCEDIMIENTO | `dbo.SP_SincronizaDiarioDeVentas` | 82 / 81 |
| PROCEDIMIENTO | `dbo.SP_SincronizarDatos` | 3892 / 3882 |
| PROCEDIMIENTO | `dbo.sp_EnviarRespuestaCurl` | 158 / 56 |
| TRIGGER | `app.trg_Documentos_Update_Estatus` | 136 / 193 |
| VISTA | `dbo.vwDiarioDeVentas` | 58 / 56 |
| VISTA | `dbo.vwEnviosConTraslados` | 21 / 20 |
| VISTA | `dbo.vwInconsistenciasDAYBiometrico` | 22 / 19 |
| VISTA | `dbo.vwRemisionesCab` | 54 / 52 |
| VISTA | `dbo.vwTickets` | 9 / 6 |

### 2.2 Tablas

#### `app.LogNotificacionDocumento`

Filas: origen **18**, destino **5**.

- columna url: tipo nvarchar(1000)→nvarchar(500)

#### `dbo.DiarioDeVentas`

Filas: origen **8,315**, destino **8,052**.

- falta columna codigoEmpresa (int)
- falta DEFAULT en codigoEmpresa: ((0))

#### `dbo.DiarioDeVentasHist`

Filas: origen **1,782,709**, destino **1,782,709**.

- falta columna codigoEmpresa (int)
- falta DEFAULT en codigoEmpresa: ((0))

#### `dbo.enviosCab`

Filas: origen **496**, destino **356**.

- falta columna almacen (varchar(50))
- falta columna costoEntregaPaqueteria (numeric(13,2))
- falta columna ivaGuiaEnvio (numeric(13,2))
- falta columna retencionIvaGuiaEnvio (numeric(13,2))
- falta columna rollosPlayo (int)
- falta columna subtotalGuiaEnvio (numeric(13,2))


## 3. Objetos que solo existen en AsokamDev

_Ninguno._

## 4. Impacto en la copia de datos

- Tablas comunes en ambas bases: **171**
- Tablas que el script copia: **178** (las 170 que ya existían + las 8 que crea la SECCIÓN 0)
- Tablas técnicas que el script excluye (1): `dbo.__EFMigrationsHistory`
- Tablas que el script NO reemplaza completas: **ninguna** (todas las comunes quedan idénticas al origen)
- Filas a copiar (origen): **5,645,285**
- Tablas con diferencias de estructura: **4** (se copian solo las columnas que existen en ambos lados)

| Tabla | Filas origen | Columnas origen/destino | Diferencias |
|---|---:|---:|---:|
| `dbo.DiarioDeVentasHist` | 1,782,709 | 58/57 | 2 |
| `dbo.DiarioDeVentas` | 8,315 | 57/56 | 2 |
| `dbo.enviosCab` | 496 | 49/43 | 6 |
| `app.LogNotificacionDocumento` | 18 | 17/17 | 1 |

> **Tamaño:** `app.Documentos` concentra ~7.9 GB del origen (8.0 GB de los 11.6 GB de la base). Copiarla obliga a que AsokamDev crezca varios GB y a que el log tenga espacio equivalente. El script trae `@OmitirDocumentos = 1` para saltarla y copiar todo lo demás.

### Script de copia

`lefarma.database/utilities/sincronizar_datos_asokam_a_asokamdev.sql`
