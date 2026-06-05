import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Banknote,
} from 'lucide-react';
import { comprobanteService } from '@/services/comprobanteService';
import { API } from '@/services/api';
import { FileUploader } from '@/components/archivos/FileUploader';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api.types';
import type {
  ComprobanteResponse,
  PartidaPendienteResponse,
  AsignacionItemRequest,
} from '@/types/comprobante.types';
import type { Archivo } from '@/types/archivo.types';
import { toApiError } from '@/utils/errors';

interface MedioPagoItem {
  idMedioPago: number;
  nombre: string;
  codigoSAT: string;
  requiereReferencia: boolean;
  requiereAutorizacion: boolean;
  orden: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  idEmpresa: number;
  idOrden?: number | null;
  idPasoWorkflow?: number | null;
  nombrePaso?: string | null;
  nombreAccion?: string | null;
  totalOrden?: number;
  folioOrden?: string;
  totalPagado?: number;
  partidasPendientes: PartidaPendienteResponse[];
  onComprobanteSubido: (comprobante: ComprobanteResponse) => void;
}

type Step = 'datos' | 'archivo' | 'asignar';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface AsignacionLocal {
  idPartida: number | null;
  checked: boolean;
  importe: string;
  notas: string;
}

export function SubirComprobantePagoModal({
  open,
  onClose,
  idEmpresa,
  idOrden,
  idPasoWorkflow,
  nombrePaso,
  nombreAccion,
  totalOrden,
  folioOrden,
  totalPagado = 0,
  partidasPendientes,
  onComprobanteSubido,
}: Props) {
  const [step, setStep] = useState<Step>('datos');
  const [loading, setLoading] = useState(false);
  const [mediosPago, setMediosPago] = useState<MedioPagoItem[]>([]);

  // Step datos
  const [idMedioPago, setIdMedioPago] = useState<number | null>(null);
  const [referencia, setReferencia]   = useState('');
  const [autorizacion, setAutorizacion] = useState('');
  const [fechaPago, setFechaPago]     = useState('');
  const [monto, setMonto]             = useState(() => totalOrden != null ? String(totalOrden) : '');
  const [notas, setNotas]             = useState('');

  // Cargar medios de pago al abrir
  useEffect(() => {
    if (open) {
      API.get<ApiResponse<MedioPagoItem[]>>('/catalogos/MediosPago')
        .then(res => { if (res.data?.success) setMediosPago((res.data.data ?? []).sort((a, b) => a.orden - b.orden)); })
        .catch(() => { /* silent */ });
    }
  }, [open]);

  const medioSeleccionado = mediosPago.find(m => m.idMedioPago === idMedioPago);

  // Pendiente al abrir el modal
  const pendienteOrden = totalOrden != null ? Math.max(0, totalOrden - totalPagado) : undefined;

  // Sincronizar monto con pendiente cuando se abre el modal
  useEffect(() => {
    if (open) {
      setMonto(pendienteOrden != null ? String(pendienteOrden) : '');
    }
  }, [open, pendienteOrden]);

  // Step archivo / asignar
  const [comprobanteSubido, setComprobanteSubido] = useState<ComprobanteResponse | null>(null);
  const [asignaciones, setAsignaciones]           = useState<AsignacionLocal[]>([]);

  const resetForm = () => {
    setStep('datos');
    setIdMedioPago(null);
    setReferencia('');
    setAutorizacion('');
    setFechaPago('');
    setMonto(pendienteOrden != null ? String(pendienteOrden) : '');
    setNotas('');
    setComprobanteSubido(null);
    setAsignaciones([]);
  };

  const handleClose = () => { resetForm(); onClose(); };

  // ── Step datos → archivo: crea el comprobante sin archivo ─────────────────

  const handleCrearComprobante = async () => {
    if (!monto || Number(monto) <= 0) {
      toast.error('Ingresa el monto del pago');
      return;
    }
    setLoading(true);
    try {
      const comp = await comprobanteService.subir({
        idEmpresa,
        idOrden:          idOrden ?? null,
        idPasoWorkflow,
        tipoComprobante:  medioSeleccionado?.nombre?.toLowerCase() ?? 'transferencia',
        categoria:        'pago',
        montoPago:        Number(monto),
        referenciaPago:   referencia || null,
        fechaPago:        fechaPago || null,
        notas:            notas || null,
        nombrePaso:       nombrePaso ?? null,
        nombreAccion:     nombreAccion ?? null,
        idMedioPago:      idMedioPago,
      });
      setComprobanteSubido(comp);
      setStep('archivo');
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al crear comprobante');
    } finally {
      setLoading(false);
    }
  };

  // ── Step archivo → asignar ────────────────────────────────────────────────

  const handleArchivoSubido = async (archivos: Archivo[]) => {
    if (!comprobanteSubido) return;
    void archivos;

    // Siempre ir al step asignar para que el usuario revise
    setAsignaciones(
      partidasPendientes.map((p) => ({
        idPartida: p.idPartida,
        checked: true,
        importe:   partidasPendientes.length === 1
          ? String(Math.min(Number(monto), p.importePendiente).toFixed(2))
          : '0',
        notas:     '',
      }))
    );
    setStep('asignar');
  };

  // ── Step asignar → cierre ─────────────────────────────────────────────────

  const handleAsignar = async () => {
    if (!comprobanteSubido) return;

    const items: AsignacionItemRequest[] = asignaciones
      .filter((a) => a.checked && a.idPartida !== null && Number(a.importe) > 0)
      .map((a) => ({
        idPartida:        a.idPartida!,
        cantidadAsignada: 1,
        importeAsignado:  Number(a.importe),
        notas:            a.notas || null,
      }));

    if (items.length === 0) {
      toast.error('Asigna el pago a al menos una partida');
      return;
    }

    setLoading(true);
    try {
      const updated = await comprobanteService.asignarPartidas(
        comprobanteSubido.idComprobante,
        { asignaciones: items },
        idPasoWorkflow
      );
      onComprobanteSubido(updated);
      toast.success('Pago asignado.');
      handleClose();
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al asignar partidas');
    } finally {
      setLoading(false);
    }
  };

  // ── Metadata para FileUploader ────────────────────────────────────────────

  const metadataArchivo = comprobanteSubido ? {
    modulo:         'ordenes_compra',
    origen:         'workflow',
    tipo:           'comprobante_pago',
    idOrden:        idOrden,
    idComprobante:  comprobanteSubido.idComprobante,
    subtipo:        medioSeleccionado?.nombre?.toLowerCase() ?? 'transferencia',
    archivo:        'imagen',
    monto:          comprobanteSubido.total,
    paso:           idPasoWorkflow,
    nombrePaso:     nombrePaso,
    nombreAccion:   nombreAccion,
  } : undefined;

  // ── Indicadores de paso ───────────────────────────────────────────────────

  const STEPS: Step[] = ['datos', 'archivo', 'asignar'];
  const stepLabel: Record<Step, string> = {
    datos:   'Datos',
    archivo: 'Voucher',
    asignar: 'Asignar',
  };
  const stepTitle: Record<Step, string> = {
    datos:   'Registrar comprobante de pago',
    archivo: 'Subir comprobante / voucher',
    asignar: 'Asignar pago a partidas',
  };

  return (
    <Modal
      id="subir-comprobante-pago"
      open={open}
      setOpen={(v) => { if (!v) handleClose(); }}
      title={stepTitle[step]}
      size="lg"
      canClose={!loading}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {step === 'asignar' && (
              <Button variant="outline" size="sm" onClick={() => setStep('archivo')} disabled={loading}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Atras
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'datos' && (
              <Button onClick={handleCrearComprobante} disabled={loading || !monto}>
                {loading
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
                Siguiente
              </Button>
            )}
            {step === 'asignar' && (
              <Button onClick={handleAsignar} disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Step indicators */}
      <div className="mb-4 flex items-center gap-1 text-xs">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                ${step === s ? 'bg-primary text-primary-foreground' :
                  STEPS.indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}
            >
              {STEPS.indexOf(step) > i ? '✓' : i + 1}
            </span>
            <span className={step === s ? 'font-medium' : 'text-muted-foreground'}>
              {stepLabel[s]}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </div>
        ))}
      </div>

      {/* Banner de progreso — visible en todos los steps */}
      {totalOrden != null && (
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2 text-xs mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 shrink-0" />
              <span>{folioOrden ?? 'Orden'}</span>
            </div>
            <span className="font-semibold">{formatCurrency(totalOrden)}</span>
          </div>
          {totalPagado > 0 && (
            <>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (totalPagado / totalOrden) * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pagado: <span className="font-medium text-emerald-600">{formatCurrency(totalPagado)}</span></span>
                <span>Pendiente: <span className="font-medium text-foreground">{formatCurrency(Math.max(0, totalOrden - totalPagado))}</span></span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step: datos ── */}
      {step === 'datos' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Selecciona el medio de pago e ingresa los datos de la transaccion.</p>
          <div className="space-y-1.5">
            <Label>Medio de pago <span className="text-red-500">*</span></Label>
            <Select value={idMedioPago?.toString() ?? ''} onValueChange={(v) => setIdMedioPago(Number(v) || null)}>
              <SelectTrigger><SelectValue placeholder="Selecciona medio de pago" /></SelectTrigger>
              <SelectContent>
                {mediosPago.filter(m => m.idMedioPago).map((m) => (
                  <SelectItem key={m.idMedioPago} value={m.idMedioPago.toString()}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Monto pagado <span className="text-red-500">*</span></Label>
            <Input
              type="number" min="0.01" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value.replace(',', '.'))}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {medioSeleccionado?.requiereReferencia !== false && (
              <div className="space-y-1.5">
                <Label>Referencia / folio <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. 123456789" />
              </div>
            )}
            {medioSeleccionado?.requiereAutorizacion === true && (
              <div className="space-y-1.5">
                <Label>Autorizacion <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input value={autorizacion} onChange={(e) => setAutorizacion(e.target.value)} placeholder="Ej. A-12345" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fecha del pago <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones del pago..." rows={2} />
          </div>
        </div>
      )}

      {/* ── Step: archivo — FileUploader inline ── */}
      {step === 'archivo' && comprobanteSubido && (
        <>
          <p className="text-xs text-muted-foreground mb-3">Sube el comprobante o voucher del pago (PDF, JPG, PNG).</p>
          <FileUploader
          inline
          open={true}
          entidadTipo="OrdenCompra"
          entidadId={idOrden ?? 0}
          carpeta="comprobantes"
          metadata={metadataArchivo}
          tiposPermitidos={['.pdf', '.jpg', '.jpeg', '.png']}
          cantidadMaxima={1}
          multiple={false}
          descripcion="Arrastra o haz clic para seleccionar el comprobante / voucher"
          onUploadComplete={handleArchivoSubido}
          onClose={() => {}}
        />
        </>
      )}

      {/* ── Step: asignar ── */}
      {step === 'asignar' && comprobanteSubido && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Distribuye el pago entre las partidas de la orden. Puedes guardar y cerrar cuando termines.</p>
          
          {/* <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">
                {medioSeleccionado?.nombre ?? comprobanteSubido.tipoComprobante}
              </p>
              {comprobanteSubido.referenciaPago && (
                <p className="text-muted-foreground">Ref: {comprobanteSubido.referenciaPago}</p>
              )}
            </div>
            <p className="text-base font-bold">{formatCurrency(comprobanteSubido.total)}</p>
          </div> */}

          {partidasPendientes.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> No hay partidas pendientes en esta orden.
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {asignaciones.map((asig, i) => {
              const partida = partidasPendientes.find((p) => p.idPartida === asig.idPartida);
              return (
                <div key={i} className={cn('rounded-lg border transition-colors', asig.checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 opacity-60')}>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <Checkbox
                      id={`pago-asig-check-${i}`}
                      checked={asig.checked}
                      onCheckedChange={v => setAsignaciones(prev => prev.map((a, j) => j === i ? { ...a, checked: Boolean(v) } : a))}
                    />
                    <label htmlFor={`pago-asig-check-${i}`} className="flex-1 cursor-pointer text-sm">
                      <span className="font-medium">#{partida?.numeroPartida}</span>{' '}
                      <span className="text-muted-foreground truncate">{partida?.descripcionPartida}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{partida ? formatCurrency(partida.importePendiente) : '—'}</span>
                  </div>
                  {asig.checked && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Importe</Label>
                        <Input type="number" min="0.01" step="0.01" value={asig.importe}
                          onChange={e => {
                            const next = [...asignaciones];
                            next[i] = { ...next[i], importe: e.target.value.replace(',', '.') };
                            setAsignaciones(next);
                          }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Notas <span className="text-muted-foreground">(opcional)</span></Label>
                        <Input value={asig.notas} placeholder="Notas..."
                          onChange={e => {
                            const next = [...asignaciones];
                            next[i] = { ...next[i], notas: e.target.value };
                            setAsignaciones(next);
                          }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
