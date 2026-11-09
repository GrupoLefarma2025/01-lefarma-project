import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { ParametroModulo } from '@/apps/educacion-medica/types/educacionMedica.types';

const PREFIJO_RANKING = 'sugerencia_';

type GrupoKey = 'rutas' | 'ajustes' | 'metas' | 'autorizacion' | 'otros';
type TipoParametro = 'numero' | 'booleano' | 'enum';

interface ParametroMeta {
  etiqueta: string;
  ayuda: string;
  unidad?: string;
  grupo: GrupoKey;
  tipo: TipoParametro;
}

const ORDEN_GRUPOS: GrupoKey[] = ['rutas', 'ajustes', 'metas', 'autorizacion', 'otros'];

const GRUPOS: Record<GrupoKey, { titulo: string; descripcion: string }> = {
  rutas: {
    titulo: 'Rutas y visitas',
    descripcion: 'Límites que aplica el sistema al repartir visitas y generar rutas.',
  },
  ajustes: {
    titulo: 'Ajustes y talleres',
    descripcion: 'Reglas operativas para cambios posteriores al cierre y captura de talleres.',
  },
  metas: {
    titulo: 'Metas y cuotas',
    descripcion: 'Objetivos y mínimos usados en la planeación y el seguimiento.',
  },
  autorizacion: {
    titulo: 'Autorización y cambios',
    descripcion: 'Controles que definen cuándo una matriz o solicitud requiere autorización.',
  },
  otros: {
    titulo: 'Otros parámetros',
    descripcion: 'Parámetros adicionales sin una agrupación específica.',
  },
};

const METADATOS: Record<string, ParametroMeta> = {
  radio_clustering_km: {
    etiqueta: 'Radio del clustering de regiones',
    ayuda: 'Distancia máxima para agrupar hospitales dentro de una misma zona logística.',
    unidad: 'km',
    grupo: 'rutas',
    tipo: 'numero',
  },
  max_visitas_dia: {
    etiqueta: 'Máximo de visitas por día',
    ayuda: 'Tope diario por persona al generar rutas y calendario.',
    unidad: 'visitas/día',
    grupo: 'rutas',
    tipo: 'numero',
  },
  max_visitas_semana: {
    etiqueta: 'Máximo de visitas por semana',
    ayuda: 'Tope semanal por persona al repartir visitas.',
    unidad: 'visitas/semana',
    grupo: 'rutas',
    tipo: 'numero',
  },
  max_viajes_foraneos_mes: {
    etiqueta: 'Límite de viajes foráneos por equipo',
    ayuda: 'Máximo de viajes fuera de la zona base que puede realizar un equipo al mes.',
    unidad: 'viajes/mes',
    grupo: 'rutas',
    tipo: 'numero',
  },
  dias_limite_cambio: {
    etiqueta: 'Días límite para ajustes post-cierre',
    ayuda: 'Días hacia atrás en los que se permite ajustar un taller o visita ya cerrados.',
    unidad: 'días',
    grupo: 'ajustes',
    tipo: 'numero',
  },
  producto_cantidad_default: {
    etiqueta: 'Cantidad default de producto',
    ayuda: 'Cantidad que se precarga al agregar el recurso Producto en el alta de un taller.',
    unidad: 'unidades',
    grupo: 'ajustes',
    tipo: 'numero',
  },
  min_visitas_ejecutivo_semana: {
    etiqueta: 'Mínimo de visitas por ejecutivo por semana',
    ayuda: 'Cuota semanal esperada por ejecutivo; 0 significa sin mínimo.',
    unidad: 'visitas',
    grupo: 'metas',
    tipo: 'numero',
  },
  min_visitas_ejecutivo_mes: {
    etiqueta: 'Mínimo de visitas por ejecutivo por mes',
    ayuda: 'Cuota mensual esperada por ejecutivo; 0 significa sin mínimo.',
    unidad: 'visitas',
    grupo: 'metas',
    tipo: 'numero',
  },
  min_hospitales_por_zona: {
    etiqueta: 'Mínimo de hospitales por zona',
    ayuda: 'Mínimo recomendado de hospitales por zona en viajes foráneos.',
    unidad: 'hospitales',
    grupo: 'metas',
    tipo: 'numero',
  },
  min_hospitales_especialista_semana: {
    etiqueta: 'Hospitales por especialista por semana',
    ayuda: 'Cuota documentada de hospitales que cubre un especialista por semana.',
    unidad: 'hospitales',
    grupo: 'metas',
    tipo: 'numero',
  },
  min_talleres_especialista_semana: {
    etiqueta: 'Talleres por especialista por semana',
    ayuda: 'Cuota documentada de talleres que imparte un especialista por semana.',
    unidad: 'talleres',
    grupo: 'metas',
    tipo: 'numero',
  },
  meta_talleres_mes_imss: {
    etiqueta: 'Meta mensual de talleres IMSS',
    ayuda: 'Objetivo mensual de talleres para la gerencia IMSS.',
    unidad: 'talleres',
    grupo: 'metas',
    tipo: 'numero',
  },
  meta_talleres_mes_bienestar: {
    etiqueta: 'Meta mensual de talleres IMSS Bienestar',
    ayuda: 'Objetivo mensual de talleres para la gerencia IMSS Bienestar.',
    unidad: 'talleres',
    grupo: 'metas',
    tipo: 'numero',
  },
  meta_talleres_mes_descentralizado: {
    etiqueta: 'Meta mensual de talleres Descentralizado',
    ayuda: 'Objetivo mensual de talleres para la gerencia Descentralizado.',
    unidad: 'talleres',
    grupo: 'metas',
    tipo: 'numero',
  },
  matriz_requiere_autorizacion: {
    etiqueta: 'La matriz requiere autorización',
    ayuda:
      'Actívalo para que la matriz pase por autorización; desactívalo para dejarla solo con candado.',
    grupo: 'autorizacion',
    tipo: 'booleano',
  },
  bloqueo_taller_automatico: {
    etiqueta: 'Bloqueo automático de talleres',
    ayuda: 'Al autorizar la matriz, bloquea automáticamente los talleres asociados.',
    grupo: 'autorizacion',
    tipo: 'booleano',
  },
  umbral_cambio_costo_reautorizacion: {
    etiqueta: 'Umbral de cambio de costo para reautorizar',
    ayuda: 'Delta de costo que obliga a reautorizar la matriz; 0 significa sin umbral.',
    unidad: 'monto',
    grupo: 'autorizacion',
    tipo: 'numero',
  },
  permite_cambio_hospital: {
    etiqueta: 'Permitir cambio de hospital',
    ayuda: 'La solicitud de taller puede cambiar el hospital dentro del alcance permitido.',
    grupo: 'autorizacion',
    tipo: 'booleano',
  },
  permite_cambio_producto: {
    etiqueta: 'Permitir cambio de producto o cantidad',
    ayuda: 'La solicitud de taller puede cambiar producto o cantidad y recalcular costos.',
    grupo: 'autorizacion',
    tipo: 'booleano',
  },
  alcance_hospital_extraordinario: {
    etiqueta: 'Alcance del hospital extraordinario',
    ayuda:
      'Parámetro enum con valores EJECUTIVO | GERENCIA | SELECCION | CATALOGO. Se administra directamente en la base de datos.',
    grupo: 'otros',
    tipo: 'enum',
  },
};

function resolverMeta(parametro: ParametroModulo): ParametroMeta {
  return (
    METADATOS[parametro.clave] ?? {
      etiqueta: parametro.clave,
      ayuda: parametro.descripcion ?? 'Parámetro configurable del módulo.',
      grupo: 'otros',
      tipo: 'numero',
    }
  );
}

interface ParametroAgrupado {
  parametro: ParametroModulo;
  meta: ParametroMeta;
}

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
        const lista = (response.data.data ?? []).filter(
          (parametro) => !parametro.clave.startsWith(PREFIJO_RANKING)
        );
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

  const agrupados = useMemo(() => {
    const grupos = new Map<GrupoKey, ParametroAgrupado[]>();
    for (const parametro of parametros) {
      const meta = resolverMeta(parametro);
      const actuales = grupos.get(meta.grupo) ?? [];
      actuales.push({ parametro, meta });
      grupos.set(meta.grupo, actuales);
    }
    return ORDEN_GRUPOS.map((grupo) => ({
      grupo,
      ...GRUPOS[grupo],
      items: grupos.get(grupo) ?? [],
    })).filter((seccion) => seccion.items.length > 0);
  }, [parametros]);

  const hayCambios = useMemo(
    () =>
      parametros.some((parametro) => {
        const meta = resolverMeta(parametro);
        return (
          meta.tipo !== 'enum' &&
          valores[parametro.clave] !== undefined &&
          valores[parametro.clave] !== String(parametro.valor)
        );
      }),
    [parametros, valores]
  );

  const handleValorChange = (clave: string, valor: string) => {
    setValores((prev) => ({ ...prev, [clave]: valor }));
  };

  const guardar = async () => {
    const editables = parametros.filter((parametro) => resolverMeta(parametro).tipo !== 'enum');

    const incompletos = editables.filter(
      (parametro) => valores[parametro.clave] === undefined || valores[parametro.clave] === ''
    );
    if (incompletos.length > 0) {
      toast.error('Completa todos los valores antes de guardar.');
      return;
    }

    const payload = editables
      .filter((parametro) => valores[parametro.clave] !== String(parametro.valor))
      .map((parametro) => ({
        clave: parametro.clave,
        valor: Number(valores[parametro.clave]),
      }));

    if (payload.length === 0) {
      toast.info('No hay cambios por guardar.');
      return;
    }

    if (payload.some((parametro) => Number.isNaN(parametro.valor) || parametro.valor < 0)) {
      toast.error('Todos los valores deben ser números positivos.');
      return;
    }

    setGuardando(true);
    try {
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
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardHeader className="bg-muted/20 border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-xl p-2 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Parámetros de planificación y reglas</CardTitle>
              <CardDescription className="max-w-3xl leading-relaxed">
                Reglas que aplica el sistema al repartir regiones, generar rutas y controlar
                autorizaciones. Se ajustan sin programar y se aplican en la próxima generación.
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit rounded-lg px-2.5 py-1 text-[11px]">
            {parametros.length} {parametros.length === 1 ? 'parámetro' : 'parámetros'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando parámetros...
          </div>
        ) : parametros.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No hay parámetros operativos configurados para el módulo.
          </p>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={agrupados.length > 0 ? [agrupados[0].grupo] : []}
            className="w-full"
          >
            {agrupados.map((seccion) => {
              const cambiosSeccion = seccion.items.filter(({ parametro, meta }) => {
                if (meta.tipo === 'enum') return false;
                const actual = valores[parametro.clave];
                return actual !== undefined && actual !== String(parametro.valor);
              }).length;

              return (
                <AccordionItem key={seccion.grupo} value={seccion.grupo}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex flex-1 flex-col gap-1 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold tracking-tight text-foreground">
                          {seccion.titulo}
                        </p>
                        <p className="text-xs font-normal text-muted-foreground">
                          {seccion.descripcion}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cambiosSeccion > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                          >
                            {cambiosSeccion} sin guardar
                          </Badge>
                        )}
                        <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[11px]">
                          {seccion.items.length}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {seccion.items.map(({ parametro, meta }) => {
                        const valor = valores[parametro.clave] ?? String(parametro.valor);
                        const modificado =
                          meta.tipo !== 'enum' && valor !== String(parametro.valor);

                        if (meta.tipo === 'enum') {
                          return (
                            <div
                              key={parametro.clave}
                              className="bg-muted/20 rounded-xl border border-dashed p-4"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {meta.etiqueta}
                                </p>
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Enum
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {meta.ayuda}
                              </p>
                              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                                Se administra directamente en la base de datos.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={parametro.clave}
                            className={cn(
                              'rounded-xl border bg-card p-4 shadow-sm transition-colors',
                              modificado && 'border-primary/40 bg-primary/[0.03]'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label
                                htmlFor={`parametro-${parametro.clave}`}
                                className="text-sm font-medium leading-snug text-foreground"
                              >
                                {meta.etiqueta}
                              </label>
                              {modificado && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                                >
                                  Sin guardar
                                </Badge>
                              )}
                            </div>

                            {meta.tipo === 'booleano' ? (
                              <div className="bg-muted/40 mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                                <span className="text-xs text-muted-foreground">
                                  {Number(valor) === 1 ? 'Activado' : 'Desactivado'}
                                </span>
                                <Switch
                                  checked={Number(valor) === 1}
                                  onCheckedChange={(checked) =>
                                    handleValorChange(parametro.clave, checked ? '1' : '0')
                                  }
                                />
                              </div>
                            ) : (
                              <div className="relative mt-3">
                                <Input
                                  id={`parametro-${parametro.clave}`}
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={valor}
                                  onChange={(event) =>
                                    handleValorChange(parametro.clave, event.target.value)
                                  }
                                  className={cn('w-full', meta.unidad && 'pr-24')}
                                />
                                {meta.unidad && (
                                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    {meta.unidad}
                                  </span>
                                )}
                              </div>
                            )}

                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              {meta.ayuda}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 flex-col items-start gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Los pesos de sugerencia de especialistas se configuran en Scoring.
        </p>
        <Button
          onClick={guardar}
          disabled={guardando || loading || parametros.length === 0 || !hayCambios}
        >
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
