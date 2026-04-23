import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  AlertCircle,
  Banknote,
} from 'lucide-react';
import { comprobanteService } from '@/services/comprobanteService';
import { FileUploader } from '@/components/archivos/FileUploader';
import { toast } from 'sonner';
import type {
  ComprobanteResponse,
  PartidaPendienteResponse,
  AsignacionItemRequest,
} from '@/types/comprobante.types';
import type { Archivo } from '@/types/archivo.types';
import { toApiError } from '@/utils/errors';

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

const TIPOS_PAGO = [
  { value: 'spei',          label: 'SPEI / Transferencia' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia internacional' },
  { value: 'otro',          label: 'Otro' },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface AsignacionLocal {
  idPartida: number | null;
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

  // Step datos
  const [tipoPago, setTipoPago]       = useState('spei');
  const [referencia, setReferencia]   = useState('');
  const [fechaPago, setFechaPago]     = useState('');
  const [monto, setMonto]             = useState(() => totalOrden != null ? String(totalOrden) : '');
  const [notas, setNotas]             = useState('');

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
    setTipoPago('spei');
    setReferencia('');
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
        tipoComprobante:  tipoPago,
        categoria:        'pago',
        montoPago:        Number(monto),
        referenciaPago:   referencia || null,
        fechaPago:        fechaPago || null,
        notas:            notas || null,
        nombrePaso:       nombrePaso ?? null,
        nombreAccion:     nombreAccion ?? null,
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

  // ── Step archivo → asignar (o cierre directo si ≤1 partida) ─────────────

  const handleArchivoSubido = async (archivos: Archivo[]) => {
    if (!comprobanteSubido) return;
    void archivos; // ya subidos, solo necesitamos el comprobante

    // Con 0 o 1 partida: auto-asignar y cerrar sin mostrar step asignar
    if (partidasPendientes.length <= 1) {
      if (partidasPendientes.length === 1) {
        setLoading(true);
        try {
          const items: AsignacionItemRequest[] = [{
            idConcepto:       null,
            idPartida:        partidasPendientes[0].idPartida,
            cantidadAsignada: 1,
            importeAsignado:  Number(monto),
            notas:            null,
          }];
          const updated = await comprobanteService.asignarPartidas(
            comprobanteSubido.idComprobante,
            { asignaciones: items },
            idPasoWorkflow
          );
          onComprobanteSubido(updated);
        } catch (error: unknown) {
          const apiErr = toApiError(error);
          toast.error(apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al asignar el pago a la partida');
          setLoading(false);
          return; // Stay in modal so user can fix
        } finally {
          setLoading(false);
        }
      } else {
        onComprobanteSubido(comprobanteSubido);
      }
      handleClose();
      return;
    }

    // Múltiples partidas: mostrar step asignar para distribuir
    setAsignaciones(
      partidasPendientes.map((p) => ({
        idPartida: p.idPartida,
        importe:   String(Math.min(Number(monto), p.importePendiente).toFixed(2)),
        notas:     '',
      }))
    );
    setStep('asignar');
  };

  // ── Step asignar → cierre ─────────────────────────────────────────────────

  const handleAsignar = async () => {
    if (!comprobanteSubido) return;

    const items: AsignacionItemRequest[] = asignaciones
      .filter((a) => a.idPartida !== null && Number(a.importe) > 0)
      .map((a) => ({
        idConcepto:       null,
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
      handleClose();
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al asignar partidas');
    } finally {
      setLoading(false);
    }
  };

  const skipAsignacion = () => {
    if (!comprobanteSubido) return;
    onComprobanteSubido(comprobanteSubido);
    handleClose();
  };

  // ── Metadata para FileUploader ────────────────────────────────────────────

  const metadataArchivo = comprobanteSubido ? {
    modulo:         'ordenes_compra',
    origen:         'workflow',
    tipo:           'comprobante_pago',
    idOrden:        idOrden,
    idComprobante:  comprobanteSubido.idComprobante,
    subtipo:        tipoPago,
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
        <div className="flex w-full items-center justify-end gap-2">
          {step === 'datos' && (
            <Button onClick={handleCrearComprobante} disabled={loading || !monto}>
              {loading
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
              Siguiente
            </Button>
          )}
          {step === 'asignar' && (
            <>
              <Button variant="outline" size="sm" onClick={skipAsignacion} disabled={loading}>
                Omitir asignación
              </Button>
              <Button onClick={handleAsignar} disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Guardar asignaciones
              </Button>
            </>
          )}
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

      {/* ── Step: datos ── */}
      {step === 'datos' && (
        <div className="space-y-4">
          {/* Banner de progreso de pago */}
          {totalOrden != null && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2 text-xs">
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

          <div className="space-y-1.5">
            <Label>Tipo de pago <span className="text-red-500">*</span></Label>
            <Select value={tipoPago} onValueChange={setTipoPago}>
              <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_PAGO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Monto pagado <span className="text-red-500">*</span></Label>
            <Input
              type="number" min="0.01" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Referencia / folio <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej. 123456789" />
            </div>
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
      )}

      {/* ── Step: asignar ── */}
      {step === 'asignar' && comprobanteSubido && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium">
                {TIPOS_PAGO.find((t) => t.value === comprobanteSubido.tipoComprobante)?.label ?? comprobanteSubido.tipoComprobante}
              </p>
              {comprobanteSubido.referenciaPago && (
                <p className="text-muted-foreground">Ref: {comprobanteSubido.referenciaPago}</p>
              )}
            </div>
            <p className="text-base font-bold">{formatCurrency(comprobanteSubido.total)}</p>
          </div>

          {partidasPendientes.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> No hay partidas pendientes en esta orden.
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {asignaciones.map((asig, i) => {
              const partida = partidasPendientes.find((p) => p.idPartida === asig.idPartida);
              return (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">
                      {partida ? `#${partida.numeroPartida} — ${partida.descripcionPartida}` : `Partida ${asig.idPartida}`}
                    </span>
                    {partida && (
                      <span className="text-muted-foreground shrink-0 ml-2">
                        Por cubrir: {formatCurrency(partida.importePendiente)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Importe a asignar</Label>
                      <Input
                        type="number" min="0.01" step="0.01"
                        value={asig.importe}
                        onChange={(e) => {
                          const next = [...asignaciones];
                          next[i] = { ...next[i], importe: e.target.value };
                          setAsignaciones(next);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Notas</Label>
                      <Input
                        value={asig.notas}
                        onChange={(e) => {
                          const next = [...asignaciones];
                          next[i] = { ...next[i], notas: e.target.value };
                          setAsignaciones(next);
                        }}
                        placeholder="Opcional"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
