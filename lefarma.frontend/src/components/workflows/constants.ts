import { ListChecks, PenLine, FileText } from 'lucide-react';

export const ACTION_COLORS: Record<string, string> = {
  ENVIAR: '#10b981',
  AUTORIZAR: '#008500',
  RECHAZAR: '#ef4444',
  DEVOLVER: '#f59e0b',
  CANCELAR: '#6b7280',
  ENVIAR_TESORERIA: '#3b82f6',
  MARCAR_PAGADA: '#059669',
  CERRAR: '#64748b',
  NOTIFICACION: '#8b5cf6'
};

export const HANDLER_LABELS: Record<string, string> = {
  RequiredFields:   'Campos requeridos',
  FieldUpdater:     'Actualizar campo',
  DocumentRequired: 'Documento requerido',
};

export const HANDLER_DESCRIPTIONS: Record<string, string> = {
  RequiredFields:   'Obliga al usuario a completar ciertos campos antes de ejecutar la acción',
  FieldUpdater:     'Modifica automáticamente un campo de la orden al ejecutar la acción',
  DocumentRequired: 'Exige adjuntar un documento específico para continuar',
};

export const HANDLER_CONFIGS: Record<string, { icon: typeof ListChecks; color: string; borderColor: string }> = {
  RequiredFields:   { icon: ListChecks, color: 'bg-amber-500/10 text-amber-700', borderColor: 'border-amber-500/30' },
  FieldUpdater:     { icon: PenLine,   color: 'bg-blue-500/10 text-blue-700',   borderColor: 'border-blue-500/30' },
  DocumentRequired: { icon: FileText,  color: 'bg-purple-500/10 text-purple-700', borderColor: 'border-purple-500/30' },
};
