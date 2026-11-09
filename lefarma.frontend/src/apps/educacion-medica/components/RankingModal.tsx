import { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  Info,
  Loader2,
  MapPin,
  Presentation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnDef } from '@/components/ui/data-table';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  type RankingEjecucion,
  type RankingHospitalItem,
  type FiltrosDisponibles,
} from '../types/educacionMedica.types';
import { cn } from '@/lib/utils';

interface RankingFiltrosForm {
  search: string;
  codigoEstado: string | null;
  zonaMetropolitana: boolean | null; // keep
  idRegion: number | null;
}

interface RankingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ejecucion: RankingEjecucion | null;
  onAplicar: (hospitales: RankingHospitalItem[], productos: Record<number, string>) => void;
  guardando: boolean;
  cargando?: boolean;
  onRegenerar?: (cantidad: number) => void;
  objetivoTalleres?: number | null;
  gerenciaNombre?: string | null;
  idsHospitalesSeleccionados?: number[];
  filtrosDisponibles?: FiltrosDisponibles | null;
  filtros?: RankingFiltrosForm;
  onFiltrosChange?: (filtros: RankingFiltrosForm) => void;
}

// El Top N se calcula desde el objetivo de talleres, siempre en múltiplos de 50.
function redondearCincuenta(n: number): number {
  return Math.max(50, Math.ceil(n / 50) * 50);
}

function ScoreBar({ score }: { score: number }) {  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right text-xs font-semibold tabular-nums">
        {score.toFixed(1)}
      </span>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CompletenessBadge({ pct }: { pct: number }) {
  const variant = pct >= 90 ? 'default' : pct >= 70 ? 'secondary' : 'destructive';
  return (
    <Badge
      variant={variant}
      className="text-[10px] px-1.5 py-0 cursor-help"
      title={`Datos completos: ${pct.toFixed(0)}% de los factores tienen información disponible para este hospital.`}
    >
      {pct.toFixed(0)}%
    </Badge>
  );
}

function DatoResumen({
  label,
  value,
  tono,
}: {
  label: string;
  value: string | number;
  tono?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className={['text-sm font-semibold tabular-nums', tono ?? 'text-foreground'].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function DatoCompacto({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

const ICONO_PESO: Record<string, typeof Activity> = {
  anestesias_totales: Activity,
  numero_quirofanos: Building2,
  recencia_seleccion: Clock3,
  agrupabilidad_geografica: MapPin,
  cobertura_taller: Presentation,
};

const TONO_PESO: Record<string, string> = {
  anestesias_totales: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  numero_quirofanos: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  recencia_seleccion: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  agrupabilidad_geografica:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  cobertura_taller: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
};

// Etiqueta del estado de cobertura a partir del score del factor (los valores
// 100/90/10 son el contrato del motor, ver RankingScoreEngine.CalcularCoberturaTaller).
function etiquetaCobertura(score: number): string | null {
  if (score <= 10) return 'Taller realizado';
  if (score >= 100) return 'Nunca seleccionado';
  if (score >= 90) return 'Taller pendiente';
  return null;
}

export function RankingModal({
  open,
  onOpenChange,
  ejecucion,
  onAplicar,
  guardando,
  cargando = false,
  onRegenerar,
  objetivoTalleres = null,
  gerenciaNombre = null,
  idsHospitalesSeleccionados = [],
  filtrosDisponibles,
  filtros,
  onFiltrosChange,
}: RankingModalProps) {
  const objetivo =
    objetivoTalleres && objetivoTalleres > 0
      ? objetivoTalleres
      : (ejecucion?.cantidadSolicitada ?? 50);
  const topN = redondearCincuenta(objetivo);
  const idsSeleccionados = useMemo(
    () => new Set(idsHospitalesSeleccionados),
    [idsHospitalesSeleccionados]
  );

  const [seleccionados, setSeleccionados] = useState<Set<number>>(() => {
    if (!ejecucion) return new Set<number>();
    // Se preseleccionan los primeros hospitales necesarios para cubrir el objetivo
    // del mes, descontando los que ya están en la selección.
    const faltantes = Math.max(
      0,
      objetivo - (ejecucion.cantidadYaAgregados ?? 0)
    );
    return new Set(
      [...ejecucion.ranking]
        .filter((h) => !idsSeleccionados.has(h.idHospital))
        .sort((a, b) => a.posicion - b.posicion)
        .slice(0, faltantes)
        .map((h) => h.idHospital)
    );
  });
  const [hospitalActivo, setHospitalActivo] = useState<RankingHospitalItem | null>(null);
  /** Producto a promocionar por hospital (opcional, FOR-004). */
  const [productos, setProductos] = useState<Record<number, string>>({});
  const [detallesAbierto, setDetallesAbierto] = useState(false);

  const disponibles = useMemo(
    () => ejecucion?.ranking.filter((h) => !idsSeleccionados.has(h.idHospital)) ?? [],
    [ejecucion, idsSeleccionados]
  );

  const toggleSeleccion = useCallback(
    (idHospital: number) => {
      if (idsSeleccionados.has(idHospital)) return;
      setSeleccionados((prev) => {
        const next = new Set(prev);
        if (next.has(idHospital)) {
          next.delete(idHospital);
        } else {
          next.add(idHospital);
        }
        return next;
      });
    },
    [idsSeleccionados]
  );

  const toggleTodos = useCallback(() => {
    const idsDisponibles = disponibles.map((h) => h.idHospital);
    if (seleccionados.size === idsDisponibles.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(idsDisponibles));
    }
  }, [disponibles, seleccionados.size]);

  const seleccionadosOrdenados = useMemo(() => {
    if (!ejecucion) return [];
    return ejecucion.ranking.filter((h) => seleccionados.has(h.idHospital));
  }, [ejecucion, seleccionados]);

  const topSinCoordenadas = useMemo(() => {
    if (!ejecucion) return [];
    return ejecucion.ranking.filter(
      (h) =>
        !idsSeleccionados.has(h.idHospital) &&
        h.esTopSugerido &&
        h.datoCoordenadasDisponible === false
    );
  }, [ejecucion, idsSeleccionados]);

  const resumen = useMemo(() => {
    if (!ejecucion) return null;
    const seleccionadosData = ejecucion.ranking.filter((h) =>
      seleccionados.has(h.idHospital)
    );
    const datosCompletos = seleccionadosData.filter(
      (h) => h.porcentajeCompletitud >= 90
    ).length;
    const sinCoordenadas = seleccionadosData.filter(
      (h) => h.datoCoordenadasDisponible === false
    ).length;
    const scorePromedio =
      seleccionadosData.length > 0
        ? seleccionadosData.reduce((sum, h) => sum + h.scoreTotal, 0) /
          seleccionadosData.length
        : 0;
    return {
      seleccionados: seleccionadosData.length,
      datosCompletos,
      sinCoordenadas,
      scorePromedio,
    };
  }, [ejecucion, seleccionados]);

  const pesosEfectivos = useMemo(() => {
    return Object.entries(ejecucion?.pesosEfectivos ?? {}).sort((a, b) => b[1] - a[1]);
  }, [ejecucion]);

  const faltantesObjetivo = useMemo(() => {
    if (!ejecucion) return 0;
    return Math.max(0, objetivo - (ejecucion.cantidadYaAgregados ?? 0));
  }, [ejecucion, objetivo]);

  const catalogoFactores = useMemo(() => {
    const map = new Map<string, { nombre: string; descripcion: string }>();
    (ejecucion?.factoresCatalogo ?? []).forEach((f) =>
      map.set(f.clave, { nombre: f.nombre, descripcion: f.descripcion })
    );
    return map;
  }, [ejecucion]);

  const nombreFactor = useCallback(
    (clave: string) => catalogoFactores.get(clave)?.nombre ?? clave,
    [catalogoFactores]
  );

  const filtrosForm = filtros ?? { search: '', codigoEstado: null, zonaMetropolitana: null, idRegion: null };
  const hayFiltrosAplicados =
    filtrosForm.search ||
    filtrosForm.codigoEstado ||
    filtrosForm.zonaMetropolitana !== null ||
    filtrosForm.idRegion !== null;

  const handleSearchChange = (value: string) =>
    onFiltrosChange?.({ ...filtrosForm, search: value });

  const handleEstadoChange = (value: string) =>
    onFiltrosChange?.({
      ...filtrosForm,
      codigoEstado: value === 'todos' ? null : value,
    });

  const handleZonaMetropolitanaChange = (value: string) =>
    onFiltrosChange?.({
      ...filtrosForm,
      zonaMetropolitana:
        value === 'todos' ? null : value === 'local' ? true : false,
    });

  const handleRegionChange = (value: string) =>
    onFiltrosChange?.({
      ...filtrosForm,
      idRegion: value === 'todas' ? null : Number(value),
    });

  const limpiarFiltros = () =>
    onFiltrosChange?.({ search: '', codigoEstado: null, zonaMetropolitana: null, idRegion: null });

  const columns = useMemo<ColumnDef<RankingHospitalItem>[]>(() => {
    const allSelected =
      disponibles.length > 0 && seleccionados.size === disponibles.length;
    const someSelected = seleccionados.size > 0;
    return [
      {
        id: 'select',
        header: () => (
          <div className="flex justify-center">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleTodos}
              aria-label="Seleccionar todos"
            />
          </div>
        ),
        cell: ({ row }) => {
          const yaEsta = idsSeleccionados.has(row.original.idHospital);
          return (
            <div
              className="flex justify-center"
              onClick={(e) => {
                e.stopPropagation();
                toggleSeleccion(row.original.idHospital);
              }}
            >
              <Checkbox
                checked={yaEsta || seleccionados.has(row.original.idHospital)}
                disabled={yaEsta}
                aria-label={yaEsta ? 'Ya está en la selección' : 'Seleccionar hospital'}
              />
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
        meta: { width: '40px' },
      },
      {
        accessorKey: 'posicion',
        header: '#',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {row.original.posicion}
          </span>
        ),
      },
      {
        accessorKey: 'nombreHospital',
        header: 'Hospital',
        cell: ({ row }) => {
          const yaEsta = idsSeleccionados.has(row.original.idHospital);
          return (
            <div className="max-w-[220px]">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {row.original.nombreHospital ?? '—'}
                </span>
                {yaEsta && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    En selección
                  </Badge>
                )}
              </div>
              {row.original.institucion && (
                <div className="truncate text-xs text-muted-foreground">
                  {row.original.institucion}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'producto',
        header: 'Producto a promocionar',
        cell: ({ row }) => {
          const yaEsta = idsSeleccionados.has(row.original.idHospital);
          return (
            <Input
              className="h-8 w-44 text-xs"
              placeholder="Opcional"
              value={productos[row.original.idHospital] ?? ''}
              disabled={yaEsta || !seleccionados.has(row.original.idHospital)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                setProductos((prev) => ({ ...prev, [row.original.idHospital]: e.target.value }))
              }
            />
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'ciudadMunicipio',
        header: 'Estado / Ciudad',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.entidadFederativa ? (
              <>
                <span className="font-medium text-foreground">{row.original.entidadFederativa}</span>
                {row.original.ciudadMunicipio && (
                  <span> / {row.original.ciudadMunicipio}</span>
                )}
              </>
            ) : (
              row.original.ciudadMunicipio ?? '—'
            )}
          </div>
        ),
      },
      {
        accessorKey: 'scoreTotal',
        header: 'Score',
        cell: ({ row }) => <ScoreBar score={row.original.scoreTotal} />,
      },
      {
        id: 'recencia',
        header: () => (
          <div className="flex items-center gap-1">
            <span>Recencia</span>
            <span title="Tiempo desde la última selección del hospital y estado de cobertura del taller (si el factor está activo).">
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const recencia = row.original.factores.find((f) => f.clave === 'recencia_seleccion');
          const cobertura = row.original.factores.find((f) => f.clave === 'cobertura_taller');
          const meses = recencia?.valorCrudo ?? null;
          const etiquetaCob = cobertura?.aplicado ? etiquetaCobertura(cobertura.scoreFactor) : null;
          return (
            <div className="flex flex-col items-start gap-1">
              {meses === null ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Nunca
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  hace {meses} mes{meses === 1 ? '' : 'es'}
                </span>
              )}
              {etiquetaCob && etiquetaCob !== 'Nunca seleccionado' && (
                <Badge
                  variant="outline"
                  className={
                    etiquetaCob === 'Taller realizado'
                      ? 'text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-300'
                      : 'text-[10px] px-1.5 py-0 text-amber-700 border-amber-300'
                  }
                >
                  {etiquetaCob}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'badges',
        header: () => (
          <div className="flex items-center gap-1">
            <span>Indicadores</span>
            <span title="Porcentaje: cuántos de los factores del algoritmo tienen datos disponibles.">
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <CompletenessBadge pct={row.original.porcentajeCompletitud} />
            {row.original.datoCoordenadasDisponible === false && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] px-1.5 py-0 text-amber-600 border-amber-300"
                title="Faltan coordenadas: el factor geográfico se evaluó con 50 neutral"
              >
                <MapPin className="h-3 w-3" />
                Sin coordenadas
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setHospitalActivo(row.original);
            }}
            title="Ver factores"
          >
            <Info className="h-4 w-4" />
          </Button>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ];
  }, [disponibles, idsSeleccionados, seleccionados, toggleTodos, toggleSeleccion, productos]);

  const handleAplicar = () => {
    onAplicar(seleccionadosOrdenados, productos);
  };

  const generar = () => {
    onRegenerar?.(topN);
  };

  const preMarcados = ejecucion
    ? Math.min(faltantesObjetivo, ejecucion.ranking.length)
    : objetivo;

  const resumenTopN = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border bg-white px-3 py-2 text-xs shadow-sm dark:bg-slate-950/40">
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-muted-foreground">Top N sugeridos</span>
        <strong className="text-base tabular-nums">{topN}</strong>
      </span>
      <span className="text-muted-foreground">
        Objetivo del mes <strong className="text-foreground">{objetivo}</strong>
      </span>
      <span className="text-muted-foreground">
        Pre-marcados <strong className="text-foreground">{preMarcados}</strong>
      </span>
      {ejecucion && (
        <>
          <span className="text-muted-foreground">
            Candidatos <strong className="text-foreground">{ejecucion.cantidadCandidatos}</strong>
          </span>
          <span className="text-muted-foreground">
            Ya en selección{' '}
            <strong className="text-foreground">{ejecucion.cantidadYaAgregados}</strong>
          </span>
          <span className="text-[10px] text-muted-foreground">
            {ejecucion.configuracion.nombre} v{ejecucion.configuracion.version}
          </span>
        </>
      )}
    </div>
  );

  const filtrosResumen = useMemo(() => {
    const estado = filtros?.codigoEstado
      ? (filtrosDisponibles?.estados.find((item) => item.codigo === filtros.codigoEstado)?.nombre ??
        filtros.codigoEstado)
      : null;
    const region = filtros?.idRegion != null
      ? (filtrosDisponibles?.regiones.find((item) => item.idRegion === filtros.idRegion)?.nombre ??
        `Región ${filtros.idRegion}`)
      : null;

    return [
      gerenciaNombre ? `Gerencia: ${gerenciaNombre}` : 'Gerencia de la selección',
      estado ? `Estado: ${estado}` : null,
      region ? `Región: ${region}` : null,
      filtros?.zonaMetropolitana != null
        ? (filtros.zonaMetropolitana ? 'Local' : 'Foráneo')
        : null,
      filtros?.search ? `Búsqueda: ${filtros.search}` : null,
    ].filter((item): item is string => Boolean(item));
  }, [filtros, filtrosDisponibles, gerenciaNombre]);

  const filtrosOpcionales = (
    <div className="space-y-3 rounded-lg border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Filtros opcionales</p>
        {hayFiltrosAplicados && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={limpiarFiltros}
            disabled={cargando}
          >
            <X className="mr-1 h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar hospital o ciudad..."
            className="pl-9 text-sm"
            value={filtrosForm.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            disabled={cargando}
          />
        </div>
        <Select
          value={filtrosForm.codigoEstado ?? 'todos'}
          onValueChange={handleEstadoChange}
          disabled={cargando || !filtrosDisponibles}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {(filtrosDisponibles?.estados ?? []).map((estado) => (
              <SelectItem key={estado.codigo} value={estado.codigo}>
                {estado.nombre ?? estado.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={
            filtrosForm.zonaMetropolitana === null
              ? 'todos'
              : filtrosForm.zonaMetropolitana
                ? 'local'
                : 'foraneo'
          }
          onValueChange={handleZonaMetropolitanaChange}
          disabled={cargando || !filtrosDisponibles}
        >
          <SelectTrigger>
            <SelectValue placeholder="Local / Foráneo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Local / Foráneo</SelectItem>
            <SelectItem value="local">
              Local ({filtrosDisponibles?.locales ?? 0})
            </SelectItem>
            <SelectItem value="foraneo">
              Foráneo ({filtrosDisponibles?.foraneos ?? 0})
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filtrosForm.idRegion != null ? String(filtrosForm.idRegion) : 'todas'}
          onValueChange={handleRegionChange}
          disabled={cargando || !filtrosDisponibles}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas las regiones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las regiones</SelectItem>
            {(filtrosDisponibles?.regiones ?? []).map((region) => (
              <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                {region.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          {ejecucion ? (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
                <DialogHeader className="pr-8">
                  <DialogTitle>Selección asistida de hospitales</DialogTitle>
                  <DialogDescription>Hospitales ordenados por score.</DialogDescription>
                </DialogHeader>

                <Collapsible open={detallesAbierto} onOpenChange={setDetallesAbierto}>
                  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                          aria-expanded={detallesAbierto}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition-colors group-hover:text-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-800">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-300">
                              Resumen y elegibilidad
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              Top N {topN} · Objetivo {objetivo}
                              {resumen && ` · ${resumen.seleccionados} seleccionados`}
                            </span>
                          </span>
                          <ChevronDown
                            className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${detallesAbierto ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="border-t border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-950/30">
                      <div className="grid divide-y divide-slate-200/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800">
                        <section className="px-3 py-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                            Parámetros
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                            <DatoCompacto label="Top N" value={topN} />
                            <DatoCompacto label="Objetivo" value={objetivo} />
                            <DatoCompacto label="Pre-marcados" value={preMarcados} />
                            <DatoCompacto label="Candidatos" value={ejecucion.cantidadCandidatos} />
                            <DatoCompacto
                              label="Ya en selección"
                              value={ejecucion.cantidadYaAgregados}
                            />
                          </div>
                          <p className="mt-2 truncate text-[10px] text-muted-foreground">
                            {ejecucion.configuracion.nombre} v{ejecucion.configuracion.version}
                          </p>
                        </section>

                        <section className="px-3 py-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                            Selección
                          </p>
                          {resumen ? (
                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                              <DatoResumen label="Seleccionados" value={resumen.seleccionados} />
                              <DatoResumen
                                label="Datos completos ≥90%"
                                value={resumen.datosCompletos}
                              />
                              <DatoResumen
                                label="Sin coordenadas"
                                value={resumen.sinCoordenadas}
                                tono={resumen.sinCoordenadas > 0 ? 'text-amber-600' : undefined}
                              />
                              <DatoResumen
                                label="Score promedio"
                                value={resumen.scorePromedio.toFixed(1)}
                              />
                            </div>
                          ) : (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                              Sin datos de selección.
                            </p>
                          )}
                        </section>

                        <section className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                              Elegibilidad
                            </p>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex cursor-help items-center text-slate-400"
                                    tabIndex={0}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  La elegibilidad se calcula con la gerencia de la selección, el
                                  estatus activo, los hospitales ya agregados y los tipos
                                  excluidos. Regla: {ejecucion.filtros?.reglaVersion ?? 'N/D'}.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {ejecucion.filtros ? (
                            <>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {ejecucion.cantidadCandidatos} candidatos
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Gerencia: {ejecucion.filtros.gerencia?.descripcion ?? 'N/D'}
                                </Badge>
                                {ejecucion.filtros.activo && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Solo activos
                                  </Badge>
                                )}
                                {ejecucion.filtros.excluyeYaAgregados && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Sin ya agregados
                                  </Badge>
                                )}
                                {ejecucion.filtros.excluyeTipos.length > 0 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Excluye: {ejecucion.filtros.excluyeTipos.join(' / ')}
                                  </Badge>
                                )}
                                {ejecucion.filtros.codigoEstado && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Estado:{' '}
                                    {ejecucion.filtros.estadoNombre ??
                                      ejecucion.filtros.codigoEstado}
                                  </Badge>
                                )}
                                {ejecucion.filtros.idRegion != null && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Región:{' '}
                                    {ejecucion.filtros.nombreRegion ?? ejecucion.filtros.idRegion}
                                  </Badge>
                                )}
                                {ejecucion.filtros.zonaMetropolitana !== undefined &&
                                  ejecucion.filtros.zonaMetropolitana !== null && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {ejecucion.filtros.zonaMetropolitana ? 'Local' : 'Foráneo'}
                                  </Badge>
                                )}
                                {ejecucion.filtros.search && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Búsqueda: “{ejecucion.filtros.search}”
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-[10px] text-muted-foreground">
                                Regla: {ejecucion.filtros.reglaVersion}
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                              Sin filtros de elegibilidad registrados.
                            </p>
                          )}
                        </section>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {topSinCoordenadas.length > 0 && (
                  <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-900">
                      Hospitales sugeridos sin coordenadas
                    </AlertTitle>
                    <AlertDescription className="text-amber-800">
                      {topSinCoordenadas.length} de los hospitales sugeridos no tienen coordenadas.
                      El factor geográfico se evaluó con 50 neutral, por lo que el score puede no
                      reflejar su distancia real. Considere capturar latitud/longitud antes de
                      decidir.
                    </AlertDescription>
                  </Alert>
                )}

                {pesosEfectivos.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Pesos efectivos
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                      {pesosEfectivos.map(([clave, peso]) => {
                        const Icon = ICONO_PESO[clave] ?? Gauge;
                        return (
                          <div
                            key={clave}
                            className="flex items-center gap-2 rounded-lg border bg-slate-50 px-2 py-1.5 dark:bg-slate-900/60"
                            title={catalogoFactores.get(clave)?.descripcion}
                          >
                            <span
                              className={[
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                                TONO_PESO[clave] ?? 'bg-muted text-muted-foreground',
                              ].join(' ')}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {nombreFactor(clave)}
                              </p>
                              <p className="text-sm font-semibold tabular-nums">
                                {Number(peso).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filtrosOpcionales}

                <div>
                  <DataTable
                    columns={columns}
                    data={ejecucion.ranking}
                    title="Ranking generado"
                    subtitle="Hospitales ordenados por score. Seleccione los que desea agregar a la selección mensual."
                    globalFilter
                    pagination={false}
                    height={340}
                    onRowClick={(row) => setHospitalActivo(row)}
                    isRowSelected={(row) => seleccionados.has(row.idHospital)}
                    footer={
                      <span className="text-xs text-muted-foreground">
                        Seleccionados:{' '}
                        <strong className="text-foreground">{seleccionados.size}</strong>
                      </span>
                    }
                  />
                </div>
              </div>

              <DialogFooter className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-6 py-3 sm:justify-between">
                <div>
                  {onRegenerar && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generar}
                      disabled={guardando || cargando}
                      className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300"
                      title="Descarta esta vista y genera una nueva ejecución del ranking con el Top N calculado"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generar de nuevo
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={guardando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAplicar}
                    disabled={guardando || seleccionados.size === 0}
                  >
                    {guardando ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Agregando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        Agregar {seleccionados.size} hospital
                        {seleccionados.size === 1 ? '' : 'es'}
                      </span>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : cargando ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando el ranking...</p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
                <DialogHeader className="pr-8">
                  <DialogTitle>Selección asistida de hospitales</DialogTitle>
                  <DialogDescription>Hospitales ordenados por score.</DialogDescription>
                </DialogHeader>
                {resumenTopN}
                {filtrosOpcionales}
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
                  <div className="flex flex-col items-center bg-gradient-to-br from-slate-50 via-white to-orange-50/50 px-6 py-6 text-center dark:from-slate-950 dark:via-slate-950 dark:to-orange-950/20">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100 dark:bg-slate-900 dark:ring-orange-900/60">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                      Aún no hay ranking para esta selección
                    </p>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Genera el ranking para ver los hospitales sugeridos con la gerencia y los
                      filtros seleccionados.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                      {filtrosResumen.map((filtro) => (
                        <Badge
                          key={filtro}
                          variant="secondary"
                          className="text-[10px] px-2 py-0.5"
                        >
                          {filtro}
                        </Badge>
                      ))}
                    </div>

                    {onRegenerar ? (
                      <Button
                        className="mt-5 rounded-xl bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
                        onClick={generar}
                        disabled={cargando}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar ranking
                      </Button>
                    ) : (
                      <p className="mt-4 max-w-sm rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                        No tienes permiso para generar el ranking de esta selección.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!hospitalActivo} onOpenChange={(open) => !open && setHospitalActivo(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{hospitalActivo?.nombreHospital ?? 'Detalle'}</SheetTitle>
            <SheetDescription>
              Score total: {hospitalActivo?.scoreTotal.toFixed(2)} · Completitud:{' '}
              {hospitalActivo?.porcentajeCompletitud.toFixed(0)}%
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-semibold">Factores evaluados</h4>
            {hospitalActivo?.factores.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin factores registrados.</p>
            )}
            {hospitalActivo?.factores.map((factor, idx) => (
              <div
                key={`${factor.clave}-${idx}`}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  factor.aplicado ? 'bg-card' : 'bg-muted/50 opacity-80'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {nombreFactor(factor.clave)}
                    {factor.grupo && (
                      <span className="ml-1 text-xs text-muted-foreground">({factor.grupo})</span>
                    )}
                  </span>
                  <Badge variant={factor.aplicado ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                    {factor.aplicado ? 'Aplicado' : 'No aplica'}
                  </Badge>
                </div>
                {catalogoFactores.get(factor.clave)?.descripcion && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {catalogoFactores.get(factor.clave)!.descripcion}
                  </p>
                )}
                {factor.aplicado ? (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Valor crudo:</span>
                    <span className="text-right tabular-nums">
                      {factor.clave === 'cobertura_taller'
                        ? (etiquetaCobertura(factor.scoreFactor) ?? 'N/D')
                        : (factor.valorCrudo?.toLocaleString() ?? 'N/D')}
                    </span>
                    <span className="text-muted-foreground">Score factor:</span>
                    <span className="text-right tabular-nums">{factor.scoreFactor.toFixed(2)}</span>
                    <span className="text-muted-foreground">Peso efectivo:</span>
                    <span className="text-right tabular-nums">
                      {factor.pesoEfectivo.toFixed(0)}%
                    </span>
                    <span className="font-semibold">Puntos:</span>
                    <span className="text-right tabular-nums font-semibold">
                      {factor.puntosAportados.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {factor.motivoNoAplicado ?? 'Factor no aplicado.'}
                  </p>
                )}
              </div>
            ))}

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">¿Qué significa cada valor?</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>Valor crudo:</strong> dato original del hospital (ej. número de anestesias, quirófanos, meses desde la última visita).
                </li>
                <li>
                  <strong>Score factor:</strong> ese dato convertido a una escala de 0 a 100 para poder compararlo con los demás factores.
                </li>
                <li>
                  <strong>Peso efectivo:</strong> importancia real que tuvo este factor en este ranking (suman 100%). Si un factor no tiene variabilidad, su peso se redistribuye a los demás.
                </li>
                <li>
                  <strong>Puntos:</strong> contribución de este factor al score total = score factor × peso efectivo.
                </li>
              </ul>
              <p>
                El <strong>100%</strong> en la columna de indicadores significa que todos los factores tienen datos disponibles para ese hospital, no que todos los hospitales sean iguales. Si un hospital tuviera datos faltantes, el porcentaje bajaría.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
