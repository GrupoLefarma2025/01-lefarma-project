import { UsersRound } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { iniciales, tonoAvatar } from '../calendarioUtils';

export interface ResponsableOpcion {
  id: number;
  nombre: string;
  detalle: string;
  total: number;
  activo: boolean;
  onClick: () => void;
}

interface ResponsablesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: 'ejecutivos' | 'especialistas';
  onTabChange: (tab: 'ejecutivos' | 'especialistas') => void;
  ejecutivosCount: number;
  especialistasCount: number;
  personas: ResponsableOpcion[];
  total: number;
  onTodos: () => void;
}

export function ResponsablesSheet({
  open,
  onOpenChange,
  tab,
  onTabChange,
  ejecutivosCount,
  especialistasCount,
  personas,
  total,
  onTodos,
}: ResponsablesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4 text-orange-500" />
            Colaboradores
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            Filtra el calendario por ejecutivo o especialista. En escritorio este panel vive en el
            rail lateral.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as 'ejecutivos' | 'especialistas')}
          className="mt-4"
        >
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-lg bg-slate-50 p-0.5 dark:bg-slate-900/60">
            <TabsTrigger value="ejecutivos" className="text-[11px]">
              Ejecutivos ({ejecutivosCount})
            </TabsTrigger>
            <TabsTrigger value="especialistas" className="text-[11px]">
              Especialistas ({especialistasCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-3 space-y-1">
          <button
            type="button"
            onClick={onTodos}
            className={[
              'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors',
              personas.every((persona) => !persona.activo)
                ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
                : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
            ].join(' ')}
          >
            <span>Todos</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {total}
            </span>
          </button>

          {personas.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-slate-400">
              Sin colaboradores activos.
            </p>
          ) : (
            personas.map((persona) => (
              <button
                key={persona.id}
                type="button"
                onClick={persona.onClick}
                className={[
                  'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
                  persona.activo
                    ? 'bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900/60',
                ].join(' ')}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tonoAvatar(persona.nombre)}`}
                >
                  {iniciales(persona.nombre)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {persona.nombre}
                  </span>
                  <span className="block truncate text-[9px] text-slate-400">
                    {persona.detalle}
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {persona.total}
                </span>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
