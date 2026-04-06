import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { UserCircle, Plus, Pencil, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
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

const ENDPOINT = '/catalogos/RegimenesFiscales';

const regimenFiscalSchema = z.object({
  clave: z.string().min(1, 'La clave es obligatoria'),
  descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  tipoPersona: z.enum(['Moral', 'Física'], { message: 'El tipo de persona es obligatorio' }),
  activo: z.boolean(),
});

interface RegimenFiscal {
  idRegimenFiscal: number;
  clave: string;
  descripcion: string;
  tipoPersona: string;
  activo: boolean;
  fechaCreacion: string;
}

type RegimenFiscalFormValues = z.infer<typeof regimenFiscalSchema>;
type RegimenFiscalRequest = RegimenFiscalFormValues & { idRegimenFiscal: number };

export default function RegimenesFiscalesList() {
  usePageTitle('Regímenes Fiscales', 'Catálogo SAT CFDI 4.0');
  const [regimenes, setRegimenes] = useState<RegimenFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [regimenId, setRegimenId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const form = useForm<RegimenFiscalFormValues>({
    resolver: zodResolver(regimenFiscalSchema),
    defaultValues: {
      clave: '',
      descripcion: '',
      tipoPersona: 'Moral',
      activo: true,
    },
  });

  const fetchRegimenes = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<RegimenFiscal[]>>(ENDPOINT);
      if (response.data.success) {
        setRegimenes(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'RegimenesFiscales.NotFound');
      if (isNotFound) {
        setRegimenes([]);
        toast.warning('No se encontraron regímenes fiscales en el sistema');
      } else {
        toast.error(error?.message ?? 'Error al cargar los regímenes fiscales');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegimenes();
  }, []);

  const handleNuevoRegimen = () => {
    setRegimenId(0);
    form.reset({ clave: '', descripcion: '', tipoPersona: 'Moral', activo: true });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEditRegimen = (id: number) => {
    const regimen = regimenes.find((r) => r.idRegimenFiscal === id);
    if (regimen) {
      setRegimenId(regimen.idRegimenFiscal);
      form.reset({
        clave: regimen.clave,
        descripcion: regimen.descripcion,
        tipoPersona: regimen.tipoPersona as 'Moral' | 'Física',
        activo: regimen.activo,
      });
      setIsEditing(true);
      setModalOpen(true);
    }
  };

  const handleSaveRegimen = async (values: RegimenFiscalFormValues) => {
    setIsSaving(true);
    try {
      const payload: RegimenFiscalRequest = { idRegimenFiscal: regimenId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${regimenId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Régimen fiscal actualizado correctamente.' : 'Régimen fiscal creado correctamente.');
        setModalOpen(false);
        await fetchRegimenes();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el régimen fiscal');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el régimen fiscal');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRegimen = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este régimen fiscal?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Régimen fiscal eliminado correctamente');
        fetchRegimenes();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar el régimen fiscal');
    }
  };

  const filteredRegimenes = useMemo(() => {
    return regimenes.filter((r) =>
      r.clave.toLowerCase().includes(search.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(search.toLowerCase())
    );
  }, [regimenes, search]);

  const columns: ColumnDef<RegimenFiscal>[] = [
    {
      accessorKey: 'clave',
      header: 'Clave SAT',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <UserCircle className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-mono font-medium">{row.original.clave}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.descripcion}</span>
      ),
    },
    {
      accessorKey: 'tipoPersona',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge variant={row.original.tipoPersona === 'Moral' ? 'default' : 'secondary'} className="h-5">
          {row.original.tipoPersona}
        </Badge>
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
            onClick={() => handleEditRegimen(row.original.idRegimenFiscal)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleDeleteRegimen(row.original.idRegimenFiscal)}
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
            placeholder="Buscar por clave o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevoRegimen}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Régimen Fiscal
        </Button>
      </div>

      <div className="relative">
        {!loading && regimenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <UserCircle className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay regímenes fiscales registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Catálogo SAT CFDI 4.0</p>
            <Button className="mt-4" size="sm" onClick={fetchRegimenes}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredRegimenes}
              title="Regímenes Fiscales SAT"
              showRowCount
              showRefreshButton
              onRefresh={fetchRegimenes}
              filterConfig={{
                tableId: 'regimenes-fiscales',
                searchableColumns: ['nombre', 'descripcion'],
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
        id="modal-regimen-fiscal"
        open={modalOpen}
        setOpen={setModalOpen}
        title={isEditing ? 'Editar Régimen Fiscal' : 'Nuevo Régimen Fiscal'}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={form.handleSubmit(handleSaveRegimen)}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Régimen Fiscal'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="clave"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave SAT *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. 601" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipoPersona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Persona *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val as 'Moral' | 'Física')}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Moral">Persona Moral</SelectItem>
                        <SelectItem value="Física">Persona Física</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripción del régimen fiscal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 md:col-span-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>El régimen fiscal aparecerá en los catálogos.</FormDescription>
                    </div>
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
