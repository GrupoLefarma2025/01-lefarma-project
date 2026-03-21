# ROADMAP: Motor de Workflows y Perfiles - Grupo Lefarma

**Created:** 2026-03-21
**Granularity:** Detailed (Implementation level)
**Status:** In Progress
**Coverage:** 100% Core Workflow Requirements

---

## Fases de Implementación

- [ ] **Fase 1: Infraestructura de Datos (Config Schema)**
    - Creación de tablas en el esquema `config`.
    - Implementación de Entidades en .NET 10.
    - Configuración de Fluent API (snake_case mapping).
    - CRUD básico de `UsuarioDetalle`.

- [ ] **Fase 2: Motor de Reglas y Transiciones**
    - Lógica de "Siguiente Paso" basada en `config.workflow_acciones`.
    - Implementación de evaluador de condiciones (`workflow_condiciones`).
    - API para obtener acciones disponibles según el estado actual de una Orden de Compra.

- [ ] **Fase 3: Integración de Notificaciones Dinámicas**
    - Conexión del motor de workflows con los canales (Email, Telegram, WhatsApp).
    - Procesamiento de templates dinámicos con reemplazo de tags (Ej: {{Folio}}).
    - Sistema de reintentos para notificaciones fallidas.

- [ ] **Fase 4: Interfaz de Usuario (UI Admin)**
    - Visualizador gráfico del flujo de pasos.
    - Editor de notificaciones y templates.
    - Panel de delegación de firmas para usuarios.

---

## Detalle de Fases

### Fase 1: Infraestructura de Datos
**Objetivo:** Tener la base sólida para persistir la configuración.
*   **Success Criteria:**
    1.  Tablas creadas en SQL Server bajo el esquema `config`.
    2.  Modelos de C# generados y migración aplicada con éxito.
    3.  Usuario puede guardar su firma digital (Base64) y preferencias.

### Fase 2: Motor de Reglas
**Objetivo:** Que el sistema sepa qué sigue después de cada firma.
*   **Success Criteria:**
    1.  Al autorizar una OC, el sistema calcula el `id_paso_destino` automáticamente.
    2.  Si una OC supera los $50,000, el motor la desvía a Dirección Corporativa (Firma 5) según las reglas de `workflow_condiciones`.

---

## Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| Bucles infinitos en el flujo | ALTO | Validación en el guardado de pasos para evitar ciclos circulares sin fin. |
| Fallo en notificaciones críticas | CRITICAL | Implementar cola de mensajería (Background Jobs) con reintentos automáticos. |
| Usuarios en diferentes bases de datos | MEDIUM | Uso de DTOs y validación lógica en la capa de Servicio en lugar de FKs físicas. |

---
*Roadmap generado para el módulo de Workflows dinámicos.*
