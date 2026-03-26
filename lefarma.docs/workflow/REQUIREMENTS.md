# REQUIREMENTS: Motor de Workflows - Grupo Lefarma

**Defined:** 2026-03-21
**Core Value:** Flexibilidad corporativa y auditoría blindada. El negocio decide el flujo de firmas sin necesidad de programar cambios en el código.

---

## Requerimientos del Motor de Workflows (v1)

### 1. Definición del Flujo (Admin Requirements)
*   **WORK-REQ-01**: El administrador podrá definir procesos de negocio (`workflows`) por nombre y código.
*   **WORK-REQ-02**: El sistema permitirá configurar múltiples pasos (`pasos`) para cada flujo, asignándoles un orden lógico (Ej: 10, 20, 30).
*   **WORK-REQ-03**: Cada paso podrá configurarse con requisitos específicos:
    *   `requiere_firma`: Obligatoriedad de cargar la firma digital en el acto.
    *   `requiere_comentario`: Obligatoriedad de capturar una justificación.
    *   `requiere_adjunto`: Obligatoriedad de adjuntar un archivo (ej. XML/PDF).
*   **WORK-REQ-04**: El sistema soportará acciones de transición (`acciones`) de tipo:
    *   **Aprobación**: Avanza la orden al siguiente paso.
    *   **Rechazo**: Detiene el flujo y cierra la orden como inválida.
    *   **Retorno/Devolución**: Regresa la orden a un paso anterior (ej. Paso 1) para corrección.

### 2. Ejecución y Notificaciones (Operational Requirements)
*   **WORK-REQ-05**: El sistema disparará notificaciones automáticas (`notificaciones`) al realizarse una acción exitosa.
*   **WORK-REQ-06**: Se soportarán 3 canales de notificación configurables por paso:
    1.  **Email** (SMTP).
    2.  **WhatsApp** (Vía API).
    3.  **Telegram** (Bot API).
*   **WORK-REQ-07**: El sistema usará plantillas de mensaje (`templates`) con etiquetas dinámicas como `{{Folio}}`, `{{Total}}`, `{{Proveedor}}`, y `{{Empresa}}`.

### 3. Lógica de Condicionales (Business Intelligence)
*   **WORK-REQ-08**: El motor evaluará reglas dinámicas (`condiciones`) basadas en campos de la Orden de Compra para decidir desvíos del flujo original.
    *   Ejemplo: *"Si el Total > $100,000, entonces el Paso Destino es Firma 5"*.
*   **WORK-REQ-09**: El sistema permitirá asignar **participantes** (`workflow_participantes`) por paso, indicando qué Rol o Usuario específico tiene permiso de ejecutar acciones en cada etapa del flujo.
*   **WORK-REQ-10**: Cada cambio de estado en el workflow deberá registrarse en una **bitácora inmutable** (`workflow_bitacora`) que incluya: orden afectada, paso, acción ejecutada, usuario responsable, comentario y fecha del evento.

---

## Perfil y Detalle de Usuario (User Requirements)

*   **USER-REQ-01**: El sistema almacenará el perfil extendido del usuario en `usuario_detalle`.
*   **USER-REQ-02**: El usuario podrá configurar sus canales de notificación preferidos (Canal Preferido).
*   **USER-REQ-03**: Almacenamiento seguro de la **Firma Digital** en formato Base64 para estampar en los documentos de autorización.
*   **USER-REQ-04**: Gestión de **Delegación de Firma** para periodos de ausencia o vacaciones, permitiendo asignar a un usuario sustituto.

---

## Atributos de Calidad (No Funcionales)

*   **Escalabilidad**: El motor debe ser capaz de soportar flujos de hasta 20 pasos sin degradación de rendimiento.
*   **Auditoría**: Cada cambio de estado en el workflow debe registrarse en una bitácora inmutable de eventos.
*   **Independencia de Datos**: La configuración del flujo (esquema `config`) debe ser independiente de la transaccionalidad de las órdenes (esquema `operaciones`).

---
*Requirements definidos para el sistema de control de flujos de Grupo Lefarma.*
