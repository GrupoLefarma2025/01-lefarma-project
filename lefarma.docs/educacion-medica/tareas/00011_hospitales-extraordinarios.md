# Tareas — 00011 Hospitales extraordinarios y captura asistida

> Vinculada a: [[decisiones/00011_hospitales-extraordinarios]]
> Depende de: [[tareas/00010_ajustes-post-cierre]] (la visita extraordinaria usa el modo ajuste).
> Misma división por fases que la decisión: 0 Revisión de diseño, 1 BD, 2 Backend, 3 Frontend, 4 Verificación.

## Fase 0 — Revisión de diseño

- [ ] **Revisión del usuario del ADR-00011** (este documento)
- [ ] Resolver los supuestos de Fase 0 del ADR:
  - [ ] Capacidad: ¿avisa (propuesto) o bloquea?
  - [ ] ¿Fecha fuera de vigencia de la selección? (propuesto: sí, con aviso)
  - [ ] Equipo sin ruta en la versión activa: get-or-create de la ruta (propuesto)
  - [ ] Gerencia/mes del taller extraordinario: del equipo elegido + fecha del taller (propuesto)
  - [ ] ¿El extraordinario cuenta para la meta mensual (64+64)? (propuesto: sí)
  - [ ] ¿Motivo como evidencia adjunta? (propuesto: no en v1)
  - [x] ¿Estado inicial del taller extraordinario? — **`Programado` (2026-10-09)**: nace tras el cierre de la matriz, con historial origen Automático (máquina revisada del ADR-00008)

## Fase 1 — Base de datos (scripts 0028 y 0029)

- [x] Crear `0028_20261009-1300_educacion-medica_hospitales-extraordinarios.lefarma.sql` (idempotente, transacción única)
  - [x] `rutas_visitas.id_seleccion_hospital` → NULL
  - [x] Drop `UQ_rutas_visitas_hospital` + `CREATE UNIQUE INDEX ... WHERE id_seleccion_hospital IS NOT NULL`
  - [x] `rutas_visitas.es_extraordinaria BIT NOT NULL DEFAULT 0`
  - [x] `talleres.es_extraordinario BIT NOT NULL DEFAULT 0`
  - [x] `talleres.motivo_extraordinario NVARCHAR(500) NULL`
  - [x] `MS_Description` actualizado
- [x] Crear `0029_20261009-1400_educacion-medica_seed-permisos-ajustes-extraordinarios.lefarma.sql` (compartido con ADR-00010)
  - [x] 4 permisos nuevos (`rutas.puede_ajustar`, `talleres.puede_ajustar`, `talleres.puede_capturar_asistida`, `talleres.puede_capturar_extraordinarios`) — guarda idempotente **por código**
  - [x] Matriz rol↔permiso: los 4 al rol Coordinador de Educación Médica (CEM)
  - [x] Re-grant del SuperAdministrador (patrón `legacy/026`)
- [x] Validar sintaxis con `PARSEONLY` contra LefarmaDev2 (sin ejecutar) _(2026-10-10: PARSEONLY OK con `sqlcmd -f 65001`)_
- [x] **Revisión del usuario de los scripts**
- [x] Ejecutar `0028`/`0029` en **LefarmaDev2** _(ejecutados por el usuario; esquema verificado en Fase 4 — nota: la matriz rol↔permiso no aplicó por codepage, ver lecciones de 00010)_ y en **Lefarma** (prod, con el usuario) _(prod pendiente: re-ejecutar con UTF-8)_

## Fase 2 — Backend

- [x] Visita extraordinaria: `POST /{idRuta}/visitas` extendido (o `visitas-extraordinarias`) con `{ idHospital, fechaVisita, orden?, motivo }`; `rutas.puede_ajustar` + versión `Cerrada`; get-or-create de la ruta del equipo; audita `ALTA_VISITA` con `es_extraordinaria`
- [x] DTOs de rutas: resolver nombre de hospital y foráneo por catálogo/`hospital_extension` cuando `es_extraordinaria`; exponer `esExtraordinaria`
- [x] Impresión y asignaciones incluyen la visita extraordinaria (mismos contratos + flag)
- [x] Taller extraordinario: `CrearTallerRequest` con `{ idHospital, idEquipo, motivoExtraordinario, logística }`; `talleres.puede_capturar_extraordinarios`; snapshots de catálogo/extension; get-or-create de matrices (individual equipo+mes, general gerencia+mes); **nace `Programado`** con entrada en `taller_estados_historial` (origen Automático)
- [x] Captura asistida: `idEquipo` explícito; con `talleres.puede_capturar_asistida` se omite la validación de integrante; sin el permiso, debe coincidir con el equipo del llamante
- [x] `GET /talleres/hospitales-elegibles?idEquipo=` (hospitales de la selección del equipo con ruta `Cerrada`) con permiso asistida
- [x] `[HasPermission]` por endpoint + validación fina en servicio (patrón ADR-00009)
- [x] Pruebas unitarias: extraordinario con/sin permiso; visita extraordinaria en `Cerrada` y rechazo sin motivo; índice filtrado (varias extraordinarias por ruta, una normal); captura asistida para otro equipo; matriz creada para el equipo elegido; taller extraordinario nace `Programado` con historial
- [x] `dotnet build` 0 errores + `dotnet test` en verde

## Fase 3 — Frontend

- [x] `RutasPage` (modo ajuste): acción **"Visita extraordinaria"** con `CatalogoSearchSelect` del catálogo + fecha + motivo; badge "Extraordinaria"
- [x] `TallerFormModal`: hospital con `CatalogoSearchSelect` (elegibles del equipo) reemplazando el `Select` plano
- [x] Selector de **equipo** con búsqueda para captura asistida (CEM); EV/EP queda fijo al propio
- [x] Toggle **"Hospital extraordinario"**: buscador contra el catálogo + motivo obligatorio + equipo
- [x] "Capturado por" visible cuando el usuario no pertenece al equipo
- [x] Badge "Extraordinario" en `MatrizTalleresTable` y `TallerDetalleModal`
- [x] API/tipos: `talleres.crear` extendido, `rutas.visitasExtraordinarias`, `talleres.hospitalesElegibles`, campos nuevos
- [x] Guards de acciones por los permisos nuevos (sin rutas nuevas de navegación)
- [x] `tsc` limpio; ESLint en archivos tocados; `vite build` OK

## Fase 4 — Verificación y cierre

- [x] E2E: CEM agrega visita extraordinaria a versión `Cerrada` → visible en calendario, impresión y Mis asignaciones
  _(en vivo 2026-10-10: alta + flag `esExtraordinaria` + baja con motivo (25/25 checks del segmento); calendario/impresión/asignaciones consumen los mismos DTOs con el flag — verificado por API, no visualmente)_
- [x] E2E: CEM crea taller extraordinario → nace `Programado`, cae en matriz individual del equipo y general de la gerencia, y su historial registra la entrada
  _(en vivo: estado Programado, `esExtraordinario`, `id_seleccion_hospital` NULL, historial origen Automático; matriz individual reutilizada)_
- [x] E2E: CEM captura taller a nombre de otro equipo → el EV/EP lo ve en Mis talleres
  _(en vivo: usuario no-miembro creó taller para el equipo 5 (EV 116) con `Capturado por`; la matriz individual del equipo se creó get-or-create)_
- [x] 403: EV/EP sin permisos no crea extraordinarios ni captura para otro equipo
  _(en vivo: usuario sin permisos → 403 en extraordinarios, hospitales-elegibles y captura; el permiso puntual de asistida está cubierto por unit test)_
- [x] Validar supuestos de Fase 0 (capacidad, vigencia, get-or-create, meta mensual)
  _(capacidad: avisa (unit test); vigencia: sin candado (por diseño); get-or-create: unit test + ruta reutilizada en vivo; meta mensual: el extraordinario cuenta como taller normal)_
- [x] Sincronizar `reglas-negocio.md` (sección de extraordinarios) y ER (nulabilidad de `rutas_visitas.id_seleccion_hospital`)
  _(§5.13 nueva + nota del ER §6.4 + diagrama 000008_er_imparticion con la nota de la visita extraordinaria)_
- [x] Marcar ADR-00011 como `Accepted` al aprobarse
  _(aprobado por el usuario el 2026-10-10)_

### Lecciones registradas (2026-10-10)

1. **Buscadores del catálogo**: cargar el catálogo completo (500 registros) y filtrar en cliente funciona para el toggle extraordinario; para catálogos mayores conviene búsqueda servidor-side (el endpoint ya acepta `search`).
2. **`id_seleccion_hospital` NULL cambia consultas**: cualquier lectura que asumía NOT NULL debe saltar los NULL (p. ej. cobertura de rutas, mapa del día, hospitales planificados); el índice único filtrado es indispensable para permitir varias extraordinarias por ruta.
3. **Captura asistida**: la validación fina (miembro del equipo vs permiso) debe vivir en el servicio porque el atributo `[HasPermission]` no distingue "a nombre de otro equipo"; probar siempre con un usuario no-miembro.
4. **Reutilización del modo ajuste**: la visita extraordinaria se apoya 100 % en el mecanismo del ADR-00010 (motivo + auditoría + aviso de capacidad), sin endpoints ni bandejas nuevas.
