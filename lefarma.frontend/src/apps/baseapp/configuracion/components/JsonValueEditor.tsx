import { useState } from 'react';
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  List,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { jsonATexto, parsearJson } from '../utils';

/* ------------------------------------------------------------------ */
/* Modelo del constructor                                              */
/* ------------------------------------------------------------------ */

type TipoNodo = 'texto' | 'numero' | 'booleano' | 'objeto' | 'lista' | 'nulo';

interface CampoJson {
  id: string;
  clave: string;
  valor: NodoJson;
}

type NodoJson =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'numero'; valor: number | '' }
  | { tipo: 'booleano'; valor: boolean }
  | { tipo: 'nulo' }
  | { tipo: 'objeto'; campos: CampoJson[] }
  | { tipo: 'lista'; items: NodoJson[] };

const TIPOS_NODO: { valor: TipoNodo; etiqueta: string }[] = [
  { valor: 'texto', etiqueta: 'Texto' },
  { valor: 'numero', etiqueta: 'Número' },
  { valor: 'booleano', etiqueta: 'Sí / No' },
  { valor: 'objeto', etiqueta: 'Objeto' },
  { valor: 'lista', etiqueta: 'Lista' },
  { valor: 'nulo', etiqueta: 'Nulo' },
];

let secuencia = 0;
const nuevoId = () => `campo-${++secuencia}`;

function crearNodo(tipo: TipoNodo): NodoJson {
  switch (tipo) {
    case 'texto':
      return { tipo: 'texto', valor: '' };
    case 'numero':
      return { tipo: 'numero', valor: 0 };
    case 'booleano':
      return { tipo: 'booleano', valor: false };
    case 'objeto':
      return { tipo: 'objeto', campos: [] };
    case 'lista':
      return { tipo: 'lista', items: [] };
    case 'nulo':
      return { tipo: 'nulo' };
  }
}

function aNodo(valor: unknown): NodoJson {
  if (valor === null || valor === undefined) return { tipo: 'nulo' };
  if (Array.isArray(valor)) return { tipo: 'lista', items: valor.map(aNodo) };
  if (typeof valor === 'object') {
    const campos = Object.entries(valor as Record<string, unknown>).map(
      ([clave, valorCampo]) => ({
        id: nuevoId(),
        clave,
        valor: aNodo(valorCampo),
      }),
    );
    return { tipo: 'objeto', campos };
  }
  if (typeof valor === 'number') return { tipo: 'numero', valor };
  if (typeof valor === 'boolean') return { tipo: 'booleano', valor };
  if (typeof valor === 'string') return { tipo: 'texto', valor };
  return { tipo: 'nulo' };
}

/** JSON vacío o sin valor arranca como objeto, que es el caso habitual. */
function aNodoInicial(valor: unknown): NodoJson {
  if (valor === '' || valor === undefined) return crearNodo('objeto');
  return aNodo(valor);
}

function aValor(nodo: NodoJson): unknown {
  switch (nodo.tipo) {
    case 'texto':
      return nodo.valor;
    case 'numero':
      return nodo.valor === '' ? 0 : nodo.valor;
    case 'booleano':
      return nodo.valor;
    case 'nulo':
      return null;
    case 'lista':
      return nodo.items.map(aValor);
    case 'objeto': {
      const objeto: Record<string, unknown> = {};
      for (const campo of nodo.campos) {
        const clave = campo.clave.trim();
        if (clave) objeto[clave] = aValor(campo.valor);
      }
      return objeto;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Editor de un nodo                                                   */
/* ------------------------------------------------------------------ */

interface EditorNodoProps {
  nodo: NodoJson;
  onCambiar: (nodo: NodoJson) => void;
  disabled: boolean;
  raiz?: boolean;
  onEliminar?: () => void;
}

function EditorNodo({ nodo, onCambiar, disabled, raiz = false, onEliminar }: EditorNodoProps) {
  const contenedor = nodo.tipo === 'objeto' || nodo.tipo === 'lista';

  const agregarCampo = () => {
    if (nodo.tipo !== 'objeto') return;
    onCambiar({
      ...nodo,
      campos: [
        ...nodo.campos,
        { id: nuevoId(), clave: '', valor: crearNodo('texto') },
      ],
    });
  };

  const agregarElemento = () => {
    if (nodo.tipo !== 'lista') return;
    onCambiar({ ...nodo, items: [...nodo.items, crearNodo('texto')] });
  };

  const cambiarCampo = (id: string, valor: NodoJson) => {
    if (nodo.tipo !== 'objeto') return;
    onCambiar({
      ...nodo,
      campos: nodo.campos.map((campo) =>
        campo.id === id ? { ...campo, valor } : campo,
      ),
    });
  };

  const renombrarCampo = (id: string, clave: string) => {
    if (nodo.tipo !== 'objeto') return;
    onCambiar({
      ...nodo,
      campos: nodo.campos.map((campo) => (campo.id === id ? { ...campo, clave } : campo)),
    });
  };

  const eliminarCampo = (id: string) => {
    if (nodo.tipo !== 'objeto') return;
    onCambiar({ ...nodo, campos: nodo.campos.filter((campo) => campo.id !== id) });
  };

  const cambiarElemento = (indice: number, valor: NodoJson) => {
    if (nodo.tipo !== 'lista') return;
    onCambiar({
      ...nodo,
      items: nodo.items.map((item, posicion) => (posicion === indice ? valor : item)),
    });
  };

  const eliminarElemento = (indice: number) => {
    if (nodo.tipo !== 'lista') return;
    onCambiar({ ...nodo, items: nodo.items.filter((_, posicion) => posicion !== indice) });
  };

  const claves = nodo.tipo === 'objeto' ? nodo.campos.map((campo) => campo.clave.trim()) : [];
  const clavesRepetidas = new Set(
    claves.filter((clave, indice) => clave !== '' && claves.indexOf(clave) !== indice),
  );

  return (
    <div
      className={cn(
        'rounded-lg border p-1.5',
        contenedor ? 'border-border/80 bg-muted/20' : 'border-border/60 bg-background',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {raiz && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Estructura
            </span>
          )}
          <Select
            value={nodo.tipo}
            onValueChange={(tipo) => onCambiar(crearNodo(tipo as TipoNodo))}
            disabled={disabled}
          >
            <SelectTrigger
              className="h-7 w-[104px] border-border px-2 py-0 text-[11px]"
              aria-label={raiz ? 'Tipo del JSON' : 'Tipo del valor'}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_NODO.map((tipo) => (
                <SelectItem key={tipo.valor} value={tipo.valor} className="text-xs">
                  {tipo.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {contenedor && (
            <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
              {nodo.tipo === 'objeto' ? (
                <>
                  <Braces className="h-3 w-3" />
                  {nodo.campos.length} campo{nodo.campos.length === 1 ? '' : 's'}
                </>
              ) : (
                <>
                  <List className="h-3 w-3" />
                  {nodo.items.length} elemento{nodo.items.length === 1 ? '' : 's'}
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {nodo.tipo === 'objeto' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-border px-2 text-[11px]"
              onClick={agregarCampo}
              disabled={disabled}
            >
              <Plus className="h-3 w-3" />
              Campo
            </Button>
          )}
          {nodo.tipo === 'lista' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-border px-2 text-[11px]"
              onClick={agregarElemento}
              disabled={disabled}
            >
              <Plus className="h-3 w-3" />
              Elemento
            </Button>
          )}
          {onEliminar && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={onEliminar}
              disabled={disabled}
              aria-label="Eliminar este valor"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-1.5 space-y-1.5">
        {nodo.tipo === 'texto' && (
          <Input
            value={nodo.valor}
            onChange={(e) => onCambiar({ tipo: 'texto', valor: e.target.value })}
            placeholder="Texto"
            disabled={disabled}
            aria-label="Valor de texto"
            className="h-8 border-border text-sm"
          />
        )}

        {nodo.tipo === 'numero' && (
          <Input
            type="number"
            inputMode="decimal"
            value={nodo.valor === '' ? '' : nodo.valor}
            onChange={(e) => {
              const texto = e.target.value;
              const numero = Number(texto);
              onCambiar({
                tipo: 'numero',
                valor: texto === '' || Number.isNaN(numero) ? '' : numero,
              });
            }}
            placeholder="0"
            disabled={disabled}
            aria-label="Valor numérico"
            className="h-8 w-40 border-border font-mono text-sm"
          />
        )}

        {nodo.tipo === 'booleano' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={nodo.valor}
              onCheckedChange={(valor) => onCambiar({ tipo: 'booleano', valor })}
              disabled={disabled}
              aria-label="Valor booleano"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {nodo.valor ? 'true' : 'false'}
            </span>
          </div>
        )}

        {nodo.tipo === 'nulo' && (
          <p className="text-xs text-muted-foreground">
            <code className="font-mono">null</code>
          </p>
        )}

        {nodo.tipo === 'objeto' && (
          <>
            {nodo.campos.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground">
                Sin campos todavía. Usa «Campo» para agregar el primero.
              </p>
            ) : (
              nodo.campos.map((campo) => (
                <div
                  key={campo.id}
                  className="rounded-md border border-border/70 bg-background p-1.5"
                >
                  <div className="flex items-center gap-1.5 pb-1">
                    <Input
                      value={campo.clave}
                      onChange={(e) => renombrarCampo(campo.id, e.target.value)}
                      placeholder="clave"
                      disabled={disabled}
                      aria-label="Nombre del campo"
                      className="h-7 min-w-0 flex-1 border-border font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => eliminarCampo(campo.id)}
                      disabled={disabled}
                      aria-label={`Eliminar el campo ${campo.clave || 'sin nombre'}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <EditorNodo
                    nodo={campo.valor}
                    onCambiar={(valor) => cambiarCampo(campo.id, valor)}
                    disabled={disabled}
                  />
                </div>
              ))
            )}

            {clavesRepetidas.size > 0 && (
              <p className="flex items-start gap-1 text-[10px] text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                Hay claves repetidas: {Array.from(clavesRepetidas).join(', ')}. Se guarda el
                último valor.
              </p>
            )}
          </>
        )}

        {nodo.tipo === 'lista' && (
          <>
            {nodo.items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 px-2 py-2 text-[11px] text-muted-foreground">
                Lista vacía. Usa «Elemento» para agregar el primero.
              </p>
            ) : (
              nodo.items.map((item, indice) => (
                <div key={indice} className="flex items-start gap-1.5">
                  <span className="mt-1.5 w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    {indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <EditorNodo
                      nodo={item}
                      onCambiar={(valor) => cambiarElemento(indice, valor)}
                      onEliminar={() => eliminarElemento(indice)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modo código                                                         */
/* ------------------------------------------------------------------ */

function EditorCodigoJson({
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
          'min-h-[220px] resize-y border-slate-700 bg-slate-950 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-400',
          error && 'border-2 border-destructive focus-visible:ring-destructive',
        )}
        placeholder={ejemplo ? `Ej. ${ejemplo}` : '{ "clave": "valor" }'}
        aria-label="Código JSON de la variable"
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

/* ------------------------------------------------------------------ */
/* Editor principal                                                    */
/* ------------------------------------------------------------------ */

export interface JsonValueEditorProps {
  valor: unknown;
  disabled?: boolean;
  ejemplo?: string;
  onChange: (valor: unknown) => void;
}

export function JsonValueEditor({
  valor,
  disabled = false,
  ejemplo,
  onChange,
}: JsonValueEditorProps) {
  const [modo, setModo] = useState<'formulario' | 'codigo'>('formulario');
  const [raiz, setRaiz] = useState<NodoJson>(() => aNodoInicial(valor));

  const aplicar = (nodo: NodoJson) => {
    setRaiz(nodo);
    onChange(aValor(nodo));
  };

  const cambiarModo = (siguiente: 'formulario' | 'codigo') => {
    // Al volver del código, el formulario se arma con el JSON ya parseado.
    if (siguiente === 'formulario' && valor !== undefined) {
      setRaiz(aNodoInicial(valor));
    }
    setModo(siguiente);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          <Button
            type="button"
            size="sm"
            variant={modo === 'formulario' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => cambiarModo('formulario')}
            aria-pressed={modo === 'formulario'}
          >
            Formulario
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modo === 'codigo' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => cambiarModo('codigo')}
            aria-pressed={modo === 'codigo'}
          >
            Código
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {modo === 'formulario'
            ? 'Campos anidados: cada objeto o lista abre sus propios valores.'
            : 'Pega o edita el JSON completo; se valida al escribir.'}
        </p>
      </div>

      {modo === 'formulario' ? (
        <EditorNodo nodo={raiz} onCambiar={aplicar} disabled={disabled} raiz />
      ) : (
        <EditorCodigoJson
          valor={valor}
          disabled={disabled}
          ejemplo={ejemplo}
          onChange={onChange}
        />
      )}
    </div>
  );
}
