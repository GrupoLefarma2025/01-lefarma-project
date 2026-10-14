import type { Sucursal } from '@/types/catalogo.types';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';
import type { PersonForm } from './costosRutaForm';

export interface ViajeEjemplo {
  id: string;
  etiqueta: string;
  persona: string;
  origenCiudad: string;
  inicio: string;
  fin: string;
  ciudades: string[];
  destinos: { ciudad: string | null; fecha: string; hospital: string }[];
  salidaFecha: string;
  salidaHora: string;
  transporte: 'bus' | 'avion';
  vueloHora?: string;
  fuentes: string[];
  conflictos: string[];
  referenciaHistorica: { autobus: number | null; avion: number | null; hospedaje: number | null; comida: number; taxi: number; total: number };
}

const iso = (day: number) => `2026-10-${String(day).padStart(2, '0')}`;
const people = ['CESAR MARTIN GARCIA ALONSO', 'JUAN PABLO PEÑA PORTILLO', 'SANTIAGO GARCIA GUTIERREZ',
  'ANGEL REMEDIOS CADENA BARRERA', 'ROBERTO CRUZ GUERERO'];
const books = ['CESAR GARCIA.XLSX', 'JUAN PABLO.XLSX', 'VIATICOS SANTIAGO GARCIA.XLSX', 'ANGEL REMEDIOS.XLSX', 'ROBERTO CRUZ.XLSX'];
type Visit = [day: number, hospital: string, city: string | null];
type Row = [person: number, start: number, end: number, cities: string[], mode: 'bus' | 'avion', time: string,
  flight: string | null, visits: Visit[], costs: [number | null, number | null, number | null, number, number, number], conflicts?: string[]];

// Dates are explicit FOR-007 taxi-table dates, not generated working days.
// Terminal departure references are intentionally not copied into origin departure fields.
const rows: Row[] = [
  [0,5,5,['TOLUCA'],'bus','05:00',null,[[5,'ISSSTE TOLUCA','TOLUCA']], [600,null,null,450,1060,2110]],
  [1,5,9,['CANCÚN','PLAYA DEL CARMEN','CANCÚN'],'avion','12:00','18:30',[
    [6,'HGZ 3','CANCÚN'],[7,'HGZ 18','PLAYA DEL CARMEN'],[8,'HGZ 7','CANCÚN'],[9,'HGZ 17','CANCÚN']], [478,14963,5568,2000,3700,26709]],
  [2,7,9,['ORIZABA','CÓRDOBA','XALAPA','VERACRUZ'],'bus','05:00',null,[
    [7,'ISSSTE ORIZABA','ORIZABA'],[7,'ISSSTE CÓRDOBA','CÓRDOBA'],[8,'ISSSTE XALAPA','XALAPA'],[9,'HAE ISSSTE VERACRUZ','VERACRUZ']],
    [1748,5741,2784,1350,2750,14373],['El vuelo de las 16:00 del 09/10 es de regreso; no es salida de ida.']],
  [0,12,14,['LOS MOCHIS','GUASAVE','CULIACÁN','MAZATLÁN'],'avion','05:00','05:55',[
    [12,'HGR LOS MOCHIS','LOS MOCHIS'],[12,'HGR GUASAVE','GUASAVE'],[13,'HGR CULIACAN','CULIACÁN'],
    [13,'HOSPITAL CIVIL CULIACAN','CULIACÁN'],[13,'HOSPITAL DE LA MUJER CULIACAN','CULIACÁN'],[14,'HGR MAZATLAN','MAZATLÁN']],
    [1280,8541,2784,1350,2800,16755],['Objetivo: Hospital General Culiacán/Mazatlán; taxis: HGR. Confirmar identidad.']],
  [3,12,14,['PUEBLA'],'bus','15:00',null,[[13,'HOSPITAL GENERAL DEL NORTE','PUEBLA'],[14,'HOSPITAL GENERAL DEL SUR','PUEBLA']], [1172,null,2784,1100,1500,6556]],
  [1,12,16,['MONTERREY','NUEVO LAREDO','MONTERREY'],'avion','08:00','08:00',[
    [12,'HGZ 4',null],[13,'HGZ 6',null],[14,'HGZ 11',null],[14,'UMAE 23',null],[15,'HGZ 33',null],[15,'UMAE 21',null],[16,'UMAE 25',null]],
    [null,8693,5568,2250,2000,18511],['Objetivo incluye Saltillo; secuencia del concentrado: Monterrey / Nuevo Laredo / Monterrey. Ciudades de cada hospital por confirmar.']],
  [4,13,16,['HERMOSILLO','OBREGÓN'],'avion','14:00','13:50',[
    [14,'HGP HERMOSILLO','HERMOSILLO'],[15,'HGZ 14','HERMOSILLO'],[16,'HGR 1','OBREGÓN'],[16,'CMNN HE','OBREGÓN']], [600,9018,4176,1800,2800,18394]],
  [2,13,16,['DURANGO','ZACATECAS','AGUACALIENTES'],'avion','06:00','07:30',[
    [13,'ISSSTE DURANGO','DURANGO'],[14,'HG 450','DURANGO'],[14,'HOSPITAL DE LA MUJER','DURANGO'],
    [15,'HOSPITAL GENERAL ZACATECAS','ZACATECAS'],[15,'ISSSTE ZACATECAS','ZACATECAS'],[16,'ISSSTE AGUASCALIENTES','AGUASCALIENTES']], [1212,13912,4176,1800,3000,24100]],
  [0,15,16,['OAXACA'],'avion','15:00','16:00',[[16,'HOSPITAL DE ESPECIALIDADES OAXACA','OAXACA']], [null,11486,1392,650,1800,15328]],
  [2,19,20,['MANZANILLO','COLIMA'],'avion','06:00','08:35',[[19,'ISSSTE MANZANILLO','MANZANILLO'],[20,'ISSSTE MIGUEL TREJO OCHOA','COLIMA']], [440,8781,1392,900,2500,14013]],
  [1,19,23,['VERACRUZ','CARDEL','VERACRUZ','CÓRDOBA','XALAPA'],'avion','14:00','17:15',[
    [20,'HGZ 71','VERACRUZ'],[20,'HGZ 36','CARDEL'],[21,'HGZ 71','VERACRUZ'],[22,'HGZ 8','CÓRDOBA'],[23,'HGZ 11','XALAPA'],[23,'HGZ 12',null]],
    [1824,5772,5568,2000,2700,17864],['Ciudad de HGZ 12 no confirmada.']],
  [0,20,21,['TAMPICO'],'avion','06:00','07:20',[[20,'HOSPITAL CIVIL CIUDAD MADERO','CIUDAD MADERO'],
    [20,'HOSPITAL GENERAL CIUDAD MADERO','CIUDAD MADERO'],[21,'HOSPITAL REGIONAL CIUDAD MADERO','CIUDAD MADERO']], [null,8629,1392,900,2000,12921]],
  [2,22,23,['ZITÁCUARO','MORELIA'],'bus','05:00',null,[[22,'ISSSTE ZITACUARO','ZITÁCUARO'],[22,'HAE ISSSTE MORELIA','MORELIA'],
    [23,'HAE ISSSTE MORELIA','MORELIA'],[23,'HOSPITAL GENERAL MORELIA','MORELIA']], [1602,null,1392,900,2000,5894],['Las 16:00 no corresponden a la primera salida; ida: autobús 05:00.']],
  [4,23,23,['CUERNAVACA'],'bus','05:00',null,[[23,'HGR 1','CUERNAVACA']], [700,null,null,450,1040,2190]],
  [3,26,26,['PACHUCA'],'bus','05:00',null,[[26,'ISSSTE COLUMBA RIVERA','PACHUCA'],[26,'ISSSTE XALOSTOC','XALOSTOC']],
    [440,null,null,450,1200,2090],['Concentrado: Pachuca; taxis incluyen ISSSTE Xalostoc. No unificar ciudades.']],
  [0,26,27,['VILLAHERMOSA','TUXTLA'],'avion','06:00','06:01',[[26,'HAE PEDIATRICAS','VILLAHERMOSA'],[26,'JUAN GRAHAM','VILLAHERMOSA'],
    [26,'PEMEX','VILLAHERMOSA'],[26,'ISSSTE TABASCO','VILLAHERMOSA'],[27,'PASCASIO GAMBOA','TUXTLA'],[27,'GOMEZ MAZA','TUXTLA'],[27,'HAE PEDIATRICAS','TUXTLA']],
    [933,10074,1392,900,2000,15299],['Objetivo menciona Hospital de la Mujer; taxis HAE Pediátricas. Confirmar identidad.']],
  [1,26,30,['MONTERREY','CD. VICTORIA','MONCLOVA','MONTERREY'],'avion','08:00','07:40',[[26,'HGZ 17',null],[27,'HGZ 2',null],
    [28,'HGZ 1',null],[28,'HGZ 11',null],[29,'UMAE 34',null],[29,'HGZ 7',null],[30,'HGZ 7',null]],
    [null,11971,5568,2250,2600,22389],['Ciudades de cada hospital no confirmadas; no inferirlas de la secuencia del concentrado.']],
  [4,27,28,['METEPEC','ATLACOMULCO','TOLUCA'],'bus','05:00',null,[[27,'HGR 251','METEPEC'],[27,'HGR 252','ATLACOMULCO'],
    [28,'HGR 220','TOLUCA'],[28,'HGZ 221','TOLUCA']], [1240,null,1392,900,1700,5232],['HGZ/HGR 221: identidad discrepante en fuentes.']],
  [2,27,30,['TIJUANA','MEXICALI'],'avion','14:00','14:10',[[28,'ISSSTE TIJUANA','TIJUANA'],[28,'ISSSTECALI','TIJUANA'],
    [28,'HOSPITAL GENERAL TIJUANA','TIJUANA'],[28,'ISSSTE TIJUANA','TIJUANA'],[29,'HOSPITAL DE LA MUJER','TIJUANA'],
    [29,'HOSPITAL GENERAL MEXICALI','MEXICALI'],[29,'ISSSTE MEXICALI','MEXICALI'],[30,'ISSSTECALI','MEXICALI'],[30,'ISSSTE 5 DE DICIEMBRE','MEXICALI']], [700,13912,4176,1800,3300,23888]],
  [0,29,30,['VERACRUZ','XALAPA'],'avion','06:00','06:05',[[29,'HAE VERACRUZ','VERACRUZ'],[29,'HOSPITAL PEDIATRICO VERACRUZ','VERACRUZ'],
    [29,'PEMEX VERACRUZ','VERACRUZ'],[30,'CECAN','XALAPA'],[30,'HOSPITAL REGIONAL LUIS F. NACHON','XALAPA']], [1512,6137,1392,900,1800,11741]],
];

export const VIAJES_EJEMPLO: ViajeEjemplo[] = rows.map(([person, start, end, cities, mode, time, flight, visits, costs, conflicts = []], index) => ({
  id: `v${index + 1}`, persona: people[person], origenCiudad: 'CDMX', inicio: iso(start), fin: iso(end), ciudades: cities,
  etiqueta: `${people[person]} · ${iso(start)} al ${iso(end)} · ${cities.join(', ')}`,
  destinos: visits.map(([day, hospital, city]) => ({ fecha: iso(day), hospital, ciudad: city })),
  salidaFecha: iso(start), salidaHora: time, transporte: mode, vueloHora: flight ?? undefined,
  fuentes: ['VIATICOS EDUCACION MEDICA OCTUBRE 2026.XLSX · FOR-008', `${books[person]} · FOR-007 transporte/taxis`,
    ...(flight ? ['VUELOS EDUCACION MEDICA OCTUBRE 2026.XLSX · solicitud de vuelos'] : [])],
  conflictos: [...conflicts, ...(flight && flight !== time ? [`FOR-007: ${time}; solicitud de vuelos: ${flight}. Referencias de terminal, no salida de casa.`] : [])],
  referenciaHistorica: { autobus: costs[0], avion: costs[1], hospedaje: costs[2], comida: costs[3], taxi: costs[4], total: costs[5] },
}));

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function hospitalCandidates(destination: ViajeEjemplo['destinos'][number], hospitals: HospitalUbicacion[]): HospitalUbicacion[] {
  if (!destination.ciudad) return [];
  return hospitals.filter(h => normalize(h.ciudad ?? '') === normalize(destination.ciudad!)
    && normalize(h.nombreContacto) === normalize(destination.hospital));
}

export interface EjemploSecuenciaIds {
  personId: number;
  primeroDestinoId: number;
  originId?: number | null;
}

export function aplicarEjemplo(ejemplo: ViajeEjemplo, branches: Sucursal[], hospitals: HospitalUbicacion[], ids: EjemploSecuenciaIds): {
  person: PersonForm; origenId: number | null; hospitalesNoEncontrados: string[];
} {
  const origins = branches.filter(b => b.activo && ['cdmx','ciudaddemexico'].includes(normalize(b.ciudad ?? '')));
  const origenId = ids.originId ?? (origins.length === 1 ? origins[0].idSucursal : null);
  const missing: string[] = [];
  const destinations = ejemplo.destinos.map((d, i) => {
    const candidates = hospitalCandidates(d, hospitals);
    if (candidates.length !== 1) missing.push(`${d.hospital} (${d.ciudad ?? 'ciudad por confirmar'})`);
    return { id: ids.primeroDestinoId + i, hospitalId: candidates.length === 1 ? candidates[0].codigoContacto : null,
      date: d.fecha, sourceHospital: d.hospital, sourceCity: d.ciudad };
  });
  return { person: { id: ids.personId, name: ejemplo.persona, modoNombre: 'mi', directorioId: null,
    ownCar: false, fuel: 'magna', start: '08:00', end: '18:30',
    originId: origenId, origenPunto: null, origenModo: 'catalogo', departureDate: '', departureTime: '', destinations },
    origenId, hospitalesNoEncontrados: missing };
}
