import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Upload,
  FileText,
  FileImage,
  CheckCircle2,
  X,
  Receipt,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { comprobanteService } from '@/services/comprobanteService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
  CfdiPreviewResponse,
  ComprobanteResponse,
  PartidaPendienteResponse,
  AsignacionItemRequest,
} from '@/types/comprobante.types';

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
  /** Si se pasa, se salta el paso de selección de tipo y se preselecciona este */
  tipoForzado?: string;
}

type Step = 'tipo' | 'archivos' | 'asignar';

const TIPOS = [
  { value: 'cfdi', label: 'Factura CFDI', icon: FileText, desc: 'XML + PDF del SAT' },
  { value: 'ticket', label: 'Ticket', icon: Receipt, desc: 'Ticket de compra / caja' },
  { value: 'nota', label: 'Nota', icon: FileText, desc: 'Nota de remisión o cargo' },
  { value: 'recibo', label: 'Recibo', icon: FileText, desc: 'Recibo de pago' },
  { value: 'manual', label: 'Otro', icon: FileImage, desc: 'Documento manual / imagen' },
];

const formatCurrency = (v: number) =>
  v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export function SubirComprobanteModal({
  open,
  onClose,
  idEmpresa,
  idOrden,
  idPasoWorkflow,
  nombrePaso,
  nombreAccion,
  partidasPendientes,
  onComprobanteSubido,
  tipoForzado,
}: Props) {
  const [step, setStep] = useState<Step>(() => (tipoForzado ? 'archivos' : 'tipo'));
  const [tipoComprobante, setTipoComprobante] = useState<string>(tipoForzado ?? '');
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [totalManual, setTotalManual] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [cfdiPreview, setCfdiPreview] = useState<CfdiPreviewResponse | null>(null);
  const [comprobanteSubido, setComprobanteSubido] = useState<ComprobanteResponse | null>(null);

  // Una fila por partida pendiente con checkbox para incluir/excluir
  const [asignaciones, setAsignaciones] = useState<{
    idPartida: number;
    checked: boolean;
    idConcepto: number | null;
    cantidad: string;
    importe: string;
    notas: string;
  }[]>([]);

  const xmlInputRef = useRef<HTMLInputElement>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);

  const esCfdi = tipoComprobante === 'cfdi';

  const reset = () => {
    setStep(tipoForzado ? 'archivos' : 'tipo');
    setTipoComprobante(tipoForzado ?? '');
    setXmlFile(null);
    setArchivoFile(null);
    setTotalManual('');
    setNotas('');
    setCfdiPreview(null);
    setComprobanteSubido(null);
    setAsignaciones([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Step 1 → 2: seleccionar tipo ─────────────────────────────────────────

  const goToArchivos = () => {
    if (!tipoComprobante) return;
    setStep('archivos');
  };

  // ── Step 2: parsear XML si es CFDI ───────────────────────────────────────

  const handleXmlChange = async (file: File) => {
    setXmlFile(file);
    setCfdiPreview(null);
    setLoading(true);
    try {
      const preview = await comprobanteService.parsearXml(file);
      setCfdiPreview(preview);
    } catch {
      toast.error('El XML no es un CFDI válido o está malformado');
      setXmlFile(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → 3: subir comprobante ────────────────────────────────────────

  const handleSubir = async () => {
    if (esCfdi && !xmlFile) {
      toast.error('Debes cargar el XML del CFDI');
      return;
    }
    if (!esCfdi && (!totalManual || Number(totalManual) <= 0)) {
      toast.error('Ingresa el total del comprobante');
      return;
    }
    setLoading(true);
    try {
      const comp = await comprobanteService.subir({
        idEmpresa,
        idOrden: idOrden ?? null,
        idPasoWorkflow,
        tipoComprobante,
        categoria: 'gasto',
        totalManual: !esCfdi ? Number(totalManual) : null,
        notas: notas || null,
        xmlFile: esCfdi ? xmlFile : null,
        archivo: archivoFile,
        nombrePaso: nombrePaso ?? null,
        nombreAccion: nombreAccion ?? null,
      });
      setComprobanteSubido(comp);

      // ── Inicializar asignaciones: una fila por partida ─────────────────────
      if (partidasPendientes.length === 0) {
        // Sin partidas: nada que asignar, cerrar directo
        onComprobanteSubido(comp);
        handleClose();
        return;
      }

      // Si hay 1 único concepto CFDI, se lo asignamos a todas las filas
      const singleConcepto = esCfdi && comp.conceptos.length === 1 ? comp.conceptos[0] : null;
      // Con 1 concepto CFDI solo se puede asignar a 1 partida: pre-marcar solo la primera
      const multiPartidaCfdi = esCfdi && singleConcepto && partidasPendientes.length > 1;

      setAsignaciones(
        partidasPendientes.map((p, idx) => ({
          idPartida:  p.idPartida,
          // Si CFDI con 1 concepto y múltiples partidas: solo la primera queda marcada
          checked:    multiPartidaCfdi ? idx === 0 : true,
          idConcepto: singleConcepto?.idConcepto ?? null,
          cantidad: esCfdi ? String(p.cantidadPendiente) : '1',
          importe: esCfdi
            ? String(p.importePendiente)
            : (() => {
                const totalPendiente = partidasPendientes.reduce((s, x) => s + x.importePendiente, 0);
                return totalPendiente > 0
                  ? String(((p.importePendiente / totalPendiente) * comp.total).toFixed(2))
                  : String((comp.total / partidasPendientes.length).toFixed(2));
              })(),
          notas: '',
        }))
      );

      setStep('asignar');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al subir comprobante');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 → 4: asignar partidas ─────────────────────────────────────────

  const handleAsignar = async () => {
    if (!comprobanteSubido) return;

    const items: AsignacionItemRequest[] = asignaciones
      .filter((a) => a.checked && Number(a.importe) > 0)
      .map((a) => ({
        idConcepto:       a.idConcepto,
        idPartida:        a.idPartida,
        cantidadAsignada: Number(a.cantidad) || 1,
        importeAsignado:  Number(a.importe),
        notas:            a.notas || null,
      }));

    if (items.length === 0) {
      toast.error('Selecciona al menos una partida para asignar');
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
    } catch (err: any) {
      const data = err?.response?.data;
      // Show most specific error: first item in errors[] > message > fallback
      const detail = data?.errors?.[0]?.description ?? data?.message ?? 'Error al asignar partidas';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    tipo: 'Seleccionar tipo de comprobante',
    archivos: `Subir ${TIPOS.find((t) => t.value === tipoComprobante)?.label ?? 'comprobante'}`,
    asignar: 'Asignar a partidas',
  }[step];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      id="subir-comprobante"
      open={open}
      setOpen={(v) => { if (!v) handleClose(); }}
      title={stepTitle}
      size="xl"
      canClose={!loading}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {/* Back */}
          {step === 'archivos' && (
            <Button variant="outline" size="sm" onClick={() => setStep('tipo')} disabled={loading}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Atrás
            </Button>
          )}
          {step !== 'archivos' && <div />}

          <div className="flex gap-2">
            {step === 'tipo' ? (
              <Button onClick={goToArchivos} disabled={!tipoComprobante}>
                Continuar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : step === 'archivos' ? (
              <Button onClick={handleSubir} disabled={loading}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Subir comprobante
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
      {/* ── Step indicators ── */}
      <div className="mb-4 flex items-center gap-1 text-xs">
        {(['tipo', 'archivos', 'asignar'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                ${step === s ? 'bg-primary text-primary-foreground' :
                  ['tipo', 'archivos', 'asignar'].indexOf(step) > i
                    ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}
            >
              {['tipo', 'archivos', 'asignar'].indexOf(step) > i ? '✓' : i + 1}
            </span>
            <span className={step === s ? 'font-medium' : 'text-muted-foreground'}>
              {{ tipo: 'Tipo', archivos: 'Archivos', asignar: 'Asignar' }[s]}
            </span>
            {i < 2 && <span className="text-muted-foreground">›</span>}
          </div>
        ))}
      </div>

      {/* ── Step: tipo ── */}
      {step === 'tipo' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIPOS.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTipoComprobante(value)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all
                ${tipoComprobante === value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:bg-muted/40 hover:border-border'}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${tipoComprobante === value ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Step: archivos ── */}
      {step === 'archivos' && (
        <div className="space-y-4">
          {/* XML (solo CFDI) */}
          {esCfdi && (
            <div className="space-y-2">
              <Label>Archivo XML CFDI <span className="text-red-500">*</span></Label>
              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleXmlChange(e.target.files[0])}
              />
              {!xmlFile ? (
                <button
                  type="button"
                  onClick={() => xmlInputRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition hover:border-primary hover:bg-muted/30"
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                  <span>{loading ? 'Parseando XML...' : 'Arrastra o selecciona el XML'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate text-emerald-700">{xmlFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setXmlFile(null); setCfdiPreview(null); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Preview CFDI */}
              {cfdiPreview && (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> CFDI válido
                    </div>
                    {/* Badge estado SAT */}
                    {cfdiPreview.satContactado === true && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${cfdiPreview.satEstado === 'Vigente'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {cfdiPreview.satEstado === 'Vigente' ? '✓' : '✗'} SAT: {cfdiPreview.satEstado}
                      </span>
                    )}
                    {cfdiPreview.satContactado === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        ⚠ SAT no disponible
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Emisor</p>
                      <p className="font-medium truncate">{cfdiPreview.nombreEmisor ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{cfdiPreview.rfcEmisor}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">UUID</p>
                      <p className="font-mono text-[10px] break-all">{cfdiPreview.uuid ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold text-sm">{formatCurrency(cfdiPreview.total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conceptos</p>
                      <p className="font-medium">{cfdiPreview.conceptos.length}</p>
                    </div>
                  </div>
                  {/* Aviso si CFDI no vigente */}
                  {cfdiPreview.satContactado === true && cfdiPreview.satEstado !== 'Vigente' && (
                    <div className="flex items-start gap-1.5 rounded bg-red-50 dark:bg-red-950/30 p-2 text-red-700 dark:text-red-400">
                      <span className="mt-0.5">⚠</span>
                      <span>Este CFDI no podrá ser registrado porque su estado en el SAT es <strong>{cfdiPreview.satEstado}</strong>.
                        {cfdiPreview.satCancelacion && ` (${cfdiPreview.satCancelacion})`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total manual (no CFDI) */}
          {!esCfdi && (
            <div className="space-y-1.5">
              <Label>Total del comprobante <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={totalManual}
                onChange={(e) => setTotalManual(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Archivo adjunto (PDF o imagen) */}
          <div className="space-y-2">
            <Label>{esCfdi ? 'PDF del CFDI' : 'Imagen / documento'} <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <input
              ref={archivoInputRef}
              type="file"
              accept={esCfdi ? '.pdf' : '.pdf,.jpg,.jpeg,.png,.webp'}
              className="hidden"
              onChange={(e) => setArchivoFile(e.target.files?.[0] ?? null)}
            />
            {!archivoFile ? (
              <button
                type="button"
                onClick={() => archivoInputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-border py-4 text-sm text-muted-foreground transition hover:border-primary hover:bg-muted/30"
              >
                <FileImage className="h-5 w-5" />
                <span>{esCfdi ? 'Adjuntar PDF (opcional)' : 'Adjuntar imagen / comprobante'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/20">
                <FileImage className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="flex-1 truncate text-blue-700">{archivoFile.name}</span>
                <button type="button" onClick={() => setArchivoFile(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>
        </div>
      )}

      {/* ── Step: asignar ── */}
      {step === 'asignar' && comprobanteSubido && (
        <div className="space-y-3">
          {/* Cabecera del comprobante */}
          <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{TIPOS.find((t) => t.value === tipoComprobante)?.label}</p>
              {comprobanteSubido.uuidCfdi && (
                <p className="font-mono text-[10px] text-muted-foreground truncate">{comprobanteSubido.uuidCfdi}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Total comprobante</p>
              <p className="text-base font-bold">{formatCurrency(comprobanteSubido.total)}</p>
              {asignaciones.some((a) => a.checked) && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Asignando: {formatCurrency(asignaciones.filter((a) => a.checked).reduce((s, a) => s + (Number(a.importe) || 0), 0))}
                </p>
              )}
            </div>
          </div>

          {/* CFDI: mostrar resumen de conceptos */}
          {esCfdi && comprobanteSubido.conceptos.length > 1 && (
            <div className="rounded-md border bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conceptos CFDI</p>
              {comprobanteSubido.conceptos.map((c) => (
                <div key={c.idConcepto} className="flex justify-between text-xs">
                  <span className="truncate max-w-[220px] text-muted-foreground">{c.descripcion}</span>
                  <span className="font-medium shrink-0 ml-2">{formatCurrency(c.importePendiente)}</span>
                </div>
              ))}
            </div>
          )}

          {asignaciones.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Sin partidas pendientes para asignar.
            </div>
          )}

          {/* Lista de partidas con checkbox */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {asignaciones.map((asig, i) => {
              const partida  = partidasPendientes.find((p) => p.idPartida === asig.idPartida);

              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border transition-colors',
                    asig.checked
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted/20 opacity-60'
                  )}
                >
                  {/* Fila de cabecera con checkbox */}
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <Checkbox
                      id={`asig-check-${i}`}
                      checked={asig.checked}
                      onCheckedChange={(v) =>
                        setAsignaciones((prev) =>
                          prev.map((a, idx) => (idx === i ? { ...a, checked: !!v } : a))
                        )
                      }
                    />
                    <label
                      htmlFor={`asig-check-${i}`}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="text-xs font-medium truncate">
                        #{partida?.numeroPartida ?? i + 1} — {partida?.descripcionPartida ?? 'Partida'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Pendiente: {formatCurrency(partida?.importePendiente ?? 0)}
                        {esCfdi && partida && ` · ${partida.cantidadPendiente} u.`}
                      </p>
                    </label>
                  </div>

                  {/* Campos de importe/cantidad — visibles solo cuando checked */}
                  {asig.checked && (
                    <div className="px-3 pb-3 pt-0 space-y-2">
                      {/* Selector de concepto si hay múltiples conceptos CFDI */}
                      {esCfdi && comprobanteSubido.conceptos.length > 1 && (
                        <div className="space-y-1">
                          <Label className="text-[10px]">Concepto CFDI</Label>
                          <Select
                            value={asig.idConcepto ? String(asig.idConcepto) : ''}
                            onValueChange={(v) => {
                              const concepto = comprobanteSubido.conceptos.find((c) => c.idConcepto === Number(v));
                              setAsignaciones((prev) =>
                                prev.map((a, idx) =>
                                  idx === i
                                    ? {
                                        ...a,
                                        idConcepto: Number(v),
                                        cantidad: concepto ? String(concepto.cantidadPendiente) : a.cantidad,
                                        importe:  concepto ? String(concepto.importePendiente)  : a.importe,
                                      }
                                    : a
                                )
                              );
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Seleccionar concepto..." />
                            </SelectTrigger>
                            <SelectContent>
                              {comprobanteSubido.conceptos.map((c) => (
                                <SelectItem key={c.idConcepto} value={String(c.idConcepto)}>
                                  {c.descripcion} — {formatCurrency(c.importePendiente)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className={esCfdi ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
                        {esCfdi && (
                          <div className="space-y-1">
                            <Label className="text-[10px]">Cantidad</Label>
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              className="h-7 text-xs"
                              value={asig.cantidad}
                              onChange={(e) =>
                                setAsignaciones((prev) =>
                                  prev.map((a, idx) => (idx === i ? { ...a, cantidad: e.target.value } : a))
                                )
                              }
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-[10px]">Importe</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="h-7 text-xs"
                            value={asig.importe}
                            onChange={(e) =>
                              setAsignaciones((prev) =>
                                prev.map((a, idx) => (idx === i ? { ...a, importe: e.target.value } : a))
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">Notas <span className="text-muted-foreground">(opcional)</span></Label>
                        <Input
                          className="h-7 text-xs"
                          value={asig.notas}
                          onChange={(e) =>
                            setAsignaciones((prev) =>
                              prev.map((a, idx) => (idx === i ? { ...a, notas: e.target.value } : a))
                            )
                          }
                          placeholder="Opcional"
                        />
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
