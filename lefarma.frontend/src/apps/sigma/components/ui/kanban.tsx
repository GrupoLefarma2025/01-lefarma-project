'use client';

import * as React from 'react';
import type {
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface Column {
  id: string;
  name: string;
  color?: string;
}

export interface KanbanItem {
  id: string;
  column: string;
}

interface KanbanContextValue<T extends KanbanItem = KanbanItem> {
  columns: Column[];
  data: T[];
  activeId: UniqueIdentifier | null;
  activeColumn: string | null;
  setActiveId: (id: UniqueIdentifier | null) => void;
  setActiveColumn: (column: string | null) => void;
  onDataChange?: (data: T[]) => void;
}

const KanbanContext = React.createContext<KanbanContextValue<KanbanItem> | null>(
  null
);

function useKanban<T extends KanbanItem = KanbanItem>() {
  const context = React.useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanban must be used within KanbanProvider');
  }
  return context as unknown as KanbanContextValue<T>;
}

interface KanbanProviderProps<T extends KanbanItem = KanbanItem> {
  columns: Column[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  children: (column: Column) => React.ReactNode;
}

export function KanbanProvider<T extends KanbanItem>({
  columns,
  data,
  onDataChange,
  children,
}: KanbanProviderProps<T>) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const [activeColumn, setActiveColumn] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    })
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    const item = data.find((d) => d.id === active.id);
    if (item) {
      setActiveColumn(item.column);
    }
  }, [data]);

  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeItem = data.find((d) => d.id === activeId);
    const overItem = data.find((d) => d.id === overId);

    if (!activeItem) return;

    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn) {
      if (activeItem.column !== overColumn.id) {
        const newData = data.map((item) =>
          item.id === activeId ? { ...item, column: overColumn.id } : item
        );
        onDataChange?.(newData);
      }
      return;
    }

    if (overItem && activeItem.column !== overItem.column) {
      const newData = data.map((item) =>
        item.id === activeId ? { ...item, column: overItem.column } : item
      );
      onDataChange?.(newData);
    }
  }, [data, columns, onDataChange]);

  const handleDragEnd = React.useCallback(() => {
    setActiveId(null);
    setActiveColumn(null);
  }, []);

  const contextValue: KanbanContextValue<T> = {
    columns,
    data,
    activeId,
    activeColumn,
    setActiveId,
    setActiveColumn,
    onDataChange,
  };

  return (
    <KanbanContext.Provider
      value={contextValue as unknown as KanbanContextValue<KanbanItem>}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => children(column))}
        </div>
        <DragOverlay>
          {activeId ? (
            <div className="opacity-50">
              {}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  );
}

interface KanbanBoardProps {
  id: string;
  children: React.ReactNode;
}

export function KanbanBoard({ id, children }: KanbanBoardProps) {
  const { setNodeRef } = useSortable({
    id,
    data: {
      type: 'column',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex min-w-[300px] flex-1 flex-col gap-2 rounded-lg border bg-muted/20 p-4"
    >
      {children}
    </div>
  );
}

interface KanbanHeaderProps {
  children: React.ReactNode;
}

export function KanbanHeader({ children }: KanbanHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="font-semibold text-sm">{children}</div>
    </div>
  );
}

interface KanbanCardsProps<T extends KanbanItem = KanbanItem> {
  id: string;
  children: (item: T) => React.ReactNode;
}

export function KanbanCards<T extends KanbanItem>({
  id,
  children,
}: KanbanCardsProps<T>) {
  const { data } = useKanban<T>();
  const columnData = data.filter((item) => item.column === id);
  const columnIds = columnData.map((item) => item.id);

  return (
    <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-2">
        {columnData.map((item: T) => children(item))}
      </div>
    </SortableContext>
  );
}

interface KanbanCardProps {
  id: string;
  column: string;
  name: string;
  children: React.ReactNode;
}

export function KanbanCard({ id, column, children }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'card',
      column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'cursor-grabbing'
      )}
    >
      {children}
    </div>
  );
}
