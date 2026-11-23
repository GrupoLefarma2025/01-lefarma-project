import { FileText, GraduationCap, Plane, ReceiptText, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { HairlineProps } from '@lucasmarkes/hairline/react';
import { Branches, Drawer, Loupe, Riffle, Terrain, Vault } from '@lucasmarkes/hairline/react';

export interface AppRegistryEntry {
  id: string;
  label: string;
  path: string;
  icon?: ComponentType<{ className?: string }>;
  hairline?: ComponentType<HairlineProps>;
  description?: string;
  disabled?: boolean;
  permission?: string;
}

export const appRegistry: AppRegistryEntry[] = [
  {
    id: 'cxp',
    label: 'CxP',
    path: '/cxp/',
    description: 'Órdenes de compra',
    icon: ReceiptText,
    hairline: Drawer,
    disabled: false,
    permission: 'baseapp.hub.puede_ver_cxp',
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    path: '/rh/',
    description: 'Gestión de personal',
    icon: Users,
    hairline: Riffle,
    disabled: false,
    permission: 'baseapp.hub.puede_ver_rh',
  },
  {
    id: 'educacion-medica',
    label: 'Educación Médica',
    path: '/educacion-medica/',
    description: 'Cursos y capacitaciones',
    icon: GraduationCap,
    hairline: Branches,
    disabled: false,
    permission: 'baseapp.hub.puede_ver_educacion_medica',
  },
  {
    id: 'viaticos',
    label: 'Viáticos',
    path: '/viaticos/',
    description: 'Cálculo de costos de ruta',
    icon: Plane,
    hairline: Terrain,
    disabled: false,
    permission: 'baseapp.hub.puede_ver_viaticos',
  },
  {
    id: 'sigma',
    label: 'SIGMA',
    path: '/SIGMA/',
    description: 'Documentos y flujo de firmas',
    icon: FileText,
    hairline: Loupe,
    disabled: false,
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    path: '/configuracion',
    description: 'Variables globales',
    hairline: Vault,
    disabled: false,
    permission: 'configuracion.view',
  },
];
