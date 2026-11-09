import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { ParametroModulo } from '@/apps/educacion-medica/types/educacionMedica.types';

const PREFIJO = 'sugerencia_';

const ETIQUETAS: Record<string, string> = {
  sugerencia_peso_misma_ciudad_dia: 'Misma ciudad el mismo día',
  sugerencia_peso_misma_ciudad_cerca: 'Misma ciudad cerca de la fecha',
  sugerencia_peso_misma_institucion: 'Misma institución cerca de la fecha',
  sugerencia_penalizacion_dia_consecutivo: 'Penalización por día consecutivo',
  sugerencia_factor_carga_semana: 'Penalización por visita en la semana',
  sugerencia_factor_carga_mes: 'Penalización por visita en el mes',
  sugerencia_ventana_dias_cercania: 'Ventana de cercanía (días)',
  sugerencia_peso_historial_hospital: 'Historial: mismo hospital',
  sugerencia_peso_historial_institucion: 'Historial: misma institución',
  sugerencia_peso_historial_ciudad: 'Historial: misma ciudad',
  sugerencia_peso_historial_region: 'Historial: misma región',
  sugerencia_tope_historial: 'Tope total del historial',
};

const AYUDAS: Record<string, string> = {
  sugerencia_peso_misma_ciudad_dia:
    'Puntos que recibe un especialista que ya tiene visita en la misma ciudad ese día.',
  sugerencia_peso_misma_ciudad_cerca:
    'Puntos cuando tiene visita en la misma ciudad dentro de la ventana de cercanía.',
  sugerencia_peso_misma_institucion:
    'Puntos cuando tiene visita en la misma institución dentro de la ventana de cercanía.',
  sugerencia_penalizacion_dia_consecutivo:
    'Puntos que se restan si tiene visita el día anterior o siguiente.',
  sugerencia_factor_carga_semana:
    'Puntos que se restan por cada visita que ya tenga en la semana.',
  sugerencia_factor_carga_mes:
    'Puntos que se restan por cada visita que ya tenga en el mes.',
  sugerencia_ventana_dias_cercania:
    'Días hacia atrás y adelante para considerar una ciudad o institución cercana.',
  sugerencia_peso_historial_hospital:
    'Puntos por cada visita realizada al mismo hospital; se cuentan hasta 3 visitas.',
  sugerencia_peso_historial_institucion:
    'Puntos una vez si el especialista ya visitó otro hospital de la misma institución.',
  sugerencia_peso_historial_ciudad:
    'Puntos por cada visita realizada en la misma ciudad; se cuentan hasta 3 visitas.',
  sugerencia_peso_historial_region:
    'Puntos por cada visita realizada en la misma región; se cuentan hasta 3 visitas.',
  sugerencia_tope_historial:
    'Máximo de puntos que puede aportar el historial completo a una sugerencia.',
};

const ORDEN = [
  'sugerencia_peso_misma_ciudad_dia',
  'sugerencia_peso_misma_ciudad_cerca',
  'sugerencia_peso_misma_institucion',
  'sugerencia_penalizacion_dia_consecutivo',
  'sugerencia_factor_carga_semana',
  'sugerencia_factor_carga_mes',
  'sugerencia_ventana_dias_cercania',
  'sugerencia_peso_historial_hospital',
  'sugerencia_peso_historial_institucion',
  'sugerencia_peso_historial_ciudad',
  'sugerencia_peso_historial_region',
  'sugerencia_tope_historial',
];

export function ParametrosSugerenciasCard() {
  const [parametros, setParametros] = useState<ParametroModulo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const fetchParametros = useCallback(async () => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.parametrosModulo.getAll();
      if (response.data.success) {
        const lista = response.data.data ?? [];
        setParametros(lista);
        setValores(Object.fromEntries(lista.map((p) => [p.clave, String(p.valor)])));
      } else {
        toast.error(response.data.message ?? 'Error al cargar los parámetros');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar los parámetros');
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- carga inicial; setState ocurre tras el await */
  useEffect(() => {
    void fetchParametros();
  }, [fetchParametros]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visibles = useMemo(
    () =>
      parametros
        .filter((parametro) => parametro.clave.startsWith(PREFIJO))
        .sort((a, b) => {
          const posicionA = ORDEN.indexOf(a.clave);
          const posicionB = ORDEN.indexOf(b.clave);
          return (posicionA === -1 ? 99 : posicionA) - (posicionB === -1 ? 99 : posicionB);
        }),
    [parametros]
  );

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = visibles
        .filter((parametro) => valores[parametro.clave] !== undefined)
        .map((parametro) => ({
          clave: parametro.clave,
          valor: Number(valores[parametro.clave]),
        }));

      if (payload.some((parametro) => Number.isNaN(parametro.valor) || parametro.valor < 0)) {
        toast.error('Todos los valores deben ser números positivos.');
        return;
      }

      const response = await educacionMedicaApi.parametrosModulo.upsert(payload);
      if (response.data.success) {
        toast.success('Pesos guardados. Se aplican en la próxima consulta de sugerencias.');
        await fetchParametros();
      } else {
        toast.error(response.data.message ?? 'Error al guardar los pesos');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar los pesos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sugerencia de especialistas</CardTitle>
        <CardDescription>
          Pesos del score que propone especialistas para visitas sin asignar. Los topes de
          visitas por día y por semana se configuran en Parámetros de planificación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay pesos sembrados. Ejecuta el script 0045 en la base de datos.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((parametro) => (
              <div key={parametro.clave} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {ETIQUETAS[parametro.clave] ?? parametro.clave}
                </label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={valores[parametro.clave] ?? ''}
                  onChange={(event) =>
                    setValores((prev) => ({
                      ...prev,
                      [parametro.clave]: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {AYUDAS[parametro.clave] ?? parametro.descripcion ?? parametro.clave}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={guardar} disabled={guardando || loading || visibles.length === 0}>
          {guardando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar pesos
        </Button>
      </CardFooter>
    </Card>
  );
}
