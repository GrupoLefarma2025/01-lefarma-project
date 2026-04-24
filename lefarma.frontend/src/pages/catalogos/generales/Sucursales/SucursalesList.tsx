import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Store, Plus, Pencil, Trash2, Search, Phone, MapPin, Loader2, RefreshCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Empresa, Sucursal } from '@/types/catalogo.types';
import { useForm } from 'react-hook-form';
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
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';

const ENDPOINT = '/catalogos/Sucursales';
const EMPRESAS_ENDPOINT = '/catalogos/Empresas';

const sucursalSchema = z.object({
  idEmpresa: z.number({ message: 'La empresa es obligatoria' }).min(1, 'Selecciona una empresa'),
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  clave: z.string().optional().or(z.literal('')),
  claveContable: z.string().optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
  codigoPostal: z.string().optional().or(z.literal('')),
  ciudad: z.string().optional().or(z.literal('')),
  estado: z.string().optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  latitud: z.number().optional().or(z.literal(0)),
  longitud: z.number().optional().or(z.literal(0)),
  numeroEmpleados: z.number().optional().or(z.literal(0)),
  activo: z.boolean(),
});

type SucursalFormValues = z.infer<typeof sucursalSchema>;
type SucursalRequest = SucursalFormValues & { idSucursal: number };

export default function SucursalesList() {
  usePageTitle('Sucursales', 'Gestión de sucursales del catálogo general');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [sucursalId, setSucursalId] = useState(0);

  const [modalStates, setModalStates] = useState({ newSucursal: false });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const formSucursal = useForm<SucursalFormValues>({
    resolver: zodResolver(sucursalSchema),
    defaultValues: {
      idEmpresa: 0,
      nombre: '',
      descripcion: '',
      clave: '',
      claveContable: '',
      direccion: '',
      codigoPostal: '',
      ciudad: '',
      estado: '',
      telefono: '',
      latitud: 0,
      longitud: 0,
      numeroEmpleados: 0,
      activo: true,
    },
  });

  const fetchSucursales = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Sucursal[]>>(ENDPOINT);
      if (response.data.success) {
        setSucursales(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar las sucursales');
    }finally {
      setLoading(false);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const response = await API.get<ApiResponse<Empresa[]>>(EMPRESAS_ENDPOINT);
      if (response.data.success) {
        setEmpresas(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchSucursales();
    fetchEmpresas();
  }, []);

  const handleNuevaSucursal = () => {
    setSucursalId(0);
    formSucursal.reset();
    setIsEditing(false);
    toggleModal('newSucursal', true);
  };

  const handleEditSucursal = (id: number) => {
    const sucursal = sucursales.find((s) => s.idSucursal === id);
    if (sucursal) {
      setSucursalId(sucursal.idSucursal);
      formSucursal.reset({
        idEmpresa: sucursal.idEmpresa,
        nombre: sucursal.nombre,
        descripcion: sucursal.descripcion || '',
        clave: sucursal.clave || '',
        claveContable: sucursal.claveContable || '',
        direccion: sucursal.direccion || '',
        codigoPostal: sucursal.codigoPostal || '',
        ciudad: sucursal.ciudad || '',
        estado: sucursal.estado || '',
        telefono: sucursal.telefono || '',
        latitud: sucursal.latitud || 0,
        longitud: sucursal.longitud || 0,
        numeroEmpleados: sucursal.numeroEmpleados || 0,
        activo: sucursal.activo,
      });
      setIsEditing(true);
      toggleModal('newSucursal', true);
    }
  };

  const handleSaveSucursal = async (values: SucursalFormValues) => {
    setIsSaving(true);
    try {
      const payload: SucursalRequest = { idSucursal: sucursalId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${sucursalId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Sucursal actualizada correctamente.' : 'Sucursal creada correctamente.');
        toggleModal('newSucursal', false);
        await fetchSucursales();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la sucursal');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar la sucursal');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estas seguro de eliminar esta sucursal?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Sucursal eliminada correctamente');
        fetchSucursales();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar la sucursal');
    }
  };

  const filteredSucursales = useMemo(() => {
    return sucursales.filter((s) =>
      s.nombre.toLowerCase().includes(search.toLowerCase()) ||
      s.clave?.toLowerCase().includes(search.toLowerCase()) ||
      s.ciudad?.toLowerCase().includes(search.toLowerCase())
    );
  }, [sucursales, search]);

  const columns: ColumnDef<Sucursal>[] = [
    {
      accessorKey: 'nombre',
      header: 'Sucursal',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Store className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            {row.original.clave && (
              <span className="text-xs text-muted-foreground">{row.original.clave}</span>
            )}
            {row.original.descripcion && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.descripcion}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'idEmpresa',
      header: 'Empresa',
      cell: ({ row }) => {
        const empresa = empresas.find((e) => e.idEmpresa === row.original.idEmpresa);
        return empresa ? (
          <div className="flex items-center gap-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            {empresa.nombre}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'ubicacion',
      header: 'Ubicacion',
      cell: ({ row }) => {
        const partes = [row.original.ciudad, row.original.estado].filter(Boolean).join(', ');
        return (
          <div className="flex flex-col gap-1">
            {partes ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{partes}</span>
              </div>
            ) : null}
            {row.original.direccion ? (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.direccion}</span>
            ) : null}
            {!partes && !row.original.direccion && (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'contacto',
      header: 'Contacto',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.telefono ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{row.original.telefono}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin contacto</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'} className="h-5">
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5"
            onClick={() => handleEditSucursal(row.original.idSucursal)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="destructive" className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idSucursal)}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, clave o ciudad..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevaSucursal}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Sucursal
        </Button>
      </div>

      <div className="relative">
        {!loading && sucursales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Store className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay sucursales registradas</p>
            <Button className="mt-4" size="sm" onClick={fetchSucursales}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredSucursales}
              title="Listado de Sucursales"
              showRowCount
              showRefreshButton
              onRefresh={fetchSucursales}
              filterConfig={{
                tableId: 'sucursales',
                searchableColumns: ['nombre', 'ciudad', 'estado', 'direccion', 'telefono'],
                defaultSearchColumns: ['nombre'],
              }}
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
        id="modal-sucursal"
        open={modalStates.newSucursal}
        setOpen={(open) => toggleModal('newSucursal', open)}
        title={isEditing ? 'Editar Sucursal' : 'Nueva Sucursal'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('newSucursal', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formSucursal.handleSubmit(handleSaveSucursal)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Sucursal'}
            </Button>
          </div>
        }
      >
        <Form {...formSucursal}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formSucursal.control}
                name="idEmpresa"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Empresa</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una empresa..." />
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
                control={formSucursal.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre de la sucursal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl><Input placeholder="Descripcion breve" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl><Input placeholder="Clave interna" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="claveContable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave Contable</FormLabel>
                    <FormControl><Input placeholder="Clave contable" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl><Input placeholder="Numero telefonico" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="numeroEmpleados"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numero de Empleados</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>La sucursal aparecera en los catalogos.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={formSucursal.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direccion</FormLabel>
                  <FormControl><Input placeholder="Calle, numero, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField
                control={formSucursal.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="codigoPostal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>C.P.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={formSucursal.control}
                name="latitud"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitud</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formSucursal.control}
                name="longitud"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitud</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
