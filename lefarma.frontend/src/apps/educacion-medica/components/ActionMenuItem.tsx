import type { ElementType } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

/** Item del dropdown de acciones por fila (patrón RH). */
export function ActionMenuItem({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  icon: ElementType;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      className={`gap-2 text-sm ${destructive ? 'text-destructive focus:text-destructive' : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </DropdownMenuItem>
  );
}
