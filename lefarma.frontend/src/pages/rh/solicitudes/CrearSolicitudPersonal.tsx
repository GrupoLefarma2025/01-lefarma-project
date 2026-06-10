import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import type { SolicitudPersonalResponse, TipoSolicitudResponse, CreateSolicitudPersonalRequest } from '@/types/solicitudPersonal.types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
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
import {
  Loader2,
  Save,
  X,
  Building2,
  Calendar,
  FileText,
  ChevronDown,
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

const solicitudSchema = z
  .object({
    idEmpresa: z.number().positive('Seleccione una empresa'),
    idSucursal: z.number().positive('Seleccione una sucursal'),
    idArea: z.number().positive('Seleccione un área'),
    idTipoSolicitud: z.number().positive('Seleccione un tipo de solicitud'),
    motivo: z.string().optional(),
    lugarComision: z.string().optional(),
    fechaInicio: z.string().optional(),
    fechaFin: z.string().optional(),
    diasSolicitados: z.number().optional(),
    fechaRegreso: z.string().optional(),
    fechaReposicion: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.fechaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha de inicio es requerida',
        path: ['fechaInicio'],
      });
    }
  });

type FormValues = z.infer<typeof solicitudSchema>;

export default function CrearSolicitudPersonal() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  usePageTitle(
    'Solicitud de personal',
    isEditing ? 'Edición de solicitud de personal' : 'Captura de solicitud de personal'
  );
  const {
    empresa: empresaSession,
    sucursal: sucursalSession,
    area: areaSession,
  } = useAuthStore();

  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiposSolicitud, setTiposSolicitud] = useState<TipoSolicitudResponse[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const catalogFetched = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      idEmpresa: empresaSession?.idEmpresa ? Number(empresaSession.idEmpresa) : 0,
      idSucursal: sucursalSession?.idSucursal ? Number(sucursalSession.idSucursal) : 0,
      idArea: areaSession?.idArea ? Number(areaSession.idArea) : 0,
      idTipoSolicitud: 0,
      motivo: '',
      lugarComision: '',
      fechaInicio: '',
      fechaFin: '',
      diasSolicitados: undefined,
      fechaRegreso: '',
      fechaReposicion: '',
    },
  });

  const selectedEmpresaId = form.watch('idEmpresa');
  const selectedTipoSolicitudId = form.watch('idTipoSolicitud');
  const watchedFechaInicio = form.watch('fechaInicio');
  const watchedFechaFin = form.watch('fechaFin');

  const selectedTipoSolicitud = useMemo(
    () => tiposSolicitud.find((t) => t.idTipoSolicitud === selectedTipoSolicitudId),
    [tiposSolicitud, selectedTipoSolicitudId]
  );

  const filteredSucursales = useMemo(() => {
    if (!selectedEmpresaId) return sucursales;
    return sucursales.filter((s) => s.idEmpresa === selectedEmpresaId);
  }, [sucursales, selectedEmpresaId]);

  const filteredAreas = useMemo(() => {
    if (!selectedEmpresaId) return areas;
    return areas.filter((a) => a.idEmpresa === selectedEmpresaId);
  }, [areas, selectedEmpresaId]);

  // Auto-calculate diasSolicitados
  useEffect(() => {
    if (watchedFechaInicio && watchedFechaFin) {
      const inicio = new Date(watchedFechaInicio);
      const fin = new Date(watchedFechaFin);
      const diffMs = fin.getTime() - inicio.getTime();
      const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      if (dias > 0) {
        form.setValue('diasSolicitados', dias);
      }
    }
  }, [watchedFechaInicio, watchedFechaFin, form]);

  const fetchCatalogs = () => {
    const errors: string[] = [];

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
      setAreas(areasData || []);
      setLoadingCatalogs(false);
    });

    API.get<ApiResponse<TipoSolicitudResponse[]>>('/solicitudes-personal/tipos-solicitud')
      .then((res) => {
        if (res.data.success) setTiposSolicitud(res.data.data || []);
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar TiposSolicitud:', err);
        errors.push('Tipos de Solicitud');
      });

    setTimeout(() => {
      if (errors.length > 0) {
        toast.warning(`No se pudieron cargar: ${errors.join(', ')}`);
      }
    }, 1000);
  };

  useEffect(() => {
    if (catalogFetched.current) return;
    catalogFetched.current = true;
    fetchCatalogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data for edit mode
  useEffect(() => {
    if (!isEditing || !id || loadingCatalogs) return;

    const loadSolicitud = async () => {
      try {
        const response = await API.get<ApiResponse<SolicitudPersonalResponse>>(
          `/solicitudes-personal/${id}`
        );
        if (response.data.success && response.data.data) {
          const sp = response.data.data;
          form.reset({
            idEmpresa: sp.idEmpresa,
            idSucursal: sp.idSucursal,
            idArea: sp.idArea,
            idTipoSolicitud: sp.idTipoSolicitud,
            motivo: sp.motivo ?? '',
            lugarComision: sp.lugarComision ?? '',
            fechaInicio: sp.fechaInicio ? sp.fechaInicio.split('T')[0] : '',
            fechaFin: sp.fechaFin ? sp.fechaFin.split('T')[0] : '',
            diasSolicitados: sp.diasSolicitados ?? undefined,
            fechaRegreso: sp.fechaRegreso ? sp.fechaRegreso.split('T')[0] : '',
            fechaReposicion: sp.fechaReposicion ? sp.fechaReposicion.split('T')[0] : '',
          });
        } else {
          toast.error('No se pudo cargar la solicitud');
          navigate('/rh/solicitudes');
        }
      } catch {
        toast.error('Error al cargar la solicitud');
        navigate('/rh/solicitudes');
      }
    };

    loadSolicitud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id, loadingCatalogs]);

  const handleSave = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const payload: CreateSolicitudPersonalRequest = {
        idSolicitud: isEditing ? Number(id) : 0,
        idEmpresa: values.idEmpresa,
        idSucursal: values.idSucursal,
        idArea: values.idArea,
        idTipoSolicitud: values.idTipoSolicitud,
        motivo: values.motivo || null,
        lugarComision: values.lugarComision || null,
        fechaInicio: values.fechaInicio || null,
        fechaFin: values.fechaFin || null,
        diasSolicitados: values.diasSolicitados ?? null,
        fechaRegreso: values.fechaRegreso || null,
        fechaReposicion: values.fechaReposicion || null,
      };

      const response = isEditing
        ? await API.put<ApiResponse<void>>(`/solicitudes-personal/${id}`, payload)
        : await API.post<ApiResponse<void>>('/solicitudes-personal', payload);

      if (response.data.success) {
        toast.success(
          isEditing
            ? 'Solicitud de personal actualizada correctamente.'
            : 'Solicitud de personal creada correctamente.'
        );
        navigate('/rh/solicitudes');
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
          {/* Card: Datos Generales */}
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
                              onValueChange={(val) => field.onChange(Number(val))}
                              value={field.value ? String(field.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona empresa..." />
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
                              onValueChange={(val) => field.onChange(Number(val))}
                              value={field.value ? String(field.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona sucursal..." />
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
                            <FormLabel>Área *</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(Number(val))}
                              value={field.value ? String(field.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona área..." />
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

          {/* Card: Tipo de Solicitud */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5" />
                Tipo de Solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="idTipoSolicitud"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Solicitud *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo de solicitud..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposSolicitud.map((t) => (
                          <SelectItem key={t.idTipoSolicitud} value={String(t.idTipoSolicitud)}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTipoSolicitud && (
                      <FormDescription className="text-xs">
                        Categoría: {selectedTipoSolicitud.categoria}
                        {selectedTipoSolicitud.descuentaNomina && ' · Descuenta nómina'}
                        {selectedTipoSolicitud.descuentaVacaciones && ' · Descuenta vacaciones'}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe el motivo de la solicitud..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedTipoSolicitud?.requiereLugarComision && (
                <FormField
                  control={form.control}
                  name="lugarComision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lugar de Comisión *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Monterrey, Nuevo León" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Card: Fechas */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="h-5 w-5" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormSection icon={Calendar} title="Período">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="fechaInicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Inicio *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="diasSolicitados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Días Solicitados</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            readOnly
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Se calcula automáticamente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

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
                            <Input type="date" {...field} />
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
                            <Input type="date" {...field} />
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

          {/* Botones de Acción */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/rh/solicitudes')}
            >
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => {
                form.handleSubmit(
                  (values) => handleSave(values),
                  (errors) => {
                    const FIELD_NAMES: Record<string, string> = {
                      idEmpresa: 'Empresa',
                      idSucursal: 'Sucursal',
                      idArea: 'Área',
                      idTipoSolicitud: 'Tipo de Solicitud',
                      fechaInicio: 'Fecha de Inicio',
                      lugarComision: 'Lugar de Comisión',
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
