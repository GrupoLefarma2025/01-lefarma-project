import { ReceiptText, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Static app registry — the single source of truth for the shell launcher
 * (app-routing spec: "Static App Registry"). The launcher reads this array
 * directly; NO backend call is made to populate the list in this change.
 *
 * Adding a new app to the launcher is a CODE-ONLY change: append an entry here
 * and Home picks it up on the next render (base-app spec: "Adding an app entry
 * is code-only").
 */
export interface AppRegistryEntry {
  /** Stable identifier, e.g. 'cxp' | 'rh'. */
  id: string;
  /** Tile label shown in the launcher. */
  label: string;
  /** Absolute navigation target, e.g. '/cxp/'. */
  path: string;
  /** Optional leading icon component (rendered by the launcher tile). */
  icon?: LucideIcon;
  /** Optional helper text shown under the label. */
  description?: string;
  /** When true the entry is rendered but not navigable (e.g. not migrated yet). */
  disabled?: boolean;
}

/**
 * Static app registry (nav-reorg). The former gastos-migration app is renamed
 * to "CxP" and lives at `/cxp/` (one level up from the prior nested path). The
 * RH (Recursos Humanos) app lives at `/rh/` (one level up from the prior nested
 * path). Both are ENABLED as shell-launchable targets. Future apps append here
 * under their own root-relative prefix.
 */
export const appRegistry: AppRegistryEntry[] = [
  {
    id: 'cxp',
    label: 'CxP',
    path: '/cxp/',
    description: 'Órdenes de compra',
    icon: ReceiptText,
    disabled: false,
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    path: '/rh/',
    description: 'Gestión de personal',
    icon: Users,
    disabled: false,
  },
];
