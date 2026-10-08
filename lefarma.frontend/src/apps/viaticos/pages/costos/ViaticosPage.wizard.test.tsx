import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import type { CatalogoItem } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import { ViaticosPage } from './ViaticosPage';
import type { CostosRutaResponse } from '../../types/costosRuta.types';

const mocks = vi.hoisted(() => ({ get: vi.fn(), calculate: vi.fn() }));
const solicitudes = vi.hoisted(() => ({ crear: vi.fn(), guardarOpciones: vi.fn() }));
vi.mock('@/utils/waitForPrintImages', () => ({ waitForPrintImages: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get } }));
vi.mock('../../services/costosRuta.api', () => ({ costosRutaApi: { calcular: mocks.calculate } }));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: { crear: solicitudes.crear, guardarOpciones: solicitudes.guardarOpciones, misSolicitudes: vi.fn(), detalle: vi.fn() },
}));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (state: { user: { nombre?: string } | null }) => unknown) => selector({ user: null }),
}));
// jsdom no dibuja Leaflet: se sustituyen las primitivas por nodos planos para
// poder abrir el SelectorRutaModal desde el paso 2.
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  const mapa = { setView: vi.fn(), flyTo: vi.fn() };
  return {
    MapContainer: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    TileLayer: () => null,
    Marker: () => null,
    Popup: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    Polyline: () => null,
    useMap: () => mapa,
    useMapEvents: () => mapa,
  };
});
vi.mock('leaflet', () => ({ default: { divIcon: (opciones: unknown) => opciones } }));
vi.mock('../../components/PuntoMapaPicker', () => ({ PuntoMapaPicker: () => <div data-testid="punto-mapa" /> }));
vi.mock('@/apps/educacion-medica/components/CatalogoSearchSelect', () => ({
  CatalogoSearchSelect: ({ items, value, onChange, disabled, placeholder }: {
    items: CatalogoItem[]; value: number | null; onChange: (value: number | null) => void;
    disabled?: boolean; placeholder?: string;
  }) => <select aria-label={placeholder} disabled={disabled} value={value ?? ''}
    onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
    <option value="">{placeholder}</option>
    {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
  </select>,
}));

const rutaFixture = join(process.cwd(), 'src/apps/viaticos/test/fixtures/cotizacion-ejemplo.json');

const BRANCHES_URL = '/catalogos/Sucursales';
const HOSPITALS_URL = '/educacion-medica/hospitales/ubicaciones';

const branch = (id: number, nombre: string): Sucursal => ({
  idSucursal: id, idEmpresa: 1, nombre, ciudad: 'CDMX', latitud: 19 + id / 100, longitud: -99,
  activo: true, numeroEmpleados: 0, fechaCreacion: '2026-01-01',
});
const hospital = (codigo: number, nombre: string): HospitalUbicacion => ({
  codigoContacto: codigo, nombreContacto: nombre, nombreCorto: null, clues: null, ciudad: 'Toluca',
  codigoEstado: null, latitud: 20 + codigo / 100, longitud: -100, idRegion: null, regionNombre: null,
});
const branches = [branch(1, 'Base'), branch(2, 'Puebla')];
const hospitals = [hospital(1, 'Hospital Base'), hospital(2, 'Hospital Puebla')];

const CALCULAR = 'Calcular precios y proponer itinerario';
const atras = () => screen.getByRole('button', { name: 'Atrás' });
const siguiente = () => screen.getByRole('button', { name: 'Siguiente' });
const calcular = () => screen.getByRole('button', { name: CALCULAR });
const paso = (id: 1 | 2 | 3 | 4) => screen.getByTestId(`paso-${id}`);
const destino = (indice: number) => screen.getByRole('group', { name: `Destino ${indice} de persona 1` });

/** Visible = el panel del paso activo es el único sin la clase `hidden` de Tailwind. */
function visibles(): number[] {
  return ([1, 2, 3, 4] as const).filter(id => !paso(id).className.split(/\s+/).includes('hidden'));
}

/** La barra se mide por el desplazamiento de su indicador, que es lo que se ve. */
const barra = () => (screen.getByTestId('progreso-formulario').firstElementChild as HTMLElement).style.transform;

async function montar() {
  render(<ViaticosPage />);
  await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('Cargando hospitales…')).not.toBeInTheDocument());
}

/** Captura mínima y válida: nombre, origen y un destino en día laboral. */
function capturarMinimo() {
  fireEvent.change(within(paso(1)).getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Selecciona el origen'), { target: { value: '1' } });
  fireEvent.change(within(destino(1)).getByRole('combobox'), { target: { value: '2' } });
  fireEvent.change(within(destino(1)).getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((url: string) => {
    if (url === BRANCHES_URL) return Promise.resolve({ data: { success: true, data: branches } });
    if (url === HOSPITALS_URL) return Promise.resolve({ data: { success: true, data: hospitals } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
  mocks.calculate.mockResolvedValue({
    data: { success: true, data: { propuestas: [], resultados: [], compartidos: [], categorias: {}, recomendaciones: [] } },
  });
  solicitudes.crear.mockResolvedValue({
    data: { success: true, message: 'ok', data: { id_solicitud: 42, estado: 'borrador' } },
  });
  solicitudes.guardarOpciones.mockResolvedValue({
    data: { success: true, message: 'ok', data: { id_solicitud: 42, estado: 'enviada' } },
  });
});

describe('wizard de costos de ruta', () => {
  it('arranca en el paso 1 con un solo paso visible y la barra en 25%', async () => {
    await montar();
    expect(visibles()).toEqual([1]);
    expect(barra()).toBe('translateX(-75%)');
    expect(screen.getByTestId('indicador-paso-1')).toHaveAttribute('aria-current', 'step');
    expect(atras()).toBeDisabled();
  });

  it('solo un paso es visible a la vez en toda la navegación', async () => {
    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([2]);
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([3]);
    fireEvent.click(calcular());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(1));
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([4]);
    expect(paso(1).className).toContain('hidden');
    expect(paso(4).className).not.toContain('hidden');
  });

  it('la barra de progreso avanza con el paso activo', async () => {
    await montar();
    expect(barra()).toBe('translateX(-75%)');
    capturarMinimo();
    fireEvent.click(siguiente());
    expect(barra()).toBe('translateX(-50%)');
    expect(screen.getByTestId('indicador-paso-2')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('indicador-paso-1')).not.toHaveAttribute('aria-current');
  });

  it('Siguiente queda bloqueado sin el dato mínimo del paso 1', async () => {
    await montar();
    expect(siguiente()).toBeDisabled();
    // Nombre solo: aún falta origen y destino.
    fireEvent.change(within(paso(1)).getByLabelText('Nombre'), { target: { value: 'Ana' } });
    expect(siguiente()).toBeDisabled();
    capturarMinimo();
    expect(siguiente()).toBeEnabled();
  });

  it('Siguiente se bloquea de nuevo si el paso 1 deja de ser válido', async () => {
    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([2]);
    fireEvent.click(atras());
    expect(visibles()).toEqual([1]);
    // Se borra el origen: la solicitud vuelve a no existir.
    fireEvent.change(screen.getByLabelText('Selecciona el origen'), { target: { value: '' } });
    expect(siguiente()).toBeDisabled();
  });

  it('Atrás conserva todo lo capturado y Siguiente no lo reinicia', async () => {
    await montar();
    capturarMinimo();
    fireEvent.change(within(paso(1)).getByLabelText('Entrada laboral'), { target: { value: '07:15' } });
    fireEvent.change(within(paso(1)).getByLabelText('Gasolina'), { target: { value: 'premium' } });
    fireEvent.click(within(paso(1)).getByLabelText('Carro propio'));
    fireEvent.click(within(paso(1)).getByLabelText('Compartir viaje'));

    fireEvent.click(siguiente());
    expect(visibles()).toEqual([2]);
    fireEvent.click(atras());
    expect(visibles()).toEqual([1]);
    expect(within(paso(1)).getByLabelText('Nombre')).toHaveValue('Ana');
    expect(within(paso(1)).getByLabelText('Entrada laboral')).toHaveValue('07:15');
    expect(within(paso(1)).getByLabelText('Gasolina')).toHaveValue('premium');
    expect(within(paso(1)).getByLabelText('Carro propio')).toBeChecked();
    expect(within(paso(1)).getByLabelText('Compartir viaje')).toBeChecked();
    // Y la solicitud reconstruida conserva lo mismo: no se perdió nada.
    const preview = screen.getByLabelText('Solicitud JSON').textContent!;
    expect(preview).toContain('"gasolina": "premium"');
    expect(preview).toContain('"hora_entrada": "07:15"');
  });

  it('el paso 2 arma la secuencia con el SelectorRutaModal y la confirmación reordena las paradas', async () => {
    await montar();
    capturarMinimo();
    // Segunda parada, con fecha posterior para no solapar ventanas.
    fireEvent.click(within(paso(1)).getByRole('button', { name: 'Agregar destino' }));
    fireEvent.change(within(destino(2)).getByRole('combobox'), { target: { value: '1' } });
    fireEvent.change(within(destino(2)).getByLabelText('Día de presencia'), { target: { value: '2026-10-16' } });

    fireEvent.click(siguiente());
    expect(visibles()).toEqual([2]);
    const paradas = () => within(paso(2)).getByRole('list', { name: 'Secuencia de paradas' });
    expect(within(paradas()).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      expect.stringContaining('Hospital Puebla'),
      expect.stringContaining('Hospital Base'),
    ]);

    fireEvent.click(within(paso(2)).getByRole('button', { name: 'Abrir selector de ruta' }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: 'Subir punto 2' }));
    fireEvent.click(within(modal).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(within(paradas()).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      expect.stringContaining('Hospital Base'),
      expect.stringContaining('Hospital Puebla'),
    ]);
  });

  it('el paso 4 muestra los resultados y el importador de cotización', async () => {
    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([3]);
    expect(within(paso(3)).getByText(/Listo para calcular: 1 persona/)).toBeInTheDocument();
    fireEvent.click(calcular());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(1));
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([4]);
    // El importador queda cableado en el paso de resultados.
    expect(within(paso(4)).getByLabelText('JSON de la cotización')).toBeInTheDocument();
    expect(within(paso(4)).getByRole('button', { name: 'Cargar cotización' })).toBeInTheDocument();
  });

  it('el importador reutiliza la solicitud que el wizard ya tiene: no crea una segunda', async () => {
    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    fireEvent.click(siguiente());
    fireEvent.click(calcular());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(1));
    fireEvent.click(siguiente());

    const cotizacion = JSON.parse(
      readFileSync(rutaFixture, 'utf8'),
    ) as { opciones: { transportista: string; salida: string; precio: number | null }[] };
    const pega = () => {
      fireEvent.change(within(paso(4)).getByLabelText('JSON de la cotización'), {
        target: { value: JSON.stringify(cotizacion) },
      });
      fireEvent.click(within(paso(4)).getByRole('button', { name: 'Cargar cotización' }));
    };
    const elegir = (indice: number) =>
      fireEvent.click(
        within(paso(4)).getByLabelText(
          `Elegir ${cotizacion.opciones[indice].transportista} ${cotizacion.opciones[indice].salida}`,
        ),
      );
    const enviar = () => fireEvent.click(within(paso(4)).getByRole('button', { name: 'Enviar solicitud' }));

    pega();
    elegir(0);
    enviar();
    await waitFor(() => expect(solicitudes.crear).toHaveBeenCalledTimes(1));
    // El alta persiste el desglose; el motor vacio de este fixture no aporta gasolina/casetas.
    expect(solicitudes.crear.mock.calls[0][0].datos).toMatchObject({
      avion: 2450.5,
      autobus: null,
      hospedaje: null,
      gasolina: null,
      casetas: null,
      total: 2450.5,
    });
    await waitFor(() => expect(solicitudes.guardarOpciones).toHaveBeenCalledWith(42, expect.anything()));

    // Segunda cotizacion: el wizard ya tiene el id y lo reutiliza en vez de crear otra solicitud.
    pega();
    elegir(1);
    enviar();
    await waitFor(() => expect(solicitudes.guardarOpciones).toHaveBeenCalledTimes(2));
    expect(solicitudes.crear).toHaveBeenCalledTimes(1);
    expect(solicitudes.guardarOpciones).toHaveBeenLastCalledWith(42, expect.anything());
  });

  it('el desglose persistido lleva gasolina, casetas, comida y taxi del motor mas las opciones elegidas de pi', async () => {
    mocks.calculate.mockResolvedValue({
      data: {
        success: true,
        data: {
          propuestas: [
            {
              persona: 'Ana', clave: 'tipo1-carro', titulo: 'Carro', cumpleTodos: true,
              salidaOrigen: '', llegadaFinal: '', margenMinimoMinutos: 0, costoTotalMxn: 300,
              comida: 600, taxi: 120, hospedaje: 1500,
              tramos: [{ tramo: 1, de: 'Hospital Puebla', a: 'Hospital Base', modo: 'auto', linea: 'Auto', salida: '', llegada: '', costo: 300 }],
              hotelesPropuestos: [], incumplimientos: [], fuentes: ['fixture'],
            },
          ],
          resultados: [
            {
              nombre: 'Ana', gasolina: 'magna', propuesta: { razones: [], lugares: [] }, tramos: [],
              rutaArmada: {
                tramos: [
                  {
                    de: 'Hospital Puebla', a: 'Hospital Base', km: 120, litros: 10,
                    gasolina: { magna: { precioL: 25, costo: 250, fuente: 'fixture' }, premium: { precioL: 30, costo: 300, fuente: 'fixture' } },
                    casetas: { costo: 50, fuente: 'fixture' }, subtotalMagna: 300, subtotalPremium: 350,
                  },
                ],
                totales: { km: 120, litros: 10, casetas: 50, subtotalMagna: 300, subtotalPremium: 350 },
              },
              hotelesPropuestos: [], incumplimientos: [],
            },
          ],
          compartidos: [], categorias: {}, recomendaciones: [],
        } satisfies CostosRutaResponse,
      },
    });

    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    fireEvent.click(siguiente());
    fireEvent.click(calcular());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(1));
    fireEvent.click(siguiente());

    const cotizacion = JSON.parse(
      readFileSync(rutaFixture, 'utf8'),
    ) as { opciones: { transportista: string; salida: string }[] };
    fireEvent.change(within(paso(4)).getByLabelText('JSON de la cotización'), {
      target: { value: JSON.stringify(cotizacion) },
    });
    fireEvent.click(within(paso(4)).getByRole('button', { name: 'Cargar cotización' }));
    // Solo el hospedaje: avion y autobus quedan desconocidos.
    fireEvent.click(
      within(paso(4)).getByLabelText(`Elegir ${cotizacion.opciones[2].transportista} ${cotizacion.opciones[2].salida}`),
    );
    fireEvent.click(within(paso(4)).getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(solicitudes.crear).toHaveBeenCalledTimes(1));
    expect(solicitudes.crear.mock.calls[0][0].datos).toMatchObject({
      avion: null,
      autobus: null,
      hospedaje: 3180,
      gasolina: 250,
      casetas: 50,
      comida: 600,
      taxi: 120,
      total: 3180 + 250 + 50 + 600 + 120,
    });
  });

  it('sin cálculo no se puede llegar a resultados ni al importador', async () => {
    await montar();
    capturarMinimo();
    fireEvent.click(siguiente());
    fireEvent.click(siguiente());
    expect(visibles()).toEqual([3]);
    expect(siguiente()).toBeDisabled();
    expect(screen.queryByLabelText('JSON de la cotización')).not.toBeInTheDocument();
  });
});