import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MisViajesPage } from './MisViajesPage';
import type { Solicitud } from '../../types/solicitud.types';

const mocks = vi.hoisted(() => ({ mis: vi.fn(), detalle: vi.fn(), eliminar: vi.fn(), navigate: vi.fn() }));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: {
    misSolicitudes: mocks.mis,
    detalle: mocks.detalle,
    eliminar: mocks.eliminar,
    crear: vi.fn(),
    actualizar: vi.fn(),
    enviar: vi.fn(),
    guardarOpciones: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: number; nombre: string } | null }) => unknown) =>
    selector({ user: { id: 7, nombre: 'Persona Actual' } }),
}));

const solicitud = (id: number, extra: Record<string, unknown>): Solicitud => ({
  id_solicitud: id,
  id_usuario_solicitante: 7,
  periodo: '2026-11',
  gerencia: '',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T12:00:00',
  fecha_modificacion: '2026-11-05T12:00:00',
  datos: {},
  opciones: [],
  eventos: [],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detalle.mockResolvedValue({ data: { success: true, data: null } });
  mocks.eliminar.mockResolvedValue({ data: { success: true } });
});

describe('MisViajesPage', () => {
  it('muestra cada solicitud una vez con su distintivo de relación', async () => {
    mocks.mis.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(1, { datos: { version: 'solicitud-v2', persona: { modo: 'mia', nombre: 'Persona Actual' }, destinos: [{ punto: { nombre: 'Destino Uno' } }] } }),
          solicitud(2, { id_usuario_solicitante: 7, datos: { version: 'solicitud-v2', persona: { modo: 'otra', empleadoId: 9, nombre: 'Otra Persona' } } }),
          solicitud(3, { id_usuario_solicitante: 11, datos: { version: 'solicitud-v2', persona: { modo: 'otra', empleadoId: 7, nombre: 'Persona Actual' } } }),
          solicitud(4, { id_usuario_solicitante: 11, datos: { version: 'solicitud-v2', persona: { modo: 'mia', nombre: 'Alguien' }, transporte: { acompanantes: [{ directorioId: 7, nombreCompleto: 'Persona Actual' }] } } }),
        ],
      },
    });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getAllByTestId(/viaje-/)).toHaveLength(4));
    expect(screen.getByText('Solicitada por mí para mí')).toBeInTheDocument();
    expect(screen.getByText('Creada por mí para otra persona')).toBeInTheDocument();
    expect(screen.getByText('Solicitada para mí por otra persona')).toBeInTheDocument();
    expect(screen.getByText(/Compartida conmigo/)).toBeInTheDocument();
  });

  it('los filtros de periodo muestran el rango visible y filtran por fecha de creación', async () => {
    const usuario = userEvent.setup();
    mocks.mis.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(1, { fecha_creacion: '2026-11-05T12:00:00', datos: {} }),
          solicitud(2, { fecha_creacion: '2026-09-01T12:00:00', datos: {} }),
        ],
      },
    });
    render(<MisViajesPage hoy={new Date(2026, 10, 15)} />);
    await waitFor(() => expect(screen.getAllByTestId(/viaje-/)).toHaveLength(2));
    // Sin filtro no se muestra la leyenda; al elegir periodo aparece el rango.
    expect(screen.queryByTestId('rango-visible')).not.toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText('Periodo'), 'mes');
    expect(screen.getByTestId('rango-visible')).toHaveTextContent(/fecha de creación.*2026-11-01 al 2026-11-30/);
    // Con referencia noviembre 2026 solo queda la de noviembre.
    await waitFor(() => expect(screen.getAllByTestId(/viaje-/)).toHaveLength(1));
  });

  it('la tabla ordena del más reciente al más antiguo y muestra folio, solicitante y puntos', async () => {
    mocks.mis.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(1, { fecha_creacion: '2026-11-01T10:00:00', num_puntos: 2, folio: 'VIA-AAA-0001', persona_solicitante: 'Ana Creadora', persona_viajera: 'Ana Creadora' }),
          solicitud(2, { fecha_creacion: '2026-11-09T10:00:00', num_puntos: 3, folio: 'VIA-BBB-0002', persona_solicitante: 'Beto Creador', persona_viajera: 'Beto Creador' }),
        ],
      },
    });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getAllByTestId(/^viaje-/)).toHaveLength(2));
    const filas = screen.getAllByTestId(/^viaje-/);
    expect(within(filas[0]).getByText('VIA-BBB-0002')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Beto Creador')).toBeInTheDocument();
    expect(within(filas[0]).getByText('3')).toBeInTheDocument();
    expect(within(filas[1]).getByText('VIA-AAA-0001')).toBeInTheDocument();
    expect(within(filas[1]).getByText('Ana Creadora')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Enviada')).toBeInTheDocument();
  });

  it('si el solicitante y el viajero son distintos, muestra ambos', async () => {
    mocks.mis.mockResolvedValue({
      data: {
        success: true,
        data: [solicitud(1, { folio: 'VIA-XYZ-0001', persona_solicitante: 'Ana Solicitante', persona_viajera: 'Luis Viajero' })],
      },
    });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-1')).toBeInTheDocument());
    const fila = screen.getByTestId('viaje-1');
    expect(fila).toHaveTextContent('Creador: Ana Solicitante');
    expect(fila).toHaveTextContent('Viajero: Luis Viajero');
  });

  it('un borrador muestra editar, eliminar y enviar a concentrado; uno enviado no', async () => {
    const usuario = userEvent.setup();
    mocks.mis.mockResolvedValue({
      data: {
        success: true,
        data: [
          solicitud(1, { estado: 'borrador', folio: 'VIA-XYZ-0001' }),
          solicitud(2, { estado: 'enviada', folio: 'VIA-XYZ-0002' }),
        ],
      },
    });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getAllByTestId(/^viaje-/)).toHaveLength(2));
    const borrador = screen.getByTestId('viaje-1');
    // El envío queda visible en la fila; editar y eliminar viven en el menú de tres puntos.
    expect(within(borrador).getByRole('button', { name: /Enviar a concentrado/ })).toBeInTheDocument();
    expect(within(borrador).queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    await usuario.click(within(borrador).getByRole('button', { name: /Más acciones/ }));
    const editar = await screen.findByRole('menuitem', { name: /Editar/ });
    expect(screen.getByRole('menuitem', { name: /Eliminar/ })).toBeInTheDocument();
    const enviada = screen.getByTestId('viaje-2');
    expect(within(enviada).queryByRole('button', { name: /Enviar a concentrado/ })).not.toBeInTheDocument();
    await usuario.click(editar);
    expect(mocks.navigate).toHaveBeenCalledWith('/viaticos/solicitud/1');
  });

  it('el detalle muestra itinerario, participantes y desglose sin duplicar', async () => {
    const usuario = userEvent.setup();
    mocks.mis.mockResolvedValue({ data: { success: true, data: [solicitud(1, { datos: { version: 'solicitud-v2' } })] } });
    mocks.detalle.mockResolvedValue({
      data: {
        success: true,
        data: solicitud(1, {
          datos: {
            version: 'solicitud-v2',
            persona: { modo: 'mia', nombre: 'Persona Actual', motivo: 'Ejemplo' },
            transporte: { modo: 'solicitado', compartir: true, acompanantes: [{ directorioId: 9, nombreCompleto: 'Ana Acompañante' }] },
            destinos: [{ etiqueta: 'Destino Uno', punto: { nombre: 'Punto', latitud: 19.5, longitud: -99.5 }, debeEstarFecha: '2026-11-10' }],
          },
          opciones: [
            { id_opcion: 1, tipo: 'avion', linea: 'Vuelo X', precio: 2000, moneda: 'MXN', url_compra: 'https://x', fuente: 'x', fue_elegida: true, ruta_captura: null },
            { id_opcion: 2, tipo: 'avion', linea: 'Vuelo Y', precio: 3000, moneda: 'MXN', url_compra: 'https://y', fuente: 'y', fue_elegida: false, ruta_captura: null },
          ],
        }),
      },
    });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-1')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('viaje-1')).getByRole('button', { name: /Más acciones/ }));
    await usuario.click(await screen.findByRole('menuitem', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Destino Uno'));
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Ejemplo');
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Compartido con Ana Acompañante');
    // La elegida suma; la descartada se muestra pero no suma.
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Vuelo Y');
    expect(screen.queryAllByTestId('viaje-1')).toHaveLength(1);
  });

  it('el detalle separa la ruta calculada (la que manda) de la propuesta del wizard', async () => {
    const usuario = userEvent.setup();
    const datos = {
      version: 'solicitud-v2',
      persona: { modo: 'mia', nombre: 'Persona Actual', motivo: 'Ejemplo' },
      transporte: { modo: 'propio', compartir: false, acompanantes: [] },
      origen: { punto: { nombre: 'Ciudad de México', latitud: 19.43, longitud: -99.15 } },
      destinos: [
        { punto: { nombre: 'Aguascalientes', latitud: 21.88, longitud: -102.29 }, debeEstarFecha: '2026-11-10', debeEstarHora: '13:11' },
      ],
      retorno: { destino: 'origen', punto: null },
      rango: { inicio: '2026-11-10', fin: '2026-11-10' },
      calculo: {
        generado_en: '2026-11-05T12:00:00.000Z',
        margen: 0.1,
        modo_transporte: 'propio',
        km_total: 489.3,
        horas_total: '6h 44m',
        tramos: [
          {
            de: 'Ciudad de México',
            a: 'Aguascalientes',
            km: 489.3,
            duracion: '6h 07m',
            duracion_con_margen: '6h 44m',
            salida_fecha: '2026-11-10',
            salida_hora: '06:27',
            llegada_fecha: '2026-11-10',
            llegada_hora: '12:41',
            alcanza: true,
            casetas: [{ nombre: 'Tultepec', km: 46.3, direccion: 'C. Mexiquense · EMex s/n', costo: 59 }],
          },
        ],
      },
    };
    mocks.mis.mockResolvedValue({ data: { success: true, data: [solicitud(1, { datos })] } });
    mocks.detalle.mockResolvedValue({ data: { success: true, data: solicitud(1, { datos }) } });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-1')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('viaje-1')).getByRole('button', { name: /Más acciones/ }));
    await usuario.click(await screen.findByRole('menuitem', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('detalle-viaje')).toBeInTheDocument());
    // La ruta calculada es la pestaña activa: es la que manda tras el envío.
    expect(screen.getByRole('tab', { name: 'Ruta calculada' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ruta propuesta' })).toBeInTheDocument();
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Tultepec');
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('489.3 km');
    // La propuesta original sigue disponible en su pestaña.
    await usuario.click(screen.getByRole('tab', { name: 'Ruta propuesta' }));
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Propuesta original del wizard');
  });
});
