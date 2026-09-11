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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Scissors, Trash2 } from 'lucide-react';
import type {
  EquipoPareo,
  HospitalCercanoOtraSeleccion,
  SeleccionHospital,
  SeleccionRegion,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface RegionesPanelProps {
  regiones: SeleccionRegion[];
  hospitalesPorRegion: Map<number | null, SeleccionHospital[]>;
  totalHospitales: number;
  equipos: EquipoPareo[];
  editable: boolean;
  guardando?: boolean;
  regionesAbiertas: string[];
  onRegionesAbiertasChange: (abiertas: string[]) => void;
  onHoverRegion: (idRegion: number | null) => void;
  onHoverHospital: (idSeleccionHospital: number | null) => void;
  onAsignarEquipo: (
    region: SeleccionRegion,
    idEquipo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onQuitarHospital: (hospital: SeleccionHospital) => Promise<void>;
  onDividir: (region: SeleccionRegion) => void;
  onRecalcular: () => void;
  onMoverARegion: (
    hospital: SeleccionHospital,
    idRegion: number
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  /** Hospitales de otras gerencias cercanos, agrupados por la región del hospital propio más cercano (null = sin región). */
  cercanosPorRegion?: Map<number | null, HospitalCercanoOtraSeleccion[]>;
}

function ubicacionHospital(hospital: SeleccionHospital): string {
  const partes = [hospital.entidadFederativa, hospital.ciudadMunicipio].filter(Boolean);
  return partes.join(' / ') || '—';
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
          {hospital.gerenciaOrigen && (
            <Badge variant="secondary">{hospital.gerenciaOrigen}</Badge>
          )}
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

interface RegionItemProps {
  region: SeleccionRegion;
  hospitales: SeleccionHospital[];
  equipos: EquipoPareo[];
  editable: boolean;
  onHoverRegion: (idRegion: number | null) => void;
  onHoverHospital: (idSeleccionHospital: number | null) => void;
  onAsignarEquipo: (
    region: SeleccionRegion,
    idEquipo: string
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  onQuitarHospital: (hospital: SeleccionHospital) => Promise<void>;
  onDividir: (region: SeleccionRegion) => void;
  hospitalesCercanos?: HospitalCercanoOtraSeleccion[];
}

function RegionItem({
  region,
  hospitales,
  equipos,
  editable,
  onHoverRegion,
  onHoverHospital,
  onAsignarEquipo,
  onQuitarHospital,
  onDividir,
  hospitalesCercanos,
}: RegionItemProps) {
  const [errorEquipo, setErrorEquipo] = useState<string | null>(null);

  const equipoAsignado = useMemo(
    () => equipos.find((e) => e.idEquipo === region.idEquipo) ?? null,
    [region.idEquipo, equipos]
  );

  const manejarAsignacion = async (value: string) => {
    setErrorEquipo(null);
    if (value === 'sin-equipo') return;
    const resultado = await onAsignarEquipo(region, value);
    if (!resultado.ok) {
      setErrorEquipo(resultado.mensaje ?? 'No se pudo asignar el equipo.');
    }
  };

  return (
    <AccordionItem
      value={String(region.idRegion)}
      className="group border-l-2 border-l-transparent transition-colors data-[state=open]:border-l-primary data-[state=open]:bg-primary/5"
      onMouseEnter={() => onHoverRegion(region.idRegion)}
      onMouseLeave={() => onHoverRegion(null)}
    >
      <AccordionTrigger>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-bold group-data-[state=open]:text-primary">
              {region.nombre ?? `Región ${region.idRegion}`}
            </p>
            {!region.idEquipo ? (
              <p className="truncate text-xs text-muted-foreground">Sin equipo</p>
            ) : equipoAsignado ? (
              <p className="truncate text-xs">
                <span className="text-muted-foreground">Ejecutivo:</span>{' '}
                <span className="font-medium">{equipoAsignado.nombreEjecutivo}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">Especialista:</span>{' '}
                <span className="font-medium">{equipoAsignado.nombreEspecialista}</span>
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {region.nombreEquipo ?? 'Equipo'}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {region.advertenciaMinimo && (
              <Badge variant="destructive">&lt; 4 hospitales</Badge>
            )}
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {region.cantidadHospitales} hospitales
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Equipo responsable</p>
            <Select
              value={region.idEquipo ? String(region.idEquipo) : 'sin-equipo'}
              onValueChange={(value) => void manejarAsignacion(value)}
              disabled={!editable}
            >
              <SelectTrigger>
                <SelectValue placeholder="Equipo responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin-equipo">Sin equipo</SelectItem>
                {equipos.map((equipo) => (
                  <SelectItem key={equipo.idEquipo} value={String(equipo.idEquipo)}>
                    Ejecutivo: {equipo.nombreEjecutivo} · Especialista: {equipo.nombreEspecialista}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorEquipo && (
              <p className="text-xs text-destructive">⚠ {errorEquipo}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,150px)_48px_84px_32px] items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Hospital</span>
              <span>Ubicación</span>
              <span>Score</span>
              <span>Origen</span>
              <span />
            </div>
            {hospitales.map((hospital) => (
              <div
                key={hospital.idSeleccionHospital}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,150px)_48px_84px_32px] items-center gap-2 border-t py-1.5 text-xs"
                onMouseEnter={() => onHoverHospital(hospital.idSeleccionHospital)}
                onMouseLeave={() => onHoverHospital(null)}
              >
                <span className="truncate font-medium">
                  {hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`}
                </span>
                <span className="truncate text-muted-foreground">
                  {ubicacionHospital(hospital)}
                </span>
                <span>
                  {hospital.scoreSugerencia != null ? (
                    <Badge variant="secondary" className="text-xs">
                      {Number(hospital.scoreSugerencia).toFixed(1)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </span>
                <span>
                  <Badge
                    variant={hospital.origen === 'Sugerencia' ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {hospital.origen ?? 'Manual'}
                  </Badge>
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
            ))}
            {hospitales.length === 0 && (
              <p className="border-t py-2 text-xs text-muted-foreground">
                Sin hospitales con coordenadas registradas.
              </p>
            )}
          </div>

          {(hospitalesCercanos?.length ?? 0) > 0 && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Cerca, en otras gerencias ({hospitalesCercanos!.length})
              </p>
              <CercanosList cercanos={hospitalesCercanos!} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">Algoritmo: {region.algoritmo ?? '—'}</p>

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
  equipos,
  editable,
  guardando = false,
  regionesAbiertas,
  onRegionesAbiertasChange,
  onHoverRegion,
  onHoverHospital,
  onAsignarEquipo,
  onQuitarHospital,
  onDividir,
  onRecalcular,
  onMoverARegion,
  cercanosPorRegion,
}: RegionesPanelProps) {
  const sinRegion = hospitalesPorRegion.get(null) ?? [];
  const cercanosSinRegion = cercanosPorRegion?.get(null) ?? [];
  const cercanosTotal = useMemo(
    () => [...(cercanosPorRegion?.values() ?? [])].reduce((total, lista) => total + lista.length, 0),
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
    const conEquipo = regiones.filter((r) => r.idEquipo != null).length;
    const advertencias = regiones.filter((r) => r.advertenciaMinimo).length;
    const base = `${regiones.length} ${regiones.length === 1 ? 'región' : 'regiones'} · ${totalHospitales} hospitales · ${conEquipo} con equipo · ${advertencias} ${advertencias === 1 ? 'advertencia' : 'advertencias'} · ${sinRegion.length} sin región`;
    return cercanosTotal > 0
      ? `${base} · ${cercanosTotal} ${cercanosTotal === 1 ? 'cercano' : 'cercanos'} en otras gerencias`
      : base;
  }, [regiones, totalHospitales, sinRegion.length, cercanosTotal]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{resumen}</p>

      <Accordion
        type="multiple"
        value={regionesAbiertas}
        onValueChange={onRegionesAbiertasChange}
      >
        {regiones.map((region) => (
          <RegionItem
            key={region.idRegion}
            region={region}
            hospitales={hospitalesPorRegion.get(region.idRegion) ?? []}
            equipos={equipos}
            editable={editable}
            onHoverRegion={onHoverRegion}
            onHoverHospital={onHoverHospital}
            onAsignarEquipo={onAsignarEquipo}
            onQuitarHospital={onQuitarHospital}
            onDividir={onDividir}
            hospitalesCercanos={cercanosPorRegion?.get(region.idRegion)}
          />
        ))}
      </Accordion>

      {sinRegion.length > 0 && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
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
                    <Select
                      onValueChange={(value) => void manejarMover(hospital, value)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue placeholder="Mover a región…" />
                      </SelectTrigger>
                      <SelectContent>
                        {regiones.map((region) => (
                          <SelectItem
                            key={region.idRegion}
                            value={String(region.idRegion)}
                          >
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
          {errorMover && (
            <p className="text-xs text-destructive">⚠ {errorMover}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Estos hospitales todavía no pertenecen a ninguna región.
          </p>
          {cercanosSinRegion.length > 0 && (
            <div className="space-y-1 border-t border-destructive/20 pt-2">
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
            Cerca, en otras gerencias — sin región ({cercanosSinRegion.length})
          </p>
          <CercanosList cercanos={cercanosSinRegion} />
          <p className="text-xs text-muted-foreground">
            Hospitales de otras gerencias con vigencia solapada, cuyo hospital
            propio más cercano no tiene región. Solo informativo.
          </p>
        </div>
      )}
    </div>
  );
}
