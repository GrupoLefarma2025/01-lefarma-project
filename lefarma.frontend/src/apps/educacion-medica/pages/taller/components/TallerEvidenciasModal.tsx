import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUploader } from '@/components/archivos/FileUploader';
import { archivoService } from '@/services/archivoService';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { Taller, TallerEvidencia } from '@/apps/educacion-medica/types/educacionMedica.types';

const TIPOS = [
  { value: 'foto', label: 'Foto' },
  { value: 'video', label: 'Video' },
  { value: 'documento', label: 'Documento' },
];

const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};

interface TallerEvidenciasModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  /** EV/EP del equipo (evidencias.puede_gestionar); solo con el taller En curso. */
  puedeGestionar: boolean;
  onChanged: () => void;
}

/** Evidencias del taller (fotos/video/documentos): se capturan desde En curso (ADR-00008). */
export function TallerEvidenciasModal({
  open,
  onClose,
  taller,
  puedeGestionar,
  onChanged,
}: TallerEvidenciasModalProps) {
  const [evidencias, setEvidencias] = useState<TallerEvidencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState('foto');
  const [descripcion, setDescripcion] = useState('');
  const [archivoUrl, setArchivoUrl] = useState('');

  const idTaller = taller?.idTaller ?? null;
  const enCurso = taller?.estado === 'EnCurso';

  const cargar = useCallback(async () => {
    if (idTaller == null) return;
    setLoading(true);
    try {
      const res = await educacionMedicaApi.talleres.evidencias(idTaller);
      if (res.data.success) {
        setEvidencias(res.data.data ?? []);
      } else {
        toast.error(res.data.message ?? 'No se pudieron cargar las evidencias');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudieron cargar las evidencias');
    } finally {
      setLoading(false);
    }
  }, [idTaller]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal; la carga ocurre tras el await
      setFormOpen(false);
      setArchivoUrl('');
      setDescripcion('');
      setTipo('foto');
      void cargar();
    }
  }, [open, cargar]);

  const agregar = async () => {
    if (idTaller == null) return;
    if (!archivoUrl) {
      toast.error('Sube el archivo de la evidencia.');
      return;
    }
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.agregarEvidencia(idTaller, {
        tipoEvidencia: tipo,
        archivoUrl,
        descripcion: aTextoONull(descripcion),
      });
      if (res.data.success) {
        toast.success('Evidencia agregada.');
        setFormOpen(false);
        setArchivoUrl('');
        setDescripcion('');
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo agregar la evidencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo agregar la evidencia');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (evidencia: TallerEvidencia) => {
    if (idTaller == null) return;
    if (!window.confirm('¿Eliminar esta evidencia?')) return;
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.eliminarEvidencia(idTaller, evidencia.idEvidencia);
      if (res.data.success) {
        toast.success('Evidencia eliminada.');
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo eliminar la evidencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo eliminar la evidencia');
    } finally {
      setGuardando(false);
    }
  };

  const capturar = puedeGestionar && enCurso;

  return (
    <Modal
      id="modal-taller-evidencias"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Evidencias del taller${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
      size="wide"
      footer={
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {capturar && !formOpen && (
            <Button onClick={() => setFormOpen(true)} disabled={guardando}>
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar evidencia
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
          {!enCurso && (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Las evidencias se capturan mientras el taller está <strong>En curso</strong> (estado
              actual: {taller?.estado ?? '—'}).
            </p>
          )}

          {formOpen && capturar && (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipo de evidencia</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <Input
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Sala llena, entrega de material..."
                  />
                </div>
              </div>
              <FileUploader
                entidadTipo="TallerEvidencia"
                entidadId={taller?.idTaller ?? 0}
                carpeta="educacion-medica-evidencias"
                tiposPermitidos={['.jpg', '.jpeg', '.png', '.mp4', '.pdf']}
                multiple={false}
                titulo="Sube la evidencia (foto, video o documento)"
                open
                inline
                onUploadComplete={(archivos) => {
                  const archivo = archivos[0];
                  if (archivo) setArchivoUrl(archivoService.getPreviewUrl(archivo.id));
                }}
                onClose={() => undefined}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFormOpen(false);
                    setArchivoUrl('');
                  }}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
                <Button onClick={() => void agregar()} disabled={guardando || !archivoUrl}>
                  {guardando ? 'Guardando...' : 'Agregar'}
                </Button>
              </div>
            </div>
          )}

          {evidencias.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Sin evidencias registradas.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {evidencias.map((evidencia) => (
                <div key={evidencia.idEvidencia} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize">{evidencia.tipoEvidencia}</p>
                    <div className="flex items-center gap-1">
                      <Button asChild size="icon" variant="outline" className="h-7 w-7">
                        <a
                          href={evidencia.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      {capturar && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => void eliminar(evidencia)}
                          disabled={guardando}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {evidencia.tipoEvidencia === 'foto' && (
                    <img
                      src={evidencia.archivoUrl}
                      alt={evidencia.descripcion ?? 'Evidencia'}
                      className="h-32 w-full rounded object-cover"
                    />
                  )}
                  {evidencia.descripcion && (
                    <p className="text-xs text-muted-foreground">{evidencia.descripcion}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {evidencia.fechaEvidencia
                      ? new Date(`${evidencia.fechaEvidencia}T00:00:00`).toLocaleDateString('es-MX')
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
