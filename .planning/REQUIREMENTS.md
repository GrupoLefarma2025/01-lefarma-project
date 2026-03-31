# Requirements: Lefarma CxP — Ordenes de Compra y Cuentas por Pagar

**Defined:** 2026-03-30
**Core Value:** El flujo completo de una orden de compra — desde captura hasta cierre contable — con trazabilidad total y autorizaciones configurables.

## v1 Requirements

Requirements para completar el ciclo completo de OC. Cada uno mapea a fases del roadmap.

### Workflow & Autorizaciones

- [ ] **WORK-01**: Firma 5 (Dirección Corporativa) puede autorizar o rechazar OCs que pasaron Firma 4, con motivo obligatorio al rechazar, notificando a los 4 firmantes anteriores
- [ ] **WORK-02**: El sistema transiciona OCs autorizadas por Firma 5 a estado "EnTesoreria" automaticamente
- [ ] **WORK-03**: La cantidad de niveles de firma es configurable por workflow (condiciones por monto, tipo de gasto, empresa/sucursal), no hardcodeada a 5

### Tesoreria (Pagos)

- [ ] **TES-01**: Tesoreria puede registrar pagos contra OCs autorizadas (estado EnTesoreria), con monto, fecha de pago, medio de pago y referencia bancaria
- [ ] **TES-02**: Se pueden registrar multiples pagos parciales hasta completar el total de la OC
- [ ] **TES-03**: El sistema calcula automaticamente el saldo pendiente (Total OC - Suma Pagos) y transiciona a "Pagada" cuando el saldo es 0
- [ ] **TES-04**: Tesoreria puede subir comprobante de deposito (imagen/PDF) por cada pago registrado
- [ ] **TES-05**: El sistema envia notificacion al usuario que genero el gasto por cada pago registrado
- [ ] **TES-06**: Tesoreria recibe correo diario con pagos pendientes de realizar (OCs autorizadas por Direccion con "Requiere comprobacion de pago")
- [ ] **TES-07**: Tesoreria puede consultar reporte bajo demanda de pagos pendientes programados

### Comprobacion de Gastos

- [ ] **COMP-01**: Usuario puede subir CFDI XML (factura electronica SAT) y el sistema extrae automaticamente: UUID, RFC emisor, RFC receptor, total, subtotales, IVA, retenciones, fecha
- [ ] **COMP-02**: Usuario puede subir comprobantes no deducibles (tickets, recibos) capturando monto manualmente + imagen del comprobante
- [ ] **COMP-03**: Usuario puede subir ficha de deposito bancario capturando importe manualmente
- [ ] **COMP-04**: El sistema calcula el Gran Total = Suma(XMLs) + Suma(No deducibles) + Deposito bancario
- [ ] **COMP-05**: El sistema valida que Gran Total >= Importe de la OC (no permite capturar menos)
- [ ] **COMP-06**: El sistema permite exceder el importe de la solicitud original pero nunca menos
- [ ] **COMP-07**: El sistema detecta CFDI duplicados por UUID y rechaza con mensaje indicando la OC donde ya fue registrado
- [ ] **COMP-08**: CxP puede validar comprobaciones subidas, cerrando el ciclo (EstadoOC → Cerrada)
- [ ] **COMP-09**: CxP puede rechazar comprobaciones con motivo obligatorio, notificando al usuario para corregir
- [ ] **COMP-10**: El sistema notifica a CxP cuando un usuario sube una comprobacion nueva

### Reportes

- [ ] **REP-01**: Reporte de comprobaciones pendientes de pago (OCs autorizadas sin pagar)
- [ ] **REP-02**: Reporte de comprobaciones pendientes de comprobar (OCs pagadas sin comprobacion)
- [ ] **REP-03**: Reporte de comprobaciones pendientes filtrable por: usuario, antiguedad
- [ ] **REP-04**: Reporte de comprobaciones liberadas filtrable por: empresa, sucursal, fechas, usuario, tipo de gasto, cuenta contable, centro de costo
- [ ] **REP-05**: Reporte de saldos por proveedor (antiguedad de saldos)

### Integracion Contable

- [ ] **CONT-01**: Sistema genera pólizas contables automaticas a partir de OCs cerradas (debe haber) con cuenta contable de la OC
- [ ] **CONT-02**: Sistema exporta pólizas en formato CSV/XML compatible con sistema contable externo
- [ ] **CONT-03**: Conciliacion bancaria: importacion de estados de cuenta y match con pagos realizados

### Dashboard

- [ ] **DASH-01**: Dashboard CxP con KPIs: OCs pendientes por autorizar, pagos programados, comprobaciones vencidas, gasto del mes vs presupuesto
- [ ] **DASH-02**: Dashboard Tesoreria con pagos del dia, pagos vencidos, flujo de efectivo proyectado

### Proveedores

- [ ] **PROV-01**: Proveedores capturados en OC se crean con bandera "Sin autorizar" (no aparecen en catalogo oficial)
- [ ] **PROV-02**: CxP puede autorizar proveedores pendientes, moviendolos al catalogo oficial
- [ ] **PROV-03**: CxP puede rechazar proveedores pendientes con motivo

### Configuracion

- [ ] **CONF-01**: Admin puede configurar niveles de firma por workflow (agregar/quitar pasos, condiciones por monto/tipo/empresa)
- [ ] **CONF-02**: Gerente Admon/Finanzas puede autorizar cambios al catalogo contable (centros de costo, cuentas contables)

## v2 Requirements

Diferados a futuro release. Rastreados pero no en roadmap actual.

### Notificaciones Avanzadas

- **NOTF-01**: Alertas configurables por usuario (frecuencia, tipos de eventos)
- **NOTF-02**: Recordatorio automatico de comprobaciones pendientes con mas de X dias

### Reportes Avanzados

- **REP-06**: Reporte Presupuesto vs Real (requiere mecanismo de carga de presupuestos)
- **REP-07**: Reporte de cumplimiento de comprobacion (metrica de velocidad de entrega)

### Bloqueo

- **BLOQ-01**: Bloquear captura de nuevas OCs si el usuario tiene mas de X comprobaciones pendientes
- **BLOQ-02**: Bloquear captura si tiene al menos 1 comprobacion con mas de Y dias sin comprobar

### Validacion SAT

- **SAT-01**: Validacion automatica de CFDI contra webservice SAT (requiere Firma Electronica)
- **SAT-02**: Validacion cruzada RFC (proveedor OC vs RFC comprobante)

## Out of Scope

| Feature | Reason |
|---------|--------|
| OCR scanning de recibos | Precision terrible, no vale la pena — captura manual es mas confiable |
| Ejecucion automatica de pagos (API bancaria) | Certificacion bancaria compleja, fuera de alcance |
| Sistema contable completo | Scope explosion — solo exportar layouts |
| Multi-moneda | Grupo Lefarma opera 100% en MXN |
| Mobile native app | PWA suficiente, 8 usuarios no 8 millones |
| Aprobacion via respuesta a email | Riesgo de seguridad — spoofing, sin audit trail |
| Budget hard-block | Dato de presupuesto incompleto, bloqueo prematuro |

## Traceability

Cada requisito mapea exactamente a una fase del roadmap (ver ROADMAP.md).

| Requirement | Phase | Status | Success Criteria |
|-------------|-------|--------|------------------|
| WORK-01 | Phase 1: Workflow + Proveedores + Config | Pending | DireccionCorp approves/rejects at Firma 5 with mandatory rejection reason |
| WORK-02 | Phase 1: Workflow + Proveedores + Config | Pending | OCs auto-transition to EnTesoreria after Firma 5 approval |
| WORK-03 | Phase 1: Workflow + Proveedores + Config | Pending | Admin configures firma levels via UI, changes take effect immediately |
| PROV-01 | Phase 1: Workflow + Proveedores + Config | Pending | Inline providers created with "Sin Autorizar" flag, hidden from official catalog |
| PROV-02 | Phase 1: Workflow + Proveedores + Config | Pending | CxP approves pending providers into official catalog |
| PROV-03 | Phase 1: Workflow + Proveedores + Config | Pending | CxP rejects pending providers with optional reason |
| CONF-01 | Phase 1: Workflow + Proveedores + Config | Pending | Admin configures workflow conditions (monto/tipo/empresa) via UI |
| CONF-02 | Phase 1: Workflow + Proveedores + Config | Pending | Gerente Admon authorizes catalog contable changes |
| TES-01 | Phase 2: Tesoreria / Pagos | Pending | Tesoreria registers payment against EnTesoreria OC |
| TES-02 | Phase 2: Tesoreria / Pagos | Pending | Multiple partial payments tracked independently |
| TES-03 | Phase 2: Tesoreria / Pagos | Pending | Auto-transition to Pagada when payments cover total |
| TES-04 | Phase 2: Tesoreria / Pagos | Pending | Deposit receipt uploaded per payment |
| TES-05 | Phase 2: Tesoreria / Pagos | Pending | Creator notified per payment registered |
| TES-06 | Phase 2: Tesoreria / Pagos | Pending | Daily digest email to Tesoreria with pending payments |
| TES-07 | Phase 2: Tesoreria / Pagos | Pending | On-demand pending payments report |
| COMP-01 | Phase 3: Comprobacion de Gastos | Pending | CFDI XML auto-extracts UUID, RFC, totals, taxes, fecha |
| COMP-02 | Phase 3: Comprobacion de Gastos | Pending | Non-deductible receipt with manual monto + image |
| COMP-03 | Phase 3: Comprobacion de Gastos | Pending | Bank deposit slip with manual importe |
| COMP-04 | Phase 3: Comprobacion de Gastos | Pending | Gran Total = Sum(CFDI) + Sum(NoDeducibles) + Deposito |
| COMP-05 | Phase 3: Comprobacion de Gastos | Pending | Gran Total >= OC Total validation enforced |
| COMP-06 | Phase 3: Comprobacion de Gastos | Pending | Can exceed OC amount but never less |
| COMP-07 | Phase 3: Comprobacion de Gastos | Pending | Duplicate UUID rejected with OC reference |
| COMP-08 | Phase 3: Comprobacion de Gastos | Pending | CxP validates → OC transitions to Cerrada |
| COMP-09 | Phase 3: Comprobacion de Gastos | Pending | CxP rejects with mandatory reason, notifies user |
| COMP-10 | Phase 3: Comprobacion de Gastos | Pending | CxP notified on new comprobacion upload |
| REP-01 | Phase 4: Reportes | Pending | Report of OCs authorized but not yet paid |
| REP-02 | Phase 4: Reportes | Pending | Report of OCs paid but not yet verified |
| REP-03 | Phase 4: Reportes | Pending | Filtered by usuario and antiguedad |
| REP-04 | Phase 4: Reportes | Pending | Multi-filter liberated comprobaciones report |
| REP-05 | Phase 4: Reportes | Pending | Vendor balance aging report |
| CONT-01 | Phase 5: Integracion Contable | Pending | Polizas generated from Cerrada OCs |
| CONT-02 | Phase 5: Integracion Contable | Pending | CSV/XML export for external system |
| CONT-03 | Phase 5: Integracion Contable | Pending | Bank statement import + payment matching |
| DASH-01 | Phase 6: Dashboard | Pending | CxP dashboard with KPIs |
| DASH-02 | Phase 6: Dashboard | Pending | Tesoreria dashboard with KPIs |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓
- Success criteria: 34 (one per requirement) ✓

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*
