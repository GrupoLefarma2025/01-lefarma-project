import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConcentradoPage } from './ConcentradoPage';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';

const flags = vi.hoisted(() => ({ verTodos: true, autorizar: true }));
const mocks = vi.hoisted(() => ({ bandeja: vi.fn(), detalle: vi.fn(), autorizar: vi.fn(), rechazar: vi.fn() }));
vi.mock('../../services/aprobaciones.api', () => ({
  aprobacionesApi: { bandeja: mocks.bandeja, autorizar: mocks.autorizar, rechazar: mocks.rechazar, registrarAjuste: vi.fn() },
}));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: { detalle: mocks.detalle, crear: vi.fn(), guardarOpciones: vi.fn(), misSolicitudes: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: ({ require }: { require?: string }) => {
    if (require === 'viaticos.ver_todos') return flags.verTodos;
    if (require === 'viaticos.autorizar') return flags.autorizar;
    return false;
  },
}));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

/** Fecha local en ISO (aaaa-mm-dd); `toISOString` es UTC y correría el día. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ahora = new Date();
const HOY = isoLocal(ahora);
const AYER = isoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1));
const EN_DIEZ_DIAS = isoLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 10));

const fila: SolicitudBandeja = {
  id_solicitud: 5,
  folio: 'VIA-TEST-0005',
  id_usuario_solicitante: 9,
  nombre_solicitante: 'Persona Solicitante',
  periodo: '2026-11',
  gerencia: '',
  destino: 'Destino Uno',
  // Al concentrado llega lo que ya autorizó la pantalla de Autorizaciones.
  estado: 'autorizada',
  total: 2000,
  // El concentrado revisa las que ya pasaron por los cálculos.
  recalculada: true,
  // El filtro de fecha por defecto es «Todas»: la fila se ve sin tocar nada.
  fecha_creacion: `${HOY}T10:00:00`,
};

const detalleOk = {
  data: {
    success: true,
    data: {
      id_solicitud: 5,
      id_usuario_solicitante: 9,
      periodo: '2026-11',
      gerencia: '',
      estado: 'autorizada',
      activo: true,
      fecha_creacion: '2026-11-04T10:00:00',
      fecha_modificacion: '2026-11-04T11:00:00',
      datos: {
        version: 'solicitud-v2',
        persona: { modo: 'mia', nombre: 'Persona Solicitante', motivo: 'Visita' },
        transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
        destinos: [
          {
            etiqueta: 'Destino Uno',
            punto: { nombre: 'Destino Uno', latitud: 19.5, longitud: -99.5 },
            debeEstarFecha: '2026-11-10',
            debeEstarHora: '10:00',
          },
        ],
        // La revisión del concentrado trabaja sobre la ruta calculada: sin ella
        // el detalle cae al modo legado y no hay pestaña que revisar.
        calculo: {
          generado_en: '2026-11-04T10:00:00Z',
          margen: 0.1,
          modo_transporte: 'solicitado',
          km_total: 120,
          horas_total: '2h',
          tramos: [
            {
              de: 'Ciudad de México',
              a: 'Destino Uno',
              km: 120,
              duracion: '2h',
              duracion_con_margen: '2h 12m',
              salida_fecha: '2026-11-10',
              salida_hora: '08:00',
              llegada_fecha: '2026-11-10',
              llegada_hora: '10:12',
              alcanza: true,
              casetas: [],
            },
          ],
        },
      },
      opciones: [
        { id_opcion: 1, tipo: 'avion', linea: 'Vuelo Elegido', precio: 2000, moneda: 'MXN', url_compra: 'https://x', fuente: 'x', fue_elegida: true, ruta_captura: null },
        { id_opcion: 2, tipo: 'avion', linea: 'Vuelo Alterno', precio: 3500, moneda: 'MXN', url_compra: 'https://y', fuente: 'y', fue_elegida: false, ruta_captura: null },
      ],
      eventos: [],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  flags.verTodos = true;
  flags.autorizar = true;
  mocks.bandeja.mockResolvedValue({ data: { success: true, data: [fila] } });
  mocks.detalle.mockResolvedValue(detalleOk);
  mocks.autorizar.mockResolvedValue({ data: { success: true, message: 'Autorizada', data: {} } });
});

describe('ConcentradoPage', () => {
  it('no repite el título de la página y deja los filtros plegados a la vista', async () => {
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // El nombre de la página vive en la barra superior y en la pestaña del navegador.
    expect(screen.queryByRole('heading', { name: /^concentrado de viáticos$/i })).toBeNull();

    // Los filtros se pliegan, pero el encabezado deja claro que están ahí.
    const resumen = screen.getByText('Filtros', { selector: 'summary' });
    expect(resumen).toBeInTheDocument();
    expect(resumen.parentElement).not.toHaveAttribute('open');
  });

  it('muestra la opción elegida Y las alternativas originales con sus precios', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());
    const revision = screen.getByTestId('revision-solicitud');
    // El detalle arranca en la ruta que se va a autorizar y conserva el desglose.
    expect(revision).toHaveTextContent('Ruta autorizada');
    expect(revision).toHaveTextContent('Vuelo Elegido');
    expect(revision).toHaveTextContent(/3,500/);
    expect(revision).toHaveTextContent('Desglose');
    expect(revision).toHaveTextContent(/2,000/);
  });

  it('abre el detalle en modo consulta, sin autorizar ni rechazar desde el concentrado', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    await usuario.click(within(screen.getByTestId('concentrado-5')).getByRole('button', { name: /Ver detalle/ }));
    await waitFor(() => expect(screen.getByTestId('revision-solicitud')).toBeInTheDocument());

    // Autorizar y rechazar viven en Autorizaciones: aquí solo se consulta.
    const revision = screen.getByTestId('revision-solicitud');
    expect(within(revision).queryByRole('button', { name: /autorizar/i })).not.toBeInTheDocument();
    expect(within(revision).queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
    expect(within(revision).queryByRole('button', { name: /recalcular ruta/i })).not.toBeInTheDocument();
    expect(within(revision).getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
    // El detalle sigue entrando por la ruta que quedó autorizada.
    expect(screen.getByRole('tab', { name: 'Ruta autorizada' })).toHaveAttribute('aria-selected', 'true');
  });

  it('entra mostrando las autorizadas listas para concentrar; las enviadas aparecen al cambiar el activo', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...fila, id_solicitud: 5, folio: 'VIA-AUT-0005', estado: 'autorizada' },
          { ...fila, id_solicitud: 6, folio: 'VIA-ENV-0006', estado: 'enviada' },
        ],
      },
    });
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());
    // La cola de autorización todavía no llega al concentrado.
    expect(screen.queryByTestId('concentrado-6')).not.toBeInTheDocument();

    // Sin recorte por fecha: el periodo por defecto es "Todas".
    expect(screen.getByLabelText(/periodo/i)).toHaveValue('todas');
    expect(screen.queryByTestId('rango-visible')).not.toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/activo/i), 'todas');
    expect(screen.getByTestId('concentrado-6')).toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText(/activo/i), 'enviada');
    expect(screen.getByTestId('concentrado-6')).toBeInTheDocument();
    expect(screen.queryByTestId('concentrado-5')).not.toBeInTheDocument();
  });

  it('por fecha de viaje incluye el viaje en curso y descarta el que no toca el rango', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...fila, id_solicitud: 7, fecha_salida: AYER, fecha_regreso: EN_DIEZ_DIAS },
          { ...fila, id_solicitud: 8, fecha_salida: EN_DIEZ_DIAS, fecha_regreso: EN_DIEZ_DIAS },
        ],
      },
    });
    render(<ConcentradoPage />);

    // Con "Todas" no hay recorte: aparecen las dos.
    await waitFor(() => expect(screen.getByTestId('concentrado-7')).toBeInTheDocument());
    expect(screen.getByTestId('concentrado-8')).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/periodo/i), 'hoy');
    await usuario.selectOptions(screen.getByLabelText(/buscar por/i), 'viaje');

    // El viaje del 7 está en curso hoy; el del 8 empieza en diez días.
    expect(screen.getByTestId('concentrado-7')).toBeInTheDocument();
    expect(screen.queryByTestId('concentrado-8')).not.toBeInTheDocument();
  });

  it('muestra el folio en lugar del id y genera el documento FOR-008 con las filas seleccionadas', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: { success: true, data: [{ ...fila, estado: 'autorizada' }] },
    });
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // La identidad que usa la persona es el folio, no el id interno.
    expect(within(screen.getByTestId('concentrado-5')).getByText('VIA-TEST-0005')).toBeInTheDocument();

    await usuario.click(screen.getByRole('checkbox', { name: /incluir VIA-TEST-0005 en el concentrado/i }));
    const generar = screen.getByRole('button', { name: /generar concentrado \(1\)/i });
    expect(generar).toBeEnabled();
    await usuario.click(generar);

    expect(screen.getByTestId('documento-toolbar')).toBeInTheDocument();
    const documento = document.querySelector('#concentrado-viaticos-print');
    expect(documento).not.toBeNull();
    expect(documento).toHaveTextContent('Concentrado de Viáticos');
    expect(documento).toHaveTextContent('Destino Uno');
    expect(documento).toHaveTextContent('Persona Solicitante');
  });

  it('permite marcar una solicitud autorizada y el documento la imprime', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // Al concentrado llega lo ya autorizado: se puede marcar sin más pasos.
    const casilla = screen.getByRole('checkbox', { name: /incluir VIA-TEST-0005 en el concentrado/i });
    expect(casilla).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /generar concentrado \(0\)/i })).toBeDisabled();
    expect(screen.getByTestId('concentrado-vacio')).toHaveTextContent(/selecciona solicitudes/i);

    await usuario.click(casilla);
    expect(screen.getByRole('button', { name: /generar concentrado \(1\)/i })).toBeEnabled();
    // El documento ya no lleva aviso de revisión: se imprime lo marcado a secas.
    expect(screen.queryByText(/documento de revisión/i)).toBeNull();

    await usuario.click(screen.getByRole('button', { name: /generar concentrado \(1\)/i }));
    const documento = document.querySelector('#concentrado-viaticos-print');
    expect(documento).not.toBeNull();
    // Se imprime lo marcado: ya no se filtra por estado al armar el FOR-008.
    expect(documento).toHaveTextContent('Destino Uno');
    expect(documento).toHaveTextContent('Persona Solicitante');
  });

  it('el botón Vista previa manda directo al diálogo de impresión', async () => {
    const usuario = userEvent.setup();
    // jsdom no implementa la impresión ni el decode de imágenes del portal.
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      writable: true,
      value: () => Promise.resolve(),
    });

    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    await usuario.click(screen.getByRole('checkbox', { name: /incluir VIA-TEST-0005 en el concentrado/i }));
    await usuario.click(screen.getByRole('button', { name: /^vista previa$/i }));

    await waitFor(() => expect(imprimir).toHaveBeenCalled());
    // El visor queda detrás como vista previa en pantalla.
    expect(document.querySelector('#concentrado-viaticos-print')).not.toBeNull();

    imprimir.mockRestore();
    delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
  });

  it('el rango personalizado se aplica solo cuando hay fecha inicial y final', async () => {
    const usuario = userEvent.setup();
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    await usuario.selectOptions(screen.getByLabelText(/periodo/i), 'personalizado');
    expect(screen.getByText(/elige la fecha inicial y la final/i)).toBeInTheDocument();
    // Sin ambas fechas no se recorta nada.
    expect(screen.getByTestId('concentrado-5')).toBeInTheDocument();

    // Los inputs date se llenan con change, no tecleando: jsdom no simula sus
    // segmentos de edición.
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: HOY } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: HOY } });
    expect(screen.getByTestId('rango-visible')).toHaveTextContent('al');
    expect(screen.getByTestId('concentrado-5')).toBeInTheDocument();
  });

  it('agrupa por gerencia y parte el FOR-008 en bloques con subtotal', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...fila, id_solicitud: 11, folio: 'VIA-A', gerencia: 'IMSS', nombre_solicitante: 'Ana IMSS', estado: 'autorizada' },
          { ...fila, id_solicitud: 12, folio: 'VIA-B', gerencia: 'Descentralizado', nombre_solicitante: 'Beto Desc', estado: 'autorizada' },
          { ...fila, id_solicitud: 13, folio: 'VIA-C', gerencia: 'IMSS', nombre_solicitante: 'Carla IMSS', estado: 'autorizada' },
        ],
      },
    });
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-11')).toBeInTheDocument());

    expect(screen.getByLabelText(/agrupar por/i)).toHaveValue('gerencia');
    const resumen = screen.getByTestId('grupos-concentrado');
    expect(resumen).toHaveTextContent('Descentralizado');
    expect(resumen).toHaveTextContent('IMSS');

    await usuario.click(screen.getByRole('button', { name: /seleccionar todas las solicitudes/i }));
    await usuario.click(screen.getByRole('button', { name: /generar concentrado \(3\)/i }));
    const documento = document.querySelector('#concentrado-viaticos-print') as HTMLElement;
    expect(documento).toHaveTextContent(/Gerencia: Descentralizado/i);
    expect(documento).toHaveTextContent(/Gerencia: IMSS/i);
    // Un subtotal por bloque; el total general sigue en el pie.
    expect(documento.querySelectorAll('.concentrado-subtotal-grupo')).toHaveLength(2);
  });

  it('la columna Transporte muestra el medio que resolvió el servidor', async () => {
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          { ...fila, id_solicitud: 31, folio: 'VIA-AEREO', tipo_transporte: 'aereo' },
          { ...fila, id_solicitud: 32, folio: 'VIA-POR-DEFINIR', tipo_transporte: 'solicitado' },
          { ...fila, id_solicitud: 33, folio: 'VIA-SIN-DATO', tipo_transporte: 'sin-clasificar' },
        ],
      },
    });
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-31')).toBeInTheDocument());

    expect(within(screen.getByTestId('concentrado-31')).getByText('Aéreo')).toBeInTheDocument();
    // "Solicitado" es un estado del viaje, no un dato faltante.
    expect(within(screen.getByTestId('concentrado-32')).getByText('Solicitado')).toBeInTheDocument();
    expect(within(screen.getByTestId('concentrado-33')).getByText('Sin clasificar')).toBeInTheDocument();
  });

  it('la solicitud de avión incluye una autorizada y arma su documento', async () => {
    const usuario = userEvent.setup();
    mocks.bandeja.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            ...fila,
            persona_nombre: 'Persona Viajera',
            puesto: 'Coordinadora',
            fecha_nacimiento: '1990-05-17',
            motivo: 'Impartición de talleres',
            trayectos: [
              { fecha: '2026-11-10', hora: '08:00', origen: 'CDMX', destino: 'Puebla' },
            ],
          },
        ],
      },
    });
    render(<ConcentradoPage />);
    await waitFor(() => expect(screen.getByTestId('concentrado-5')).toBeInTheDocument());

    // La solicitud a la agencia también se manda antes de autorizar.
    const casilla = screen.getByRole('checkbox', { name: /incluir VIA-TEST-0005 en el concentrado/i });
    expect(casilla).not.toBeDisabled();
    await usuario.click(casilla);

    // El documento de avión se pide con su botón: la vista previa no cambia de formato.
    await usuario.click(screen.getByRole('button', { name: /solicitud de avión/i }));

    const documento = document.querySelector('#concentrado-vuelos-print') as HTMLElement;
    expect(documento).not.toBeNull();
    expect(documento).toHaveTextContent('Solicitud de avión');
    expect(documento).toHaveTextContent('Persona Viajera');
    expect(documento).toHaveTextContent('Coordinadora');
    expect(documento).toHaveTextContent('17/05/1990');
    expect(documento).toHaveTextContent('10/11/2026');
    expect(documento).toHaveTextContent('Puebla');
    expect(documento).toHaveTextContent('Impartición de talleres');
    // El portal del FOR-008 no se monta en este formato.
    expect(document.querySelector('#concentrado-viaticos-print')).toBeNull();
  });
});
