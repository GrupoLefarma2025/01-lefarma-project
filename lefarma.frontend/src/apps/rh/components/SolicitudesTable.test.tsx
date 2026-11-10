import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SolicitudesTable } from './SolicitudesTable';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

const getEstadoInfo = () => ({ nombre: 'EN TRÁMITE', color: '#2563eb' });
const noop = vi.fn();

const solicitud: SolicitudPersonalResponse = {
  idSolicitud: 1,
  folio: 'SOL-2026-00001',
  idEmpresa: 1,
  idSucursal: 1,
  idUsuarioCreador: 1,
  idTipoSolicitud: 1,
  categoria: 'Permiso',
  fechaCreacion: '2026-11-09T00:00:00',
  idEstado: 2,
  estadoNombre: 'EN TRÁMITE',
  estadoColor: '#2563eb',
  tipoSolicitudNombre: 'Vacaciones',
  solicitanteNombre: 'Ana Pérez',
  creadorNombre: 'Ana Pérez',
};

function renderTable(props: { data: SolicitudPersonalResponse[]; loader?: boolean }) {
  return render(
    <SolicitudesTable
      data={props.data}
      loader={props.loader}
      getEstadoInfo={getEstadoInfo}
      onDetalle={noop}
      onFirma={noop}
      onArchivos={noop}
      onHistorial={noop}
    />
  );
}

const bodyRows = (container: HTMLElement) => Array.from(container.querySelectorAll('tbody tr'));

describe('SolicitudesTable', () => {
  it('con `loader` muestra el skeleton con todas sus columnas', () => {
    const { container } = renderTable({ data: [], loader: true });

    const rows = bodyRows(container);
    expect(rows).toHaveLength(10);
    // folio, justificación, fecha creación, fechas, solicitante, creado por, estado y acciones
    rows.forEach((row) => expect(row.querySelectorAll('td')).toHaveLength(8));
    expect(screen.queryByText('Sin resultados.')).toBeNull();
  });

  it('sin `loader` funciona normal y pinta los registros', () => {
    const { container } = renderTable({ data: [solicitud] });

    expect(bodyRows(container)).toHaveLength(1);
    expect(screen.getByText('SOL-2026-00001')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
