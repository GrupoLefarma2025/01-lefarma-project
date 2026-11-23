import { cn } from '@/lib/utils';
import { TIPOS_DATO, type JsonSchemaNodo } from '../types';
import { etiquetaTipo, normalizarTipoDato, tipoEditorDeEsquema } from '../utils';
import { ICONOS_TIPO, TONOS_TIPO } from './typeVisuals';

interface TipoVariableProps {
  tipo: string;
  esquema?: unknown;
  className?: string;
}

function etiquetaConDetalle(tipo: string, esquema?: unknown): string {
  if (normalizarTipoDato(tipo) !== 'lista') return etiquetaTipo(tipo);
  const nodo = esquema as JsonSchemaNodo | null | undefined;
  const items = nodo?.type === 'array' ? nodo.items : undefined;
  const nodoItems = items && typeof items === 'object' ? items : undefined;
  if (!nodoItems) return etiquetaTipo(tipo);
  return `Lista de ${etiquetaTipo(tipoEditorDeEsquema(nodoItems)).toLowerCase()}`;
}

export function TipoVariable({ tipo, esquema, className }: TipoVariableProps) {
  const canonico = normalizarTipoDato(tipo);
  const definicion = canonico ? TIPOS_DATO.find((t) => t.valor === canonico) : undefined;
  const tono = definicion ? TONOS_TIPO[definicion.tono] : null;
  const Icono = canonico ? ICONOS_TIPO[canonico] : undefined;
  const etiqueta = etiquetaConDetalle(tipo, esquema);

  if (!tono || !Icono) {
    return (
      <span
        className={cn(
          'inline-flex items-center whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground',
          className,
        )}
      >
        {etiqueta}
      </span>
    );
  }

  return (
    <span
      title={etiqueta}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        tono.chip,
        className,
      )}
    >
      <Icono size={12} isAnimated={false} />
      {etiqueta}
    </span>
  );
}
