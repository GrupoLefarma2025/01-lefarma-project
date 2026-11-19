# Tareas — 00002 Módulos de configuración

> Vinculada a: [[decisiones/00002_modulos-variables-configuracion]]
>
> **Estado (2026-11-19)**: esquema aplicado y verificado en `LefarmaDev` y en
> `Lefarma` (productivo); backend y frontend implementados y compilando. Falta el
> smoke test en navegador con una sesión autorizada.

## Fase 0 — Contratos y alcance

- [x] Catálogo de módulos con clave slug única y editable solo en la creación.
- [x] Módulo «global» como destino por omisión y protegido de la baja.
- [x] Vínculo `config.variables.id_modulo` con FK e índice.
- [x] Clave de tres segmentos `modulo.namespace.clave` solo en altas.
- [x] Las variables de dos segmentos siguen vigentes.
- [x] Reutilizar los permisos `configuracion.view/create/update`; sin permisos nuevos.
- [x] Contrato HTTP de administración de módulos y filtro `idModulo`.

## Fase 1 — Base de datos

- [x] `config.modulos` con auditoría, `row_version`, CHECK de slug e índices.
- [x] Seed idempotente del módulo «global».
- [x] `config.variables.id_modulo` con FK `FK_config_variables_modulos`.
- [x] Índice `IX_config_variables_id_modulo (id_modulo, clave)`.
- [x] Backfill de las variables existentes a «global».
- [x] Script en un solo lote sin `GO`, con SQL dinámico para la columna nueva.
- [x] Sin campo manual de orden: el catálogo se ordena por nombre.
- [x] **Aplicado en `LefarmaDev`** (Bandeja `Q-20261119-163418-b0d2`, ok).
- [x] Verificado en `LefarmaDev`: tabla, fila global, columna, FK e índice.
- [x] **Aplicado en `LefarmaDev`**: columna `orden` retirada (Bandeja `Q-20261119-165601-66a1`, ok; tabla con 10 columnas).
- [x] **Aplicado en `Lefarma` (productivo)**: Bandeja `Q-20261119-164511-441c`, ok; verificado tabla, «global» e `id_modulo`.

## Fase 2 — Backend

- [x] Entidad `ConfigModulo` y su configuración EF; `DbSet` en el contexto.
- [x] `ConfigVariable.IdModulo` + navegación y configuración EF.
- [x] `IConfiguracionModulosService` y `ConfiguracionModulosService`.
- [x] `ConfiguracionModulosController` en `api/configuracion/modulos`.
- [x] Validaciones: clave slug, nombre, descripción, duplicados, «global» sin baja.
- [x] Listado con `totalVariables` por módulo.
- [x] Variables: filtro por `idModulo`, módulo obligatorio y clave de tres
      segmentos con prefijo del módulo en las altas.
- [x] Registro en DI.
- [x] Compila sin errores.

## Fase 3 — Frontend

- [x] Tipos y cliente de API de módulos.
- [x] `ModulosPanel` con tablero de tarjetas, estados y confirmación de baja/reactivación.
- [x] `ModuloEditorDialog` para crear y editar módulos.
- [x] Pestaña **Módulos** y botón verde **Administrar módulos**.
- [x] Filtro por módulo y columna «Módulo» en el listado de variables.
- [x] Selector de módulo como primer campo del paso 2 del asistente.
- [x] Vista previa de la clave final `modulo.namespace.clave`.
- [x] Variables de dos segmentos se siguen editando sin tocar su clave.
- [x] `tsc`, `eslint --max-warnings 0`, vitest y `npm run build` en verde.

## Fase 4 — Verificación funcional

- [x] API contra `LefarmaDev`: `GET /api/configuracion/modulos` devuelve «global».
- [x] API: `GET /api/configuracion/variables` responde vacío sin error.
- [x] API: alta de módulo con clave inválida responde 400 con mensaje de formato.
- [ ] Smoke test en navegador: crear módulo, crear variable y filtrar por módulo.
- [ ] Revisar que un usuario sin `configuracion.create` no ve los botones de alta.

## Fase 5 — Operación

- [x] Aplicar el esquema antes de publicar el backend en cada ambiente.
- [ ] Aplicar en productivo y publicar allí cuando se autorice.
- [x] Procedimiento de uso actualizado en `uso.md`.
