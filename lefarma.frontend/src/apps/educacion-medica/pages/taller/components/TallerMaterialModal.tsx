import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BadgeCheck, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  GuardarTallerMaterialRequest,
  Taller,
  TallerDocumentoMaterial,
  TallerMaterial,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { MaterialPrintDocument } from './MaterialPrintDocument';

const aTexto = (valor: string | number | null | undefined) =>
  valor == null ? '' : String(valor);
const aNumero = (valor: string): number | null => {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};
const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};

const CHECKLIST: { campo: keyof GuardarTallerMaterialRequest; etiqueta: string }[] = [
  { campo: 'incluyeListaAsistencia', etiqueta: 'Lista de asistencia' },
  { campo: 'incluyeFlayers', etiqueta: 'Flayers' },
  { campo: 'incluyeEquipoComputo', etiqueta: 'Equipo de cómputo' },
  { campo: 'incluyeProyector', etiqueta: 'Proyector' },
  { campo: 'incluyeDulces', etiqueta: 'Dulces' },
  { campo: 'incluyeModeloAnatomico', etiqueta: 'Modelo anatómico' },
];

interface TallerMaterialModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  /** AEM: registra/edita la entrega (materiales.puede_gestionar). */
  puedeGestionar: boolean;
  /** EV: confirma la recepción con su firma digital (materiales.puede_confirmar). */
  puedeConfirmar: boolean;
  onChanged: () => void;
}

/** Material del taller (FOR-007): entrega del AEM y confirmación del EV (ADR-00008). */
export function TallerMaterialModal({
  open,
  onClose,
  taller,
  puedeGestionar,
  puedeConfirmar,
  onChanged,
}: TallerMaterialModalProps) {
  const [material, setMaterial] = useState<TallerMaterial | null>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [documentoPrint, setDocumentoPrint] = useState<TallerDocumentoMaterial | null>(null);

  const [fechaEntrega, setFechaEntrega] = useState('');
  const [cargoPuesto, setCargoPuesto] = useState('');
  const [nombreProducto, setNombreProducto] = useState('');
  const [cantidadProducto, setCantidadProducto] = useState('');
  const [nombreEjecutivoRecepcion, setNombreEjecutivoRecepcion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const idTaller = taller?.idTaller ?? null;

  const cargar = useCallback(async () => {
    if (idTaller == null) return;
    setLoading(true);
    try {
      const res = await educacionMedicaApi.talleres.material(idTaller);
      if (res.data.success) {
        const m = res.data.data ?? null;
        setMaterial(m);
        setFechaEntrega(m?.fechaEntrega?.slice(0, 10) ?? '');
        setCargoPuesto(aTexto(m?.cargoPuesto));
        setNombreProducto(aTexto(m?.nombreProducto));
        setCantidadProducto(aTexto(m?.cantidadProducto));
        setNombreEjecutivoRecepcion(aTexto(m?.nombreEjecutivoRecepcion));
        setObservaciones(aTexto(m?.observaciones));
        setChecklist({
          incluyeListaAsistencia: m?.incluyeListaAsistencia ?? false,
          incluyeFlayers: m?.incluyeFlayers ?? false,
          incluyeEquipoComputo: m?.incluyeEquipoComputo ?? false,
          incluyeProyector: m?.incluyeProyector ?? false,
          incluyeDulces: m?.incluyeDulces ?? false,
          incluyeModeloAnatomico: m?.incluyeModeloAnatomico ?? false,
        });
      } else {
        toast.error(res.data.message ?? 'No se pudo cargar el material');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el material');
    } finally {
      setLoading(false);
    }
  }, [idTaller]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el modal; los setState ocurren tras el await
    if (open) void cargar();
  }, [open, cargar]);

  const confirmado = material?.confirmado === true;
  const soloLectura = !puedeGestionar || confirmado;

  const guardar = async () => {
    if (idTaller == null) return;
    setGuardando(true);
    try {
      const payload: GuardarTallerMaterialRequest = {
        fechaEntrega: aTextoONull(fechaEntrega),
        cargoPuesto: aTextoONull(cargoPuesto),
        nombreProducto: aTextoONull(nombreProducto),
        cantidadProducto: aNumero(cantidadProducto),
        incluyeListaAsistencia: checklist.incluyeListaAsistencia ?? false,
        incluyeFlayers: checklist.incluyeFlayers ?? false,
        incluyeEquipoComputo: checklist.incluyeEquipoComputo ?? false,
        incluyeProyector: checklist.incluyeProyector ?? false,
        incluyeDulces: checklist.incluyeDulces ?? false,
        incluyeModeloAnatomico: checklist.incluyeModeloAnatomico ?? false,
        nombreEjecutivoRecepcion: aTextoONull(nombreEjecutivoRecepcion),
        observaciones: aTextoONull(observaciones),
      };
      const res = await educacionMedicaApi.talleres.guardarMaterial(idTaller, payload);
      if (res.data.success) {
        toast.success('Material guardado.');
        setMaterial(res.data.data ?? null);
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo guardar el material');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo guardar el material');
    } finally {
      setGuardando(false);
    }
  };

  const confirmar = async () => {
    if (idTaller == null) return;
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.confirmarMaterial(idTaller, {
        nombreEjecutivoRecepcion: aTextoONull(nombreEjecutivoRecepcion),
      });
      if (res.data.success) {
        toast.success('Recepción confirmada con tu firma digital.');
        setMaterial(res.data.data ?? null);
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo confirmar la recepción');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo confirmar la recepción');
    } finally {
      setGuardando(false);
    }
  };

  const abrirImpresion = async () => {
    if (idTaller == null) return;
    setDocumentoPrint(null);
    setPrintOpen(true);
    try {
      const res = await educacionMedicaApi.talleres.documentoMaterial(idTaller);
      if (res.data.success) setDocumentoPrint(res.data.data ?? null);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el documento');
    }
  };

  return (
    <>
      <Modal
        id="modal-taller-material"
        open={open}
        setOpen={(o) => {
          if (!o) onClose();
        }}
        title={`Material del taller${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
        size="wide"
        footer={
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => void abrirImpresion()} disabled={loading}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
            {puedeGestionar && !confirmado && (
              <Button variant="secondary" onClick={() => void guardar()} disabled={guardando || loading}>
                {guardando ? 'Guardando...' : 'Guardar entrega'}
              </Button>
            )}
            {puedeConfirmar && !confirmado && (
              <Button onClick={() => void confirmar()} disabled={guardando || loading || !material}>
                <BadgeCheck className="mr-1.5 h-4 w-4" />
                {guardando ? 'Confirmando...' : 'Confirmar recepción'}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={guardando}>
              Cerrar
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {confirmado && material && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/30">
                <Badge className="bg-emerald-600 text-white">Recepción confirmada</Badge>
                <span>
                  {material.nombreUsuarioRecepcion ?? 'EV'} ·{' '}
                  {material.fechaRecepcion
                    ? new Date(material.fechaRecepcion).toLocaleString('es-MX')
                    : ''}
                </span>
                {material.firmaUrl && (
                  <img src={material.firmaUrl} alt="Firma" className="ml-auto h-8 object-contain" />
                )}
              </div>
            )}
            {!confirmado && puedeConfirmar && !material && (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Aún no hay material registrado por el Auxiliar de Educación Médica.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Fecha de entrega</Label>
                <Input
                  type="date"
                  value={fechaEntrega}
                  disabled={soloLectura}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Cargo / puesto</Label>
                <Input
                  value={cargoPuesto}
                  disabled={soloLectura}
                  onChange={(e) => setCargoPuesto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre del producto</Label>
                <Input
                  value={nombreProducto}
                  disabled={soloLectura}
                  onChange={(e) => setNombreProducto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Cantidad de producto</Label>
                <Input
                  type="number"
                  min={0}
                  value={cantidadProducto}
                  disabled={soloLectura}
                  onChange={(e) => setCantidadProducto(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre y firma del ejecutivo que recibe</Label>
                <Input
                  value={nombreEjecutivoRecepcion}
                  disabled={soloLectura}
                  onChange={(e) => setNombreEjecutivoRecepcion(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Checklist del paquete</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {CHECKLIST.map(({ campo, etiqueta }) => (
                  <label
                    key={String(campo)}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checklist[String(campo)] ?? false}
                      disabled={soloLectura}
                      onCheckedChange={(valor) =>
                        setChecklist((prev) => ({ ...prev, [String(campo)]: valor === true }))
                      }
                    />
                    {etiqueta}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                rows={2}
                value={observaciones}
                disabled={soloLectura}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      <MaterialPrintDocument
        open={printOpen}
        onOpenChange={setPrintOpen}
        documento={documentoPrint}
      />
    </>
  );
}
