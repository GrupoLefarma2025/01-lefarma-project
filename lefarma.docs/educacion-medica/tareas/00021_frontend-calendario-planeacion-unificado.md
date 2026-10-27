# Tareas - 00021 Frontend Calendario unificado de planeación

> Implementa el frontend de [[decisiones/00016_calendario-planeacion-talleres]], [[decisiones/00015_reparto-ejecutivo-rutas-especialista]] y [[decisiones/00018_candado-solicitudes-matriz]].
> Depende de [[tareas/00020_frontend-seleccion-ejecutivo-suplente]] y de la API de calendario/rutas ya implementada.
> **Absorbe** `RutasPage`, `MiPlaneacionPage` y `MisTalleresPage`; no se crean pantallas separadas para esas funciones.
> La vista Tabla/Matriz dentro del calendario se detalla en [[tareas/00022_frontend-calendario-vista-tabla-matriz]].

## Principios

- **Calendario primero:** el usuario trabaja sobre el tiempo y el territorio, no sobre una tabla de registros.
- **Una sola pantalla** para planeación + talleres + solicitudes. La matriz de autorización y los reportes viven aparte; la vista Tabla/Matriz operativa es un tab.
- **El sistema propone, el humano dispone:** sugiere especialista por cercanía/carga, pero permite arrastrar o seleccionar.
- **Mobile-first para ejecutivos:** agenda, no grid; bottom sheet, no panel lateral.
- **Permisos visibles:** lo que no se puede editar se ve deshabilitado con candado, no desaparece.

## Layout desktop (tres zonas)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Calendario · Octubre 2026   [Día] [Semana] [Mes] [Por especialista] [Por ejecutivo] │
│ Filtros: Gerencia · Región · Especialista · Ejecutivo · Estado   [+ Nuevo taller] │
│ Resumen: 18 talleres · 4 pendientes · 2 conflictos   [Enviar a autorización] [⋯] │
├──────────────────┬───────────────────────────────────────────┬─────────────────┤
│ IZQUIERDA        │ CALENDARIO                                │ DERECHA         │
│ Buscar...        │  Lun 20   Mar 21   Mié 22   Jue 23  Vie 24│ Actividad /     │
│ Hoy              │  07:00    [Taller] [Taller]               │ Solicitudes (2) │
│ Esta semana      │  08:00    [Taller]                        │                 │
│ Solicitudes (2)  │  ...                                      │ Inspector       │
│ Mis talleres     │                                           │ del taller      │
│ EJECUTIVOS       │                                           │                 │
│ ● Alma   12      │                                           │ [Editar]        │
│ ● Víctor  8      │                                           │ [Reasignar]     │
│ ESPECIALISTAS    │                                           │ [Solicitar]     │
│ ● Roberto 14     │                                           │                 │
│ Próximo taller   │                                           │                 │
└──────────────────┴───────────────────────────────────────────┴─────────────────┘
```

- **Izquierda (240 px, colapsable):** buscador global, accesos Hoy/Esta semana/Solicitudes/Mis talleres, ejecutivos con color y conteo, especialistas con color y carga, card “Próximo taller”.
- **Centro (flexible):** vistas Día/Semana/Mes/Por especialista/Por ejecutivo; tarjetas con hora, hospital, iniciales de ejecutivo, color del especialista, estado e iconos de extraordinario/conflicto/pendiente; cabecera de día con resumen.
- **Derecha (320–360 px, sticky):** sin selección, tabs Actividad reciente/Solicitudes pendientes; con taller, ficha completa y acciones contextuales; con día, resumen + “Agregar taller” + visitas.
- **Móvil:** agenda full-width; filtros y detalle en bottom sheet; “Próximo taller” fijo arriba; sin drag & drop.

## Fase 0 - Planificación

- [ ] Confirmar ruta final: `/educacion-medica/calendario` (mantener compatibilidad con enlaces viejos).
- [ ] Confirmar que `Mis talleres` será un filtro/atención personal dentro del calendario, no una página.
- [ ] Confirmar que `RutasPage` se retira y su contenido se integra; el print/export se conserva desde el calendario.
- [ ] Revisar wireframes de ADR-00016 y este layout con el usuario.
- [ ] Confirmar permisos nuevos o reutilizados para calendario/asignación.

## Fase 1 - API, tipos y datos

- [ ] Tipos `CalendarioItem`, `CalendarioFiltro`, `ConflictoCalendario`.
- [ ] Funciones API:
  - [ ] `GET /calendario` con filtros y rango.
  - [ ] `GET /calendario/{idRutaVisita}`.
  - [ ] `GET /rutas/sugerencias`.
  - [ ] `PUT /calendario/visitas/{id}/especialista`.
  - [ ] `PUT /rutas/{idRuta}/visitas/{idRutaVisita}/ejecutivo`.
  - [ ] `POST /talleres` con `idRutaVisita`.
  - [ ] Acciones de taller: editar, mover fecha, solicitar cambio, cancelar, historial.
- [ ] Normalizar nombres: `hospital`, `region`, `gerencia`, `institucion`, `nombreEjecutivo`, `nombreEspecialista`, `tipoVisita`, `tema`, `producto`, `cantidad`, `participantes`, `estado`, `bloqueado`, `solicitudCambioPendiente`, `conflictos`.
- [ ] Cargar catálogos de gerencia/región/ejecutivo/especialista para filtros.
- [ ] Estrategia de refresco: query cache, invalidación tras mutaciones y polling suave para solicitudes.

## Fase 2 - Shell y navegación

- [ ] Crear `pages/planeacion/CalendarioPage.tsx`.
- [ ] Componentes:
  - [ ] `CalendarioTopbar` (período, vistas, filtros, resumen, acciones).
  - [ ] `CalendarioRailIzquierdo`.
  - [ ] `CalendarioCentro`.
  - [ ] `CalendarioInspector`.
  - [ ] `CalendarioMovilAgenda`.
  - [ ] `CalendarioFiltrosSheet`.
- [ ] Reutilizar `MotivoDialog`, `HorasVisitaModal`, `TallerFormModal` y el patrón de `SolicitarCambioModal` cuando aplique.
- [ ] Reemplazar la ruta `calendario` de `MiPlaneacionPage` por `CalendarioPage`.
- [ ] Redirigir `seleccion/:id/rutas` al calendario con `idSeleccion` y, si aplica, `vista=especialista`.
- [ ] Retirar `MisTalleresPage` del menú; agregar acceso “Mis talleres” como filtro rápido.

## Fase 3 - Vistas

- [ ] `CalendarioSemana`: días Lun–Vie × horas 07:00–18:00.
- [ ] `CalendarioMes`: semanas × días, chips compactos.
- [ ] `CalendarioPorEspecialista`: filas especialistas × días; vista primaria para asignar y replicar Excel.
- [ ] `CalendarioPorEjecutivo`: filas ejecutivos × días; vista para Gerente de Ventas.
- [ ] `CalendarioDia`: agenda del día.
- [ ] Cabecera de día con resumen (talleres/pendientes/conflictos).
- [ ] Leyenda de estados/gerencias y colores de especialistas.
- [ ] Scroll horizontal en móvil/tablet solo si el usuario fuerza la vista de calendario.

## Fase 4 - Interacciones

- [ ] Drag & drop desktop:
  - [ ] Mover entre especialistas (vertical) y días (horizontal) en vista Por especialista.
  - [ ] Mover a día/hora en vista Semana.
  - [ ] Validación visual verde/rojo con motivo; confirmar antes de guardar.
  - [ ] Actualizar calendario e inspector después de guardar.
- [ ] Select móvil:
  - [ ] Reasignar especialista.
  - [ ] Reasignar ejecutivo de la visita.
  - [ ] Mover fecha/hora.
- [ ] Inspector:
  - [ ] Editar taller si `bloqueado = false` y hay permiso.
  - [ ] “Solicitar cambio” si `bloqueado = true` o no editable.
  - [ ] Crear taller si la visita no tiene taller.
  - [ ] Cancelar con motivo.
  - [ ] Historial.
- [ ] “Enviar a autorización” sobre la matriz del período/gerencia; si ya está autorizada, cambiar a “Solicitar cambio” por taller.
- [ ] Filtros y chips rápidos: Mis talleres, Pendientes, Hoy, Conflictos.
- [ ] Búsqueda global por hospital/ejecutivo/especialista.
- [ ] Card “Próximo taller”.
- [ ] Resumen superior coherente con los filtros.

## Fase 5 - Roles y permisos

- [ ] CEM/GG/coordinador: todo.
- [ ] Gerente de Ventas: su gerencia/región y sus ejecutivos.
- [ ] Ejecutivo: solo sus talleres/visitas; crear taller, editar antes del candado, solicitar cambio después.
- [ ] Especialista: solo su calendario; consultar y solicitar cambio si se habilita.
- [ ] AEM/CA: calendario y matriz; costos/exportar; sin edición de calendario.
- [ ] Ocultar acciones sin permiso; mostrar candado explicativo en lugar de desaparecer cuando aplique.

## Fase 6 - Verificación

- [ ] `npm run build`.
- [ ] `npm run lint`.
- [ ] E2E desktop: ver calendario, filtrar, asignar especialista, asignar ejecutivo, crear taller, mover, solicitar cambio.
- [ ] E2E móvil: agenda, bottom sheet, reasignar, crear taller.
- [ ] E2E Puebla: especialista en Puebla miércoles → sugerencia jueves → aceptar → taller.
- [ ] E2E roles: CEM, GV, ejecutivo, especialista, AEM/CA.
- [ ] Verificar que `RutasPage`/`MiPlaneacionPage`/`MisTalleresPage` ya no son necesarias y que sus enlaces antiguos redirigen.

## Fuera de alcance

- Autorización/costos de la matriz general (se conserva en su pantalla; ver 00022 para el tab operativo).
- Notificaciones push.
- Modo offline.
- Drag & drop táctil.

## Estado de implementación (24-oct-2026)

Implementado en lefarma.frontend/src/apps/educacion-medica/pages/calendario/:

- [x] Ruta /educacion-medica/calendario reemplaza MiPlaneacionPage; acceso con utas.puede_ver.
- [x] Tipos CalendarioItem, CalendarioFiltro, SugerenciaEspecialista y AsignarEjecutivoVisitaRequest.
- [x] API de calendario: listado por rango/filtros, detalle, sugerencias, asignar especialista, asignar ejecutivo y crear taller desde visita.
- [x] Catálogos de gerencia, región, ejecutivos, suplentes y especialistas para filtros y rail.
- [x] Layout desktop de tres zonas: rail, calendario e inspector sticky; layout móvil con agenda diaria.
- [x] Vistas Día, Semana (Lun-Vie, 07:00-18:00), Mes, Por especialista y Por ejecutivo.
- [x] Arrastrar y soltar para cambiar fecha en Semana y Mes.
- [x] Inspector con detalle, conflictos, candado, reasignación de ejecutivo/especialista, reprogramación y creación de taller.
- [x] Filtros rápidos: Todo, Hoy, Mis talleres, Solicitudes, Conflictos y Sin taller; búsqueda global.
- [x] Filtros móviles en sheet inferior; agenda diaria en móvil y sin grid forzado.
- [x] Resumen de periodo, próxima actividad y agenda de hoy.
- [x] Acciones protegidas por permisos de rutas/talleres; vista de solo lectura cuando no aplica.
- [x] Mis talleres sale del menú y queda como filtro rápido; la ruta antigua se conserva por compatibilidad.
- [x] La selección mensual navega al calendario con idSeleccion y ista=especialista.

Pendientes para cerrar el alcance completo:

- [ ] Mover entre especialistas por drag & drop en la vista matricial.
- [ ] Cambiar hora al arrastrar en la vista Semana (hoy solo cambia la fecha).
- [ ] Editar taller, solicitar cambio, cancelar y consultar historial desde el inspector.
- [ ] Sheet de detalle en móvil (hoy el inspector aparece debajo de la agenda) y gesto de día.
- [ ] "Enviar a autorización" y polling de solicitudes pendientes.
- [ ] Redirección permanente de RutasPage a calendario conservando impresión/exportación.
- [ ] E2E desktop/móvil/roles y validación visual con datos reales.
## Corrección 24-oct-2026

- [x] Al abrir el calendario con `idSeleccion`, se carga el detalle de la selección y la fecha inicial se posiciona en `fechaInicioVigencia`.
- [x] Si la selección está `Cerrada` y no tiene rutas, se muestra un estado vacío con el botón **Generar propuesta de rutas**.
- [x] La generación permite elegir estrategia **Ciudad** o **Centroide** y refresca el calendario al terminar.
- [x] La acción solo se muestra con `rutas.puede_gestionar`; sin permiso se indica solicitar apoyo al planificador.
## Ajuste talleres en inspector (24-oct-2026)

- [x] Inspector con tabs **Detalle** y **Talleres**; la tab de talleres lista solo los talleres de la visita seleccionada.
- [x] La fecha del nuevo taller inicia con la fecha de la visita.
- [x] Si el usuario cambia la fecha, se crea otra visita para el mismo hospital en la misma ruta y el taller se liga a esa visita.
- [x] La creación de visita + taller se ejecuta en una sola transacción en backend.
- [x] En rutas cerradas se exige `rutas.puede_ajustar` y motivo; el ajuste se aplica directo con auditoría `ajustes_post_cierre`, sin autorización adicional.
- [x] `rutas.puede_ajustar` se mantiene exclusivo del CEM.
- [x] Si la visita ya tiene taller y se intenta crear otro en la misma fecha, la UI lo bloquea y pide cambiar la fecha.
- [x] El producto, cantidad, participantes, costo y estado del taller se muestran en el calendario; la matriz queda como acceso secundario.