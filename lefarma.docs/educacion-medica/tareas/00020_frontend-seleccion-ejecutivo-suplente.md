# Tareas - 00020 Frontend Selección Mensual: ejecutivo, suplente y override

> Implementa el frontend de [[decisiones/00015_reparto-ejecutivo-rutas-especialista]] para la selección.
> Depende de [[tareas/00019_frontend-personas-ejecutivos-suplentes]] y de los endpoints de `SeleccionEjecutivoController` ya implementados.
>
> **Estado 2026-10-23:** frontend implementado; `build` y `tsc` en verde. Falta prueba manual contra backend con `0038` aplicado.

## Alcance

- La selección deja de asignar **equipos** y asigna **ejecutivos** por región.
- El especialista por región es opcional (sugerencia/default).
- El override por hospital permite otro ejecutivo elegible de la misma región/gerencia.
- El suplente se puede elegir cuando no hay ejecutivo primario; se muestra como cobertura, no como primera sugerencia.
- `ResumenSeleccionModal` y `RegionesPanel` dejan de mostrar “Equipo”.

## Fase 1 - API y tipos

- [x] Agregar/actualizar tipos:
  - [x] `SeleccionRegion.idEjecutivo`, `nombreEjecutivo`, `idEspecialista`, `nombreEspecialista`.
  - [x] `SeleccionHospital.idEjecutivo`, `nombreEjecutivo`, `idEspecialista`, `nombreEspecialista`.
  - [x] `AsignarEjecutivoRegionRequest` (`idEjecutivo`, `idEspecialista?`).
  - [x] `AsignarEjecutivoHospitalRequest` (`idEjecutivo: number | null`).
- [x] Agregar funciones:
  - [x] `asignarEjecutivoRegion(idSeleccion, idRegion, payload)`.
  - [x] `asignarEjecutivoHospital(idSeleccion, idSeleccionHospital, payload)`.
- [x] Mantener `idEquipo` solo como campo legacy de lectura; no usarlo en formularios nuevos.

## Fase 2 - Selección por región

- [x] En `SeleccionMensualPage`, reemplazar el selector de equipo por:
  - [x] `EjecutivoSelect` filtrado por gerencia/región (primarios y suplentes).
  - [x] `EspecialistaSelect` opcional.
  - [x] Indicador “Suplente” si el ejecutivo elegido no es primario.
- [x] Mostrar en cada región: ejecutivo default, especialista sugerido y número de hospitales.
- [x] Validar en cliente que el ejecutivo pertenece a la misma región/gerencia; el backend sigue siendo la autoridad.
- [x] Bloquear edición si la selección no está `Creada`.
- [ ] Al cerrar/enviar a revisión, mostrar regiones sin ejecutivo primario y suplente candidato.
- [x] Mensaje visual de cobertura con suplente cuando aplique.

## Fase 3 - Override por hospital

- [x] En el detalle de hospital/región, agregar selector de ejecutivo por hospital.
- [x] Selector con:
  - [x] Ejecutivo actual (default de región u override).
  - [x] Opciones de ejecutivos primarios y suplentes elegibles.
  - [x] Opción “Heredar de la región” (`idEjecutivo = null`).
  - [x] Indicador de suplente en las opciones.
- [x] Mostrar badge “Override” en hospitales con `idEjecutivo` distinto al default.
- [x] Refrescar región/hospitales después de guardar.
- [x] Manejar 409 con mensaje del backend.
- [x] No permitir override fuera de una región (el selector vive dentro de la región).

## Fase 4 - Resumen y limpieza visual

- [x] `RegionesPanel`: quitar equipo, mostrar ejecutivo + especialista.
- [x] `ResumenSeleccionModal`: agrupar por región con ejecutivo/especialista y overrides.
- [x] Retirar textos “Equipo”, “EV/EP” y “pareo” de la selección.
- [x] Mantener `idEquipo` solo como dato legacy sin UI.

## Fase 5 - Verificación

- [x] `npm run build`.
- [x] ESLint/tsc de archivos modificados sin errores.
- [ ] Asignar ejecutivo primario y especialista a una región contra backend real.
- [ ] Cerrar selección con un suplente en una región sin primario.
- [ ] Asignar override a un hospital y limpiarlo.
- [ ] Intentar override con ejecutivo de otra región/gerencia y ver el error.
- [ ] Verificar que rutas/talleres heredan el ejecutivo correcto (smoke con backend).

## Fuera de alcance

- Crear/editar personas (tarea 00019).
- Calendario de planeación (tarea 00021).
- Autorización de la matriz (se conserva en su pantalla).
