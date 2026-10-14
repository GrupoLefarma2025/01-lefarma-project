import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolicitudPage } from './SolicitudPage';
import type { CostosRutaOferta, CostosRutaResponse } from '../../types/costosRuta.types';
import type { CatalogoItem } from '@/apps/educacion-medica/components/CatalogoSearchSelect';

const mocks = vi.hoisted(() => ({ get: vi.fn(), usuarios: vi.fn(), calcular: vi.fn(), crear: vi.fn(), guardar: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get } }));
vi.mock('@/apps/educacion-medica/services/educacionMedica.api', () => ({
  educacionMedicaApi: { usuarios: { getAll: mocks.usuarios } },
}));
vi.mock('../../services/costosRuta.api', () => ({ costosRutaApi: { calcular: mocks.calcular } }));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: { crear: mocks.crear, guardarOpciones: mocks.guardar, misSolicitudes: vi.fn(), detalle: vi.fn() },
}));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: number; nombre: string } | null }) => unknown) =>
    selector({ user: { id: 7, nombre: 'Persona Actual' } }),
}));
vi.mock('../../components/PuntoMapaPicker', () => ({
  PuntoMapaPicker: ({ onChange }: { onChange: (p: { nombre: string; latitud: number; longitud: number }) => void }) => (
    <button type="button" onClick={() => onChange({ nombre: 'Punto de prueba', latitud: 19.5, longitud: -99.5 })}>
      Fijar punto de prueba
    </button>
  ),
}));
vi.mock('@/apps/educacion-medica/components/CatalogoSearchSelect', () => ({
  CatalogoSearchSelect: ({ items, value, onChange, placeholder }: {
    items: CatalogoItem[]; value: number | null; onChange: (v: number | null) => void; placeholder?: string;
  }) => (
    <select aria-label={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{placeholder}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>{i.label}</option>
      ))}
    </select>
  ),
}));
// Cableado del asistente, no la implementación de los pickers (cubierta aparte).
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value, onChange, placeholder }: { value: string | null; onChange: (v: string | null) => void; placeholder?: string }) => (
    <input aria-label={placeholder} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
  ),
}));
vi.mock('../../components/TimePicker', () => ({
  TimePicker: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('../../components/TablaHoteles', () => ({ TablaHoteles: () => <div>HOTELES_MARK</div> }));
vi.mock('../../test/fixtures/solicitudV2.fixture', () => ({
  VIATICOS_FIXTURES_ACTIVOS: false,
  IndicadorDatosPrueba: () => null,
  rellenarConFixture: () => { throw new Error('no fixtures in test'); },
}));

const ofertaAvion = (id: string, linea: string, costo: number): CostosRutaOferta => ({
  id, modo: 'avion', linea, servicio: '', persona: 'Persona Actual', tramo: 0, de: 'O', a: 'D',
  salidaTxt: '10/11 06:00', llegadaTxt: '10/11 08:00', duracion: '2 h', puertaAPuertaH: 4,
  precioTxt: `$${costo} MXN`, porPersona: true, costoGrupo: costo, costoPorPersona: costo,
  aTiempo: true, llegaTarde: false, minutosTarde: 0, noTomable: false, badge: '', nota: '',
  fuente: 'aerolinea.test', estimado: false,
  comprar: { url: 'https://compra.test/x', sitio: 'compra', accion: 'Comprar', objetivo: '', fecha: '' },
});

const RESPUESTA: CostosRutaResponse = {
  resultados: [{
    nombre: 'Persona Actual', gasolina: 'magna', propuesta: { razones: [], lugares: [] },
    tramos: [{ from: 'O', to: 'D', km: 100, opciones: [ofertaAvion('of1', 'Vuelo X', 2000), ofertaAvion('of2', 'Vuelo Y', 3500)] }],
    rutaArmada: {
      tramos: [{ de: 'O', a: 'D', km: 100, litros: 8.33, gasolina: { magna: { precioL: 24, costo: 200, fuente: 'x' }, premium: { precioL: 26, costo: 216, fuente: 'x' } }, casetas: { costo: 150, fuente: 'x' }, subtotalMagna: 350, subtotalPremium: 366 }],
      totales: { km: 100, litros: 8.33, casetas: 150, subtotalMagna: 350, subtotalPremium: 366 },
    },
    hotelesPropuestos: [],
    incumplimientos: [],
  }],
  propuestas: [], categorias: {}, recomendaciones: [], compartidos: [],
};

const SUCURSALES_URL = '/catalogos/Sucursales';
const sucursal = { idSucursal: 1, idEmpresa: 1, nombre: 'Matriz', ciudad: 'CDMX', latitud: 19.43, longitud: -99.13, activo: true, numeroEmpleados: 0, fechaCreacion: '2026-01-01' };
const empleados = [{ idUsuario: 9, nombreCompleto: 'Otra Persona', correo: 'otra@test' }];

const siguiente = () => screen.getByRole('button', { name: 'Siguiente' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation((url: string) => {
    if (url === SUCURSALES_URL) return Promise.resolve({ data: { success: true, data: [sucursal] } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
  mocks.usuarios.mockResolvedValue({ data: { success: true, data: empleados } });
  mocks.calcular.mockResolvedValue({ data: { success: true, data: RESPUESTA } });
  mocks.crear.mockResolvedValue({ data: { success: true, data: { id_solicitud: 42 } } });
  mocks.guardar.mockResolvedValue({ data: { success: true, data: { id_solicitud: 42 } } });
});

async function irAlPaso(ndestino: 2 | 3 | 4, modo: 'propio' | 'solicitado' = 'solicitado') {
  const usuario = userEvent.setup();
  render(<SolicitudPage />);
  await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Motivo del viaje'), { target: { value: 'Visita de zona' } });
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-2')).toBeInTheDocument();
  if (ndestino === 2) return;
  // Las tabs de Radix necesitan foco real: userEvent, no fireEvent.
  await usuario.click(screen.getByRole('radio', { name: modo === 'propio' ? 'Carro propio' : 'Solicitar transporte' }));
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-3')).toBeInTheDocument();
  if (ndestino === 3) return;
  fireEvent.change(screen.getByLabelText('Selecciona la sucursal de salida'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Elige la fecha de salida'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText('origen-hora'), { target: { value: '06:00' } });
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-4')).toBeInTheDocument();
}

function completarDestino() {
  fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
  fireEvent.change(screen.getByLabelText('Elige la fecha requerida'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText(/-debe$/), { target: { value: '12:00' } });
  fireEvent.change(screen.getByLabelText('Elige la fecha de salida'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText(/-sale$/), { target: { value: '18:00' } });
}

describe('SolicitudPage', () => {
  it('respeta el orden persona → transporte → origen y pide empleado para alguien más', async () => {
    const usuario = userEvent.setup();
    render(<SolicitudPage />);
    await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
    expect(siguiente()).toBeDisabled();
    await usuario.click(screen.getByRole('radio', { name: 'Para alguien más' }));
    expect(screen.getByLabelText('Buscar y seleccionar empleado')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Buscar y seleccionar empleado')).not.toBeDisabled());
    await waitFor(() => expect(screen.getByRole('option', { name: 'Otra Persona' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Buscar y seleccionar empleado'), '9');
    expect(screen.getByText(/Persona viajera:/).textContent).toContain('Otra Persona');
    expect(screen.getByText(/no se vuelve a pedir el nombre/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo del viaje'), { target: { value: 'Cobertura' } });
    expect(siguiente()).not.toBeDisabled();
  });

  it('carro propio usa Magna fija y muestra distancia sin tarjetas de modo', async () => {
    await irAlPaso(4, 'propio');
    completarDestino();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular este tramo' }));
    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    const request = mocks.calcular.mock.calls[0][0];
    expect(request.personas[0].carro_propio).toBe(true);
    expect(request.personas[0].gasolina).toBe('magna');
    expect(await screen.findByText(/Carro propio \(Magna\)/)).toBeInTheDocument();
    // Sin tarjetas de elección de modo y con casetas conservadas.
    expect(screen.queryByRole('button', { name: /Elegir Vuelo/ })).not.toBeInTheDocument();
    expect(screen.getByText(/casetas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar otro destino' })).not.toBeDisabled();
  });

  it('transporte solicitado exige elegir opción y ofrece hospedaje con nombres reales', async () => {
    await irAlPaso(4, 'solicitado');
    completarDestino();
    expect(screen.getByRole('button', { name: 'Calcular este tramo' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular este tramo' }));
    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /Elegir Vuelo X/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar otro destino' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Elegir Vuelo X/ }));
    expect(screen.getByRole('button', { name: 'Agregar otro destino' })).not.toBeDisabled();
    // Hospedaje cerca de: nombres reales del punto previo y del destino actual.
    fireEvent.click(screen.getByLabelText('Necesito hospedaje'));
    const zona = screen.getByLabelText('Hospedaje cerca de') as HTMLSelectElement;
    const opciones = Array.from(zona.options).map((o) => o.text);
    expect(opciones).toContain('Matriz');
    expect(opciones).toContain('Punto de prueba');
  });

  it('terminar abre el regreso y el envío ocurre una sola vez al final', async () => {
    await irAlPaso(4, 'solicitado');
    completarDestino();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular este tramo' }));
    await waitFor(() => expect(mocks.calcular).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: /Elegir Vuelo X/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(await screen.findByTestId('paso-5')).toBeInTheDocument();
    // Sin regreso por defecto; el rango se deriva.
    expect(screen.getByText(/Rango del viaje.*2026-11-10 al 2026-11-10/)).toBeInTheDocument();
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-6')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Comidas (MXN, monto abierto)'), { target: { value: '1200' } });
    expect(screen.getByText(/Total:/)).toHaveTextContent('3,200');
    const calcularAntes = mocks.calcular.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    expect(mocks.calcular.mock.calls.length).toBe(calcularAntes);
    expect(mocks.crear.mock.calls[0][0].datos.version).toBe('solicitud-v2');
    expect(mocks.guardar).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Solicitud 42 enviada/)).toBeInTheDocument();
  });
});
