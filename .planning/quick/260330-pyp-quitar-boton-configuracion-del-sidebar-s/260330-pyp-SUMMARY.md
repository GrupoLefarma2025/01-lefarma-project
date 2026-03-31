# Summary: Quitar boton configuracion del sidebar

**Date:** 2026-03-30
**Commit:** 38a75a0

## Changes

| Task | What | File | Status |
|------|------|------|--------|
| 1 | Removed "Configuración" menu item from `menuItems` array and unused `Settings` import | `lefarma.frontend/src/components/layout/AppSidebar.tsx` | Done |

## Verification

- TypeScript type-check: passed
- ESLint lint: passed

## Details

Removed the `{ title: 'Configuración', icon: Settings, path: '/configuracion' }` entry from the `menuItems` array and the unused `Settings` import from lucide-react. No other components or routes affected.
