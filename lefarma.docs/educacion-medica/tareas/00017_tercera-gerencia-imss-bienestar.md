# Tareas — 00017 Tercera gerencia IMSS Bienestar y clasificación de hospitales

> Vinculada a: [[decisiones/00017_tercera-gerencia-imss-bienestar]]
> Misma división por fases que la decisión: 0 Validación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación.
> Dependencias: [[decisiones/00015_reparto-ejecutivo-rutas-especialista]] (selección/rutas), [[decisiones/00016_calendario-planeacion-talleres]] (filtros), [[decisiones/00018_candado-solicitudes-matriz]] (matriz).
> Sustituye el alcance fijo de [[decisiones/00011_hospitales-extraordinarios]]; el mecanismo de visita/taller extraordinario se conserva.

## Diagramas

> Pendientes en `diagramas/` con numeración `000017_<tipo>_<nombre>`:

- [ ] `000017_flujo_clasificacion_gerencias.html` — genContactosCat → sugerencia → revisión → hospital_extension.
- [ ] `000017_er_tercera_gerencia.html` — tipo_gerencia, regiones, hospital_extension.
- [ ] Opcional Mermaid `000017_flujo_clasificacion_gerencias_mermaid.mmd/.svg`.

## Fase 0 — Validación

- [x] Decisiones del usuario (2026-10-23): existe tercera gerencia; mapeo a investigar; extraordinario parametrizable default `SELECCION`.
- [x] Investigación externa: IMSS ordinario vs IMSS-Bienestar (DOF 31-08-2022; integración 2025).
- [x] Crear ADR-00017 y esta tarea.
- [ ] Revisión del usuario del ADR-00017.
- [ ] Ejecutar consulta read-only en Asokam:
  ```sql
  SELECT codigoContactoPrincipal, COUNT(*) AS unidades
  FROM Asokam.dbo.genContactosCat
  GROUP BY codigoContactoPrincipal
  ORDER BY unidades DESC;

  SELECT codigoContacto, nombreContacto, tipo, codigoContactoPrincipal, clues
  FROM Asokam.dbo.genContactosCat
  WHERE codigoContacto IN (364, 385)
     OR codigoContactoPrincipal IN (364, 385)
  ORDER BY codigoContactoPrincipal, nombreContacto;
  ```
- [ ] Revisar:
  - [ ] ¿Todo 385 es IMSS-Bienestar o incluye secretarías estatales?
  - [ ] ¿Hay hospitales “BIENESTAR” colgados de 364?
  - [ ] ¿Hay hospitales IMSS-Bienestar con otro padre?
  - [ ] ¿El CLUES confirma la institución? (catálogo DGIS agosto 2026)
- [ ] Decidir:
  - [ ] Regla 385 completo o lista curada/CLUES.
  - [ ] Nombre de la gerencia: “IMSS Bienestar”.
  - [ ] Regiones: copiar Descentralizado y ajustar.
  - [ ] Metas por gerencia (64 cada una o distinto).
- [ ] Conteo informativo por gerencia (sin backfill; la clasificación se hace en Hospitales).

## Fase 1 — Base de datos (script 0034)

> **Estado 2026-10-23:** script 0034 creado; `PARSEONLY` exit 0. No ejecutado.
> `alcance_hospital_extraordinario` se siembra en 0035 porque requiere `tipo`/`valor_texto` en `parametros_modulo`.

- [x] Crear `lefarma.database/educacion-medica/0034_20261023-1100_educacion-medica_tercera-gerencia-imss-bienestar.lefarma.sql` (idempotente, transacción única).
- [x] Insertar `IMSS Bienestar` en `tipo_gerencia` (idempotente por `descripcion`).
- [x] Regiones:
  - [x] Copiar `regiones_cat` de Descentralizado a IMSS Bienestar (`INSERT ... SELECT` con el nuevo id).
  - [x] Copiar `regiones_estados` de Descentralizado a IMSS Bienestar.
  - [ ] Ajustar nombres/estados según operación (manual, con el área).
- [x] **Sin backfill de hospitales** (decisión 2026-10-23): 0034 no reclasifica `hospital_extension`; los datos operativos se limpian con 0037 y la gerencia se asigna desde la pantalla Hospitales.
  - [ ] Definir con el área la regla de clasificación (385 vs CLUES/lista curada) para la pantalla de revisión.
  - [x] Reporte de verificación al final del script (comentado), sin updates de datos.
- [x] `MS_Description` de la nueva gerencia y regiones.
- [x] `PARSEONLY` exit 0.
- [ ] Revisión del usuario del script.
- [ ] Ejecutar en LefarmaDev2 y verificar conteos por gerencia.
- [ ] Actualizar `0016`/`0030` para instalación limpia (0016 no siembra catálogos; 0030 se actualizará con la tercera gerencia cuando se decida el orden de seeds).

## Fase 2 — Backend

- [ ] `HospitalService.ClasificarTipoGerencia`: 385/child → `IMSS Bienestar`; 364 → `IMSS`; 370/resto → `Descentralizado`; Privado → `Privado`.
- [ ] `HospitalRepository`/filtros: la gerencia `IMSS Bienestar` se usa en selección, ranking, matriz y reportes; el filtro de institución `bienestar` (385) se mantiene separado.
- [ ] `WorkflowService`: id 3 = “IMSS Bienestar”; mapping `TIPO_GERENCIA` 3.
- [ ] Workflows:
  - [ ] `EDUCACION_MEDICA_SELECCION` variante IMSS Bienestar.
  - [ ] `EDUCACION_MEDICA_MATRIZ` variante IMSS Bienestar.
  - [ ] Rutas no lleva variante (draft sin workflow).
  - [ ] Mappings/participantes se configuran en el admin (manual, documentado).
- [ ] `SeleccionMensualService`: acepta `id_tipo_gerencia = 3`; valida ejecutivos de la gerencia.
- [ ] `MatrizTalleresService`: matriz por gerencia 3; vista consolidada.
- [ ] Extraordinario:
  - [ ] Leer `alcance_hospital_extraordinario` de parámetros.
  - [ ] Validar hospital según alcance (`EJECUTIVO`/`GERENCIA`/`SELECCION`/`CATALOGO`).
  - [ ] `id_seleccion_hospital` NOT NULL salvo `CATALOGO` sin selección.
  - [ ] Motivo obligatorio y auditoría.
- [ ] Tests:
  - [ ] 364 → IMSS; 385 → IMSS Bienestar; 370 → Descentralizado; Privado → Privado.
  - [ ] Selección/matriz con gerencia 3.
  - [ ] Extraordinario en cada alcance.
  - [ ] No regresión de IMSS/Descentralizado.

## Fase 3 — Frontend

- [ ] Pantalla **Clasificación de gerencias** (o columna en Hospitales):
  - [ ] Tabla: hospital, CLUES, padre, institución, sugerida, asignada, origen.
  - [ ] Filtros: gerencia sugerida/asignada, institución, estado, sin clasificar.
  - [ ] Acción individual/masiva de override.
  - [ ] Conteos y diferencias.
- [ ] `RegionesPage`: tercera gerencia visible; filtro/columna.
- [ ] `SeleccionMensualPage`: selector de gerencia con 3 opciones; ejecutivos filtrados.
- [ ] `MatrizTalleresPage`: filtro/columna IMSS Bienestar.
- [ ] `ParametrosPage`: `alcance_hospital_extraordinario` como select; metas por gerencia.
- [ ] `TallerFormModal`: búsqueda de hospital según alcance de extraordinario; aviso del alcance.
- [ ] `npm run build` y `npm run lint`.

## Fase 4 — Verificación y cierre

- [ ] Conteos por gerencia antes/después; revisar muestra de 20 hospitales.
- [ ] E2E: crear selección IMSS Bienestar → ejecutivo → ruta → taller → matriz.
- [ ] E2E: extraordinario en `EJECUTIVO`, `GERENCIA`, `SELECCION`, `CATALOGO`.
- [ ] E2E: workflow de selección/matriz con la tercera gerencia.
- [ ] `dotnet test`, `npm run build`, `npm run lint` en verde.
- [ ] Actualizar `reglas-negocio.md` §5.8/§5.13 y `presentacion-proceso.md`.
- [ ] Marcar ADR-00011 como `Superseded by ADR-00017` (ya hecho) y ADR-00017 como `Accepted` al aprobarse.
- [ ] Actualizar ER/diagramas.

## Pendientes fuera de alcance

- [ ] Lista curada/CLUES si 385 no es suficiente.
- [ ] Metas definitivas por gerencia.
- [ ] Revisión de reportes históricos (128 vs 192).
- [ ] Limpieza de regiones duplicadas si se copian de más.
