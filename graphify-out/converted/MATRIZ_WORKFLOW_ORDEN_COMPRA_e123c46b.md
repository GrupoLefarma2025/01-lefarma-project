<!-- converted from MATRIZ_WORKFLOW_ORDEN_COMPRA.xlsx -->

## Sheet: RESUMEN_GENERAL
|  | Workflow | Cuándo aplica | Prioridad | Default |
| --- | --- | --- | --- | --- |
|  | OC_STANDARD | Flujo de trabajo para compras normales | 10 | True |
|  | OC_MARIA | Flujo de trabajo para Maria | 1 | False |
|  | OC_LEFARMA | Flujo de trabajo para Lefarma | 2 | False |
|  |  |  |  | False |
|  |  |  |  | False |
## Sheet: WORKFLOW_OC_STANDARD
|  | Campo evaluación | Valor/Condicion | Observaciones |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Empresa | Todas |  |  |  |  |  |  |  |
|  | Sucursal | Todas |  |  |  |  |  |  |  |
|  | Área | Todas |  |  |  |  |  |  |  |
|  | Usuario específico | Todas |  |  |  |  |  |  |  |
|  | Prioridad | 10 |  |  |  |  |  |  |  |
|  | Es workflow default | Sí | Menor número = mayor prioridad |  |  |  |  |  |  |
|  | Orden | Nombre del paso | Responsable |  |  |  |  |  |  |
|  | 1 | Creada |  |  |  |  |  |  |  |
|  | 2 | Firma gerente general |  |  |  |  |  |  |  |
|  | 3 | Firma CxP |  |  |  |  |  |  |  |
|  | 4 | Firma GAF |  |  |  |  |  |  |  |
|  | 5 | Firma Direccion Corporativa |  | Requiere firma | Requiere comentario | Puede aprobar | Puede rechazar | Puede devolver | Puede cancelar |
|  | 6 | Tesoreria |  | No | Sí | No | No | No | Sí |
|  | 7 | Pago |  | Sí | Sí | Sí | Sí | No | No |
|  | 8 | Comprobacion |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 9 | Cerrada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 10 | Rechazada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 11 | Cancelada |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | Sí | Sí | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |
## Sheet: WORKFLOW_OC_MARIA
|  | Campo evaluación | Valor/Condicion | Observaciones |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Empresa |  |  |  |  |  |  |  |  |
|  | Sucursal |  |  |  |  |  |  |  |  |
|  | Área |  |  |  |  |  |  |  |  |
|  | Usuario específico | Maria Pérez (ID 201) | Aplica exclusivamente para este usuario |  |  |  |  |  |  |
|  | Prioridad | 1 | Mayor prioridad |  |  |  |  |  |  |
|  | Es workflow default | No |  |  |  |  |  |  |  |
|  | Orden | Nombre del paso | Responsable |  |  |  |  |  |  |
|  | 1 | Creada |  |  |  |  |  |  |  |
|  | 2 | Firma gerente general |  |  |  |  |  |  |  |
|  | 3 | Firma CxP |  |  |  |  |  |  |  |
|  | 4 | Firma GAF |  |  |  |  |  |  |  |
|  | 5 | Firma Direccion Corporativa |  | Requiere firma | Requiere comentario | Puede aprobar | Puede rechazar | Puede devolver | Puede cancelar |
|  | 6 | Tesoreria |  | No | Sí | No | No | No | Sí |
|  | 7 | Pago |  | Sí | Sí | Sí | Sí | No | No |
|  | 8 | Comprobacion |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 9 | Cerrada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 10 | Rechazada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 11 | Cancelada |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | Sí | Sí | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |
## Sheet: WORKFLOW_OC_LEFARMA
|  | Campo evaluación | Valor/Condicion | Observaciones |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Empresa | Grupo Lefarma | Aplica exclusivamente para esta empresa |  |  |  |  |  |  |
|  | Sucursal |  |  |  |  |  |  |  |  |
|  | Área |  |  |  |  |  |  |  |  |
|  | Usuario específico |  |  |  |  |  |  |  |  |
|  | Prioridad | 2 | Mayor prioridad |  |  |  |  |  |  |
|  | Es workflow default | No |  |  |  |  |  |  |  |
|  | Orden | Nombre del paso | Responsable |  |  |  |  |  |  |
|  | 1 | Creada |  |  |  |  |  |  |  |
|  | 2 | Firma gerente general |  |  |  |  |  |  |  |
|  | 3 | Firma CxP |  |  |  |  |  |  |  |
|  | 4 | Firma GAF |  |  |  |  |  |  |  |
|  | 5 | Firma Direccion Corporativa |  | Requiere firma | Requiere comentario | Puede aprobar | Puede rechazar | Puede devolver | Puede cancelar |
|  | 6 | Tesoreria |  | No | Sí | No | No | No | Sí |
|  | 7 | Pago |  | Sí | Sí | Sí | Sí | No | No |
|  | 8 | Comprobacion |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 9 | Cerrada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 10 | Rechazada |  | Sí | Sí | Sí | Sí | Sí | No |
|  | 11 | Cancelada |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | No | No | No |
|  |  |  |  | Sí | Sí | Sí | Sí | Sí | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |
|  |  |  |  | No | No | No | No | No | No |