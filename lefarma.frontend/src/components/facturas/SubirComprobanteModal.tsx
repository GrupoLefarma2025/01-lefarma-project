import { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Upload, FileText, FileImage, CheckCircle2, X, Receipt, ArrowRight, ArrowLeft, AlertCircle,
} from 'lucide-react';
import { comprobanteService } from '@/services/comprobanteService';
import { FileUploader } from '@/components/archivos/FileUploader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CfdiPreviewResponse, ComprobanteResponse, PartidaPendienteResponse, AsignacionItemRequest } from '@/types/comprobante.types';
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
  partidasPendientes: PartidaPendienteResponse[];
  onComprobanteSubido: (comprobante: ComprobanteResponse) => void;
  tipoForzado?: string;
}

type Step = 'datos' | 'archivos' | 'asignar';

const TIPOS = [
  { value: 'cfdi', label: 'Factura CFDI', icon: FileText, desc: 'XML + PDF del SAT' },
  { value: 'ticket', label: 'Ticket', icon: Receipt, desc: 'Ticket de compra / caja' },
  { value: 'nota', label: 'Nota', icon: FileText, desc: 'Nota de remision o cargo' },
  { value: 'recibo', label: 'Recibo', icon: FileText, desc: 'Recibo de pago' },
  { value: 'manual', label: 'Otro', icon: FileImage, desc: 'Documento manual / imagen' },
];

const formatCurrency = (v: number) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export function SubirComprobanteModal({ open, onClose, idEmpresa, idOrden, idPasoWorkflow, nombrePaso, nombreAccion, partidasPendientes, onComprobanteSubido, tipoForzado }: Props) {
  const [step, setStep] = useState<Step>(() => (tipoForzado ? 'archivos' : 'datos'));
  const [tipoComprobante, setTipoComprobante] = useState<string>(tipoForzado ?? '');
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [totalManual, setTotalManual] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cfdiPreview, setCfdiPreview] = useState<CfdiPreviewResponse | null>(null);
  const [comprobanteSubido, setComprobanteSubido] = useState<ComprobanteResponse | null>(null);
  const [asignaciones, setAsignaciones] = useState<{ idPartida: number; checked: boolean; idConcepto: number | null; cantidad: string; importe: string; notas: string; }[]>([]);

  const xmlInputRef = useRef<HTMLInputElement>(null);
  const esCfdi = tipoComprobante === 'cfdi';

  useEffect(() => {
    if (open) {
      const pendiente = partidasPendientes.reduce((s, p) => s + p.importePendiente, 0);
      setTotalManual(pendiente > 0 ? pendiente.toFixed(2) : '');
    }
  }, [open, partidasPendientes]);

  const reset = () => {
    setStep(tipoForzado ? 'archivos' : 'datos');
    setTipoComprobante(tipoForzado ?? '');
    setXmlFile(null);
    setArchivoFile(null);
    setTotalManual('');
    setNotas('');
    setSubmitError(null);
    setCfdiPreview(null);
    setComprobanteSubido(null);
    setAsignaciones([]);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── XML parsing ──────────────────────────────────────────────────────────

  const handleXmlChange = async (file: File) => {
    setXmlFile(file);
    setCfdiPreview(null);
    setSubmitError(null);
    setLoading(true);
    try { const preview = await comprobanteService.parsearXml(file); setCfdiPreview(preview); }
    catch { toast.error('El XML no es un CFDI valido o esta malformado'); setXmlFile(null); }
    finally { setLoading(false); }
  };

  // ── Step datos → archivos: crea comprobante ──────────────────────────────

  const handleCrearComprobante = async () => {
    if (!tipoComprobante) { toast.error('Selecciona el tipo de comprobante'); return; }
    if (esCfdi && !xmlFile) { toast.error('Debes cargar el XML del CFDI'); return; }
    if (!esCfdi && (!totalManual || Number(totalManual) <= 0)) { toast.error('Ingresa el total del comprobante'); return; }

    setLoading(true);
    try {
      const comp = await comprobanteService.subir({
        idEmpresa, idOrden: idOrden ?? null, idPasoWorkflow,
        tipoComprobante, categoria: 'gasto',
        totalManual: !esCfdi ? Number(totalManual) : null,
        notas: notas || null, xmlFile: esCfdi ? xmlFile : null,
        nombrePaso: nombrePaso ?? null, nombreAccion: nombreAccion ?? null,
      });
      setComprobanteSubido(comp);
      setStep('archivos');
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      const msg = apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al crear comprobante';
      setSubmitError(msg);
    } finally { setLoading(false); }
  };

  // ── Step archivos → asignar ──────────────────────────────────────────────

  const handleArchivoSubido = async (archivos: Archivo[]) => {
    if (!comprobanteSubido) return;
    void archivos;

    if (partidasPendientes.length === 0) {
      onComprobanteSubido(comprobanteSubido);
      handleClose();
      return;
    }

    const singleConcepto = esCfdi && comprobanteSubido.conceptos.length === 1 ? comprobanteSubido.conceptos[0] : null;
    const multiPartidaCfdi = esCfdi && singleConcepto && partidasPendientes.length > 1;

    setAsignaciones(
      partidasPendientes.map((p, idx) => ({
        idPartida: p.idPartida,
        checked: multiPartidaCfdi ? idx === 0 : true,
        idConcepto: singleConcepto?.idConcepto ?? null,
        cantidad: esCfdi ? String(p.cantidadPendiente) : '1',
        importe: esCfdi ? String(p.importePendiente)
          : (() => {
              const pendTotal = partidasPendientes.reduce((s, x) => s + x.importePendiente, 0);
              return pendTotal > 0 ? String(((p.importePendiente / pendTotal) * comprobanteSubido.total).toFixed(2))
                : String((comprobanteSubido.total / partidasPendientes.length).toFixed(2));
            })(),
        notas: '',
      }))
    );
    setStep('asignar');
  };

  // ── Step asignar → guardar ───────────────────────────────────────────────

  const handleAsignar = async () => {
    if (!comprobanteSubido) return;
    const items: AsignacionItemRequest[] = asignaciones
      .filter(a => a.checked && Number(a.importe) > 0)
      .map(a => ({
        idPartida: a.idPartida, cantidadAsignada: Number(a.cantidad) || 1,
        importeAsignado: Number(a.importe), notas: a.notas || null,
      }));
    if (items.length === 0) { toast.error('Selecciona al menos una partida'); return; }
    setLoading(true);
    try {
      const updated = await comprobanteService.asignarPartidas(comprobanteSubido.idComprobante, { asignaciones: items }, idPasoWorkflow);
      onComprobanteSubido(updated);
      toast.success('Asignacion guardada.');
      handleClose();
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al asignar partidas');
    } finally { setLoading(false); }
  };

  const stepTitle = { datos: 'Datos del comprobante', archivos: 'Subir archivo', asignar: 'Asignar a partidas' }[step];

  // Metadata para FileUploader
  const metadataArchivo = comprobanteSubido ? {
    modulo: 'ordenes_compra', origen: 'workflow',
    tipo: 'comprobante_gasto', idOrden: idOrden, idComprobante: comprobanteSubido.idComprobante,
    subtipo: tipoComprobante, archivo: esCfdi ? 'pdf' : 'imagen', monto: comprobanteSubido.total,
    paso: idPasoWorkflow, nombrePaso: nombrePaso, nombreAccion: nombreAccion,
  } : undefined;

  return (
    <Modal id="subir-comprobante" open={open} setOpen={(v) => { if (!v) handleClose(); }} title={stepTitle}
      size="xl" canClose={!loading}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {step === 'asignar' && (
              <Button variant="outline" size="sm" onClick={() => setStep('archivos')} disabled={loading}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Atras
              </Button>
            )}
            {step === 'datos' && <div />}
          </div>
          <div className="flex gap-2">
            {step === 'datos' ? (
              <Button onClick={handleCrearComprobante} disabled={loading}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
                Siguiente
              </Button>
            ) : step === 'asignar' ? (
              <Button onClick={handleAsignar} disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Guardar asignaciones
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {/* Header con datos de la orden */}
      {partidasPendientes.length > 0 && (
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1.5 text-xs mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span>{partidasPendientes[0]?.folioOrden ?? 'Orden'}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{partidasPendientes.length} partida{partidasPendientes.length > 1 ? 's' : ''}</span>
            </div>
            <span className="font-semibold">{formatCurrency(partidasPendientes.reduce((s, p) => s + p.total, 0))}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal: {formatCurrency(partidasPendientes.reduce((s, p) => s + (p.cantidad * p.precioUnitario), 0))}</span>
            <span>Pendiente: {formatCurrency(partidasPendientes.reduce((s, p) => s + p.importePendiente, 0))}</span>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="mb-4 flex items-center gap-1 text-xs">
        {(['datos', 'archivos', 'asignar'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === s ? 'bg-primary text-primary-foreground' : ['datos', 'archivos', 'asignar'].indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {['datos', 'archivos', 'asignar'].indexOf(step) > i ? '✓' : i + 1}
            </span>
            <span className={step === s ? 'font-medium' : 'text-muted-foreground'}>{{ datos: 'Datos', archivos: 'Archivos', asignar: 'Asignar' }[s]}</span>
            {i < 2 && <span className="text-muted-foreground">›</span>}
          </div>
        ))}
      </div>

      {/* ── Step: datos ── */}
      {step === 'datos' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Ingresa los datos del comprobante a registrar.</p>

          <div className="space-y-1.5">
            <Label>Tipo de comprobante <span className="text-red-500">*</span></Label>
            <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
              <SelectTrigger><SelectValue placeholder="Selecciona el tipo..." /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(({ value, label }) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
              </SelectContent>
            </Select>
            {tipoComprobante && <p className="text-[10px] text-muted-foreground">{TIPOS.find(t => t.value === tipoComprobante)?.desc}</p>}
          </div>

          {/* XML CFDI */}
          {esCfdi && (
            <div className="space-y-2">
              <Label>Archivo XML CFDI <span className="text-red-500">*</span></Label>
              <input ref={xmlInputRef} type="file" accept=".xml" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleXmlChange(e.target.files[0])} />
              {!xmlFile ? (
                <button type="button" onClick={() => xmlInputRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition hover:border-primary hover:bg-muted/30">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span>{loading ? 'Parseando XML...' : 'Arrastra o selecciona el XML'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate text-emerald-700">{xmlFile.name}</span>
                  <button type="button" onClick={() => { setXmlFile(null); setCfdiPreview(null); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              {cfdiPreview && (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> CFDI valido</div>
                    {cfdiPreview.satContactado === true && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfdiPreview.satEstado === 'Vigente' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {cfdiPreview.satEstado === 'Vigente' ? '✓' : '✗'} SAT: {cfdiPreview.satEstado}
                      </span>
                    )}
                    {cfdiPreview.satContactado === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">SAT no disponible</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-muted-foreground">Emisor</p><p className="font-medium truncate">{cfdiPreview.nombreEmisor ?? '—'}</p><p className="text-[10px] text-muted-foreground">{cfdiPreview.rfcEmisor}</p></div>
                    <div><p className="text-muted-foreground">UUID</p><p className="font-mono text-[10px] break-all">{cfdiPreview.uuid ?? '—'}</p></div>
                    <div><p className="text-muted-foreground">Total</p><p className="font-semibold text-sm">{formatCurrency(cfdiPreview.total)}</p></div>
                    <div><p className="text-muted-foreground">Conceptos</p><p className="font-medium">{cfdiPreview.conceptos.length}</p></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Total manual (no CFDI) */}
          {tipoComprobante && tipoComprobante !== 'cfdi' && (
            <div className="space-y-1.5">
              <Label>Total del comprobante <span className="text-red-500">*</span></Label>
              <Input type="number" min="0.01" step="0.01" value={totalManual} onChange={(e) => setTotalManual(e.target.value.replace(',', '.'))}
                placeholder={(() => { const p = partidasPendientes.reduce((s, x) => s + x.importePendiente, 0); return p > 0 ? p.toFixed(2) : '0.00'; })()} />
              <p className="text-[10px] text-muted-foreground">Ingresa el total del ticket, nota o recibo.</p>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." rows={2} />
          </div>
        </div>
      )}

      {/* ── Step: archivos — FileUploader ── */}
      {step === 'archivos' && comprobanteSubido && (
        <>
          <p className="text-xs text-muted-foreground mb-3">Sube el archivo PDF o imagen del comprobante.</p>
          <FileUploader inline open={true} entidadTipo="OrdenCompra" entidadId={idOrden ?? 0}
            carpeta="comprobantes" metadata={metadataArchivo} tiposPermitidos={['.pdf', '.jpg', '.jpeg', '.png']}
            cantidadMaxima={1} multiple={false}
            descripcion="Arrastra o haz clic para seleccionar el archivo"
            onUploadComplete={handleArchivoSubido} onClose={() => {}} />
        </>
      )}

      {/* ── Step: asignar ── */}
      {step === 'asignar' && comprobanteSubido && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Distribuye el comprobante entre las partidas de la orden.</p>
          <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{TIPOS.find(t => t.value === tipoComprobante)?.label}</p>
              {comprobanteSubido.uuidCfdi && <p className="font-mono text-[10px] text-muted-foreground truncate">{comprobanteSubido.uuidCfdi}</p>}
              {partidasPendientes.length > 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Partidas: {partidasPendientes.length} · Total pendiente: {formatCurrency(partidasPendientes.reduce((s, p) => s + p.importePendiente, 0))}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Total comprobante</p>
              <p className="text-base font-bold">{formatCurrency(comprobanteSubido.total)}</p>
              {asignaciones.some(a => a.checked) && (
                <p className={`text-[10px] ${asignaciones.filter(a => a.checked).reduce((s, a) => s + (Number(a.importe) || 0), 0) > comprobanteSubido.total ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  Asignado: {formatCurrency(asignaciones.filter(a => a.checked).reduce((s, a) => s + (Number(a.importe) || 0), 0))}
                </p>
              )}
            </div>
          </div>

          {esCfdi && comprobanteSubido.conceptos.length > 1 && (
            <div className="rounded-md border bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conceptos CFDI</p>
              {comprobanteSubido.conceptos.map(c => (
                <div key={c.idConcepto} className="flex justify-between text-xs"><span className="truncate max-w-[220px] text-muted-foreground">{c.descripcion}</span><span className="font-medium shrink-0 ml-2">{formatCurrency(c.importePendiente)}</span></div>
              ))}
            </div>
          )}

          {asignaciones.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> Sin partidas pendientes para asignar.</div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {asignaciones.map((asig, i) => {
              const partida = partidasPendientes.find(p => p.idPartida === asig.idPartida);
              return (
                <div key={i} className={cn('rounded-lg border transition-colors', asig.checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 opacity-60')}>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <Checkbox id={`asig-check-${i}`} checked={asig.checked} onCheckedChange={v => setAsignaciones(prev => prev.map((a, j) => j === i ? { ...a, checked: Boolean(v) } : a))} />
                    <label htmlFor={`asig-check-${i}`} className="flex-1 cursor-pointer text-sm">
                      <span className="font-medium">#{partida?.numeroPartida}</span>{' '}
                      <span className="text-muted-foreground truncate">{partida?.descripcionPartida}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{partida ? formatCurrency(partida.importePendiente) : '—'}</span>
                  </div>
                  {asig.checked && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {esCfdi && (<div className="space-y-1"><Label className="text-[10px]">Cantidad</Label><Input type="number" min="0.01" step="0.01" value={asig.cantidad} onChange={e => setAsignaciones(prev => prev.map((a, j) => j === i ? { ...a, cantidad: e.target.value } : a))} /></div>)}
                        <div className="space-y-1"><Label className="text-[10px]">Importe</Label><Input type="number" min="0.01" step="0.01" value={asig.importe} onChange={e => setAsignaciones(prev => prev.map((a, j) => j === i ? { ...a, importe: e.target.value.replace(',', '.') } : a))} /></div>
                      </div>
                      <div className="space-y-1"><Label className="text-[10px]">Notas <span className="text-muted-foreground">(opcional)</span></Label><Input value={asig.notas} onChange={e => setAsignaciones(prev => prev.map((a, j) => j === i ? { ...a, notas: e.target.value } : a))} placeholder="Notas..." /></div>
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
