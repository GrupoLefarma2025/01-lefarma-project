import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toApiError } from '@/utils/errors';
import {
  Calculator,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { ParametrosPlanificacionCard } from '@/apps/educacion-medica/components/ParametrosPlanificacionCard';
import { CatalogBanner } from '@/components/common/CatalogBanner';
import type { ParametroAnestesia } from '@/apps/educacion-medica/types/educacionMedica.types';

const CLAVE_A_NOMBRE: Record<string, string> = {
  factor_cirugias_dia: 'Cirugías por día por quirófano',
  dias_laborables_anio: 'Días laborables al año',
  pct_generales: 'Porcentaje de anestesias generales',
  pct_regionales: 'Porcentaje de anestesias regionales',
  pct_epidurales: 'Porcentaje de epidurales',
  pct_subdurales: 'Porcentaje de subdurales',
  pct_mixtas_obesos: 'Porcentaje de mixtas obesos',
  pct_mixtas_no_obesos: 'Porcentaje de mixtas no obesos',
};

const ORDEN_CLAVES = [
  'factor_cirugias_dia',
  'dias_laborables_anio',
  'pct_generales',
  'pct_regionales',
  'pct_epidurales',
  'pct_subdurales',
  'pct_mixtas_obesos',
  'pct_mixtas_no_obesos',
];

interface FactorMeta {
  clave: string;
  titulo: string;
  descripcion: string;
  impacto: string;
  unidad: string;
  grupo: 'base' | 'distribucion' | 'subdistribucion';
  formato: 'entero' | 'porcentaje';
  step: string;
}

const FACTORES: FactorMeta[] = [
  {
    clave: 'factor_cirugias_dia',
    titulo: 'Cirugías por día por quirófano',
    descripcion:
      'Promedio de cirugías programadas por día en cada quirófano. Es el primer multiplicador del volumen anual.',
    impacto:
      'Subirlo aumenta linealmente todas las proyecciones de anestesias. Bajarlo las reduce.',
    unidad: 'cirugías/día',
    grupo: 'base',
    formato: 'entero',
    step: '0.1',
  },
  {
    clave: 'dias_laborables_anio',
    titulo: 'Días laborables al año',
    descripcion:
      'Número de días al año en los que el hospital realiza cirugías (descuentos, fines de semana, festivos, etc.).',
    impacto:
      'Multiplica las cirugías diarias para obtener el volumen anual. Afecta todas las proyecciones.',
    unidad: 'días',
    grupo: 'base',
    formato: 'entero',
    step: '1',
  },
  {
    clave: 'pct_generales',
    titulo: 'Porcentaje de anestesias generales',
    descripcion: 'Proporción de procedimientos totales que se estima requieran anestesia general.',
    impacto:
      'Incrementa o reduce la cantidad estimada de anestesias generales sin modificar el total.',
    unidad: '0–1',
    grupo: 'distribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_regionales',
    titulo: 'Porcentaje de anestesias regionales',
    descripcion: 'Proporción de procedimientos totales que se estima requieran anestesia regional.',
    impacto:
      'Es la base para calcular epidurales, subdurales y mixtas. Debe ser coherente con el porcentaje de generales.',
    unidad: '0–1',
    grupo: 'distribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_epidurales',
    titulo: 'Porcentaje de epidurales',
    descripcion: 'Dentro de las anestesias regionales, qué proporción se estima como epidural.',
    impacto:
      'Modifica la proyección de epidurales y debe mantenerse coherente con los demás porcentajes regionales.',
    unidad: '0–1',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_subdurales',
    titulo: 'Porcentaje de subdurales',
    descripcion: 'Dentro de las anestesias regionales, qué proporción se estima como subdural.',
    impacto:
      'Modifica la proyección de subdurales y debe mantenerse coherente con los demás porcentajes regionales.',
    unidad: '0–1',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_mixtas_obesos',
    titulo: 'Porcentaje de mixtas obesos',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como mixta para pacientes con obesidad.',
    impacto:
      'Modifica la proyección de mixtas-obesos y debe mantenerse coherente con los demás porcentajes regionales.',
    unidad: '0–1',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_mixtas_no_obesos',
    titulo: 'Porcentaje de mixtas no obesos',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como mixta para pacientes sin obesidad.',
    impacto:
      'Modifica la proyección de mixtas-no-obesos y debe mantenerse coherente con los demás porcentajes regionales.',
    unidad: '0–1',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
];

const GRUPO_TITULO: Record<FactorMeta['grupo'], string> = {
  base: 'Volumen base de procedimientos',
  distribucion: 'Distribución: generales vs. regionales',
  subdistribucion: 'Desglose de anestesias regionales',
};

const GRUPO_DESCRIPCION: Record<FactorMeta['grupo'], string> = {
  base: 'Estos factores multiplican el número de quirófanos para obtener el volumen anual estimado.',
  distribucion:
    'Estos porcentajes reparten el volumen total entre anestesias generales y regionales.',
  subdistribucion:
    'Estos porcentajes dividen las anestesias regionales entre epidurales, subdurales y mixtas.',
};

export default function ParametrosPage() {
  usePageTitle('Parámetros', 'Configuración de Educación Médica');

  const [anio, setAnio] = useState<number>(() => new Date().getFullYear());
  const [parametros, setParametros] = useState<ParametroAnestesia[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchParametros = async (year: number) => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.parametrosAnestesias.getByAnio(year);
      if (response.data.success) {
        const items = response.data.data ?? [];
        setParametros(items);
        setValores(
          items.reduce(
            (acc, p) => {
              acc[p.clave] = String(p.valor);
              return acc;
            },
            {} as Record<string, string>
          )
        );
      } else {
        toast.error(response.data.message ?? 'Error al cargar parámetros');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar parámetros');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchParametros(anio);
  }, [anio]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleValorChange = (clave: string, value: string) => {
    setValores((prev) => ({ ...prev, [clave]: value }));
  };

  const handleSave = async () => {
    const payload = {
      parametros: Object.entries(valores)
        .filter(([clave]) => CLAVE_A_NOMBRE[clave] !== undefined)
        .map(([clave, valor]) => ({
          clave,
          valor: Number(valor),
        }))
        .filter((item) => !Number.isNaN(item.valor)),
    };

    if (payload.parametros.length === 0) {
      toast.error('No hay parámetros válidos para guardar');
      return;
    }

    setSaving(true);
    try {
      const response = await educacionMedicaApi.parametrosAnestesias.upsert(anio, payload);
      if (response.data.success) {
        toast.success('Parámetros guardados correctamente');
        fetchParametros(anio);
      } else {
        toast.error(response.data.message ?? 'Error al guardar parámetros');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar parámetros');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalcular = async () => {
    setRecalculando(true);
    try {
      const response = await educacionMedicaApi.parametrosAnestesias.recalcular(anio);
      if (response.data.success) {
        toast.success(
          `Anestesias recalculadas para ${response.data.data?.anio}. Registros actualizados: ${response.data.data?.registrosActualizados ?? 0}`
        );
      } else {
        toast.error(response.data.message ?? 'Error al recalcular anestesias');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al recalcular anestesias');
    } finally {
      setRecalculando(false);
    }
  };

  const sortedParametros = useMemo(
    () =>
      [...parametros].sort((a, b) => {
        const ia = ORDEN_CLAVES.indexOf(a.clave);
        const ib = ORDEN_CLAVES.indexOf(b.clave);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }),
    [parametros]
  );

  const parametrosDict = useMemo(() => {
    return sortedParametros.reduce(
      (acc, p) => {
        acc[p.clave] = p;
        return acc;
      },
      {} as Record<string, ParametroAnestesia>
    );
  }, [sortedParametros]);

  const factoresConfigurados = useMemo(
    () => sortedParametros.filter((p) => CLAVE_A_NOMBRE[p.clave] !== undefined),
    [sortedParametros]
  );

  const cambiosPendientes = useMemo(() => {
    return factoresConfigurados.filter((p) => {
      const actual = valores[p.clave];
      return actual !== undefined && actual !== String(p.valor);
    }).length;
  }, [factoresConfigurados, valores]);

  const hayCambiosSinGuardar = cambiosPendientes > 0;

  const factoresPorGrupo = useMemo(() => {
    const groups: Record<FactorMeta['grupo'], FactorMeta[]> = {
      base: [],
      distribucion: [],
      subdistribucion: [],
    };
    for (const factor of FACTORES) {
      groups[factor.grupo].push(factor);
    }
    return groups;
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      <Tabs defaultValue="anestesias" className="w-full">
        <TabsList className="bg-muted/60 grid h-12 w-full max-w-xl grid-cols-2 gap-1 rounded-xl p-1">
          <TabsTrigger
            value="anestesias"
            className="rounded-lg border-0 text-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Anestesias
          </TabsTrigger>
          <TabsTrigger
            value="planificacion"
            className="rounded-lg border-0 text-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            Planificación y reglas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anestesias" className="mt-4 space-y-4">
          <Card className="sticky top-0 z-20 border border-slate-200/80 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 dark:border-slate-800">
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <label htmlFor="anio" className="text-xs font-medium text-muted-foreground">
                    Año de configuración
                  </label>
                  <div
                    className="flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/40"
                    role="group"
                    aria-label="Año de configuración"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md"
                      onClick={() => setAnio((actual) => actual - 1)}
                      aria-label="Año anterior"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      id="anio"
                      className="min-w-14 text-center text-xs font-semibold tabular-nums"
                    >
                      {anio}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md"
                      onClick={() => setAnio((actual) => actual + 1)}
                      aria-label="Año siguiente"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? 'Cargando factores...'
                    : `${factoresConfigurados.length} factores configurados · ${cambiosPendientes} ${
                        cambiosPendientes === 1 ? 'cambio sin guardar' : 'cambios sin guardar'
                      }`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving || loading} className="rounded-xl">
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar factores
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(true)}
                  disabled={recalculando || loading}
                  className="rounded-xl"
                >
                  {recalculando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Recalcular anestesias
                </Button>
              </div>
            </CardContent>
          </Card>

          {hayCambiosSinGuardar && (
            <CatalogBanner
              tone="warning"
              title={`${cambiosPendientes} ${
                cambiosPendientes === 1 ? 'cambio sin guardar' : 'cambios sin guardar'
              }`}
              action={
                <Button size="sm" className="h-8 rounded-lg" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Guardar
                </Button>
              }
            >
              Los cambios no se aplicarán al recálculo hasta que los guardes.
            </CatalogBanner>
          )}

          <Collapsible>
            <Card className="border bg-card shadow-sm">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Calculator className="h-4 w-4 text-primary" />
                    ¿Cómo se calculan las anestesias?
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/30 grid gap-3 border-t p-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">Anestesias totales</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Quirófanos × cirugías por día × días laborables.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">Generales y regionales</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Totales × porcentaje de generales o regionales.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Epidurales, subdurales y mixtas
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Regionales × porcentaje de cada subdistribución.
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Factores agrupados */}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando parámetros...
            </div>
          ) : factoresConfigurados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay parámetros configurados para el año {anio}.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {(['base', 'distribucion', 'subdistribucion'] as const).map((grupo) => (
                <div key={grupo} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{GRUPO_TITULO[grupo]}</h2>
                    <p className="text-sm text-muted-foreground">{GRUPO_DESCRIPCION[grupo]}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {factoresPorGrupo[grupo].map((factor) => {
                      const parametro = parametrosDict[factor.clave];
                      if (!parametro) return null;

                      const valorActual =
                        valores[factor.clave] !== undefined
                          ? valores[factor.clave]
                          : String(parametro.valor);
                      const modificado = valorActual !== String(parametro.valor);

                      return (
                        <Card
                          key={factor.clave}
                          className={cn(
                            'flex flex-col border-0 shadow-sm transition-shadow hover:shadow-md',
                            modificado && 'ring-primary/30 ring-1'
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base leading-snug">
                                {factor.titulo}
                              </CardTitle>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <Badge
                                  variant={
                                    factor.formato === 'porcentaje' ? 'secondary' : 'default'
                                  }
                                  className="text-[10px]"
                                >
                                  {factor.formato === 'porcentaje' ? 'Porcentaje' : 'Número'}
                                </Badge>
                                {modificado && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                                  >
                                    Sin guardar
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardDescription className="leading-relaxed">
                              {factor.descripcion}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <label
                              htmlFor={`factor-${factor.clave}`}
                              className="mb-2 block text-sm font-medium"
                            >
                              Valor
                            </label>
                            <div className="relative">
                              <Input
                                id={`factor-${factor.clave}`}
                                type="number"
                                step={factor.step}
                                value={valorActual}
                                onChange={(e) => handleValorChange(factor.clave, e.target.value)}
                                className={cn('w-full', factor.unidad && 'pr-24')}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {factor.unidad}
                              </span>
                            </div>
                            {factor.formato === 'porcentaje' && (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Ejemplo: 0.45 equivale a 45 %.
                              </p>
                            )}
                          </CardContent>
                          <CardFooter className="bg-muted/30 border-t px-5 py-3">
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{factor.impacto}</span>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="planificacion" className="mt-4">
          <ParametrosPlanificacionCard />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Recalcular anestesias?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Al confirmar se recalcularán las proyecciones de anestesias de{' '}
                <strong>todos los hospitales que tengan número de quirófanos</strong> usando los
                factores configurados para el año <strong>{anio}</strong>.
              </p>
              {hayCambiosSinGuardar && (
                <p className="rounded-md bg-amber-50 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  Tienes cambios sin guardar. Guárdalos primero para que se apliquen en el
                  recálculo.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                handleRecalcular();
              }}
            >
              Recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
