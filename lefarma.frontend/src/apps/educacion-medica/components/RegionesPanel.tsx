import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Scissors, Trash2 } from 'lucide-react';
import type {
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  HospitalCercanoOtraSeleccion,
  SeleccionHospital,
  SeleccionRegion,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface RegionesPanelProps {
  regiones: SeleccionRegion[];
  hospitalesPorRegion: Map<number | null, SeleccionHospital[]>;
  totalHospitales: number;
  ejecutivos: EjecutivoRegion[];
  suplentes: EjecutivoSuplente[];
  especialistas: EspecialistaPersona[];
  idTipoGerencia: number | null;
  editable: boolean;
  guardando?: boolean;
  regionesAbiertas: string[];
  onRegionesAbiertasChange: (abiertas: string[]) => void;
  onHoverRegion: (idRegion: number | null) => void;
  onHoverHospital: (idSeleccionHospital: number | null) => void;
  onAsignarEjecutivoRegion: (
    region: SeleccionRegion,
    idEjecutivo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onAsignarEspecialistaRegion: (
    region: SeleccionRegion,
    idEspecialista: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onAsignarEjecutivoHospital: (
    hospital: SeleccionHospital,
    idEjecutivo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onQuitarHospital: (hospital: SeleccionHospital) => Promise<void>;
  onDividir: (region: SeleccionRegion) => void;
  onRecalcular: () => void;
  onMoverARegion: (
    hospital: SeleccionHospital,
    idRegion: number
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  cercanosPorRegion?: Map<number | null, HospitalCercanoOtraSeleccion[]>;
}

function ubicacionHospital(hospital: SeleccionHospital): string {
  const partes = [hospital.entidadFederativa, hospital.ciudadMunicipio].filter(Boolean);
  return partes.join(' / ') || '-';
}

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

function etiquetaCriterio(hospital: HospitalCercanoOtraSeleccion): string {
  if (hospital.criterio === 'distancia') {
    return `A ${hospital.distanciaKm} km`;
  }
  if (hospital.criterio === 'mismoEstado') {
    return 'Mismo estado';
  }
  return 'Misma ciudad';
}

function CercanosList({ cercanos }: { cercanos: HospitalCercanoOtraSeleccion[] }) {
  return (
    <ul className="space-y-1 text-xs">
      {cercanos.map((hospital) => (
        <li
          key={hospital.idSeleccionHospitalAjeno}
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
        >
          <span className="truncate font-medium">
            {hospital.nombreHospital ?? `Hospital ${hospital.idHospital ?? ''}`}
          </span>
          {hospital.gerenciaOrigen && <Badge variant="secondary">{hospital.gerenciaOrigen}</Badge>}
          <span className="text-muted-foreground">
            {formatearFecha(hospital.fechaSeleccionOrigen)} · {etiquetaCriterio(hospital)}
          </span>
          {(hospital.ciudadMunicipio || hospital.entidadFederativa) && (
            <span className="text-muted-foreground">
              {[hospital.ciudadMunicipio, hospital.entidadFederativa].filter(Boolean).join(' / ')}
            </span>
          )}
          {hospital.nombreHospitalCercano && (
            <span className="text-muted-foreground">
              más cerca de {hospital.nombreHospitalCercano}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

interface ResponsibleOption {
  idUsuario: number;
  nombre: string;
  region: string;
  suplente: boolean;
}

interface RegionItemProps {
  region: SeleccionRegion;
  hospitales: SeleccionHospital[];
  ejecutivos: EjecutivoRegion[];
  suplentes: EjecutivoSuplente[];
  especialistas: EspecialistaPersona[];
  idTipoGerencia: number | null;
  editable: boolean;
  onHoverRegion: (idRegion: number | null) => void;
  onHoverHospital: (idSeleccionHospital: number | null) => void;
  onAsignarEjecutivoRegion: (
    region: SeleccionRegion,
    idEjecutivo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onAsignarEspecialistaRegion: (
    region: SeleccionRegion,
    idEspecialista: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onAsignarEjecutivoHospital: (
    hospital: SeleccionHospital,
    idEjecutivo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onQuitarHospital: (hospital: SeleccionHospital) => Promise<void>;
  onDividir: (region: SeleccionRegion) => void;
  hospitalesCercanos?: HospitalCercanoOtraSeleccion[];
}

function RegionItem({
  region,
  hospitales,
  ejecutivos,
  suplentes,
  especialistas,
  idTipoGerencia,
  editable,
  onHoverRegion,
  onHoverHospital,
  onAsignarEjecutivoRegion,
  onAsignarEspecialistaRegion,
  onAsignarEjecutivoHospital,
  onQuitarHospital,
  onDividir,
  hospitalesCercanos,
}: RegionItemProps) {
  const [errorResponsable, setErrorResponsable] = useState<string | null>(null);
  const [errorHospital, setErrorHospital] = useState<string | null>(null);

  const opcionesResponsables = useMemo<ResponsibleOption[]>(() => {
    const primarios = ejecutivos
      .filter(
        (ejecutivo) =>
          ejecutivo.activo &&
          ejecutivo.idRegionCatalogo === region.idRegionCatalogo &&
          (idTipoGerencia == null || ejecutivo.idTipoGerencia === idTipoGerencia)
      )
      .map((ejecutivo) => ({
        idUsuario: ejecutivo.idUsuario,
        nombre: ejecutivo.nombreUsuario,
        region: ejecutivo.nombreRegion,
        suplente: false,
      }));

    const suplentesDisponibles = suplentes
      .filter(
        (suplente) =>
          suplente.activo &&
          (suplente.idTipoGerencia == null || suplente.idTipoGerencia === idTipoGerencia) &&
          (suplente.idRegionCatalogo == null ||
            suplente.idRegionCatalogo === region.idRegionCatalogo)
      )
      .map((suplente) => ({
        idUsuario: suplente.idUsuario,
        nombre: suplente.nombreUsuario,
        region: suplente.idRegionCatalogo == null ? 'Toda la gerencia' : suplente.nombreRegion,
        suplente: true,
      }));

    const todos = [...primarios, ...suplentesDisponibles];
    return todos.filter(
      (opcion, index) =>
        todos.findIndex((candidato) => candidato.idUsuario === opcion.idUsuario) === index
    );
  }, [ejecutivos, suplentes, idTipoGerencia, region.idRegionCatalogo]);

  const opcionesEspecialistas = useMemo(
    () =>
      especialistas.filter(
        (especialista) =>
          especialista.activo &&
          especialista.gerencias.some(
            (gerencia) =>
              gerencia.activo &&
              (idTipoGerencia == null || gerencia.idTipoGerencia === idTipoGerencia)
          )
      ),
    [especialistas, idTipoGerencia]
  );

  const ejecutivoActual =
    region.nombreEjecutivo ??
    opcionesResponsables.find((opcion) => opcion.idUsuario === region.idEjecutivo)?.nombre ??
    (region.idEjecutivo ? `Usuario ${region.idEjecutivo}` : null);

  const especialistaActual =
    region.nombreEspecialista ??
    opcionesEspecialistas.find((opcion) => opcion.idUsuario === region.idEspecialista)
      ?.nombreUsuario ??
    (region.idEspecialista ? `Usuario ${region.idEspecialista}` : null);

  const esSuplente = useMemo(
    () =>
      region.idEjecutivo != null &&
      suplentes.some((suplente) => suplente.activo && suplente.idUsuario === region.idEjecutivo),
    [region.idEjecutivo, suplentes]
  );

  const manejarResponsable = async (value: string) => {
    setErrorResponsable(null);
    const resultado = await onAsignarEjecutivoRegion(region, value);
    if (!resultado.ok) {
      setErrorResponsable(resultado.mensaje ?? 'No se pudo asignar el ejecutivo.');
    }
  };

  const manejarEspecialista = async (value: string) => {
    setErrorResponsable(null);
    const resultado = await onAsignarEspecialistaRegion(region, value);
    if (!resultado.ok) {
      setErrorResponsable(resultado.mensaje ?? 'No se pudo asignar el especialista.');
    }
  };

  const manejarHospital = async (hospital: SeleccionHospital, value: string) => {
    setErrorHospital(null);
    const resultado = await onAsignarEjecutivoHospital(hospital, value);
    if (!resultado.ok) {
      setErrorHospital(resultado.mensaje ?? 'No se pudo asignar el ejecutivo del hospital.');
    }
  };

  return (
    <AccordionItem
      value={String(region.idRegion)}
      className="data-[state=open]:bg-primary/5 group border-l-2 border-l-transparent transition-colors data-[state=open]:border-l-primary"
      onMouseEnter={() => onHoverRegion(region.idRegion)}
      onMouseLeave={() => onHoverRegion(null)}
    >
      <AccordionTrigger>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-bold group-data-[state=open]:text-primary">
              {region.nombre ?? `Región ${region.idRegion}`}
            </p>
            {ejecutivoActual ? (
              <p className="truncate text-xs">
                <span className="text-muted-foreground">Ejecutivo:</span>{' '}
                <span className="font-medium">{ejecutivoActual}</span>
                {especialistaActual && (
                  <>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Especialista:</span>{' '}
                    <span className="font-medium">{especialistaActual}</span>
                  </>
                )}
              </p>
            ) : (
              <p className="truncate text-xs font-medium text-amber-700 dark:text-amber-300">
                Sin ejecutivo asignado
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {esSuplente && (
              <Badge
                variant="outline"
                className="border-violet-200 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200"
              >
                Suplente
              </Badge>
            )}
            {region.advertenciaMinimo && <Badge variant="destructive">&lt; 4 hospitales</Badge>}
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {region.cantidadHospitales} hospitales
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-2">
          <div className="bg-muted/20 grid gap-3 rounded-xl border p-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Ejecutivo de la región</p>
              <Select
                value={region.idEjecutivo ? String(region.idEjecutivo) : ''}
                onValueChange={(value) => void manejarResponsable(value)}
                disabled={!editable}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Sin ejecutivo asignado" />
                </SelectTrigger>
                <SelectContent>
                  {region.idEjecutivo &&
                    !opcionesResponsables.some(
                      (opcion) => opcion.idUsuario === region.idEjecutivo
                    ) && (
                      <SelectItem value={String(region.idEjecutivo)}>
                        {ejecutivoActual ?? `Usuario ${region.idEjecutivo}`} (actual)
                      </SelectItem>
                    )}
                  {opcionesResponsables.length === 0 && (
                    <SelectItem value="sin-ejecutivos" disabled>
                      Sin ejecutivos elegibles para esta región
                    </SelectItem>
                  )}
                  {opcionesResponsables.some((opcion) => !opcion.suplente) && (
                    <SelectGroup>
                      <SelectLabel>Ejecutivos primarios</SelectLabel>
                      {opcionesResponsables
                        .filter((opcion) => !opcion.suplente)
                        .map((opcion) => (
                          <SelectItem key={opcion.idUsuario} value={String(opcion.idUsuario)}>
                            {opcion.nombre} · {opcion.region}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                  {opcionesResponsables.some((opcion) => opcion.suplente) && (
                    <SelectGroup>
                      <SelectLabel>Suplentes</SelectLabel>
                      {opcionesResponsables
                        .filter((opcion) => opcion.suplente)
                        .map((opcion) => (
                          <SelectItem key={opcion.idUsuario} value={String(opcion.idUsuario)}>
                            {opcion.nombre} · Suplente · {opcion.region}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {opcionesResponsables.length === 0
                  ? region.idRegionCatalogo == null
                    ? 'Esta región no tiene catálogo vinculado; solo aplican suplentes de cobertura total.'
                    : 'No hay ejecutivos configurados para esta región. Asígnalos en Colaboradores.'
                  : 'Solo se muestran ejecutivos de esta región y suplentes que la cubren.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Especialista sugerido (opcional)
              </p>
              <Select
                value={region.idEspecialista ? String(region.idEspecialista) : 'sin-especialista'}
                onValueChange={(value) => void manejarEspecialista(value)}
                disabled={!editable || !region.idEjecutivo}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Sin especialista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-especialista">Sin especialista</SelectItem>
                  {region.idEspecialista != null &&
                    !opcionesEspecialistas.some(
                      (especialista) => especialista.idUsuario === region.idEspecialista
                    ) && (
                      <SelectItem value={String(region.idEspecialista)}>
                        {especialistaActual ?? `Usuario ${region.idEspecialista}`} (actual)
                      </SelectItem>
                    )}
                  {opcionesEspecialistas.map((especialista) => (
                    <SelectItem key={especialista.idUsuario} value={String(especialista.idUsuario)}>
                      {especialista.nombreUsuario}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {errorResponsable && (
            <p className="bg-destructive/10 rounded-lg px-3 py-2 text-xs text-destructive">
              {errorResponsable}
            </p>
          )}

          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,130px)_minmax(0,190px)_48px_96px_32px] items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Hospital</span>
              <span>Ubicación</span>
              <span>Ejecutivo</span>
              <span>Score</span>
              <span>Origen</span>
              <span />
            </div>
            {hospitales.map((hospital) => {
              const idEjecutivoEfectivo = hospital.idEjecutivo ?? region.idEjecutivo;
              const nombreEjecutivo =
                hospital.nombreEjecutivo ??
                ejecutivos.find((ejecutivo) => ejecutivo.idUsuario === idEjecutivoEfectivo)
                  ?.nombreUsuario ??
                ejecutivoActual ??
                '-';
              const esOverride = hospital.idEjecutivo != null;

              return (
                <div
                  key={hospital.idSeleccionHospital}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,130px)_minmax(0,190px)_48px_96px_32px] items-center gap-2 border-t py-1.5 text-xs"
                  onMouseEnter={() => onHoverHospital(hospital.idSeleccionHospital)}
                  onMouseLeave={() => onHoverHospital(null)}
                >
                  <span className="truncate font-medium">
                    {hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {ubicacionHospital(hospital)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Select
                      value={hospital.idEjecutivo ? String(hospital.idEjecutivo) : 'heredar'}
                      onValueChange={(value) => void manejarHospital(hospital, value)}
                      disabled={!editable}
                    >
                      <SelectTrigger className="bg-muted/40 h-7 min-w-0 border-transparent px-2 text-xs">
                        <SelectValue>{nombreEjecutivo}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="heredar">
                          Heredar de la región
                          {region.idEjecutivo ? ` · ${ejecutivoActual ?? ''}` : ''}
                        </SelectItem>
                        {hospital.idEjecutivo != null &&
                          !opcionesResponsables.some(
                            (opcion) => opcion.idUsuario === hospital.idEjecutivo
                          ) && (
                            <SelectItem value={String(hospital.idEjecutivo)}>
                              {nombreEjecutivo} (actual)
                            </SelectItem>
                          )}
                        {opcionesResponsables.map((opcion) => (
                          <SelectItem key={opcion.idUsuario} value={String(opcion.idUsuario)}>
                            {opcion.nombre}
                            {opcion.suplente ? ' · suplente' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {esOverride && (
                      <Badge
                        variant="outline"
                        className="w-fit border-violet-200 bg-violet-50 px-1.5 py-0 text-[9px] text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200"
                      >
                        Override
                      </Badge>
                    )}
                  </div>
                  <span>
                    {hospital.scoreSugerencia != null ? (
                      <Badge variant="secondary" className="text-xs">
                        {Number(hospital.scoreSugerencia).toFixed(1)}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge
                      variant={hospital.tipoAlta === 'Sugerencia' ? 'default' : 'outline'}
                      className="text-xs"
                    >
                      {hospital.tipoAlta ?? 'Manual'}
                    </Badge>
                    {hospital.origen === 'GPS' && (
                      <span
                        className="text-[10px] text-muted-foreground"
                        title="Región asignada por GPS (centroide más cercano)"
                      >
                        GPS
                      </span>
                    )}
                  </span>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!editable}
                      onClick={() => void onQuitarHospital(hospital)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              );
            })}
            {hospitales.length === 0 && (
              <p className="border-t py-2 text-xs text-muted-foreground">
                Sin hospitales con coordenadas registradas.
              </p>
            )}
          </div>

          {errorHospital && (
            <p className="bg-destructive/10 rounded-lg px-3 py-2 text-xs text-destructive">
              {errorHospital}
            </p>
          )}

          {(hospitalesCercanos?.length ?? 0) > 0 && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Cerca, en otras gerencias ({hospitalesCercanos!.length})
              </p>
              <CercanosList cercanos={hospitalesCercanos!} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">Algoritmo: {region.algoritmo ?? '-'}</p>

          {editable && (
            <Button variant="outline" size="sm" onClick={() => onDividir(region)}>
              <Scissors className="mr-2 h-4 w-4" />
              Dividir región
            </Button>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function RegionesPanel({
  regiones,
  hospitalesPorRegion,
  totalHospitales,
  ejecutivos,
  suplentes,
  especialistas,
  idTipoGerencia,
  editable,
  guardando = false,
  regionesAbiertas,
  onRegionesAbiertasChange,
  onHoverRegion,
  onHoverHospital,
  onAsignarEjecutivoRegion,
  onAsignarEspecialistaRegion,
  onAsignarEjecutivoHospital,
  onQuitarHospital,
  onDividir,
  onRecalcular,
  onMoverARegion,
  cercanosPorRegion,
}: RegionesPanelProps) {
  const sinRegion = hospitalesPorRegion.get(null) ?? [];
  const cercanosSinRegion = cercanosPorRegion?.get(null) ?? [];
  const cercanosTotal = useMemo(
    () =>
      [...(cercanosPorRegion?.values() ?? [])].reduce((total, lista) => total + lista.length, 0),
    [cercanosPorRegion]
  );
  const [errorMover, setErrorMover] = useState<string | null>(null);

  const manejarMover = async (hospital: SeleccionHospital, value: string) => {
    setErrorMover(null);
    const resultado = await onMoverARegion(hospital, Number(value));
    if (!resultado.ok) {
      setErrorMover(resultado.mensaje ?? 'No se pudo mover el hospital.');
    }
  };

  const resumen = useMemo(() => {
    const conEjecutivo = regiones.filter((region) => region.idEjecutivo != null).length;
    const advertencias = regiones.filter((region) => region.advertenciaMinimo).length;
    const base = `${regiones.length} ${regiones.length === 1 ? 'región' : 'regiones'} · ${totalHospitales} hospitales · ${conEjecutivo} con ejecutivo · ${advertencias} ${advertencias === 1 ? 'advertencia' : 'advertencias'} · ${sinRegion.length} sin región`;
    return cercanosTotal > 0
      ? `${base} · ${cercanosTotal} ${cercanosTotal === 1 ? 'cercano' : 'cercanos'} en otras gerencias`
      : base;
  }, [regiones, totalHospitales, sinRegion.length, cercanosTotal]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{resumen}</p>

      <Accordion type="multiple" value={regionesAbiertas} onValueChange={onRegionesAbiertasChange}>
        {regiones.map((region) => (
          <RegionItem
            key={region.idRegion}
            region={region}
            hospitales={hospitalesPorRegion.get(region.idRegion) ?? []}
            ejecutivos={ejecutivos}
            suplentes={suplentes}
            especialistas={especialistas}
            idTipoGerencia={idTipoGerencia}
            editable={editable}
            onHoverRegion={onHoverRegion}
            onHoverHospital={onHoverHospital}
            onAsignarEjecutivoRegion={onAsignarEjecutivoRegion}
            onAsignarEspecialistaRegion={onAsignarEspecialistaRegion}
            onAsignarEjecutivoHospital={onAsignarEjecutivoHospital}
            onQuitarHospital={onQuitarHospital}
            onDividir={onDividir}
            hospitalesCercanos={cercanosPorRegion?.get(region.idRegion)}
          />
        ))}
      </Accordion>

      {sinRegion.length > 0 && (
        <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-md border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Hospitales sin región ({sinRegion.length})
          </p>
          <ul className="space-y-1 text-xs">
            {sinRegion.map((hospital) => (
              <li
                key={hospital.idSeleccionHospital}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {editable && regiones.length > 0 && (
                    <Select onValueChange={(value) => void manejarMover(hospital, value)}>
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Mover a región..." />
                      </SelectTrigger>
                      <SelectContent>
                        {regiones.map((region) => (
                          <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                            {region.nombre ?? `Región ${region.idRegion}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!editable}
                    onClick={() => void onQuitarHospital(hospital)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {errorMover && <p className="text-xs text-destructive">{errorMover}</p>}
          <p className="text-xs text-muted-foreground">
            Estos hospitales todavía no pertenecen a ninguna región.
          </p>
          {cercanosSinRegion.length > 0 && (
            <div className="border-destructive/20 space-y-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Cerca, en otras gerencias ({cercanosSinRegion.length})
              </p>
              <CercanosList cercanos={cercanosSinRegion} />
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!editable || guardando}
            onClick={onRecalcular}
          >
            <Scissors className="mr-2 h-4 w-4" />
            Recalcular regiones
          </Button>
        </div>
      )}

      {sinRegion.length === 0 && cercanosSinRegion.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">
            Cerca, en otras gerencias - sin región ({cercanosSinRegion.length})
          </p>
          <CercanosList cercanos={cercanosSinRegion} />
          <p className="text-xs text-muted-foreground">
            Hospitales de otras gerencias con vigencia solapada, cuyo hospital propio más cercano no
            tiene región. Solo informativo.
          </p>
        </div>
      )}
    </div>
  );
}
