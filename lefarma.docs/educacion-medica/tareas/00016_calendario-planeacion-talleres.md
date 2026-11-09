# Tareas — 00016 Calendario unificado de planeación y talleres

> Vinculada a: [[decisiones/00016_calendario-planeacion-talleres]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación.
> Dependencias: [[decisiones/00015_reparto-ejecutivo-rutas-especialista]] (ruta por especialista), [[decisiones/00017_tercera-gerencia-imss-bienestar]] (filtros/gerencia), [[decisiones/00018_candado-solicitudes-matriz]] (candado/solicitudes).
> Sustituye la pantalla principal de planeación; `Mi planeación`, `RutasPage` y `Mis talleres` se absorben como vistas/filtros del calendario (tarea 00021).

## Diagramas / wireframes

> Pendientes en `diagramas/` con numeración `000016_<tipo>_<nombre>`:

- [ ] `000016_wireframe_calendario_desktop.html` — tres paneles, vista Semana.
- [ ] `000016_wireframe_calendario_especialista.html` — vista Por especialista (Excel).
- [ ] `000016_wireframe_calendario_movil.html` — agenda + bottom sheet.
- [ ] `000016_flujo_calendario.html` — visita → sugerencia → asignación → taller → autorización.
- [ ] Opcional Mermaid `000016_flujo_calendario_mermaid.mmd/.svg`.

## Fase 0 — Planificación

- [x] Decisiones del usuario (2026-10-23): calendario único; vista por especialista; panel izquierdo/derecho; móvil; drag & drop/select; sugerencias; catálogos de tipo de visita/tema.
- [x] Crear ADR-00016 y esta tarea.
- [ ] Revisión del usuario del ADR-00016 y wireframes.
- [ ] Confirmar:
  - [ ] Ruta/nombre del menú: `/educacion-medica/planeacion` o “Calendario”.
  - [ ] ¿`Mis talleres` y `Mi planeación` quedan como tabs/vistas o se retiran?
  - [ ] ¿La matriz se abre desde el calendario con un botón o vive en su propia pantalla?
  - [ ] ¿El ejecutivo puede crear taller o solo solicitar? (permisos).
  - [ ] ¿El especialista confirma asignaciones o solo consulta?

## Fase 1 — Base de datos (script 0035)

> **Estado 2026-10-23:** script 0035 creado, validado con `PARSEONLY` + `NOEXEC` y ejecutado en LefarmaDev2. Se corrigió `CK_parametros_modulo_tipo` moviéndolo a SQL dinámico (el `ALTER TABLE ADD CONSTRAINT` referenciaba `tipo` en el mismo batch que lo agregaba).

- [x] Crear `lefarma.database/educacion-medica/0035_20261023-1200_educacion-medica_calendario-catalogos-parametros.lefarma.sql` (idempotente).
- [x] Catálogo `tipo_visita`:
  - [x] `id_tipo_visita`, `clave`, `descripcion`, `es_taller` BIT, `activo`, auditoría.
  - [x] Seed: `TALLER` (es_taller=1), `INFORMATIVA` (0), `CAPTACION_QUEJA` (0), `OTRO` (0).
- [x] Catálogo `tema_taller` (opcional):
  - [x] `id_tema_taller`, `clave`, `descripcion`, `activo`, auditoría.
  - [x] Sin seed inicial; si no se usa, el tema se toma del producto.
- [x] Columnas:
  - [x] `rutas_visitas.id_tipo_visita INT NULL` (FK a `tipo_visita`).
  - [x] `talleres.id_tema_taller INT NULL` (FK a `tema_taller`).
- [x] Parámetros:
  - [x] `parametros_modulo.tipo` (`numero`/`booleano`/`texto`/`enum`) y `valor_texto`.
  - [x] `producto_cantidad_default` = 2.
  - [x] `alcance_hospital_extraordinario` = `SELECCION` (ADR-00017).
  - [x] `matriz_requiere_autorizacion` = `true` (ADR-00018).
  - [x] `bloqueo_taller_automatico` = `true` (ADR-00018).
  - [x] `min_visitas_ejecutivo_semana` / `min_visitas_ejecutivo_mes` = 0 (0 = sin mínimo; definir con el área).
  - [x] `min_hospitales_por_zona` = 4.
  - [x] `min_hospitales_especialista_semana` = 4.
  - [x] `min_talleres_especialista_semana` = 6.
  - [x] `meta_talleres_mes_imss`, `meta_talleres_mes_bienestar`, `meta_talleres_mes_descentralizado` = 64.
- [x] `MS_Description` de tablas/columnas.
- [x] `PARSEONLY` exit 0.
- [ ] Revisión del usuario del script.
- [ ] Ejecutar en LefarmaDev2 y verificar seeds.
- [x] Actualizar `0016` para instalación limpia (tablas, columnas, FKs, parámetros base). `0030` se actualizará al ordenar los seeds de catálogos.

## Fase 2 — Backend

- [x] DTO `CalendarioItemDto` (ver ADR-00016).
- [x] `CalendarioController`:
  - [x] `GET /api/educacion-medica/calendario?desde&hasta&idGerencia&idRegion&idEjecutivo&idEspecialista&estado&tipoVisita`.
  - [x] `GET /api/educacion-medica/calendario/{idRutaVisita}`.
  - [x] `PUT /api/educacion-medica/calendario/visitas/{id}/especialista`.
  - [ ] `PUT /api/educacion-medica/calendario/visitas/{id}/fecha`.
  - [x] `POST /api/educacion-medica/calendario/talleres` (reutiliza `POST /talleres` con `idRutaVisita`).
  - [x] `GET /api/educacion-medica/calendario/sugerencias`.
  - [ ] `GET /api/educacion-medica/calendario/actividad`.
  - [ ] `POST /talleres/{id}/solicitudes-cambio` y resolver (reutiliza ADR-00018).
- [x] `CalendarioService`:
  - [x] Consulta unificada visitas + talleres.
  - [x] Filtros y orden.
  - [x] `bloqueado`/`solicitudCambioPendiente`.
  - [x] Cálculo de conflictos (choque de hora, capacidad, elegibilidad, hospital sin especialista).
  - [ ] Actividad reciente (altas/cambios/solicitudes).
- [ ] `AsignadorEspecialistasService`:
  - [ ] Sugerencia por ciudad/día.
  - [ ] Capacidad/elegibilidad.
  - [ ] Balanceo.
- [ ] Reutilizar `RutasService`/`TalleresService` para mover/crear.
- [ ] Tests:
  - [ ] Rango de fechas y filtros.
  - [ ] Sugerencia Puebla.
  - [ ] Asignación inválida por elegibilidad/capacidad.
  - [ ] Conflicto de hora.
  - [x] Crear taller desde visita.
  - [x] `bloqueado`/solicitud pendiente.
  - [ ] Actividad reciente.

## Fase 3 — Frontend

> Detalle de implementación: [[tareas/00021_frontend-calendario-planeacion-unificado]] (shell, vistas, inspector, móvil) y [[tareas/00022_frontend-calendario-vista-tabla-matriz]] (vista Tabla/Matriz). `RutasPage`, `MiPlaneacionPage` y `MisTalleresPage` se absorben en el calendario.

### 3.1 Shell

- [ ] Nueva `PlaneacionPage` y ruta en `EducacionMedicaRoutes.tsx`.
- [ ] `CalendarioShell`:
  - [ ] Topbar: período, vistas, filtros, resumen, acciones.
  - [ ] `RailIzquierdo`: búsqueda, accesos, ejecutivos, especialistas, próximo taller.
  - [ ] `CalendarioCentro`.
  - [ ] `InspectorDerecho`.
- [ ] Responsive: drawer izquierdo, bottom sheet derecho, agenda móvil.

### 3.2 Vistas

- [ ] `CalendarioSemana`: días × horas; tarjetas.
- [ ] `CalendarioMes`: semanas × días; chips (estilo Excel).
- [ ] `CalendarioPorEspecialista`: filas especialistas × días; vista primaria; drag & drop.
- [ ] `CalendarioPorEjecutivo`: filas ejecutivos × días.
- [ ] Tarjeta: hora, hospital, iniciales ejecutivo, avatar/color especialista, estado, iconos.
- [ ] Cabecera de día con resumen.
- [ ] Leyenda de colores/estados.

### 3.3 Inspector

- [ ] Default: tabs Actividad/Solicitudes.
- [ ] Detalle de taller/visita: ficha + acciones.
- [ ] Detalle de día: resumen + “Agregar taller”.
- [ ] Diff de solicitud y botones aprobar/rechazar (si autoriza).
- [ ] Historial del taller.

### 3.4 Interacciones

- [ ] Drag & drop desktop:
  - [ ] Mover visita entre especialistas/días.
  - [ ] Validación visual (verde/rojo) y motivo.
  - [ ] Confirmación y actualización.
- [ ] Select móvil:
  - [ ] Reasignar especialista.
  - [ ] Mover fecha/hora.
- [ ] Crear taller desde visita/día.
- [ ] Modal `TallerFormModal`: sin equipo, con especialista, producto default 2, tipo de visita/tema.
- [ ] “Enviar a autorización” / “Solicitar cambio” (ADR-00018).
- [ ] Filtros y chips rápidos.
- [ ] Búsqueda global.
- [ ] Próximo taller.

### 3.5 Roles

- [ ] CEM/GG/coordinador: todo.
- [ ] Gerente de Ventas: su gerencia/región.
- [ ] Ejecutivo: solo lo suyo; móvil.
- [ ] Especialista: solo su calendario.
- [ ] AEM/CA: lectura + matriz/costos.
- [ ] Guards de permisos y menú.

### 3.6 Verificación

- [ ] `npm run build`.
- [ ] `npm run lint`.
- [ ] Prueba visual desktop/móvil.
- [ ] Accesibilidad básica: foco, teclado, contraste.

## Fase 4 — Verificación y cierre

- [ ] E2E desktop: ver calendario, filtrar, asignar especialista, crear taller, mover, solicitar cambio.
- [ ] E2E móvil: agenda, bottom sheet, reasignar, crear taller.
- [ ] E2E sugerencia Puebla: especialista en Puebla miércoles → sugerencia jueves → aceptar → taller.
- [ ] E2E roles: CEM, GV, ejecutivo, especialista, AEM/CA.
- [ ] E2E tercera gerencia (ADR-00017).
- [ ] `dotnet test`, `npm run build`, `npm run lint` en verde.
- [ ] Actualizar `reglas-negocio.md` §5.14 y `presentacion-proceso.md` §6.2.
- [ ] Marcar ADR-00016 como `Accepted` al aprobarse.

## Pendientes fuera de alcance

- [ ] FOR-006 (calendario mensual del AEM) como pantalla propia o fundido en la matriz (ADR-00013, Fase 5).
- [ ] Notificaciones push móviles.
- [ ] Modo offline.
- [ ] Drag & drop táctil.
