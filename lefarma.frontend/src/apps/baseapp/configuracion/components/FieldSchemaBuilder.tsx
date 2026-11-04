import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TIPOS_DATO,
  type SchemaField,
  type TipoCampoConstructor,
} from '../types';
import { NOMBRE_CAMPO_REGEX, aCamelCase, campoVacio } from '../utils';

const MAX_PROFUNDIDAD = 4;

interface FieldSchemaBuilderProps {
  campos: SchemaField[];
  onChange: (campos: SchemaField[]) => void;
  disabled?: boolean;
  profundidad?: number;
  /** Etiqueta del contenedor (por defecto "Propiedades"). */
  titulo?: string;
}

export function FieldSchemaBuilder({
  campos,
  onChange,
  disabled = false,
  profundidad = 0,
  titulo = 'Propiedades',
}: FieldSchemaBuilderProps) {
  const agregarCampo = () => {
    // Autofoco: el nombre vacío marca el campo recién creado.
    onChange([...campos, campoVacio()]);
  };

  const actualizarCampo = (id: string, siguiente: SchemaField) => {
    onChange(campos.map((campo) => (campo.id === id ? siguiente : campo)));
  };

  const quitarCampo = (id: string) => {
    onChange(campos.filter((campo) => campo.id !== id));
  };

  const nombres = campos.map((campo) => campo.nombre.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{titulo}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {campos.length} {campos.length === 1 ? 'campo' : 'campos'}
          </span>
        </div>
        {!disabled && profundidad < MAX_PROFUNDIDAD && (
          <Button type="button" size="sm" variant="outline" onClick={agregarCampo}>
            <Plus className="h-3.5 w-3.5" />
            Agregar campo
          </Button>
        )}
      </div>

      {profundidad >= MAX_PROFUNDIDAD && (
        <p className="text-xs text-muted-foreground">
          Se alcanzó la profundidad máxima de anidación. Usa un editor JSON si necesitas más
          niveles.
        </p>
      )}

      {campos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {titulo === 'Propiedades'
              ? 'Aún no hay propiedades. Agrega la primera para definir la estructura.'
              : 'Sin campos en este objeto.'}
          </p>
          {!disabled && profundidad < MAX_PROFUNDIDAD && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={agregarCampo}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar campo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {campos.map((campo) => (
            <CampoRow
              key={campo.id}
              campo={campo}
              nombresHermanos={nombres}
              disabled={disabled}
              profundidad={profundidad}
              onChange={(siguiente) => actualizarCampo(campo.id, siguiente)}
              onRemove={() => quitarCampo(campo.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CampoRowProps {
  campo: SchemaField;
  nombresHermanos: string[];
  disabled: boolean;
  profundidad: number;
  onChange: (campo: SchemaField) => void;
  onRemove: () => void;
}

function CampoRow({
  campo,
  nombresHermanos,
  disabled,
  profundidad,
  onChange,
  onRemove,
}: CampoRowProps) {
  const [expandido, setExpandido] = useState(() => campo.nombre.trim() === '');

  const nombre = campo.nombre.trim();
  const duplicado = nombre !== '' && nombresHermanos.filter((n) => n === nombre).length > 1;
  const invalido = nombre !== '' && !NOMBRE_CAMPO_REGEX.test(nombre);
  const errorNombre = duplicado
    ? 'Nombre repetido en este nivel.'
    : invalido
      ? 'Solo letras, números y guion bajo (sin iniciar con número).'
      : null;

  const actualizar = (parcial: Partial<SchemaField>) => {
    onChange({ ...campo, ...parcial });
  };

  const cambiarTipo = (tipo: TipoCampoConstructor) => {
    if (tipo === 'objeto' || tipo === 'lista' || tipo === 'seleccion') {
      setExpandido(true);
    }

    const siguiente: SchemaField = { ...campo, tipo };

    if (tipo !== 'seleccion') siguiente.opciones = undefined;
    if (tipo !== 'objeto') {
      if (tipo !== 'lista') {
        siguiente.campos = undefined;
        siguiente.clavesAdicionales = false;
      }
    }
    if (tipo === 'objeto' && !campo.campos) siguiente.campos = [];
    if (tipo === 'lista') {
      siguiente.itemTipo = campo.itemTipo ?? 'texto_corto';
      if (siguiente.itemTipo === 'objeto' && !campo.campos) siguiente.campos = [];
    }
    onChange(siguiente);
  };

  const cambiarTipoItem = (itemTipo: TipoCampoConstructor) => {
    onChange({
      ...campo,
      itemTipo,
      campos: itemTipo === 'objeto' ? campo.campos ?? [] : undefined,
      clavesAdicionales: itemTipo === 'objeto' ? campo.clavesAdicionales ?? false : false,
      opciones: itemTipo === 'seleccion' ? campo.opciones ?? [] : undefined,
    });
  };

  const tieneDetalle =
    campo.tipo === 'objeto' || campo.tipo === 'lista' || campo.tipo === 'seleccion';

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        errorNombre ? 'border-destructive/50' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:flex-nowrap">
        <GripVertical
          className={cn(
            'hidden h-4 w-4 shrink-0 sm:block',
            campo.obligatorio ? 'text-foreground/40' : 'text-muted-foreground/30',
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <Input
            value={campo.nombre}
            disabled={disabled}
            autoFocus={campo.nombre.trim() === ''}
            placeholder="nombreDelCampo"
            aria-label="Nombre del campo"
            className="h-8 font-mono text-xs"
            onChange={(e) => actualizar({ nombre: e.target.value })}
            onBlur={(e) => {
              const limpio = e.target.value.trim();
              if (limpio && !NOMBRE_CAMPO_REGEX.test(limpio)) {
                actualizar({ nombre: aCamelCase(limpio) });
              }
            }}
          />
          {errorNombre && (
            <p className="mt-1 px-1 text-[11px] text-destructive">{errorNombre}</p>
          )}
        </div>

        <div className="w-[150px] shrink-0">
          <Select
            value={campo.tipo}
            disabled={disabled}
            onValueChange={(valor) => cambiarTipo(valor as TipoCampoConstructor)}
          >
            <SelectTrigger className="h-8 text-xs" aria-label="Tipo del campo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DATO.map((tipo) => (
                <SelectItem key={tipo.valor} value={tipo.valor} className="text-xs">
                  {tipo.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
          <Checkbox
            checked={campo.obligatorio}
            disabled={disabled}
            onCheckedChange={(valor) => actualizar({ obligatorio: valor === true })}
            aria-label="Campo obligatorio"
          />
          <span className="text-[11px] text-muted-foreground">Obligatorio</span>
        </label>

        {tieneDetalle && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => setExpandido((valor) => !valor)}
            aria-label={expandido ? 'Contraer campo' : 'Editar detalle del campo'}
            title={expandido ? 'Contraer' : 'Editar'}
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}

        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={onRemove}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Quitar campo"
          title="Quitar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expandido && tieneDetalle && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`desc-${campo.id}`} className="text-xs">
              Descripción del campo (opcional)
            </Label>
            <Input
              id={`desc-${campo.id}`}
              value={campo.descripcion ?? ''}
              disabled={disabled}
              placeholder="Ayuda para quien consuma este dato"
              className="h-8 text-xs"
              onChange={(e) => actualizar({ descripcion: e.target.value })}
            />
          </div>

          {campo.tipo === 'seleccion' && (
            <OpcionesEditor
              opciones={campo.opciones ?? []}
              disabled={disabled}
              onChange={(opciones) => actualizar({ opciones })}
            />
          )}

          {campo.tipo === 'objeto' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={campo.clavesAdicionales ?? false}
                  disabled={disabled}
                  onCheckedChange={(valor) =>
                    actualizar({ clavesAdicionales: valor === true })
                  }
                />
                Permitir claves adicionales (objeto dinámico)
              </label>
              <div className="border-l-2 border-border pl-3">
                <FieldSchemaBuilder
                  campos={campo.campos ?? []}
                  onChange={(campos) => actualizar({ campos })}
                  disabled={disabled}
                  profundidad={profundidad + 1}
                  titulo="Propiedades del objeto"
                />
              </div>
            </div>
          )}

          {campo.tipo === 'lista' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Tipo de los elementos</Label>
                <Select
                  value={campo.itemTipo ?? 'texto_corto'}
                  disabled={disabled}
                  onValueChange={(valor) => cambiarTipoItem(valor as TipoCampoConstructor)}
                >
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DATO.filter((tipo) => tipo.valor !== 'lista').map((tipo) => (
                      <SelectItem key={tipo.valor} value={tipo.valor} className="text-xs">
                        {tipo.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {campo.itemTipo === 'seleccion' && (
                <OpcionesEditor
                  opciones={campo.opciones ?? []}
                  disabled={disabled}
                  onChange={(opciones) => actualizar({ opciones })}
                  titulo="Opciones de cada elemento"
                />
              )}

              {campo.itemTipo === 'objeto' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={campo.clavesAdicionales ?? false}
                      disabled={disabled}
                      onCheckedChange={(valor) =>
                        actualizar({ clavesAdicionales: valor === true })
                      }
                    />
                    Permitir claves adicionales en cada elemento
                  </label>
                  <div className="border-l-2 border-border pl-3">
                    <FieldSchemaBuilder
                      campos={campo.campos ?? []}
                      onChange={(campos) => actualizar({ campos })}
                      disabled={disabled}
                      profundidad={profundidad + 1}
                      titulo="Campos de cada elemento"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OpcionesEditorProps {
  opciones: string[];
  onChange: (opciones: string[]) => void;
  disabled?: boolean;
  titulo?: string;
}

function OpcionesEditor({
  opciones,
  onChange,
  disabled = false,
  titulo = 'Opciones de selección',
}: OpcionesEditorProps) {
  const [borrador, setBorrador] = useState('');

  const agregar = () => {
    const valor = borrador.trim();
    if (!valor) return;
    if (opciones.includes(valor)) {
      setBorrador('');
      return;
    }
    onChange([...opciones, valor]);
    setBorrador('');
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{titulo}</Label>
      {opciones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((opcion) => (
            <span
              key={opcion}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {opcion}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Quitar ${opcion}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(opciones.filter((o) => o !== opcion))}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            value={borrador}
            placeholder="Nueva opción"
            className="h-8 max-w-xs text-xs"
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={agregar}>
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      )}
      {opciones.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Agrega al menos una opción para continuar.
        </p>
      )}
    </div>
  );
}

/** Editor de una lista simple de opciones (tipo selección de nivel superior). */
export function OpcionesSeleccionEditor(props: OpcionesEditorProps) {
  return <OpcionesEditor {...props} />;
}
