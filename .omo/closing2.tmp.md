## Commit strategy

**Ningun commit automatico.** `odd/tasks/costos-ruta-formulario.md` declara literalmente "NO commits while iterating" y "No stage, reset, commit, push, remote calls, or PR creation". Cada todo lleva `Commit: N`.

Cuando el usuario autorice commits, la unidad es **un todo = un commit** (implementacion + test juntos, nunca separados por tipo de archivo), mensajes en espanol, sin atribucion de IA:

1. `feat(viaticos): permisos de solicitud, autorizacion y ajuste`
2. `fix(viaticos): mover el geocodificado a un proxy conforme a la politica de Nominatim`
3. `feat(viaticos): buscador global y cascada como caminos de primera clase`
4. `feat(viaticos): modal de mapa con secuencia de puntos y polylinea`
5. `feat(viaticos): endpoint de capturas de pantalla con lista blanca de dominios`
6. `feat(viaticos): API de solicitudes con identidad del solicitante`
7. `feat(viaticos): API de autorizacion y ajustes con registro de auditoria`
8. `chore(db): esquema de solicitudes, opciones, ajustes y eventos`
9. `docs(viaticos): prompt de pi y esquema de la cotizacion de viajes`
10. `feat(viaticos): capturas de pantalla con Playwright`
11. `feat(viaticos): wizard de cuatro pasos para capturar el viaje`
12. `feat(viaticos): tablas comparables de vuelos y hoteles con fuente y captura`
13. `feat(viaticos): importar la cotizacion de pi y enviar la solicitud`
14. `feat(viaticos): bandeja de autorizacion con acciones por solicitud`
15. `feat(viaticos): ver opciones no elegidas con sus capturas`
16. `feat(viaticos): ajustar costos y vuelo con motivo obligatorio`
17. `feat(viaticos): concentrado con formato ASK-ADM-FOR-008`
18. `docs(viaticos): ADR-00004 y fixtures de regresion de octubre`

## Success criteria

| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | T4 | Wizard recorre los 4 pasos con origen valido; no avanza sin origen | `.omo/evidence/task-4-*.xml` + `final-f3-*.png` pasos 1-2 |
| IS-2 | T2, T3 | Buscador global y cascada各自 responden; ambos tabs visibles | `.omo/evidence/task-2-*.xml`, `task-3-*.xml` + F3 pasos 2-3 |
| IS-3 | T3 | 3 puntos producen 3 marcadores numerados y polylinea de 2 segmentos; clic inserta N+1 | `.omo/evidence/task-3-*.xml` + F3 paso 4 |
| IS-4 | T5, T6, T7, T8, T10 | Tabla de vuelos y hoteles con link funcional, miniatura y columna fuente | `.omo/evidence/task-5-*.xml`, `task-10-*.xml` + F3 pasos 6-7 |
| IS-5 | T9, T10 | La opcion elegida persiste con `fue_elegida`; las descartadas tambien | `.omo/evidence/task-9-*.xml`, `task-10-*.xml` |
| IS-6 | T11 | Cada fila tiene Autorizar y Ver opciones; sin permiso el boton no existe | `.omo/evidence/task-11-*.xml` + F3 paso 8 |
| IS-7 | T14 | 5 opciones se ven las 5; las 3 descartadas bajo su encabezado y fuera del total | `.omo/evidence/task-14-*.xml` + F3 paso 9 |
| IS-8 | T13, T15 | Cambiar vuelo y agregar partida exigen motivo y dejan `valor_anterior`/`valor_nuevo` | `.omo/evidence/task-13-*.xml`, `task-15-*.xml` + F3 paso 10 |
| IS-9 | T16 | Concentrado de 20 filas reproduce el Excel: total `$276,357.00`, 4 firmas, pie `ASK-ADM-FOR-008` | `.omo/evidence/task-16-*.xml` + F3 paso 11 |
| IS-10 | T1, T9, T12 | Solicitud guardada con `id_usuario_solicitante` del token y `periodo` derivado del servidor | `.omo/evidence/task-9-*.xml`, `task-12-*.xml` |
| IS-11 | T5 | Oferta `estimado:true` y `estimado:false` se distinguen por badge y `fuente` visible | `.omo/evidence/task-5-*.xml` |
| IS-12 | T4, T17 | Tests preexistentes de `ViaticosPage` y `PuntoMapaPicker` siguen verdes sin borrarlos | `.omo/evidence/task-4-*.xml`, `task-17-*.xml` |
