import { AlignLeft, Clock, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { esTipoRango, type JsonSchemaNodo, type VariableConfiguracion } from '../types';
import {
  esObjetoPlano,
  formatearFecha,
  normalizarTipoDato,
  resumirValor,
  tipoEditorDeEsquema,
} from '../utils';
import { TooltipValor } from './TooltipValor';

interface ValorVariableProps {
  variable: VariableConfiguracion;
  className?: string;
}

function fechaCorta(valor: string): string {
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return valor;
  return `${dia}/${mes}/${anio}`;
}

function formatearNumero(texto: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return texto;
  const [entero, decimales] = texto.split('.');
  const signo = entero.startsWith('-') ? '-' : '';
  const digitos = signo ? entero.slice(1) : entero;
  const agrupado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}${agrupado}${decimales !== undefined ? `.${decimales}` : ''}`;
}

const MESES_CORTOS = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

function MiniCalendario({ fecha, conHora = false }: { fecha: Date; conHora?: boolean }) {
  const h24 = fecha.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minutos = String(fecha.getMinutes()).padStart(2, '0');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/70 bg-background text-center shadow-sm',
        conHora ? 'w-[4.75rem]' : 'w-10',
      )}
    >
      <div className="pt-0.5 text-[8px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
        {MESES_CORTOS[fecha.getMonth()]}
      </div>
      <div className="pb-0.5 font-mono text-base font-semibold leading-none tabular-nums text-foreground">
        {fecha.getDate()}
      </div>
      {conHora && (
        <div className="flex items-center justify-center gap-1 border-t border-border/60 bg-muted/40 px-1.5 py-1">
          <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-mono text-[10px] leading-none tabular-nums text-foreground">
            {String(h12).padStart(2, '0')}:{minutos}
          </span>
          <span className="text-[7px] font-semibold leading-none tracking-wide text-muted-foreground">
            {h24 < 12 ? 'AM' : 'PM'}
          </span>
        </div>
      )}
    </div>
  );
}

const MAX_ELEMENTOS_VISIBLES = 3;

const MAX_ELEMENTOS_TOOLTIP = 200;

interface PartesHora {
  h24: number;
  minutos: string;
}

function PildoraHora({ partes, className }: { partes: PartesHora; className?: string }) {
  const h12 = partes.h24 % 12 === 0 ? 12 : partes.h24 % 12;
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-1 font-mono text-xs leading-none tabular-nums',
        className,
      )}
    >
      {String(h12).padStart(2, '0')}:{partes.minutos}
      <span className="text-[9px] font-semibold tracking-wide text-muted-foreground">
        {partes.h24 < 12 ? 'AM' : 'PM'}
      </span>
    </span>
  );
}

function fechaDeValor(valor: string, soloFecha: boolean): Date | null {
  if (soloFecha) {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return null;
    const fecha = new Date(anio, mes - 1, dia);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function tipoElementoDeEsquema(esquema: unknown): string | null {
  const nodo = esquema as JsonSchemaNodo | null | undefined;
  const items = nodo?.type === 'array' ? nodo.items : undefined;
  return items && typeof items === 'object' ? tipoEditorDeEsquema(items) : null;
}

function valorElemento(elemento: unknown, tipoElemento: string | null): string {
  if (elemento === null || elemento === undefined) return '—';
  if (tipoElemento === 'booleano') {
    return elemento === true || elemento === 'true' ? 'true' : 'false';
  }
  if (tipoElemento === 'fecha') return fechaCorta(String(elemento));
  if (tipoElemento === 'fecha_hora') return formatearFecha(String(elemento), true);
  if (tipoElemento === 'hora') {
    const partes = partesHora(String(elemento));
    return partes ? `${String(partes.h24).padStart(2, '0')}:${partes.minutos}` : String(elemento);
  }
  if (typeof elemento === 'string') return elemento;
  return resumirValor(elemento, 40);
}

function horaCorta(valor: string): string {
  const [horas, minutos] = valor.split(':');
  return horas && minutos ? `${horas}:${minutos}` : valor;
}

function partesHora(valor: string): PartesHora | null {
  const coincidencia = valor.match(/^(\d{1,2}):(\d{2})/);
  if (!coincidencia) return null;
  const h24 = Number(coincidencia[1]);
  if (h24 > 23) return null;
  return { h24, minutos: coincidencia[2] };
}

export function ValorVariable({ variable, className }: ValorVariableProps) {
  const tipo = normalizarTipoDato(variable.tipoDato);
  const valor = variable.valor;

  if (valor === null || valor === undefined) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  if (tipo === 'booleano') {
    const activo = valor === true || valor === 'true';
    return (
      <div className={cn('flex flex-col items-start gap-1', className)}>
        <Switch
          checked={activo}
          disabled
          aria-label={`Valor ${activo ? 'true' : 'false'}`}
          className="disabled:opacity-100 data-[state=checked]:bg-emerald-600"
        />
        <span
          className={cn(
            'font-mono text-[11px] leading-none',
            activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {activo ? 'true' : 'false'}
        </span>
      </div>
    );
  }

  if (tipo === 'entero' || tipo === 'decimal') {
    const texto = typeof valor === 'number' ? String(valor) : resumirValor(valor, 24);
    const formateado = formatearNumero(texto);
    return (
      <span
        className={cn(
          'inline-flex items-baseline rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[13px] font-semibold tabular-nums text-foreground',
          className,
        )}
        title={texto}
      >
        {formateado}
      </span>
    );
  }

  if (tipo === 'fecha' || tipo === 'fecha_hora') {
    const soloFecha = tipo === 'fecha';
    const fecha = fechaDeValor(String(valor), soloFecha);
    if (!fecha) {
      return (
        <span className={cn('font-mono text-xs', className)}>
          {soloFecha ? fechaCorta(String(valor)) : formatearFecha(String(valor), true)}
        </span>
      );
    }
    return (
      <div className={cn('flex flex-col items-start gap-1', className)}>
        <MiniCalendario fecha={fecha} conHora={!soloFecha} />
        <span className="whitespace-nowrap font-mono text-[10px] leading-none tabular-nums text-muted-foreground">
          {soloFecha ? fechaCorta(String(valor)) : formatearFecha(String(valor), true)}
        </span>
      </div>
    );
  }

  if (tipo === 'hora') {
    const partes = partesHora(String(valor));
    if (!partes) {
      return <span className={cn('font-mono text-xs', className)}>{horaCorta(String(valor))}</span>;
    }
    const texto24 = `${String(partes.h24).padStart(2, '0')}:${partes.minutos}`;
    return (
      <div className={cn('flex flex-col items-start gap-1', className)}>
        <PildoraHora partes={partes} />
        <span
          className="font-mono text-[10px] leading-none tabular-nums text-muted-foreground"
          title={`${texto24} (24 horas)`}
        >
          {texto24}
        </span>
      </div>
    );
  }

  if (tipo === 'seleccion') {
    const etiqueta =
      typeof valor === 'string' ? valor : (resumirValor(valor, 40) || 'Sin valor');
    return (
      <Badge variant="secondary" className={cn('max-w-[180px] truncate text-[11px]', className)}>
        {etiqueta}
      </Badge>
    );
  }

  if (tipo === 'lista' || Array.isArray(valor)) {
    const elementos = Array.isArray(valor) ? valor : [];
    if (elementos.length === 0) {
      return <span className={cn('text-[11px] text-muted-foreground', className)}>Lista vacía</span>;
    }
    const tipoElemento = tipoElementoDeEsquema(variable.esquema);
    const textos = elementos.map((elemento) => valorElemento(elemento, tipoElemento));
    const visibles = textos.slice(0, MAX_ELEMENTOS_VISIBLES);
    const ocultos = elementos.length - visibles.length;
    const detalle = `${elementos.length} ${elementos.length === 1 ? 'elemento' : 'elementos'}`;
    const enTooltip = textos.slice(0, MAX_ELEMENTOS_TOOLTIP);

    return (
      <TooltipValor
        trigger={
          <div
            tabIndex={0}
            className={cn(
              'flex max-w-[280px] cursor-default flex-col gap-0.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 outline-none transition-colors hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              className,
            )}
          >
            {visibles.map((texto, indice) => (
              <div key={indice} className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
                />
                <span className="truncate font-mono text-[10px] leading-4 text-muted-foreground">
                  {texto}
                </span>
              </div>
            ))}
            {ocultos > 0 && (
              <span className="pl-2.5 text-[10px] font-medium leading-4 text-muted-foreground">
                +{ocultos} más
              </span>
            )}
          </div>
        }
        titulo="Lista completa"
        detalle={detalle}
        textoParaCopiar={() => textos.join('\n')}
        icono={<List className="h-2.5 w-2.5" aria-hidden />}
      >
        <ol className="divide-y divide-border/50">
          {enTooltip.map((texto, indice) => (
            <li key={indice} className="flex items-start gap-2 px-3 py-1.5">
              <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground/60">
                {indice + 1}.
              </span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-[12px] leading-5">
                {texto}
              </span>
            </li>
          ))}
        </ol>
        {textos.length > MAX_ELEMENTOS_TOOLTIP && (
          <p className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
            Mostrando {MAX_ELEMENTOS_TOOLTIP} de {textos.length}. Al copiar se incluyen todos.
          </p>
        )}
      </TooltipValor>
    );
  }

  if (esTipoRango(tipo)) {
    const rango = esObjetoPlano(valor) ? valor : {};

    const formatearExtremo = (extremo: unknown): string => {
      if (extremo === null || extremo === undefined || extremo === '') return '—';
      if (tipo === 'rango_entero' || tipo === 'rango_decimal') {
        return typeof extremo === 'number' ? String(extremo) : resumirValor(extremo, 24);
      }
      return tipo === 'rango_fecha'
        ? fechaCorta(String(extremo))
        : formatearFecha(String(extremo), true);
    };

    const texto = `${formatearExtremo(rango.desde)} → ${formatearExtremo(rango.hasta)}`;

    return (
      <span
        className={cn('font-mono text-[11px] tabular-nums text-muted-foreground', className)}
        title={texto}
      >
        {texto}
      </span>
    );
  }

  if (tipo === 'objeto' || tipo === 'json') {
    let completo = resumirValor(valor, 400);
    try {
      completo = JSON.stringify(valor, null, 2);
    } catch {
    }
    return (
      <code
        className={cn(
          'block max-w-[260px] truncate font-mono text-[11px] text-muted-foreground',
          className,
        )}
        title={completo}
      >
        {resumirValor(valor, 60)}
      </code>
    );
  }

  const texto = typeof valor === 'string' ? valor : resumirValor(valor, 120);
  if (!texto) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  const contenido = (
    <p className="line-clamp-2 whitespace-pre-line break-words text-[13px] leading-5 text-foreground/90">
      {texto}
    </p>
  );

  const tarjeta = (
    <div
      className={cn(
        'w-full max-w-[340px] rounded-lg border border-border/60 bg-muted/20 px-3 py-2',
        className,
      )}
    >
      {contenido}
    </div>
  );

  if (texto.length <= 80) {
    return tarjeta;
  }

  return (
    <TooltipValor
      trigger={
        <div
          tabIndex={0}
          className={cn(
            'w-full max-w-[340px] cursor-default rounded-lg border border-border/60 bg-muted/20 px-3 py-2 outline-none transition-colors hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
          )}
        >
          {contenido}
        </div>
      }
      titulo="Texto completo"
      detalle={`${texto.length} caracteres`}
      textoParaCopiar={texto}
      icono={<AlignLeft className="h-2.5 w-2.5" aria-hidden />}
    >
      <p className="whitespace-pre-wrap break-words px-3 py-2 text-[12px] font-normal leading-5 text-popover-foreground">
        {texto}
      </p>
    </TooltipValor>
  );
}
