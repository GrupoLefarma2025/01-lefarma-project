import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import type { CostosRutaRequest, CostosRutaResponse, PuntoSeleccion } from '../../types/costosRuta.types';
import type { CatalogoItem } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import { ViaticosPage } from './ViaticosPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), calculate: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), images: vi.fn() }));
const auth = vi.hoisted(() => ({ nombre: undefined as string | undefined }));
vi.mock('@/utils/waitForPrintImages', () => ({ waitForPrintImages: mocks.images }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get } }));
vi.mock('../../services/costosRuta.api', () => ({ costosRutaApi: { calcular: mocks.calculate } }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success, warning: mocks.warning } }));
// El usuario en sesión es opcional: sin nombre, el formulario es capturable a mano.
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (state: { user: { nombre?: string } | null }) => unknown) =>
    selector({ user: auth.nombre ? { nombre: auth.nombre } : null }),
}));
// El mapa real (Leaflet) no renderiza en jsdom; se ejerce el cableado del formulario.
vi.mock('../../components/PuntoMapaPicker', () => ({
  PuntoMapaPicker: ({ value, onChange }: { value: PuntoSeleccion | null; onChange: (punto: PuntoSeleccion | null) => void }) => (
    <div>
      <button type="button" onClick={() => onChange({ nombre: 'Punto mapa', latitud: 19.5, longitud: -99.5 })}>Fijar punto de prueba</button>
      <button type="button" onClick={() => onChange({ nombre: 'Punto inválido', latitud: 0, longitud: 0 })}>Fijar punto inválido</button>
      <button type="button" onClick={() => onChange({ nombre: 'Punto fuera', latitud: 120, longitud: -99.5 })}>Fijar punto fuera</button>
      <span data-testid="punto-mapa">{value ? value.nombre : 'sin punto'}</span>
    </div>
  ),
}));
// Exercise form wiring, not Radix's popup implementation or live authentication.
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
const EMPLOYEES_URL = '/auth/usuarios';
const employees = [{ idUsuario: 7, nombreCompleto: 'Beto Empleado', correo: 'beto@lefarma.test' }];

const branch = (id: number, name: string, ciudad = 'CDMX'): Sucursal => ({
  idSucursal: id, idEmpresa: 1, nombre: name, ciudad, latitud: 19 + id / 100, longitud: -99,
  activo: true, numeroEmpleados: 0, fechaCreacion: '2026-01-01',
});
const hospital = (codigo: number, nombre: string, ciudad: string, latitud: number | null = 20 + codigo / 100, longitud: number | null = -100): HospitalUbicacion => ({
  codigoContacto: codigo, nombreContacto: nombre, nombreCorto: null, clues: null, ciudad,
  codigoEstado: null, latitud, longitud, idRegion: null, regionNombre: null,
});
const branches = [branch(1, 'Base', 'CDMX'), branch(2, 'Puebla', 'Puebla'), branch(3, 'León', 'León'), { ...branch(4, 'Inactive', 'CDMX'), activo: false }];
const hospitals = [
  hospital(1, 'Hospital Base', 'Toluca'),
  hospital(2, 'Hospital Puebla', 'Puebla'),
  hospital(3, 'Hospital León', 'León'),
  hospital(4, 'Hospital Veracruz', 'Veracruz'),
  hospital(5, 'Hospital Xalapa', 'Xalapa'),
];

function mockCatalogs(overrides: { branches?: unknown; hospitals?: unknown } = {}) {
  mocks.get.mockImplementation((url: string) => {
    if (url === BRANCHES_URL) return Promise.resolve({ data: { success: true, data: 'branches' in overrides ? overrides.branches : branches } });
    if (url === HOSPITALS_URL) return Promise.resolve({ data: { success: true, data: 'hospitals' in overrides ? overrides.hospitals : hospitals } });
    if (url === EMPLOYEES_URL) return Promise.resolve({ data: { success: true, data: employees } });
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

const response: CostosRutaResponse = {
  propuestas: [{ persona: 'Ana', clave: 'barata', titulo: 'Propuesta barata', cumpleTodos: false,
    salidaOrigen: '2026-10-14T22:00', llegadaFinal: '2026-10-15T08:00', margenMinimoMinutos: 0, costoTotalMxn: 400,
    comida: 0, taxi: 0, hospedaje: 0,
    tramos: [], hotelesPropuestos: [], incumplimientos: ['No viable fixture'], fuentes: ['mock only'] }],
  resultados: [{ nombre: 'Ana', gasolina: 'magna', propuesta: { razones: [], lugares: [] }, tramos: [],
    rutaArmada: { tramos: [], totales: { km: 120, litros: 10, casetas: 30, subtotalMagna: 300, subtotalPremium: 330 } },
    hotelesPropuestos: [{ lugar: 'Hotel fixture', ciudad: 'Puebla', checkIn: '2026-10-14', checkOut: '2026-10-15',
      noches: 1, habitaciones: 1, motivo: 'fixture', fuente: 'mock', link: 'https://example.test' }], incumplimientos: [] }],
  compartidos: [{ de: 'Base', a: 'Puebla', personas: ['Ana', 'Beto'], conductor: 'Ana', ahorroEstimadoMxn: 20, nota: 'mock sharing' }],
  categorias: {}, recomendaciones: [],
};
const calculateButton = () => screen.getByRole('button', { name: 'Calcular precios y proponer itinerario' });
const personGroup = (number = 1) => screen.getByRole('group', { name: `Persona ${number}` });
const destinationGroup = (number = 1, person = 1) => screen.getByRole('group', { name: `Destino ${number} de persona ${person}` });
const preview = () => JSON.parse(screen.getByLabelText('Solicitud JSON').textContent!) as CostosRutaRequest;

async function prepare() {
  render(<ViaticosPage />);
  await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('Cargando hospitales…')).not.toBeInTheDocument());
  fireEvent.change(within(personGroup()).getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(within(screen.getByRole('group', { name: 'Origen de persona 1' })).getByRole('combobox'), { target: { value: '1' } });
  fireEvent.change(within(destinationGroup()).getByRole('combobox'), { target: { value: '2' } });
  fireEvent.change(within(destinationGroup()).getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.nombre = undefined;
  mockCatalogs();
  mocks.calculate.mockResolvedValue({ data: { success: true, data: response } });
  mocks.images.mockResolvedValue(undefined);
});

describe('hospital working-day form', () => {
  it('defaults to local tomorrow, loads both catalogs, and submits the exact read-only preview', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const expectedDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    render(<ViaticosPage />);
    expect(screen.getByLabelText('Día de presencia')).toHaveValue(expectedDate);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(BRANCHES_URL));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(HOSPITALS_URL, { params: { activo: true, tieneCoordenadas: true } }));
    await waitFor(() => expect(screen.queryByText('Cargando hospitales…')).not.toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Inactive' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hospital Puebla' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /JSON/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Selecciona el origen'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Selecciona el destino'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
    expect(screen.getByLabelText('Entrada laboral')).toHaveValue('08:00');
    expect(screen.getByLabelText('Salida laboral')).toHaveValue('18:30');
    expect(preview().personas[0].lugares[1]).toMatchObject({ orden: 2, nombre: 'Hospital Puebla', hora_inicio_actividad: '08:00', hora_fin_actividad: '18:30' });
    const shown = preview();
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledWith(shown));
    expect(await screen.findByText('Propuesta barata')).toBeInTheDocument();
    expect(screen.getByText('Ruta armada · Ana')).toBeInTheDocument();
    expect(screen.getByText('Hoteles propuestos')).toBeInTheDocument();
    expect(screen.getByText('Viajes compartidos')).toBeInTheDocument();
    expect(screen.getByText('No viable fixture')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Changed' } });
    expect(screen.getByText('Ruta armada · Ana')).toBeInTheDocument();
  });

  it('translates custom hours, car/fuel and existing option toggles', async () => {
    await prepare();
    fireEvent.change(screen.getByLabelText('Entrada laboral'), { target: { value: '07:15' } });
    fireEvent.change(screen.getByLabelText('Salida laboral'), { target: { value: '19:45' } });
    fireEvent.click(screen.getByLabelText('Carro propio'));
    fireEvent.change(screen.getByLabelText('Gasolina'), { target: { value: 'premium' } });
    fireEvent.click(screen.getByLabelText('Respetar horario laboral'));
    fireEvent.click(screen.getByLabelText('Calcular hoteles'));
    fireEvent.click(screen.getByLabelText('Calcular viajes intermedios'));
    fireEvent.click(screen.getByLabelText('Compartir viaje'));
    fireEvent.change(screen.getByLabelText('Fecha de salida del origen'), { target: { value: '2026-10-14' } });
    fireEvent.change(screen.getByLabelText('Hora de salida del origen'), { target: { value: '23:15' } });
    const shown = preview();
    expect(shown.opciones).toEqual({ respetarHorarioLaboral: false, calcularHoteles: false, calcularViajesIntermedios: false, compartirViaje: true });
    expect(shown.personas[0]).toMatchObject({ carro_propio: true, gasolina: 'premium', trabajo: { hora_entrada: '07:15', hora_salida: '19:45' } });
    expect(shown.personas[0].lugares[1]).toMatchObject({ fecha_inicio_actividad: '2026-10-15', fecha_fin_actividad: '2026-10-15', hora_inicio_actividad: '07:15', hora_fin_actividad: '19:45', nombre: 'Hospital Puebla' });
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledWith(shown));
  });

  it('adds, reorders and removes stops with contiguous wire order and explicit dates', async () => {
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar destino' }));
    fireEvent.change(within(destinationGroup(2)).getByRole('combobox'), { target: { value: '3' } });
    fireEvent.change(within(destinationGroup(2)).getByLabelText('Día de presencia'), { target: { value: '2026-10-16' } });
    expect(preview().personas[0].lugares.map(place => place.orden)).toEqual([1, 2, 3]);
    fireEvent.click(within(destinationGroup(2)).getByRole('button', { name: 'Subir destino' }));
    expect(within(destinationGroup()).getByRole('combobox')).toHaveValue('3');
    expect(screen.getByText(/superponen o están en orden inverso/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.click(within(destinationGroup()).getByRole('button', { name: 'Bajar destino' }));
    fireEvent.click(within(destinationGroup()).getByRole('button', { name: 'Eliminar destino' }));
    expect(preview().personas[0].lugares.map(place => place.orden)).toEqual([1, 2]);
    expect(preview().personas[0].lugares[1].nombre).toBe('Hospital León');
  });

  it('supports independent people and clones itineraries for sharing without mutating the original', async () => {
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar itinerario para otra persona' }));
    fireEvent.change(within(personGroup(2)).getByLabelText('Nombre'), { target: { value: 'Beto' } });
    fireEvent.click(screen.getByLabelText('Compartir viaje'));
    expect(preview().personas[1].lugares).toEqual(preview().personas[0].lugares);
    const shared = preview();
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledWith(shared));
    await waitFor(() => expect(calculateButton()).toBeEnabled());
    fireEvent.change(within(destinationGroup(1, 2)).getByRole('combobox'), { target: { value: '3' } });
    expect(preview().personas[0].lugares[1].nombre).toBe('Hospital Puebla');
    expect(preview().personas[1].lugares[1].nombre).toBe('Hospital León');
    fireEvent.click(within(personGroup(2)).getByRole('button', { name: 'Eliminar persona' }));
    expect(preview().personas).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar persona (1/9)' }));
    expect(within(personGroup(2)).getByLabelText('Nombre')).toHaveValue('');
    expect(within(personGroup(2)).getByLabelText('Entrada laboral')).toHaveValue('08:00');
  });

  it('enforces the nine-person limit on add and clone', async () => {
    await prepare();
    for (let count = 1; count < 9; count++) fireEvent.click(screen.getByRole('button', { name: `Agregar persona (${count}/9)` }));
    expect(screen.getByRole('button', { name: 'Agregar persona (9/9)' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Duplicar itinerario para otra persona' })).toHaveLength(9);
    for (const button of screen.getAllByRole('button', { name: 'Duplicar itinerario para otra persona' })) expect(button).toBeDisabled();
  });

  it('visibly blocks overlapping full days, missing stops and inverted hours', async () => {
    await prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar destino' }));
    fireEvent.change(within(destinationGroup(2)).getByRole('combobox'), { target: { value: '3' } });
    fireEvent.change(within(destinationGroup(2)).getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
    expect(screen.getByText(/superponen o están en orden inverso/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.click(calculateButton());
    expect(mocks.calculate).not.toHaveBeenCalled();
    fireEvent.click(within(destinationGroup(2)).getByRole('button', { name: 'Eliminar destino' }));
    fireEvent.change(screen.getByLabelText('Entrada laboral'), { target: { value: '20:00' } });
    expect(screen.getByText(/entrada debe ser anterior/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Entrada laboral'), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar destino' }));
    expect(screen.getByText(/agrega al menos un destino/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
  });

  it.each([
    { latitud: null }, { latitud: 0, longitud: 0 }, { longitud: 181 },
  ])('identifies unusable selected hospital coordinates and prevents POST: %j', async invalid => {
    mockCatalogs({ hospitals: [hospital(1, 'Hospital Base', 'Toluca'), { ...hospital(2, 'Hospital Puebla', 'Puebla'), ...invalid }] });
    await prepare();
    expect(screen.getByText(/«Hospital Puebla» no tiene coordenadas válidas/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.click(calculateButton());
    expect(mocks.calculate).not.toHaveBeenCalled();
  });

  it('handles loading, empty, unsuccessful and rejected catalogs without calculation', async () => {
    mocks.get.mockReturnValue(new Promise(() => {}));
    const mounted = render(<ViaticosPage />);
    expect(screen.getByText('Cargando sucursales…')).toBeInTheDocument();
    expect(screen.getByText('Cargando hospitales…')).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    mounted.unmount();

    mockCatalogs({ branches: [], hospitals: [] });
    const empty = render(<ViaticosPage />);
    expect(await screen.findByText('No hay sucursales activas disponibles.')).toBeInTheDocument();
    expect(await screen.findByText('No hay hospitales disponibles.')).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    empty.unmount();

    mocks.get.mockImplementation((url: string) => url === BRANCHES_URL
      ? Promise.resolve({ data: { success: false, message: 'Catalog denied' } })
      : Promise.resolve({ data: { success: true, data: hospitals } }));
    const denied = render(<ViaticosPage />);
    expect(await screen.findByText(/No se pudieron cargar las sucursales: Catalog denied/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    denied.unmount();

    mocks.get.mockImplementation((url: string) => url === HOSPITALS_URL
      ? Promise.resolve({ data: { success: false, message: 'Hospital catalog denied' } })
      : Promise.resolve({ data: { success: true, data: branches } }));
    const deniedHospitals = render(<ViaticosPage />);
    expect(await screen.findByText(/No se pudieron cargar los hospitales: Hospital catalog denied/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    deniedHospitals.unmount();

    mocks.get.mockImplementation((url: string) => url === BRANCHES_URL
      ? Promise.reject(new Error('Catalog offline'))
      : Promise.resolve({ data: { success: true, data: hospitals } }));
    render(<ViaticosPage />);
    expect(await screen.findByText(/No se pudieron cargar las sucursales/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    expect(mocks.calculate).not.toHaveBeenCalled();
  });

  it('handles unsuccessful and rejected calculation while retaining existing outputs', async () => {
    await prepare();
    fireEvent.click(calculateButton());
    await screen.findByText('Propuesta barata');
    mocks.calculate.mockResolvedValue({ data: { success: false, message: 'Calculation denied' } });
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Calculation denied'));
    expect(screen.getByText('Ruta armada · Ana')).toBeInTheDocument();
    mocks.calculate.mockRejectedValue(new Error('Calculation offline'));
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Ruta armada · Ana')).toBeInTheDocument();
  });

  it('sends Friday 16:57 unchanged and exposes suspicious catalog coordinates', async () => {
    mockCatalogs({ branches: [{ ...branches[0], latitud: 1, longitud: 2 }] });
    await prepare();
    fireEvent.change(screen.getByLabelText('Día de presencia'), { target: { value: '2026-10-02' } });
    fireEvent.change(screen.getByLabelText('Fecha de salida del origen'), { target: { value: '2026-10-02' } });
    fireEvent.change(screen.getByLabelText('Hora de salida del origen'), { target: { value: '16:57' } });
    expect(calculateButton()).toBeEnabled();
    expect(screen.getByText(/fuera de México/)).toBeInTheDocument();
    fireEvent.click(calculateButton());
    await waitFor(() => expect(mocks.calculate).toHaveBeenCalledWith(expect.objectContaining({ personas: [expect.objectContaining({
      lugares: [expect.objectContaining({ fecha_salida: '2026-10-02', hora_salida: '16:57' }), expect.anything()],
    })] })));
  });

  it('prints the captured request after editing the form, in an isolated portal, and cleans up both formats', async () => {
    await prepare();
    fireEvent.click(calculateButton());
    await screen.findByText('Propuesta barata');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Changed' } });
    fireEvent.change(screen.getByLabelText('Día de presencia'), { target: { value: '2026-11-02' } });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body).toHaveClass('costos-print-active');
      expect(document.querySelector('#costos-viaticos-print')?.parentElement).toBe(document.body);
      expect(document.querySelector('#costos-viaticos-print')).toHaveTextContent('2026-10-15');
      expect(document.querySelector('#costos-viaticos-print')).not.toHaveTextContent('2026-11-02');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir concentrado de viáticos' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(document.body).not.toHaveClass('costos-print-active');
    expect(mocks.images).toHaveBeenCalledWith('#costos-viaticos-print');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir solicitud individual' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
    expect(document.querySelector('#costos-viaticos-print')).toHaveTextContent('Solicitud de Viáticos');
    expect(document.querySelector('#costos-viaticos-print')).toHaveTextContent('Nombre del solicitante: Ana');
    expect(document.body).not.toHaveClass('costos-print-active');
    print.mockRestore();
  });

  it('cleans up failed image preparation and print exceptions, and never prints after unmount', async () => {
    await prepare();
    fireEvent.click(calculateButton());
    await screen.findByText('Propuesta barata');
    const print = vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('Print unavailable'); });
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir concentrado de viáticos' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(document.body).not.toHaveClass('costos-print-active');
    mocks.images.mockRejectedValueOnce(new Error('Image preparation failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir solicitud individual' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(2));
    expect(document.body).not.toHaveClass('costos-print-active');
    print.mockRestore();
  });

  it('captura para mí con el nombre de la sesión, en solo lectura', async () => {
    auth.nombre = 'Ana Sesión';
    render(<ViaticosPage />);
    await waitFor(() => expect(screen.queryByText('Cargando sucursales…')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Cargando hospitales…')).not.toBeInTheDocument());
    const nombre = within(personGroup()).getByLabelText('Nombre');
    expect(nombre).toHaveValue('Ana Sesión');
    expect(nombre).toHaveAttribute('readonly');
    fireEvent.change(within(screen.getByRole('group', { name: 'Origen de persona 1' })).getByRole('combobox'), { target: { value: '1' } });
    fireEvent.change(within(destinationGroup()).getByRole('combobox'), { target: { value: '2' } });
    fireEvent.change(within(destinationGroup()).getByLabelText('Día de presencia'), { target: { value: '2026-10-15' } });
    expect(preview().personas[0].nombre).toBe('Ana Sesión');
  });

  it('captura para alguien más desde el directorio de empleados', async () => {
    await prepare();
    fireEvent.click(screen.getByLabelText('Para alguien más'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(EMPLOYEES_URL));
    const empleado = await screen.findByRole('combobox', { name: 'Selecciona al empleado' });
    fireEvent.change(empleado, { target: { value: '7' } });
    expect(within(personGroup()).getByLabelText('Nombre')).toHaveValue('Beto Empleado');
    expect(preview().personas[0].nombre).toBe('Beto Empleado');
  });

  it('un punto en el mapa reemplaza al catálogo en origen y destino', async () => {
    await prepare();
    fireEvent.click(within(destinationGroup()).getByRole('button', { name: 'Punto en mapa' }));
    fireEvent.click(within(destinationGroup()).getByRole('button', { name: 'Fijar punto de prueba' }));
    const origen = screen.getByRole('group', { name: 'Origen de persona 1' });
    fireEvent.click(within(origen).getByRole('button', { name: 'Punto en mapa' }));
    fireEvent.click(within(origen).getByRole('button', { name: 'Fijar punto de prueba' }));
    const shown = preview();
    expect(shown.personas[0].lugares[0]).toMatchObject({ orden: 1, tipo: 'salida', nombre: 'Punto mapa', latitud: 19.5, longitud: -99.5 });
    expect(shown.personas[0].lugares[1]).toMatchObject({ orden: 2, tipo: 'taller', nombre: 'Punto mapa', latitud: 19.5, longitud: -99.5 });
  });

  it('bloquea un punto en el mapa con coordenadas 0,0 o fuera de rango', async () => {
    await prepare();
    const destino = destinationGroup();
    fireEvent.click(within(destino).getByRole('button', { name: 'Punto en mapa' }));
    fireEvent.click(within(destino).getByRole('button', { name: 'Fijar punto inválido' }));
    expect(screen.getByText(/«Punto inválido» no tiene coordenadas válidas/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.click(within(destino).getByRole('button', { name: 'Fijar punto fuera' }));
    expect(screen.getByText(/«Punto fuera» no tiene coordenadas válidas/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
  });

  it('valida la llegada al destino: ambos campos o ninguno', async () => {
    await prepare();
    const destino = destinationGroup();
    const llegadaFecha = () => within(destino).getByLabelText('Fecha de llegada al destino (opcional)');
    const llegadaHora = () => within(destino).getByLabelText('Hora de llegada al destino (opcional)');
    expect(preview().personas[0].lugares[1]).not.toHaveProperty('fecha_llegada');
    fireEvent.change(llegadaFecha(), { target: { value: '2026-10-15' } });
    expect(screen.getByText(/fecha y hora de llegada/)).toBeInTheDocument();
    expect(calculateButton()).toBeDisabled();
    fireEvent.change(llegadaHora(), { target: { value: '09:30' } });
    expect(preview().personas[0].lugares[1]).toMatchObject({ fecha_llegada: '2026-10-15', hora_llegada: '09:30' });
    expect(calculateButton()).toBeEnabled();
    fireEvent.change(llegadaFecha(), { target: { value: '' } });
    fireEvent.change(llegadaHora(), { target: { value: '' } });
    expect(preview().personas[0].lugares[1]).not.toHaveProperty('fecha_llegada');
    expect(preview().personas[0].lugares[1]).not.toHaveProperty('hora_llegada');
  });
});
