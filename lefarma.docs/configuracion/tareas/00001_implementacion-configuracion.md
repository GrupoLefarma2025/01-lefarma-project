# Tareas — 00001 Implementación del módulo Configuración

> Vinculada a: [[decisiones/00001_esquema-variables-configuracion]]
>
> **Estado (2026-11-04)**: esquema, función y permisos instalados en
> `LefarmaDev`/`AsokamDev` y `Lefarma`/`Asokam`. Backend y frontend
> implementados. Falta asignar permisos a usuarios/roles, reiniciar los procesos
> publicados y ejecutar el smoke test funcional con una sesión autorizada.

## Fase 0 — Contratos y alcance

- [x] Tipos de dato y representación JSON (`string`, `text`, `integer`,
      `decimal`, `boolean`, `date`, `time`, `datetime`, `enum`, `object`,
      `array`, `json`).
- [x] Cuatro destinos independientes: Backend, Frontend, SQL e Integraciones.
- [x] Inmutabilidad de `clave` y `tipo_dato` raíz.
- [x] Bitácora append-only, idempotencia por `id_operacion` y restauración como
      cambio nuevo.
- [x] Contrato de la función SQL y comportamiento por tipo.
- [x] Seis códigos de permiso.
- [x] Formato de API keys (`cfg_` + secreto, hash SHA-256, prefijo visible,
      expiración y claves/prefijos permitidos).
- [x] Contrato HTTP de administración, sincronización frontend y API externa.

**Criterio de aceptación**: contratos cerrados entre frontend, backend, SQL y
consumidores externos. **Cumplido.**

## Fase 1 — Base de datos

- [x] `config.variables`.
- [x] `config.variables_bitacora`.
- [x] `config.integraciones`.
- [x] Constraints de tipo, JSON y destinos.
- [x] Índices de historial y sincronización.
- [x] `config.fn_obtener_variable` con extracción de escalares vía
      `OPENJSON(CONCAT(N'{"v":', ...))`.
- [x] Seed idempotente de los seis permisos en la base Asokam hermana.
- [x] Sin asignación automática a roles ni usuarios.
- [x] Instalador único para desarrollo y producción.
- [x] Corregido el `PRINT CONCAT` que contenía una subconsulta inválida.
- [x] Script focalizado `reparar_permisos_configuracion_dev_y_prod.sql`.
- [x] **Aplicado en `LefarmaDev` + `AsokamDev`.**
- [x] **Aplicado en `Lefarma` + `Asokam`.**
- [x] Verificado: las tres tablas, la función y los seis permisos existen en
      ambos ambientes.
- [x] Verificado: permisos sin asignaciones en roles y usuarios.

Pendiente de verificación funcional con datos:

- [ ] Probar la función con cada tipo de dato, variables SQL activas/inactivas y
      un texto mayor a 4000 caracteres. Requiere crear variables de prueba.

## Fase 2 — Backend

- [x] Entidades y configuraciones EF para las tres tablas.
- [x] Listado, detalle, creación, actualización y baja lógica.
- [x] Validación recursiva de tipo y JSON Schema.
- [x] Concurrencia optimista por `version`.
- [x] Idempotencia por `id_operacion`.
- [x] Bitácora con snapshots anterior/nuevo.
- [x] Restauración como nueva revisión, conservando clave y tipo.
- [x] Caché de runtime con último valor conocido.
- [x] Endpoints incrementales de frontend.
- [x] SSE multi-conexión con broadcast de revisión.
- [x] API Keys: crear, listar, revocar y consultar variables externas.
- [x] Permisos `[HasPermission]` en todos los endpoints administrativos.
- [x] Tests unitarios del módulo (87 casos).

**Criterio de aceptación**: CRUD consistente, sin filtrar variables fuera de su
destino y sin llaves en claro. **Cumplido en código y pruebas unitarias.**

## Fase 3 — Frontend

- [x] Store por clave y caché no sensible en `localStorage`.
- [x] Carga granular por ruta mediante `useConfig`.
- [x] Confirmación del valor al entrar a una ruta.
- [x] SSE, reconexión, polling de 10 minutos y recuperación al volver online.
- [x] Actualización monótona por revisión y tolerancia a fallos.
- [x] Pantalla de listado, filtros y estados.
- [x] Constructor visual tipo Strapi para tipos simples, objetos, listas y
      objetos dinámicos.
- [x] Editor de valor por tipo, validación y vista previa.
- [x] Historial con diff y restauración.
- [x] Administración de API Keys mostrando la llave una sola vez.
- [x] Menú y ruta ocultos sin `configuracion.view`.
- [x] Build de producción correcto.

Pendiente:

- [ ] Smoke test en navegador con una sesión que tenga los permisos asignados.

## Fase 4 — Seguridad y operación

- [x] Variables Backend/SQL/Integraciones no se envían al navegador.
- [x] API externa separada con API Key y restricciones por clave/prefijo.
- [x] Bitácora sin escrituras directas soportadas.
- [ ] Asignar permisos a usuarios/roles (decisión explícita pendiente).
- [x] Procedimiento de uso y API documentado en `uso.md`.
- [ ] Definir política de archivado de bitácora cuando el volumen lo requiera.

## Fase 5 — Pruebas y cierre

- [x] Tests unitarios de validación de tipos y esquemas.
- [x] Tests de creación, actualización, concurrencia e idempotencia.
- [x] Tests de restauración e historial.
- [x] Tests de llaves de integración.
- [x] Tests del store, runtime, provider y SSE del frontend.
- [ ] Prueba manual por rol: sin permiso no ve el módulo; con permiso ve solo lo
      permitido.
- [ ] Verificación de propagación SSE entre dos navegadores.
- [ ] Verificación del polling de respaldo con SSE desconectado.

**Criterio de cierre**: build de backend/frontend en verde, pruebas del módulo en
verde, permisos asignados y smoke test completado.
