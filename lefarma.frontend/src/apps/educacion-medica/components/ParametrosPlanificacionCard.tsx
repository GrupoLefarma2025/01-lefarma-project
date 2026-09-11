import { useCallback, useEffect, useState } from 'react';
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
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { ParametroModulo } from '@/apps/educacion-medica/types/educacionMedica.types';

const ETIQUETAS: Record<string, string> = {
  radio_clustering_km: 'Radio del clustering de regiones (km)',
  max_visitas_dia: 'Máximo de visitas por día por persona',
  max_visitas_semana: 'Máximo de visitas por semana por persona',
  max_viajes_foraneos_mes: 'Límite de viajes foráneos por equipo al mes',
};

export function ParametrosPlanificacionCard() {
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

  useEffect(() => {
    fetchParametros();
  }, [fetchParametros]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = parametros
        .filter((p) => valores[p.clave] !== undefined && valores[p.clave] !== '')
        .map((p) => ({ clave: p.clave, valor: Number(valores[p.clave]) }));

      const invalidos = payload.filter((p) => Number.isNaN(p.valor) || p.valor < 0);
      if (invalidos.length > 0) {
        toast.error('Todos los valores deben ser números positivos.');
        return;
      }

      const response = await educacionMedicaApi.parametrosModulo.upsert(payload);
      if (response.data.success) {
        toast.success('Parámetros guardados. Se aplican en la próxima planificación.');
        await fetchParametros();
      } else {
        toast.error(response.data.message ?? 'Error al guardar los parámetros');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar los parámetros');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parámetros de planificación de rutas</CardTitle>
        <CardDescription>
          Reglas que aplica el sistema al repartir regiones y generar rutas. Se ajustan sin programar
          nada y se aplican en la próxima generación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : parametros.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay parámetros sembrados (ejecuta el script 0008 en la base).
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {parametros.map((parametro) => (
              <div key={parametro.clave} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {ETIQUETAS[parametro.clave] ?? parametro.clave}
                </label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={valores[parametro.clave] ?? ''}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, [parametro.clave]: e.target.value }))
                  }
                />
                {parametro.descripcion && (
                  <p className="text-xs text-muted-foreground">{parametro.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={guardar} disabled={guardando || loading || parametros.length === 0}>
          {guardando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar parámetros
        </Button>
      </CardFooter>
    </Card>
  );
}
