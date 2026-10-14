import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import type { CatalogoItem } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import type { CostosRutaOferta, CostosRutaResponse } from '../../types/costosRuta.types';
import { ViaticosPage } from './ViaticosPage';

/**
 * Selección de opción por tramo en el paso de resultados: el especialista
 * elige UNA opción por tramo y puede deseleccionarla. La elección se indexa
 * por persona + tramo, así que sobrevive a un recálculo.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), calculate: vi.fn() }));
vi.mock('@/utils/waitForPrintImages', () => ({ waitForPrintImages: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get } }));
vi.mock('../../services/costosRuta.api', () => ({ costosRutaApi: { calcular: mocks.calculate } }));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: { crear: vi.fn(), guardarOpciones: vi.fn(), misSolicitudes: vi.fn(), detalle: vi.fn() },
}));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (state: { user: { nombre?: string } | null }) => unknown) => selector({ user: null }),
}));
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

const oferta = (id: string, linea: string): CostosRutaOferta => ({
  id, modo: 'avion', linea, servicio: 'VL', persona: 'Ana', tramo: 1, de: 'Base', a: 'Hospital Puebla',
  salidaTxt: '10/11 06:05', llegadaTxt: '10/11 07:35', duracion: '1h 30m', puertaAPuertaH: 1.5,
  precioTxt: '$2450 MXN /persona', porPersona: true, costoGrupo: 2450, costoPorPersona: 2450,
  aTiempo: true, llegaTarde: false, minutosTarde: 0, noTomable: false, badge: '', nota: '',
  fuente: 'volaris.com', estimado: false,
  comprar: { url: `https://ejemplo.test/${id}`, sitio: 'ejemplo.test', accion: 'comprar', objetivo: 'vuelo', fecha: '2026-11-10' },
});

/** Un tramo con dos opciones y un tramo con una: permite comprobar el "una por tramo". */
const respuesta = (): CostosRutaResponse => ({
  propuestas: [],
  resultados: [
    {
      nombre: 'Ana',
      gasolina: 'magna',
      propuesta: { razones: [], lugares: [] },
      tramos: [
        { from: 'Base', to: 'Hospital Puebla', km: 120, opciones: [oferta('t1-a', 'Volaris'), oferta('t1-b', 'Viva Aerobus')] },
        { from: 'Hospital Puebla', to: 'Hospital Base', km: 130, opciones: [oferta('t2-a', 'ETN')] },
      ],
      rutaArmada: {
        tramos: [],
        totales: { km: 250, litros: 20, casetas: 300, subtotalMagna: 2600, subtotalPremium: 2800 },
      },
      hotelesPropuestos: [],
      incumplimientos: [],
    },
  ],
  compartidos: [],
  categorias: {},
  recomendaciones: [],
});

const paso = (id: 1 | 2 | 3 | 4) => screen.getByTestId(`paso-${id}`);
const siguiente = () => screen.getByRole('button', { name: 'Siguiente' });
const atras = () => screen.getByRole('button', { name: 'Atrás' });
const calcular = () => screen.getByRole('button', { name: 'Calcular precios y proponer itinerario' });
const destino = (indice: number) => screen.getByRole('group', { name: `Destino ${indice} de persona 1` });

const botonElegir = (transportista: string) =>
  within(paso(4)).getByRole('button', { name: `Elegir ${transportista} 10/11 06:05 → 10/11 07:35` });

function capturarMinimo() {
  fireEvent.change(within(paso(1)).getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Selecciona el origen'), { target: { value: '1' } });
  fireEvent.change(within(destino(1)).getByRole('combobox'), { target: { value: '2' } });
  fireEvent.change(within(destino(1)).getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
}

/** Captura mínima, calcula y deja visible el paso de resultados. */
async function llegarAResultados() {
  render(<ViaticosPage />);
  await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('Cargando hospitales…')).not.toBeInTheDocument());
  capturarMinimo();
  fireEvent.click(siguiente());
  fireEvent.click(siguiente());
  fireEvent.click(calcular());
  await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(1));
  fireEvent.click(siguiente());
  expect(within(paso(4)).getByText(/Ruta armada · Ana/)).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((url: string) => {
    if (url === BRANCHES_URL) return Promise.resolve({ data: { success: true, data: branches } });
    if (url === HOSPITALS_URL) return Promise.resolve({ data: { success: true, data: hospitals } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
  mocks.calculate.mockResolvedValue({ data: { success: true, data: respuesta() } });
});

describe('elección de opción por tramo', () => {
  it('deja activa y resaltada la fila elegida y deshabilita Elegir sin selección', async () => {
    await llegarAResultados();

    // Con la página conectada, ningún botón "Elegir" llega deshabilitado.
    const botones = within(paso(4)).getAllByRole('button', { name: /^Elegir / });
    expect(botones).toHaveLength(3);
    for (const boton of botones) expect(boton).toBeEnabled();

    fireEvent.click(botonElegir('Volaris'));

    expect(botonElegir('Volaris')).toHaveAttribute('aria-pressed', 'true');
    expect(botonElegir('Volaris')).toHaveTextContent('Elegida');
    expect(botonElegir('Volaris').closest('tr')).toHaveAttribute('data-state', 'selected');
  });

  it('permite solo una opción elegida por tramo: elegir otra mueve el resaltado', async () => {
    await llegarAResultados();

    fireEvent.click(botonElegir('Volaris'));
    fireEvent.click(botonElegir('Viva Aerobus'));

    expect(botonElegir('Viva Aerobus')).toHaveAttribute('aria-pressed', 'true');
    expect(botonElegir('Volaris')).toHaveAttribute('aria-pressed', 'false');
    expect(botonElegir('Volaris').closest('tr')).not.toHaveAttribute('data-state');
    expect(within(paso(4)).getAllByRole('row').filter(fila => fila.dataset.state === 'selected')).toHaveLength(1);
  });

  it('la elección de un tramo no afecta a los demás tramos de la misma persona', async () => {
    await llegarAResultados();

    fireEvent.click(botonElegir('Volaris'));
    fireEvent.click(within(paso(4)).getByRole('button', { name: 'Elegir ETN 10/11 06:05 → 10/11 07:35' }));

    expect(botonElegir('Volaris')).toHaveAttribute('aria-pressed', 'true');
    expect(within(paso(4)).getByRole('button', { name: 'Elegir ETN 10/11 06:05 → 10/11 07:35' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('se puede deseleccionar la opción elegida volviendo a pulsarla', async () => {
    await llegarAResultados();

    fireEvent.click(botonElegir('Volaris'));
    fireEvent.click(botonElegir('Volaris'));

    expect(botonElegir('Volaris')).toHaveAttribute('aria-pressed', 'false');
    expect(botonElegir('Volaris')).toHaveTextContent('Elegir');
    expect(botonElegir('Volaris').closest('tr')).not.toHaveAttribute('data-state');
  });

  it('la elección sobrevive a un recálculo mientras la persona no cambie', async () => {
    await llegarAResultados();
    fireEvent.click(botonElegir('Viva Aerobus'));

    fireEvent.click(atras());
    fireEvent.click(calcular());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledTimes(2));
    fireEvent.click(siguiente());

    expect(botonElegir('Viva Aerobus')).toHaveAttribute('aria-pressed', 'true');
    expect(botonElegir('Volaris')).toHaveAttribute('aria-pressed', 'false');
  });
});