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
import { toApiError } from '@/utils/errors';
import { Loader2, RefreshCcw, Save, Info, Calculator } from 'lucide-react';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { ParametrosPlanificacionCard } from '@/apps/educacion-medica/components/ParametrosPlanificacionCard';
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
    grupo: 'base',
    formato: 'entero',
    step: '1',
  },
  {
    clave: 'pct_generales',
    titulo: 'Porcentaje de anestesias generales',
    descripcion:
      'Proporción de procedimientos totales que se estima requieran anestesia general.',
    impacto:
      'Incrementa o reduce la cantidad estimada de anestesias generales sin modificar el total.',
    grupo: 'distribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_regionales',
    titulo: 'Porcentaje de anestesias regionales',
    descripcion:
      'Proporción de procedimientos totales que se estima requieran anestesia regional.',
    impacto:
      'Es la base para calcular epidurales, subdurales y mixtas. Debe ser coherente con el porcentaje de generales.',
    grupo: 'distribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_epidurales',
    titulo: 'Porcentaje de epidurales',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como epidural.',
    impacto: 'Modifica la proyección de epidurales y debe mantenerse coherente con los demás porcentajes regionales.',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_subdurales',
    titulo: 'Porcentaje de subdurales',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como subdural.',
    impacto: 'Modifica la proyección de subdurales y debe mantenerse coherente con los demás porcentajes regionales.',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_mixtas_obesos',
    titulo: 'Porcentaje de mixtas obesos',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como mixta para pacientes con obesidad.',
    impacto: 'Modifica la proyección de mixtas-obesos y debe mantenerse coherente con los demás porcentajes regionales.',
    grupo: 'subdistribucion',
    formato: 'porcentaje',
    step: '0.0001',
  },
  {
    clave: 'pct_mixtas_no_obesos',
    titulo: 'Porcentaje de mixtas no obesos',
    descripcion:
      'Dentro de las anestesias regionales, qué proporción se estima como mixta para pacientes sin obesidad.',
    impacto: 'Modifica la proyección de mixtas-no-obesos y debe mantenerse coherente con los demás porcentajes regionales.',
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
  distribucion: 'Estos porcentajes reparten el volumen total entre anestesias generales y regionales.',
  subdistribucion:
    'Estos porcentajes dividen las anestesias regionales entre epidurales, subdurales y mixtas.',
};

export default function ParametrosPage() {
  usePageTitle('Parámetros de Anestesias', 'Configuración de Educación Médica');

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
      const response = await educacionMedicaApi.parametrosAnestesias.upsert(
        anio,
        payload
      );
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

  const hayCambiosSinGuardar = useMemo(() => {
    return sortedParametros.some((p) => {
      const actual = valores[p.clave];
      return actual !== undefined && actual !== String(p.valor);
    });
  }, [sortedParametros, valores]);

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
    <div className="space-y-6">
      {/* Header explicativo */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>¿Qué hacen estos factores?</CardTitle>
          </div>
          <CardDescription className="max-w-3xl">
            Los factores definen cómo se proyecta el consumo de anestesias a partir del número de
            quirófanos de cada hospital. Cada hospital con quirófanos se recalcula automáticamente
            cuando presionas <strong>Recalcular anestesias</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <span className="font-semibold text-primary">Anestesias Totales</span>
              <p className="text-muted-foreground">
                Quirófanos × Cirugías/día × Días laborables
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-primary">Generales y Regionales</span>
              <p className="text-muted-foreground">
                Totales × pct_generales / pct_regionales
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-primary">Epidurales, subdurales y mixtas</span>
              <p className="text-muted-foreground">
                Regionales × pct_epidurales / pct_subdurales / pct_mixtas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Año de configuración</CardTitle>
          <CardDescription>
            Selecciona el año que quieres consultar o editar. Cada año tiene su propio conjunto de
            factores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48">
              <label
                htmlFor="anio"
                className="mb-2 block text-sm font-medium"
              >
                Año
              </label>
              <Input
                id="anio"
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                Guardar factores
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={recalculando || loading}
              >
                {recalculando && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recalcular anestesias
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factores agrupados */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando parámetros...
        </div>
      ) : parametros.length === 0 ? (
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
                <h2 className="text-lg font-semibold">{GRUPO_TITULO[grupo]}</h2>
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

                  return (
                    <Card key={factor.clave} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{factor.titulo}</CardTitle>
                          <Badge variant={factor.formato === 'porcentaje' ? 'secondary' : 'default'}>
                            {factor.formato === 'porcentaje' ? 'Porcentaje' : 'Número'}
                          </Badge>
                        </div>
                        <CardDescription>{factor.descripcion}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <label
                          htmlFor={`factor-${factor.clave}`}
                          className="mb-2 block text-sm font-medium"
                        >
                          Valor
                        </label>
                        <Input
                          id={`factor-${factor.clave}`}
                          type="number"
                          step={factor.step}
                          value={valorActual}
                          onChange={(e) => handleValorChange(factor.clave, e.target.value)}
                          className="w-full"
                        />
                      </CardContent>
                      <CardFooter className="border-t bg-muted/30 px-6 py-3">
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
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancelar
            </AlertDialogCancel>
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

      <ParametrosPlanificacionCard />
    </div>
  );
}
