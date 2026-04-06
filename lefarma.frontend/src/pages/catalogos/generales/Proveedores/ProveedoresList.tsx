import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/Proveedores';
const REGIMENES_ENDPOINT = '/catalogos/RegimenesFiscales';

const proveedorSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social debe tener al menos 3 caracteres'),
  rfc: z.string().optional(),
  codigoPostal: z.string().optional(),
  regimenFiscalId: z.number().optional(),
  personaContacto: z.string().optional(),
  notaFormaPago: z.string().optional(),
  notasGenerales: z.string().optional(),
  sinDatosFiscales: z.boolean(),
  autorizadoPorCxP: z.boolean(),
});

interface Proveedor {
  idProveedor: number;
  razonSocial: string;
  rfc?: string;
  codigoPostal?: string;
  regimenFiscalId?: number;
  regimenFiscalDescripcion?: string;
  personaContacto?: string;
  notaFormaPago?: string;
  notasGenerales?: string;
  sinDatosFiscales: boolean;
  autorizadoPorCxP: boolean;
  fechaRegistro: string;
  fechaModificacion?: string;
}

interface RegimenFiscal {
  idRegimenFiscal: number;
  clave: string;
  descripcion: string;
  tipoPersona: string;
  activo: boolean;
}

type ProveedorFormValues = z.infer<typeof proveedorSchema>;
type ProveedorRequest = ProveedorFormValues & { idProveedor: number };

export default function ProveedoresList() {
  usePageTitle('Proveedores', 'Catálogo de proveedores CxP');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [regimenesFiscales, setRegimenesFiscales] = useState<RegimenFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [proveedorId, setProveedorId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [rechazarDialogOpen, setRechazarDialogOpen] = useState(false);
  const [rechazarProveedorId, setRechazarProveedorId] = useState<number>(0);
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [isRechazando, setIsRechazando] = useState(false);

  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      razonSocial: '',
      rfc: '',
      codigoPostal: '',
      regimenFiscalId: undefined,
      personaContacto: '',
      notaFormaPago: '',
      notasGenerales: '',
      sinDatosFiscales: false,
      autorizadoPorCxP: false,
    },
  });

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Proveedor[]>>(ENDPOINT);
      if (response.data.success) {
        setProveedores(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'Proveedores.NotFound');
      if (isNotFound) {
        setProveedores([]);
        toast.warning('No se encontraron proveedores en el sistema');
      } else {
        toast.error(error?.message ?? 'Error al cargar los proveedores');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRegimenesFiscales = async () => {
    try {
      const response = await API.get<ApiResponse<RegimenFiscal[]>>(REGIMENES_ENDPOINT);
      if (response.data.success) {
        setRegimenesFiscales(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchProveedores();
    fetchRegimenesFiscales();
  }, []);

  const handleNuevoProveedor = () => {
    setProveedorId(0);
    form.reset({
      razonSocial: '',
      rfc: '',
      codigoPostal: '',
      regimenFiscalId: undefined,
      personaContacto: '',
      notaFormaPago: '',
      notasGenerales: '',
      sinDatosFiscales: false,
      autorizadoPorCxP: false,
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleEditProveedor = (id: number) => {
    const proveedor = proveedores.find((p) => p.idProveedor === id);
    if (proveedor) {
      setProveedorId(proveedor.idProveedor);
      form.reset({
        razonSocial: proveedor.razonSocial,
        rfc: proveedor.rfc || '',
        codigoPostal: proveedor.codigoPostal || '',
        regimenFiscalId: proveedor.regimenFiscalId,
        personaContacto: proveedor.personaContacto || '',
        notaFormaPago: proveedor.notaFormaPago || '',
        notasGenerales: proveedor.notasGenerales || '',
        sinDatosFiscales: proveedor.sinDatosFiscales,
        autorizadoPorCxP: proveedor.autorizadoPorCxP,
      });
      setIsEditing(true);
      setModalOpen(true);
    }
  };

  const handleSaveProveedor = async (values: ProveedorFormValues) => {
    setIsSaving(true);
    try {
      const payload: ProveedorRequest = { idProveedor: proveedorId, ...values };

      const response = isEditing
        ? await API.put(`${ENDPOINT}/${proveedorId}`, payload)
        : await API.post(ENDPOINT, payload);

      if (response.data.success) {
        toast.success(isEditing ? 'Proveedor actualizado correctamente.' : 'Proveedor creado correctamente.');
        setModalOpen(false);
        await fetchProveedores();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el proveedor');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el proveedor');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProveedor = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
    try {
      const response = await API.delete<ApiResponse<void>>(`${ENDPOINT}/${id}`);
      if (response.data.success) {
        toast.success('Proveedor eliminado correctamente');
        fetchProveedores();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al eliminar el proveedor');
    }
  };

  const handleAutorizarProveedor = async (id: number) => {
    try {
      const response = await API.post<ApiResponse<void>>(
        `/catalogos/proveedores/${id}/autorizar`,
      );
      if (response.data.success) {
        toast.success('Proveedor autorizado correctamente');
        fetchProveedores();
      } else {
        toast.error(response.data.message ?? 'Error al autorizar el proveedor');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al autorizar el proveedor');
    }
  };

  const handleOpenRechazarDialog = (id: number) => {
    setRechazarProveedorId(id);
    setRechazarMotivo('');
    setRechazarDialogOpen(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!rechazarMotivo.trim()) {
      toast.error('El motivo de rechazo es obligatorio');
      return;
    }
    setIsRechazando(true);
    try {
      const response = await API.post<ApiResponse<void>>(
        `/catalogos/proveedores/${rechazarProveedorId}/rechazar`,
        { motivo: rechazarMotivo.trim() },
      );
      if (response.data.success) {
        toast.success('Proveedor rechazado correctamente');
        setRechazarDialogOpen(false);
        setRechazarMotivo('');
        fetchProveedores();
      } else {
        toast.error(response.data.message ?? 'Error al rechazar el proveedor');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al rechazar el proveedor');
    } finally {
      setIsRechazando(false);
    }
  };

  const filteredProveedores = useMemo(() => {
    return proveedores.filter((p) =>
      p.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      p.rfc?.toLowerCase().includes(search.toLowerCase())
    );
  }, [proveedores, search]);

  const columns: ColumnDef<Proveedor>[] = [
    {
      accessorKey: 'razonSocial',
      header: 'Razón Social',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Building className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.razonSocial}</span>
            {row.original.rfc && (
              <span className="text-xs text-muted-foreground font-mono">{row.original.rfc}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'rfc',
      header: 'RFC',
      cell: ({ row }) => (
        <span className="text-sm font-mono">{row.original.rfc || '—'}</span>
      ),
    },
    {
      accessorKey: 'codigoPostal',
      header: 'C.P.',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.codigoPostal || '—'}</span>
      ),
    },
    {
      accessorKey: 'regimenFiscalDescripcion',
      header: 'Régimen Fiscal',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.regimenFiscalDescripcion || '—'}</span>
      ),
    },
    {
      accessorKey: 'sinDatosFiscales',
      header: 'Sin Datos Fiscales',
      cell: ({ row }) => (
        <Badge
          variant={row.original.sinDatosFiscales ? 'default' : 'secondary'}
          className={row.original.sinDatosFiscales ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          {row.original.sinDatosFiscales ? 'Sí' : 'No'}
        </Badge>
      ),
    },
    {
      accessorKey: 'autorizadoPorCxP',
      header: 'Autorizado CxP',
      cell: ({ row }) => (
        <Badge
          variant={row.original.autorizadoPorCxP ? 'default' : 'secondary'}
          className={
            row.original.autorizadoPorCxP
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
          }
        >
          {row.original.autorizadoPorCxP ? 'Autorizado' : 'Pendiente'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const proveedor = row.original;
        return (
          <div className="flex items-center gap-2">
            {!proveedor.autorizadoPorCxP && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-green-600 text-green-600 hover:bg-green-50"
                  onClick={() => handleAutorizarProveedor(proveedor.idProveedor)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Autorizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-red-600 text-red-600 hover:bg-red-50"
                  onClick={() => handleOpenRechazarDialog(proveedor.idProveedor)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => handleEditProveedor(proveedor.idProveedor)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              onClick={() => handleDeleteProveedor(proveedor.idProveedor)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por razón social o RFC..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevoProveedor}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Proveedor
        </Button>
      </div>

      <div className="relative">
        {!loading && proveedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <Building className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay proveedores registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Los proveedores se crean cuando CxP autoriza</p>
            <Button className="mt-4" size="sm" onClick={fetchProveedores}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredProveedores}
              title="Proveedores"
              showRowCount
              showRefreshButton
              onRefresh={fetchProveedores}
              filterConfig={{
                tableId: 'proveedores',
                searchableColumns: ['razonSocial', 'rfc', 'personaContacto'],
                defaultSearchColumns: ['razonSocial'],
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
        id="modal-proveedor"
        open={modalOpen}
        setOpen={setModalOpen}
        title={isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={form.handleSubmit(handleSaveProveedor)}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="razonSocial"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Razón Social *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la empresa o persona" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rfc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RFC</FormLabel>
                    <FormControl>
                      <Input placeholder="RFC del proveedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigoPostal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Postal</FormLabel>
                    <FormControl>
                      <Input placeholder="C.P." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="regimenFiscalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Régimen Fiscal</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona régimen..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {regimenesFiscales.map((r) => (
                          <SelectItem key={r.idRegimenFiscal} value={String(r.idRegimenFiscal)}>
                            {r.clave} - {r.descripcion}
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
                name="personaContacto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persona de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del contacto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notaFormaPago"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nota Forma de Pago</FormLabel>
                    <FormControl>
                      <Input placeholder="Instrucciones de pago" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notasGenerales"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notas Generales</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas adicionales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sinDatosFiscales"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Sin Datos Fiscales</FormLabel>
                      <FormDescription>Marcar si el proveedor no tiene datos fiscales completos.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autorizadoPorCxP"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Autorizado por CxP</FormLabel>
                      <FormDescription>El proveedor está autorizado por Cuentas por Pagar.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </Modal>

      <Dialog open={rechazarDialogOpen} onOpenChange={setRechazarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Proveedor</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo. Este dato será registrado para referencia.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="motivo-rechazo" className="text-sm font-medium">
              Motivo del rechazo *
            </label>
            <Textarea
              id="motivo-rechazo"
              placeholder="Describe el motivo del rechazo..."
              className="mt-2"
              value={rechazarMotivo}
              onChange={(e) => setRechazarMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRechazarDialogOpen(false)}
              disabled={isRechazando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRechazando || !rechazarMotivo.trim()}
              onClick={handleConfirmarRechazo}
            >
              {isRechazando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
