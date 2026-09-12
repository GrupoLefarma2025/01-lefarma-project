import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Loader2, Map, ListChecks } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { HospitalesMap } from '@/apps/educacion-medica/components/HospitalesMap';
import type {
  Region,
  EstadoCatalogo,
  HospitalUbicacion,
  AplicarMapeoResponse,
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

export default function RegionesPage() {
  usePageTitle('Regiones', 'Catálogo de Educación Médica');

  const [regiones, setRegiones] = useState<Region[]>([]);
  const [catalogoEstados, setCatalogoEstados] = useState<EstadoCatalogo[]>([]);
  const [loadingRegiones, setLoadingRegiones] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<number[]>([]);

  const [mapaRegion, setMapaRegion] = useState<Region | null>(null);
  const [mapaTodas, setMapaTodas] = useState(false);
  const [mapaHospitales, setMapaHospitales] = useState<HospitalUbicacion[]>([]);
  const [loadingMapa, setLoadingMapa] = useState(false);

  const [previewMapeo, setPreviewMapeo] = useState<AplicarMapeoResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [aplicandoMapeo, setAplicandoMapeo] = useState(false);

  const form = useForm<RegionFormValues>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      nombre: '',
      centroLatitud: '',
      centroLongitud: '',
      activo: true,
    },
  });

  const fetchRegiones = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.regiones.getAll();
      if (response.data.success) {
        setRegiones(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar regiones');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar regiones');
    }
  }, []);

  // Carga inicial: setState solo tras await (evita renders en cascada).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [rRegiones, rCatalogo] = await Promise.all([
          educacionMedicaApi.regiones.getAll(),
          educacionMedicaApi.regiones.getEstadosCatalogo(),
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
  }, []);

  const openNueva = () => {
    setEditing(null);
    setEstadosSeleccionados([]);
    form.reset({ nombre: '', centroLatitud: '', centroLongitud: '', activo: true });
    setModalOpen(true);
  };

  const openEditar = useCallback(
    (region: Region) => {
      setEditing(region);
      setEstadosSeleccionados(region.estados.map((e) => e.codigoEstado));
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
      prev.includes(codigoEstado)
        ? prev.filter((c) => c !== codigoEstado)
        : [...prev, codigoEstado]
    );
  };

  const handleSave = async (values: RegionFormValues) => {
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
          toast.success(editing ? 'Región actualizada correctamente' : 'Región creada correctamente');
        }
        setModalOpen(false);
        await fetchRegiones();
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
      const response = await educacionMedicaApi.hospitales.getUbicaciones();
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

  const abrirPreviewMapeo = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewMapeo(null);
    try {
      const response = await educacionMedicaApi.regiones.previewAplicarMapeo();
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
      } else {
        toast.error(response.data.message ?? 'Error al calcular el preview');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al calcular el preview');
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const handleAplicarMapeo = async () => {
    setAplicandoMapeo(true);
    try {
      const response = await educacionMedicaApi.regiones.aplicarMapeo();
      if (response.data.success) {
        toast.success(
          response.data.message ??
            `Mapeo aplicado: ${response.data.data?.hospitalesReasignados ?? 0} hospital(es).`
        );
        setPreviewMapeo(null);
        await fetchRegiones();
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
      },
      {
        id: 'activo',
        header: 'Activo',
        cell: ({ row }) => (row.original.activo ? 'Sí' : 'No'),
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
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void openMapaTodas()}
          disabled={loadingMapa}
        >
          <Map className="mr-2 h-4 w-4" />
          Ver mapa
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void abrirPreviewMapeo()}
          disabled={loadingPreview}
        >
          {loadingPreview ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="mr-2 h-4 w-4" />
          )}
          Aplicar mapeo a hospitales
        </Button>
        <Button size="sm" onClick={openNueva}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva región
        </Button>
      </div>

      <DataTable
        columns={columnsRegiones}
        data={regiones}
        title="Regiones"
        subtitle="Regiones para la segmentación logística de hospitales (catálogo editable)"
        showRowCount
        showRefreshButton
        onRefresh={() => {
          setLoadingRegiones(true);
          void fetchRegiones().finally(() => setLoadingRegiones(false));
        }}
        loading={loadingRegiones}
      />

      <p className="text-xs text-muted-foreground">
        La Ciudad de México (CDMX) no tiene región asignada por estado: sus hospitales se asignan
        manualmente desde el catálogo de Hospitales. Editar los estados de una región no mueve
        hospitales; usa &quot;Aplicar mapeo a hospitales&quot; para reasignarlas según el mapeo
        actual.
      </p>

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
            <Button
              type="button"
              disabled={saving}
              onClick={form.handleSubmit(handleSave)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
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
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
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
              {(mapaTodas ? regiones : regiones.filter((z) => z.idRegion === mapaRegion?.idRegion)).map(
                (region) => (
                  <span key={region.idRegion} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-white shadow"
                      style={{ backgroundColor: colorDeRegion(regiones, region.idRegion) }}
                    />
                    {region.nombre}
                  </span>
                )
              )}
              {!mapaTodas && mapaRegion?.centroLatitud != null && mapaRegion?.centroLongitud != null && (
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
                regiones.map((z) => [z.idRegion, colorDeRegion(regiones, z.idRegion) ?? '#2d3142'])
              )}
              centroides={
                mapaTodas
                  ? regiones
                      .filter(
                        (z) => z.centroLatitud != null && z.centroLongitud != null
                      )
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
        open={previewMapeo != null}
        setOpen={(open) => {
          if (!open) setPreviewMapeo(null);
        }}
        title="Aplicar mapeo a hospitales"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPreviewMapeo(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleAplicarMapeo()}
              disabled={
                aplicandoMapeo ||
                ((previewMapeo?.totalHospitales ?? 0) + (previewMapeo?.totalPorGps ?? 0)) === 0
              }
            >
              {aplicandoMapeo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar (
              {(previewMapeo?.totalHospitales ?? 0) + (previewMapeo?.totalPorGps ?? 0)}{' '}
              hospital(es))
            </Button>
          </div>
        }
      >
        {previewMapeo == null ? (
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
                  — hospitales sin región y sin mapeo de estado se asignan a la región con
                  centroide más cercano (no toca los que ya tienen región):
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
