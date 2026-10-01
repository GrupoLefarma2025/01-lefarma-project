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
- [ ] T1 Subir VERSION a 1.2.0 y commit work-unit en rama feature (solo VERSION)
- [ ] T2 Publicar 1.2.0 en productivo vía subagente y verificar HTTP 200 + versión

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

## Evidencia de verificación
- (pendiente)

## Siguiente paso
- Ejecutar T1.

## Locator
- Archivo: `odd/tasks/version-1-2-0-productivo.md`
- Espejo Engram: topic `odd/version-1-2-0-productivo/tasks`, proyecto `01-lefarma-project`
