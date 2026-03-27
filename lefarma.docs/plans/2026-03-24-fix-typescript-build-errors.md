# Fix TypeScript Build Errors - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all TypeScript compilation errors in lefarma.frontend to allow successful `npm run build`

**Architecture:** Fix type mismatches in 6 categories: null checks, notification types, filter types, table column types, UI variants, and Zod resolver types. Each fix is independent and can be committed separately.

**Tech Stack:** TypeScript 5.9, React 19, React Hook Form, Zod, TanStack Table, shadcn/ui

---

## File Structure

### Modified Files (Type Fixes)
- `src/types/notification.types.ts` - Add notification properties to UserNotification
- `src/components/AutoVerify.tsx` - Add null check for token
- `src/components/notifications/NotificationBell.tsx` - Update to use extended type
- `src/components/notifications/NotificationList.tsx` - Fix filter types and use extended type
- `src/hooks/useTableFilters.ts` - Fix ColumnDef accessorKey type assertion
- `src/pages/catalogos/generales/EstatusOrden/EstatusOrdenList.tsx` - Change Badge variant
- `src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx` - Fix Badge variant and Zod schema

### No New Files
All fixes are type corrections to existing code.

---

## Task 1: Fix AutoVerify Null Check

**Files:**
- Modify: `src/components/AutoVerify.tsx:110`

- [ ] **Step 1: Read the error context**

Line 110 has `token.substring(0, 30)` but token could be null.

- [ ] **Step 2: Fix null check**

Change:
```typescript
token: ${token.substring(0, 30)}...
```

To:
```typescript
token: ${token ? `${token.substring(0, 30)}...` : 'N/A'}
```

- [ ] **Step 3: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: 1 less error, still failing overall

- [ ] **Step 4: Commit**

```bash
git add lefarma.frontend/src/components/AutoVerify.tsx
git commit -m "fix(auth): add null check for token in AutoVerify"
```

---

## Task 2: Extend UserNotification Type

**Files:**
- Modify: `src/types/notification.types.ts:31-41`

- [ ] **Step 1: Read current UserNotification type**

Current type only has nested `notification?: Notification` but backend sends properties directly.

- [ ] **Step 2: Add notification properties to UserNotification**

Change:
```typescript
export interface UserNotification {
  id: number;
  notificationId: number;
  userId: number;
  isRead: boolean;
  readAt?: string;
  receivedVia: string;
  createdAt: string;
  notification?: Notification;
}
```

To:
```typescript
export interface UserNotification {
  id: number;
  notificationId: number;
  userId: number;
  isRead: boolean;
  readAt?: string;
  receivedVia: string;
  createdAt: string;
  notification?: Notification;
  // Backend sends these directly (flat structure for API response)
  title?: string;
  message?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
}
```

- [ ] **Step 3: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: NotificationBell/NotificationList errors reduced

- [ ] **Step 4: Commit**

```bash
git add lefarma.frontend/src/types/notification.types.ts
git commit -m "fix(types): extend UserNotification with flat notification properties"
```

---

## Task 3: Fix Notification Filter Types

**Files:**
- Modify: `src/types/notification.types.ts:148-155`
- Modify: `src/components/notifications/NotificationList.tsx:108-110`

- [ ] **Step 1: Add 'all' to filter types**

The filter uses 'all' but types don't include it.

Change:
```typescript
export interface NotificationFilter {
  unreadOnly?: boolean;
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
}
```

To:
```typescript
export interface NotificationFilter {
  unreadOnly?: boolean;
  type?: NotificationType | 'all';
  category?: NotificationCategory | 'all';
  priority?: NotificationPriority | 'all';
  startDate?: string;
  endDate?: string;
}
```

- [ ] **Step 2: Verify filter logic works with new type**

The code at NotificationList.tsx:108-110 already checks `!== 'all'` so no changes needed there.

- [ ] **Step 3: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: Filter comparison errors fixed

- [ ] **Step 4: Commit**

```bash
git add lefarma.frontend/src/types/notification.types.ts
git commit -m "fix(types): add 'all' option to notification filter types"
```

---

## Task 4: Fix ColumnDef AccessorKey Type

**Files:**
- Modify: `src/hooks/useTableFilters.ts:26`

- [ ] **Step 1: Fix accessorKey type assertion**

TanStack Table ColumnDef can have `id` OR `accessorKey`. Need safer check.

Change:
```typescript
const allColumnIds = allColumns.map(col => col.id || col.accessorKey as string);
```

To:
```typescript
const allColumnIds = allColumns.map(col =>
  col.id || (col as any).accessorKey || ''
);
```

Better solution - use type guard:
```typescript
const allColumnIds = allColumns.map(col => {
  if ('accessorKey' in col && typeof col.accessorKey === 'string') {
    return col.accessorKey;
  }
  return col.id || '';
});
```

- [ ] **Step 2: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: ColumnDef accessorKey error fixed

- [ ] **Step 3: Commit**

```bash
git add lefarma.frontend/src/hooks/useTableFilters.ts
git commit -m "fix(hooks): add type guard for ColumnDef accessorKey"
```

---

## Task 5: Fix Badge 'warning' Variant (2 locations)

**Files:**
- Modify: `src/pages/catalogos/generales/EstatusOrden/EstatusOrdenList.tsx:105`
- Modify: `src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx:266`

shadcn/ui Badge variant doesn't support 'warning'. Valid variants: 'default' | 'destructive' | 'outline' | 'secondary'

- [ ] **Step 1: Fix EstatusOrden warning variant**

Change:
```typescript
<Badge variant={row.original.requiereAccion ? 'warning' : 'secondary'} className="h-5">
```

To:
```typescript
<Badge
  variant={row.original.requiereAccion ? 'default' : 'secondary'}
  className={row.original.requiereAccion ? 'bg-orange-500 hover:bg-orange-600' : ''}
>
```

- [ ] **Step 2: Fix Proveedores warning variant**

Find and change similar pattern (around line 266):
```typescript
variant={someCondition ? 'warning' : 'secondary'}
```

To:
```typescript
variant={someCondition ? 'default' : 'secondary'}
className={someCondition ? 'bg-orange-500 hover:bg-orange-600' : ''}
```

- [ ] **Step 3: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: Variant type errors fixed

- [ ] **Step 4: Commit**

```bash
git add lefarma.frontend/src/pages/catalogos/generales/EstatusOrden/EstatusOrdenList.tsx
git add lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
git commit -m "fix(ui): replace invalid 'warning' variant with styled 'default' Badge"
```

---

## Task 6: Fix Proveedores Zod Resolver Type Mismatch

**Files:**
- Modify: `src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx:37-47,87-100`

The Zod schema has optional fields but the form expects specific types. Resolver type inference is clashing with form defaults.

- [ ] **Step 1: Fix Zod schema to match expected form types**

Change:
```typescript
const proveedorSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social debe tener al menos 3 caracteres'),
  rfc: z.string().optional().or(z.literal('')),
  codigoPostal: z.string().optional().or(z.literal('')),
  regimenFiscalId: z.number().optional(),
  personaContacto: z.string().optional().or(z.literal('')),
  notaFormaPago: z.string().optional().or(z.literal('')),
  notasGenerales: z.string().optional().or(z.literal('')),
  sinDatosFiscales: z.boolean().default(false),
  autorizadoPorCxP: z.boolean().default(false),
});
```

To:
```typescript
const proveedorSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social debe tener al menos 3 caracteres'),
  rfc: z.string().optional(),
  codigoPostal: z.string().optional(),
  regimenFiscalId: z.number().optional(),
  personaContacto: z.string().optional(),
  notaFormaPago: z.string().optional(),
  notasGenerales: z.string().optional(),
  sinDatosFiscales: z.boolean(),
  autorizadoPorCxP: z.boolean(),
});
```

Key changes:
- Remove `.or(z.literal(''))` - empty string is still a string
- Remove `.default(false)` from booleans - let form control defaults

- [ ] **Step 2: Update form defaultValues if needed**

The existing defaults should work fine since booleans are now required in schema.

- [ ] **Step 3: Verify build**

Run: `cd lefarma.frontend && npm run build`
Expected: All Proveedores resolver errors fixed

- [ ] **Step 4: Commit**

```bash
git add lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
git commit -m "fix(forms): simplify Zod schema to fix resolver type mismatch"
```

---

## Task 7: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd lefarma.frontend && npm run build
```

Expected: Clean build with no TypeScript errors

- [ ] **Step 2: If errors remain, review output**

Check for any remaining errors and create additional tasks

- [ ] **Step 3: Run type check separately**

```bash
cd lefarma.frontend && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 4: Run linter**

```bash
cd lefarma.frontend && npm run lint
```

Expected: No new errors (warnings acceptable)

- [ ] **Step 5: Final verification**

Check that all TypeScript errors from original build are resolved.

- [ ] **Step 6: Summary commit**

If all tasks pass, create summary:
```bash
git commit --allow-empty -m "chore: fix all TypeScript build errors

Fixed 6 categories of type errors:
- Null check in AutoVerify
- Extended UserNotification type
- Added 'all' to filter types
- Fixed ColumnDef accessorKey type guard
- Replaced invalid 'warning' Badge variant
- Simplified Proveedores Zod schema

Build: npm run build now passes with no TypeScript errors
"
```

---

## Testing Notes

After each commit, verify:
1. `npm run build` shows progress (fewer errors)
2. No runtime errors in browser console
3. UI components render correctly (NotificationBell, NotificationList, Proveedores table, etc.)

**Critical paths to test:**
- Notifications page (filter dropdowns work)
- Proveedores catalog (form opens, saves work)
- EstatusOrden table (badges display correctly)
- Login flow (AutoVerify token handling)

---

## References

- @superpowers:verificiation-before-completion - Must run after all fixes complete
- @lefarma-frontend - Frontend patterns and component usage
- @dotnet-best-practices - If backend type changes needed (unlikely here)
