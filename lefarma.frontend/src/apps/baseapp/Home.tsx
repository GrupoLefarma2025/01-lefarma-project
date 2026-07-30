import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Pin } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';
import { Card } from '@/components/ui/card';
import { checkPermission, usePermissionVersion } from '@/utils/permissions';
import { cn } from '@/lib/utils';

const PINNED_KEY = 'hub-pinned-apps';
const ORDER_KEY = 'hub-app-order';

function readIds(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null; // ponytail: storage corrupto/indisponible → default
  }
}

function writeIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

/** Ordena `entries` siguiendo `order`; ids no listados van al final en su orden original. */
function orderBy<T extends { id: string }>(entries: T[], order: string[] | null): T[] {
  if (!order) return entries;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of order) {
    const e = byId.get(id);
    if (e) {
      out.push(e);
      seen.add(id);
    }
  }
  for (const e of entries) if (!seen.has(e.id)) out.push(e);
  return out;
}

/**
 * Reordena una proyección visible dentro de la lista completa, preservando en su
 * sitio los ids que hoy no son visibles (ej. app sin permiso): así un pin de una
 * app temporalmente oculta no se pierde al reordenar las visibles.
 */
function reorderProjection(full: string[], visible: string[], from: number, to: number): string[] {
  const moved = arrayMove(visible, from, to);
  const visSet = new Set(visible);
  const out: string[] = [];
  let vi = 0;
  for (const id of full) out.push(visSet.has(id) ? moved[vi++] : id);
  return out;
}

/**
 * Launcher home del shell (spec base-app: "Home Launcher"). Dos secciones:
 *  - "Fijadas": atajos rápidos del usuario (solo si hay ≥1), reordenables por drag.
 *  - "Todas las apps": catálogo completo, también reordenable por drag.
 * Las apps fijadas aparecen en AMBAS secciones. El orden y los pines persisten en
 * localStorage. El launcher no asume contexto empresa/sucursal/área.
 */
export function Home() {
  usePermissionVersion(); // subscribe — re-render cuando cambian los permisos (SSE/polling)
  const visibleApps = appRegistry.filter(
    (app) => !app.permission || checkPermission({ require: app.permission })
  );

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readIds(PINNED_KEY) ?? []);
  const [orderIds, setOrderIds] = useState<string[] | null>(() => readIds(ORDER_KEY));

  const togglePin = (id: string) => {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((x) => x !== id)
      : [...pinnedIds, id];
    writeIds(PINNED_KEY, next);
    setPinnedIds(next);
  };

  const pinnedSet = new Set(pinnedIds);
  const pinnedEntries = orderBy(
    visibleApps.filter((a) => pinnedSet.has(a.id)),
    pinnedIds
  );
  const allEntries = orderBy(visibleApps, orderIds);

  const onReorderPinned = (from: number, to: number) => {
    const next = reorderProjection(pinnedIds, pinnedEntries.map((a) => a.id), from, to);
    writeIds(PINNED_KEY, next);
    setPinnedIds(next);
  };
  const onReorderAll = (from: number, to: number) => {
    const base = orderIds ?? allEntries.map((a) => a.id);
    const next = reorderProjection(base, allEntries.map((a) => a.id), from, to);
    writeIds(ORDER_KEY, next);
    setOrderIds(next);
  };

  if (visibleApps.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">No hay aplicaciones disponibles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aplicaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona una aplicación para continuar.
        </p>
      </div>

      {pinnedEntries.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Pin className="h-3.5 w-3.5 fill-current text-primary" />
            Fijadas
          </h2>
          <SortableGrid entries={pinnedEntries} onReorder={onReorderPinned} pinned onTogglePin={togglePin} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Todas las apps
        </h2>
        <SortableGrid entries={allEntries} onReorder={onReorderAll} pinned={false} onTogglePin={togglePin} />
      </section>
    </div>
  );
}

const GRID_CLASS = 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';

function SortableGrid({
  entries,
  onReorder,
  pinned,
  onTogglePin,
}: {
  entries: AppRegistryEntry[];
  onReorder: (from: number, to: number) => void;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((a) => a.id === active.id);
    const to = entries.findIndex((a) => a.id === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={entries.map((a) => a.id)} strategy={rectSortingStrategy}>
        <div className={GRID_CLASS}>
          {entries.map((app, index) => (
            <SortableTile
              key={app.id}
              app={app}
              index={index}
              pinned={pinned}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({
  app,
  index,
  pinned,
  onTogglePin,
}: {
  app: AppRegistryEntry;
  index: number;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
    disabled: app.disabled,
  });
  const Icon = app.icon;

  const card = (
    <Card
      className={cn(
        'relative flex h-full flex-col items-center justify-center gap-2 p-4 text-center',
        'transition-all duration-200 ease-out',
        'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both',
        !app.disabled && [
          'cursor-pointer hover:-translate-y-1 hover:shadow-lg',
          'hover:border-primary/30 focus-within:border-primary/30',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        ],
        app.disabled && 'cursor-not-allowed opacity-60',
        isDragging && 'ring-2 ring-primary shadow-lg'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {Icon && (
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            'bg-primary/10 text-primary transition-colors duration-200',
            !app.disabled && 'group-hover:bg-primary group-hover:text-primary-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-tight tracking-tight">{app.label}</p>
        {app.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{app.description}</p>
        )}
        {app.disabled && <span className="text-xs text-muted-foreground">Próximamente</span>}
      </div>
    </Card>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-20 opacity-40')}
    >
      {app.disabled ? (
        card
      ) : (
        <Link
          to={app.path}
          aria-label={app.label}
          tabIndex={isDragging ? -1 : 0}
          className="block h-full no-underline focus:outline-none"
        >
          {card}
        </Link>
      )}

      {!app.disabled && (
        <>
          <button
            type="button"
            aria-pressed={pinned}
            aria-label={pinned ? `Desfijar ${app.label}` : `Fijar ${app.label}`}
            title={pinned ? 'Desfijar' : 'Fijar'}
            onClick={() => onTogglePin(app.id)}
            className={cn(
              'absolute right-1.5 top-1.5 z-10 rounded-md p-1 transition-colors',
              'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
              pinned && 'text-primary hover:text-primary'
            )}
          >
            <Pin className={cn('h-3.5 w-3.5 transition-transform', pinned && 'fill-current')} />
          </button>

          <button
            type="button"
            aria-label={`Reordenar ${app.label}`}
            title="Arrastra para reordenar"
            {...attributes}
            {...listeners}
            className={cn(
              'absolute left-1.5 top-1.5 z-10 touch-none rounded-md p-1 transition-colors',
              'cursor-grab text-muted-foreground/40 hover:bg-muted hover:text-foreground active:cursor-grabbing',
              isDragging && 'cursor-grabbing'
            )}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
