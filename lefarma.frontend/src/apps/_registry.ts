import { GraduationCap, ReceiptText, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Registro estático de apps — la única fuente de verdad para el launcher del
 * shell (spec app-routing: "Static App Registry"). El launcher lee este array
 * directamente; NO se realiza ninguna llamada al backend para poblar la lista
 * en este cambio.
 *
 * Agregar una nueva app al launcher es un cambio SOLO DE CÓDIGO: añade una
 * entrada aquí y Home la toma en el siguiente renderizado (spec base-app:
 * "Adding an app entry is code-only").
 */
export interface AppRegistryEntry {
  /** Identificador estable, ej. 'cxp' | 'rh'. */
  id: string;
  /** Etiqueta del tile mostrada en el launcher. */
  label: string;
  /** Destino de navegación absoluto, ej. '/cxp/'. */
  path: string;
  /** Componente de ícono inicial opcional (renderizado por el tile del launcher). */
  icon?: LucideIcon;
  /** Texto de ayuda opcional mostrado bajo la etiqueta. */
  description?: string;
  /** Cuando es true la entrada se renderiza pero no es navegable (ej. aún no migrada). */
  disabled?: boolean;
}

/**
 * Registro estático de apps (nav-reorg). La anterior app gastos-migration fue
 * renombrada a "CxP" y vive en `/cxp/` (un nivel arriba del path anidado
 * anterior). La app de RH (Recursos Humanos) vive en `/rh/` (un nivel arriba
 * del path anidado anterior). Ambas están HABILITADAS como destinos
 * lanzables desde el shell. Apps futuras se agregan aquí bajo su propio
 * prefijo relativo a la raíz.
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
  {
    id: 'educacion-medica',
    label: 'Educación Médica',
    path: '/educacion-medica/',
    description: 'Cursos y capacitaciones',
    icon: GraduationCap,
    disabled: false,
  },
];
