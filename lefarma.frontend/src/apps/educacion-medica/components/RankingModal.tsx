import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
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
import { Card, CardContent } from '@/components/ui/card';
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
  onAplicar: (hospitales: RankingHospitalItem[]) => void;
  guardando: boolean;
  cargando?: boolean;
  onRegenerar?: (cantidad: number) => void;
  cantidadDefault?: number | null;
  filtrosDisponibles?: FiltrosDisponibles | null;
  filtros?: RankingFiltrosForm;
  onFiltrosChange?: (filtros: RankingFiltrosForm) => void;
}

// Default generoso para el Top N: redondea hacia arriba a centenas para que el
// usuario tenga margen de elección (64 -> 100, 114 -> 200). El valor sigue siendo editable.
function redondearCien(n: number): number {
  return Math.max(100, Math.ceil(n / 100) * 100);
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
  cantidadDefault = null,
  filtrosDisponibles,
  filtros,
  onFiltrosChange,
}: RankingModalProps) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(() => {
    if (!ejecucion) return new Set<number>();
    // Default "lo que falta": pre-marcar los primeros max(0, N - ya agregados),
    // de modo que al aplicar la selección quede completa a N.
    const faltantes = Math.max(
      0,
      ejecucion.cantidadSolicitada - (ejecucion.cantidadYaAgregados ?? 0)
    );
    return new Set(
      [...ejecucion.ranking]
        .sort((a, b) => a.posicion - b.posicion)
        .slice(0, faltantes)
        .map((h) => h.idHospital)
    );
  });
  const [hospitalActivo, setHospitalActivo] = useState<RankingHospitalItem | null>(null);
  const [cantidadInput, setCantidadInput] = useState('');

  useEffect(() => {
    if (open) setCantidadInput(cantidadDefault ? String(redondearCien(cantidadDefault)) : '');
  }, [open, cantidadDefault]);

  const cantidadValida = /^\d+$/.test(cantidadInput.trim()) && Number(cantidadInput.trim()) > 0;

  const toggleSeleccion = useCallback((idHospital: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(idHospital)) {
        next.delete(idHospital);
      } else {
        next.add(idHospital);
      }
      return next;
    });
  }, []);

  const toggleTodos = useCallback(() => {
    if (!ejecucion) return;
    if (seleccionados.size === ejecucion.ranking.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(ejecucion.ranking.map((h) => h.idHospital)));
    }
  }, [ejecucion, seleccionados.size]);

  const seleccionadosOrdenados = useMemo(() => {
    if (!ejecucion) return [];
    return ejecucion.ranking.filter((h) => seleccionados.has(h.idHospital));
  }, [ejecucion, seleccionados]);

  const topSinCoordenadas = useMemo(() => {
    if (!ejecucion) return [];
    return ejecucion.ranking.filter(
      (h) => h.esTopSugerido && h.datoCoordenadasDisponible === false
    );
  }, [ejecucion]);

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

  const faltantes = useMemo(() => {
    if (!ejecucion) return 0;
    return Math.max(0, ejecucion.cantidadSolicitada - (ejecucion.cantidadYaAgregados ?? 0));
  }, [ejecucion]);

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
      ejecucion && ejecucion.ranking.length > 0
        ? seleccionados.size === ejecucion.ranking.length
        : false;
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
        cell: ({ row }) => (
          <div
            className="flex justify-center"
            onClick={(e) => {
              e.stopPropagation();
              toggleSeleccion(row.original.idHospital);
            }}
          >
            <Checkbox
              checked={seleccionados.has(row.original.idHospital)}
              aria-label="Seleccionar hospital"
            />
          </div>
        ),
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
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <div className="truncate text-sm font-medium">
              {row.original.nombreHospital ?? '—'}
            </div>
            {row.original.institucion && (
              <div className="truncate text-xs text-muted-foreground">
                {row.original.institucion}
              </div>
            )}
          </div>
        ),
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
  }, [ejecucion, seleccionados, toggleTodos, toggleSeleccion]);

  const handleAplicar = () => {
    onAplicar(seleccionadosOrdenados);
  };

  const generar = () => {
    if (cantidadValida) onRegenerar?.(Number(cantidadInput.trim()));
  };

  const campoCantidad = onRegenerar && (
    <div className="flex items-center gap-2">
      <label
        htmlFor="ranking-cantidad"
        className="whitespace-nowrap text-xs text-muted-foreground"
      >
        Top N sugeridos
      </label>
      <Input
        id="ranking-cantidad"
        type="number"
        min={1}
        className="h-8 w-24 text-sm"
        value={cantidadInput}
        onChange={(e) => setCantidadInput(e.target.value)}
        disabled={cargando || guardando}
      />
      {cantidadDefault ? (
        <span className="text-xs text-muted-foreground">
          Meta del mes: {cantidadDefault} · sugerido: {redondearCien(cantidadDefault)}
        </span>
      ) : (
        !cantidadValida && (
          <span className="text-xs text-muted-foreground">Captura cuántos hospitales sugerir</span>
        )
      )}
    </div>
  );

  const filtrosOpcionales = (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col">
          {ejecucion ? (
            <>
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>Selección asistida de hospitales</DialogTitle>
                <DialogDescription>
                  Configuración: {ejecucion.configuracion.nombre} (v{ejecucion.configuracion.version}) ·{' '}
                  {ejecucion.cantidadCandidatos} candidatos · {ejecucion.cantidadSolicitada} solicitados ·{' '}
                  {ejecucion.cantidadYaAgregados} ya en la selección · pre-marcados los primeros {faltantes}{' '}
                  (lo que falta para completar {ejecucion.cantidadSolicitada})
                </DialogDescription>
              </div>
              {onRegenerar && (
                <div className="flex items-center gap-3">
                  {campoCantidad}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generar}
                    disabled={guardando || cargando || !cantidadValida}
                    title="Descarta esta vista y genera una nueva ejecución del ranking con el Top N indicado"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generar de nuevo
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {resumen && (
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Seleccionados</p>
                  <p className="text-lg font-semibold">{resumen.seleccionados}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Datos completos (≥90%)</p>
                  <p className="text-lg font-semibold">{resumen.datosCompletos}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sin coordenadas</p>
                  <p className="text-lg font-semibold text-amber-600">{resumen.sinCoordenadas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Score promedio</p>
                  <p className="text-lg font-semibold">{resumen.scorePromedio.toFixed(1)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {topSinCoordenadas.length > 0 && (
            <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Hospitales sugeridos sin coordenadas</AlertTitle>
              <AlertDescription className="text-amber-800">
                {topSinCoordenadas.length} de los hospitales sugeridos no tienen coordenadas. El
                factor geográfico se evaluó con 50 neutral, por lo que el score puede no reflejar
                su distancia real. Considere capturar latitud/longitud antes de decidir.
              </AlertDescription>
            </Alert>
          )}

          {pesosEfectivos.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Pesos efectivos:</span>
              {pesosEfectivos.map(([clave, peso]) => (
                <Badge
                  key={clave}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                  title={catalogoFactores.get(clave)?.descripcion}
                >
                  {nombreFactor(clave)}: {Number(peso).toFixed(0)}%
                </Badge>
              ))}
            </div>
          )}

          {ejecucion.filtros && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium">Elegibilidad:</span>
              <span>
                {ejecucion.cantidadCandidatos} candidatos · Gerencia{' '}
                {ejecucion.filtros.gerencia?.descripcion ?? 'N/D'}
                {ejecucion.filtros.activo && ' · solo activos'}
                {ejecucion.filtros.excluyeYaAgregados && ' · sin ya agregados'}
                {ejecucion.filtros.excluyeTipos.length > 0 &&
                  ` · excluye ${ejecucion.filtros.excluyeTipos.join(' / ')}`}
              </span>
              {ejecucion.filtros.search && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  búsqueda: “{ejecucion.filtros.search}”
                </Badge>
              )}
              {ejecucion.filtros.codigoEstado && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  estado: {ejecucion.filtros.estadoNombre ?? ejecucion.filtros.codigoEstado}
                </Badge>
              )}
              {ejecucion.filtros.zonaMetropolitana !== undefined &&
                ejecucion.filtros.zonaMetropolitana !== null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {ejecucion.filtros.zonaMetropolitana ? 'local' : 'foráneo'}
                </Badge>
              )}
              {ejecucion.filtros.idRegion != null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  región: {ejecucion.filtros.nombreRegion ?? ejecucion.filtros.idRegion}
                </Badge>
              )}
              <span title={`Regla de elegibilidad: ${ejecucion.filtros.reglaVersion}`}>
                <Info className="h-3.5 w-3.5 cursor-help" />
              </span>
            </div>
          )}

          {filtrosOpcionales}

          <div>
            <DataTable
              columns={columns}
              data={ejecucion.ranking}
              title="Ranking generado"
              subtitle={`Hospitales ordenados por score. Seleccione los que desea agregar a la selección mensual.`}
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

          <DialogFooter className="sticky bottom-0 z-10 bg-background pt-2">
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
                  Agregar {seleccionados.size} hospital{seleccionados.size === 1 ? '' : 'es'}
                </span>
              )}
            </Button>
          </DialogFooter>
            </>
          ) : cargando ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando el ranking...</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Selección asistida de hospitales</DialogTitle>
                <DialogDescription>
                  Todavía no hay un ranking generado para esta selección. Ajusta los filtros
                  opcionales y genera uno nuevo; podrás regenerarlo cuantas veces necesites
                  antes de agregar hospitales.
                </DialogDescription>
              </DialogHeader>
              {filtrosOpcionales}
              <DialogFooter className="sticky bottom-0 z-10 bg-background pt-2">
                <div className="flex w-full items-center justify-between gap-2">
                  {campoCantidad ?? <span />}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
                      Cancelar
                    </Button>
                    {onRegenerar && (
                      <Button onClick={generar} disabled={cargando || !cantidadValida}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generar ranking
                      </Button>
                    )}
                  </div>
                </div>
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
