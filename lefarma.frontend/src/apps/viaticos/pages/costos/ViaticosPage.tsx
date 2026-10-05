import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { costosRutaApi } from '@/apps/viaticos/services/costosRuta.api';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { CostosRutaRequest, CostosRutaResponse } from '@/apps/viaticos/types/costosRuta.types';
import type { HospitalUbicacion, UsuarioCatalogo } from '@/apps/educacion-medica/types/educacionMedica.types';
import { Loader2, Printer } from 'lucide-react';
import { API } from '@/shared/api/apiClient';
import { useAuthStore } from '@/shared/auth/authStore';
import { waitForPrintImages } from '@/utils/waitForPrintImages';
import type { ApiResponse } from '@/types/api.types';
import type { Sucursal } from '@/types/catalogo.types';
import { CatalogoSearchSelect } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import { PuntoMapaPicker } from '../../components/PuntoMapaPicker';
import { buildRouteRequest, localTomorrow, newPerson } from './costosRutaForm';
import type { DestinationForm, PersonForm } from './costosRutaForm';
import { aplicarEjemplo, VIAJES_EJEMPLO } from './costosRutaEjemplos';
import type { ViajeEjemplo } from './costosRutaEjemplos';
import { CostosSolicitudPrint, CostosViaticosPrint } from './CostosViaticosPrint';
import { selectedProposal } from './costosViaticosData';

function suspiciousCoordinates(lat: number, lon: number) {
  return lat < 14 || lat > 33 || lon < -119 || lon > -86;
}
function CoordinatePreview({ latitude, longitude }: { latitude: number | null | undefined; longitude: number | null | undefined }) {
  if (latitude === undefined || longitude === undefined) return null;
  return <p className="text-xs">Coordenadas del catálogo: {latitude ?? 'sin dato'}, {longitude ?? 'sin dato'}.
    {latitude !== null && longitude !== null && suspiciousCoordinates(latitude, longitude)
      ? ' Advertencia: fuera de México (referencia aproximada); verificar el catálogo. No confirma viabilidad geográfica real.' : ''}</p>;
}

function mxn(n: number): string {
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;
}

export function ViaticosPage() {
  usePageTitle('Viáticos');
  const [people, setPeople] = useState<PersonForm[]>(() => [newPerson(1)]);
  const nextPersonId = useRef(2);
  const nextDestinationId = useRef(2);
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [hospitals, setHospitals] = useState<HospitalUbicacion[]>([]);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const [hospitalError, setHospitalError] = useState('');
  const [empleados, setEmpleados] = useState<UsuarioCatalogo[]>([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [empleadosError, setEmpleadosError] = useState('');
  const [empleadosCargados, setEmpleadosCargados] = useState(false);
  const [respetarHorario, setRespetarHorario] = useState(true);
  const [calcularHoteles, setCalcularHoteles] = useState(true);
  const [calcularIntermedios, setCalcularIntermedios] = useState(true);
  const [compartir, setCompartir] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<{ request: CostosRutaRequest; response: CostosRutaResponse; example: ViajeEjemplo | null; coordinateWarning: boolean } | null>(null);
  const data = snapshot?.response ?? null;
  const [example, setExample] = useState<ViajeEjemplo | null>(null);
  const [printSelection, setPrintSelection] = useState<Record<string, string>>({});
  const [printPerson, setPrintPerson] = useState('');
  const [reportMode, setReportMode] = useState<'concentrado' | 'solicitud'>('concentrado');
  const [showPreview, setShowPreview] = useState(false);
  const mounted = useRef(true);
  const [imprimiendo, setImprimiendo] = useState(false);
  const nombreSolicitante = useAuthStore(state => state.user?.nombre);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; document.body.classList.remove('costos-print-active'); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const response = await API.get<ApiResponse<Sucursal[]>>('/catalogos/Sucursales');
        if (cancelled) return;
        if (!response.data.success) {
          setCatalogError(response.data.message || 'No se pudieron cargar las sucursales.');
          return;
        }
        setBranches((response.data.data || []).filter(branch => branch.activo));
      } catch (error: unknown) {
        if (!cancelled) setCatalogError(toApiError(error).message || 'No se pudieron cargar las sucursales.');
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadHospitals() {
      try {
        const response = await educacionMedicaApi.hospitales.getUbicaciones({ activo: true, tieneCoordenadas: true });
        if (cancelled) return;
        if (!response.data.success) {
          setHospitalError(response.data.message || 'No se pudieron cargar los hospitales.');
          return;
        }
        setHospitals(response.data.data || []);
      } catch (error: unknown) {
        if (!cancelled) setHospitalError(toApiError(error).message || 'No se pudieron cargar los hospitales.');
      } finally {
        if (!cancelled) setHospitalLoading(false);
      }
    }
    void loadHospitals();
    return () => { cancelled = true; };
  }, []);

  // "Para mí" toma el nombre de la sesión cuando exista y aún no se haya capturado otro.
  useEffect(() => {
    if (!nombreSolicitante) return;
    setPeople(current => current.map(person =>
      person.modoNombre === 'mi' && !person.name ? { ...person, name: nombreSolicitante } : person
    ));
  }, [nombreSolicitante]);

  const necesitaEmpleados = people.some(person => person.modoNombre === 'otro');
  useEffect(() => {
    if (!necesitaEmpleados || empleadosCargados) return;
    let cancelled = false;
    setEmpleadosLoading(true);
    void (async () => {
      try {
        const response = await educacionMedicaApi.usuarios.getAll();
        if (cancelled) return;
        if (!response.data.success) {
          setEmpleadosError(response.data.message || 'No se pudieron cargar los empleados.');
          return;
        }
        setEmpleados(response.data.data || []);
        setEmpleadosCargados(true);
      } catch (error: unknown) {
        if (!cancelled) setEmpleadosError(toApiError(error).message || 'No se pudieron cargar los empleados.');
      } finally {
        if (!cancelled) setEmpleadosLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [necesitaEmpleados, empleadosCargados]);

  const branchItems = branches.map(branch => ({ id: branch.idSucursal, label: branch.nombre, description: branch.ciudad }));
  const hospitalItems = hospitals.map(hospital => ({ id: hospital.codigoContacto, label: hospital.nombreContacto, description: hospital.ciudad ?? undefined }));
  const empleadoItems = empleados.map(empleado => ({ id: empleado.idUsuario, label: empleado.nombreCompleto, description: empleado.correo }));
  const { request, errors } = buildRouteRequest(people, branches, hospitals, {
    respetarHorarioLaboral: respetarHorario,
    calcularHoteles, calcularViajesIntermedios: calcularIntermedios, compartirViaje: compartir,
  });
  const catalogsReady = !catalogLoading && !catalogError && branches.length > 0
    && !hospitalLoading && !hospitalError && hospitals.length > 0;
  const blocked = !catalogsReady || !request;
  const stale = snapshot && JSON.stringify(request) !== JSON.stringify(snapshot.request);
  const selectedPrintPerson = printPerson || snapshot?.request.personas[0]?.nombre || '';
  const printNotice = `Solicitud capturada del último cálculo exitoso.${stale ? ' El formulario actual cambió; este documento conserva los datos calculados.' : ''}${snapshot?.coordinateWarning ? ' Coordenadas sospechosas; no confirma viabilidad geográfica real.' : ''}`;

  function updatePerson(id: number, change: Partial<PersonForm>) {
    setPeople(current => current.map(person => person.id === id ? { ...person, ...change } : person));
  }

  function updateDestination(person: PersonForm, destinationId: number, change: Partial<DestinationForm>) {
    updatePerson(person.id, { destinations: person.destinations.map(d => d.id === destinationId ? { ...d, ...change } : d) });
  }

  function cambiarModoNombre(person: PersonForm, modo: PersonForm['modoNombre']) {
    if (modo === 'mi') {
      updatePerson(person.id, { modoNombre: 'mi', directorioId: null, name: nombreSolicitante ?? person.name });
    } else {
      updatePerson(person.id, { modoNombre: 'otro', directorioId: null, name: '' });
    }
  }

  function moveDestination(person: PersonForm, index: number, offset: number) {
    const destinations = [...person.destinations];
    [destinations[index], destinations[index + offset]] = [destinations[index + offset], destinations[index]];
    updatePerson(person.id, { destinations });
  }

  function cargarEjemplo(id: string) {
    const viaje = VIAJES_EJEMPLO.find(item => item.id === id);
    if (!viaje) return;
    const personId = nextPersonId.current++;
    const primeroDestinoId = nextDestinationId.current;
    nextDestinationId.current += Math.max(1, viaje.destinos.length);
    const { person, hospitalesNoEncontrados } = aplicarEjemplo(viaje, branches, hospitals, { personId, primeroDestinoId, originId: people[0]?.originId });
    setPeople([person]);
    setExample(viaje);
    if (hospitalesNoEncontrados.length > 0) {
      toast.warning(`Sin hospital en el catálogo para: ${hospitalesNoEncontrados.join(', ')}. Selecciónalos manualmente.`);
    }
  }

  async function calcular() {
    if (blocked || !request || loading) return;
    setLoading(true);
    try {
      const res = await costosRutaApi.calcular(request);
      if (!res.data.success || !res.data.data) {
        toast.error(res.data.message ?? 'Error al calcular el itinerario');
        return;
      }
      setSnapshot({ request, response: res.data.data, example,
        coordinateWarning: request.personas.some(p => p.lugares.some(l => suspiciousCoordinates(l.latitud, l.longitud))) });
      setPrintSelection({});
      setPrintPerson(request.personas[0].nombre);
      toast.success('Cálculo recibido. Revisa el cumplimiento y las fuentes de cada propuesta.');
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al calcular el itinerario');
    } finally {
      setLoading(false);
    }
  }

  async function imprimirViaticos(mode: 'concentrado' | 'solicitud') {
    if (!data || imprimiendo) return;
    setImprimiendo(true);
    const quitar = () => document.body.classList.remove('costos-print-active');
    try {
      flushSync(() => setReportMode(mode));
      await waitForPrintImages('#costos-viaticos-print');
      if (!mounted.current) return;
      window.addEventListener('afterprint', quitar, { once: true });
      document.body.classList.add('costos-print-active');
      window.print();
    } catch {
      toast.error('No se pudo preparar la impresión. Intenta de nuevo.');
    } finally {
      quitar();
      window.removeEventListener('afterprint', quitar);
      if (mounted.current) setImprimiendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Costos de ruta (demo aislada · fase 1)</CardTitle>
          <CardDescription>
            Selecciona el origen y los hospitales de destino con el día de presencia por persona. Cada destino requiere
            por defecto toda su jornada laboral; puedes indicar una ventana de cita por destino. La salida explícita no se mueve;
            el cálculo reporta llegadas tardías o inviables. Rendimiento fijo: 12 km/L.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalogLoading && <p role="status">Cargando sucursales…</p>}
          {catalogError && <p role="alert">No se pudieron cargar las sucursales: {catalogError}</p>}
          {!catalogLoading && !catalogError && branches.length === 0 && <p role="alert">No hay sucursales activas disponibles.</p>}
          {hospitalLoading && <p role="status">Cargando hospitales…</p>}
          {hospitalError && <p role="alert">No se pudieron cargar los hospitales: {hospitalError}</p>}
          {!hospitalLoading && !hospitalError && hospitals.length === 0 && <p role="alert">No hay hospitales disponibles.</p>}
          <label className="space-y-1">Cargar ejemplo de viáticos
            <select className="h-9 w-full rounded-md border bg-background px-3" value=""
              disabled={!catalogsReady || loading}
              onChange={event => cargarEjemplo(event.target.value)}>
              <option value="">Selecciona un viaje del concentrado de octubre…</option>
              {VIAJES_EJEMPLO.map(viaje => <option key={viaje.id} value={viaje.id}>{viaje.etiqueta}</option>)}
            </select>
          </label>
          {example && <aside className="rounded border p-3 text-sm" aria-label="Referencia del ejemplo">
            <p>Rango original FOR-008: {example.inicio} al {example.fin} · {example.ciudades.join(' → ')}.</p>
            <p>Salida de terminal FOR-007: {example.salidaFecha} {example.salidaHora} ({example.transporte}). No es la salida del origen.
              {example.vueloHora ? ` Solicitud de vuelos: ${example.vueloHora}.` : ''}</p>
            <p>Horarios de presencia propuestos/editables: jornada completa. Las fuentes no documentan duración de citas; ajusta visitas que coinciden.</p>
            <p>Fuentes: {example.fuentes.join(' · ')}</p>
            {example.conflictos.map(c => <p key={c}>Discrepancia documental: {c}</p>)}
          </aside>}
          {people.map((person, personIndex) => (
            <fieldset key={person.id} disabled={loading} className="space-y-3 rounded-md border p-4">
              <legend className="px-2 font-semibold">Persona {personIndex + 1}</legend>
              <div role="radiogroup" aria-label={`Captura de persona ${personIndex + 1}`} className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`modo-nombre-${person.id}`} checked={person.modoNombre === 'mi'} disabled={loading}
                    onChange={() => cambiarModoNombre(person, 'mi')} />
                  Para mí
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name={`modo-nombre-${person.id}`} checked={person.modoNombre === 'otro'} disabled={loading}
                    onChange={() => cambiarModoNombre(person, 'otro')} />
                  Para alguien más
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`nombre-persona-${person.id}`}>Nombre</Label>
                  <Input id={`nombre-persona-${person.id}`} value={person.name}
                    readOnly={person.modoNombre === 'mi' && !!nombreSolicitante}
                    onChange={e => updatePerson(person.id, { name: e.target.value })} />
                  {person.modoNombre === 'otro' ? (
                    <div className="space-y-1 pt-1">
                      <CatalogoSearchSelect items={empleadoItems} value={person.directorioId}
                        disabled={empleadosLoading || !!empleadosError || loading}
                        placeholder="Selecciona al empleado"
                        onChange={id => {
                          const empleado = empleados.find(item => item.idUsuario === id);
                          updatePerson(person.id, { directorioId: id, name: empleado?.nombreCompleto ?? '' });
                        }} />
                      {empleadosLoading ? <p role="status" className="text-xs">Cargando empleados…</p> : null}
                      {empleadosError ? <p role="alert" className="text-xs text-destructive">{empleadosError}</p> : null}
                    </div>
                  ) : null}
                </div>
                <label className="space-y-1">Entrada laboral
                  <Input type="time" value={person.start} onChange={e => updatePerson(person.id, { start: e.target.value })} />
                </label>
                <label className="space-y-1">Salida laboral
                  <Input type="time" value={person.end} onChange={e => updatePerson(person.id, { end: e.target.value })} />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={person.ownCar} onChange={e => updatePerson(person.id, { ownCar: e.target.checked })} />
                  Carro propio
                </label>
                <label className="space-y-1">Gasolina
                  <select className="h-9 w-full rounded-md border bg-background px-3" value={person.fuel}
                    onChange={e => updatePerson(person.id, { fuel: e.target.value as PersonForm['fuel'] })}>
                    <option value="magna">Magna</option><option value="premium">Premium</option>
                  </select>
                </label>
                <div role="group" aria-label={`Origen de persona ${personIndex + 1}`} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Origen</Label>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant={person.origenModo === 'catalogo' ? 'default' : 'outline'}
                        disabled={loading} onClick={() => updatePerson(person.id, { origenModo: 'catalogo', origenPunto: null })}>Catálogo</Button>
                      <Button type="button" size="sm" variant={person.origenModo === 'mapa' ? 'default' : 'outline'}
                        disabled={loading} onClick={() => updatePerson(person.id, { origenModo: 'mapa' })}>Punto en mapa</Button>
                    </div>
                  </div>
                  {person.origenModo === 'catalogo' ? (
                    <>
                      <CatalogoSearchSelect items={branchItems} value={person.originId} disabled={catalogLoading || !!catalogError || loading}
                        placeholder="Selecciona el origen" onChange={originId => updatePerson(person.id, { originId })} />
                      <CoordinatePreview latitude={branches.find(b => b.idSucursal === person.originId)?.latitud}
                        longitude={branches.find(b => b.idSucursal === person.originId)?.longitud} />
                    </>
                  ) : (
                    <PuntoMapaPicker value={person.origenPunto} disabled={loading}
                      onChange={origenPunto => updatePerson(person.id, { origenPunto })} />
                  )}
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-sm">Salida del origen (opcional)</summary>
                <p className="text-sm text-muted-foreground">Deja ambos campos vacíos para calcular una salida propuesta según el primer destino. Si indicas salida, se conserva exactamente, aunque no alcance la presencia solicitada. Una hora de avión/autobús en Excel es salida de terminal, no de casa.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>Fecha de salida del origen<Input type="date" value={person.departureDate}
                    onChange={e => updatePerson(person.id, { departureDate: e.target.value })} /></label>
                  <label>Hora de salida del origen<Input type="time" value={person.departureTime}
                    onChange={e => updatePerson(person.id, { departureTime: e.target.value })} /></label>
                </div>
              </details>
              {person.destinations.map((destination, index) => (
                <div key={destination.id} role="group" aria-label={`Destino ${index + 1} de persona ${personIndex + 1}`} className="space-y-2 rounded-md bg-muted/30 p-3">
                  <p className="font-medium">Destino {index + 1} · orden {index + 2}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Hospital de destino</Label>
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant={destination.destinoModo !== 'mapa' ? 'default' : 'outline'}
                            disabled={loading} onClick={() => updateDestination(person, destination.id, { destinoModo: 'catalogo', punto: null })}>Catálogo</Button>
                          <Button type="button" size="sm" variant={destination.destinoModo === 'mapa' ? 'default' : 'outline'}
                            disabled={loading} onClick={() => updateDestination(person, destination.id, { destinoModo: 'mapa' })}>Punto en mapa</Button>
                        </div>
                      </div>
                      {destination.destinoModo === 'mapa' ? (
                        <PuntoMapaPicker value={destination.punto ?? null} disabled={loading}
                          onChange={punto => updateDestination(person, destination.id, { punto })} />
                      ) : (
                        <>
                          <CatalogoSearchSelect items={hospitalItems} value={destination.hospitalId} disabled={!catalogsReady || loading}
                            placeholder="Selecciona el destino" onChange={hospitalId => updateDestination(person, destination.id, { hospitalId })} />
                          <CoordinatePreview latitude={hospitals.find(h => h.codigoContacto === destination.hospitalId)?.latitud}
                            longitude={hospitals.find(h => h.codigoContacto === destination.hospitalId)?.longitud} />
                          {destination.sourceHospital && <p className="text-xs">Hospital de referencia: {destination.sourceHospital} · {destination.sourceCity ?? 'ciudad por confirmar'}.
                            {destination.hospitalId === null ? ' Sin coincidencia única: confirma y selecciona manualmente en el catálogo.' : ''}</p>}
                        </>
                      )}
                    </div>
                    <label>Día de presencia<Input type="date" value={destination.date} onChange={e => updateDestination(person, destination.id, { date: e.target.value })} /></label>
                  </div>
                  <p className="text-sm">Presencia solicitada: {destination.date || 'sin fecha'}, {destination.start || person.start}–{destination.end || person.end}.
                    {destination.start || destination.end ? ' La ventana del destino tiene prioridad sobre la jornada.' : ' Jornada completa por defecto.'}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label>Inicio de presencia (opcional)<Input type="time" value={destination.start ?? ''} onChange={e => updatePerson(person.id, {
                      destinations: person.destinations.map(d => d.id === destination.id ? { ...d, start: e.target.value } : d),
                    })} /></label>
                    <label>Fin de presencia (opcional)<Input type="time" value={destination.end ?? ''} onChange={e => updatePerson(person.id, {
                      destinations: person.destinations.map(d => d.id === destination.id ? { ...d, end: e.target.value } : d),
                    })} /></label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label>Fecha de llegada al destino (opcional)<Input type="date" value={destination.llegadaFecha ?? ''}
                      onChange={e => updateDestination(person, destination.id, { llegadaFecha: e.target.value })} /></label>
                    <label>Hora de llegada al destino (opcional)<Input type="time" value={destination.llegadaHora ?? ''}
                      onChange={e => updateDestination(person, destination.id, { llegadaHora: e.target.value })} /></label>
                  </div>
                  <p className="text-xs text-muted-foreground">La llegada es opcional: si la dejas vacía, el cálculo la deriva. Si capturas una, indica fecha y hora.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={index === 0} onClick={() => moveDestination(person, index, -1)}>Subir destino</Button>
                    <Button variant="outline" size="sm" disabled={index === person.destinations.length - 1} onClick={() => moveDestination(person, index, 1)}>Bajar destino</Button>
                    <Button variant="outline" size="sm" onClick={() => updatePerson(person.id, {
                      destinations: person.destinations.filter(d => d.id !== destination.id),
                    })}>Eliminar destino</Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => updatePerson(person.id, {
                  destinations: [...person.destinations, { id: nextDestinationId.current++, hospitalId: null, date: localTomorrow() }],
                })}>Agregar destino</Button>
                <Button variant="outline" disabled={people.length >= 9} onClick={() => {
                  const clone = { ...person, id: nextPersonId.current++, name: person.modoNombre === 'mi' ? (nombreSolicitante ?? '') : '', destinations: person.destinations.map(d => ({ ...d })) };
                  setPeople(current => current.length < 9 ? [...current, clone] : current);
                }}>Duplicar itinerario para otra persona</Button>
                <Button variant="outline" disabled={people.length === 1} onClick={() => setPeople(current => current.filter(p => p.id !== person.id))}>Eliminar persona</Button>
              </div>
            </fieldset>
          ))}
          <Button variant="outline" disabled={people.length >= 9 || loading} onClick={() => {
            const person = newPerson(nextPersonId.current++);
            if (nombreSolicitante) person.name = nombreSolicitante;
            setPeople(current => current.length < 9 ? [...current, person] : current);
          }}>Agregar persona ({people.length}/9)</Button>
          {catalogsReady && errors.length > 0 && (
            <ul aria-label="Validación del itinerario" className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {errors.map(error => <li key={error}>{error}</li>)}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm">Ver solicitud JSON (solo lectura)</summary>
            <pre aria-label="Solicitud JSON" className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
              {request ? JSON.stringify(request, null, 2) : 'Completa y corrige el formulario para generar la solicitud.'}
            </pre>
          </details>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-horario"
                checked={respetarHorario}
                onCheckedChange={(v) => setRespetarHorario(v === true)}
              />
              <Label htmlFor="opt-horario">Respetar horario laboral</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-hoteles"
                checked={calcularHoteles}
                onCheckedChange={(v) => setCalcularHoteles(v === true)}
              />
              <Label htmlFor="opt-hoteles">Calcular hoteles</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-intermedios"
                checked={calcularIntermedios}
                onCheckedChange={(v) => setCalcularIntermedios(v === true)}
              />
              <Label htmlFor="opt-intermedios">Calcular viajes intermedios</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="opt-compartir" checked={compartir} onCheckedChange={setCompartir} />
              <Label htmlFor="opt-compartir">Compartir viaje</Label>
            </div>
            <Button onClick={calcular} disabled={loading || blocked}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calcular precios y proponer itinerario
            </Button>
            <Button variant="outline" onClick={() => imprimirViaticos('concentrado')} disabled={!data || imprimiendo}>
              {imprimiendo
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Printer className="mr-2 h-4 w-4" />}
              Imprimir concentrado de viáticos
            </Button>
            <Button variant="outline" onClick={() => imprimirViaticos('solicitud')} disabled={!data || imprimiendo || !selectedPrintPerson}>
              Imprimir solicitud individual
            </Button>
          </div>
          {snapshot && <section className="space-y-2" aria-label="Selección de impresión">
            {stale && <p role="status">El formulario cambió. Resultados e impresión usan la solicitud capturada del último cálculo exitoso, no los campos actuales.</p>}
            {snapshot.coordinateWarning && <p>Coordenadas sospechosas en la solicitud capturada: no confirma viabilidad geográfica real.</p>}
            {snapshot.request.personas.map(person => <label className="block" key={person.nombre}>Propuesta a imprimir · {person.nombre}
              <select className="ml-2 rounded border" value={selectedProposal(snapshot.response, person.nombre, printSelection)?.clave ?? ''}
                onChange={e => setPrintSelection(current => ({ ...current, [person.nombre]: e.target.value }))}>
                {snapshot.response.propuestas.filter(p => p.persona === person.nombre).map(p => <option key={p.clave} value={p.clave}>
                  {p.titulo} · {p.cumpleTodos ? 'cumple' : 'NO VIABLE'}
                </option>)}
              </select>
            </label>)}
            <label>Persona para solicitud individual<select className="ml-2 rounded border" value={selectedPrintPerson} onChange={e => setPrintPerson(e.target.value)}>
              {snapshot.request.personas.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </select></label>
            <label className="ml-3">Vista previa de formato<select className="ml-2 rounded border" value={reportMode}
              onChange={e => setReportMode(e.target.value as 'concentrado' | 'solicitud')}>
              <option value="concentrado">Concentrado FOR-008</option><option value="solicitud">Solicitud FOR-007</option>
            </select></label>
            <Button variant="outline" onClick={() => setShowPreview(v => !v)}>{showPreview ? 'Ocultar vista previa' : 'Ver vista previa de impresión'}</Button>
          </section>}
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Propuestas ({data.propuestas.length})</CardTitle>
              <CardDescription>Costo, horarios, margen y cumplimiento por propuesta.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.propuestas.map((p) => (
                <Card key={`${p.persona}-${p.clave}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.titulo}</CardTitle>
                    <CardDescription>
                      {p.persona} · sale {p.salidaOrigen} → llega {p.llegadaFinal} · margen{' '}
                      {p.margenMinimoMinutos} min
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{mxn(p.costoTotalMxn)}</span>
                      <Badge variant={p.cumpleTodos ? 'default' : 'destructive'}>
                        {p.cumpleTodos ? 'cumple' : 'no cumple'}
                      </Badge>
                    </div>
                    {p.incumplimientos.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {p.incumplimientos.map((inc, ix) => (
                          <li key={ix}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Fuentes: {p.fuentes.join(' · ') || '—'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {data.resultados.map((r) => (
            <Card key={r.nombre}>
              <CardHeader>
                <CardTitle>Ruta armada · {r.nombre}</CardTitle>
                <CardDescription>Magna vs premium (12 km/L fijos) + totales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tramo</TableHead>
                      <TableHead className="text-right">Km</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="text-right">Magna</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Casetas</TableHead>
                      <TableHead className="text-right">Subt. magna</TableHead>
                      <TableHead className="text-right">Subt. premium</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.rutaArmada.tramos.map((t, ix) => (
                      <TableRow key={ix}>
                        <TableCell>
                          {t.de} → {t.a}
                        </TableCell>
                        <TableCell className="text-right">{t.km}</TableCell>
                        <TableCell className="text-right">{t.litros}</TableCell>
                        <TableCell className="text-right">
                          ${t.gasolina.magna.precioL}/L · {mxn(t.gasolina.magna.costo)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${t.gasolina.premium.precioL}/L · {mxn(t.gasolina.premium.costo)}
                        </TableCell>
                        <TableCell className="text-right">{mxn(t.casetas.costo)}</TableCell>
                        <TableCell className="text-right">{mxn(t.subtotalMagna)}</TableCell>
                        <TableCell className="text-right">{mxn(t.subtotalPremium)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">Totales</TableCell>
                      <TableCell className="text-right font-semibold">{r.rutaArmada.totales.km}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {r.rutaArmada.totales.litros}
                      </TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.casetas)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.subtotalMagna)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.subtotalPremium)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {r.tramos.map((t, ix) => (
                  <div key={ix} className="space-y-1 text-sm">
                    <div className="font-medium">
                      Tramo {ix + 1}: {t.from} → {t.to} ({t.km} km)
                    </div>
                    <ul className="space-y-1">
                      {t.opciones.slice(0, 8).map((o, ix) => (
                        <li key={`${o.id}-${ix}`} className="flex flex-wrap items-center gap-2">
                          <span>
                            {o.linea} · {o.salidaTxt} → {o.llegadaTxt} · {o.precioTxt}
                          </span>
                          {o.badge && <Badge variant="outline">{o.badge}</Badge>}
                          {!o.aTiempo && <Badge variant="destructive">tarde</Badge>}
                          <a
                            href={o.comprar.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            {o.comprar.accion} ↗
                          </a>
                          <span className="text-xs text-muted-foreground">({o.fuente})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {r.hotelesPropuestos.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">Hoteles propuestos</div>
                    <ul className="space-y-1">
                      {r.hotelesPropuestos.map((h, ix) => (
                        <li key={ix}>
                          {h.lugar} · {h.ciudad} · {h.checkIn} → {h.checkOut} · {h.motivo} ·{' '}
                          <a href={h.link} target="_blank" rel="noreferrer" className="text-primary underline">
                            reservar ↗
                          </a>{' '}
                          <span className="text-xs text-muted-foreground">({h.fuente})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {data.compartidos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Viajes compartidos</CardTitle>
                <CardDescription>Ahorro estimado por persona.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {data.compartidos.map((c, ix) => (
                    <li key={ix}>
                      {c.de} → {c.a} · {c.personas.join(', ')}
                      {c.conductor ? ` · maneja ${c.conductor}` : ''} · ahorro {mxn(c.ahorroEstimadoMxn)} ·{' '}
                      {c.nota}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {createPortal(
        <div id="costos-viaticos-print" className={showPreview ? 'costos-print-preview' : ''}>
          {reportMode === 'concentrado' ? <CostosViaticosPrint
            respuesta={data}
            solicitud={snapshot?.request ?? null}
            nombreSolicitante={nombreSolicitante}
            seleccion={printSelection}
            ejemplo={snapshot?.example}
            aviso={printNotice}
          /> : <CostosSolicitudPrint respuesta={data} solicitud={snapshot?.request ?? null}
            seleccion={printSelection} persona={selectedPrintPerson} ejemplo={snapshot?.example} aviso={printNotice} />}
        </div>,
        document.body
      )}
    </div>
  );
}
