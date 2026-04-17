import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { resetConfig } from '@/lib/tableConfigStorage';
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCcw,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { API, proveedorApi } from '@/services/api';
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
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/Proveedores';
const REGIMENES_ENDPOINT = '/catalogos/RegimenesFiscales';
const FORMAS_PAGO_ENDPOINT = '/catalogos/FormasPago';
const BANCOS_ENDPOINT = '/catalogos/Bancos';

const proveedorSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social debe tener al menos 3 caracteres'),
  rfc: z.string().optional(),
  codigoPostal: z.string().optional(),
  regimenFiscalId: z.number().optional(),
  usoCfdi: z.string().optional(),
  personaContactoNombre: z.string().optional(),
  contactoTelefono: z.string().optional(),
  contactoEmail: z.string().optional(),
  comentario: z.string().optional(),
});

interface ProveedorMetadata {
  id_persona_subio?: number;
  [key: string]: unknown;
}

interface ProveedorDetalle {
  personaContactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  comentario?: string;
  metadata?: ProveedorMetadata;
}

interface Proveedor {
  idProveedor: number;
  razonSocial: string;
  rfc?: string;
  codigoPostal?: string;
  regimenFiscalId?: number;
  regimenFiscalDescripcion?: string;
  usoCfdi?: string;
  fechaRegistro: string;
  fechaModificacion?: string;
  estatus: number;
  cambioEstatusPor?: number;
  detalle?: ProveedorDetalle;
  cuentasFormaPago?: ProveedorFormaPagoCuenta[];
}

const ESTATUS = {
  NUEVO: 1,
  APROBADO: 2,
  RECHAZADO: 3,
} as const;

const getEstatusLabel = (estatus: number) => {
  switch (estatus) {
    case ESTATUS.NUEVO:
      return 'Nuevo';
    case ESTATUS.APROBADO:
      return 'Aprobado';
    case ESTATUS.RECHAZADO:
      return 'Rechazado';
    default:
      return 'Desconocido';
  }
};

interface RegimenFiscal {
  idRegimenFiscal: number;
  clave: string;
  descripcion: string;
  tipoPersona: string;
  activo: boolean;
}

interface FormaPago {
  idFormaPago: number;
  nombre: string;
  descripcion?: string;
  clave?: string;
  activo: boolean;
  requiereCuenta?: boolean;
}

interface ProveedorFormaPagoCuenta {
  idCuen?: number;
  idProveedor?: number;
  idFormaPago: number;
  formaPagoNombre?: string;
  idBanco?: number;
  bancoNombre?: string;
  numeroCuenta?: string;
  clabe?: string;
  numeroTarjeta?: string;
  beneficiario?: string;
  correoNotificacion?: string;
  activo?: boolean;
}

interface Banco {
  idBanco: number;
  nombre: string;
  clave?: string;
  codigoSwift?: string;
}

type ProveedorFormValues = z.infer<typeof proveedorSchema>;
type ProveedorRequest = ProveedorFormValues & { idProveedor: number };

export default function ProveedoresList() {
  usePageTitle('Proveedores', 'Catálogo de proveedores CxP');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [regimenesFiscales, setRegimenesFiscales] = useState<RegimenFiscal[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [proveedorId, setProveedorId] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; proveedorId: number | null }>({ open: false, proveedorId: null });
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [cuentasFormaPago, setCuentasFormaPago] = useState<ProveedorFormaPagoCuenta[]>([]);

  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      razonSocial: '',
      rfc: '',
      codigoPostal: '',
      regimenFiscalId: undefined,
      usoCfdi: '',
      personaContactoNombre: '',
      contactoTelefono: '',
      contactoEmail: '',
      comentario: '',
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

  const fetchFormasPago = async () => {
    try {
      const response = await API.get<ApiResponse<FormaPago[]>>(FORMAS_PAGO_ENDPOINT);
      if (response.data.success) {
        setFormasPago(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  const fetchBancos = async () => {
    try {
      const response = await API.get<ApiResponse<Banco[]>>(BANCOS_ENDPOINT);
      if (response.data.success) {
        setBancos(response.data.data || []);
      }
    } catch {
      // silencioso — el select quedará vacío
    }
  };

  useEffect(() => {
    fetchProveedores();
    fetchRegimenesFiscales();
    fetchFormasPago();
    fetchBancos();
    // Reset table config to show all columns including new ones (Contacto, Comentario, Estatus)
    resetConfig('proveedores');
  }, []);

  const handleNuevoProveedor = () => {
    setProveedorId(0);
    form.reset({
      razonSocial: '',
      rfc: '',
      codigoPostal: '',
      regimenFiscalId: undefined,
      usoCfdi: '',
      personaContactoNombre: '',
      contactoTelefono: '',
      contactoEmail: '',
      comentario: '',
    });
    setCuentasFormaPago([]);
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
        usoCfdi: proveedor.usoCfdi || '',
        personaContactoNombre: proveedor.detalle?.personaContactoNombre || '',
        contactoTelefono: proveedor.detalle?.contactoTelefono || '',
        contactoEmail: proveedor.detalle?.contactoEmail || '',
        comentario: proveedor.detalle?.comentario || '',
      });
      setCuentasFormaPago(proveedor.cuentasFormaPago || []);
      setIsEditing(true);
      setModalOpen(true);
    }
  };

  const handleSaveProveedor = async (values: ProveedorFormValues) => {
    setIsSaving(true);
    try {
      const { personaContactoNombre, contactoTelefono, contactoEmail, comentario, ...proveedorData } = values;
      const detalle = {
        personaContactoNombre: personaContactoNombre || null,
        contactoTelefono: contactoTelefono || null,
        contactoEmail: contactoEmail || null,
        comentario: comentario || null,
      };
      const payload = {
        idProveedor: proveedorId,
        ...proveedorData,
        detalle: (personaContactoNombre || contactoTelefono || contactoEmail || comentario) ? detalle : null,
        cuentasFormaPago,
      };

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

  const handleAutorizar = async (id: number) => {
    if (!confirm('¿Está seguro de autorizar este proveedor?')) return;
    try {
      await proveedorApi.autorizar(id);
      toast.success('Proveedor autorizado');
      await fetchProveedores();
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al autorizar proveedor');
    }
  };

  const handleRechazar = async () => {
    if (!rejectModal.proveedorId) return;
    try {
      await proveedorApi.rechazar(rejectModal.proveedorId, rejectMotivo);
      toast.success('Proveedor rechazado');
      setRejectModal({ open: false, proveedorId: null });
      setRejectMotivo('');
      await fetchProveedores();
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al rechazar proveedor');
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
      id: 'cuentas',
      header: 'Ctas',
      cell: ({ row }) => {
        const count = row.original.cuentasFormaPago?.length ?? 0;
        if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{count}</Badge>;
      },
    },
    {
      id: 'detalle',
      header: 'Contacto',
      cell: ({ row }) => {
        const detalle = row.original.detalle;
        if (!detalle?.personaContactoNombre && !detalle?.contactoTelefono && !detalle?.contactoEmail) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-col gap-0.5">
            {detalle?.personaContactoNombre && (
              <span className="text-xs font-medium">{detalle.personaContactoNombre}</span>
            )}
            {detalle?.contactoTelefono && (
              <span className="text-xs text-muted-foreground">{detalle.contactoTelefono}</span>
            )}
            {detalle?.contactoEmail && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={detalle.contactoEmail}>
                {detalle.contactoEmail}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'estatus',
      header: 'Estatus',
      cell: ({ row }) => {
        const estatus = row.original.estatus;
        const isAprobado = estatus === ESTATUS.APROBADO;
        const isRechazado = estatus === ESTATUS.RECHAZADO;
        const isNuevo = estatus === ESTATUS.NUEVO;

        const badgeClass = isAprobado
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
          : isRechazado
          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50'
          : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50';

        return (
          <Badge
            variant="outline"
            className={`${badgeClass} border font-medium text-xs px-2 py-0.5 w-fit`}
          >
            {getEstatusLabel(estatus)}
          </Badge>
        );
      },
    },
    {
      id: 'comentario',
      header: 'Comentario',
      cell: ({ row }) => {
        const comentario = row.original.detalle?.comentario;
        if (!comentario) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const isRechazado = row.original.estatus === ESTATUS.RECHAZADO;
        return (
          <div className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 border ${isRechazado ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            {isRechazado && <X className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />}
            <span className={`text-xs leading-relaxed ${isRechazado ? 'text-red-600' : 'text-gray-600'}`}>
              {comentario}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const proveedor = row.original;
        return (
          <div className="flex items-center gap-2">
            {proveedor.estatus === ESTATUS.NUEVO && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => handleAutorizar(proveedor.idProveedor)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Autorizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-red-600 border-red-600 hover:bg-red-50"
                  onClick={() => setRejectModal({ open: true, proveedorId: proveedor.idProveedor })}
                >
                  <X className="h-3.5 w-3.5" />
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
              showColumnToggle
              onRefresh={fetchProveedores}
              filterConfig={{
                tableId: 'proveedores',
                searchableColumns: ['razonSocial', 'rfc'],
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
                name="usoCfdi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uso del CFDI</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona uso del CFDI..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="G01">G01 - Adquisición de mercancías</SelectItem>
                        <SelectItem value="G02">G02 - Devoluciones, descuentos o bonificaciones</SelectItem>
                        <SelectItem value="G03">G03 - Gastos en general</SelectItem>
                        <SelectItem value="I01">I01 - Construcciones</SelectItem>
                        <SelectItem value="I02">I02 - Mobiliario y equipo de oficina</SelectItem>
                        <SelectItem value="I03">I03 - Equipo de transporte</SelectItem>
                        <SelectItem value="I04">I04 - Equipo de cómputo</SelectItem>
                        <SelectItem value="D01">D01 - Honorarios médicos</SelectItem>
                        <SelectItem value="D02">D02 - Gastos médicos por incapacidad</SelectItem>
                        <SelectItem value="S01">S01 - Sin efectos fiscales</SelectItem>
                        <SelectItem value="P01">P01 - Por definir</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Datos de Contacto</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="personaContactoNombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Persona de Contacto</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de la persona de contacto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactoTelefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono de Contacto</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono de contacto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactoEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de Contacto</FormLabel>
                      <FormControl>
                        <Input placeholder="Email de contacto" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="comentario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comentario</FormLabel>
                      <FormControl>
                        <Input placeholder="Comentario adicional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Cuentas Forma de Pago */}
            <div className="space-y-3 pt-2 border-t mt-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Cuentas Bancarias</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCuentasFormaPago((prev) => [
                      ...prev,
                      { idCuen: 0, idFormaPago: 0, activo: true },
                    ]);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" /> Agregar Cuenta
                </Button>
              </div>

              {cuentasFormaPago.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Sin cuentas registradas. Usa "Agregar Cuenta" para añadir cuentas bancarias.
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cuentasFormaPago.map((cuenta, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-lg bg-gray-50/50">
                      {/* Forma de Pago */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Forma de Pago</label>
                        <Select
                          value={String(cuenta.idFormaPago || '')}
                          onValueChange={(val) => {
                            const updated = [...cuentasFormaPago];
                            updated[index].idFormaPago = Number(val);
                            updated[index].formaPagoNombre = formasPago.find((fp) => fp.idFormaPago === Number(val))?.nombre || '';
                            setCuentasFormaPago(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Forma" />
                          </SelectTrigger>
                          <SelectContent>
                            {formasPago.map((fp) => (
                              <SelectItem key={fp.idFormaPago} value={String(fp.idFormaPago)}>
                                {fp.clave ? `${fp.clave} - ${fp.nombre}` : fp.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Banco */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Banco</label>
                        <Select
                          value={String(cuenta.idBanco || '')}
                          onValueChange={(val) => {
                            const updated = [...cuentasFormaPago];
                            updated[index].idBanco = Number(val);
                            updated[index].bancoNombre = bancos.find((b) => b.idBanco === Number(val))?.nombre || '';
                            setCuentasFormaPago(updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {bancos.map((b) => (
                              <SelectItem key={b.idBanco} value={String(b.idBanco)}>
                                {b.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Número de Cuenta */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">No. Cuenta</label>
                        <Input
                          className="h-8 text-xs"
                          placeholder="****1234"
                          value={cuenta.numeroCuenta || ''}
                          onChange={(e) => {
                            const updated = [...cuentasFormaPago];
                            updated[index].numeroCuenta = e.target.value;
                            setCuentasFormaPago(updated);
                          }}
                        />
                      </div>

                      {/* CLABE */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">CLABE</label>
                        <Input
                          className="h-8 text-xs"
                          placeholder="CLABE 18 dígitos"
                          value={cuenta.clabe || ''}
                          onChange={(e) => {
                            const updated = [...cuentasFormaPago];
                            updated[index].clabe = e.target.value;
                            setCuentasFormaPago(updated);
                          }}
                        />
                      </div>

                      {/* Beneficiario */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Beneficiario</label>
                        <div className="flex gap-1">
                          <Input
                            className="h-8 text-xs flex-1"
                            placeholder="Nombre"
                            value={cuenta.beneficiario || ''}
                            onChange={(e) => {
                              const updated = [...cuentasFormaPago];
                              updated[index].beneficiario = e.target.value;
                              setCuentasFormaPago(updated);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setCuentasFormaPago((prev) => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Form>
      </Modal>

      <Modal
        id="modal-rechazar"
        open={rejectModal.open}
        setOpen={(open) => {
          if (!open) {
            setRejectModal({ open: false, proveedorId: null });
            setRejectMotivo('');
          }
        }}
        title="Rechazar Proveedor"
        size="md"
        footer={
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectModal({ open: false, proveedorId: null });
                setRejectMotivo('');
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRechazar}
            >
              Rechazar Proveedor
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Está seguro de rechazar este proveedor? Esta acción no se puede deshacer.
          </p>
          <div>
            <label className="text-sm font-medium mb-2 block">Motivo del rechazo</label>
            <textarea
              className="w-full min-h-[100px] px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ingrese el motivo del rechazo (opcional)"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
