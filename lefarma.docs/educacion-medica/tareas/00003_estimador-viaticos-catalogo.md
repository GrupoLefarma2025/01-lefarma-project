---
fecha_creacion: 2026-08-26 12:00
fecha_modificacion: 2026-08-26 12:00
resumen: Plan de tareas para implementar el estimador de viáticos foráneos por catálogo configurable del módulo Educación Médica (ADR-00003).
---

# Tareas 00003 — Estimador de viáticos foráneos por catálogo configurable

## ADR de referencia

`decisiones/00003_estimador-viaticos-catalogo.md`

## Fases

| # | Tarea | Verificación | Prioridad |
|---|---|---|---|
| F1 | Crear tabla `educacion_medica.viatico_tarifas` y script de seed referencial en `lefarma.database/educacion-medica/` | `dotnet build` limpio; seed consultable con `SELECT` | Alta |
| F2 | Backend: endpoints CRUD de tarifas (`/api/viaticos/tarifas`) con validación de unicidad `(categoria, clave)` | Tests de integración pasan; POST duplicado devuelve 409 | Alta |
| F3 | Frontend: pantalla "Catálogo de tarifas de viáticos" con filtro por categoría, edición y permisos | Abrir `/viaticos/tarifas`, filtrar, editar precio, persistir | Alta |
| F4 | Backend: tablas `viajes_solicitud` / `viajes_estimaciones` + servicio estimador por modo de transporte | Test unitario: carro (km+gasolina+casetas), autobús, avión | Media |
| F5 | Integrar estimador en el flujo de solicitud de viáticos y aprobaciones (espejo ASK-ADM-FOR-001) | Flujo end-to-end manual en desarrollo con firma GV→CA→GG→DC | Media |

## Dependencias externas (solo para carga inicial)

- CAPUFE: tarifas oficiales de casetas para poblar corredores frecuentes.
- OpenRouteService o Google Routes: consulta puntual de distancias para corredores carreteros (no runtime).
- Sitios de aerolíneas/autobuses: carga manual/referencial de tarifas; el campo `nota_fuente` debe registrar fecha y origen.

## Notas

- F1-F3 desbloquean valor inmediato: el área puede empezar a mantener el catálogo sin esperar a F4-F5.
- F4-F5 requieren levantar con el área el detalle operativo de `ASK-GGE-IDT-001` (documento no disponible en referencias).
