# Sistema de Cuentas por Pagar - Grupo Lefarma

## What This Is

Sistema web para la gestión del proceso de órdenes de compra y cuentas por pagar de Grupo Lefarma. Reemplaza el caos de archivos Excel con un sistema sistematizado donde todo queda registrado, con flujo de autorizaciones multinivel dinámico, comprobación de gastos (XML/PDF), conciliación de pagos y reportes. Sirve a 5 empresas del grupo (Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma) con múltiples sucursales y roles granulares.

## Core Value

Control total y auditoría completa: cada gasto tiene su flujo de autorizaciones ordenado, registrado y rastreable. Nadie puede "hacer mañas" ni decir "te lo envié / no vi nada". Los contadores del grupo tienen visibilidad consolidada de todas las empresas.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Sistema de notificaciones parametrizable (In-app + Email + Telegram)
- [ ] Captura de órdenes de compra con datos generales, proveedor, partidas y forma de pago
- [ ] Flujo de autorizaciones multinivel dinámico (motor de flujos del compañero)
- [ ] Tesorería para programar y realizar pagos
- [ ] Comprobación de gastos (XML/PDF deducibles, no deducibles, depósitos bancarios)
- [ ] Sistema de roles y permisos granular (quién puede ver/hacer qué)
- [ ] Reportes contables y operativos (por empresa, sucursal, tipo de gasto, cuenta contable)
- [ ] Integración con catálogos existentes (empresas, sucursales, cuentas contables, centros de costo, áreas)

### Out of Scope

- [Motor de flujos de aprobación] — Desarrollado por compañero, nosotros consumimos su API
- [Sistema contable] — Integración vía exportación de pólizas, no desarrollo del sistema contable
- [Conciliación bancaria automática] — Fase futura, ahora solo importación de estados de cuenta

## Context

**Grupo Lefarma** es un grupo empresarial del área reumática con 5 empresas:
- Asokam (ASK) - 3 sucursales
- Lefarma (LEF) - 2 sucursales
- Artricenter (ATC) - 3 sucursales
- Construmedika (CON) - 1 sucursal
- GrupoLefarma corporativo (GRP) - Oficinas centrales

Actualmente gestionan cuentas por pagar en Excel, lo que causa:
- Falta de control y auditoría ("cualquiera puede hacer cualquier cosa")
- Perdida de información ("te lo envié" vs "no vi nada")
- Gastos inventados o sin soporte
- Procesos manuales propensos a error

**Catálogos corporativos ya existentes:**
- Catalogo Contable Corporativo (cuentas 600-604 con estructura AAA-BBB-CCC-DD)
- Centros de costo (4 tipos: Operaciones, Administrativo, Comercial, Gerencia)
- Tipos de gasto (Fijo, Variable, Extraordinario)
- Áreas (10: RH, Contabilidad, Tesorería, Compras, Almacén, Producción, Ventas, Marketing, Tecnología, Calidad)
- Unidades de medida (8: Piezas, Servicio, Kilos, Litros, Metros, Horas, Cajas, Kilowatts)

**División del desarrollo:**
- **Compañero:** Motor de flujos de aprobación (backend dinámico de N firmas)
- **Este proyecto:** UI/UX, roles, permisos, formularios, reportes, sistema de notificaciones

## Constraints

- **Tech stack**: .NET 10 + EF Core + SQL Server (backend), React + Vite + TypeScript (frontend) — decisión arquitectónica ya definida
- **Integración con motor de flujos**: Debe consumir la API que define el compañero (no podemos modificar su lógica)
- **Catálogos existentes**: Deben integrarse con la estructura de catálogos corporativos ya definidos
- **Multi-empresa**: El sistema debe soportar 5 empresas + vista consolidada para contadores
- **Roles granulares**: Permisos detallados de quién puede ver/autorizar qué en cada empresa/sucursal
- **SMTP**: Credenciales SMTP ya disponibles para envío de correos
- **Telegram**: Requiere que cada usuario vincule su cuenta de Telegram al sistema

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stack: .NET 10 + React + TypeScript | Balance entre performance, productividad y ecosistema | — Pending |
| 3 canales de notificación desde el inicio (In-app, Email, Telegram) | Usuarios tienen diferentes preferencias y algunos canales son más urgentes que otros | — Pending |
| Notificaciones parametrizables por evento y canal | Cada tipo de gasto/flujo tiene diferentes requisitos de notificación | — Pending |
| Sistema de roles y permisos granular | Contadores ven todo, empleados solo lo suyo, gerentes autorizan su área | — Pending |
| Primera fase: Sistema de notificaciones | Es el módulo más urgente y habilita visibilidad del proceso | — Pending |

---
*Last updated: 2026-03-20 after initialization*
