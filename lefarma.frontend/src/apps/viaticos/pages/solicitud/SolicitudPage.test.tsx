import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolicitudPage } from './SolicitudPage';
import type { CatalogoItem } from '@/apps/educacion-medica/components/CatalogoSearchSelect';

const mocks = vi.hoisted(() => ({ get: vi.fn(), usuarios: vi.fn(), crear: vi.fn(), guardar: vi.fn(), gerenciaSugerida: vi.fn(), navigate: vi.fn() }));
vi.mock('@/shared/api/apiClient', () => ({ API: { get: mocks.get } }));
vi.mock('@/apps/educacion-medica/services/educacionMedica.api', () => ({
  educacionMedicaApi: { usuarios: { getAll: mocks.usuarios } },
}));
vi.mock('../../services/solicitudes.api', () => ({
  solicitudesApi: {
    crear: mocks.crear,
    guardarOpciones: mocks.guardar,
    gerenciaSugerida: mocks.gerenciaSugerida,
    misSolicitudes: vi.fn(),
    detalle: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({}) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/shared/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: number; nombre: string } | null }) => unknown) =>
    selector({ user: { id: 7, nombre: 'Persona Actual' } }),
}));
vi.mock('../../components/PuntoMapaPicker', () => ({
  PuntoMapaPicker: ({ onChange }: { onChange: (p: { nombre: string; latitud: number; longitud: number; municipio?: string; estado?: string }) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ nombre: 'Punto de prueba', latitud: 19.5, longitud: -99.5, municipio: 'Toluca', estado: 'México' })}
    >
      Fijar punto de prueba
    </button>
  ),
}));
vi.mock('../../components/MapaPunto', () => ({
  MapaPunto: ({ punto }: { punto: { nombre: string; latitud: number; longitud: number } | null }) => (
    <div>{punto ? `MAPA:${punto.nombre},${punto.latitud},${punto.longitud}` : 'MAPA_VACIO'}</div>
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
vi.mock('../../components/DateTimePicker', () => ({
  DateTimePicker: ({ id, fecha, hora, onFecha, onHora }: {
    id: string; fecha: string; hora: string; onFecha: (v: string) => void; onHora: (v: string) => void;
  }) => (
    <>
      <input aria-label={`${id}-fecha`} value={fecha} onChange={(e) => onFecha(e.target.value)} />
      <input aria-label={`${id}-hora`} value={hora} onChange={(e) => onHora(e.target.value)} />
    </>
  ),
}));
vi.mock('../../components/TablaHoteles', () => ({ TablaHoteles: () => <div>HOTELES_MARK</div> }));
vi.mock('../../test/fixtures/solicitudV2.fixture', () => ({
  VIATICOS_FIXTURES_ACTIVOS: false,
  IndicadorDatosPrueba: () => null,
  rellenarConFixture: () => { throw new Error('no fixtures in test'); },
}));

const empleados = [{ idUsuario: 9, nombreCompleto: 'Otra Persona', correo: 'otra@test' }];

const siguiente = () => screen.getByRole('button', { name: 'Siguiente' });

/** Fechas dinámicas: los pickers bloquean días pasados, así que siempre van al futuro. */
function enDias(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
const FECHA_DESTINO = enDias(30);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.usuarios.mockResolvedValue({ data: { success: true, data: empleados } });
  mocks.gerenciaSugerida.mockResolvedValue({ data: { success: true, data: { gerencia: 'IMSS' } } });
  mocks.crear.mockResolvedValue({ data: { success: true, data: { id_solicitud: 42 } } });
  mocks.guardar.mockResolvedValue({ data: { success: true, data: { id_solicitud: 42 } } });
});

async function irAlPaso(ndestino: 3 | 4 | 5, modo: 'propio' | 'solicitado' = 'solicitado') {
  const usuario = userEvent.setup();
  render(<SolicitudPage />);
  // Paso 1 (persona) ya viene resuelto con la identidad de sesión.
  await waitFor(() => expect(siguiente()).not.toBeDisabled());
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-2')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Motivo del viaje'), { target: { value: 'Visita de zona' } });
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-3')).toBeInTheDocument();
  if (ndestino === 3) return;
  // Las tabs de Radix necesitan foco real: userEvent, no fireEvent.
  await usuario.click(screen.getByRole('radio', { name: modo === 'propio' ? 'Carro propio' : 'Solicitar transporte' }));
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-4')).toBeInTheDocument();
  if (ndestino === 4) return;
  // El origen se fija desde el buscador de dirección (única vía).
  fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
  fireEvent.change(screen.getByLabelText('origen-fechahora-fecha'), { target: { value: FECHA_DESTINO } });
  fireEvent.change(screen.getByLabelText('origen-fechahora-hora'), { target: { value: '06:00' } });
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-5')).toBeInTheDocument();
}

function completarDestino() {
  fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
  fireEvent.change(screen.getByLabelText(/-debe-fecha$/), { target: { value: FECHA_DESTINO } });
  fireEvent.change(screen.getByLabelText(/-debe-hora$/), { target: { value: '12:00' } });
  fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: FECHA_DESTINO } });
  fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '18:00' } });
}

/** Destinos → Regreso (al origen por defecto) → Viáticos, donde se cotiza. */
async function irAViaticos() {
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-6')).toBeInTheDocument();
  fireEvent.click(siguiente());
  expect(await screen.findByTestId('paso-7')).toBeInTheDocument();
}

describe('SolicitudPage', () => {
  it('respeta el orden persona → motivo → transporte y pide empleado para alguien más', async () => {
    const usuario = userEvent.setup();
    render(<SolicitudPage />);
    // "Para mí" ya trae la identidad de sesión: el paso 1 avanza solo.
    await waitFor(() => expect(siguiente()).not.toBeDisabled());
    await usuario.click(screen.getByRole('radio', { name: 'Para alguien más' }));
    expect(siguiente()).toBeDisabled();
    expect(screen.getByLabelText('Buscar y seleccionar empleado')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Buscar y seleccionar empleado')).not.toBeDisabled());
    await waitFor(() => expect(screen.getByRole('option', { name: 'Otra Persona' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Buscar y seleccionar empleado'), '9');
    expect(screen.getByText(/Persona que solicita el viaje:/).parentElement).toHaveTextContent('Otra Persona');
    expect(siguiente()).not.toBeDisabled();
    // El motivo es su propio paso y no deja avanzar sin capturarse.
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-2')).toBeInTheDocument();
    // La identidad de quien solicita sigue visible arriba del wizard.
    expect(screen.getByText(/Persona que solicita el viaje:/).parentElement).toHaveTextContent('Otra Persona');
    expect(siguiente()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo del viaje'), { target: { value: 'Cobertura' } });
    expect(siguiente()).not.toBeDisabled();
  });

  it('el paso 1 avanza sin gerencia: solo agrupa el concentrado', async () => {
    mocks.gerenciaSugerida.mockResolvedValue({ data: { success: true, data: { gerencia: '' } } });
    render(<SolicitudPage />);
    await waitFor(() => expect(siguiente()).not.toBeDisabled());
    expect(screen.getByLabelText('Gerencia')).toHaveValue('');
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-2')).toBeInTheDocument();
  });

  it('carro propio: el resumen muestra solo "Carro propio" y guarda el borrador', async () => {
    await irAlPaso(5, 'propio');
    completarDestino();
    await irAViaticos();
    expect(mocks.crear).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Resumen del viaje' })).toBeInTheDocument();
    expect(screen.getByText('Carro propio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    const payload = mocks.crear.mock.calls[0][0];
    expect(payload.datos.version).toBe('solicitud-v2');
    expect(payload.datos.destinos).toHaveLength(1);
    // La gerencia precargada del usuario viaja en el body: es la llave del
    // concentrado por institución.
    expect(payload.gerencia).toBe('IMSS');
    // Guardar borrador NO envía la cotización.
    expect(mocks.guardar).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/viaticos/mis-viajes'));
  });

  it('transporte solicitado: el resumen lo nombra "Solicitud de transporte" y guarda el borrador', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    expect(siguiente()).not.toBeDisabled();
    await irAViaticos();
    expect(screen.getByText('Solicitud de transporte')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/viaticos/mis-viajes'));
  });

  it('la salida del destino es opcional', async () => {
    await irAlPaso(5, 'solicitado');
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    fireEvent.change(screen.getByLabelText(/-debe-fecha$/), { target: { value: FECHA_DESTINO } });
    fireEvent.change(screen.getByLabelText(/-debe-hora$/), { target: { value: '12:00' } });
    expect(screen.getByText('Hora de salida del destino (opcional)')).toBeInTheDocument();
    expect(siguiente()).not.toBeDisabled();
  });

  it('la llegada no puede ser antes de la salida del origen ni la salida antes de la llegada', async () => {
    await irAlPaso(5, 'solicitado');
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    fireEvent.change(screen.getByLabelText(/-sale-fecha$/), { target: { value: FECHA_DESTINO } });
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '18:00' } });
    // Llegada ANTES de la salida del origen (origen: FECHA_DESTINO 06:00).
    fireEvent.change(screen.getByLabelText(/-debe-fecha$/), { target: { value: enDias(29) } });
    fireEvent.change(screen.getByLabelText(/-debe-hora$/), { target: { value: '12:00' } });
    expect(screen.getByText('La llegada no puede ser antes de la salida del origen.')).toBeInTheDocument();
    expect(siguiente()).toBeDisabled();
    // Corregida la llegada; ahora la salida quedaría antes de la llegada.
    fireEvent.change(screen.getByLabelText(/-debe-fecha$/), { target: { value: FECHA_DESTINO } });
    fireEvent.change(screen.getByLabelText(/-debe-hora$/), { target: { value: '20:00' } });
    expect(screen.getByText('La salida no puede ser antes de la llegada al destino.')).toBeInTheDocument();
    expect(siguiente()).toBeDisabled();
    // Todo en orden: el destino habilita el avance.
    fireEvent.change(screen.getByLabelText(/-sale-hora$/), { target: { value: '22:00' } });
    expect(siguiente()).not.toBeDisabled();
  });

  it('el resumen guarda el borrador y navega a Mis viajes', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    await irAViaticos();
    expect(screen.getByRole('heading', { name: 'Resumen del viaje' })).toBeInTheDocument();
    expect(screen.queryByTestId('paso-8')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.crear).toHaveBeenCalledTimes(1));
    expect(mocks.crear.mock.calls[0][0].datos.version).toBe('solicitud-v2');
    expect(mocks.guardar).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/viaticos/mis-viajes'));
  });

  it('el regreso permite origen u otro punto sin pedir fecha', async () => {
    const usuario = userEvent.setup();
    await irAlPaso(5, 'solicitado');
    completarDestino();
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-6')).toBeInTheDocument();
    // Por defecto vuelve al mismo punto de origen: ya avanza sin fecha.
    expect(siguiente()).not.toBeDisabled();
    // La otra opción arranca con el punto de origen y se puede ajustar en el mapa.
    await usuario.click(screen.getByRole('radio', { name: 'Seleccionar un punto de regreso en el mapa' }));
    expect(siguiente()).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    expect(siguiente()).not.toBeDisabled();
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-7')).toBeInTheDocument();
    expect(screen.getByTestId('resumen-regreso')).toHaveTextContent('Toluca, México');
  });

  it('volver a un paso superado desde el stepper conserva lo capturado', async () => {
    await irAlPaso(4, 'solicitado');
    // Desde Origen (4) se puede pulsar el punto 2 para corregir el motivo.
    fireEvent.click(screen.getByRole('button', { name: 'Volver al paso 2: Motivo' }));
    expect(await screen.findByTestId('paso-2')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo del viaje')).toHaveValue('Visita de zona');
    fireEvent.change(screen.getByLabelText('Motivo del viaje'), { target: { value: 'Visita de zona corregida' } });
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-3')).toBeInTheDocument();
    // El modo de transporte elegido antes sigue intacto.
    expect(screen.getByRole('radio', { name: 'Solicitar transporte' })).toHaveAttribute('aria-checked', 'true');
    // Volver hasta el 1 no borra lo visitado: se puede saltar al 4 de un clic.
    fireEvent.click(screen.getByRole('button', { name: 'Volver al paso 1: Persona' }));
    expect(await screen.findByTestId('paso-1')).toBeInTheDocument();
    expect(screen.getByTestId('indicador-paso-3')).toHaveTextContent(/completado/i);
    // El 4 es donde te quedaste: número punteado, no palomita.
    expect(screen.getByTestId('indicador-paso-4')).toHaveTextContent(/donde te quedaste/i);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al paso 4: Origen' }));
    expect(await screen.findByTestId('paso-4')).toBeInTheDocument();
  });

  it('la tab del destino muestra municipio y estado cuando se conocen', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    expect(screen.getByRole('tab', { name: /^1\. Toluca, México/ })).toBeInTheDocument();
  });

  it('doble clic en la pestaña del destino permite renombrarla', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    const tab = screen.getByRole('tab', { name: /^1\. Toluca, México/ });
    fireEvent.doubleClick(tab);
    const input = screen.getByLabelText('Nombre de la pestaña del destino 1');
    expect(input).toHaveValue('Toluca, México');
    fireEvent.change(input, { target: { value: 'Casa de mi mamá' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: /^1\. Casa de mi mamá/ })).toBeInTheDocument();
    // La cabecera del destino usa el mismo nombre propio.
    expect(screen.getByText(/Destino 1: Casa de mi mamá/)).toBeInTheDocument();
  });

  it('la pestaña del segundo destino también muestra el punto al fijarlo', async () => {
    await irAlPaso(5, 'solicitado');
    completarDestino();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro destino' }));
    expect(screen.getByRole('tab', { name: /^2\. Sin destino/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    expect(screen.getByRole('tab', { name: /^2\. Toluca, México/ })).toBeInTheDocument();
  });

  it('el origen avanza solo con el punto: la fecha de salida es opcional', async () => {
    const usuario = userEvent.setup();
    await irAlPaso(4, 'solicitado');
    // Sin punto no avanza y el botón explica qué falta.
    expect(siguiente()).toBeDisabled();
    await usuario.hover(siguiente().parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Marca el punto de salida en el mapa.');
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    // Con el punto basta: fecha y hora de salida se quedan vacías.
    expect(siguiente()).not.toBeDisabled();
    fireEvent.click(siguiente());
    expect(await screen.findByTestId('paso-5')).toBeInTheDocument();
  });

  it('el buscador de dirección queda en el panel y el mapa compartido debajo', async () => {
    await irAlPaso(4, 'solicitado');
    // La búsqueda de dirección queda en el panel; el mapa compartido sigue debajo.
    expect(screen.getByRole('button', { name: 'Fijar punto de prueba' })).toBeInTheDocument();
    expect(screen.getByText('MAPA_VACIO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fijar punto de prueba' }));
    expect(screen.getByText('MAPA:Punto de prueba,19.5,-99.5')).toBeInTheDocument();
  });
});
