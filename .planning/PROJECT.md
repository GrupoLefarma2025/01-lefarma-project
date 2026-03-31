# Lefarma CxP — Ordenes de Compra y Cuentas por Pagar

## What This Is

Sistema web para la gestion completa del proceso de ordenes de compra y cuentas por pagar de Grupo Lefarma (5 empresas: Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma). Incluye captura de ordenes de compra con partidas, flujo de autorizaciones multinivel configurable (N firmas determinadas por monto/tipo de gasto/empresa/sucursal), procesamiento de pagos por tesoreria, comprobacion de gastos (XML/CFDI + no deducibles + depositos bancarios), reportes operativos y contables, e integracion con sistema contable para generacion de polizas automaticas y conciliacion bancaria.

## Core Value

El flujo completo de una orden de compra — desde captura hasta cierre contable — con trazabilidad total y autorizaciones configurables.

## Requirements

### Validated

<!-- Ya construido en la codebase existente — verificado por code scan + Playwright -->

- ✓ Captura de Ordenes de Compra — entity, CRUD service, controller, DTOs, validator, auto-folio, partidas con calculos (`Features/OrdenesCompra/Captura/`)
- ✓ Motor de Workflows COMPLETO — engine generico con pasos, acciones, condiciones dinamicas, participantes, bitacora inmutable, notificaciones (`Features/Config/Engine/WorkflowEngine.cs` + `Features/Config/Workflows/` con full CRUD API)
- ✓ IStepHandler pattern — keyed DI, Firma3Handler (CxP: CentroCosto+CuentaContable), Firma4Handler (GAF: comprobacion flags) (`Features/OrdenesCompra/Firmas/Handlers/`)
- ✓ FirmasService + FirmasController — resolucion de handler por key, ejecucion de engine, historial (`Features/OrdenesCompra/Firmas/`)
- ✓ Flujo de Autorizaciones (Firmas 2-4) — service, controller, handlers por paso con dynamic routing via condiciones
- ✓ Catalogos completos — Proveedores, Empresas, Sucursales, Areas, Gastos, CentrosCosto, CuentasContables, FormasPago, MediosPago, Bancos, RegimenesFiscales, EstatusOrden, UnidadesMedida
- ✓ Sistema de Roles y Permisos — 8 roles con claims-based authorization, 12 permisos (`Shared/Constants/AuthorizationConstants.cs`)
- ✓ Sistema de Notificaciones — multi-canal (Email, Telegram, In-App/SSE), templates con variables, resolucion por rol
- ✓ Frontend de Autorizaciones — inbox 825 lineas con timeline, dynamic firma forms, historial, filtros (`pages/ordenes/AutorizacionesOC.tsx`)
- ✓ Subida de archivos — FileUploader con drag-and-drop, validacion, preview (entidadTipo/entidadId pattern)
- ✓ Proveedor con bandera de autorizacion — `AutorizadoPorCxP` flag en entity, DTOs, validator, service (filtra por flag), repo (`Features/Catalogos/Proveedores/`)
- ✓ Frontend Proveedores — CRUD completo con columna Autorizado CxP badge, checkbox en form, regimen fiscal dropdown (`pages/catalogos/generales/Proveedores/ProveedoresList.tsx`, 536 lineas)
- ✓ Frontend Workflows List — CRUD de workflows con stats (pasos, acciones, condiciones), busqueda, modal crear/editar (`pages/workflows/WorkflowsList.tsx`, 491 lineas)
- ✓ Frontend Workflow Diagram — diagrama visual tipo timeline con panel lateral, editor modal con 5 tabs (Pasos, Acciones, Condiciones, Participantes, Notificaciones), CRUD completo para todas las entidades del workflow (`pages/workflows/WorkflowDiagram.tsx`, 1160+ lineas)
- ✓ WorkflowCondicion — routing dinamico con evaluacion numerica (>, >=, <, <=, =) y override de paso destino
- ✓ EstadoOC enum — todos los 12 estados incluyendo EnRevisionF5, EnTesoreria, Pagada, EnComprobacion, Cerrada

### Active

<!-- Lo que falta construir — actualizado despues de code scan -->

- [ ] Firma 5 Handler — IStepHandler para Direccion Corporativa (paso final de autorizacion antes de tesoreria)
- [ ] TesoreriaHandler — IStepHandler pass-through para transicion a EnTesoreria
- [ ] ComprobacionHandler — IStepHandler que valida suma de comprobantes y dispara cierre
- [ ] Foundation entities — Pago entity + EstadoPago enum + Comprobacion entity + TipoComprobacion + EstadoComprobacion enums + EF configs + repos
- [ ] EF Migration — crear tablas nuevas (pagos, comprobaciones)
- [ ] Workflow seeding — pasos Firma5, Tesoreria, Comprobacion en BD (no hay seeder de workflow)
- [ ] Provider approval endpoint — endpoint dedicado `POST /catalogos/Proveedores/{id}/autorizar` con audit trail (el toggle existe pero sin flujo dedicado)
- [ ] Permisos CxP proveedores — `proveedores.autorizar` en AuthorizationConstants
- [ ] Modulo de Tesoreria — Programacion y ejecucion de pagos (parciales/totales), subida de comprobante de deposito, multiples pagos hasta completar, notificacion al usuario por cada pago
- [ ] Modulo de Comprobacion de Gastos — Subida de XML/CFDI (extraccion automatica de importe), comprobantes no deducibles (captura manual + imagen), ficha de deposito bancario, validacion de gran total >= importe OC
- [ ] Validacion CxP de Comprobacion — CxP revisa y valida/rechaza comprobantes subidos por usuarios, cierre del ciclo al validar
- [ ] Reportes de Comprobaciones Pendientes — De pago, De comprobar, Por usuario, Por antiguedad
- [ ] Reportes de Comprobaciones Liberadas — Filtros: empresa, sucursal, fechas, usuario, tipo gasto, cuenta contable, centro costo
- [ ] Reportes Contables — Gastos por cuenta contable, Presupuesto vs Real, Antiguedad de saldos de proveedores
- [ ] Dashboard CxP — Vista resumen con metricas clave (OCs pendientes, pagos programados, comprobaciones vencidas)
- [ ] Notificaciones de Tesoreria — Correo diario con pagos pendientes autorizados por Direccion, reporte consultable bajo demanda
- [ ] Notificaciones de Comprobacion — Avisos a CxP cuando usuario sube comprobacion, aviso a usuario cuando CxP valida/rechaza
- [ ] Integracion Contable — Exportacion de polizas automaticas (CSV/XML), layout para sistema contable externo
- [ ] Conciliacion Bancaria — Importacion de estados de cuenta, match con pagos realizados

### Out of Scope

- Bloqueo de captura por comprobaciones pendientes (Fase 2 segun specs.md seccion 16.1)
- Presupuesto vs Real con bloqueo automatico (solo reporte en v1)
- Conciliacion automatica con SAT (validacion CFDI en v2)
- OAuth login (LDAP + JWT ya funciona)
- Mobile app

## Context

### Infraestructura Existente (reutilizable)

**Backend:**
- Workflow Engine generico: `Features/Config/Engine/WorkflowEngine.cs` con `IStepHandler` strategy pattern y condiciones dinamicas
- OrdenCompra entity con `EstadoOC` enum que ya incluye estados de tesoreria/comprobacion (EnTesoreria, Pagada, EnComprobacion, Cerrada)
- `IStepHandler` keyed DI — cada paso del workflow tiene su handler dedicado
- `Firma3Handler` (CxP: asigna CentroCosto + CuentaContable) y `Firma4Handler` (GAF: comprobacion flags) ya existen
- NotificationService multi-canal con template rendering
- FileUploader component y archivoService (entidadTipo/entidadId pattern)
- Todos los catalogos CxP necesarios ya estan CRUD-completos

**Frontend:**
- `AutorizacionesOC.tsx` (825 lineas) — master-detail con timeline, dynamic firma forms, historial
- DataTable con filterConfig (columnas, filtros, busqueda, visibilidad)
- Modal/Form patterns con React Hook Form + Zod
- PermissionGuard para proteccion por permisos
- Zustand stores para auth, config, page title, notifications

### Grupo Lefarma — Estructura Empresarial

| Empresa | Prefijo | Sucursales |
|---------|---------|------------|
| Asokam | ASK | Antonio Maura (101), Cedis (103), Guadalajara (102) |
| Lefarma | LEF | Planta (101), Mancera (102) |
| Artricenter | ATC | Viaducto (101), La Raza (102), Atizapan (103) |
| Construmedika | CON | Unica (101) |
| GrupoLefarma | GRP | Corporativo (101) |

### Catalogo Contable

Formato: `[PREFIJO]-[SUCURSAL]-[CENTRO_COSTO]-[CUENTA]`
Ejemplo: `ATC-103-101-601-001` = Artricenter-Atizapan-Operaciones-GastosNomina
Nivel 1: 600 Gastos, 601 Administrativos, 602 Financieros, 603 Produccion, 604 Administrativos (Operativos)

### Roles del Sistema

| Rol | Codigo | Responsabilidad |
|-----|--------|-----------------|
| Capturista/Solicitante | Capturista | Crea OCs, sube comprobantes |
| Gerente de Area | GerenteArea | Firma 2 - autorizacion inicial |
| CxP (Polo) | CxP | Firma 3 - revision + asignacion contable |
| Gerente Admon/Finanzas | GerenteAdmon | Firma 4 - revision financiera |
| Direccion Corporativa | DireccionCorp | Firma 5 - autorizacion final |
| Tesoreria | Tesoreria | Ejecuta pagos |
| Auxiliar de pagos | AuxiliarPagos | Conciliaciones |
| Administrador | Administrador | CRUD catalogos, usuarios, config |

## Constraints

- **Tech Stack**: .NET 10 backend + React 19 frontend (ya definido y en produccion)
- **Auth**: LDAP + JWT existente, no cambiar
- **Database**: SQL Server con EF Core 10
- **Patrones**: ErrorOr<T>, FluentValidation, ApiResponse<T>, ResultExtensions — OBLIGATORIO
- **Frontend**: shadcn/ui, React Hook Form + Zod, Zustand, TanStack Table — OBLIGATORIO
- **Workflow**: Usar el WorkflowEngine existente, no crear uno nuevo
- **Niveles de firma**: Configurables via WorkflowCondiciones (ya soportado por el engine) — NO hardcodear 5 firmas
- **Validation messages**: En espanol

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extender workflow ORDEN_COMPRA vs crear CXP separado | El engine es generico, el EstadoOC ya tiene todos los estados, evitar duplicacion | — Pending |
| Proveedor inline en OC vs link al catalogo | Ya existe bandera AutorizadoPorCxP, capturar inline y aprobar despues | ✓ Good |
| Handler por paso (IStepHandler) | Ya existe el patron, agregar TesoreriaHandler y ComprobacionHandler | ✓ Good |
| Notificaciones via WorkflowNotificacion | Ya existen templates y canales, solo agregar templates para tesoreria/comprobacion | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after initialization*
