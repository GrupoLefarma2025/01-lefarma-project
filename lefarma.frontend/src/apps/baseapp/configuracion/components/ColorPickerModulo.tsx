import { useEffect, useState } from 'react';
import { Check, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  COLORES_MODULO,
  COLOR_MODULO_POR_OMISION,
  colorAleatorioModulo,
  colorTextoContraste,
  normalizarColorHex,
} from '../colores';

interface ColorPickerModuloProps {
  id?: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPickerModulo({
  id,
  value,
  onChange,
  disabled,
}: ColorPickerModuloProps) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(value);

  useEffect(() => {
    setTexto(value);
  }, [value]);

  const colorActual = normalizarColorHex(value) ?? COLOR_MODULO_POR_OMISION;

  const elegir = (color: string) => {
    onChange(color);
    setTexto(color);
  };

  const confirmarTexto = () => {
    const normalizado = normalizarColorHex(texto);
    if (normalizado) {
      elegir(normalizado);
    } else {
      setTexto(value);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 w-full justify-start gap-2 font-mono text-sm"
            aria-label={`Color del módulo: ${colorActual}`}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: colorActual }}
            />
            {colorActual.toUpperCase()}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[16.5rem] p-3">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Elige un color
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {COLORES_MODULO.map(({ valor, nombre }) => {
                const activo = colorActual === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md border border-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      activo && 'ring-2 ring-ring ring-offset-1',
                    )}
                    style={{
                      backgroundColor: valor,
                      color: colorTextoContraste(valor),
                    }}
                    onClick={() => elegir(valor)}
                    title={nombre}
                    aria-label={`${nombre}${activo ? ' (seleccionado)' : ''}`}
                  >
                    {activo && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-2">
              <input
                type="color"
                value={colorActual}
                onChange={(evento) => elegir(evento.target.value)}
                className="h-8 w-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                aria-label="Elegir un color exacto"
              />
              <Input
                value={texto}
                onChange={(evento) => {
                  const siguiente = evento.target.value;
                  setTexto(siguiente);
                  const normalizado = normalizarColorHex(siguiente);
                  if (normalizado) onChange(normalizado);
                }}
                onBlur={confirmarTexto}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    confirmarTexto();
                  }
                }}
                className="h-8 font-mono text-xs uppercase"
                maxLength={7}
                spellCheck={false}
                aria-label="Código hexadecimal del color"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={disabled}
        onClick={() => elegir(colorAleatorioModulo())}
        title="Elegir un color al azar"
        aria-label="Elegir un color al azar"
      >
        <Shuffle className="h-4 w-4" />
      </Button>
    </div>
  );
}
