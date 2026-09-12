import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UsuarioCatalogo } from '../types/educacionMedica.types';

interface UsuarioSearchSelectProps {
  usuarios: UsuarioCatalogo[];
  value: number | null;
  onChange: (idUsuario: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  idsExcluidos?: number[];
  mensajeExcluido?: string;
}

export function UsuarioSearchSelect({
  usuarios,
  value,
  onChange,
  placeholder = 'Buscar usuario...',
  disabled,
  idsExcluidos = [],
  mensajeExcluido,
}: UsuarioSearchSelectProps) {
  const [open, setOpen] = useState(false);

  const seleccionado = useMemo(
    () => usuarios.find((u) => u.idUsuario === value) ?? null,
    [usuarios, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {seleccionado ? seleccionado.nombreCompleto : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nombre o correo..." />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {usuarios.map((usuario) => {
                const excluido = idsExcluidos.includes(usuario.idUsuario);
                return (
                  <CommandItem
                    key={usuario.idUsuario}
                    value={`${usuario.nombreCompleto} ${usuario.correo}`}
                    disabled={excluido}
                    onSelect={() => {
                      onChange(usuario.idUsuario);
                      setOpen(false);
                    }}
                    className={cn(excluido && 'opacity-50')}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === usuario.idUsuario ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{usuario.nombreCompleto}</p>
                      {usuario.correo && (
                        <p className="truncate text-xs text-muted-foreground">{usuario.correo}</p>
                      )}
                      {excluido && mensajeExcluido && (
                        <p className="text-xs text-destructive">{mensajeExcluido}</p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
