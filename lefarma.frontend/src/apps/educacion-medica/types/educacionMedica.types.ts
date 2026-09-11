export interface HospitalExtension {
  idHospitalExtension: number;
  idHospital: number;
  fecha: string | null;
  idTipoGerencia: number | null;
  tipoGerencia: string | null;
  idRegion: number | null;
  regionNombre: string | null;
  conSia: boolean | null;
  numeroQuirofanos: number | null;
  esZonaMetropolitana: boolean | null;
  anestesiasTotales: number | null;
  anestesiasGenerales: number | null;
  anestesiasRegionales: number | null;
  anestesiasEpidurales: number | null;
  anestesiasSubdurales: number | null;
  anestesiasMixtasObesos: number | null;
  anestesiasMixtasNoObesos: number | null;
}

export interface Hospital {
  codigoContacto: number;
  nombreContacto: string;
  nombreCorto: string | null;
  clues: string | null;
  ciudad: string | null;
  codigoEstado: string | null;
  activo: number | null;
  codigoContactoPrincipal: number | null;
  institucion: string | null;
  latitud: number | null;
  longitud: number | null;
  esInstitucion: boolean;
  extension: HospitalExtension | null;
}

export interface HospitalUbicacion {
  codigoContacto: number;
  nombreContacto: string;
  nombreCorto: string | null;
  clues: string | null;
  ciudad: string | null;
  codigoEstado: string | null;
  latitud: number | null;
  longitud: number | null;
  idRegion: number | null;
  regionNombre: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HospitalFilterParams {
  search?: string;
  modoInstitucion?: string;
  conSia?: boolean | null;
  idTipoGerencia?: number | null;
  idRegion?: number | null;
  numeroQuirofanosMin?: number | null;
  anestesiasTotalesMin?: number | null;
  activo?: boolean | null;
  /** true = solo con coordenadas validas (no nulas ni 0/0); false = solo sin ellas */
  tieneCoordenadas?: boolean | null;
  orderBy?: string;
  orderDirection?: string;
  page?: number;
  pageSize?: number;
}

export interface Producto {
  codigoProducto: number;
  nombre: string;
  descripcionCorta: string | null;
  tipo: string | null;
  tipoAsokam: string | null;
  marcaImss: string | null;
}

export interface TipoGerencia {
  idTipoGerencia: number;
  descripcion: string;
}

export interface RegionEstadoResumen {
  codigoEstado: number;
  nombreEstado: string | null;
}

export interface Region {
  idRegion: number;
  nombre: string;
  centroLatitud: number | null;
  centroLongitud: number | null;
  activo: boolean;
  cantidadHospitales: number;
  estados: RegionEstadoResumen[];
}

export interface UpsertRegionRequest {
  nombre: string;
  centroLatitud?: number | null;
  centroLongitud?: number | null;
  activo?: boolean | null;
  codigoEstados?: number[];
}

export interface EstadoCatalogo {
  codigoEstado: number;
  nombreEstado: string;
  idRegion: number | null;
  nombreRegion: string | null;
}

export interface SugerenciaRegionOpcion {
  idRegion: number;
  nombreRegion: string;
  distanciaKm: number | null;
}

export interface SugerenciaRegionResponse {
  porEstado: SugerenciaRegionOpcion | null;
  porGps: SugerenciaRegionOpcion | null;
}

export interface AplicarMapeoDetalle {
  codigoEstado: number;
  nombreEstado: string | null;
  idRegion: number;
  nombreRegion: string | null;
  hospitales: number;
}

export interface AplicarMapeoGpsDetalle {
  idRegion: number;
  nombreRegion: string | null;
  hospitales: number;
}

export interface AplicarMapeoResponse {
  detalles: AplicarMapeoDetalle[];
  totalHospitales: number;
  detallesGps: AplicarMapeoGpsDetalle[];
  totalPorGps: number;
  sinCoordenadas: number;
}

export interface RegionEstado {
  codigoEstado: number;
  nombreEstado: string | null;
  idRegion: number;
  nombreRegion: string | null;
}

export interface UpsertRegionEstadoRequest {
  idRegion: number;
}

export interface AsignarRegionHospitalRequest {
  idRegion: number | null;
}

export interface UpsertHospitalExtensionRequest {
  fecha: string | null;
  idTipoGerencia: number | null;
  idRegion: number | null;
  conSia: boolean | null;
  numeroQuirofanos: number | null;
  esZonaMetropolitana: boolean | null;
}

export interface ParametroAnestesia {
  idParametroAnestesia: number;
  anio: number;
  clave: string;
  valor: number;
  descripcion: string | null;
  orden: number;
}

export interface UpsertParametroAnestesiaItemRequest {
  clave: string;
  valor: number;
}

export interface UpsertParametrosAnestesiasRequest {
  parametros: UpsertParametroAnestesiaItemRequest[];
}

export interface RecalcularAnestesiasResponse {
  anio: number;
  registrosActualizados: number;
}

export interface UsuarioCatalogo {
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
}

export interface EquipoPareo {
  idEquipo: number;
  idRegion: number;
  nombreRegion: string | null;
  idEjecutivo: number;
  nombreEjecutivo: string;
  idEspecialista: number;
  nombreEspecialista: string;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  regionesActuales: string[];
}

export interface CrearEquipoPareoRequest {
  idEjecutivo: number;
  idEspecialista: number;
  idRegion: number;
  fechaInicio?: string | null;
}

export interface AsignarRegionEquipoRequest {
  idRegion: number;
}

export interface EquipoPareoFiltros {
  soloVigentes?: boolean | null;
  busqueda?: string;
  idUsuario?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface EquipoRegionOperada {
  idRegion: number;
  nombre: string;
  cantidadHospitales: number;
}

export interface EquipoRutaOperada {
  idRuta: number;
  version: number;
  estado: string;
  fechaConfirmacion: string | null;
  totalVisitas: number;
}

export interface EquipoParticipacion {
  idSeleccionMensual: number;
  fechaSeleccion: string;
  estadoSeleccion: string;
  regiones: EquipoRegionOperada[];
  rutas: EquipoRutaOperada[];
}

export interface EquipoOperacion {
  idEquipo: number;
  nombreEjecutivo: string;
  nombreEspecialista: string;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  totalSelecciones: number;
  totalVisitasConfirmadas: number;
  participaciones: EquipoParticipacion[];
}

export interface SeleccionMensual {
  idSeleccionMensual: number;
  fechaSeleccion: string;
  idTipoGerencia: number | null;
  tipoGerencia: string | null;
  fechaInicioVigencia: string | null;
  fechaFinVigencia: string | null;
  talleresObjetivoMes: number | null;
  estado: 'Borrador' | 'EnRevision' | 'Autorizada' | 'Cerrada';
  firmaGvFecha: string | null;
  firmaGgFecha: string | null;
  totalHospitales: number;
  totalRegiones: number;
}

export interface SeleccionHospital {
  idSeleccionHospital: number;
  idHospital: number | null;
  nombreHospital: string | null;
  region: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  productoAPromocionar: string | null;
  observaciones: string | null;
  latitudSnapshot: number | null;
  longitudSnapshot: number | null;
  idRegion: number | null;
  nombreRegion: string | null;
  scoreSugerencia: number | null;
  origen: string | null;
  institucion: string | null;
  numeroQuirofanos: number | null;
  anestesiasTotales: number | null;
}

export interface SeleccionRegion {
  idRegion: number;
  nombre: string | null;
  centroLatitud: number | null;
  centroLongitud: number | null;
  cantidadHospitales: number;
  idEquipo: number | null;
  nombreEquipo: string | null;
  idRegionCatalogo: number | null;
  algoritmo: string | null;
  fechaCalculo: string;
  advertenciaMinimo: boolean;
}

export interface SeleccionDetalle extends SeleccionMensual {
  hospitales: SeleccionHospital[];
  regiones: SeleccionRegion[];
}

export type CriterioCercania = "distancia" | "mismoEstado" | "mismaCiudad";

export interface HospitalCercanoOtraSeleccion {
  idSeleccionHospitalAjeno: number;
  idHospital: number | null;
  nombreHospital: string | null;
  gerenciaOrigen: string | null;
  idSeleccionMensualOrigen: number;
  fechaSeleccionOrigen: string;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  latitud: number | null;
  longitud: number | null;
  distanciaKm: number | null;
  criterio: CriterioCercania;
  idSeleccionHospitalCercano: number | null;
  nombreHospitalCercano: string | null;
}

export interface CrearSeleccionMensualRequest {
  fechaSeleccion: string;
  idTipoGerencia?: number | null;
  fechaInicioVigencia: string;
  fechaFinVigencia: string;
  talleresObjetivoMes?: number | null;
}

export interface AgregarHospitalSeleccionRequest {
  idHospital: number;
  productoAPromocionar?: string | null;
  observaciones?: string | null;
}

export interface AsignarEquipoRegionRequest {
  idEquipo: number;
}

export interface DividirRegionRequest {
  motivo: string;
}

export interface MoverHospitalARegionRequest {
  idRegion: number;
}

export interface AutorizarSeleccionRequest {
  rol: 'GV' | 'GG';
}

export interface AgruparSeleccionResponse {
  regiones: SeleccionRegion[];
  avisos: string[];
}

export interface RutaVisita {
  idRutaVisita: number;
  idRuta: number;
  idSeleccionHospital: number;
  idHospital: number | null;
  nombreHospital: string | null;
  fechaVisita: string;
  orden: number;
  esForanea: boolean;
  idRegion: number | null;
  nombreRegion: string | null;
  aviso?: string | null;
}

export interface Ruta {
  idRuta: number;
  idSeleccionMensual: number;
  idEquipo: number;
  nombreEquipo: string;
  version: number;
  nombre: string | null;
  estado: 'Draft' | 'Confirmada' | 'Cancelada' | 'Archivada';
  fechaConfirmacion: string | null;
  visitas: RutaVisita[];
}

export interface GenerarRutasResponse {
  version: number;
  estrategia: string;
  rutas: Ruta[];
  avisos: string[];
}

export type EstrategiaReparto = 'ciudad' | 'centroide';

export interface Asignacion {
  idRutaVisita: number;
  idRuta: number;
  nombreRuta: string | null;
  idSeleccionMensual: number;
  fechaVisita: string;
  orden: number;
  idHospital: number | null;
  nombreHospital: string | null;
  nombreRegion: string | null;
}

export interface MoverVisitaRequest {
  fechaVisita: string;
  orden: number;
}

export interface AgregarVisitaRequest {
  idSeleccionHospital: number;
  fechaVisita: string;
  orden: number;
}

export interface CancelarRutasRequest {
  motivo: string;
}

export interface ParametroModulo {
  clave: string;
  valor: number;
  descripcion: string | null;
}

export interface UpsertParametroModuloRequest {
  clave: string;
  valor: number;
}

export interface RankingFactorItem {
  clave: string;
  grupo: string | null;
  valorCrudo: number | null;
  scoreFactor: number;
  pesoConfigurado: number;
  pesoEfectivo: number;
  puntosAportados: number;
  datoDisponible: boolean;
  aplicado: boolean;
  motivoNoAplicado: string | null;
}

export interface RankingHospitalItem {
  idHospital: number;
  nombreHospital: string | null;
  institucion: string | null;
  codigoEstado: string | null;
  entidadFederativa: string | null;
  ciudadMunicipio: string | null;
  posicion: number;
  scoreTotal: number;
  porcentajeCompletitud: number;
  esTopSugerido: boolean;
  datoCoordenadasDisponible: boolean | null;
  factores: RankingFactorItem[];
}

export interface ConfigRankingResumen {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  usada: boolean;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  fechaCreacion: string;
}

export interface RankingGerenciaFiltro {
  id: number;
  descripcion: string;
}

export interface RankingFiltros {
  gerencia: RankingGerenciaFiltro | null;
  activo: boolean;
  excluyeTipos: string[];
  excluyeYaAgregados: boolean;
  search?: string | null;
  codigoEstado?: string | null;
  estadoNombre?: string | null;
  zonaMetropolitana?: boolean | null;
  idRegion?: number | null;
  nombreRegion?: string | null;
  reglaVersion: string;
}

export interface RankingFactorCatalogo {
  clave: string;
  nombre: string;
  descripcion: string;
  grupo: string | null;
}

export interface RankingEjecucion {
  idRankingEjecucion: number;
  idSeleccionMensual: number;
  configuracion: ConfigRankingResumen;
  versionAlgoritmo: string;
  cantidadSolicitada: number;
  cantidadCandidatos: number;
  cantidadYaAgregados: number;
  pesosEfectivos: Record<string, number>;
  factoresCatalogo?: RankingFactorCatalogo[];
  filtros?: RankingFiltros | null;
  ranking: RankingHospitalItem[];
}

export interface EstadoFiltro {
  codigo: string;
  nombre: string | null;
}

export interface FiltrosDisponibles {
  estados: EstadoFiltro[];
  regiones: RegionFiltro[];
  locales: number;
  foraneos: number;
  sinClasificacion: number;
  totalCandidatos: number;
}

export interface RegionFiltro {
  idRegion: number;
  nombre: string;
}

export interface GenerarRankingRequest {
  cantidad: number;
  search?: string | null;
  codigoEstado?: string | null;
  zonaMetropolitana?: boolean | null;
  idRegion?: number | null;
}

export interface HospitalLoteItemRequest {
  idHospital: number;
  productoAPromocionar?: string | null;
}

export interface AgregarHospitalesLoteRequest {
  idRankingEjecucion?: number | null;
  hospitales: HospitalLoteItemRequest[];
}

export interface ConfigRankingFactor {
  idFactor: number;
  clave: string;
  grupo: string | null;
  nombre: string;
  descripcion: string;
  peso: number;
  activo: boolean;
  tipoNormalizacion: string | null;
  parametrosJson: string | null;
}

export interface ConfigRanking {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  usada: boolean;
  fechaVigenciaInicio: string | null;
  fechaVigenciaFin: string | null;
  fechaCreacion: string;
  factores: ConfigRankingFactor[];
}

export interface ConfigRankingVersion {
  idConfiguracion: number;
  nombre: string;
  version: number;
  activo: boolean;
  fechaCreacion: string;
}

export interface ConfigRankingConVersiones extends ConfigRanking {
  versiones: ConfigRankingVersion[];
}

export interface UpsertConfigRankingFactorRequest {
  clave: string;
  grupo?: string | null;
  nombre: string;
  descripcion: string;
  peso: number;
  activo: boolean;
  tipoNormalizacion?: string | null;
  parametrosJson?: string | null;
}

export interface UpsertConfigRankingRequest {
  nombre: string;
  activo?: boolean;
  factores: UpsertConfigRankingFactorRequest[];
}
