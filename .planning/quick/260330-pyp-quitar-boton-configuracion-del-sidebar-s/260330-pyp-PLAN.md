# Plan: Quitar boton configuracion del sidebar

**Created:** 2026-03-30
**Scope:** Frontend sidebar only
**Target file:** `lefarma.frontend/src/components/layout/AppSidebar.tsx`

---

## Task 1: Remove Configuracion menu item from sidebar

**File:** `lefarma.frontend/src/components/layout/AppSidebar.tsx`

Remove the "Configuración" entry from the `menuItems` array (lines 115-118):

```typescript
// REMOVE THIS BLOCK:
{
  title: 'Configuración',
  icon: Settings,
  path: '/configuracion',
},
```

Also remove the unused `Settings` import from lucide-react (line 6) since it will no longer be referenced.

That's it — the user name + "Cerrar Sesión" buttons in `SidebarFooter` (lines 269-286) already exist and will remain unchanged.

---

## Summary

| Task | What | File |
|------|------|------|
| 1 | Delete Configuracion entry from menuItems + remove `Settings` import | AppSidebar.tsx |

Single-file change, no routing or other components affected.
