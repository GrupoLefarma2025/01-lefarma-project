# Feature: version-1-2-0-productivo

## Objetivo
Poner VERSION 1.2.0 y publicarlo en productivo (iis-027).

## Problema / por qué
El usuario pidió explícitamente "ponle la version 1.2.0 en productivo y publicalo".
Productivo está hoy en 1.1.2 (history 5/5 éxito, último 20260930-163833).
Local VERSION = 1.1.2, VERSION-STAGING = 1.1.2-rc.3.

## Alcance autorizado
- Cambiar solo `VERSION` de 1.1.2 a 1.2.0.
- Publicar con `lefarma-deploy.cmd deploy -From P:\Trabajo\01-lefarma-project -Env prod -Json`.
- Destino: 192.168.4.2, sitio sisco2-1, ruta D:\InepubPruebas\sisco2-1, pool agenda2-1 (no detener, usa app_offline).
- No tocar VERSION-STAGING, no migrar SQL, no cambiar .env, no detener pools.

## Fuera de alcance
- Cambios de código, .env sucios actuales (4 ficheros con VITE_TINYMCE_API_KEY) se dejan intactos y sin commitear.
- Push, PR, merge: decisión del usuario bajo política ordinaria del repo.

## Restricciones
- No reconstruir SSH a mano; usar solo el lanzador `P:\Trabajo\inventario-servidores\cli\lefarma-deploy.cmd`.
- Proceso bloqueante (deploy ~3 min) va en subagente con timeout y kill garantizado.
- No incrementar versión por cuenta propia: aquí hay autorización explícita del usuario para 1.2.0.

## TDD resuelto
- Modo: desconocido (sin `sdd-init/01-lefarma-project` en Engram, sin elección explícita del usuario).
- Fuente: ninguna confirmada. Runner: no se inventa.
- Régimen: checks funcionales ordinarios (plan + history + verificación HTTP/versión del driver), no cero checks.
- No se invoca sdd-init para determinar TDD en ODD.

## Estrategia de entrega
- `ask-on-risk` (default). Forecast: ~1 línea autorada (VERSION). Sin slice ni chained-PR.
- Límite 400 líneas no aplica (1 línea).

## Checklist
- [x] T1 Subir VERSION a 1.2.0 y commit work-unit en rama feature (solo VERSION)
- [x] T2 Publicar 1.2.0 en productivo vía subagente y verificar HTTP 200 + versión

## Criterios de aceptación
- `VERSION` contiene `1.2.0`.
- `plan -Env prod -Json` reporta `expectedVersion: 1.2.0` y `canDeploy: true`.
- `history -Env prod -Json` incluye entrada 1.2.0 con `success: true`.
- `success.json` del run muestra `Version: 1.2.0`, `HTTP: 200`, `Pool: Started`.

## Checks aplicables
- Pre: `plan -Env prod -Json`, `history -Env prod -Json`.
- Post: `success.json` + verificación HTTP/versión del driver. Sin TDD RED/GREEN (cambio de versión, no comportamiento).

## Progreso
- 2026-10-01: exploración completa (develop, VERSION 1.1.2, plan iis-027 canDeploy=true). Pendiente T1.
- 2026-10-01: T1 completo en rama feature/version-1-2-0-productivo, commit 0edaf2b2. VERSION=1.2.0, plan confirma expectedVersion 1.2.0 canDeploy=true. .env sucios intactos sin commitear.
- 2026-10-01: T2 completo deploy prod exit 0. success.json Version 1.2.0 HTTP 200 Pool Started. history incluye 20261001-122920-add1ca91 success true. Review reliability approved y acknowledged (lineage review-c408cf2c131f53ea, authority burned).

## Evidencia de verificación
- T1: `Get-Content VERSION` = 1.2.0; `plan -Env prod` expectedVersion 1.2.0 canDeploy=true; commit 0edaf2b2dbd5436867800ea26ce02bc929bbccb6.
- T2: run cli/runs/20261001-182920-69a5e5ee exit 0; evidencia 192.168.4.2/despliegues/20261001-122920-add1ca91-lefarma success.json Version 1.2.0 HTTP 200 Pool Started ProtectedUnchanged true; manifest 400 archivos, 7 cambiados, 1031 protegidos intactos; backup D:\DevApps\_codex-deploy\20261001-122920-add1ca91-lefarma\backup; solo URL interna http://192.168.4.2:5074.
- Review: assess medium (executable_change VERSION, 2 paths, 63 líneas, review_due false under_budget); preflight + consent granted + lens review-reliability sin hallazgos + acknowledge-approved acknowledged authority burned.

## Siguiente paso
- Listo. Push/PR/merge quedan a decisión del usuario.

## Locator
- Archivo: `odd/tasks/version-1-2-0-productivo.md`
- Espejo Engram: topic `odd/version-1-2-0-productivo/tasks`, proyecto `01-lefarma-project`
