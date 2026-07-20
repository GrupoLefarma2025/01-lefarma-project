import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { API } from '@/shared/api/apiClient';
import { empleadoApi } from '@/apps/rh/services/rh.api';
import { ApiResponse } from '@/types/api.types';
import type {
  SolicitudPersonalResponse,
  TipoSolicitudResponse,
  CreateSolicitudPersonalRequest,
  IncidenciaChecadoResponse,
} from '@/types/solicitudPersonal.types';
import { toast } from 'sonner';
import { authService } from '@/shared/auth/authService';
import { useAuthStore } from '@/shared/auth/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { MultiDatePicker } from '@/components/ui/multi-date-picker';
import type { Matcher } from 'react-day-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SignatureAlert } from '@/components/common/SignatureAlert';
import {
  Loader2,
  Save,
  X,
  Building2,
  Calendar,
  FileText,
  ChevronDown,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Empresa, Sucursal, Area } from '@/types/catalogo.types';

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

const CATEGORIAS = [
  { value: '1', label: 'Incidencia' },
  { value: '2', label: 'Permiso' },
  { value: '3', label: 'Vacaciones' },
  { value: '4', label: 'Goce de Sueldo' },
  { value: '5', label: 'Incapacidad' },
];

const solicitudSchema = z.object({
  idEmpresa: z.number().positive('Seleccione una empresa'),
  idSucursal: z.number().positive('Seleccione una sucursal'),
  idArea: z.number().optional(),
  categoria: z.string().min(1, 'Seleccione una categoría'),
  idTipoSolicitud: z.number().positive('Seleccione un tipo de solicitud'),
  motivo: z.string().optional(),
  lugarComision: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  fechaRegreso: z.string().optional(),
  fechaReposicion: z.string().optional(),
  diasSolicitados: z
    .string()
    .or(z.literal(''))
    .refine((v) => v === '' || /^\d+$/.test(v), { message: 'Solo dígitos' })
    .refine((v) => v === '' || Number(v) >= 1, { message: 'Mínimo 1 día' }),
  detalle: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof solicitudSchema>;

interface CrearSolicitudProps {
  idSolicitud?: number;
  onClose: () => void;
  onSaved?: () => void;
  incidencia?: IncidenciaChecadoResponse | null;
  fechaInicial?: string;
}

function buscarTipoIncidencia(
  tipos: TipoSolicitudResponse[],
  incidencia: IncidenciaChecadoResponse
): TipoSolicitudResponse | null {
  const incidenciaEntrada = (incidencia.incidenciaEntrada ?? '').toLowerCase();
  const incidenciaSalida = (incidencia.incidenciaSalida ?? '').toLowerCase();
  const msgError = (incidencia.msgError ?? '').toLowerCase();
  const tiposIncidencia = tipos.filter((t) => t.categoria === '1');

  if (incidenciaEntrada && !incidenciaSalida) {
    return (
      tiposIncidencia.find((t) => t.nombre.toLowerCase().includes('retard')) ?? null
    );
  }

  if (incidenciaSalida && !incidenciaEntrada) {
    return (
      tiposIncidencia.find((t) => t.nombre.toLowerCase().includes('salida temprana')) ?? null
    );
  }

  if (msgError || (incidenciaEntrada && incidenciaSalida)) {
    const tieneEntrada = incidencia.entro != null;
    const tieneSalida = incidencia.salio != null;

    if (!tieneEntrada && tieneSalida) {
      return (
        tiposIncidencia.find((t) => t.nombre.toLowerCase().includes('entrada')) ?? null
      );
    }
    if (tieneEntrada && !tieneSalida) {
      return (
        tiposIncidencia.find((t) => t.nombre.toLowerCase().includes('salida')) ?? null
      );
    }
    return (
      tiposIncidencia.find((t) => t.nombre.toLowerCase().includes('entrada')) ?? null
    );
  }

  return null;
}

export function CrearSolicitud({ idSolicitud, onClose, onSaved, incidencia, fechaInicial }: CrearSolicitudProps) {
  const isEditing = Boolean(idSolicitud);
  const { empresa: empresaSession, sucursal: sucursalSession, area: areaSession, hasFirma } = useAuthStore();

  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiposSolicitud, setTiposSolicitud] = useState<TipoSolicitudResponse[]>([]);
  const [checaEmpleado, setChecaEmpleado] = useState<boolean | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const catalogFetched = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      idEmpresa: empresaSession?.idEmpresa ? Number(empresaSession.idEmpresa) : 0,
      idSucursal: sucursalSession?.idSucursal ? Number(sucursalSession.idSucursal) : 0,
      idArea: areaSession?.idArea ? Number(areaSession.idArea) : 0,
      categoria: '',
      idTipoSolicitud: 0,
      motivo: '',
      lugarComision: '',
      fechaInicio: '',
      fechaFin: '',
      fechaRegreso: '',
      fechaReposicion: '',
      diasSolicitados: '',
      detalle: [],
    },
  });

  const selectedEmpresaId = form.watch('idEmpresa');
  const selectedSucursalId = form.watch('idSucursal');
  const selectedAreaId = form.watch('idArea');
  const selectedCategoria = form.watch('categoria');
  const selectedTipoSolicitudId = form.watch('idTipoSolicitud');
  const watchedFechaInicio = form.watch('fechaInicio');
  const watchedFechaFin = form.watch('fechaFin');
  const watchedFechaRegreso = form.watch('fechaRegreso');
  const watchedFechaReposicion = form.watch('fechaReposicion');
  const watchedDetalle = form.watch('detalle');
  const watchedDiasSolicitados = form.watch('diasSolicitados');

  const selectedTipoSolicitud = useMemo(
    () => tiposSolicitud.find((t) => t.idTipoSolicitud === selectedTipoSolicitudId),
    [tiposSolicitud, selectedTipoSolicitudId]
  );

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const disabledDays = useMemo<Matcher | Matcher[]>(() => {
    if (!selectedTipoSolicitud) return [];
    if (selectedTipoSolicitud.tomaEnCuentaChecado && !checaEmpleado) return [];

    const disabled: Matcher[] = [];
    if (!selectedTipoSolicitud.permiteFechasPasadas) {
      disabled.push({ before: new Date(hoy.getTime() + 24 * 60 * 60 * 1000) });
    }
    if (!selectedTipoSolicitud.permiteFechasFuturas) {
      disabled.push({ after: hoy });
    }
    return disabled;
  }, [selectedTipoSolicitud, hoy, checaEmpleado]);

  const selectedEmpresa = useMemo(
    () => empresas.find((e) => e.idEmpresa === selectedEmpresaId),
    [empresas, selectedEmpresaId]
  );
  const selectedSucursal = useMemo(
    () => sucursales.find((s) => s.idSucursal === selectedSucursalId),
    [sucursales, selectedSucursalId]
  );
  const selectedArea = useMemo(
    () => areas.find((a) => a.idArea === selectedAreaId),
    [areas, selectedAreaId]
  );

  const pideDiasSolicitados = selectedTipoSolicitud?.pideDiasSolicitados ?? false;
  const esMultiDia = (selectedTipoSolicitud?.requiereFechaFin ?? false) && !pideDiasSolicitados;

  const diasCalculados = useMemo(() => {
    const det = watchedDetalle ?? [];
    if (esMultiDia && det.length > 0) return det.length;
    if (!esMultiDia && watchedFechaInicio && watchedFechaFin) {
      const inicio = new Date(watchedFechaInicio);
      const fin = new Date(watchedFechaFin);
      const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return dias > 0 ? dias : 1;
    }
    if (!esMultiDia && watchedFechaInicio) return 1;
    return 0;
  }, [esMultiDia, watchedDetalle, watchedFechaInicio, watchedFechaFin]);

  const filteredSucursales = useMemo(() => {
    if (!selectedEmpresaId) return sucursales;
    return sucursales.filter((s) => s.idEmpresa === selectedEmpresaId);
  }, [sucursales, selectedEmpresaId]);

  const filteredAreas = useMemo(() => {
    if (!selectedEmpresaId) return areas;
    return areas.filter((a) => a.idEmpresa === selectedEmpresaId);
  }, [areas, selectedEmpresaId]);

  const tiposPorCategoria = useMemo(() => {
    if (!selectedCategoria) return [];
    return tiposSolicitud.filter((t) => t.categoria === selectedCategoria);
  }, [tiposSolicitud, selectedCategoria]);

  useEffect(() => {
    const det = watchedDetalle ?? [];
    if (pideDiasSolicitados) {
      return;
    }
    if (esMultiDia && det.length > 0) {
      const sorted = [...det].sort();
      const inicio = sorted[0];
      const fin = sorted[sorted.length - 1];
      form.setValue('fechaInicio', inicio, { shouldValidate: false });
      form.setValue('fechaFin', fin, { shouldValidate: false });
    } else if (!esMultiDia && watchedFechaInicio) {
      if (watchedFechaFin) {
        const inicio = new Date(watchedFechaInicio);
        const fin = new Date(watchedFechaFin);
        const allDates: string[] = [];
        const current = new Date(inicio);
        while (current <= fin) {
          allDates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
        form.setValue('detalle', allDates, { shouldValidate: false });
      } else {
        form.setValue('detalle', [watchedFechaInicio], { shouldValidate: false });
      }
    }
  }, [esMultiDia, pideDiasSolicitados, watchedDetalle, watchedFechaInicio, watchedFechaFin, form]);

  useEffect(() => {
    if (!pideDiasSolicitados || !watchedFechaInicio || !watchedDiasSolicitados) return;
    const dias = Number(watchedDiasSolicitados);
    if (Number.isNaN(dias) || dias < 1) return;

    const inicio = new Date(watchedFechaInicio + 'T00:00:00');
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + dias - 1);
    const finStr = fin.toISOString().split('T')[0];

    const allDates: string[] = [];
    const current = new Date(inicio);
    while (current <= fin) {
      allDates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    form.setValue('fechaFin', finStr, { shouldValidate: false });
    form.setValue('detalle', allDates, { shouldValidate: false });
  }, [pideDiasSolicitados, watchedFechaInicio, watchedDiasSolicitados, form]);

  const fetchCatalogs = () => {
    Promise.all([
      authService.getEmpresas().catch((err) => {
        console.error('[fetchCatalogs] Error al cargar Empresas:', err);
        toast.error('Error al cargar empresas');
        return [];
      }),
      authService.getSucursales().catch((err) => {
        console.error('[fetchCatalogs] Error al cargar Sucursales:', err);
        toast.error('Error al cargar sucursales');
        return [];
      }),
      authService.getAreas().catch((err) => {
        console.error('[fetchCatalogs] Error al cargar Áreas:', err);
        toast.error('Error al cargar áreas');
        return [];
      }),
    ]).then(([empresasData, sucursalesData, areasData]) => {
      setEmpresas((empresasData as unknown as Empresa[]) || []);
      setSucursales((sucursalesData as unknown as Sucursal[]) || []);
      setAreas((areasData as unknown as Area[]) || []);
      setLoadingCatalogs(false);
    });
  };

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const res = await API.get<ApiResponse<TipoSolicitudResponse[]>>(
          '/rh/TiposSolicitud/activos'
        );
        if (res.data.success) {
          setTiposSolicitud(res.data.data || []);
        }
      } catch {
        toast.error('Error al cargar tipos de solicitud');
      }
    };

    const loadMiChequeo = async () => {
      try {
        const res = await empleadoApi.getMiChequeo();
        if (res.data.success) {
          setChecaEmpleado(res.data.data?.checa ?? null);
        }
      } catch {
        setChecaEmpleado(null);
      }
    };

    if (!catalogFetched.current) {
      catalogFetched.current = true;
      fetchCatalogs();
      loadTipos();
      loadMiChequeo();
    }
  }, []);

  const [solicitudCargada, setSolicitudCargada] = useState(false);

  useEffect(() => {
    if (!isEditing || !idSolicitud || loadingCatalogs || tiposSolicitud.length === 0) return;
    if (solicitudCargada) return;

    const loadSolicitud = async () => {
      try {
        const res = await API.get<ApiResponse<SolicitudPersonalResponse>>(
          `/solicitudes-personal/${idSolicitud}`
        );
        if (res.data.success && res.data.data) {
          const sp = res.data.data;
          form.reset({
            idEmpresa: sp.idEmpresa,
            idSucursal: sp.idSucursal,
            idArea: sp.idArea,
            categoria: sp.categoria,
            idTipoSolicitud: sp.idTipoSolicitud,
            motivo: sp.motivo ?? '',
            lugarComision: sp.lugarComision ?? '',
            fechaInicio: sp.fechaInicio ? sp.fechaInicio.split('T')[0] : '',
            fechaFin: sp.fechaFin ? sp.fechaFin.split('T')[0] : '',
            fechaRegreso: sp.fechaRegreso ? sp.fechaRegreso.split('T')[0] : '',
            fechaReposicion: sp.fechaReposicion ? sp.fechaReposicion.split('T')[0] : '',
            diasSolicitados: sp.diasSolicitados ? String(sp.diasSolicitados) : '',
            detalle: sp.detalle?.map((d) => d.fecha.split('T')[0]) ?? [],
          });
          setSolicitudCargada(true);
        } else {
          toast.error('No se pudo cargar la solicitud');
        }
      } catch {
        toast.error('Error al cargar la solicitud');
      }
    };

    loadSolicitud();
  }, [isEditing, idSolicitud, loadingCatalogs, tiposSolicitud, form, solicitudCargada]);

  useEffect(() => {
    if (!isEditing) {
      setSolicitudCargada(false);
    }
  }, [isEditing, idSolicitud]);

  useEffect(() => {
    if (!incidencia || isEditing || tiposSolicitud.length === 0) return;

    const tipo = buscarTipoIncidencia(tiposSolicitud, incidencia);
    if (tipo) {
      form.setValue('categoria', tipo.categoria, { shouldValidate: true });
      form.setValue('idTipoSolicitud', tipo.idTipoSolicitud, { shouldValidate: true });
    }

    if (fechaInicial) {
      const fechaStr = fechaInicial.split('T')[0];
      form.setValue('fechaInicio', fechaStr, { shouldValidate: true });
      form.setValue('detalle', [fechaStr], { shouldValidate: false });
    }
  }, [incidencia, fechaInicial, isEditing, tiposSolicitud, form]);

  const handleSave = async (values: FormValues) => {
    if (pideDiasSolicitados) {
      if (!values.diasSolicitados || Number(values.diasSolicitados) < 1) {
        toast.error('Ingrese los días solicitados');
        return;
      }
      if (!values.fechaInicio) {
        toast.error('La fecha de inicio es requerida');
        return;
      }
    } else if (esMultiDia && (!values.detalle || values.detalle.length === 0)) {
      toast.error('Seleccione al menos un día');
      return;
    } else if (!esMultiDia && !values.fechaInicio) {
      toast.error('La fecha es requerida');
      return;
    }

    setIsSaving(true);
    try {
      let detalle = values.detalle ?? [];
      if (pideDiasSolicitados && values.fechaInicio && values.diasSolicitados) {
        const dias = Number(values.diasSolicitados);
        const inicio = new Date(values.fechaInicio + 'T00:00:00');
        const fin = new Date(inicio);
        fin.setDate(inicio.getDate() + dias - 1);
        const generado: string[] = [];
        const current = new Date(inicio);
        while (current <= fin) {
          generado.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
        detalle = generado;
      }

      const payload: CreateSolicitudPersonalRequest = {
        idSolicitud: isEditing ? Number(idSolicitud) : 0,
        idEmpresa: values.idEmpresa,
        idSucursal: values.idSucursal,
        idArea: values.idArea,
        idTipoSolicitud: values.idTipoSolicitud,
        motivo: values.motivo || null,
        lugarComision: values.lugarComision || null,
        fechaInicio: values.fechaInicio || null,
        fechaFin: values.fechaFin || null,
        diasSolicitados: values.diasSolicitados ? Number(values.diasSolicitados) : null,
        fechaRegreso: values.fechaRegreso || null,
        fechaReposicion: values.fechaReposicion || null,
        detalle: detalle.map((fecha) => ({ fecha })),
      };

      const response = isEditing
        ? await API.put<ApiResponse<void>>(`/solicitudes-personal/${idSolicitud}`, payload)
        : await API.post<ApiResponse<void>>('/solicitudes-personal', payload);

      if (response.data.success) {
        if (selectedTipoSolicitud?.requiereDocumentacion && !isEditing) {
          toast.success('Solicitud creada, pendiente de documentación', {
            description:
              'Adjunte la documentación requerida desde el detalle de la solicitud para enviarla.',
            duration: 6000,
          });
        } else {
          toast.success(
            isEditing
              ? 'Solicitud de personal actualizada correctamente.'
              : 'Solicitud de personal creada correctamente.'
          );
        }
        onSaved?.();
        onClose();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la solicitud');
      }
    } catch (error) {
      const apiError = error as { errors?: Array<{ description: string }>; message?: string };
      const errs = apiError.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) =>
          toast.error(apiError.message ?? 'Error', { description: e.description })
        );
      } else {
        toast.error(apiError.message ?? 'Error al guardar la solicitud');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const fechaInicioLabel = useMemo(() => {
    if (esMultiDia) return 'Días del período *';
    switch (selectedCategoria) {
      case '1':
        return 'Fecha de Incidencia *';
      case '2':
        return 'Fecha del Permiso *';
      case '4':
        return 'Fecha de Goce de Sueldo *';
      case '5':
        return 'Fecha de Incapacidad *';
      default:
        return 'Fecha Inicio *';
    }
  }, [selectedCategoria, esMultiDia]);

  if (loadingCatalogs) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form className="space-y-6">
          <Collapsible defaultOpen={false}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-4">
                  <CardTitle className="flex items-center justify-between text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Datos Generales
                    </div>
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <FormSection icon={Building2} title="Ubicación">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="idEmpresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa *</FormLabel>
                            <Select
                              value={field.value ? String(field.value) : ''}
                              onValueChange={(v) => field.onChange(Number(v))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar empresa" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {empresas.map((e) => (
                                  <SelectItem key={e.idEmpresa} value={String(e.idEmpresa)}>
                                    {e.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="idSucursal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sucursal *</FormLabel>
                            <Select
                              value={field.value ? String(field.value) : ''}
                              onValueChange={(v) => field.onChange(Number(v))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar sucursal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {filteredSucursales.map((s) => (
                                  <SelectItem key={s.idSucursal} value={String(s.idSucursal)}>
                                    {s.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="idArea"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Área</FormLabel>
                            <Select
                              value={field.value ? String(field.value) : ''}
                              onValueChange={(v) => field.onChange(Number(v))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar área" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {filteredAreas.map((a) => (
                                  <SelectItem key={a.idArea} value={String(a.idArea)}>
                                    {a.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </FormSection>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5" />
                Tipo de Solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormSection icon={FileText} title="Tipo de Solicitud">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIAS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="idTipoSolicitud"
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select
                            value={field.value ? String(field.value) : ''}
                            onValueChange={(v) => {
                              if (!v) return;
                              field.onChange(Number(v));
                            }}
                            disabled={!selectedCategoria}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tiposPorCategoria.map((t) => (
                                <SelectItem
                                  key={t.idTipoSolicitud}
                                  value={String(t.idTipoSolicitud)}
                                >
                                  {t.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </FormSection>

              {selectedTipoSolicitud?.requiereDocumentacion && (
                <Alert variant="default" className="mt-4 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Documentación requerida</AlertTitle>
                  <AlertDescription>
                    Este tipo de solicitud requiere documentación de soporte. La solicitud se creará
                    pero no se enviará hasta que adjunte los archivos necesarios desde el detalle.
                  </AlertDescription>
                </Alert>
              )}

              <FormSection icon={FileText} title="Motivo">
                <FormField
                  control={form.control}
                  name="motivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describa el motivo de la solicitud..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              {selectedTipoSolicitud?.requiereLugarComision && (
                <FormSection icon={Building2} title="Comisión">
                  <FormField
                    control={form.control}
                    name="lugarComision"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lugar de Comisión *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Lugar de la comisión..." rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="h-5 w-5" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {pideDiasSolicitados ? (
                <FormSection icon={Calendar} title="Días solicitados">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="fechaInicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha Inicio *</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabledDays={disabledDays}
                              placeholder="Seleccionar fecha..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="diasSolicitados"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Días solicitados *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ej. 5"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Días naturales a contar desde la fecha inicio.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fechaFin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha Fin</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              readOnly
                              disabled
                              value={field.value || ''}
                              placeholder="Se calcula automáticamente"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>
              ) : esMultiDia ? (
                <FormSection icon={Calendar} title="Días del período">
                  <FormField
                    control={form.control}
                    name="detalle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seleccione los días *</FormLabel>
                        <FormControl>
                          <MultiDatePicker
                            value={field.value ?? []}
                            onChange={field.onChange}
                            disabledDays={disabledDays}
                            placeholder="Seleccionar días..."
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Puede seleccionar uno o varios días del período
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>
              ) : (
                <FormSection icon={Calendar} title="Período">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fechaInicio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fechaInicioLabel}</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabledDays={disabledDays}
                              placeholder="Seleccionar fecha..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {selectedTipoSolicitud?.requiereFechaFin && (
                      <FormField
                        control={form.control}
                        name="fechaFin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha Fin *</FormLabel>
                            <FormControl>
                              <DatePicker
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Seleccionar fecha fin..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </FormSection>
              )}

              {selectedTipoSolicitud?.requiereFechaRegreso && (
                <FormSection icon={Calendar} title="Regreso">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fechaRegreso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Regreso</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Seleccionar fecha de regreso..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>
              )}

              {selectedTipoSolicitud?.requiereReposicionTiempo && (
                <FormSection icon={Calendar} title="Reposición">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fechaReposicion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Reposición</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Seleccionar fecha de reposición..."
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Fecha en que el empleado repone el día perdido
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="border-primary/30 bg-primary/10 rounded-lg border p-3 shadow-sm">
                <div className="border-primary/20 mb-2 flex items-center gap-2 border-b pb-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Resumen de la solicitud</span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Empresa</span>
                    <span className="font-medium">{selectedEmpresa?.nombre ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Sucursal</span>
                    <span className="font-medium">{selectedSucursal?.nombre ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Área</span>
                    <span className="font-medium">{selectedArea?.nombre ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Tipo</span>
                    <span className="font-medium">{selectedTipoSolicitud?.nombre ?? '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fecha inicio</span>
                    <span className="font-medium">{watchedFechaInicio || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fecha fin</span>
                    <span className="font-medium">{watchedFechaFin || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fecha regreso</span>
                    <span className="font-medium">{watchedFechaRegreso || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fecha reposición</span>
                    <span className="font-medium">{watchedFechaReposicion || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Días solicitados</span>
                    <span className="font-bold text-primary">
                      {diasCalculados > 0 ? `${diasCalculados} día(s)` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fechas seleccionadas</span>
                    <span className="font-medium">
                      {(watchedDetalle ?? []).length > 0
                        ? `${(watchedDetalle ?? []).length} día(s)`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasFirma === false && <SignatureAlert />}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving || hasFirma === false}
              onClick={() => {
                form.handleSubmit(
                  (values) => handleSave(values),
                  (errors) => {
                    const FIELD_NAMES: Record<string, string> = {
                      idEmpresa: 'Empresa',
                      idSucursal: 'Sucursal',
                      idArea: 'Área',
                      categoria: 'Categoría',
                      idTipoSolicitud: 'Tipo de Solicitud',
                      fechaInicio: 'Fecha',
                      lugarComision: 'Lugar de Comisión',
                      detalle: 'Días del período',
                    };

                    const missing: string[] = [];
                    for (const [key, err] of Object.entries(errors)) {
                      if (!err) continue;
                      const label = FIELD_NAMES[key] ?? key;
                      missing.push(label);
                    }

                    if (missing.length > 0) {
                      toast.error('Faltan campos obligatorios', {
                        description: missing.join(' · '),
                        duration: 8000,
                      });
                    }
                  }
                )();
              }}
              size="lg"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? 'Actualizar Solicitud' : 'Guardar Solicitud'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
