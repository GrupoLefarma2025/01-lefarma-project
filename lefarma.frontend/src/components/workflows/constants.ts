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
  Field:            'Campo de entrada',
  Document:         'Comprobante OC (gasto/pago)',
  Archivo:          'Documento adjunto (solicitudes / OC)',
  Alerta:           'Alerta informativa',
  ProviderAuthorization: 'Validación de proveedor',
};

export const HANDLER_DESCRIPTIONS: Record<string, string> = {
  RequiredFields:   'Obliga al usuario a completar ciertos campos antes de ejecutar la acción',
  FieldUpdater:     'Modifica automáticamente un campo de la orden al ejecutar la acción',
  DocumentRequired: 'Exige adjuntar un documento específico para continuar',
  Field:            'Campo que el usuario captura en el modal de firma',
  Document:         'Valida comprobantes reales de gasto o pago (solo órdenes de compra)',
  Archivo:          'Exige un archivo adjunto etiquetado con la clave del campo; aplica a solicitudes y órdenes',
  Alerta:           'Muestra un mensaje informativo sin bloquear la acción',
  ProviderAuthorization: 'Bloquea la acción si el proveedor no está autorizado',
};

export const HANDLER_CONFIGS: Record<string, { icon: typeof ListChecks; color: string; borderColor: string }> = {
  RequiredFields:   { icon: ListChecks, color: 'bg-amber-500/10 text-amber-700', borderColor: 'border-amber-500/30' },
  FieldUpdater:     { icon: PenLine,   color: 'bg-blue-500/10 text-blue-700',   borderColor: 'border-blue-500/30' },
  DocumentRequired: { icon: FileText,  color: 'bg-purple-500/10 text-purple-700', borderColor: 'border-purple-500/30' },
  Field:            { icon: ListChecks, color: 'bg-amber-500/10 text-amber-700', borderColor: 'border-amber-500/30' },
  Document:         { icon: FileText,  color: 'bg-purple-500/10 text-purple-700', borderColor: 'border-purple-500/30' },
  Archivo:          { icon: FileText,  color: 'bg-sky-500/10 text-sky-700', borderColor: 'border-sky-500/30' },
  Alerta:           { icon: ListChecks, color: 'bg-slate-500/10 text-slate-700', borderColor: 'border-slate-500/30' },
  ProviderAuthorization: { icon: FileText, color: 'bg-rose-500/10 text-rose-700', borderColor: 'border-rose-500/30' },
};
