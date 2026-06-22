import type { ReactNode } from 'react';

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
  /** Stable identifier, e.g. 'gastos' | 'cxp'. */
  id: string;
  /** Tile label shown in the launcher. */
  label: string;
  /** Absolute navigation target, e.g. '/CxP/gastos/'. */
  path: string;
  /** Optional leading icon node. */
  icon?: ReactNode;
  /** Optional helper text shown under the label. */
  description?: string;
  /** When true the entry is rendered but not navigable (e.g. not migrated yet). */
  disabled?: boolean;
}

/**
 * Placeholder registry. Real entries arrive in later changes as each app is
 * migrated under `/CxP/`. Gastos continues to run from the ROOT deployment in
 * this change, so it is listed as disabled — present in the launcher but not yet
 * addressable under `/CxP/gastos/`.
 */
export const appRegistry: AppRegistryEntry[] = [
  {
    id: 'gastos',
    label: 'Gastos',
    path: '/CxP/gastos/',
    description: 'Órdenes de compra (pendiente de migración bajo /CxP/)',
    disabled: true,
  },
];
