import { useState } from 'react';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { JsonSchemaNodo } from '../types';
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
  valorPorDefecto,
} from '../utils';

export interface DynamicValueEditorProps {
  /** Tipo canónico o valor crudo del backend. */
  tipo: string;
  esquema: JsonSchemaNodo | null;
  valor: unknown;
  onChange: (valor: unknown) => void;
  disabled?: boolean;
  /** 0 = raíz. Se usa para las etiquetas de anidación. */
  profundidad?: number;
}

export function DynamicValueEditor({
  tipo,
  esquema,
  valor,
  onChange,
  disabled = false,
  profundidad = 0,
}: DynamicValueEditorProps) {
  const t = tipoEfectivo(tipo);

  switch (t) {
    case 'texto_corto':
      return (
        <Input
          value={typeof valor === 'string' ? valor : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe el valor"
        />
      );

    case 'texto_largo':
      return (
        <Textarea
          value={typeof valor === 'string' ? valor : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe el valor"
          className="min-h-[110px]"
        />
      );

    case 'entero':
    case 'decimal':
      return (
        <Input
          type="number"
          inputMode={t === 'entero' ? 'numeric' : 'decimal'}
          step={t === 'entero' ? 1 : 'any'}
          value={typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : ''}
          disabled={disabled}
          onChange={(e) => {
            const texto = e.target.value;
            if (texto === '') {
              onChange(null);
              return;
            }
            const numero = Number(texto);
            onChange(Number.isNaN(numero) ? texto : numero);
          }}
          placeholder={t === 'entero' ? '0' : '0.00'}
        />
      );

    case 'booleano':
      return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
          <Switch
            checked={valor === true}
            disabled={disabled}
            onCheckedChange={(marcado) => onChange(marcado)}
            aria-label="Valor booleano"
          />
          <span className="text-sm text-muted-foreground">
            {valor === true ? 'Verdadero' : 'Falso'}
          </span>
        </div>
      );

    case 'fecha':
      return (
        <Input
          type="date"
          value={aFechaInput(valor)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'hora':
      return (
        <Input
          type="time"
          step={1}
          value={aHoraInput(valor)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'fecha_hora':
      return (
        <Input
          type="datetime-local"
          value={aDatetimeLocal(valor)}
          disabled={disabled}
          onChange={(e) => onChange(desdeDatetimeLocal(e.target.value))}
        />
      );

    case 'seleccion':
      return (
        <SeleccionEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case 'lista':
      return (
        <ListaEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          profundidad={profundidad}
          onChange={onChange}
        />
      );

    case 'objeto':
      return (
        <ObjetoEditor
          valor={valor}
          esquema={esquema}
          disabled={disabled}
          profundidad={profundidad}
          onChange={onChange}
        />
      );

    case 'json':
    default:
      return <JsonEditor valor={valor} disabled={disabled} onChange={onChange} />;
  }
}

/* ------------------------------------------------------------------ */
/* Selección                                                           */
/* ------------------------------------------------------------------ */

function SeleccionEditor({
  valor,
  esquema,
  disabled,
  onChange,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  onChange: (valor: unknown) => void;
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
          placeholder="Valor de la selección"
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
        <SelectTrigger>
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

/* ------------------------------------------------------------------ */
/* Lista                                                               */
/* ------------------------------------------------------------------ */

function ListaEditor({
  valor,
  esquema,
  disabled,
  profundidad,
  onChange,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  profundidad: number;
  onChange: (valor: unknown) => void;
}) {
  const lista = Array.isArray(valor) ? valor : [];
  const items = esquema?.items ?? { type: 'string' };
  const tipoItem = tipoEditorDeEsquema(items);
  const esObjeto = tipoItem === 'objeto';

  const cambiarItem = (indice: number, nuevo: unknown) => {
    onChange(lista.map((item, i) => (i === indice ? nuevo : item)));
  };

  const quitarItem = (indice: number) => {
    onChange(lista.filter((_, i) => i !== indice));
  };

  const agregarItem = () => {
    onChange([...lista, valorPorDefecto(tipoItem, items)]);
  };

  return (
    <div className="space-y-2">
      {lista.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-5 text-center">
          <p className="text-xs text-muted-foreground">La lista está vacía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((item, indice) => (
            <div
              key={indice}
              className={cn(
                'rounded-lg border border-border bg-card p-2.5',
                esObjeto && 'bg-muted/10',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Elemento {indice + 1} · {etiquetaTipo(tipoItem)}
                </span>
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
                onChange={(nuevo) => cambiarItem(indice, nuevo)}
              />
            </div>
          ))}
        </div>
      )}

      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={agregarItem}>
        <Plus className="h-3.5 w-3.5" />
        Agregar elemento
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Objeto                                                              */
/* ------------------------------------------------------------------ */

function ObjetoEditor({
  valor,
  esquema,
  disabled,
  profundidad,
  onChange,
}: {
  valor: unknown;
  esquema: JsonSchemaNodo | null;
  disabled: boolean;
  profundidad: number;
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
        <div className="space-y-3">
          {Object.entries(propiedades).map(([clave, propiedad]) => {
            const requerido = requeridos.includes(clave);
            const tipoHijo = tipoEditorDeEsquema(propiedad);

            return (
              <div key={clave} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Label className="text-xs font-medium">
                    {propiedad.title ?? clave}
                    {requerido && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                    {etiquetaTipo(tipoHijo)}
                  </span>
                  {propiedad.description && (
                    <span className="text-[11px] text-muted-foreground">
                      {propiedad.description}
                    </span>
                  )}
                </div>
                <DynamicValueEditor
                  tipo={tipoHijo}
                  esquema={propiedad}
                  valor={objeto[clave]}
                  disabled={disabled}
                  profundidad={profundidad + 1}
                  onChange={(nuevo) => onChange({ ...objeto, [clave]: nuevo })}
                />
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

/* ------------------------------------------------------------------ */
/* Claves adicionales (objeto dinámico)                                */
/* ------------------------------------------------------------------ */

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
    <div className="flex items-start gap-2">
      <Input
        value={borradorClave}
        disabled={disabled}
        className="h-8 w-[160px] shrink-0 font-mono text-xs"
        aria-label="Clave"
        onChange={(e) => setBorradorClave(e.target.value)}
        onBlur={confirmarClave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmarClave();
          }
        }}
      />
      <Input
        value={textoValor}
        disabled={disabled}
        className="h-8 flex-1 text-xs"
        aria-label={`Valor de ${clave}`}
        onChange={(e) => onCambiarValor(parsearValorLibre(e.target.value))}
        placeholder="valor"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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

/* ------------------------------------------------------------------ */
/* JSON libre                                                          */
/* ------------------------------------------------------------------ */

function JsonEditor({
  valor,
  disabled,
  onChange,
}: {
  valor: unknown;
  disabled: boolean;
  onChange: (valor: unknown) => void;
}) {
  const [texto, setTexto] = useState(() => jsonATexto(valor));
  const [error, setError] = useState<string | null>(() => {
    const resultado = parsearJson(jsonATexto(valor));
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
          const resultado = parsearJson(nuevo);
          if (resultado.ok) {
            setError(null);
            onChange(resultado.valor);
          } else {
            setError(resultado.error);
            // Un JSON inválido invalida el valor para bloquear el guardado.
            onChange(undefined);
          }
        }}
        className={cn(
          'min-h-[180px] font-mono text-xs',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
        placeholder='{ "clave": "valor" }'
      />
      {error ? (
        <p className="text-[11px] text-destructive">JSON inválido: {error}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Se valida al escribir; el valor se envía como JSON.
        </p>
      )}
    </div>
  );
}
