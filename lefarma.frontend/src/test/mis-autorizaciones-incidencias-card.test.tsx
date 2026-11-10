import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MisAutorizacionesIncidenciasBadge } from '@/apps/rh/components/MisAutorizacionesIncidenciasBadge';
import { periodoLabel } from '@/apps/rh/utils/periodos';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/shared/api/apiClient', () => ({
  API: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  default: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const hoy = new Date();
const PERIODO_ACTUAL = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
const fechaAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
const PERIODO_ANTERIOR = { anio: fechaAnterior.getFullYear(), mes: fechaAnterior.getMonth() + 1 };

function respuestaDelMes(anio: number, mes: number) {
  if (anio === PERIODO_ACTUAL.anio && mes === PERIODO_ACTUAL.mes) {
    return {
      anio,
      mes,
      total: 2,
      porEmpleado: [
        { idUsuario: 11, nombre: 'Ana Subordinada', total: 1 },
        { idUsuario: 12, nombre: 'Beto Subordinado', total: 1 },
      ],
      detalle: [
        {
          idSolicitud: 1,
          folio: 'SOL-INC-1',
          idUsuarioSolicitante: 11,
          empleadoNombre: 'Ana Subordinada',
          tipoSolicitud: 'Retardo menor a 20 minutos',
          motivo: 'Llegó tarde',
          fechaIncidencia: '2026-11-03',
          fechaAutorizacion: '2026-11-09T14:00:06',
          estadoNombre: 'Cerrada',
        },
        {
          idSolicitud: 2,
          folio: 'SOL-INC-2',
          idUsuarioSolicitante: 12,
          empleadoNombre: 'Beto Subordinado',
          tipoSolicitud: 'Salida temprana con reposición',
          motivo: null,
          fechaIncidencia: '2026-11-04',
          fechaAutorizacion: '2026-11-09T15:30:00',
          estadoNombre: 'Cerrada',
        },
      ],
    };
  }

  return { anio, mes, total: 0, porEmpleado: [], detalle: [] };
}

const ETIQUETA_PILL = 'Ver el detalle de las incidencias que he autorizado';

describe('MisAutorizacionesIncidenciasBadge', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockImplementation((url: string, config?: { params?: { anio: number; mes: number } }) => {
      if (url.includes('/autorizaciones-incidencias')) {
        const anio = config?.params?.anio ?? PERIODO_ACTUAL.anio;
        const mes = config?.params?.mes ?? PERIODO_ACTUAL.mes;
        return Promise.resolve({ data: { success: true, data: respuestaDelMes(anio, mes) } });
      }
      if (url.endsWith('/historial')) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.includes('/config/workflows/flow')) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (/\/solicitudes-personal\/\d+$/.test(url)) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              idSolicitud: 1,
              folio: 'SOL-INC-1',
              idEstado: 7,
              estadoNombre: 'Cerrada',
              categoria: '1',
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: null } });
    });
  });

  it('muestra el total del mes y abre el detalle con desglose', async () => {
    const user = userEvent.setup();
    render(<MisAutorizacionesIncidenciasBadge />);

    const pill = await screen.findByLabelText(ETIQUETA_PILL);
    expect(pill).toHaveTextContent('2 incidencias autorizadas este mes');

    await user.click(pill);

    expect(await screen.findByText('Desglose por empleado')).toBeInTheDocument();
    // Cada empleado aparece en el desglose y en el detalle.
    expect(screen.getAllByText('Ana Subordinada')).toHaveLength(2);
    expect(screen.getAllByText('Beto Subordinado')).toHaveLength(2);
    expect(screen.getByText('SOL-INC-1')).toBeInTheDocument();
    expect(screen.getByText('SOL-INC-2')).toBeInTheDocument();
    expect(screen.getByText('Retardo menor a 20 minutos')).toBeInTheDocument();
  });

  it('cambia de mes desde el combo del modal y muestra el estado vacío', async () => {
    const user = userEvent.setup();
    render(<MisAutorizacionesIncidenciasBadge />);

    const pill = await screen.findByLabelText(ETIQUETA_PILL);
    expect(pill).toHaveTextContent('2 incidencias autorizadas este mes');

    await user.click(pill);

    const etiquetaAnterior = periodoLabel(PERIODO_ANTERIOR.anio, PERIODO_ANTERIOR.mes);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: etiquetaAnterior }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/solicitudes-personal/autorizaciones-incidencias',
        expect.objectContaining({
          params: { anio: PERIODO_ANTERIOR.anio, mes: PERIODO_ANTERIOR.mes },
        })
      );
    });

    expect(
      await screen.findByText(`No hay incidencias autorizadas en ${etiquetaAnterior}.`)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(ETIQUETA_PILL)).toHaveTextContent('0');
  });

  it('abre el historial de una solicitud desde el detalle', async () => {
    const user = userEvent.setup();
    render(<MisAutorizacionesIncidenciasBadge />);

    await user.click(await screen.findByLabelText(ETIQUETA_PILL));
    await screen.findByText('Desglose por empleado');

    await user.click(screen.getByLabelText('Ver historial de SOL-INC-1'));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/solicitudes-personal/1');
      expect(getMock).toHaveBeenCalledWith('/solicitudes-personal/1/historial');
    });
  });
});
