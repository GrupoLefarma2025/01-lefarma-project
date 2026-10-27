# Tareas - 00022 Frontend Calendario: vista Tabla / Matriz

> Implementa la vista Tabla/Matriz dentro del calendario de [[tareas/00021_frontend-calendario-planeacion-unificado]].
> Depende de [[tareas/00021_frontend-calendario-planeacion-unificado]] y de la API de calendario.
> No sustituye la pantalla de autorización de la matriz (ADR-00007/00018); la complementa como vista operativa.

## Alcance

El calendario tendrá un selector de vista:

`[Calendario] [Tabla] [Matriz]`

- **Calendario:** las vistas Día/Semana/Mes/Por especialista/Por ejecutivo de 00021.
- **Tabla:** la misma data filtrada del calendario, en filas y columnas tipo Excel.
- **Matriz:** agrupación por gerencia/ejecutivo con totales, productos, cantidades y costos; solo lectura operativa y acceso a la matriz autorizable.

La vista Tabla/Matriz comparte filtros, período y selección con el calendario; no crea otra pantalla ni otra fuente de verdad.

## Fase 0 - Decisiones

- [ ] Confirmar que la matriz autorizable sigue en `MatrizTalleresPage` (costos, firmas, workflow).
- [ ] Confirmar que el tab Matriz es una vista operativa/read-only salvo permiso de costos.
- [ ] Confirmar columnas y agrupaciones con el usuario.

## Fase 1 - API y tipos

- [ ] Reutilizar `CalendarioItem` y `CalendarioFiltro` de 00021.
- [ ] Agregar agregados de tabla:
  - [ ] Total de talleres, pendientes, conflictos.
  - [ ] Totales por producto/cantidad/costo cuando existan.
  - [ ] Agrupación por gerencia/región/ejecutivo.
- [ ] Reutilizar endpoints de matriz/costos existentes; no duplicar lógica.
- [ ] Definir exportación CSV/XLSX si ya existe un helper; si no, dejarla como follow-up.

## Fase 2 - Vista Tabla

- [ ] Crear `CalendarioTabla`.
- [ ] Columnas:
  - [ ] No.
  - [ ] Región.
  - [ ] Institución.
  - [ ] Estado.
  - [ ] Ciudad/Municipio.
  - [ ] Hospital.
  - [ ] No. de participantes.
  - [ ] Ejecutivo.
  - [ ] Especialista.
  - [ ] Fecha.
  - [ ] Hora.
  - [ ] Producto.
  - [ ] Cantidades.
  - [ ] Costos.
  - [ ] Estado/candado.
- [ ] Orden por fecha, hora, especialista y hospital.
- [ ] Filtros compartidos con el calendario.
- [ ] Selección de fila abre el mismo inspector del calendario.
- [ ] Acciones contextuales limitadas por candado/permiso.
- [ ] Responsive: scroll horizontal con columnas fijas (hospital/fecha) y cards en móvil.

## Fase 3 - Vista Matriz

- [ ] Crear `CalendarioMatriz`.
- [ ] Agrupar por gerencia y ejecutivo; filas por hospital/taller.
- [ ] Mostrar fecha, hora, producto, cantidad, costo, ejecutivo, especialista y estado.
- [ ] Totales por grupo y total general.
- [ ] Indicar candado por taller y solicitud pendiente.
- [ ] Enlace “Abrir matriz general” a `MatrizTalleresPage` para autorización/costos cuando el usuario tenga permiso.
- [ ] No permitir editar costos desde el calendario salvo que se decida reutilizar `MatrizCostosEditor` con permiso explícito.

## Fase 4 - Integración con el shell

- [ ] Persistir vista seleccionada (`calendario`/`tabla`/`matriz`) en query string.
- [ ] Mantener filtros y período al cambiar de vista.
- [ ] Resumen superior compartido entre vistas.
- [ ] “Nuevo taller” y acciones del inspector funcionan igual desde Tabla/Matriz.
- [ ] En móvil, Tabla/Matriz muestran cards o tabla con scroll, sin romper el bottom sheet.

## Fase 5 - Verificación

- [ ] `npm run build`.
- [ ] `npm run lint`.
- [ ] Cambiar Calendario → Tabla → Matriz sin perder filtros.
- [ ] Verificar totales y filas contra la API.
- [ ] Verificar candado/solicitud pendiente en tabla y matriz.
- [ ] Verificar que “Abrir matriz general” respeta permisos.
- [ ] Prueba visual desktop/móvil.

## Fuera de alcance

- Reemplazar el workflow de autorización de la matriz.
- Reportes/indicadores (seguimiento).
- Exportación avanzada si no existe helper; anotar como follow-up.

## Estado de implementación (24-oct-2026)

Implementado dentro de CalendarioPage:

- [x] Selector superior Calendario / Tabla / Matriz, persistido en ?vista=tabla|matriz y con las cinco vistas del calendario en ?vista=semana|....
- [x] Los filtros, periodo, selección y resumen se comparten entre las tres vistas; cambiar de modo no pierde filtros.
- [x] CalendarioTabla: columnas No., Hospital, Región, Institución, Estado, Ciudad, Participantes, Ejecutivo, Especialista, Fecha/hora, Producto, Cantidad, Costo y Candado.
- [x] Orden por fecha/hora, hospital, región, ejecutivo, especialista y estado; columnas fijas de No./Hospital y encabezado fijo.
- [x] Selección de fila abre el mismo inspector; en móvil se muestran cards.
- [x] CalendarioMatriz: agrupación por gerencia y ejecutivo, filas por hospital/taller, totales de actividades, participantes y costo.
- [x] Marcas de extraordinario, bloqueado y solicitud pendiente en tabla y matriz.
- [x] Enlace "Abrir matriz general" visible solo con ducacion_medica.talleres.puede_ver; la matriz operativa es solo lectura.
- [x] Backend: CalendarioItemDto expone ciudadMunicipio y costo (suma de subtotales/costos de recursos cuando existen).

Pendientes:

- [ ] Exportación CSV/XLSX (no hay helper reutilizable verificado; queda como follow-up).
- [ ] Verificación de totales contra datos reales y prueba de roles/costos con la matriz autorizable.
- [ ] Definir si el costo debe ocultarse a roles sin acceso a costos; hoy el calendario lo devuelve a quien tenga utas.puede_ver.