import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  X,
  Building2,
  Tag,
  CreditCard,
  Calendar,
  User,
  FileText,
  ChevronsUpDown,
  Check,
  Search,
  ChevronDown,
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CreateOrdenCompraRequest } from '@/types/ordenCompra.types';
import type {
  Empresa,
  Sucursal,
  Area,
  FormaPago,
  UnidadMedida,
  Medida,
  TipoImpuesto,
  ProveedorCuentaBancaria,
  Moneda,
} from '@/types/catalogo.types';

interface Proveedor {
  idProveedor: number;
  razonSocial: string;
  rfc?: string;
  codigoPostal?: string;
  regimenFiscalId?: number;
  regimenFiscalDescripcion?: string;
  usoCfdi?: string;
  sinDatosFiscales?: boolean;
  detalle?: {
    personaContactoNombre?: string;
    contactoTelefono?: string;
    contactoEmail?: string;
  };
  cuentasFormaPago?: ProveedorCuentaBancaria[];
}

const partidaSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida').max(500),
  cantidad: z.number().positive('Debe ser mayor a 0'),
  idUnidadMedida: z.number().positive('Seleccione una unidad'),
  precioUnitario: z.number().positive('Debe ser mayor a 0'),
  descuento: z.number().min(0),
  idTipoImpuesto: z.number().positive('Seleccione un impuesto'),
  porcentajeIva: z.number().min(0).max(100),
  totalRetenciones: z.number().min(0),
  otrosImpuestos: z.number().min(0),
  requiereFactura: z.boolean(),
  deducible: z.boolean(),
  idProveedor: z.number().optional().nullable(),
  idCuentaBancaria: z.number().optional().nullable(),
});

const ordenCompraSchema = z
  .object({
    idEmpresa: z.number().positive('Seleccione una empresa'),
    idSucursal: z.number().positive('Seleccione una sucursal'),
    idArea: z.number().positive('Seleccione un área'),
    idTipoGasto: z.number().optional().nullable(),
    fechaLimitePago: z.string().min(1, 'La fecha es requerida').refine(
      (val) => new Date(val) >= new Date(new Date().toISOString().split('T')[0]),
      { message: 'La fecha límite de pago no puede ser anterior a hoy' }
    ),
    idMoneda: z.number().optional().nullable(),
    tipoCambioAplicado: z.number().optional(),
    sinDatosFiscales: z.boolean(),
    idProveedor: z.number().optional().nullable(),
    razonSocialProveedor: z.string().optional(),
    idCuentaBancaria: z.number().optional().nullable(),
    idFormaPago: z.number().optional().nullable(),
    notaFormaPago: z.string().optional(),
    notasGenerales: z.string().optional(),
    agregarProveedorPorPartida: z.boolean(),
    partidas: z.array(partidaSchema).min(1, 'Debe incluir al menos una partida'),
  })
  .superRefine((data, ctx) => {
    // Validaciones de proveedor a nivel orden (cuando NO es por partida)
    if (!data.agregarProveedorPorPartida && !data.sinDatosFiscales) {
      if (!data.idProveedor || data.idProveedor === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Seleccione un proveedor para la orden',
          path: ['idProveedor'],
        });
      }
      // Si hay proveedor seleccionado, la cuenta bancaria es requerida
      if (data.idProveedor && data.idProveedor > 0) {
        if (!data.idCuentaBancaria || data.idCuentaBancaria === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Seleccione una cuenta bancaria del proveedor',
            path: ['idCuentaBancaria'],
          });
        }
      }
    }
    // Validaciones de proveedor por partida (cuando ES por partida)
    if (data.agregarProveedorPorPartida) {
      data.partidas.forEach((partida, idx) => {
        if (!partida.idProveedor || partida.idProveedor === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El proveedor por partida es requerido',
            path: ['partidas', idx, 'idProveedor'],
          });
        }
        // Cuando hay proveedor por partida, la cuenta bancaria es requerida
        if (partida.idProveedor && partida.idProveedor > 0) {
          if (!partida.idCuentaBancaria || partida.idCuentaBancaria === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Seleccione una cuenta bancaria para esta partida',
              path: ['partidas', idx, 'idCuentaBancaria'],
            });
          }
        }
      });
    }
  });

type FormValues = z.infer<typeof ordenCompraSchema>;
type PartidaFormValues = z.infer<typeof partidaSchema>;
interface RegimenFiscalItem {
  idRegimenFiscal: number;
  clave: string;
  descripcion: string;
  tipoPersona: string;
  activo: boolean;
}
const emptyPartida: PartidaFormValues = {
  descripcion: '',
  cantidad: 1,
  idUnidadMedida: 0,
  precioUnitario: 0,
  descuento: 0,
  idTipoImpuesto: 0,
  porcentajeIva: 16,
  totalRetenciones: 0,
  otrosImpuestos: 0,
  requiereFactura: true,
  deducible: false,
  idProveedor: undefined,
  idCuentaBancaria: undefined,
};
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const NUMERIC_INPUT_PATTERN = /^\d*\.?\d*$/;

function hasValidNumericFormat(value: string): boolean {
  if (!NUMERIC_INPUT_PATTERN.test(value)) return false;
  const decimalCount = (value.match(/\./g) || []).length;
  return decimalCount <= 1;
}

function NumericInput({
  value,
  onChange,
  placeholder = '0',
  className,
  id,
  suffix,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() => (value === 0 ? '0' : value.toString()));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(value === 0 ? '0' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!hasValidNumericFormat(raw)) return;

    setDisplayValue(raw);
    const num = parseFloat(raw);
    onChange(isNaN(num) ? 0 : num);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const num = parseFloat(displayValue);
    const validNum = isNaN(num) ? 0 : num;
    onChange(validNum);
    setDisplayValue(validNum === 0 ? '0' : validNum.toString());
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn('pr-12', className)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

// Componente para secciones con icono
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

function UnidadMedidaSelector({
  value,
  onChange,
  unidadesMedida,
  medidas,
}: {
  value: number;
  onChange: (val: number) => void;
  unidadesMedida: UnidadMedida[];
  medidas: Medida[];
}) {
  const [open, setOpen] = useState(false);
  const selectedUnidad = unidadesMedida.find((u) => u.idUnidadMedida === value);

  const unidadesPorMedida = useMemo(() => {
    const grupos: Record<number, { medida: Medida; unidades: UnidadMedida[] }> = {};
    unidadesMedida.forEach((unidad) => {
      const medidaId = unidad.idMedida || 0;
      const medida = medidas.find((m) => m.idMedida === medidaId);
      if (!grupos[medidaId]) {
        grupos[medidaId] = {
          medida: medida || {
            idMedida: medidaId,
            nombre: 'Sin categoría',
            activo: true,
            fechaCreacion: '',
          },
          unidades: [],
        };
      }
      grupos[medidaId].unidades.push(unidad);
    });
    return Object.values(grupos).sort((a, b) => a.medida.nombre.localeCompare(b.medida.nombre));
  }, [unidadesMedida, medidas]);

  return (
    <FormItem className="md:col-span-4">
      <FormLabel>Unidad de Medida *</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between border-input bg-transparent"
            >
              <span className="truncate">
                {selectedUnidad ? (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{selectedUnidad.abreviatura}</span>
                    <span className="text-sm text-muted-foreground">— {selectedUnidad.nombre}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Seleccionar unidad...</span>
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
          <Command className="rounded-lg border shadow-md bg-popover text-popover-foreground">
            <div className="flex items-center border-b bg-transparent px-3 py-2">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <CommandInput
                placeholder="Buscar unidad de medida..."
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No se encontró ninguna unidad.
            </CommandEmpty>
            <CommandList className="max-h-[300px] overflow-auto">
              {unidadesPorMedida.map((grupo) => (
                <CommandGroup
                  key={grupo.medida.idMedida}
                  heading={grupo.medida.nombre}
                  className="px-2 py-2"
                >
                  <div className="space-y-0.5">
                    {grupo.unidades.map((unidad) => (
                      <CommandItem
                        key={unidad.idUnidadMedida}
                        value={`${unidad.nombre} ${unidad.abreviatura}`}
                        onSelect={() => {
                          onChange(unidad.idUnidadMedida);
                          setOpen(false);
                        }}
                        className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                      >
                        <span className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
                            {unidad.abreviatura}
                          </span>
                          <span className="text-sm text-popover-foreground">{unidad.nombre}</span>
                        </span>
                        {value === unidad.idUnidadMedida && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </div>
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}

// @lat: [[lat.md\frontend#Frontend#Pages#Ordenes]]
export default function CrearOrdenCompra() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  usePageTitle(
    'Orden de compra',
    isEditing ? 'Edición de orden de compra' : 'Captura de orden de compra'
  );
  const {
    empresa: empresaSession,
    sucursal: sucursalSession,
    area: areaSession,
    user,
  } = useAuthStore();
  const userDomain = user?.dominio;
  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [regimenesFiscales, setRegimenesFiscales] = useState<RegimenFiscalItem[]>([]);
  const [tiposImpuesto, setTiposImpuesto] = useState<TipoImpuesto[]>([]);
  const [defaultTipoImpuestoId, setDefaultTipoImpuestoId] = useState<number>(0);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [buscandoProveedor, setBuscandoProveedor] = useState(false);
  const [proveedorNoExiste, setProveedorNoExiste] = useState(false);
  // [COMENTADO] Dialogo proveedor nuevo - ya no se usa en el flujo de ordenes
  // const [mostrarDialogoProveedor, setMostrarDialogoProveedor] = useState(false);
  // const [valuesPendientes, setValuesPendientes] = useState<FormValues | null>(null);
  const catalogFetched = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(ordenCompraSchema),
    defaultValues: {
      idEmpresa: empresaSession?.idEmpresa ? Number(empresaSession.idEmpresa) : 0,
      idSucursal: sucursalSession?.idSucursal ? Number(sucursalSession.idSucursal) : 0,
      idArea: areaSession?.idArea ? Number(areaSession.idArea) : 0,
      idTipoGasto: null,
      fechaLimitePago: '',
      idMoneda: null,
      tipoCambioAplicado: 1,
      sinDatosFiscales: false,
      idProveedor: 0,
      razonSocialProveedor: '',
      idCuentaBancaria: null,
      notaFormaPago: '',
      notasGenerales: '',
      agregarProveedorPorPartida: false,
      partidas: [emptyPartida],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'partidas',
  });

  const selectedEmpresaId = form.watch('idEmpresa');
  const selectedEmpresa = empresas.find((e) => e.idEmpresa === selectedEmpresaId);
  const empresaNombre = selectedEmpresa?.nombre?.toLowerCase() || '';
  const canChangeEmpresa =
    userDomain?.toLowerCase() === 'grupolefarma' && empresaNombre.startsWith('artricenteer');

  const filteredSucursales = useMemo(() => {
    if (!selectedEmpresaId) return sucursales;
    return sucursales.filter((s) => s.idEmpresa === selectedEmpresaId);
  }, [sucursales, selectedEmpresaId]);

  const filteredAreas = useMemo(() => {
    if (!selectedEmpresaId) return areas;
    return areas.filter((a) => a.idEmpresa === selectedEmpresaId);
  }, [areas, selectedEmpresaId]);

  const sinDatosFiscales = form.watch('sinDatosFiscales');
  const agregarProveedorPorPartida = form.watch('agregarProveedorPorPartida');
  useEffect(() => {
    if (sinDatosFiscales) {
      // Limpiar proveedor y cuentas cuando se activa sinDatosFiscales
      form.setValue('idProveedor', null);
      setSelectedProveedorId(0);
      setSelectedCuentaBancariaId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinDatosFiscales]);
  useEffect(() => {
    if (agregarProveedorPorPartida) {
      form.setValue('idProveedor', null);
      form.setValue('sinDatosFiscales', false);
      setSelectedProveedorId(0);
      setCuentasBancarias([]);
      setSelectedCuentaBancariaId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agregarProveedorPorPartida]);
  const watchedPartidas = useWatch({ control: form.control, name: 'partidas' });
  const totales = useMemo(() => {
    let subtotal = 0;
    let totalIva = 0;
    let totalRetenciones = 0;
    let totalOtrosImpuestos = 0;
    let totalDescuentos = 0;
    for (const p of watchedPartidas || []) {
      const base = (p.precioUnitario || 0) * (p.cantidad || 0) - (p.descuento || 0);
      subtotal += base;
      totalIva += base * ((p.porcentajeIva || 0) / 100);
      totalRetenciones += p.totalRetenciones || 0;
      const otrosImpuestosValor = p.otrosImpuestos || 0;
      totalOtrosImpuestos += otrosImpuestosValor;
      totalDescuentos += p.descuento || 0;
    }
    const total = subtotal + totalIva - totalRetenciones + totalOtrosImpuestos;
    return { subtotal, totalIva, totalRetenciones, totalOtrosImpuestos, total, totalDescuentos };
  }, [watchedPartidas]);
  const fetchCatalogs = () => {
    // Cargar todos los catálogos en paralelo sin bloquear la UI
    const errors: string[] = [];

    // Catálogos esenciales - Empresas, Sucursales, Áreas
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

    API.get<ApiResponse<Moneda[]>>('/catalogos/Monedas')
      .then((res) => {
        if (res.data.success) {
          const lista = res.data.data || [];
          setMonedas(lista);
          const def = lista.find((m) => m.esDefault);
          if (def) {
            form.setValue('idMoneda', def.idMoneda);
            form.setValue('tipoCambioAplicado', def.tipoCambio);
          }
        }
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar Monedas:', err);
      });

    API.get<ApiResponse<FormaPago[]>>('/catalogos/FormasPago')
      .then((res) => {
        if (res.data.success) setFormasPago(res.data.data || []);
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar FormasPago:', err);
        errors.push('Formas de Pago');
      });

    API.get<ApiResponse<UnidadMedida[]>>('/catalogos/UnidadesMedida')
      .then((res) => {
        if (res.data.success) setUnidadesMedida(res.data.data || []);
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar UnidadesMedida:', err);
        errors.push('Unidades de Medida');
      });

    API.get<ApiResponse<Medida[]>>('/catalogos/Medidas')
      .then((res) => {
        if (res.data.success) setMedidas(res.data.data || []);
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar Medidas:', err);
        errors.push('Medidas');
      });

    API.get<ApiResponse<RegimenFiscalItem[]>>('/catalogos/RegimenesFiscales')
      .then((res) => {
        if (res.data.success) setRegimenesFiscales(res.data.data || []);
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar RegimenesFiscales:', err);
        errors.push('Regímenes Fiscales');
      });

    API.get<ApiResponse<TipoImpuesto[]>>('/catalogos/TiposImpuesto')
      .then((res) => {
        if (res.data.success) {
          const tipos = res.data.data || [];
          setTiposImpuesto(tipos);
          const iva16 = tipos.find((t) => t.clave === 'T16');
          if (iva16) {
            setDefaultTipoImpuestoId(iva16.idTipoImpuesto);
            form.setValue('partidas', [
              {
                ...emptyPartida,
                idTipoImpuesto: iva16.idTipoImpuesto,
                porcentajeIva: Number((iva16.tasa * 100).toFixed(2)),
              },
            ]);
          }
        }
      })
      .catch((err) => {
        console.warn('[fetchCatalogs] Error al cargar TiposImpuesto:', err);
        errors.push('Tipos de Impuesto');
      });

    // Mostrar errores acumulados después de un tiempo
    setTimeout(() => {
      if (errors.length > 0) {
        toast.warning(`No tienes permisos para ver: ${errors.join(', ')}`);
      }
    }, 1000);
  };

  const [allProveedores, setAllProveedores] = useState<Proveedor[]>([]);

  const buscarProveedores = async (termino: string, tipo: 'razonSocial' | 'rfc') => {
    if (!termino || termino.length < 1) return;

    setBuscandoProveedor(true);
    try {
      const params = {
        estatus: 2,
        ...(tipo === 'razonSocial' ? { razonSocial: termino } : { rfc: termino }),
      };

      const response = await API.get<ApiResponse<Proveedor[]>>('/catalogos/Proveedores', {
        params,
      });
      if (response.data.success) {
        setProveedores(response.data.data || []);
      }
    } catch (err) {
      console.error('Error al buscar proveedores:', err);
    } finally {
      setBuscandoProveedor(false);
    }
  };

  const cargarTodosProveedores = async () => {
    setBuscandoProveedor(true);
    try {
      const response = await API.get<ApiResponse<Proveedor[]>>('/catalogos/Proveedores', {
        params: { estatus: 2 },
      });
      if (response.data.success) {
        const data = response.data.data || [];
        setAllProveedores(data);
        setProveedores(data);
      }
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setBuscandoProveedor(false);
    }
  };

  const [selectedProveedorId, setSelectedProveedorId] = useState(0);
  const [selectedCuentaBancariaId, setSelectedCuentaBancariaId] = useState<number | null>(null);
  const [cuentasBancarias, setCuentasBancarias] = useState<ProveedorCuentaBancaria[]>([]);
  const [selectedFormaPagoId, setSelectedFormaPagoId] = useState<number | null>(null);
  const [numeroMensualidades, setNumeroMensualidades] = useState<number>(1);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);

  const obtenerProveedorPorId = async (id: number): Promise<Proveedor | null> => {
    try {
      const response = await API.get<ApiResponse<Proveedor>>(`/catalogos/Proveedores/${id}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.warn(`Error al obtener proveedor ${id}:`, err);
      return null;
    }
  };

  const seleccionarProveedor = (
    proveedor: Proveedor & { cuentasFormaPago?: ProveedorCuentaBancaria[] }
  ) => {
    form.setValue('idProveedor', proveedor.idProveedor);
    form.setValue('razonSocialProveedor', proveedor.razonSocial);
    form.setValue('sinDatosFiscales', proveedor.sinDatosFiscales || false);
    setSelectedProveedorId(proveedor.idProveedor);
    setSelectedCuentaBancariaId(null);
    setProveedores([]);
    setProveedorNoExiste(false);

    if (proveedor.cuentasFormaPago && proveedor.cuentasFormaPago.length > 0) {
      setCuentasBancarias(proveedor.cuentasFormaPago.filter((c) => c.activo));
    } else {
      setCuentasBancarias([]);
    }
    setSelectedCuentaBancariaId(null);
    setSelectedFormaPagoId(null);
  };
  useEffect(() => {
    if (catalogFetched.current) return;
    catalogFetched.current = true;
    fetchCatalogs();
  }, []);

  // Cargar orden existente para edición
  useEffect(() => {
    if (!isEditing || !id) return;

    async function loadOrden() {
      try {
        const response = await API.get<ApiResponse<OrdenCompraResponse>>(`/ordenes/${id}`);
        if (response.data.success && response.data.data) {
          const orden = response.data.data;

          let razonSocialProveedor = '';
          let cuentasBancariasDelProveedor: ProveedorCuentaBancaria[] = [];
          const proveedoresCargados: Proveedor[] = [];

          if (orden.idProveedor && orden.idProveedor > 0) {
            const proveedor = await obtenerProveedorPorId(orden.idProveedor);
            if (proveedor) {
              razonSocialProveedor = proveedor.razonSocial;
              proveedoresCargados.push(proveedor);
              if (proveedor.cuentasFormaPago && proveedor.cuentasFormaPago.length > 0) {
                cuentasBancariasDelProveedor = proveedor.cuentasFormaPago.filter((c) => c.activo);
              }
            }
          }

          const idsProveedoresPartidas = orden.partidas
            .filter((p) => p.idProveedor && p.idProveedor > 0)
            .map((p) => p.idProveedor!);

          const idsUnicos = [...new Set(idsProveedoresPartidas)];

          for (const idProv of idsUnicos) {
            if (!proveedoresCargados.find((p) => p.idProveedor === idProv)) {
              const proveedorPartida = await obtenerProveedorPorId(idProv);
              if (proveedorPartida) {
                proveedoresCargados.push(proveedorPartida);
              }
            }
          }

          if (proveedoresCargados.length > 0) {
            setProveedores(proveedoresCargados);
            setAllProveedores(proveedoresCargados);
          }

          const mapped: FormValues = {
            idEmpresa: orden.idEmpresa,
            idSucursal: orden.idSucursal,
            idArea: orden.idArea,
            idTipoGasto: orden.idTipoGasto,
            fechaLimitePago: orden.fechaLimitePago.split('T')[0],
            idMoneda: orden.idMoneda ?? null,
            tipoCambioAplicado: orden.tipoCambioAplicado ?? 1,
            sinDatosFiscales: orden.sinDatosFiscales,
            idProveedor: orden.idProveedor || 0,
            razonSocialProveedor,
            idCuentaBancaria: orden.idsCuentasBancarias?.[0] || null,
            idFormaPago: orden.idsFormaPago?.[0] ?? null,
            notaFormaPago: orden.notaFormaPago || '',
            notasGenerales: orden.notasGenerales || '',
            agregarProveedorPorPartida:
              !orden.idProveedor && orden.partidas.some((p) => p.idProveedor && p.idProveedor > 0),
            partidas:
              orden.partidas.length > 0
                ? orden.partidas.map((p) => ({
                    descripcion: p.descripcion,
                    cantidad: Number(p.cantidad),
                    idUnidadMedida: p.idUnidadMedida,
                    precioUnitario: Number(p.precioUnitario),
                    descuento: Number(p.descuento),
                    idTipoImpuesto: 0,
                    porcentajeIva: Number(p.porcentajeIva),
                    totalRetenciones: Number(p.totalRetenciones),
                    otrosImpuestos: Number(p.otrosImpuestos),
                    requiereFactura: p.requiereFactura,
                    deducible: p.deducible ?? false,
                    idProveedor: p.idProveedor || undefined,
                    idCuentaBancaria: p.idCuentaBancaria || undefined,
                  }))
                : [emptyPartida],
          };
          setSelectedProveedorId(orden.idProveedor || 0);
          setSelectedCuentaBancariaId(orden.idsCuentasBancarias?.[0] || null);
          setSelectedFormaPagoId(orden.idsFormaPago?.[0] ?? null);
          setCuentasBancarias(cuentasBancariasDelProveedor);
          form.reset(mapped);
        }
      } catch (error) {
        toast.error('Error al cargar la orden');
        console.error('Error al cargar orden:', error); 
      }
    }

    if (!loadingCatalogs) {
      loadOrden();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id, loadingCatalogs]);

  const handleSave = async (values: FormValues) => {
    console.log('🔵 [handleSave] ===== INICIO handleSave =====');
    console.log('🔵 [handleSave] Values recibidos del form:', JSON.stringify(values, null, 2));
    console.log('🔵 [handleSave] selectedProveedorId:', selectedProveedorId);
    console.log('🔵 [handleSave] isEditing:', isEditing);
    console.log('🔵 [handleSave] id (URL):', id);

    setIsSaving(true);
    try {
      console.log('🔵 [handleSave] Validando fecha límite...');
      const fechaLimite = new Date(values.fechaLimitePago);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (fechaLimite <= today) {
        toast.error('La fecha límite de pago debe ser futura.');
        setIsSaving(false);
        return;
      }

      // Si agregarProveedorPorPartida está activo, no necesita proveedor a nivel orden
      if (values.agregarProveedorPorPartida) {
        console.log('🔵 [handleSave] agregarProveedorPorPartida=true → guardarOrden');
        await guardarOrden(values);
        return;
      }

      // Si ya tenemos el ID del proveedor (seleccionado del catálogo), proceder directamente
      if (selectedProveedorId > 0) {
        console.log(
          '🔵 [handleSave] selectedProveedorId > 0 → guardarOrden con idProveedor:',
          selectedProveedorId
        );
        // Actualizar el values con el selectedProveedorId antes de guardar
        values.idProveedor = selectedProveedorId;
        await guardarOrden(values);
        return;
      }

      // Si el form ya tiene un idProveedor (cargado desde BD o establecido de otra forma)
      if (values.idProveedor && values.idProveedor > 0) {
        console.log(
          '🔵 [handleSave] values.idProveedor > 0 → guardarOrden con:',
          values.idProveedor
        );
        await guardarOrden(values);
        return;
      }

      // Sin proveedor seleccionado y no es sinDatosFiscales
      if (!values.sinDatosFiscales) {
        toast.error('Seleccione un proveedor o marque "Sin Datos Fiscales"');
        setIsSaving(false);
        return;
      }

      // Sin datos fiscales - guardar sin proveedor
      await guardarOrden(values);
    } catch (error) {
      console.error('🔴 [handleSave] ERROR:', error);
      const apiError = error as { errors?: Array<{ description: string }>; message?: string };
      const errs = apiError.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) =>
          toast.error(apiError.message ?? 'Error', { description: e.description })
        );
      } else {
        toast.error(apiError.message ?? 'Error al crear la orden de compra');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const guardarOrden = async (values: FormValues) => {
    console.log('🟢 [guardarOrden] ===== INICIO guardarOrden =====');
    console.log('🟢 [guardarOrden] isEditing:', isEditing);
    console.log('🟢 [guardarOrden] selectedCuentaBancariaId:', selectedCuentaBancariaId);

    setIsSaving(true);
    try {
      console.log('🟢 [guardarOrden] Construyendo payload...');
      const payload: CreateOrdenCompraRequest = {
        idEmpresa: values.idEmpresa,
        idSucursal: values.idSucursal,
        idArea: values.idArea,
        idTipoGasto: null,
        fechaLimitePago: values.fechaLimitePago,
        idMoneda: values.idMoneda ?? null,
        tipoCambioAplicado: values.tipoCambioAplicado ?? 1,
        idProveedor: values.idProveedor && values.idProveedor > 0 ? values.idProveedor : null,
        sinDatosFiscales: values.sinDatosFiscales,
        notaFormaPago: values.notaFormaPago || null,
        notasGenerales: values.notasGenerales || null,
        idsCuentasBancarias: selectedCuentaBancariaId ? [selectedCuentaBancariaId] : null,
        idsFormaPago: selectedFormaPagoId ? [selectedFormaPagoId] : null,
        numeroMensualidades: selectedFormaPagoId ? numeroMensualidades : null,
        partidas: values.partidas.map((p) => ({
          descripcion: p.descripcion,
          cantidad: p.cantidad,
          idUnidadMedida: p.idUnidadMedida,
          precioUnitario: p.precioUnitario,
          descuento: p.descuento,
          porcentajeIva: p.porcentajeIva,
          totalRetenciones: p.totalRetenciones,
          otrosImpuestos: p.otrosImpuestos,
          requiereFactura: p.requiereFactura,
          deducible: p.deducible ?? false,
          idProveedor: p.idProveedor || null,
          idCuentaBancaria:
            p.idCuentaBancaria && p.idCuentaBancaria > 0 ? p.idCuentaBancaria : null,
        })),
      };

      console.log('🟢 [guardarOrden] Payload construido:', JSON.stringify(payload, null, 2));
      console.log(
        '🟢 [guardarOrden] Haciendo request API:',
        isEditing ? `PUT /ordenes/${id}` : 'POST /ordenes'
      );

      const response = isEditing
        ? await API.put<ApiResponse<void>>(`/ordenes/${id}`, payload)
        : await API.post<ApiResponse<void>>('/ordenes', payload);

      console.log('🟢 [guardarOrden] Response recibido:', JSON.stringify(response.data, null, 2));

      if (response.data.success) {
        console.log('🟢 [guardarOrden] ✅ Éxito - navigate a /ordenes/autorizaciones');
        toast.success(
          isEditing
            ? 'Orden de compra actualizada correctamente.'
            : 'Orden de compra creada correctamente.'
        );
        navigate('/ordenes/autorizaciones');
      } else {
        console.warn('🟡 [guardarOrden] ⚠️ Response success=false:', response.data.message);
        toast.error(response.data.message ?? 'Error al crear la orden de compra');
      }
    } catch (error) {
      console.error('🔴 [guardarOrden] ERROR en API:', error);
      const apiError = error as { errors?: Array<{ description: string }>; message?: string };
      const errs = apiError.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) =>
          toast.error(apiError.message ?? 'Error', { description: e.description })
        );
      } else {
        toast.error(apiError.message ?? 'Error al crear la orden de compra');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // [COMENTADO] Ya no se usa - El diálogo de crear proveedor inline se eliminó del flujo
  // Se mantiene por si se necesita en el futuro
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const confirmarGuardarProveedorNuevo = async () => {
    // setMostrarDialogoProveedor(false);
    // if (!valuesPendientes) return;
    // setIsSaving(true);
    // try {
    //   const createProveedorPayload = {
    //     razonSocial: valuesPendientes.razonSocialProveedor,
    //     rfc: valuesPendientes.rfcProveedor || null,
    //     codigoPostal: valuesPendientes.codigoPostalProveedor || null,
    //     regimenFiscalId: valuesPendientes.idRegimenFiscal || null,
    //     usoCfdi: valuesPendientes.usoCFDI || null,
    //     sinDatosFiscales: valuesPendientes.sinDatosFiscales,
    //   };
    //   const provResponse = await API.post<ApiResponse<Proveedor>>('/catalogos/Proveedores', createProveedorPayload);
    //   if (!provResponse.data.success || !provResponse.data.data) {
    //     toast.error(provResponse.data.message ?? 'Error al registrar el proveedor');
    //     setIsSaving(false);
    //     return;
    //   }
    //   const newProveedorId = provResponse.data.data.idProveedor;
    //   setSelectedProveedorId(newProveedorId);
    //   valuesPendientes.idProveedor = newProveedorId;
    //   await guardarOrden(valuesPendientes);
    // } catch (error) {
    //   const apiError = error as { errors?: Array<{ description: string }>; message?: string };
    //   toast.error(apiError.message ?? 'Error al registrar el proveedor');
    //   setIsSaving(false);
    // }
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
                  {/* Sección: Ubicación */}
                  <FormSection icon={Building2} title="Ubicación">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="idEmpresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa *</FormLabel>
                            <Select
                              disabled={!canChangeEmpresa}
                              onValueChange={(val) => {
                                field.onChange(Number(val));
                              }}
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
                            {!canChangeEmpresa && (
                              <FormDescription className="text-xs text-muted-foreground">
                                La empresa no se puede cambiar
                              </FormDescription>
                            )}
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
                              onValueChange={(val) => {
                                field.onChange(Number(val));
                              }}
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
                              onValueChange={(val) => {
                                field.onChange(Number(val));
                              }}
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
          {/* Card: Datos del Proveedor */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5" />
                Datos del Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!agregarProveedorPorPartida && (
                <FormField
                  control={form.control}
                  name="sinDatosFiscales"
                  render={({ field }) => (
                    <FormItem className="bg-muted/30 flex hidden flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="!mt-0 font-medium">Sin Datos Fiscales</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Marcar si el proveedor no cuenta con RFC ni información fiscal completa
                          (ej. persona física sin actividad empresarial)
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="agregarProveedorPorPartida"
                render={({ field }) => (
                  <FormItem className="bg-muted/30 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="!mt-0 font-medium">
                        Agregar proveedor por partida
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Permite especificar un proveedor diferente para cada partida de la orden
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {!agregarProveedorPorPartida && (
                <FormSection icon={Building2} title="Información General">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="razonSocialProveedor"
                      render={({ field }) => {
                        const [open, setOpen] = useState(false);
                        const [busqueda, setBusqueda] = useState('');
                        const [buscado, setBuscado] = useState(false);
                        const [selectedIndex, setSelectedIndex] = useState(0);

                        const handleBuscar = (valor: string) => {
                          setBusqueda(valor);
                          setBuscado(true);
                          setSelectedIndex(0);
                          // Filtrar client-side de los proveedores ya cargados
                          if (!valor || valor.length < 1) {
                            setProveedores(allProveedores);
                          } else {
                            const filtrados = allProveedores.filter(
                              (prov) =>
                                prov.razonSocial.toLowerCase().includes(valor.toLowerCase()) ||
                                (prov.rfc && prov.rfc.toLowerCase().includes(valor.toLowerCase()))
                            );
                            setProveedores(filtrados);
                          }
                        };

                        const handleKeyDown = (e: React.KeyboardEvent) => {
                          if (proveedores.length === 0) return;

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedIndex((prev) => (prev + 1) % proveedores.length);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedIndex(
                              (prev) => (prev - 1 + proveedores.length) % proveedores.length
                            );
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (selectedIndex < proveedores.length) {
                              const proveedor = proveedores[selectedIndex];
                              if (proveedor) {
                                seleccionarProveedor(proveedor);
                                setOpen(false);
                                setBusqueda('');
                                setBuscado(false);
                                setSelectedIndex(0);
                              }
                            }
                          }
                        };

                        return (
                          <FormItem className="flex flex-col sm:col-span-2 lg:col-span-4">
                            <FormLabel>Buscar por Razón Social *</FormLabel>
                            <Popover
                              open={open}
                              onOpenChange={(isOpen) => {
                                setOpen(isOpen);
                                if (isOpen) {
                                  setBusqueda('');
                                  setBuscado(false);
                                  setSelectedIndex(0);
                                  // Cargar todos los proveedores autorizados al abrir
                                  cargarTodosProveedores();
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between border-input bg-transparent"
                                  >
                                    <span
                                      className={cn(
                                        'truncate',
                                        !field.value && 'text-muted-foreground'
                                      )}
                                    >
                                      {field.value || 'Escribe para buscar...'}
                                    </span>
                                    <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <Command
                                  shouldFilter={false}
                                  className="rounded-lg border shadow-md bg-popover text-popover-foreground"
                                >
                                  <div className="flex items-center border-b bg-transparent px-3 py-2">
                                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <CommandInput
                                      placeholder="Escribe para buscar..."
                                      value={busqueda}
                                      onValueChange={handleBuscar}
                                      onKeyDown={handleKeyDown}
                                      className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                                    />
                                  </div>
                                  <CommandList className="max-h-[300px] overflow-auto">
                                    {buscandoProveedor ? (
                                      <div className="py-4 text-center text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                        Cargando proveedores...
                                      </div>
                                    ) : proveedores.length > 0 ? (
                                      <>
                                        <CommandGroup
                                          heading={`${proveedores.length} proveedor${proveedores.length !== 1 ? 'es' : ''} disponible${proveedores.length !== 1 ? 's' : ''}`}
                                        >
                                          {proveedores.map((proveedor, index) => (
                                            <CommandItem
                                              key={proveedor.idProveedor}
                                              value={String(proveedor.idProveedor)}
                                              onSelect={() => {
                                                seleccionarProveedor(proveedor);
                                                setOpen(false);
                                                setBusqueda('');
                                                setBuscado(false);
                                                setSelectedIndex(0);
                                              }}
                                              className={cn(
                                                'flex cursor-pointer flex-col items-start rounded-md px-2 py-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground',
                                                index === selectedIndex && 'bg-accent'
                                              )}
                                            >
                                              <span className="font-medium text-popover-foreground">
                                                {proveedor.razonSocial}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                RFC: {proveedor.rfc || 'N/A'}
                                              </span>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </>
                                    ) : (
                                      <div className="py-4 text-center text-sm text-muted-foreground">
                                        No se encontraron proveedores autorizados
                                      </div>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormDescription className="text-xs">
                              Busca y selecciona un proveedor existente
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  {selectedProveedorId > 0 && (
                    <>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="idCuentaBancaria"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cuenta Bancaria</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  value={field.value ? String(field.value) : ''}
                                  onValueChange={(val) => {
                                    const id = Number(val);
                                    setSelectedCuentaBancariaId(id);
                                    field.onChange(id);
                                  }}
                                >
                                  <div className="flex flex-col gap-2 mt-2">
                                    {cuentasBancarias.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        {selectedProveedorId > 0
                                          ? 'Este proveedor no tiene cuentas activas'
                                          : 'Seleccione primero un proveedor'}
                                      </p>
                                    ) : (
                                      cuentasBancarias.map((cuenta) => (
                                        <label
                                          key={cuenta.idCuen}
                                          className="flex items-center gap-3 cursor-pointer text-sm border border-slate-200 dark:border-slate-700 rounded-md p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                          <RadioGroupItem value={String(cuenta.idCuen)} />
                                          <div className="flex flex-col">
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                              {cuenta.bancoNombre || 'Banco'} - {cuenta.numeroCuenta || 'Sin número'}
                                            </span>
                                            {cuenta.formaPagoNombre && (
                                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {cuenta.formaPagoNombre}
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Seleccione la cuenta bancaria del proveedor para realizar el pago
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="idFormaPago"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Forma de Pago</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  value={field.value !== undefined ? String(field.value) : ''}
                                  onValueChange={(val) => {
                                    const id = val === '' ? null : Number(val);
                                    field.onChange(id);
                                    setSelectedFormaPagoId(id);
                                  }}
                                >
                                  <div className="flex flex-wrap gap-3 mt-2">
                                    {formasPago.filter(f => f.activo).map((forma) => (
                                      <label
                                        key={forma.idFormaPago}
                                        className="flex items-center gap-2 cursor-pointer text-sm"
                                      >
                                        <RadioGroupItem value={String(forma.idFormaPago)} />
                                        {forma.nombre}
                                      </label>
                                    ))}
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Seleccione la forma de pago
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {selectedFormaPagoId && (
                          <div className="grid grid-cols-1 gap-4 mt-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium" htmlFor="numero-mensualidades">
                                Número de pagos mensuales
                              </label>
                              <Input
                                id="numero-mensualidades"
                                type="number"
                                min={1}
                                max={48}
                                value={numeroMensualidades}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setNumeroMensualidades(Math.max(1, Math.min(48, val)));
                                }}
                                className="w-32"
                              />
                              <p className="text-xs text-muted-foreground">
                                ¿En cuántos meses se realizará el pago? (1-48 meses)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </FormSection>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Tag className="h-5 w-5" />
                Detalles de la Orden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="idMoneda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          const id = Number(val);
                          field.onChange(id || null);
                          const m = monedas.find((x) => x.idMoneda === id);
                          if (m) form.setValue('tipoCambioAplicado', m.tipoCambio);
                        }}
                        value={field.value ? String(field.value) : ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona moneda..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {monedas.map((m) => (
                            <SelectItem key={m.idMoneda} value={String(m.idMoneda)}>
                              {m.codigo} – {m.nombre} ({m.simbolo})
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
                  name="fechaLimitePago"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 lg:col-span-2">
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Fecha Límite de Pago *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Fecha máxima para realizar el pago al proveedor
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="notaFormaPago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5" />
                        Comentarios sobre el pago
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Instrucciones especiales de pago" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Instrucciones específicas sobre cómo realizar el pago al proveedor
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                  {/* <FormField
                  control={form.control}
                  name="notasGenerales"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Generales</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Información adicional relevante para esta orden de compra..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Cualquier información adicional sobre la orden que deba ser considerada
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                /> */}
              </div>
            </CardContent>
          </Card>

          {/* Card: Partidas */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Partidas</CardTitle>
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    onClick={() => append({ ...emptyPartida, idTipoImpuesto: defaultTipoImpuestoId })}
                    className="text-base font-semibold shadow-sm"
                  >
                    <Plus className="mr-2 h-5 w-5" /> Agregar Partida
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((item, index) => {
                const p = watchedPartidas?.[index];
                const agregarProveedor = form.watch('agregarProveedorPorPartida');
                const lineBase =
                  (p?.precioUnitario || 0) * (p?.cantidad || 0) - (p?.descuento || 0);
                const lineIva = lineBase * ((p?.porcentajeIva || 0) / 100);
                const otrosImpuestosValor = p?.otrosImpuestos || 0;
                const lineTotal =
                  lineBase + lineIva - (p?.totalRetenciones || 0) + otrosImpuestosValor;
                return (
                  <div key={item.id} className="space-y-4">
                    {index > 0 && (
                      <div className="my-8 flex items-center justify-center">
                        <div className="bg-primary/40 h-0.5 w-24 rounded-full" />
                      </div>
                    )}
                    <div className="space-y-4 rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-sm font-bold text-transparent">
                            Partida
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            Subtotal{' '}
                            <span className="ml-1 font-semibold tabular-nums">{fmt(lineBase)}</span>
                          </span>
                          {(p?.descuento || 0) > 0 && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
                              Desc{' '}
                              <span className="ml-1 font-semibold tabular-nums">
                                −{fmt(p.descuento)}
                              </span>
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                            IVA{' '}
                            <span className="ml-1 font-semibold tabular-nums">{fmt(lineIva)}</span>
                          </span>
                          {(p?.totalRetenciones || 0) > 0 && (
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                              Retenc{' '}
                              <span className="ml-1 font-semibold tabular-nums">
                                −{fmt(p.totalRetenciones)}
                              </span>
                            </span>
                          )}
                          {(p?.otrosImpuestos || 0) > 0 && (
                            <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                              Otros{' '}
                              <span className="ml-1 font-semibold tabular-nums">
                                {fmt(otrosImpuestosValor)}
                              </span>
                            </span>
                          )}
                          <span className="bg-primary/10 ring-primary/20 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold text-primary ring-1">
                            Total {fmt(lineTotal)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="hover:bg-destructive/10 h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.descripcion`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-6">
                              <FormLabel>Descripción *</FormLabel>
                              <FormControl>
                                <Input placeholder="Descripción del bien o servicio" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.cantidad`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Cantidad *</FormLabel>
                              <FormControl>
                                <NumericInput
                                  id={`cantidad-${index}`}
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.idUnidadMedida`}
                          render={({ field }) => (
                            <UnidadMedidaSelector
                              value={field.value}
                              onChange={field.onChange}
                              unidadesMedida={unidadesMedida}
                              medidas={medidas}
                            />
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-12">
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.precioUnitario`}
                          render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-3">
                              <FormLabel>Precio Unitario *</FormLabel>
                              <FormControl>
                                <NumericInput
                                  id={`precio-${index}`}
                                  value={field.value}
                                  onChange={field.onChange}
                                  suffix="MXN"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.descuento`}
                          render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                              <FormLabel>Descuento</FormLabel>
                              <FormControl>
                                <NumericInput
                                  id={`descuento-${index}`}
                                  value={field.value}
                                  onChange={field.onChange}
                                  suffix="MXN"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.idTipoImpuesto`}
                          render={({ field }) => {
                            const selectedTipo = tiposImpuesto.find(
                              (t) => t.idTipoImpuesto === field.value
                            );
                            return (
                              <FormItem className="col-span-1 md:col-span-2">
                                <FormLabel>Impuesto</FormLabel>
                                <Select
                                  onValueChange={(val) => {
                                    const id = Number(val);
                                    field.onChange(id);
                                    const tipo = tiposImpuesto.find((t) => t.idTipoImpuesto === id);
                                    if (tipo) {
                                      const pct = Number((tipo.tasa * 100).toFixed(2));
                                      form.setValue(`partidas.${index}.porcentajeIva`, pct);
                                    }
                                  }}
                                  value={field.value ? String(field.value) : ''}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona impuesto..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {tiposImpuesto.map((ti) => (
                                      <SelectItem
                                        key={ti.idTipoImpuesto}
                                        value={String(ti.idTipoImpuesto)}
                                      >
                                        {ti.nombre} ({(ti.tasa * 100).toFixed(0)}%)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.totalRetenciones`}
                          render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                              <FormLabel>Retenciones</FormLabel>
                              <FormControl>
                                <NumericInput
                                  id={`retenciones-${index}`}
                                  value={field.value}
                                  onChange={field.onChange}
                                  suffix="MXN"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.otrosImpuestos`}
                          render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-4">
                              <FormLabel>Otros Impuestos</FormLabel>
                              <FormControl>
                                <NumericInput
                                  id={`otros-impuestos-${index}`}
                                  value={field.value}
                                  onChange={field.onChange}
                                  suffix="MXN"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partidas.${index}.requiereFactura`}
                          render={({ field }) => (
                            <FormItem className="col-span-2 flex h-full items-center justify-end gap-2 pb-2 md:col-span-1 md:flex-col md:items-start md:justify-start md:pb-0">
                              <FormLabel className="!mt-0 md:mt-2">Req. Factura</FormLabel>
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      {agregarProveedor && (
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              Proveedor específico para esta partida
                            </span>
                          </div>
                          <FormField
                            control={form.control}
                            name={`partidas.${index}.idProveedor`}
                            render={({ field }) => {
                              const [open, setOpen] = useState(false);
                              const [busqueda, setBusqueda] = useState('');
                              const [buscado, setBuscado] = useState(false);
                              const [selectedIndex, setSelectedIndex] = useState(0);
                              // Filtrar de allProveedores (independiente del selector de arriba)
                              const partidaProveedores = useMemo(() => {
                                if (!busqueda || busqueda.length < 1) return allProveedores;
                                return allProveedores.filter(
                                  (prov) =>
                                    prov.razonSocial
                                      .toLowerCase()
                                      .includes(busqueda.toLowerCase()) ||
                                    (prov.rfc &&
                                      prov.rfc.toLowerCase().includes(busqueda.toLowerCase()))
                                );
                              }, [busqueda, allProveedores]);

                              const handleKeyDown = (e: React.KeyboardEvent) => {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const total = partidaProveedores.length;
                                  if (total > 0) {
                                    setSelectedIndex((prev) => (prev + 1) % total);
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const total = partidaProveedores.length;
                                  if (total > 0) {
                                    setSelectedIndex((prev) => (prev - 1 + total) % total);
                                  }
                                } else if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (
                                    selectedIndex < partidaProveedores.length &&
                                    partidaProveedores.length > 0
                                  ) {
                                    const prov = partidaProveedores[selectedIndex];
                                    field.onChange(prov.idProveedor);
                                    form.setValue(`partidas.${index}.idCuentaBancaria`, undefined);
                                    setOpen(false);
                                    setBusqueda('');
                                    setBuscado(false);
                                  }
                                }
                              };

                              const selectedProveedorPartidaId = field.value;
                              const selectedProv = allProveedores.find(
                                (pr) => pr.idProveedor === selectedProveedorPartidaId
                              );

                              return (
                                <FormItem className="flex flex-col">
                                  <Popover
                                    open={open}
                                    onOpenChange={(isOpen) => {
                                      setOpen(isOpen);
                                      if (isOpen) {
                                        setBusqueda('');
                                        setBuscado(false);
                                        setSelectedIndex(0);
                                        // Siempre cargar/recargar proveedores al abrir
                                        cargarTodosProveedores();
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={open}
                                          className="w-full justify-between border-slate-200 bg-white hover:bg-slate-50"
                                        >
                                          <span
                                            className={cn(
                                              'truncate',
                                              !field.value && 'text-muted-foreground'
                                            )}
                                          >
                                            {selectedProv
                                              ? selectedProv.razonSocial
                                              : 'Seleccionar o buscar proveedor...'}
                                          </span>
                                          <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                      <Command shouldFilter={false}>
                                        <div className="flex items-center border-b bg-slate-50 px-3 py-2">
                                          <Search className="mr-2 h-4 w-4 text-slate-400" />
                                          <CommandInput
                                            placeholder="Buscar proveedor..."
                                            value={busqueda}
                                            onValueChange={(val) => {
                                              setBusqueda(val);
                                              setBuscado(true);
                                              setSelectedIndex(0);
                                              // La búsqueda se filtra client-side via partidaProveedores
                                            }}
                                            onKeyDown={handleKeyDown}
                                            className="flex-1 bg-transparent outline-none placeholder:text-slate-400"
                                          />
                                        </div>
                                        <CommandList className="max-h-[200px] overflow-auto">
                                          {partidaProveedores.length > 0 ? (
                                            <CommandGroup
                                              heading={`${partidaProveedores.length} proveedor${partidaProveedores.length !== 1 ? 'es' : ''} disponible${partidaProveedores.length !== 1 ? 's' : ''}`}
                                            >
                                              {partidaProveedores.map((prov, idx) => (
                                                <CommandItem
                                                  key={prov.idProveedor}
                                                  value={String(prov.idProveedor)}
                                                  onSelect={() => {
                                                    field.onChange(prov.idProveedor);
                                                    form.setValue(
                                                      `partidas.${index}.idCuentaBancaria`,
                                                      undefined
                                                    );
                                                    setOpen(false);
                                                    setBusqueda('');
                                                    setBuscado(false);
                                                  }}
                                                  className={cn(
                                                    'flex cursor-pointer flex-col items-start rounded-md px-2 py-2 hover:bg-slate-100',
                                                    idx === selectedIndex && 'bg-slate-100'
                                                  )}
                                                >
                                                  <span className="font-medium">
                                                    {prov.razonSocial}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground">
                                                    RFC: {prov.rfc || 'N/A'}
                                                  </span>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          ) : (
                                            <div className="py-4 text-center text-sm text-muted-foreground">
                                              No se encontraron proveedores autorizados
                                            </div>
                                          )}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                          <FormField
                            control={form.control}
                            name={`partidas.${index}.idCuentaBancaria`}
                            render={({ field }) => {
                              const selectedProveedorPartidaId = useWatch({
                                control: form.control,
                                name: `partidas.${index}.idProveedor`,
                              });
                              const partidaCuentasBancarias = useMemo(() => {
                                if (!selectedProveedorPartidaId) return [];
                                const prov = proveedores.find(
                                  (p) => p.idProveedor === selectedProveedorPartidaId
                                );
                                if (!prov?.cuentasFormaPago) return [];
                                return prov.cuentasFormaPago.filter(
                                  (c: ProveedorCuentaBancaria) => c.activo
                                );
                              }, [selectedProveedorPartidaId, proveedores]);

                              return (
                                <FormItem>
                                  <FormLabel>Cuenta Bancaria</FormLabel>
                                  <Select
                                    onValueChange={(val) => field.onChange(Number(val))}
                                    value={field.value ? String(field.value) : ''}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una cuenta bancaria..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {partidaCuentasBancarias.length === 0 ? (
                                        <SelectItem value="__none__" disabled>
                                          {!selectedProveedorPartidaId
                                            ? 'Seleccione primero un proveedor'
                                            : 'Este proveedor no tiene cuentas activas'}
                                        </SelectItem>
                                      ) : (
                                        partidaCuentasBancarias.map((cuenta) => (
                                          <SelectItem
                                            key={cuenta.idCuen}
                                            value={String(cuenta.idCuen)}
                                          >
                                            {cuenta.bancoNombre || 'Banco'} - {cuenta.numeroCuenta || 'Sin número'}
                                            {cuenta.formaPagoNombre ? ` · ${cuenta.formaPagoNombre}` : ''}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Card: Resumen */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {watchedPartidas?.map((p, idx) => {
                  const base = (p?.precioUnitario || 0) * (p?.cantidad || 0) - (p?.descuento || 0);
                  const iva = base * ((p?.porcentajeIva || 0) / 100);
                  const otrosImpuestosValor = p?.otrosImpuestos || 0;
                  const partTotal = base + iva - (p?.totalRetenciones || 0) + otrosImpuestosValor;
                  const pDesc = p?.descripcion?.slice(0, 25) || `Partida ${idx + 1}`;
                  return (
                    <div key={idx} className="rounded-md border bg-card p-2 shadow-sm">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-primary/10 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <span className="max-w-[100px] truncate text-xs font-medium">
                            {pDesc}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">{fmt(partTotal)}</span>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{fmt(base)}</span>
                        </div>
                        {(p?.descuento || 0) > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Desc</span>
                            <span className="tabular-nums">−{fmt(p.descuento)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>IVA ({p?.porcentajeIva || 0}%)</span>
                          <span className="tabular-nums">{fmt(iva)}</span>
                        </div>
                        {(p?.totalRetenciones || 0) > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Retenc</span>
                            <span className="tabular-nums">−{fmt(p.totalRetenciones)}</span>
                          </div>
                        )}
                        {(p?.otrosImpuestos || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Otros</span>
                            <span className="tabular-nums">{fmt(otrosImpuestosValor)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-primary/30 bg-primary/10 rounded-lg border-2 p-3 shadow-md">
                <div className="border-primary/20 mb-2 flex items-center justify-between border-b pb-2">
                  <span className="text-base font-bold">Total de la Orden</span>
                  <span className="rounded-lg bg-primary px-4 py-1 text-xl font-bold text-primary-foreground shadow-sm">
                    {fmt(totales.total)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{fmt(totales.subtotal)}</span>
                  </div>
                  {totales.totalDescuentos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descuentos</span>
                      <span className="font-medium tabular-nums text-destructive">
                        −{fmt(totales.totalDescuentos)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="font-medium tabular-nums">{fmt(totales.totalIva)}</span>
                  </div>
                  {totales.totalRetenciones > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retenciones</span>
                      <span className="font-medium tabular-nums text-destructive">
                        −{fmt(totales.totalRetenciones)}
                      </span>
                    </div>
                  )}
                  {totales.totalOtrosImpuestos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Otros</span>
                      <span className="font-medium tabular-nums">
                        {fmt(totales.totalOtrosImpuestos)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FormField
                control={form.control}
                name="notasGenerales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Información adicional relevante para esta orden de compra..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Cualquier información adicional sobre la orden que deba ser considerada
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/ordenes/autorizaciones')}
            >
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => {
                console.log('🔵 [BOTON GUARDAR] ===== CLICK EN BOTON GUARDAR ORDEN =====');
                console.log('🔵 [BOTON GUARDAR] isSaving:', isSaving);
                form.handleSubmit(
                  (values) => {
                    console.log('🔵 [BOTON GUARDAR] ✅ Validación PASÓ, llamando handleSave...');
                    handleSave(values);
                  },
                  (errors) => {
                    console.log(
                      '🔴 [BOTON GUARDAR] ❌ Validación FALLÓ:',
                      JSON.stringify(errors, null, 2)
                    );
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
              Guardar Orden
            </Button>
          </div>
        </form>
      </Form>

      {/*
      [COMENTADO] Dialogo crear proveedor inline - ya no se usa
      <Dialog open={mostrarDialogoProveedor} onOpenChange={setMostrarDialogoProveedor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proveedor no registrado</DialogTitle>
            <DialogDescription>
              El proveedor con RFC <strong>{form.getValues('rfcProveedor')}</strong> no existe en el
              catálogo.
              <br />
              <br />
              Será enviado primero para su autorización antes de procesar la orden de compra.
              <br />
              <br />
              ¿Desea continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMostrarDialogoProveedor(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarGuardarProveedorNuevo}>Sí, continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}
    </div>
  );
}
