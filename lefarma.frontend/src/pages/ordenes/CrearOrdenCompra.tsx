import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, Save, X, Building2, MapPin, Tag, CreditCard, Calendar, User, FileText } from 'lucide-react';
import type { CreateOrdenCompraRequest } from '@/types/ordenCompra.types';
import type { Empresa, Sucursal, Area, FormaPago, UnidadMedida, Gasto } from '@/types/catalogo.types';

// @lat: [[frontend#Pages]]

const partidaSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida').max(500),
  cantidad: z.number().positive('Debe ser mayor a 0'),
  idUnidadMedida: z.number().positive('Seleccione una unidad'),
  precioUnitario: z.number().positive('Debe ser mayor a 0'),
  descuento: z.number().min(0),
  porcentajeIva: z.number().min(0).max(100),
  totalRetenciones: z.number().min(0),
  otrosImpuestos: z.number().min(0),
  deducible: z.boolean(),
});

const ordenCompraSchema = z.object({
  idEmpresa: z.number().positive('Seleccione una empresa'),
  idSucursal: z.number().positive('Seleccione una sucursal'),
  idArea: z.number().positive('Seleccione un área'),
  idTipoGasto: z.number().positive('Seleccione un tipo de gasto'),
  idFormaPago: z.number().positive('Seleccione una forma de pago'),
  fechaLimitePago: z.string().min(1, 'La fecha es requerida'),
  sinDatosFiscales: z.boolean(),
  razonSocialProveedor: z.string().min(1, 'La razón social es requerida').max(255),
  rfcProveedor: z.string(),
  codigoPostalProveedor: z.string(),
  idRegimenFiscal: z.number(),
  personaContacto: z.string(),
  notaFormaPago: z.string(),
  notasGenerales: z.string(),
  partidas: z.array(partidaSchema).min(1, 'Debe incluir al menos una partida'),
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
  porcentajeIva: 16,
  totalRetenciones: 0,
  otrosImpuestos: 0,
  deducible: true,
};
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// Componente para secciones con icono
function FormSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function CrearOrdenCompra() {
  usePageTitle('Orden de compra', 'Captura de orden de compra');
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiposGasto, setTiposGasto] = useState<Gasto[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);
  const [regimenesFiscales, setRegimenesFiscales] = useState<RegimenFiscalItem[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const form = useForm<FormValues>({
    resolver: zodResolver(ordenCompraSchema),
    defaultValues: {
      idEmpresa: 0,
      idSucursal: 0,
      idArea: 0,
      idTipoGasto: 0,
      idFormaPago: 0,
      fechaLimitePago: '',
      sinDatosFiscales: false,
      razonSocialProveedor: '',
      rfcProveedor: '',
      codigoPostalProveedor: '',
      idRegimenFiscal: 0,
      personaContacto: '',
      notaFormaPago: '',
      notasGenerales: '',
      partidas: [emptyPartida],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'partidas',
  });
  const selectedEmpresaId = form.watch('idEmpresa');
  const filteredSucursales = useMemo(
    () => sucursales.filter((s) => !selectedEmpresaId || s.idEmpresa === selectedEmpresaId),
    [sucursales, selectedEmpresaId],
  );
  const filteredAreas = useMemo(
    () => areas.filter((a) => !selectedEmpresaId || a.idEmpresa === selectedEmpresaId),
    [areas, selectedEmpresaId],
  );
  useEffect(() => {
    const currentSucursal = form.getValues('idSucursal');
    if (currentSucursal) {
      const belongsToNewEmpresa = sucursales.some(
        (s) => s.idSucursal === currentSucursal && s.idEmpresa === selectedEmpresaId,
      );
      if (!belongsToNewEmpresa) {
        form.setValue('idSucursal', 0);
      }
    }
  }, [selectedEmpresaId]);
  const sinDatosFiscales = form.watch('sinDatosFiscales');
  useEffect(() => {
    if (sinDatosFiscales) {
      form.setValue('rfcProveedor', '');
      form.setValue('codigoPostalProveedor', '');
      form.setValue('idRegimenFiscal', 0);
    }
  }, [sinDatosFiscales]);
  const partidas = form.watch('partidas');
  const totales = useMemo(() => {
    let subtotal = 0;
    let totalIva = 0;
    let totalRetenciones = 0;
    let totalOtrosImpuestos = 0;
    for (const p of partidas || []) {
      const base =
        (p.precioUnitario || 0) * (p.cantidad || 0) - (p.descuento || 0);
      subtotal += base;
      totalIva += base * ((p.porcentajeIva || 0) / 100);
      totalRetenciones += p.totalRetenciones || 0;
      totalOtrosImpuestos += p.otrosImpuestos || 0;
    }
    const total = subtotal + totalIva - totalRetenciones + totalOtrosImpuestos;
    return { subtotal, totalIva, totalRetenciones, totalOtrosImpuestos, total };
  }, [partidas]);
  // @lat: [[frontend#API Integration#Error Handling]]
  const fetchCatalogs = async () => {
    setLoadingCatalogs(true);
    const errors: string[] = [];

    try {
      // Cargar Empresas, Sucursales y Áreas (esenciales - deben funcionar)
      const [empresasData, sucursalesData, areasData] = await Promise.all([
        authService.getEmpresas(),
        authService.getSucursales(),
        authService.getAreas(),
      ]);
      console.log('[Empresas] items:', empresasData?.length);
      setEmpresas(empresasData || []);
      setSucursales(sucursalesData || []);
      setAreas(areasData || []);
    } catch (err) {
      console.error('[fetchCatalogs] ERROR en catálogos principales:', err);
      toast.error('Error al cargar empresas, sucursales o áreas');
      setLoadingCatalogs(false);
      return;
    }

    // Cargar catálogos secundarios de forma independiente (si fallan uno, no afectan los otros)
    try {
      const gastoRes = await API.get<ApiResponse<Gasto[]>>('/catalogos/Gastos');
      if (gastoRes.data.success) setTiposGasto(gastoRes.data.data || []);
    } catch (err) {
      console.warn('[fetchCatalogs] Error al cargar Gastos:', err);
      errors.push('Tipos de Gasto');
    }

    try {
      const fpRes = await API.get<ApiResponse<FormaPago[]>>('/catalogos/FormasPago');
      if (fpRes.data.success) setFormasPago(fpRes.data.data || []);
    } catch (err) {
      console.warn('[fetchCatalogs] Error al cargar FormasPago:', err);
      errors.push('Formas de Pago');
    }

    try {
      const umRes = await API.get<ApiResponse<UnidadMedida[]>>('/catalogos/UnidadesMedida');
      if (umRes.data.success) setUnidadesMedida(umRes.data.data || []);
    } catch (err) {
      console.warn('[fetchCatalogs] Error al cargar UnidadesMedida:', err);
      errors.push('Unidades de Medida');
    }

    try {
      const rfRes = await API.get<ApiResponse<RegimenFiscalItem[]>>('/catalogos/RegimenesFiscales');
      if (rfRes.data.success) setRegimenesFiscales(rfRes.data.data || []);
    } catch (err) {
      console.warn('[fetchCatalogs] Error al cargar RegimenesFiscales:', err);
      errors.push('Regímenes Fiscales');
    }

    if (errors.length > 0) {
      toast.warning(`No tienes permisos para ver: ${errors.join(', ')}`);
    }

    setLoadingCatalogs(false);
  };
  useEffect(() => {
    fetchCatalogs();
  }, []);
  const handleSave = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const fechaLimite = new Date(values.fechaLimitePago);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (fechaLimite <= today) {
        toast.error('La fecha límite de pago debe ser futura.');
        setIsSaving(false);
        return;
      }
      if (!values.sinDatosFiscales && values.rfcProveedor) {
        if (values.rfcProveedor.length !== 12 && values.rfcProveedor.length !== 13) {
          toast.error('El RFC debe tener 12 o 13 caracteres.');
          setIsSaving(false);
          return;
        }
      }
      const payload: CreateOrdenCompraRequest = {
        ...values,
        rfcProveedor: values.rfcProveedor || null,
        codigoPostalProveedor: values.codigoPostalProveedor || null,
        idRegimenFiscal: values.idRegimenFiscal || null,
        personaContacto: values.personaContacto || null,
        notaFormaPago: values.notaFormaPago || null,
        notasGenerales: values.notasGenerales || null,
      };
      const response = await API.post<ApiResponse<void>>('/ordenes', payload);
      if (response.data.success) {
        toast.success('Orden de compra creada correctamente.');
        navigate('/ordenes/autorizaciones');
      } else {
        toast.error(response.data.message ?? 'Error al crear la orden de compra');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al crear la orden de compra');
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <Form {...form}>
        <form className="space-y-6">
          {/* Card: Datos Generales */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Datos Generales
              </CardTitle>
            </CardHeader>
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
                          onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ''}
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
                          onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ''}
                          disabled={!selectedEmpresaId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedEmpresaId ? "Selecciona sucursal..." : "Primero selecciona empresa"} />
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
                          onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ''}
                          disabled={!selectedEmpresaId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedEmpresaId ? "Selecciona área..." : "Primero selecciona empresa"} />
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

              {/* Sección: Detalles de la Orden */}
              <FormSection icon={Tag} title="Detalles de la Orden">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="idTipoGasto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Gasto *</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo de gasto..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposGasto.map((g) => (
                              <SelectItem key={g.idGasto} value={String(g.idGasto)}>
                                {g.nombre}
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
                    name="idFormaPago"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pago *</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona forma de pago..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {formasPago.map((fp) => (
                              <SelectItem key={fp.idFormaPago} value={String(fp.idFormaPago)}>
                                {fp.nombre}
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
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Fecha máxima para realizar el pago al proveedor
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>
            </CardContent>
          </Card>

          {/* Card: Datos del Proveedor */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Datos del Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="sinDatosFiscales"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="!mt-0 font-medium">Sin Datos Fiscales</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Marcar si el proveedor no cuenta con RFC ni información fiscal completa (ej. persona física sin actividad empresarial)
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormSection icon={Building2} title="Información General">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="razonSocialProveedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razón Social *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo o razón social del proveedor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {!sinDatosFiscales && (
                <FormSection icon={FileText} title="Datos Fiscales">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="rfcProveedor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RFC</FormLabel>
                          <FormControl>
                            <Input placeholder="ABCD010101XXX" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            12 caracteres para personas morales, 13 para físicas
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="codigoPostalProveedor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código Postal</FormLabel>
                          <FormControl>
                            <Input placeholder="00000" maxLength={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="idRegimenFiscal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Régimen Fiscal</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(Number(val))}
                            value={field.value ? String(field.value) : ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona régimen fiscal..." />
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
                  </div>
                </FormSection>
              )}

              <FormSection icon={User} title="Contacto">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="personaContacto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona de Contacto</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre de quien atiende esta orden" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notaFormaPago"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5" />
                          Nota de Forma de Pago
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Instrucciones especiales de pago" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>
            </CardContent>
          </Card>

          {/* Card: Partidas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Partidas</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(emptyPartida)}
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar Partida
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((item, index) => {
                const p = partidas?.[index];
                const lineBase = (p?.precioUnitario || 0) * (p?.cantidad || 0) - (p?.descuento || 0);
                const lineIva = lineBase * ((p?.porcentajeIva || 0) / 100);
                const lineTotal =
                  lineBase + lineIva - (p?.totalRetenciones || 0) + (p?.otrosImpuestos || 0);
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-card p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          Partida
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                          Total: {fmt(lineTotal)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                      <FormField
                        control={form.control}
                        name={`partidas.${index}.descripcion`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
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
                          <FormItem>
                            <FormLabel>Cantidad *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <FormItem>
                            <FormLabel>Unidad *</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(Number(val))}
                              value={field.value ? String(field.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Unidad..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {unidadesMedida.map((um) => (
                                  <SelectItem key={um.idUnidadMedida} value={String(um.idUnidadMedida)}>
                                    {um.nombre} ({um.abreviatura})
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
                        name={`partidas.${index}.precioUnitario`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio Unitario *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <FormItem>
                            <FormLabel>Descuento</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`partidas.${index}.porcentajeIva`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>% IVA</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <FormField
                        control={form.control}
                        name={`partidas.${index}.totalRetenciones`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Retenciones</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <FormItem>
                            <FormLabel>Otros Impuestos</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`partidas.${index}.deducible`}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 pt-6">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="!mt-0">Deducible</FormLabel>
                          </FormItem>
                        )}
                      />
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
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-medium tabular-nums">{fmt(totales.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">IVA</span>
                  <span className="text-sm font-medium tabular-nums">{fmt(totales.totalIva)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Retenciones</span>
                  <span className="text-sm font-medium text-destructive tabular-nums">−{fmt(totales.totalRetenciones)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Otros Impuestos</span>
                  <span className="text-sm font-medium tabular-nums">{fmt(totales.totalOtrosImpuestos)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between bg-primary/5 px-4 py-3 rounded-lg">
                  <span className="text-base font-bold">Total de la Orden</span>
                  <span className="text-xl font-bold text-primary tabular-nums">{fmt(totales.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas Generales */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Notas Generales</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notasGenerales"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Información adicional relevante para esta orden de compra..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
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
              onClick={form.handleSubmit(handleSave)}
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
    </div>
  );
}
