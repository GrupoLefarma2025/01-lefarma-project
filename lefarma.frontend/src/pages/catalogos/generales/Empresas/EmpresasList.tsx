import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Building2, Plus, Pencil, Trash2, Search, Phone, Mail, Loader2, MapPin, Globe, RefreshCcw, /* Store, */ } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { Empresa } from '@/types/catalogo.types';
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
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';

// Helper function to normalize text (remove accents and convert to lowercase)
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase();
};


const empresaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional().or(z.literal('')),
  clave: z.string().optional().or(z.literal('')),
  razonSocial: z.string().optional().or(z.literal('')),
  rfc: z.string().optional().or(z.literal('')),
  direccion: z.string().optional().or(z.literal('')),
  colonia: z.string().optional().or(z.literal('')),
  ciudad: z.string().optional().or(z.literal('')),
  estado: z.string().optional().or(z.literal('')),
  codigoPostal: z.string().optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  paginaWeb: z.string().url('URL invalida').optional().or(z.literal('')),
  numeroEmpleados: z.number().optional().or(z.literal(0)),
  activo: z.boolean(),
  puedeSeleccionarEmpresas: z.boolean(),
});

type EmpresaFormValues = z.infer<typeof empresaSchema>;
type EmpresaRequest = Omit<EmpresaFormValues, 'puedeSeleccionarEmpresas'> & {
  idEmpresa: number;
  puedeSeleccionarEmpresas: boolean;
};

export default function EmpresasList() {
  usePageTitle('Empresas', 'Gestión de empresas del catálogo general');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [, forceUpdate] = useState({}); // Force re-render when needed
  const [isEditing, setIsEditing] = useState(false);

  const [modalStates, setModalStates] = useState({
    newEmpresa: false,
  });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates(prev => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  const [empresaId, setEmpresaId] = useState(0);

  const formEmpresa = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      clave: '',
      razonSocial: '',
      rfc: '',
      direccion: '',
      colonia: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      telefono: '',
      email: '',
      paginaWeb: '',
      numeroEmpleados: 0,
      activo: true,
      puedeSeleccionarEmpresas: false,
    },
  });


  const fetchEmpresas = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Empresa[]>>(`/catalogos/Empresas`);
      if (response.data.success) {
        setEmpresas(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar las empresas');
    }finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const handleNuevaEmpresa = () => {
    setEmpresaId(0);
    formEmpresa.reset();
    setIsEditing(false);
    toggleModal("newEmpresa", true);
  };

  const handleEditEmpresa = (id: number) => {
    const empresa = empresas.find((e) => e.idEmpresa === id);
    if (empresa) {
      setEmpresaId(empresa.idEmpresa);
      formEmpresa.reset({
        nombre: empresa.nombre,
        descripcion: empresa.descripcion || '',
        clave: empresa.clave || '',
        razonSocial: empresa.razonSocial || '',
        rfc: empresa.rfc || '',
        direccion: empresa.direccion || '',
        colonia: empresa.colonia || '',
        ciudad: empresa.ciudad || '',
        estado: empresa.estado || '',
        codigoPostal: empresa.codigoPostal || '',
        telefono: empresa.telefono || '',
        email: empresa.email || '',
        paginaWeb: empresa.paginaWeb || '',
        numeroEmpleados: empresa.numeroEmpleados || 0,
        activo: empresa.activo,
        puedeSeleccionarEmpresas: (empresa as any).puedeSeleccionarEmpresas ?? false,
      });
      setIsEditing(true);
      toggleModal("newEmpresa", true);
    }
  };

  const handleSaveEmpresa = async (values: EmpresaFormValues) => {
    setIsSaving(true);
    try {
      const payload: EmpresaRequest = { idEmpresa: empresaId, ...values };

      const response = isEditing
        ? await API.put(`catalogos/Empresas/${empresaId}`, payload)
        : await API.post(`catalogos/Empresas`, payload);

      if (response.data.success) {
        toast.success(isEditing ? "Empresa actualizada correctamente." : "Empresa creada correctamente.");
        toggleModal("newEmpresa", false);
        await fetchEmpresas();
      } else {
        toast.error(response.data.message ?? "Error al guardar la empresa");
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? "Error al guardar la empresa");
      }
    } finally {
      setIsSaving(false);
    }
  };


  const handleDelete = async (id: number) => {
    if (!confirm('Estas seguro de eliminar esta empresa?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`/catalogos/Empresas/${id}`);
      if (response.data.success) {
        toast.success('Empresa eliminada correctamente');
        fetchEmpresas();
      }
    } catch (error) {
      toast.error('Error al eliminar la empresa');
      console.error(error);
    }
  };

  const filteredEmpresas = useMemo(() => {
    // Read search columns from localStorage
    const getSearchColumns = () => {
      try {
        const stored = localStorage.getItem('table-configs');
        if (!stored) return ['nombre']; // Default
        const parsed = JSON.parse(stored);
        const empresasConfig = parsed.find((c: any) => c.tableId === 'empresas');
        return empresasConfig?.searchColumns || ['nombre'];
      } catch {
        return ['nombre'];
      }
    };

    const searchColumns = getSearchColumns();
    const searchNormalized = normalizeText(search);

    if (search === '') {
      return empresas;
    }

    return empresas.filter((e) => {
      // Map column IDs to actual object properties
      const columnToValue: Record<string, string> = {
        'nombre': e.nombre,
        'razonSocial': e.razonSocial || '',
        'ubicacion': [e.ciudad, e.estado].filter(Boolean).join(', '),
        'contacto': [e.email, e.telefono, e.paginaWeb].filter(Boolean).join(' '),
        'activo': e.activo ? 'Activo' : 'Inactivo',
      };

      // Check if any selected column matches (with accent-insensitive search)
      return searchColumns.some((columnId: string) => {
        const value = columnToValue[columnId];
        return value && normalizeText(value).includes(searchNormalized);
      });
    });
  }, [empresas, search, forceUpdate]); // forceUpdate ensures re-read on localStorage change

  const columns: ColumnDef<Empresa>[] = [
    {
      accessorKey: 'nombre',
      header: 'Empresa',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Building2 className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.nombre}</span>
            <span className="text-xs text-muted-foreground">{row.original.rfc || 'Sin RFC'}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'razonSocial',
      header: 'Razon Social',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.razonSocial || '-'}</span>
          {row.original.descripcion && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.descripcion}</span>
          )}
        </div>
      ),
    },
    {
      id: 'ubicacion',
      header: 'Ubicacion',
      cell: ({ row }) => {
        const partes = [row.original.ciudad, row.original.estado].filter(Boolean).join(', ');
        return partes ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{partes}</span>
          </div>
        ) : <span className="text-xs text-muted-foreground">-</span>;
      },
    },
    {
      id: 'contacto',
      header: 'Contacto',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span>{row.original.email}</span>
            </div>
          )}
          {row.original.telefono && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{row.original.telefono}</span>
            </div>
          )}
          {row.original.paginaWeb && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <a href={row.original.paginaWeb} target="_blank" rel="noreferrer" className="hover:underline truncate max-w-[160px]">
                {row.original.paginaWeb.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {!row.original.email && !row.original.telefono && !row.original.paginaWeb && (
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
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleEditEmpresa(row.original.idEmpresa)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDelete(row.original.idEmpresa)}
          >
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
            placeholder="Buscar empresa, Razon Social o RFC..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevaEmpresa}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Empresa
        </Button>
      </div>

      <div className="relative">
        {!loading && empresas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Building2 className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay empresas registradas</p>
            <Button className="mt-4" size="sm" onClick={fetchEmpresas}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredEmpresas}
              title="Listado de Empresas"
              showRowCount
              showRefreshButton
              onRefresh={fetchEmpresas}
              filterConfig={{
                tableId: 'empresas',
                searchableColumns: ['nombre', 'razonSocial', 'ubicacion', 'contacto', 'activo'],
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
        id="modal-empresa"
        open={modalStates.newEmpresa}
        setOpen={(open) => toggleModal("newEmpresa", open)}
        title={isEditing ? 'Editar Empresa' : 'Nueva Empresa'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal("newEmpresa", false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={formEmpresa.handleSubmit(handleSaveEmpresa)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Empresa'}
            </Button>
          </div>
        }
      >
        <Form {...formEmpresa}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={formEmpresa.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre comercial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="razonSocial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razon Social</FormLabel>
                    <FormControl>
                      <Input placeholder="Razon social legal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripcion breve de la empresa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="rfc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RFC</FormLabel>
                    <FormControl>
                      <Input placeholder="Registro Federal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave</FormLabel>
                    <FormControl>
                      <Input placeholder="Clave interna" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input placeholder="Numero telefonico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="paginaWeb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pagina Web</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={formEmpresa.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Activo</FormLabel>
                    <FormDescription>La empresa aparecera en los catalogos.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={formEmpresa.control}
              name="puedeSeleccionarEmpresas"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Restringir empresa</FormLabel>
                    <FormDescription>Los usuarios asignados a esta empresa no podran cambiar a otra empresa o sucursal.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            </div>

            <FormField
              control={formEmpresa.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direccion</FormLabel>
                  <FormControl>
                    <Input placeholder="Calle, numero, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <FormField
                control={formEmpresa.control}
                name="colonia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colonia</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formEmpresa.control}
                name="codigoPostal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>C.P.</FormLabel>
                    <FormControl>
                      <Input {...field} />
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