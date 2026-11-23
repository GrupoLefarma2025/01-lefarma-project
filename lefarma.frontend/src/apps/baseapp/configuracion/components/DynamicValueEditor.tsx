import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  List,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';
import { TIPOS_DATO, type JsonSchemaNodo, type TipoDatoRango } from '../types';
import {
  aDatetimeLocal,
  aFechaInput,
  aHoraInput,
  desdeDatetimeLocal,
  esObjetoPlano,
  etiquetaTipo,
  jsonATexto,
  opcionesDeEsquema,
  parsearJson,
  tipoEditorDeEsquema,
  tipoEfectivo,
  validarValorVariable,
  valorInicialFormulario,
} from '../utils';
import { JsonValueEditor } from './JsonValueEditor';
import { ICONOS_TIPO, TONOS_TIPO } from './typeVisuals';

function fechaDeHoy(): string {
  const ahora = new Date();
  const pad = (numero: number) => String(numero).padStart(2, '0');
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
}

export interface DynamicValueEditorProps {
  tipo: string;
  esquema: JsonSchemaNodo | null;
  valor: unknown;
  onChange: (valor: unknown) => void;
  disabled?: boolean;
  profundidad?: number;
  requerido?: boolean;
  mostrarValidacion?: boolean;
}

export function DynamicValueEditor({
  tipo,
  esquema,
  valor,
  onChange,
  disabled = false,
  profundidad = 0,
  requerido = false,
  mostrarValidacion = false,
}: DynamicValueEditorProps) {
  const t = tipoEfectivo(tipo);
  const [tocado, setTocado] = useState(false);

  const meta = TIPOS_DATO.find((tipoDato) => tipoDato.valor === t);
  const Icono = ICONOS_TIPO[t];
  const tono = meta ? TONOS_TIPO[meta.tono] : null;

  const actualizar = (nuevo: unknown) => {
    setTocado(true);
    onChange(nuevo);
  };

  const vacio =
    valor === undefined ||
    valor === null ||
    (typeof valor === 'string' && valor.trim() === '');

  const validar = mostrarValidacion || tocado;
  let error: string | null = null;

  if (validar) {
    if (requerido && vacio) {
      error = 'Este campo es obligatorio.';
    } else if (t !== 'objeto' && t !== 'lista' && t !== 'json') {
      error = validarValorVariable(t, valor, esquema)[0] ?? null;
    }
  }

  const propsControl = {
    disabled,
    'aria-invalid': Boolean(error),
  } as const;

  let editor: ReactNode;

  switch (t) {
    case 'texto_corto':
      editor = (
        <Input
          {...propsControl}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => actualizar(e.target.value)}
          placeholder={`Ej. ${meta?.ejemplo ?? 'texto breve'}`}
          className={cn(
            'h-10 bg-background',
            error && 'border-destructive focus-visible:ring-destructive/30',
          )}
        />
      );
      break;

    case 'texto_largo': {
      const maxLength =
        typeof esquema?.maxLength === 'number' ? esquema.maxLength : undefined;
      const texto = typeof valor === 'string' ? valor : '';
      editor = (
        <div className="space-y-1">
          <Textarea
            {...propsControl}
            value={texto}
            onChange={(e) => actualizar(e.target.value)}
            placeholder={`Ej. ${meta?.ejemplo ?? 'Escribe aquí la explicación completa…'}`}
            maxLength={maxLength}
            rows={6}
            className={cn(
              'min-h-[160px] resize-y border-border bg-background text-sm leading-relaxed',
              error && 'border-destructive focus-visible:ring-destructive/30',
            )}
          />
          <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
            <span>Se admite texto en varias líneas.</span>
            {maxLength ? (
              <span>
                {texto.length}/{maxLength}
              </span>
            ) : null}
          </div>
        </div>
      );
      break;
    }

    case 'entero':
    case 'decimal':
      editor = (
        <Input
          {...propsControl}
          type="number"
          inputMode={t === 'entero' ? 'numeric' : 'decimal'}
          step={t === 'entero' ? 1 : 'any'}
          value={typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : ''}
          onChange={(e) => {
            const texto = e.target.value;
            if (texto === '') {
              actualizar(null);
              return;
            }
            const numero = Number(texto);
            actualizar(Number.isNaN(numero) ? texto : numero);
          }}
          placeholder={`Ej. ${meta?.ejemplo ?? (t === 'entero' ? '45' : '19.99')}`}
          className={cn(
            'h-10 bg-background font-mono',
            error && 'border-destructive focus-visible:ring-destructive/30',
          )}
        />
      );
      break;

    case 'booleano':
      editor = (
        <div
          role="radiogroup"
          aria-label="Valor booleano"
          className={cn(
            'grid max-w-sm grid-cols-2 gap-2',
            error && 'rounded-lg ring-1 ring-destructive/40',
          )}
        >
          {[
            { etiqueta: 'Sí', valorBoton: true },
            { etiqueta: 'No', valorBoton: false },
          ].map((opcion) => {
            const activo = valor === opcion.valorBoton;
            return (
              <button
                key={opcion.etiqueta}
                type="button"
                role="radio"
                aria-checked={activo}
                disabled={disabled}
                onClick={() => actualizar(opcion.valorBoton)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-lg border-2 text-sm font-medium transition-colors',
                  activo
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
                  error && !activo && 'border-destructive/40',
                )}
              >
                {activo && <CheckCircle2 className="h-4 w-4" />}
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>
      );
      break;

    case 'fecha':
      editor = (
        <div className="space-y-1">
          <DatePicker
            value={aFechaInput(valor) || null}
            onChange={(nueva) => actualizar(nueva ?? '')}
            placeholder="Elegir fecha"
            disabled={disabled}
            className={cn(
              'h-10 max-w-xs border-border bg-background font-normal',
              error && 'border-destructive focus-visible:ring-destructive/30',
            )}
          />
          <p className="text-[10px] text-muted-foreground">Día, mes y año. Sin hora.</p>
        </div>
      );
      break;

    case 'hora':
      editor = (
        <div className="space-y-1">
          <TimePicker
            value={aHoraInput(valor) || null}
            onValueChange={(nuevo) => actualizar(nuevo ?? '')}
            disabled={disabled}
            invalid={Boolean(error)}
            className="max-w-xs"
          />
          <p className="text-[10px] text-muted-foreground">Hora del día. Sin fecha.</p>
        </div>
      );
      break;

    case 'fecha_hora': {
      const local = aDatetimeLocal(valor);
      const [fechaActual = '', horaActual = ''] = local ? local.split('T') : [];
      const emitir = (fecha: string, hora: string) => {
        if (!fecha) {
          actualizar('');
          return;
        }
        actualizar(desdeDatetimeLocal(`${fecha}T${hora || '00:00'}`));
      };
      editor = (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={fechaActual || null}
              onChange={(nueva) => emitir(nueva ?? '', horaActual)}
              placeholder="Elegir fecha"
              disabled={disabled}
              className={cn(
                'h-10 w-52 border-border bg-background font-normal',
                error && 'border-destructive focus-visible:ring-destructive/30',
              )}
            />
            <TimePicker
              conSegundos={false}
              value={horaActual || null}
              onValueChange={(nueva) => emitir(fechaActual || fechaDeHoy(), nueva ?? '')}
              disabled={disabled}
              invalid={Boolean(error)}
              className="h-10 w-32"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Fecha y hora exactas; se guarda en formato ISO.
          </p>
        </div>
      );
      break;
    }

    case 'seleccion':
      editor = (
        <SeleccionEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          onChange={actualizar}
          error={error}
        />
      );
      break;

    case 'lista':
      editor = (
        <ListaEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          profundidad={profundidad}
          mostrarValidacion={validar}
          onChange={onChange}
        />
      );
      break;

    case 'rango_fecha':
    case 'rango_fecha_hora':
    case 'rango_entero':
    case 'rango_decimal':
      editor = (
        <RangoEditor tipo={t} valor={valor} disabled={disabled} onChange={actualizar} />
      );
      break;

    case 'objeto':
      editor = (
        <ObjetoEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          profundidad={profundidad}
          mostrarValidacion={validar}
          onChange={actualizar}
        />
      );
      break;

    case 'json':
      editor = (
        <JsonValueEditor
          valor={valor}
          disabled={disabled}
          ejemplo={meta?.ejemplo}
          onChange={actualizar}
        />
      );
      break;

    default:
      editor = (
        <JsonEditor
          valor={valor}
          disabled={disabled}
          ejemplo={meta?.ejemplo}
          onChange={actualizar}
        />
      );
      break;
  }

  const esContenedor = t === 'objeto' || t === 'lista';

  return (
    <div className="space-y-1.5">
      {!esContenedor && profundidad === 0 && Icono && tono && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md border',
              tono.icono,
            )}
          >
            <Icono size={14} isAnimated />
          </span>
          <span className="text-[11px] text-muted-foreground">
            {meta?.editor}
            {requerido ? ' · obligatorio' : ''}
          </span>
        </div>
      )}

      {editor}

      {error && (
        <p
          className="flex items-center gap-1.5 text-[11px] font-medium text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function RangoEditor({
  tipo,
  valor,
  disabled,
  onChange,
}: {
  tipo: TipoDatoRango;
  valor: unknown;
  disabled: boolean;
  onChange: (valor: unknown) => void;
}) {
  const rango = esObjetoPlano(valor) ? valor : {};
  const desde = rango.desde;
  const hasta = rango.hasta;

  const emitir = (campo: 'desde' | 'hasta', nuevo: unknown) => {
    onChange({ ...rango, [campo]: nuevo });
  };

  const contenido = (campo: 'desde' | 'hasta', extremo: unknown) => {
    if (tipo === 'rango_fecha') {
      return (
        <DatePicker
          value={aFechaInput(extremo) || null}
          onChange={(nueva) => emitir(campo, nueva ?? '')}
          placeholder="Elegir fecha"
          disabled={disabled}
          className="h-10 w-52 border-border bg-background font-normal"
        />
      );
    }

    if (tipo === 'rango_fecha_hora') {
      const local = aDatetimeLocal(extremo);
      const [fecha = '', hora = ''] = local ? local.split('T') : [];

      return (
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={fecha || null}
            onChange={(nueva) =>
              emitir(campo, nueva ? desdeDatetimeLocal(`${nueva}T${hora || '00:00'}`) : '')
            }
            placeholder="Elegir fecha"
            disabled={disabled}
            className="h-10 w-52 border-border bg-background font-normal"
          />
          <TimePicker
            conSegundos={false}
            value={hora || null}
            onValueChange={(nueva) =>
              emitir(
                campo,
                desdeDatetimeLocal(`${fecha || fechaDeHoy()}T${nueva || '00:00'}`),
              )
            }
            disabled={disabled}
            className="h-10 w-32"
          />
        </div>
      );
    }

    const esEntero = tipo === 'rango_entero';

    return (
      <Input
        type="number"
        inputMode={esEntero ? 'numeric' : 'decimal'}
        step={esEntero ? 1 : 'any'}
        value={typeof extremo === 'number' && Number.isFinite(extremo) ? String(extremo) : ''}
        onChange={(e) => {
          const texto = e.target.value;
          if (texto === '') {
            emitir(campo, null);
            return;
          }
          const numero = Number(texto);
          emitir(campo, Number.isNaN(numero) ? texto : numero);
        }}
        placeholder={campo === 'desde' ? 'Desde' : 'Hasta'}
        disabled={disabled}
        className="h-10 w-40 border-border bg-background font-mono"
      />
    );
  };

  return (
    <div className="space-y-2">
      {(['desde', 'hasta'] as const).map((campo) => (
        <div
          key={campo}
          className="grid items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 sm:grid-cols-[80px_1fr]"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {campo}
          </span>
          {contenido(campo, campo === 'desde' ? desde : hasta)}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">
        {tipo === 'rango_fecha'
          ? 'Dos fechas; el rango incluye ambos días.'
          : tipo === 'rango_fecha_hora'
            ? 'Dos momentos exactos; se guardan en formato ISO.'
            : 'El valor «desde» debe ser menor o igual que «hasta».'}
      </p>
    </div>
  );
}

function SeleccionEditor({
  valor,
  esquema,
  disabled,
  onChange,
  error,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  onChange: (valor: unknown) => void;
  error: string | null;
}) {
  const opciones = opcionesDeEsquema(esquema);
  const actual = typeof valor === 'string' ? valor : '';
  const fueraDeLista = actual !== '' && opciones.length > 0 && !opciones.includes(actual);

  if (opciones.length === 0) {
    return (
      <div className="space-y-1">
        <Input
          value={actual}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Captura el valor de la selección"
          aria-invalid={Boolean(error)}
          className={cn(error && 'border-destructive focus-visible:ring-destructive/30')}
        />
        <p className="text-[11px] text-muted-foreground">
          Sin opciones definidas en el esquema: se captura texto libre.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Select
        value={actual || undefined}
        disabled={disabled}
        onValueChange={(opcion) => onChange(opcion)}
      >
        <SelectTrigger
          aria-invalid={Boolean(error)}
          className={cn('border-border', error && 'border-destructive focus:ring-destructive/30')}
        >
          <SelectValue placeholder="Selecciona una opción" />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion} value={opcion}>
              {opcion}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fueraDeLista && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500">
          El valor guardado («{actual}») no está entre las opciones actuales.
        </p>
      )}
    </div>
  );
}

function ListaEditor({
  valor,
  esquema,
  disabled,
  profundidad,
  mostrarValidacion,
  onChange,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  profundidad: number;
  mostrarValidacion: boolean;
  onChange: (valor: unknown) => void;
}) {
  const lista = Array.isArray(valor) ? valor : [];
  const items = esquema?.items ?? { type: 'string' };
  const tipoItem = tipoEditorDeEsquema(items);
  const metaItem = TIPOS_DATO.find((tipo) => tipo.valor === tipoItem);
  const IconoItem = ICONOS_TIPO[tipoItem];
  const tonoItem = metaItem ? TONOS_TIPO[metaItem.tono] : null;
  const [indiceNuevo, setIndiceNuevo] = useState<number | null>(null);
  const contenedores = useRef<Array<HTMLDivElement | null>>([]);

  const cambiarItem = (indice: number, nuevo: unknown) => {
    onChange(lista.map((item, i) => (i === indice ? nuevo : item)));
  };

  const quitarItem = (indice: number) => {
    onChange(lista.filter((_, i) => i !== indice));
  };

  const agregarItem = () => {
    const nuevoIndice = lista.length;
    onChange([...lista, valorInicialFormulario(tipoItem)]);
    setIndiceNuevo(nuevoIndice);
  };

  useEffect(() => {
    if (indiceNuevo === null) return;
    const marco = requestAnimationFrame(() => {
      const contenedor = contenedores.current[indiceNuevo];
      if (contenedor) {
        contenedor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const enfocable = contenedor.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([disabled]), [role="switch"]:not([disabled]), button[aria-haspopup]:not([disabled])',
        );
        (enfocable ?? contenedor).focus({ preventScroll: true });
      }
      setIndiceNuevo(null);
    });
    return () => cancelAnimationFrame(marco);
  }, [indiceNuevo]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200/80 bg-teal-50/40 px-3 py-2">
        <div className="flex items-center gap-2">
          {IconoItem && tonoItem && (
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border',
                tonoItem.icono,
              )}
            >
              <IconoItem size={18} isAnimated />
            </span>
          )}
          <div>
            <p className="text-xs font-semibold">Elementos de la lista</p>
            <p className="text-[10px] text-muted-foreground">
              Cada elemento es de tipo {etiquetaTipo(tipoItem)} y se valida por separado.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {lista.length} {lista.length === 1 ? 'elemento' : 'elementos'}
        </Badge>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 px-3 py-7 text-center">
          <List className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium">La lista está vacía</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Agrega el primer elemento; no se crean valores automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((item, indice) => (
            <div
              key={indice}
              ref={(elemento) => {
                contenedores.current[indice] = elemento;
              }}
              tabIndex={-1}
              className="scroll-mb-24 rounded-xl border border-border bg-card p-3 shadow-sm outline-none animate-in fade-in-0 slide-in-from-top-2 duration-200 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {indice + 1}
                  </span>
                  <span className="text-xs font-medium">
                    Elemento {indice + 1}
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {etiquetaTipo(tipoItem)}
                    </span>
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => quitarItem(indice)}
                  aria-label={`Quitar elemento ${indice + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <DynamicValueEditor
                tipo={tipoItem}
                esquema={items}
                valor={item}
                disabled={disabled}
                profundidad={profundidad + 1}
                requerido
                mostrarValidacion={mostrarValidacion}
                onChange={(nuevo) => cambiarItem(indice, nuevo)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-3 bg-gradient-to-t from-card via-card to-transparent px-3 pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={agregarItem}
          className="border-dashed"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar elemento
        </Button>
      </div>
    </div>
  );
}

function ObjetoEditor({
  valor,
  esquema,
  disabled,
  profundidad,
  mostrarValidacion,
  onChange,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  profundidad: number;
  mostrarValidacion: boolean;
  onChange: (valor: unknown) => void;
}) {
  const objeto = esObjetoPlano(valor) ? valor : {};
  const propiedades = esquema?.properties ?? {};
  const requeridos = esquema?.required ?? [];
  const permitirAdicionales = esquema?.additionalProperties === true;
  const clavesExtra = Object.keys(objeto).filter((clave) => !(clave in propiedades));

  const sinPropiedades = Object.keys(propiedades).length === 0;

  return (
    <div className="space-y-3">
      {sinPropiedades && !permitirAdicionales && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            El objeto no tiene campos definidos. Vuelve al paso anterior y agrega propiedades.
          </p>
        </div>
      )}

      {!sinPropiedades && (
        <div className="space-y-2.5">
          {Object.entries(propiedades).map(([clave, propiedad]) => {
            const requerido = requeridos.includes(clave);
            const tipoHijo = tipoEditorDeEsquema(propiedad);
            const esListaHijo = propiedad.type === 'array';
            const tipoElemento = esListaHijo
              ? tipoEditorDeEsquema(propiedad.items ?? null)
              : tipoHijo;
            const metaHijo = TIPOS_DATO.find((tipo) => tipo.valor === tipoElemento);
            const IconoHijo = ICONOS_TIPO[tipoElemento];
            const tonoHijo = metaHijo ? TONOS_TIPO[metaHijo.tono] : null;
            const etiquetaHijo = esListaHijo
              ? `Lista de ${etiquetaTipo(tipoElemento)}`
              : etiquetaTipo(tipoHijo);

            return (
              <div
                key={clave}
                className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:grid-cols-[minmax(150px,220px)_1fr]"
              >
                <div className="space-y-1.5 md:border-r md:border-border/70 md:pr-3">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Clave
                  </span>
                  <div className="flex items-center gap-2">
                    {IconoHijo && tonoHijo && (
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                          tonoHijo.icono,
                        )}
                      >
                        <IconoHijo size={15} isAnimated />
                      </span>
                    )}
                    <code className="min-w-0 break-all font-mono text-xs font-semibold">
                      {clave}
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        tonoHijo?.chip ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {etiquetaHijo}
                    </span>
                    {requerido && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        Obligatorio
                      </span>
                    )}
                  </div>
                  {propiedad.description && (
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      {propiedad.description}
                    </p>
                  )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Valor
                  </span>
                  <DynamicValueEditor
                    tipo={tipoHijo}
                    esquema={propiedad}
                    valor={objeto[clave]}
                    disabled={disabled}
                    profundidad={profundidad + 1}
                    requerido={requerido}
                    mostrarValidacion={mostrarValidacion}
                    onChange={(nuevo) => onChange({ ...objeto, [clave]: nuevo })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {permitirAdicionales && (
        <ClavesAdicionalesEditor
          objeto={objeto}
          propiedades={Object.keys(propiedades)}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {!permitirAdicionales && clavesExtra.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              El valor tiene claves que ya no están en el esquema:{' '}
              <code className="font-mono">{clavesExtra.join(', ')}</code>. No se guardarán.
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              const limpio: Record<string, unknown> = {};
              for (const clave of Object.keys(propiedades)) {
                if (clave in objeto) limpio[clave] = objeto[clave];
              }
              onChange(limpio);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Quitar claves
          </Button>
        </div>
      )}
    </div>
  );
}

function ClavesAdicionalesEditor({
  objeto,
  propiedades,
  disabled,
  onChange,
}: {
  objeto: Record<string, unknown>;
  propiedades: string[];
  disabled: boolean;
  onChange: (valor: unknown) => void;
}) {
  const extras = Object.keys(objeto).filter((clave) => !propiedades.includes(clave));
  const [nuevaClave, setNuevaClave] = useState('');

  const agregar = () => {
    const clave = nuevaClave.trim();
    if (!clave || clave in objeto) return;
    onChange({ ...objeto, [clave]: '' });
    setNuevaClave('');
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">Claves adicionales</p>
          <p className="text-[11px] text-muted-foreground">
            El objeto admite cualquier clave; define aquí los valores.
          </p>
        </div>
        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {extras.length}
        </span>
      </div>

      {extras.length > 0 && (
        <div className="space-y-2">
          {extras.map((clave) => (
            <ClaveValorFila
              key={clave}
              clave={clave}
              valor={objeto[clave]}
              existentes={Object.keys(objeto).filter((k) => k !== clave)}
              disabled={disabled}
              onRenombrar={(nueva) => {
                if (!nueva || nueva in objeto) return;
                const siguiente: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(objeto)) {
                  siguiente[k === clave ? nueva : k] = v;
                }
                onChange(siguiente);
              }}
              onCambiarValor={(nuevo) => onChange({ ...objeto, [clave]: nuevo })}
              onQuitar={() => {
                const siguiente = { ...objeto };
                delete siguiente[clave];
                onChange(siguiente);
              }}
            />
          ))}
        </div>
      )}

      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            value={nuevaClave}
            className="h-8 max-w-xs text-xs"
            placeholder="nuevaClave"
            onChange={(e) => setNuevaClave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={agregar}>
            <Plus className="h-3.5 w-3.5" />
            Agregar clave
          </Button>
        </div>
      )}
    </div>
  );
}

function ClaveValorFila({
  clave,
  valor,
  existentes,
  disabled,
  onRenombrar,
  onCambiarValor,
  onQuitar,
}: {
  clave: string;
  valor: unknown;
  existentes: string[];
  disabled: boolean;
  onRenombrar: (clave: string) => void;
  onCambiarValor: (valor: unknown) => void;
  onQuitar: () => void;
}) {
  const [borradorClave, setBorradorClave] = useState(clave);
  const textoValor = typeof valor === 'string' ? valor : jsonATexto(valor);

  const confirmarClave = () => {
    const limpia = borradorClave.trim();
    if (!limpia || existentes.includes(limpia)) {
      setBorradorClave(clave);
      return;
    }
    if (limpia !== clave) onRenombrar(limpia);
  };

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,1.4fr)_auto] sm:items-end">
      <div className="space-y-1">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Clave
        </span>
        <Input
          value={borradorClave}
          disabled={disabled}
          className="h-9 font-mono text-xs"
          aria-label={`Clave de ${clave}`}
          onChange={(e) => setBorradorClave(e.target.value)}
          onBlur={confirmarClave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmarClave();
            }
          }}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Valor
        </span>
        <Input
          value={textoValor}
          disabled={disabled}
          className="h-9 text-xs"
          aria-label={`Valor de ${clave}`}
          onChange={(e) => onCambiarValor(parsearValorLibre(e.target.value))}
          placeholder="Escribe el valor"
        />
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onQuitar}
        aria-label={`Quitar clave ${clave}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function parsearValorLibre(texto: string): unknown {
  if (texto.trim() === '') return '';
  try {
    const parseado: unknown = JSON.parse(texto);
    if (typeof parseado === 'string') return texto;
    return parseado;
  } catch {
    return texto;
  }
}

function JsonEditor({
  valor,
  disabled,
  ejemplo,
  onChange,
}: {
  valor: unknown;
  disabled: boolean;
  ejemplo?: string;
  onChange: (valor: unknown) => void;
}) {
  const textoInicial = jsonATexto(valor);
  const [texto, setTexto] = useState(textoInicial);
  const [error, setError] = useState<string | null>(() => {
    if (!textoInicial.trim()) return null;
    const resultado = parsearJson(textoInicial);
    return resultado.ok ? null : resultado.error;
  });

  return (
    <div className="space-y-1.5">
      <Textarea
        value={texto}
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => {
          const nuevo = e.target.value;
          setTexto(nuevo);
          if (!nuevo.trim()) {
            setError(null);
            onChange('');
            return;
          }
          const resultado = parsearJson(nuevo);
          if (resultado.ok) {
            setError(null);
            onChange(resultado.valor);
          } else {
            setError(resultado.error);
            onChange(undefined);
          }
        }}
        className={cn(
          'min-h-[200px] resize-y border-slate-700 bg-slate-950 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-400',
          error && 'border-2 border-destructive focus-visible:ring-destructive',
        )}
        placeholder={ejemplo ? `Ej. ${ejemplo}` : '{ "clave": "valor" }'}
      />
      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          JSON inválido: {error}
        </p>
      ) : texto.trim() ? (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          JSON válido.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Escribe un objeto o arreglo JSON válido; el ejemplo no se guarda.
        </p>
      )}
    </div>
  );
}
