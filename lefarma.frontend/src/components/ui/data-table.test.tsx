import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('DataTable · filtro por valores (estilo Excel)', () => {
  interface Modulo {
    modulo: string;
    namespace: string;
  }

  const COLUMNAS_MODULO: ColumnDef<Modulo, unknown>[] = [
    { accessorKey: 'modulo', header: 'Módulo' },
    { accessorKey: 'namespace', header: 'Namespace' },
  ];

  const DATOS_MODULO: Modulo[] = [
    { modulo: 'global', namespace: 'uno' },
    { modulo: 'global', namespace: 'dos' },
    { modulo: 'configuracion', namespace: 'tres' },
  ];

  it('lista los valores repetidos una sola vez y filtra al elegirlos', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        columns={COLUMNAS_MODULO}
        data={DATOS_MODULO}
        filterConfig={{ tableId: 'prueba-valores', searchableColumns: ['modulo'] }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Filtrar Módulo' }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    await user.click(screen.getByRole('checkbox', { name: 'configuracion' }));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(bodyRows(container)).toHaveLength(1);
    expect(screen.getByText('tres')).toBeInTheDocument();
    expect(screen.queryByText('uno')).toBeNull();
  });

  it('Cancelar cierra el embudo sin aplicar los valores marcados', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        columns={COLUMNAS_MODULO}
        data={DATOS_MODULO}
        filterConfig={{ tableId: 'prueba-cancelar', searchableColumns: ['modulo'] }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Filtrar Módulo' }));
    await user.click(screen.getByRole('checkbox', { name: 'configuracion' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(bodyRows(container)).toHaveLength(3);
    expect(screen.getByText('uno')).toBeInTheDocument();
  });

  it('filtra por texto en una columna sin `filterFn` propio (regresión «heredado is not a function»)', async () => {
    interface Variable {
      namespace: string;
      valor: string;
    }

    const COLUMNAS_VARIABLE: ColumnDef<Variable, unknown>[] = [
      { accessorKey: 'namespace', header: 'Namespace' },
      { accessorKey: 'valor', header: 'Valor' },
    ];

    const DATOS_VARIABLE: Variable[] = [
      { namespace: 'uno', valor: '4' },
      { namespace: 'dos', valor: '42' },
      { namespace: 'tres', valor: 'texto' },
    ];

    const user = userEvent.setup();
    const { container } = render(
      <DataTable
        columns={COLUMNAS_VARIABLE}
        data={DATOS_VARIABLE}
        filterConfig={{ tableId: 'prueba-texto', searchableColumns: ['valor'] }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Filtrar Valor' }));
    await user.click(screen.getByRole('button', { name: 'Texto' }));
    await user.type(screen.getByPlaceholderText('Ingrese valor...'), '4');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(bodyRows(container)).toHaveLength(2);
    expect(screen.getByText('uno')).toBeInTheDocument();
    expect(screen.getByText('dos')).toBeInTheDocument();
    expect(screen.queryByText('tres')).toBeNull();
  });
});
