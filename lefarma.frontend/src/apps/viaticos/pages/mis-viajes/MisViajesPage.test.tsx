import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MisViajesPage, VistaDetalle } from './MisViajesPage';
import type { CalculoViaje, PropuestaRuta, Solicitud, SolicitudOpcion } from '../../types/solicitud.types';

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
vi.mock('../../services/evidencias.api', () => ({
  evidenciasApi: {
    // Promesa pendiente: el detalle no depende de las evidencias en estas pruebas.
    obtener: vi.fn(() => new Promise(() => {})),
    generar: vi.fn(),
    buscar: vi.fn(),
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
    await usuario.click(within(screen.getByTestId('viaje-1')).getByRole('button', { name: /Ver detalle/ }));
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
    // Sin acciones extra la fila muestra el botón completo, no un menú de "...".
    await usuario.click(within(screen.getByTestId('viaje-1')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('detalle-viaje')).toBeInTheDocument());
    // La ruta calculada es la pestaña activa: es la que manda tras el envío.
    expect(screen.getByRole('tab', { name: 'Ruta calculada' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Viaje inicial' })).toBeInTheDocument();
    // La ruta autorizada se habilita cuando el concentrado la modifique.
    expect(screen.getByRole('tab', { name: 'Ruta autorizada' })).toBeDisabled();
    expect(screen.getByTestId('diagrama-ruta-calculada')).toBeInTheDocument();
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Tultepec');
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('489.3 km');
    // La propuesta original sigue disponible en su pestaña.
    await usuario.click(screen.getByRole('tab', { name: 'Viaje inicial' }));
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Ruta del viaje');
    expect(screen.getByTestId('detalle-viaje')).toHaveTextContent('Fechas del viaje');
  });

  it('habilita la ruta autorizada cuando el concentrado ya la guardó', async () => {
    const usuario = userEvent.setup();
    const tramo = (de: string, a: string) => ({
      de,
      a,
      km: 100,
      duracion: '2h',
      duracion_con_margen: '2h 12m',
      salida_fecha: '2026-11-10',
      salida_hora: '07:00',
      llegada_fecha: '2026-11-10',
      llegada_hora: '09:00',
      alcanza: true,
      casetas: [],
    });
    const datos = {
      version: 'solicitud-v2',
      persona: { modo: 'mia', nombre: 'Persona Actual', motivo: 'Ejemplo' },
      transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
      origen: { punto: { nombre: 'Ciudad de México', latitud: 19.43, longitud: -99.15 } },
      destinos: [
        { punto: { nombre: 'Aguascalientes', latitud: 21.88, longitud: -102.29 }, debeEstarFecha: '2026-11-10', debeEstarHora: '13:11' },
      ],
      retorno: { destino: 'origen', punto: null },
      rango: { inicio: '2026-11-10', fin: '2026-11-10' },
      calculo: {
        generado_en: '2026-11-05T12:00:00.000Z',
        margen: 0.1,
        modo_transporte: 'solicitado',
        tramos: [tramo('Ruta del viajero', 'Destino original')],
      },
      calculo_autorizado: {
        generado_en: '2026-11-06T09:00:00.000Z',
        margen: 0.1,
        modo_transporte: 'solicitado',
        tramos: [tramo('Ruta autorizada por el concentrado', 'Destino aprobado')],
      },
    };
    mocks.mis.mockResolvedValue({ data: { success: true, data: [solicitud(1, { datos })] } });
    mocks.detalle.mockResolvedValue({ data: { success: true, data: solicitud(1, { datos }) } });
    render(<MisViajesPage />);
    await waitFor(() => expect(screen.getByTestId('viaje-1')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('viaje-1')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('detalle-viaje')).toBeInTheDocument());

    const tabAutorizada = screen.getByRole('tab', { name: 'Ruta autorizada' });
    expect(tabAutorizada).not.toBeDisabled();
    await usuario.click(tabAutorizada);
    expect(screen.getByTestId('diagrama-ruta-autorizada')).toBeInTheDocument();
    expect(screen.getByTestId('diagrama-ruta-autorizada')).toHaveTextContent('Ruta autorizada por el concentrado');
  });
});

// -------- detalle en revisión (propuesta y comparador) --------

const tramoCalculado = (de: string, a: string) => ({
  de,
  a,
  km: 100,
  duracion: '2h',
  duracion_con_margen: '2h 12m',
  salida_fecha: '2026-11-10',
  salida_hora: '07:00',
  llegada_fecha: '2026-11-10',
  llegada_hora: '09:00',
  alcanza: true,
  casetas: [],
});

const calculoDe = (de: string, a: string): CalculoViaje => ({
  generado_en: '2026-11-05T12:00:00.000Z',
  margen: 0.1,
  modo_transporte: 'solicitado',
  km_total: 200,
  horas_total: '4h 24m',
  tramos: [tramoCalculado(de, a)],
});

const datosRevision = (extra: Record<string, unknown>) => ({
  version: 'solicitud-v2',
  persona: { modo: 'mia', nombre: 'Persona Actual', motivo: 'Ejemplo' },
  transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
  origen: { punto: { nombre: 'Ciudad de México', latitud: 19.43, longitud: -99.15 } },
  destinos: [
    {
      punto: { nombre: 'Aguascalientes', latitud: 21.88, longitud: -102.29 },
      debeEstarFecha: '2026-11-10',
      debeEstarHora: '13:11',
    },
  ],
  retorno: { destino: 'origen', punto: null },
  rango: { inicio: '2026-11-10', fin: '2026-11-10' },
  ...extra,
});

const opcionBase = (extra: Partial<SolicitudOpcion>): SolicitudOpcion => ({
  id_opcion: 1,
  tipo: 'avion',
  linea: 'Vuelo',
  precio: 1000,
  moneda: 'MXN',
  url_compra: null,
  fuente: 'proveedor',
  fue_elegida: true,
  ruta_captura: null,
  datos: { tramo: 1 },
  ...extra,
});

/** Propuesta del revisor: dos tramos, costos en nodos y opciones elegidas. */
const propuestaDeRuta = (): PropuestaRuta => ({
  calculo: {
    generado_en: '2026-11-06T09:00:00.000Z',
    margen: 0.1,
    modo_transporte: 'solicitado',
    km_total: 200,
    horas_total: '4h 24m',
    tramos: [
      tramoCalculado('Ruta propuesta', 'Destino propuesto'),
      tramoCalculado('Destino propuesto', 'Regreso propuesto'),
    ],
    ruta: {
      puntos: [],
      nodos: [
        { titulo: 'Origen', detalles: ['Salida'] },
        { titulo: '1. Destino propuesto', detalles: ['Llegada'], costo: 1600 },
        { titulo: '2. Regreso propuesto', detalles: ['Vuelta'] },
      ],
    },
  },
  opciones: [
    {
      tipo: 'vuelo',
      linea: 'Vuelo Propuesto',
      precio: 1500,
      moneda: 'MXN',
      url_compra: 'https://propuesto',
      fuente: 'proveedor',
      fue_elegida: true,
      ruta_captura: null,
      capturas: [],
      datos: { tramo: 1 },
    },
    {
      tipo: 'hotel',
      linea: 'Hotel Propuesto',
      precio: 800,
      moneda: 'MXN',
      url_compra: null,
      fuente: 'proveedor',
      fue_elegida: true,
      ruta_captura: null,
      capturas: [],
      datos: { tramo: 2 },
    },
    {
      tipo: 'autobus',
      linea: 'Alternativa propuesta',
      precio: 500,
      moneda: 'MXN',
      url_compra: null,
      fuente: 'proveedor',
      fue_elegida: false,
      ruta_captura: null,
      capturas: [],
      datos: { tramo: 1 },
    },
  ],
  resumen: {
    autobus: null,
    avion: 1500,
    gasolina: null,
    casetas: null,
    hospedaje: 800,
    comida: null,
    taxi: null,
    total: 2300,
  },
});

describe('VistaDetalle en revisión', () => {
  it('arranca en la ruta autorizada con la ruta original y permite recalcular', async () => {
    const usuario = userEvent.setup();
    const onRecalcular = vi.fn();
    const datos = datosRevision({
      calculo: calculoDe('Ruta original del viajero', 'Destino original'),
    });

    render(
      <VistaDetalle
        solicitud={solicitud(1, { datos, estado: 'enviada' })}
        modoRevision
        pestanaInicial="autorizada"
        onRecalcular={onRecalcular}
      />,
    );

    const tab = screen.getByRole('tab', { name: 'Ruta autorizada' });
    expect(tab).not.toBeDisabled();
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const diagrama = screen.getByTestId('diagrama-ruta-autorizada');
    expect(diagrama).toHaveTextContent('Destino original');
    // Sin recálculo no hay propuesta: es la ruta original del viajero.
    expect(screen.queryByTestId('badge-propuesta')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Recalcular ruta' }));
    expect(onRecalcular).toHaveBeenCalledTimes(1);
  });

  it('muestra la propuesta sin autorizar con su badge, nodos con costo y enlace', () => {
    const datos = datosRevision({
      calculo: calculoDe('Ruta original del viajero', 'Destino original'),
    });
    const originales = [
      opcionBase({ id_opcion: 11, linea: 'Vuelo Original', precio: 1000, datos: { tramo: 1 } }),
      opcionBase({
        id_opcion: 12,
        linea: 'Vuelo Descartado',
        precio: 900,
        fue_elegida: false,
        datos: { tramo: 1 },
      }),
    ];

    render(
      <VistaDetalle
        solicitud={solicitud(1, { datos, estado: 'enviada', opciones: originales })}
        modoRevision
        pestanaInicial="autorizada"
        propuesta={propuestaDeRuta()}
      />,
    );

    expect(screen.getByTestId('badge-propuesta')).toHaveTextContent('Propuesta en revisión');
    const diagrama = screen.getByTestId('diagrama-ruta-autorizada');
    expect(diagrama).toHaveTextContent('Destino propuesto');
    expect(diagrama).not.toHaveTextContent('Destino original');
    // Costo guardado en el nodo y, cuando falta, el de la opción elegida del tramo.
    expect(within(diagrama).getByText(/1,600\.00/)).toBeInTheDocument();
    expect(within(diagrama).getByText(/800\.00/)).toBeInTheDocument();
    expect(within(diagrama).getByRole('link', { name: /Ir a compra/ })).toHaveAttribute(
      'href',
      'https://propuesto',
    );
    // La lista de opciones usa la versión mostrada, no las opciones guardadas.
    const opciones = screen.getByTestId('opciones-ruta-autorizada');
    expect(within(opciones).getByText('Vuelo Propuesto')).toBeInTheDocument();
    expect(within(opciones).queryByText('Vuelo Original')).not.toBeInTheDocument();
  });

  it('compara la cotización original contra la propuesta y abre las opciones descartadas', async () => {
    const usuario = userEvent.setup();
    const datos = datosRevision({
      calculo: calculoDe('Ruta original del viajero', 'Destino original'),
    });
    const originales = [
      opcionBase({ id_opcion: 11, linea: 'Vuelo Original', precio: 1000, datos: { tramo: 1 } }),
      opcionBase({
        id_opcion: 12,
        linea: 'Vuelo Descartado',
        precio: 900,
        fue_elegida: false,
        datos: { tramo: 1 },
      }),
    ];

    render(
      <VistaDetalle
        solicitud={solicitud(1, { datos, estado: 'enviada', opciones: originales })}
        modoRevision
        pestanaInicial="autorizada"
        propuesta={propuestaDeRuta()}
      />,
    );

    const comparador = screen.getByTestId('comparador-rutas');
    expect(within(comparador).getByText('Subió')).toBeInTheDocument();
    expect(within(comparador).getByText('Nueva')).toBeInTheDocument();
    expect(screen.getByTestId('comparador-total-original')).toHaveTextContent('$1,000.00');
    expect(screen.getByTestId('comparador-total-propuesto')).toHaveTextContent('$2,300.00');
    expect(screen.getByTestId('comparador-total-diferencia')).toHaveTextContent('+$1,300.00');

    const boton = within(comparador).getByRole('button', {
      name: /Ver opciones descartadas del viajero/,
    });
    expect(boton).toBeEnabled();
    await usuario.click(boton);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Vuelo Descartado')).toBeInTheDocument();
  });

  it('después de autorizar compara el snapshot original contra las opciones vigentes', () => {
    const datos = datosRevision({
      calculo: calculoDe('Ruta original', 'Destino original'),
      calculo_autorizado: calculoDe('Ruta autorizada', 'Destino autorizado'),
      opciones_originales: [
        {
          id_opcion: 11,
          tipo: 'avion',
          linea: 'Vuelo Original',
          precio: 1000,
          moneda: 'MXN',
          url_compra: null,
          fuente: 'proveedor',
          fue_elegida: true,
          ruta_captura: null,
          datos: { tramo: 1 },
        },
      ],
    });

    render(
      <VistaDetalle
        solicitud={solicitud(1, {
          datos,
          estado: 'autorizada',
          opciones: [opcionBase({ id_opcion: 11, linea: 'Vuelo Original', precio: 1200 })],
        })}
        pestanaInicial="autorizada"
      />,
    );

    expect(screen.getByTestId('diagrama-ruta-autorizada')).toHaveTextContent('Destino autorizado');
    expect(screen.getByTestId('comparador-rutas')).toBeInTheDocument();
    expect(screen.getByTestId('comparador-total-original')).toHaveTextContent('$1,000.00');
    expect(screen.getByTestId('comparador-total-propuesto')).toHaveTextContent('$1,200.00');
    expect(screen.getByTestId('comparador-total-diferencia')).toHaveTextContent('+$200.00');
  });
});
