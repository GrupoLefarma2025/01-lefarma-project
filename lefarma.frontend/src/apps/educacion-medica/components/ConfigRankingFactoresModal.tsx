import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Eye, Loader2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ConfigRanking,
  ConfigRankingFactor,
  UpsertConfigRankingFactorRequest,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface ConfigRankingFactoresModalProps {
  idConfiguracion: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado?: () => void;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-MX');
}

// Defaults espejo de RankingScoreEngine (tramos de recencia y scores de cobertura);
// se usan cuando el parametros_json del factor falta o está malformado.
const RECENCIA_DEFAULTS = { nunca: 100, reciente: 10, t12: 90, t6: 70, t3: 40 };
const COBERTURA_DEFAULTS = { nunca: 100, pendiente: 90, realizado: 10 };

type RecenciaParams = typeof RECENCIA_DEFAULTS;
type CoberturaParams = typeof COBERTURA_DEFAULTS;

function parseRecencia(json: string | null | undefined): RecenciaParams {
  if (!json) return { ...RECENCIA_DEFAULTS };
  try {
    const p = JSON.parse(json) as {
      nunca?: number;
      reciente?: number;
      tramos?: { meses_min?: number; score?: number }[];
    };
    const t12 = p.tramos?.find((t) => t.meses_min === 12)?.score;
    const t6 = p.tramos?.find((t) => t.meses_min === 6)?.score;
    const t3 = p.tramos?.find((t) => t.meses_min === 3)?.score;
    return {
      nunca: p.nunca ?? RECENCIA_DEFAULTS.nunca,
      reciente: p.reciente ?? RECENCIA_DEFAULTS.reciente,
      t12: t12 ?? RECENCIA_DEFAULTS.t12,
      t6: t6 ?? RECENCIA_DEFAULTS.t6,
      t3: t3 ?? RECENCIA_DEFAULTS.t3,
    };
  } catch {
    return { ...RECENCIA_DEFAULTS };
  }
}

function parseCobertura(json: string | null | undefined): CoberturaParams {
  if (!json) return { ...COBERTURA_DEFAULTS };
  try {
    const p = JSON.parse(json) as Partial<CoberturaParams>;
    return {
      nunca: p.nunca ?? COBERTURA_DEFAULTS.nunca,
      pendiente: p.pendiente ?? COBERTURA_DEFAULTS.pendiente,
      realizado: p.realizado ?? COBERTURA_DEFAULTS.realizado,
    };
  } catch {
    return { ...COBERTURA_DEFAULTS };
  }
}

function parseRadioKm(json: string | null | undefined): number | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as { radio_km?: number };
    return p.radio_km ?? null;
  } catch {
    return null;
  }
}

function serializarParametros(
  clave: string,
  radioKm: number | null,
  recenciaParams: RecenciaParams,
  coberturaParams: CoberturaParams
): string | null {
  if (clave === 'agrupabilidad_geografica') {
    return radioKm != null ? JSON.stringify({ radio_km: radioKm }) : null;
  }
  if (clave === 'recencia_seleccion') {
    return JSON.stringify({
      nunca: recenciaParams.nunca,
      reciente: recenciaParams.reciente,
      tramos: [
        { meses_min: 12, score: recenciaParams.t12 },
        { meses_min: 6, score: recenciaParams.t6 },
        { meses_min: 3, score: recenciaParams.t3 },
      ],
    });
  }
  if (clave === 'cobertura_taller') {
    return JSON.stringify(coberturaParams);
  }
  return null;
}

export default function ConfigRankingFactoresModal({
  idConfiguracion,
  open,
  onOpenChange,
  onGuardado,
}: ConfigRankingFactoresModalProps) {
  const [config, setConfig] = useState<ConfigRanking | null>(null);
  const [cargando, setCargando] = useState(false);

  // Edición de la información general de la configuración (la vigencia es
  // automatica: inicia al crear la versión y cierra al crear la siguiente)
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [guardandoInfo, setGuardandoInfo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [activo, setActivo] = useState(true);

  // Detalle / edición de un factor
  const [factorDetalle, setFactorDetalle] = useState<ConfigRankingFactor | null>(null);
  const [factorEditando, setFactorEditando] = useState(false);
  const [guardandoFactor, setGuardandoFactor] = useState(false);
  const [nombreFactor, setNombreFactor] = useState('');
  const [descripcionFactor, setDescripcionFactor] = useState('');
  const [pesoFactor, setPesoFactor] = useState(0);
  const [activoFactor, setActivoFactor] = useState(true);
  const [radioKm, setRadioKm] = useState<number | null>(null);
  const [recenciaParams, setRecenciaParams] = useState<RecenciaParams>(RECENCIA_DEFAULTS);
  const [coberturaParams, setCoberturaParams] = useState<CoberturaParams>(COBERTURA_DEFAULTS);

  const cargar = async () => {
    if (!idConfiguracion) {
      setConfig(null);
      return;
    }

    setCargando(true);
    try {
      const response = await educacionMedicaApi.configRanking.getById(idConfiguracion);
      if (response.data.success) {
        const data = response.data.data ?? null;
        setConfig(data);
        if (data) {
          setNombre(data.nombre);
          setActivo(data.activo);
        }
      } else {
        toast.error(response.data.message ?? 'Error al cargar la configuración');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar la configuración');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (open && idConfiguracion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idConfiguracion]);

  const puedeEditar = !!config && !config.usada;

  const abrirDetalleFactor = (factor: ConfigRankingFactor) => {
    setFactorDetalle(factor);
    setFactorEditando(puedeEditar);
    setNombreFactor(factor.nombre);
    setDescripcionFactor(factor.descripcion);
    setPesoFactor(factor.peso);
    setActivoFactor(factor.activo);
    setRadioKm(parseRadioKm(factor.parametrosJson));
    setRecenciaParams(parseRecencia(factor.parametrosJson));
    setCoberturaParams(parseCobertura(factor.parametrosJson));
  };

  const cerrarDetalleFactor = () => {
    setFactorDetalle(null);
    setFactorEditando(false);
  };

  const aUpsertFactor = (f: ConfigRankingFactor): UpsertConfigRankingFactorRequest => ({
    clave: f.clave,
    grupo: f.grupo,
    nombre: f.nombre,
    descripcion: f.descripcion,
    peso: f.peso,
    activo: f.activo,
    tipoNormalizacion: f.tipoNormalizacion,
    parametrosJson: f.parametrosJson,
  });

  const guardarInfo = async () => {
    if (!config) return;
    setGuardandoInfo(true);
    try {
      const response = await educacionMedicaApi.configRanking.update(config.idConfiguracion, {
        nombre,
        activo,
        factores: config.factores.map(aUpsertFactor),
      });
      if (response.data.success) {
        toast.success('Información de la configuración actualizada.');
        setEditandoInfo(false);
        await cargar();
        onGuardado?.();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la configuración');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar la configuración');
    } finally {
      setGuardandoInfo(false);
    }
  };

  const guardarFactor = async () => {
    if (!config || !factorDetalle) return;

    if (activoFactor) {
      const sumaOtros = config.factores
        .filter((f) => f.clave !== factorDetalle.clave && f.activo)
        .reduce((sum, f) => sum + f.peso, 0);
      const sumaTotal = sumaOtros + pesoFactor;
      if (Math.abs(sumaTotal - 100) > 0.01) {
        toast.error(
          `Los pesos activos deben sumar 100; con este factor sumarían ${sumaTotal.toFixed(2)}.`
        );
        return;
      }
    }

    setGuardandoFactor(true);
    try {
      const factoresPayload = config.factores.map((f) => {
        if (f.clave !== factorDetalle.clave) return aUpsertFactor(f);
        return {
          clave: f.clave,
          grupo: f.grupo,
          nombre: nombreFactor,
          descripcion: descripcionFactor,
          peso: pesoFactor,
          activo: activoFactor,
          tipoNormalizacion: f.tipoNormalizacion,
          parametrosJson: serializarParametros(f.clave, radioKm, recenciaParams, coberturaParams) ?? f.parametrosJson,
        };
      });

      const response = await educacionMedicaApi.configRanking.update(config.idConfiguracion, {
        nombre: config.nombre,
        activo: config.activo,
        factores: factoresPayload,
      });

      if (response.data.success) {
        toast.success('Factor actualizado.');
        cerrarDetalleFactor();
        await cargar();
        onGuardado?.();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el factor');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar el factor');
    } finally {
      setGuardandoFactor(false);
    }
  };

  const pesoTotal = (config?.factores ?? [])
    .filter((f) => f.activo)
    .reduce((sum, f) => sum + f.peso, 0);
  const pesosValidos = Math.abs(pesoTotal - 100) < 0.01;

  const columnsFactores = [
    {
      accessorKey: 'nombre',
      header: 'Factor',
      cell: ({ row }) => (
        <div className="max-w-[240px]" title={`${row.original.nombre} (${row.original.clave})`}>
          <div className="truncate text-sm font-medium">{row.original.nombre}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">
            {row.original.clave}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <div className="max-w-[320px] truncate text-sm text-muted-foreground" title={row.original.descripcion}>
          {row.original.descripcion}
        </div>
      ),
    },
    {
      accessorKey: 'grupo',
      header: 'Grupo',
      cell: ({ row }) => <span>{row.original.grupo ?? '—'}</span>,
    },
    {
      accessorKey: 'peso',
      header: () => <div className="text-right">Peso %</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.peso.toFixed(2)}</div>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Activo',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'}>
          {row.original.activo ? 'Sí' : 'No'}
        </Badge>
      ),
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => abrirDetalleFactor(row.original)}
          >
            {puedeEditar ? (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Ver detalle
              </>
            )}
          </Button>
        </div>
      ),
    },
  ] satisfies ColumnDef<ConfigRankingFactor>[];

  const tieneParametros = !!factorDetalle &&
    ['agrupabilidad_geografica', 'recencia_seleccion', 'cobertura_taller'].includes(
      factorDetalle.clave
    );

  return (
    <>
      <Modal
        id="modal-config-ranking-factores"
        open={open}
        setOpen={onOpenChange}
        title={
          config ? (
            <span className="flex flex-wrap items-center gap-2">
              Factores - {config.nombre}
              <Badge variant="outline">v{config.version}</Badge>
              <Badge variant={config.activo ? 'default' : 'secondary'}>
                {config.activo ? 'Activa' : 'Inactiva'}
              </Badge>
            </span>
          ) : (
            'Factores de la configuración'
          )
        }
        size="w75"
      >
        {cargando && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!cargando && !config && (
          <Alert variant="destructive">
            <AlertTitle>No encontrada</AlertTitle>
            <AlertDescription>
              La configuración de ranking no existe o no se pudo cargar.
            </AlertDescription>
          </Alert>
        )}

        {config && (
          <div className="space-y-4">
            {config.usada && (
              <Alert>
                <AlertTitle>Configuración en uso</AlertTitle>
                <AlertDescription>
                  Esta configuración ya fue usada en una ejecución de ranking. Para cambiar pesos o
                  parámetros cree una nueva versión.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3">
              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Nombre:</span>{' '}
                  {editandoInfo ? (
                    <Input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="inline-block w-64"
                    />
                  ) : (
                    config.nombre
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Vigencia:</span>{' '}
                  {formatDate(config.fechaVigenciaInicio)} — {formatDate(config.fechaVigenciaFin)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    (automática: inicia al crear la versión)
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Creada:</span>{' '}
                  {formatDate(config.fechaCreacion)}
                </p>
                {editandoInfo && (
                  <span className="mt-1 flex items-center gap-2">
                    <Switch
                      id="config-activa"
                      checked={activo}
                      onCheckedChange={(v) => setActivo(Boolean(v))}
                    />
                    <Label htmlFor="config-activa">Configuración activa</Label>
                  </span>
                )}
              </div>
              {puedeEditar && (
                <div className="flex items-center gap-2">
                  {editandoInfo ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditandoInfo(false)} disabled={guardandoInfo}>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => void guardarInfo()} disabled={guardandoInfo}>
                        {guardandoInfo ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Guardar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditandoInfo(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar información
                    </Button>
                  )}
                </div>
              )}
            </div>

            <DataTable
              columns={columnsFactores}
              data={config.factores}
              subtitle="Pesos y parámetros por factor. Edita cada factor desde su botón para ajustar sus parámetros."
              showRowCount
              height={280}
              footer={
                <span className={`text-xs ${pesosValidos ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Peso total activo: <strong>{pesoTotal.toFixed(2)} %</strong>
                  {!pesosValidos && ' (debe sumar 100)'}
                </span>
              }
            />
          </div>
        )}
      </Modal>

      <Modal
        id="modal-config-ranking-factor-detalle"
        open={factorDetalle != null}
        setOpen={(v) => {
          if (!v) cerrarDetalleFactor();
        }}
        title={factorDetalle ? `Factor - ${factorDetalle.nombre}` : 'Factor'}
        size="lg"
        footer={
          factorEditando ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={cerrarDetalleFactor} disabled={guardandoFactor}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void guardarFactor()}
                disabled={guardandoFactor}
              >
                {guardandoFactor ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar factor
              </Button>
            </div>
          ) : (
            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={cerrarDetalleFactor}>
                Cerrar
              </Button>
            </div>
          )
        }
      >
        {factorDetalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Clave</p>
                <p className="font-mono text-xs">{factorDetalle.clave}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grupo</p>
                <p>{factorDetalle.grupo ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Normalización</p>
                <p>{factorDetalle.tipoNormalizacion ?? '—'}</p>
              </div>
            </div>

            {factorEditando ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">Nombre</Label>
                  <Input
                    value={nombreFactor}
                    onChange={(e) => setNombreFactor(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Peso %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={pesoFactor}
                    onChange={(e) => setPesoFactor(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">Descripción</Label>
                  <Textarea
                    value={descripcionFactor}
                    onChange={(e) => setDescripcionFactor(e.target.value)}
                    className="mt-1 min-h-[72px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="factor-activo"
                    checked={activoFactor}
                    onCheckedChange={(v) => setActivoFactor(Boolean(v))}
                  />
                  <Label htmlFor="factor-activo">Factor activo (participa en el score)</Label>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="text-sm">{factorDetalle.descripcion}</p>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <span className="text-sm">Peso: <strong>{factorDetalle.peso.toFixed(2)} %</strong></span>
                  <Badge variant={factorDetalle.activo ? 'default' : 'secondary'}>
                    {factorDetalle.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            )}

            {tieneParametros && (
              <div className="rounded-lg border p-3 space-y-4">
                <p className="text-sm font-semibold">Parámetros</p>

                {factorDetalle.clave === 'agrupabilidad_geografica' && (
                  <div>
                    <Label className="text-sm">Radio de agrupabilidad geográfica (km)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Distancia máxima a la que dos hospitales se consideran vecinos para premiar
                      concentración logística (juntar hospitales cercanos en el mismo viaje).
                    </p>
                    <Input
                      type="number"
                      min={0}
                      value={radioKm ?? ''}
                      disabled={!factorEditando}
                      onChange={(e) =>
                        setRadioKm(e.target.value === '' ? null : Number(e.target.value))
                      }
                      className="mt-2 max-w-xs"
                    />
                  </div>
                )}

                {factorDetalle.clave === 'recencia_seleccion' && (
                  <div>
                    <Label className="text-sm">Tramos de recencia de selección (score 0–100)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Score que recibe el hospital según los meses desde su última selección. Un
                      hospital sin selección previa recibe el score de “Nunca”; se aplica el primer
                      tramo cuyo límite alcance.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {(
                        [
                          ['nunca', 'Nunca'],
                          ['t12', '≥ 12 meses'],
                          ['t6', '≥ 6 meses'],
                          ['t3', '≥ 3 meses'],
                          ['reciente', '< 3 meses'],
                        ] as const
                      ).map(([campo, etiqueta]) => (
                        <div key={campo}>
                          <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={recenciaParams[campo]}
                            disabled={!factorEditando}
                            onChange={(e) =>
                              setRecenciaParams((prev) => ({
                                ...prev,
                                [campo]: e.target.value === '' ? 0 : Number(e.target.value),
                              }))
                            }
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {factorDetalle.clave === 'cobertura_taller' && (
                  <div>
                    <Label className="text-sm">Cobertura de taller (score 0–100)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Score según el estado de cobertura del hospital con talleres anteriores:
                      nunca seleccionado (máximo), con taller pendiente de impartir (alto) o con
                      taller ya realizado (mínimo).
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {(
                        [
                          ['nunca', 'Nunca seleccionado'],
                          ['pendiente', 'Con taller pendiente'],
                          ['realizado', 'Con taller realizado'],
                        ] as const
                      ).map(([campo, etiqueta]) => (
                        <div key={campo}>
                          <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={coberturaParams[campo]}
                            disabled={!factorEditando}
                            onChange={(e) =>
                              setCoberturaParams((prev) => ({
                                ...prev,
                                [campo]: e.target.value === '' ? 0 : Number(e.target.value),
                              }))
                            }
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
