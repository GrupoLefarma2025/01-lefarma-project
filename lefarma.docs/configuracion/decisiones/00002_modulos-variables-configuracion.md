---
fecha_creacion: 2026-11-19 16:20
fecha_modificacion: 2026-11-20 11:30
resumen: Módulo Configuración — catálogo config.modulos que agrupa y filtra las variables, módulo「global」sembrado como destino por omisión de las variables anteriores, columna config.variables.id_modulo con FK opcional e índice, clave de tres segmentos modulo.namespace.clave para las variables nuevas (las de dos segmentos siguen vigentes), módulo inmutable tras la creación, color identificador #rrggbb elegible y aleatorio por omisión, CRUD por API en api/configuracion/modulos reutilizando los permisos de Configuración y scripts de esquema en un solo lote sin GO.
---

# 00002 — Módulos dueños de las variables de configuración

## Status

Accepted

> Decisión propia del módulo. Amplía el [[00001_esquema-variables-configuracion|ADR 00001]]:
> no cambia el significado de `clave`, `valor_json`, los destinos ni la bitácora;
> añade el catálogo de módulos y el vínculo con cada variable.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fase 1 — Catálogo de módulos|Fase 1 — Catálogo de módulos]]
- [[#Fase 2 — Módulo global y variables existentes|Fase 2 — Módulo global]]
- [[#Fase 3 — Clave modulo.namespace.clave|Fase 3 — Clave de tres segmentos]]
- [[#Fase 4 — Módulo inmutable y módulos inactivos|Fase 4 — Inmutabilidad y bajas]]
- [[#Fase 5 — API y permisos|Fase 5 — API y permisos]]
- [[#Fase 6 — Pantalla|Fase 6 — Pantalla]]
- [[#Fase 7 — Script de esquema|Fase 7 — Script de esquema]]
- [[#Fase 8 — Color de módulo|Fase 8 — Color de módulo]]
- [[#Validación|Validación]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

1. **Un catálogo propio, no un texto repetido.** La pertenencia de una variable a
   un módulo es una llave foránea `config.variables.id_modulo → config.modulos`,
   no un prefijo inferido de la clave. La clave sigue siendo el identificador
   estable que citan el código, SQL y las integraciones.
2. **`config.modulos` guarda la identidad del módulo.** `clave` es un slug en
   minúsculas con guion bajo, único y de hasta 50 caracteres; `nombre` y
   `descripcion` son editables. El catálogo se presenta ordenado por nombre. Un
   módulo no se borra: se desactiva.
3. **«global» es el módulo por omisión.** Se siembra con el esquema y no puede
   desactivarse. Todas las variables anteriores a los módulos se ligan a él, de
   modo que la consulta por módulo nunca deja filas huérfanas.
4. **`id_modulo` es opcional en la base, obligatorio en la aplicación.** La
   columna admite `NULL` para no romper escrituras antiguas ni restaurar filas
   viejas; la API exige módulo en toda alta nueva.
5. **La clave de las variables nuevas es `modulo.namespace.clave`.** El primer
   segmento es la clave del módulo elegido, el segundo agrupa dentro del módulo y
   el tercero identifica la variable. Cada segmento admite minúsculas, números y
   guion bajo: al capturar, los espacios se vuelven `_` y los signos se descartan.
   Es una validación de formato, no un reemplazo del texto: `clave` sigue siendo
   un único campo `NVARCHAR(200)`.
6. **Las variables existentes conservan su formato.** Sus claves `namespace.clave`
   de dos segmentos siguen válidas y se siguen mostrando y editando; solo se
   exige el formato de tres segmentos al crear.
7. **El módulo no cambia después de crear la variable.** Mover una variable de
   módulo cambiaría el significado de su clave; si se necesita, se crea otra
   variable con la clave nueva y se desactiva la anterior (la misma regla de
   `clave` inmutable del ADR 00001).
8. **Desactivar un módulo no desactiva sus variables.** Corta las altas nuevas en
   ese módulo y las validaciones de la API lo rechazan con un mensaje explícito;
   las variables vigentes se siguen leyendo en runtime. «global» no se puede
   desactivar.
9. **No se crean permisos nuevos.** El CRUD de módulos reutiliza
   `configuracion.view`, `configuracion.create` y `configuracion.update`: quien
   administra variables administra sus módulos. No hay permiso inventado para una
   tabla de catálogo.
10. **El módulo se administra desde la misma pantalla.** Pestaña **Módulos**,
    botón verde **Administrar módulos** junto a «Crear variable», filtro por
    módulo y columna «Módulo» en la tabla de variables. El módulo es el primer
    campo del paso 2 del asistente.
11. **Cada módulo tiene un color identificador.** `config.modulos.color` guarda
    un hex `#rrggbb` editable; el alta propone uno al azar de la paleta y la
    pantalla lo muestra en la tarjeta del módulo y en la columna «Módulo» de la
    tabla de variables.

## Fase 1 — Catálogo de módulos

`config.modulos` guarda `id_modulo` (identity), `clave` (único, CHECK de slug),
`nombre`, `descripcion`, `color` (hex `#rrggbb`), `activo`, las columnas de
auditoría del módulo (`fecha_creacion`, `fecha_modificacion`,
`id_usuario_creacion`, `id_usuario_modificacion`) y `row_version`. Lleva un índice
único de `clave` para impedir dos módulos con el mismo prefijo.

Se descartó un campo manual de orden: se probó en la primera versión y se retiró
porque obligaba a una decisión extra al crear un módulo sin aportar nada; el
catálogo se ordena por nombre.

Se descartó reutilizar los namespaces que ya existen en las claves: son texto
libre que nace de cada variable, no tienen baja ni orden, y no sirven como
catálogo administrable. Se descartó también una tabla puente muchos-a-muchos: una
variable pertenece a un solo módulo, porque el módulo define el prefijo de su
clave.

## Fase 2 — Módulo global

El módulo «global» representa las variables compartidas por todas las
aplicaciones. Es el destino del backfill (`UPDATE ... WHERE id_modulo IS NULL`) y
el respaldo de la lectura cuando una fila antigua restaurara sin módulo. La API
lo protege de la baja y la pantalla lo marca con la etiqueta «Base» sin botón de
desactivar.

## Fase 3 — Clave de tres segmentos

El formato se valida en dos lugares con la misma expresión
(`^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2}$`): el diálogo del frontend y el
servicio del backend. Además, el servicio comprueba que el primer segmento sea la
clave del módulo elegido, para que el catálogo no se contradiga con la clave
guardada.

La validación es solo para altas. Al editar, la clave no se toca (es inmutable
desde el ADR 00001) y las variables de dos segmentos siguen siendo válidas.

## Fase 4 — Inmutabilidad y bajas

- Crear exige módulo existente y activo.
- Editar solo acepta `nombre` y `descripcion`.
- Desactivar/reactivar es un cambio de bandera con auditoría, no un borrado.
- «global» responde con error de validación si se intenta desactivar.

## Fase 5 — API y permisos

`api/configuracion/modulos` expone listar (con `activo` opcional y conteo de
variables por módulo), crear, actualizar, desactivar y reactivar. El listado
incluye `totalVariables` para que la pantalla muestre el peso de cada módulo sin
una segunda consulta. La obtención de variables acepta `idModulo` en los filtros
para que el catálogo filtre del lado del servidor.

## Fase 6 — Pantalla

La pantalla de Configuración suma la pestaña **Módulos** con un tablero de tarjetas
(nombre y clave, estado, variables ligadas, última actualización y acciones), el
botón verde **Administrar módulos** en la barra de acciones, el filtro por módulo y
la columna «Módulo» con la clave monoespaciada. El asistente pide el módulo antes
que el namespace y la vista previa de la clave final arma
`modulo.namespace.clave`. En el alta del módulo el nombre va antes que la clave,
que se genera desde el nombre con un botón.

## Fase 7 — Script de esquema

`lefarma.database/configuracion/0003_20261119-1620_configuracion_modulos.lefarma.sql`
es idempotente y va en **un solo lote sin `GO`**, con las sentencias que tocan la
columna nueva en SQL dinámico: así lo aceptan SSMS, el panel «Explorador SQL» y el
migrador DbUp. Se aplica antes de publicar el backend que consulta la tabla.

## Fase 8 — Color de módulo

Cada módulo lleva `color`, un hex `#rrggbb` que lo identifica visualmente en la
pantalla principal: el tile de la tarjeta del módulo y el punto de la columna
«Módulo» de la tabla de variables. Se eligió un color guardado y no uno derivado
de la clave porque el usuario debe poder seleccionarlo; el derivado solo queda
como respaldo de lecturas antiguas sin color.

- La paleta vive en el frontend (`colores.ts`) y el backend replica los mismos
  valores para elegir uno al azar cuando el alta no envía color.
- El selector es un componente shadcn construido con `Popover` + paleta +
  `<input type="color">` + hex editable, sin añadir dependencias.
- La API valida `^#[0-9a-fA-F]{6}$` y guarda en minúsculas; la base refuerza el
  formato con `CK_config_modulos_color_formato`.
- `lefarma.database/configuracion/0004_20261120-1130_configuracion_modulos_color.lefarma.sql`
  agrega la columna, hace backfill («global» conserva el naranja de la casa) y
  deja el campo listo antes de publicar el backend que lo lee.

## Validación

- Esquema aplicado en LefarmaDev; verificado por consulta: `config.modulos` con
  una fila («global»), `config.variables.id_modulo` presente, FK
  `FK_config_variables_modulos` e índice `IX_config_variables_id_modulo` creados.
- API nueva probada contra LefarmaDev: `GET /api/configuracion/modulos` devuelve
  «global» con `totalVariables: 0`; `GET /api/configuracion/variables` responde
  vacío; un alta con clave inválida responde 400 con el mensaje de formato.
- Backend compila (0 errores). Frontend: `tsc`, `eslint` con `--max-warnings 0`,
  19 pruebas de vitest y `npm run build` en verde.
- Aplicado también en productivo (`Lefarma`): tabla, «global», FK e índice, sin
  la columna `orden`. Verificado por consulta tras ejecutarlo.
- En `LefarmaDev` se retiró la columna `orden` con un relanzamiento del script;
  la tabla queda con las 11 columnas definitivas (la última, `color`).
- Color: backend compila (`dotnet build`), `tsc`, `eslint` de los archivos
  tocados y `npm run build` en verde. El script `0004` queda pendiente de
  ejecución en LefarmaDev y Lefarma; no se declara aplicado hasta que el humano
  lo ejecute desde la Bandeja.

## Consequences

- **Positivas.** Las variables dejan de agruparse por texto y pasan a tener dueño
  administrable; el filtro es por llave foránea y no por prefijo; la pantalla
  puede dar de baja módulos sin tocar variables; la clave nueva documenta por sí
  sola a qué módulo pertenece.
- **Negativas.** Toda alta nueva debe elegir módulo: un paso más en el asistente.
  Cambiar de módulo obliga a crear otra variable. Las claves de dos y tres
  segmentos conviven, así que un consumidor no puede asumir siempre tres partes.
- **Neutras.** La columna `id_modulo` es opcional en la base para no romper
  restauraciones antiguas; la obligación vive en la aplicación.

## Anexo — Fuentes

- `lefarma.database/configuracion/0003_20261119-1620_configuracion_modulos.lefarma.sql`
- `lefarma.database/configuracion/0004_20261120-1130_configuracion_modulos_color.lefarma.sql`
- `lefarma.docs/configuracion/decisiones/00001_esquema-variables-configuracion.md`
- `lefarma.docs/configuracion/uso.md`
- Implementación backend: `Features/Configuracion/ConfiguracionModulosController.cs`,
  `ConfiguracionModulosService.cs`, `IConfiguracionModulosService.cs`,
  `DTOs/ConfiguracionModulosDtos.cs`.
- Implementación frontend: `apps/baseapp/configuracion/components/ModulosPanel.tsx`,
  `ModuloEditorDialog.tsx`, `ColorPickerModulo.tsx`,
  `pages/ConfiguracionVariablesPage.tsx`, `components/VariableEditorDialog.tsx`,
  `utils.ts`, `colores.ts`, `types.ts`,
  `services/configuracionAdminApi.ts`.
