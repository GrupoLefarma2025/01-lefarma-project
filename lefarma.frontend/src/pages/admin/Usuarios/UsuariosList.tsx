import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { 
  User, 
  Search, 
  Pencil, 
  Loader2, 
  RefreshCcw, 
  Mail, 
  Building2, 
  Briefcase, 
  Bell,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Usuario } from '@/types/usuario.types';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { MultiSelect } from '@/components/ui/multi-select';

const usuarioSchema = z.object({
  samAccountName: z.string().min(1, 'Requerido'),
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  correo: z.string().email('Email inválido').optional().or(z.literal('')),
  rolesIds: z.array(z.number()),
  detalle: z.object({
    idEmpresa: z.number().min(1, 'La empresa es requerida'),
    idSucursal: z.number().min(1, 'La sucursal es requerida'),
    idArea: z.number().optional().nullable(),
    idCentroCosto: z.number().optional().nullable(),
    puesto: z.string().optional().nullable(),
    numeroEmpleado: z.string().optional().nullable(),
    telefonoOficina: z.string().optional().nullable(),
    extension: z.string().optional().nullable(),
    celular: z.string().optional().nullable(),
    telegramChat: z.string().optional().nullable(),
    notificarEmail: z.boolean(),
    notificarApp: z.boolean(),
    notificarWhatsapp: z.boolean(),
    notificarSms: z.boolean(),
    notificarTelegram: z.boolean(),
    notificarSoloUrgentes: z.boolean(),
    notificarResumenDiario: z.boolean(),
    notificarRechazos: z.boolean(),
    notificarVencimientos: z.boolean(),
    temaInterfaz: z.string(),
    dashboardInicio: z.string().optional().nullable(),
    activo: z.boolean(),
  }),
});

type UsuarioFormValues = z.infer<typeof usuarioSchema>;

export default function UsuariosList() {
  usePageTitle('Usuarios', 'Gestión de usuarios y detalles de perfil');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  // Catálogos
  const [roles, setRoles] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<UsuarioFormValues>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      samAccountName: '',
      nombreCompleto: '',
      correo: '',
      rolesIds: [],
      detalle: {
        idEmpresa: 0,
        idSucursal: 0,
        idArea: null,
        idCentroCosto: null,
        puesto: '',
        numeroEmpleado: '',
        notificarEmail: true,
        notificarApp: true,
        notificarWhatsapp: false,
        notificarSms: false,
        notificarTelegram: false,
        notificarSoloUrgentes: false,
        notificarResumenDiario: true,
        notificarRechazos: true,
        notificarVencimientos: true,
        temaInterfaz: 'light',
        activo: true,
      },
    },
  });

  const watchedIdEmpresa = useWatch({ control: form.control, name: 'detalle.idEmpresa' });
  const { formState: { errors } } = form;

  const tabErrors = useMemo(() => ({
    general: !!(errors.samAccountName || errors.nombreCompleto || errors.correo || errors.rolesIds),
    trabajo: !!(errors.detalle?.idEmpresa || errors.detalle?.idSucursal || errors.detalle?.puesto),
    contacto: false,
    notificaciones: false,
  }), [errors]);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Usuario[]>>('/Admin/usuarios');
      if (response.data.success) {
        setUsuarios(response.data.data || []);
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogos = async () => {
    try {
      const [rRoles, rEmpresas, rSucursales, rAreas] = await Promise.all([
        API.get<ApiResponse<any[]>>('/Admin/roles'),
        API.get<ApiResponse<any[]>>('/catalogos/Empresas'),
        API.get<ApiResponse<any[]>>('/catalogos/Sucursales'),
        API.get<ApiResponse<any[]>>('/catalogos/Areas'),
      ]);

      if (rRoles.data.success) setRoles(rRoles.data.data);
      if (rEmpresas.data.success) setEmpresas(rEmpresas.data.data);
      if (rSucursales.data.success) setSucursales(rSucursales.data.data);
      if (rAreas.data.success) setAreas(rAreas.data.data);
    } catch (error) {
      console.error('Error al cargar catálogos', error);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchCatalogos();
  }, []);

  const handleEdit = (usuario: Usuario) => {
    setSelectedUsuarioId(usuario.idUsuario);
    form.reset({
      samAccountName: usuario.samAccountName || '',
      nombreCompleto: usuario.nombreCompleto || '',
      correo: usuario.correo || '',
      rolesIds: usuario.roles?.map(r => r.idRol) || [],
      detalle: {
        idEmpresa: usuario.detalle?.idEmpresa || 0,
        idSucursal: usuario.detalle?.idSucursal || 0,
        idArea: usuario.detalle?.idArea || null,
        idCentroCosto: usuario.detalle?.idCentroCosto || null,
        puesto: usuario.detalle?.puesto || '',
        numeroEmpleado: usuario.detalle?.numeroEmpleado || '',
        telefonoOficina: usuario.detalle?.telefonoOficina || '',
        extension: usuario.detalle?.extension || '',
        celular: usuario.detalle?.celular || '',
        telegramChat: usuario.detalle?.telegramChat || '',
        notificarEmail: usuario.detalle?.notificarEmail ?? true,
        notificarApp: usuario.detalle?.notificarApp ?? true,
        notificarWhatsapp: usuario.detalle?.notificarWhatsapp ?? false,
        notificarSms: usuario.detalle?.notificarSms ?? false,
        notificarTelegram: usuario.detalle?.notificarTelegram ?? false,
        notificarSoloUrgentes: usuario.detalle?.notificarSoloUrgentes ?? false,
        notificarResumenDiario: usuario.detalle?.notificarResumenDiario ?? true,
        notificarRechazos: usuario.detalle?.notificarRechazos ?? true,
        notificarVencimientos: usuario.detalle?.notificarVencimientos ?? true,
        temaInterfaz: usuario.detalle?.temaInterfaz || 'light',
        dashboardInicio: usuario.detalle?.dashboardInicio || '',
        activo: usuario.detalle?.activo ?? true,
      },
    });
    setIsModalOpen(true);
  };

  const handleSave = async (values: UsuarioFormValues) => {
    if (!selectedUsuarioId) return;
    setIsSaving(true);
    try {
      const response = await API.put(`/Admin/usuarios/${selectedUsuarioId}`, values);
      if (response.data.success) {
        toast.success("Usuario actualizado correctamente.");
        setIsModalOpen(false);
        fetchUsuarios();
      } else {
        toast.error(response.data.message ?? "Error al guardar los cambios");
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? "Error al guardar los cambios");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.nombreCompleto?.toLowerCase().includes(search.toLowerCase()) ||
        u.samAccountName?.toLowerCase().includes(search.toLowerCase()) ||
        u.correo?.toLowerCase().includes(search.toLowerCase())
    );
  }, [usuarios, search]);

  const columns: ColumnDef<Usuario>[] = [
    {
      accessorKey: 'nombreCompleto',
      header: 'Usuario',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-muted p-2 h-10 w-10 flex items-center justify-center overflow-hidden">
            {row.original.detalle?.avatarUrl ? (
              <img src={row.original.detalle.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombreCompleto}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.dominio}\{row.original.samAccountName}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'correo',
      header: 'Contacto',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.correo && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span>{row.original.correo}</span>
            </div>
          )}
          {row.original.detalle?.celular && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3 w-3 shrink-0" />
              <span>{row.original.detalle.celular}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'organizacion',
      header: 'Organización',
      cell: ({ row }) => {
        const empresa = empresas.find(e => e.idEmpresa === row.original.detalle?.idEmpresa);
        const area = areas.find(a => a.idArea === row.original.detalle?.idArea);
        return (
          <div className="flex flex-col gap-1">
            {empresa && (
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Building2 className="h-3 w-3 shrink-0" />
                <span>{empresa.nombre}</span>
              </div>
            )}
            {area && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3 shrink-0" />
                <span>{area.nombre}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles?.map((r, i) => (
            <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5">
              {r.nombreRol}
            </Badge>
          ))}
          {(!row.original.roles || row.original.roles.length === 0) && (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'esActivo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.esActivo ? 'default' : 'secondary'} className="h-5">
          {row.original.esActivo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => handleEdit(row.original)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      ),
    },
  ];

  const centrosCosto = [
    { id: 101, nombre: '101 - Operaciones' },
    { id: 102, nombre: '102 - Administrativo' },
    { id: 103, nombre: '103 - Comercial' },
    { id: 104, nombre: '104 - Gerencia' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, usuario o email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" onClick={fetchUsuarios} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="relative">
        {!loading && usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <User className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No se encontraron usuarios</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredUsuarios}
              title="Gestión de Usuarios"
              showRowCount
              showRefreshButton
              onRefresh={fetchUsuarios}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-usuario"
        open={isModalOpen}
        setOpen={setIsModalOpen}
        title="Configuración de Usuario"
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleSave)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general" className="gap-1.5">
                  General
                  {tabErrors.general && <span className="h-2 w-2 rounded-full bg-destructive" />}
                </TabsTrigger>
                <TabsTrigger value="trabajo" className="gap-1.5">
                  Trabajo
                  {tabErrors.trabajo && <span className="h-2 w-2 rounded-full bg-destructive" />}
                </TabsTrigger>
                <TabsTrigger value="contacto">Contacto</TabsTrigger>
                <TabsTrigger value="notificaciones">Alertas</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                   <FormField
                    control={form.control}
                    name="samAccountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuario (AD)</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nombreCompleto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="correo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="rolesIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roles Asignados</FormLabel>
                          <FormControl>
                            <MultiSelect
                              options={roles.map(r => ({ label: r.nombreRol, value: String(r.idRol) }))}
                              onChange={(vals) => field.onChange(vals.map(v => Number(v)))}
                              value={field.value.map(v => String(v))}
                              placeholder="Seleccionar roles..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="detalle.activo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Usuario Activo</FormLabel>
                          <FormDescription>Permitir acceso al sistema.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="trabajo" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="detalle.idEmpresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(Number(v))} 
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {empresas.map(e => (
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
                    name="detalle.idSucursal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sucursal</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(Number(v))} 
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar sucursal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sucursales
                              .filter(s => s.idEmpresa === watchedIdEmpresa)
                              .map(s => (
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
                    name="detalle.idArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(Number(v))} 
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar área" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {areas.map(a => (
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
                  <FormField
                    control={form.control}
                    name="detalle.idCentroCosto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de Costo</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(Number(v))} 
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar CC" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {centrosCosto.map(cc => (
                              <SelectItem key={cc.id} value={String(cc.id)}>
                                {cc.nombre}
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
                    name="detalle.puesto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puesto / Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Analista CxP" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detalle.numeroEmpleado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. Empleado</FormLabel>
                        <FormControl>
                          <Input placeholder="Código RRHH" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contacto" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="detalle.telefonoOficina"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono Oficina</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detalle.extension"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extensión</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detalle.celular"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Celular / WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="+52..." {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detalle.telegramChat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram Chat ID</FormLabel>
                        <FormControl>
                          <Input placeholder="ID numérico" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>Para alertas vía bot.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="notificaciones" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Canales Activos
                    </h3>
                    <FormField
                      control={form.control}
                      name="detalle.notificarEmail"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Correo Electrónico</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarApp"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Notificaciones App</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarWhatsapp"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">WhatsApp</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarTelegram"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Telegram</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Tipos de Alerta
                    </h3>
                    <FormField
                      control={form.control}
                      name="detalle.notificarRechazos"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Avisar sobre Rechazos</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarResumenDiario"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Resumen Diario (8 AM)</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarVencimientos"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Alertas de Vencimiento</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="detalle.notificarSoloUrgentes"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="font-normal text-xs">Solo Urgentes (Firma 5)</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
