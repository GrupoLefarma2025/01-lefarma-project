---
codigo: "—"
version: "—"
fecha: "—"
area: "General"
tipo: "Índice"
---

# README — Vault de Educación Médica y Ventas IMSS

Este vault es una wiki estilo Obsidian generada a partir de los documentos Markdown extraídos de `lefarma.docs/apps/educacion-medica/extracted`.

## Estructura de carpetas

```
vault/
├── Inicio.md / README.md
├── Areas/
│   ├── Educación Médica.md
│   └── Ventas IMSS.md
├── Procesos/
│   ├── Talleres Médicos en Hospitales.md
│   └── Proceso de Ventas IMSS.md
├── Procedimientos/
│   └── Procedimiento Normalizado de Operación del Proceso de Ventas.md
├── Instructivos/
│   ├── Preparación y Autorización de Material de Talleres Médicos.md
│   ├── Elaboración del Concentrado Anual de Talleres Médicos.md
│   ├── Selección Mensual de Hospitales para Talleres Médicos.md
│   ├── Solicitud y Entrega de Materiales para Talleres Médicos.md
│   ├── Impartición de Talleres Médicos.md
│   ├── Elaborar Plan de Trabajo.md
│   ├── Visitar Unidades Médicas del IMSS.md
│   └── Recabar Información e Indicadores de Ventas IMSS.md
├── Formularios/
│   ├── ASK-CEM-FOR-002 Base de Datos de Hospitales.md
│   ├── ASK-CEM-FOR-003 Programa Anual de Talleres Médicos.md
│   ├── ASK-CEM-FOR-005 Matriz de Talleres Médicos.md
│   ├── ASK-CEM-FOR-006 Calendario de Talleres Médicos.md
│   ├── ASK-CEM-FOR-008 Registro de Asistencia.md
│   ├── ASK-VEN-FOR-001 Metas de Ventas y Desplazamiento.md
│   └── ASK-VEN-FOR-003 Reporte de Visitas Médicas.md
├── Diagramas/
│   ├── Diagrama del Proceso de Talleres Médicos.md
│   └── Diagrama del Proceso de Ventas.md
├── Referencias/                      (16 documentos citados no incluidos en el set)
│   ├── ASK-ADM-FOR-001 Solicitud de Viáticos.md
│   ├── ASK-VEN-FOR-002 Plan de Trabajo (formato).md
│   └── ...
├── Roles/
│   └── Roles y Abreviaturas.md
```

## Convenciones

- Los enlaces internos usan sintaxis Obsidian `[[Nombre de Nota]]`.
- Cada nota incluye frontmatter con código, versión, fecha, área y tipo.
- Los roles se vinculan a [[Roles y Abreviaturas]] mediante alias; dentro de **tablas** el pipe se escapa como `[[Roles y Abreviaturas\|EP]]` para no romper la celda.
- Los **códigos de documento** (p. ej. `ASK-VEN-DPD-001`) se linkean a su nota destino con el código como texto visible: `[[Proceso de Ventas IMSS|ASK-VEN-DPD-001]]`.
- Los códigos de formulario se vinculan a sus notas correspondientes y al índice [[Formularios]].
- Los documentos citados que no están en el set digitalizado viven en `Referencias/` como nodos de trazabilidad.

## Punto de entrada

Comienza en [[Inicio]].
