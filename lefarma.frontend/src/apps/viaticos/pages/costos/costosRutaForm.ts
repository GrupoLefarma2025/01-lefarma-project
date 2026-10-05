import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import type { CostosRutaLugarInput, CostosRutaOpciones, CostosRutaRequest, PuntoSeleccion } from '../../types/costosRuta.types';

export interface DestinationForm {
  id: number;
  hospitalId: number | null;
  /** Punto manual en mapa; si existe, tiene prioridad sobre `hospitalId`. */
  punto?: PuntoSeleccion | null;
  /** Modo de captura del destino: catálogo de hospitales o punto en mapa. */
  destinoModo?: 'catalogo' | 'mapa';
  date: string;
  start?: string;
  end?: string;
  /** Llegada opcional al destino; si se omite, el backend la deriva. */
  llegadaFecha?: string;
  llegadaHora?: string;
  sourceHospital?: string;
  sourceCity?: string | null;
}

export interface PersonForm {
  id: number;
  name: string;
  /** `mi` = captura para el usuario en sesión; `otro` = empleado elegido del directorio. */
  modoNombre: 'mi' | 'otro';
  /** Empleado seleccionado cuando `modoNombre` es `otro` (solo UI). */
  directorioId: number | null;
  ownCar: boolean;
  fuel: 'magna' | 'premium';
  start: string;
  end: string;
  originId: number | null;
  /** Origen manual en mapa; si existe, tiene prioridad sobre `originId`. */
  origenPunto: PuntoSeleccion | null;
  /** Modo de captura del origen: catálogo de sucursales o punto en mapa. */
  origenModo: 'catalogo' | 'mapa';
  departureDate: string;
  departureTime: string;
  destinations: DestinationForm[];
}

export function localTomorrow(now = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
}

export function newPerson(id: number): PersonForm {
  return {
    id, name: '', modoNombre: 'mi', directorioId: null,
    ownCar: false, fuel: 'magna', start: '08:00', end: '18:30',
    originId: null, origenPunto: null, origenModo: 'catalogo',
    departureDate: '', departureTime: '',
    destinations: [{ id: 1, hospitalId: null, punto: null, destinoModo: 'catalogo', date: localTomorrow() }],
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8));
}

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function buildRouteRequest(people: PersonForm[], branches: Sucursal[], hospitals: HospitalUbicacion[], options: CostosRutaOpciones): {
  request: CostosRutaRequest | null;
  errors: string[];
} {
  const errors: string[] = [];
  const names = new Set<string>();
  const branchesById = new Map(branches.filter(b => b.activo).map(b => [b.idSucursal, b]));
  const hospitalsById = new Map(hospitals.map(h => [h.codigoContacto, h]));
  if (people.length < 1 || people.length > 9) errors.push('Selecciona entre 1 y 9 personas.');
  function placeBranch(branchId: number | null, order: number, context: string): CostosRutaLugarInput | null {
    const branch = branchId === null ? undefined : branchesById.get(branchId);
    if (!branch) {
      errors.push(`${context}: selecciona una sucursal activa.`);
      return null;
    }
    if (!Number.isFinite(branch.latitud) || !Number.isFinite(branch.longitud)
      || Math.abs(branch.latitud) > 90 || Math.abs(branch.longitud) > 180
      || (branch.latitud === 0 && branch.longitud === 0)) {
      errors.push(`${context}: «${branch.nombre}» no tiene coordenadas válidas. Corrige el catálogo antes de calcular.`);
      return null;
    }
    return { orden: order, tipo: 'salida', nombre: branch.nombre, latitud: branch.latitud, longitud: branch.longitud };
  }
  function placeHospital(hospitalId: number | null, order: number, context: string): CostosRutaLugarInput | null {
    const hospital = hospitalId === null ? undefined : hospitalsById.get(hospitalId);
    if (!hospital) {
      errors.push(`${context}: selecciona un hospital del catálogo.`);
      return null;
    }
    if (hospital.latitud === null || hospital.longitud === null
      || !Number.isFinite(hospital.latitud) || !Number.isFinite(hospital.longitud)
      || Math.abs(hospital.latitud) > 90 || Math.abs(hospital.longitud) > 180
      || (hospital.latitud === 0 && hospital.longitud === 0)) {
      errors.push(`${context}: «${hospital.nombreContacto}» no tiene coordenadas válidas. Corrige el catálogo antes de calcular.`);
      return null;
    }
    return { orden: order, tipo: 'taller', nombre: hospital.nombreContacto, latitud: hospital.latitud, longitud: hospital.longitud };
  }
  function placePunto(punto: PuntoSeleccion | null | undefined, order: number, tipo: CostosRutaLugarInput['tipo'], context: string): CostosRutaLugarInput | null {
    if (!punto) return null;
    const nombre = punto.nombre.trim();
    if (!nombre) {
      errors.push(`${context}: el punto del mapa necesita un nombre.`);
      return null;
    }
    if (!Number.isFinite(punto.latitud) || !Number.isFinite(punto.longitud)
      || Math.abs(punto.latitud) > 90 || Math.abs(punto.longitud) > 180
      || (punto.latitud === 0 && punto.longitud === 0)) {
      errors.push(`${context}: el punto «${nombre}» no tiene coordenadas válidas. Vuelve a colocarlo en el mapa.`);
      return null;
    }
    return { orden: order, tipo, nombre, latitud: punto.latitud, longitud: punto.longitud };
  }
  const personas = people.map((person, index) => {
    const tag = `Persona ${index + 1}${person.name.trim() ? ` (${person.name.trim()})` : ''}`;
    if (!person.name.trim()) errors.push(`${tag}: escribe el nombre.`);
    const identity = person.name.trim().toLocaleLowerCase();
    if (identity && names.has(identity)) errors.push(`${tag}: usa un nombre único para identificar sus propuestas.`);
    names.add(identity);
    if (!validTime(person.start) || !validTime(person.end) || person.start >= person.end)
      errors.push(`${tag}: la entrada debe ser anterior a la salida laboral (HH:mm).`);
    const origin = person.origenPunto
      ? placePunto(person.origenPunto, 1, 'salida', `${tag}, origen`)
      : placeBranch(person.originId, 1, `${tag}, origen`);
    const lugares: CostosRutaLugarInput[] = origin ? [origin] : [];
    if (person.departureDate || person.departureTime) {
      if (!validDate(person.departureDate) || !validTime(person.departureTime))
        errors.push(`${tag}: indica fecha y hora de salida, o deja ambas vacías para calcularlas.`);
      if (origin) {
        origin.fecha_salida = person.departureDate;
        origin.hora_salida = person.departureTime;
      }
    }
    if (person.destinations.length === 0) errors.push(`${tag}: agrega al menos un destino.`);
    person.destinations.forEach((destination, destinationIndex) => {
      const context = `${tag}, destino ${destinationIndex + 1}`;
      const selected = destination.punto
        ? placePunto(destination.punto, destinationIndex + 2, 'taller', context)
        : placeHospital(destination.hospitalId, destinationIndex + 2, context);
      if (!validDate(destination.date)) errors.push(`${context}: selecciona una fecha válida.`);
      else if (options.respetarHorarioLaboral && [0, 6].includes(new Date(`${destination.date}T12:00:00`).getDay()))
        errors.push(`${context}: ${destination.date} no es un día laboral (lunes a viernes). Ajusta la fecha o la opción de horario.`);
      const start = destination.start || person.start;
      const end = destination.end || person.end;
      if (!validTime(start) || !validTime(end) || start >= end)
        errors.push(`${context}: el inicio de presencia debe ser anterior al fin (HH:mm).`);
      const previous = person.destinations[destinationIndex - 1];
      if (previous && `${destination.date}T${start}` < `${previous.date}T${previous.end || person.end}`)
        errors.push(`${context}: las ventanas de presencia se superponen o están en orden inverso. Ajusta los horarios; no se moverán las fechas automáticamente.`);
      if (destination.llegadaFecha || destination.llegadaHora) {
        if (!validDate(destination.llegadaFecha ?? '') || !validTime(destination.llegadaHora ?? ''))
          errors.push(`${context}: indica fecha y hora de llegada, o deja ambas vacías para calcularlas.`);
        else if (selected) {
          selected.fecha_llegada = destination.llegadaFecha;
          selected.hora_llegada = destination.llegadaHora;
        }
      }
      if (selected) lugares.push({
        ...selected,
        fecha_inicio_actividad: destination.date, hora_inicio_actividad: start,
        fecha_fin_actividad: destination.date, hora_fin_actividad: end,
      });
    });
    return {
      nombre: person.name.trim(), carro_propio: person.ownCar, gasolina: person.fuel, draft: false,
      trabajo: { hora_entrada: person.start, hora_salida: person.end, primer_dia_laboral: 1, ultimo_dia_laboral: 5 },
      lugares,
    };
  });
  return { request: errors.length ? null : { opciones: options, personas }, errors };
}
