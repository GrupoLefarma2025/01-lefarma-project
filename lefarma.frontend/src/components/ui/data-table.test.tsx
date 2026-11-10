import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable, type ColumnDef } from './data-table';

interface Persona {
  nombre: string;
  puesto: string;
}

const COLUMNS: ColumnDef<Persona, unknown>[] = [
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'puesto', header: 'Puesto' },
  { id: 'acciones', header: 'Acciones', cell: () => <span>Ver</span> },
];

const DATOS: Persona[] = [{ nombre: 'Ana', puesto: 'RH' }];

const bodyRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('tbody tr'));

describe('DataTable', () => {
  it('con `loader` pinta un skeleton por columna visible', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={[]} loader />);

    const rows = bodyRows(container);
    expect(rows).toHaveLength(10);
    rows.forEach((row) => expect(row.querySelectorAll('td')).toHaveLength(COLUMNS.length));
    expect(screen.queryByText('Sin resultados.')).toBeNull();
  });

  it('sin `loader` se comporta normal: pinta las filas de datos', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={DATOS} />);

    expect(bodyRows(container)).toHaveLength(1);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('sin `loader` y sin datos muestra el estado vacío', () => {
    render(<DataTable columns={COLUMNS} data={[]} />);

    expect(screen.getByText('Sin resultados.')).toBeInTheDocument();
  });

  it('sigue aceptando `loading` por compatibilidad', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={[]} loading />);

    expect(bodyRows(container)).toHaveLength(10);
  });
});
