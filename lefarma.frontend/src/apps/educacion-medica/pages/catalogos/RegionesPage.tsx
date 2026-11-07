import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Globe2,
  Info,
  Layers3,
  ListChecks,
  Loader2,
  Map,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { HospitalesMap } from '@/apps/educacion-medica/components/HospitalesMap';
import type {
  Region,
  EstadoCatalogo,
  HospitalUbicacion,
  AplicarMapeoResponse,
  TipoGerencia,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const regionSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  centroLatitud: z.string().optional(),
  centroLongitud: z.string().optional(),
  activo: z.boolean().optional(),
});

type RegionFormValues = z.infer<typeof regionSchema>;

const PALETA_REGIONES = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#7c3aed',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#9333ea',
  '#0d9488',
];

function colorDeRegion(regiones: Region[], idRegion: number | null): string | undefined {
  if (idRegion == null) return undefined;
  const idx = regiones.findIndex((r) => r.idRegion === idRegion);
  return idx >= 0 ? PALETA_REGIONES[idx % PALETA_REGIONES.length] : undefined;
}

function parseCoordenada(
  valor: string | undefined,
  min: number,
  max: number,
  etiqueta: string
): number | null {
  const limpio = (valor ?? '').trim();
  if (!limpio) return null;
  const n = Number(limpio);
  if (isNaN(n) || n < min || n > max) {
    throw new Error(`${etiqueta} debe ser un número entre ${min} y ${max}.`);
  }
  return n;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  hint: string;
  tone: string;
}) {
  return (
    <Card className={cn('border-0 shadow-sm', tone)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-muted-foreground shadow-sm dark:bg-black/10">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-0 px-2 py-0.5 text-[11px] font-medium',
        activo
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          activo ? 'bg-emerald-500' : 'bg-muted-foreground/50'
        )}
      />
      {activo ? 'Activa' : 'Inactiva'}
    </Badge>
  );
}

export default function RegionesPage() {
  usePageTitle('Regiones', 'Catálogo de Educación Médica');

  const [regiones, setRegiones] = useState<Region[]>([]);
  const [conteoPorGerencia, setConteoPorGerencia] = useState<Record<number, number>>({});
  const [catalogoEstados, setCatalogoEstados] = useState<EstadoCatalogo[]>([]);
  const [loadingRegiones, setLoadingRegiones] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivas, setSoloActivas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<number[]>([]);

  // Regiones por gerencia: IMSS y Descentralizado mantienen su propio catálogo.
  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [idTipoGerencia, setIdTipoGerencia] = useState<number | null>(null);
  const [formGerencia, setFormGerencia] = useState<number | null>(null);

  const [mapaRegion, setMapaRegion] = useState<Region | null>(null);
  const [mapaTodas, setMapaTodas] = useState(false);
  const [mapaHospitales, setMapaHospitales] = useState<HospitalUbicacion[]>([]);
  const [mapaRegionesTodas, setMapaRegionesTodas] = useState<Region[]>([]);
  const [loadingMapa, setLoadingMapa] = useState(false);

  const [mapeoAbierto, setMapeoAbierto] = useState(false);
  const [mapeoPaso, setMapeoPaso] = useState<'seleccion' | 'preview'>('seleccion');
  const [mapeoGerencia, setMapeoGerencia] = useState<string>('ambas');
  const [previewMapeo, setPreviewMapeo] = useState<AplicarMapeoResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [aplicandoMapeo, setAplicandoMapeo] = useState(false);

  const gerenciaActual = useMemo(
    () => gerencias.find((g) => g.idTipoGerencia === idTipoGerencia) ?? null,
    [gerencias, idTipoGerencia]
  );

  // El mapa "de todas" muestra las regiones de ambas gerencias; el mapa por
  // región usa las de la pestaña activa.
  const regionesMapa = mapaTodas ? mapaRegionesTodas : regiones;

  const termino = busqueda.trim().toLowerCase();

  const regionesFiltradas = useMemo(
    () =>
      regiones.filter((region) => {
        if (soloActivas && !region.activo) return false;
        if (!termino) return true;
        return [
          region.nombre,
          region.nombreGerencia ?? '',
          ...region.estados.map((estado) => estado.nombreEstado ?? String(estado.codigoEstado)),
        ].some((valor) => valor.toLowerCase().includes(termino));
      }),
    [regiones, soloActivas, termino]
  );

  const stats = useMemo(
    () => ({
      total: regiones.length,
      activas: regiones.filter((region) => region.activo).length,
      estados: regiones.reduce((acc, region) => acc + region.estados.length, 0),
      hospitales: regiones.reduce((acc, region) => acc + region.cantidadHospitales, 0),
    }),
    [regiones]
  );

  const form = useForm<RegionFormValues>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      nombre: '',
      centroLatitud: '',
      centroLongitud: '',
      activo: true,
    },
  });

  const fetchRegiones = useCallback(async (gerencia?: number | null) => {
    try {
      const response = await educacionMedicaApi.regiones.getAll(gerencia ?? undefined);
      if (response.data.success) {
        setRegiones(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar regiones');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar regiones');
    }
  }, []);

  const fetchConteos = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.regiones.getAll();
      if (response.data.success) {
        const conteos: Record<number, number> = {};
        for (const region of response.data.data ?? []) {
          conteos[region.idTipoGerencia] = (conteos[region.idTipoGerencia] ?? 0) + 1;
        }
        setConteoPorGerencia(conteos);
      }
    } catch {
      // Los conteos son informativos; no bloquean la página.
    }
  }, []);

  // Catálogo de gerencias: solo IMSS y Descentralizado participan de la logística.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const response = await educacionMedicaApi.tipoGerencia.getAll();
        if (cancelado) return;
        const permitidas = (response.data.data ?? []).filter(
          (g) => g.descripcion === 'IMSS' || g.descripcion === 'Descentralizado'
        );
        setGerencias(permitidas);
        setIdTipoGerencia((prev) => prev ?? permitidas[0]?.idTipoGerencia ?? null);
        void fetchConteos();
      } catch (error: unknown) {
        if (!cancelado) {
          toast.error(toApiError(error).message ?? 'Error al cargar las gerencias');
          setLoadingRegiones(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [fetchConteos]);

  // Carga de regiones + catálogo de estados de la gerencia activa.
  useEffect(() => {
    if (idTipoGerencia == null) return;
    let cancelado = false;
    (async () => {
      try {
        const [rRegiones, rCatalogo] = await Promise.all([
          educacionMedicaApi.regiones.getAll(idTipoGerencia),
          educacionMedicaApi.regiones.getEstadosCatalogo(idTipoGerencia),
        ]);
        if (cancelado) return;
        if (rRegiones.data.success) {
          setRegiones(rRegiones.data.data ?? []);
        } else {
          toast.error(rRegiones.data.message ?? 'Error al cargar regiones');
        }
        if (rCatalogo.data.success) {
          setCatalogoEstados(rCatalogo.data.data ?? []);
        } else {
          toast.error(rCatalogo.data.message ?? 'Error al cargar el catálogo de estados');
        }
      } catch (error: unknown) {
        if (!cancelado) {
          toast.error(toApiError(error).message ?? 'Error al cargar regiones');
        }
      } finally {
        if (!cancelado) {
          setLoadingRegiones(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [idTipoGerencia]);

  const openNueva = () => {
    setEditing(null);
    setEstadosSeleccionados([]);
    setFormGerencia(idTipoGerencia);
    form.reset({ nombre: '', centroLatitud: '', centroLongitud: '', activo: true });
    setModalOpen(true);
  };

  const openEditar = useCallback(
    (region: Region) => {
      setEditing(region);
      setEstadosSeleccionados(region.estados.map((e) => e.codigoEstado));
      setFormGerencia(region.idTipoGerencia);
      form.reset({
        nombre: region.nombre,
        centroLatitud: region.centroLatitud != null ? String(region.centroLatitud) : '',
        centroLongitud: region.centroLongitud != null ? String(region.centroLongitud) : '',
        activo: region.activo,
      });
      setModalOpen(true);
    },
    [form]
  );

  const toggleEstado = (codigoEstado: number) => {
    setEstadosSeleccionados((prev) =>
      prev.includes(codigoEstado) ? prev.filter((c) => c !== codigoEstado) : [...prev, codigoEstado]
    );
  };

  const handleSave = async (values: RegionFormValues) => {
    if (formGerencia == null) {
      toast.error('Seleccione la gerencia de la región.');
      return;
    }

    let centroLatitud: number | null;
    let centroLongitud: number | null;
    try {
      centroLatitud = parseCoordenada(values.centroLatitud, -90, 90, 'La latitud');
      centroLongitud = parseCoordenada(values.centroLongitud, -180, 180, 'La longitud');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Coordenada inválida');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        idTipoGerencia: formGerencia,
        nombre: values.nombre,
        centroLatitud,
        centroLongitud,
        activo: values.activo ?? true,
        codigoEstados: estadosSeleccionados,
      };
      const response = editing
        ? await educacionMedicaApi.regiones.update(editing.idRegion, payload)
        : await educacionMedicaApi.regiones.create(payload);

      if (response.data.success) {
        if (estadosSeleccionados.length > 0) {
          toast.warning(
            'Región guardada. Los hospitales conservan su región actual; usa "Aplicar mapeo a hospitales" para reasignarlas según el mapeo.'
          );
        } else {
          toast.success(
            editing ? 'Región actualizada correctamente' : 'Región creada correctamente'
          );
        }
        setModalOpen(false);
        await fetchRegiones(idTipoGerencia);
        void fetchConteos();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la región');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar la región');
    } finally {
      setSaving(false);
    }
  };

  const openMapa = useCallback(async (region: Region) => {
    setMapaRegion(region);
    setMapaTodas(false);
    setLoadingMapa(true);
    try {
      const response = await educacionMedicaApi.hospitales.getUbicaciones({
        idRegion: region.idRegion,
        mostrarEducacionMedica: true,
        filtroSede: 'sedes',
      });
      if (response.data.success) {
        setMapaHospitales(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar hospitales');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar hospitales');
    } finally {
      setLoadingMapa(false);
    }
  }, []);

  const openMapaTodas = useCallback(async () => {
    setMapaRegion(null);
    setMapaTodas(true);
    setLoadingMapa(true);
    try {
      const [rUbicaciones, rRegiones] = await Promise.all([
        educacionMedicaApi.hospitales.getUbicaciones({
          mostrarEducacionMedica: true,
          filtroSede: 'sedes',
        }),
        educacionMedicaApi.regiones.getAll(),
      ]);
      if (rUbicaciones.data.success) {
        setMapaHospitales(rUbicaciones.data.data ?? []);
      } else {
        toast.error(rUbicaciones.data.message ?? 'Error al cargar hospitales');
      }
      if (rRegiones.data.success) {
        setMapaRegionesTodas(rRegiones.data.data ?? []);
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar hospitales');
    } finally {
      setLoadingMapa(false);
    }
  }, []);

  const abrirModalMapeo = () => {
    setMapeoPaso('seleccion');
    setMapeoGerencia(idTipoGerencia != null ? String(idTipoGerencia) : 'ambas');
    setPreviewMapeo(null);
    setMapeoAbierto(true);
  };

  const gerenciaMapeoParam = (): number | null =>
    mapeoGerencia === 'ambas' ? null : Number(mapeoGerencia);

  const calcularPreviewMapeo = async () => {
    setLoadingPreview(true);
    setPreviewMapeo(null);
    try {
      const response = await educacionMedicaApi.regiones.previewAplicarMapeo(gerenciaMapeoParam());
      if (response.data.success) {
        // Normaliza: un backend aún sin el pase GPS no envía los campos nuevos.
        const data: Partial<AplicarMapeoResponse> | undefined = response.data.data;
        setPreviewMapeo({
          detalles: data?.detalles ?? [],
          totalHospitales: data?.totalHospitales ?? 0,
          detallesGps: data?.detallesGps ?? [],
          totalPorGps: data?.totalPorGps ?? 0,
          sinCoordenadas: data?.sinCoordenadas ?? 0,
        });
        setMapeoPaso('preview');
      } else {
        toast.error(response.data.message ?? 'Error al calcular el preview');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al calcular el preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAplicarMapeo = async () => {
    setAplicandoMapeo(true);
    try {
      const response = await educacionMedicaApi.regiones.aplicarMapeo(gerenciaMapeoParam());
      if (response.data.success) {
        toast.success(
          response.data.message ??
            `Mapeo aplicado: ${response.data.data?.hospitalesReasignados ?? 0} hospital(es).`
        );
        setMapeoAbierto(false);
        setPreviewMapeo(null);
        await fetchRegiones(idTipoGerencia);
        void fetchConteos();
      } else {
        toast.error(response.data.message ?? 'Error al aplicar el mapeo');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al aplicar el mapeo');
    } finally {
      setAplicandoMapeo(false);
    }
  };

  const columnsRegiones = useMemo<ColumnDef<Region>[]>(
    () => [
      { accessorKey: 'idRegion', header: 'ID' },
      { accessorKey: 'nombre', header: 'Región' },
      {
        id: 'gerencia',
        header: 'Tipo de gerencia',
        cell: ({ row }) => <span className="text-xs">{row.original.nombreGerencia ?? '-'}</span>,
      },
      {
        id: 'estados',
        header: 'Estados',
        cell: ({ row }) =>
          row.original.estados.length === 0 ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <div className="flex max-w-72 flex-wrap gap-1">
              {row.original.estados.map((e) => (
                <Badge key={e.codigoEstado} variant="secondary" className="text-[10px]">
                  {e.nombreEstado ?? e.codigoEstado}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: 'cantidadHospitales',
        accessorKey: 'cantidadHospitales',
        header: 'Hospitales',
        cell: ({ row }) => (
          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
            {row.original.cantidadHospitales.toLocaleString('es-MX')}
          </Badge>
        ),
      },
      {
        id: 'activo',
        header: 'Estado',
        cell: ({ row }) => <EstadoBadge activo={row.original.activo} />,
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
              onClick={() => openEditar(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => void openMapa(row.original)}
            >
              <Map className="h-3.5 w-3.5" />
              Ver mapa
            </Button>
          </div>
        ),
      },
    ],
    [openEditar, openMapa]
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={idTipoGerencia != null ? String(idTipoGerencia) : undefined}
          onValueChange={(v) => {
            setLoadingRegiones(true);
            setIdTipoGerencia(Number(v));
          }}
        >
          <TabsList className="bg-muted/60 grid h-12 w-full max-w-2xl grid-cols-2 gap-1 rounded-xl p-1">
            {gerencias.map((g) => (
              <TabsTrigger
                key={g.idTipoGerencia}
                value={String(g.idTipoGerencia)}
                className="group gap-2 rounded-lg border-0 text-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                {g.descripcion}
                <span className="bg-background/70 inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:bg-black/20 group-data-[state=active]:text-primary-foreground">
                  {conteoPorGerencia[g.idTipoGerencia] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200 dark:hover:bg-sky-950/40"
            onClick={() => void openMapaTodas()}
            disabled={loadingMapa}
          >
            <Map className="mr-2 h-4 w-4" />
            Ver mapa
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/40"
            onClick={abrirModalMapeo}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ListChecks className="mr-2 h-4 w-4" />
            )}
            Aplicar mapeo
          </Button>
          <Button className="rounded-xl" onClick={openNueva}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva región
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Globe2 className="h-4 w-4" />}
          label="Regiones"
          value={loadingRegiones ? '—' : stats.total}
          hint="en la gerencia activa"
          tone="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card"
        />
        <StatCard
          icon={<Layers3 className="h-4 w-4" />}
          label="Activas"
          value={loadingRegiones ? '—' : stats.activas}
          hint="disponibles para asignar"
          tone="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card"
        />
        <StatCard
          icon={<MapPin className="h-4 w-4" />}
          label="Estados mapeados"
          value={loadingRegiones ? '—' : stats.estados}
          hint="estado → región"
          tone="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-card"
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Hospitales"
          value={loadingRegiones ? '—' : stats.hospitales.toLocaleString('es-MX')}
          hint="asignados a regiones"
          tone="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card"
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1.6fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por región o estado..."
                className="bg-muted/50 h-10 rounded-xl border-transparent pl-9 focus-visible:bg-background"
              />
            </div>
            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch checked={soloActivas} onCheckedChange={setSoloActivas} />
                <span className="text-sm font-medium">Solo activas</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={() => {
                setLoadingRegiones(true);
                void fetchRegiones(idTipoGerencia).finally(() => setLoadingRegiones(false));
                void fetchConteos();
              }}
              disabled={loadingRegiones}
              aria-label="Actualizar regiones"
            >
              <RefreshCcw className={cn('h-4 w-4', loadingRegiones && 'animate-spin')} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columnsRegiones}
        data={regionesFiltradas}
        title={`Regiones · ${gerenciaActual?.descripcion ?? 'Gerencia'}`}
        subtitle="Segmentación logística de hospitales (catálogo editable por gerencia)"
        showRowCount
        loading={loadingRegiones}
      />

      <Card className="bg-muted/40 border shadow-none">
        <CardContent className="flex gap-3 p-4 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Cada gerencia (IMSS y Descentralizado) maneja su propio catálogo de regiones y su propio
            mapeo de estados: un mismo estado puede pertenecer a una región de IMSS y a una de
            Descentralizado a la vez. La Ciudad de México (CDMX) no tiene región asignada por
            estado: sus hospitales se asignan manualmente desde el catálogo de Hospitales. Editar
            los estados de una región no mueve hospitales; usa &quot;Aplicar mapeo a
            hospitales&quot; para reasignarlas según el mapeo de la gerencia elegida.
          </p>
        </CardContent>
      </Card>

      <Modal
        id="modal-region"
        open={modalOpen}
        setOpen={setModalOpen}
        title={editing ? `Editar región - ${editing.nombre}` : 'Nueva región'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={form.handleSubmit(handleSave)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid gap-1">
              <Label className="text-sm">Gerencia</Label>
              <Select
                value={formGerencia != null ? String(formGerencia) : undefined}
                onValueChange={(v) => setFormGerencia(Number(v))}
                disabled={editing != null}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Seleccione la gerencia" />
                </SelectTrigger>
                <SelectContent>
                  {gerencias.map((g) => (
                    <SelectItem key={g.idTipoGerencia} value={String(g.idTipoGerencia)}>
                      {g.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editing
                  ? 'La gerencia de una región no se puede cambiar.'
                  : 'Cada gerencia mantiene su propio catálogo de regiones y su propio mapeo de estados.'}
              </p>
            </div>

            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. CDMX NORTE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="centroLatitud"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitud del centroide (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. 19.4326"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="centroLongitud"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitud del centroide (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. -99.1332"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-md border p-4">
              <div className="mb-3 space-y-1">
                <p className="text-sm font-medium leading-none">Estados de la región</p>
                <p className="text-xs text-muted-foreground">
                  Marca los estados que componen esta región. Un estado solo puede pertenecer a una
                  región; si está asignado a otra, se mueve al guardar.
                </p>
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                {catalogoEstados.map((estado) => {
                  const checked = estadosSeleccionados.includes(estado.codigoEstado);
                  const ocupadoOtraRegion =
                    estado.idRegion != null && estado.idRegion !== editing?.idRegion;
                  return (
                    <div
                      key={estado.codigoEstado}
                      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                    >
                      <Checkbox
                        id={`estado-${estado.codigoEstado}`}
                        checked={checked}
                        onCheckedChange={() => toggleEstado(estado.codigoEstado)}
                      />
                      <label
                        htmlFor={`estado-${estado.codigoEstado}`}
                        className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">{estado.nombreEstado}</span>
                        {ocupadoOtraRegion && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            → {estado.nombreRegion ?? 'OTRA REGIÓN'}
                          </Badge>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Región activa</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </Modal>

      <Modal
        id="modal-mapa-region"
        open={mapaRegion != null || mapaTodas}
        setOpen={(open) => {
          if (!open) {
            setMapaRegion(null);
            setMapaTodas(false);
          }
        }}
        title={mapaTodas ? 'Mapa de regiones' : `Mapa - ${mapaRegion?.nombre ?? ''}`}
        size="wide"
      >
        {loadingMapa ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando hospitales...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {(mapaTodas
                ? regionesMapa
                : regionesMapa.filter((z) => z.idRegion === mapaRegion?.idRegion)
              ).map((region) => (
                <span key={region.idRegion} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-white shadow"
                    style={{ backgroundColor: colorDeRegion(regionesMapa, region.idRegion) }}
                  />
                  {region.nombre}
                  {mapaTodas && region.nombreGerencia && (
                    <span className="text-muted-foreground">({region.nombreGerencia})</span>
                  )}
                </span>
              ))}
              {!mapaTodas &&
                mapaRegion?.centroLatitud != null &&
                mapaRegion?.centroLongitud != null && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#eb6c36] text-[8px] font-bold text-white">
                      Z
                    </span>
                    Centroide de {mapaRegion.nombre}
                  </span>
                )}
            </div>
            <HospitalesMap
              hospitales={mapaHospitales}
              colorPorRegion={Object.fromEntries(
                regionesMapa.map((z) => [
                  z.idRegion,
                  colorDeRegion(regionesMapa, z.idRegion) ?? '#2d3142',
                ])
              )}
              centroides={
                mapaTodas
                  ? regionesMapa
                      .filter((z) => z.centroLatitud != null && z.centroLongitud != null)
                      .map((z) => ({
                        idRegion: z.idRegion,
                        nombre: z.nombre,
                        latitud: z.centroLatitud!,
                        longitud: z.centroLongitud!,
                        cantidadHospitales: z.cantidadHospitales,
                      }))
                  : mapaRegion?.centroLatitud != null && mapaRegion?.centroLongitud != null
                    ? [
                        {
                          idRegion: mapaRegion.idRegion,
                          nombre: mapaRegion.nombre,
                          latitud: mapaRegion.centroLatitud,
                          longitud: mapaRegion.centroLongitud,
                          cantidadHospitales: mapaRegion.cantidadHospitales,
                        },
                      ]
                    : []
              }
            />
          </div>
        )}
      </Modal>

      <Modal
        id="modal-aplicar-mapeo"
        open={mapeoAbierto}
        setOpen={(open) => {
          if (!open) {
            setMapeoAbierto(false);
            setPreviewMapeo(null);
          }
        }}
        title="Aplicar mapeo a hospitales"
        size="lg"
        footer={
          mapeoPaso === 'seleccion' ? (
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setMapeoAbierto(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void calcularPreviewMapeo()}
                disabled={loadingPreview}
              >
                {loadingPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Calcular preview
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMapeoPaso('seleccion')}
                disabled={aplicandoMapeo}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={() => void handleAplicarMapeo()}
                disabled={
                  aplicandoMapeo ||
                  (previewMapeo?.totalHospitales ?? 0) + (previewMapeo?.totalPorGps ?? 0) === 0
                }
              >
                {aplicandoMapeo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aplicar ({(previewMapeo?.totalHospitales ?? 0) +
                  (previewMapeo?.totalPorGps ?? 0)}{' '}
                hospital(es))
              </Button>
            </div>
          )
        }
      >
        {mapeoPaso === 'seleccion' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Elige la gerencia a la que se aplicará el mapeo estado → región. Cada gerencia tiene
              su propio mapeo y sus propias regiones.
            </p>
            <RadioGroup value={mapeoGerencia} onValueChange={setMapeoGerencia} className="gap-2">
              {idTipoGerencia != null && (
                <Label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5">
                  <RadioGroupItem value={String(idTipoGerencia)} />
                  <span className="text-sm">
                    Solo {gerenciaActual?.descripcion ?? 'la gerencia de la pestaña actual'}
                  </span>
                </Label>
              )}
              {gerencias
                .filter((g) => g.idTipoGerencia !== idTipoGerencia)
                .map((g) => (
                  <Label
                    key={g.idTipoGerencia}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5"
                  >
                    <RadioGroupItem value={String(g.idTipoGerencia)} />
                    <span className="text-sm">Solo {g.descripcion}</span>
                  </Label>
                ))}
              <Label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5">
                <RadioGroupItem value="ambas" />
                <span className="text-sm">Ambas gerencias</span>
              </Label>
            </RadioGroup>
          </div>
        ) : loadingPreview || previewMapeo == null ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calculando preview...
          </div>
        ) : previewMapeo.detalles.length === 0 &&
          previewMapeo.detallesGps.length === 0 &&
          previewMapeo.sinCoordenadas === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No hay hospitales por reasignar: todos ya coinciden con la región de su estado o ya
            tienen una asignación manual.
          </p>
        ) : (
          <div className="space-y-4">
            {previewMapeo.detalles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Pase 1 · por estado</span> — se
                  reasignarán estos hospitales a la región de su estado (sobrescribe las regiones
                  actuales):
                </p>
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs">
                      <tr>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Región destino</th>
                        <th className="px-3 py-2 text-right font-medium">Hospitales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewMapeo.detalles.map((d) => (
                        <tr key={d.codigoEstado} className="border-t">
                          <td className="px-3 py-2">
                            {d.nombreEstado ?? `Estado ${d.codigoEstado}`}
                          </td>
                          <td className="px-3 py-2">{d.nombreRegion ?? d.idRegion}</td>
                          <td className="px-3 py-2 text-right">{d.hospitales}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted text-xs font-medium">
                      <tr>
                        <td className="px-3 py-2" colSpan={2}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right">{previewMapeo.totalHospitales}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {previewMapeo.detallesGps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Pase 2 · por coordenadas (GPS)
                  </span>{' '}
                  — hospitales sin región y sin mapeo de estado se asignan a la región con centroide
                  más cercano (no toca los que ya tienen región):
                </p>
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs">
                      <tr>
                        <th className="px-3 py-2 font-medium">Región destino</th>
                        <th className="px-3 py-2 text-right font-medium">Hospitales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewMapeo.detallesGps.map((d) => (
                        <tr key={d.idRegion} className="border-t">
                          <td className="px-3 py-2">{d.nombreRegion ?? d.idRegion}</td>
                          <td className="px-3 py-2 text-right">{d.hospitales}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted text-xs font-medium">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{previewMapeo.totalPorGps}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {previewMapeo.sinCoordenadas > 0 && (
              <p className="text-sm text-muted-foreground">
                {previewMapeo.sinCoordenadas} hospital(es) no tienen coordenadas ni mapeo por
                estado: quedarán sin región hasta que se corrijan en Asokam o se asignen
                manualmente.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
