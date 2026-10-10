import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileUploader } from '@/components/archivos/FileUploader';
import { archivoService } from '@/services/archivoService';
import { FileImage, Loader2, Pencil, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  GuardarTallerAsistenciaRequest,
  Taller,
  TallerAsistencia,
  TallerDocumentoAsistencia,
  TallerEvidencia,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { AsistenciaPrintDocument } from './AsistenciaPrintDocument';

const MAX_ASISTENTES = 20;

/** Descripción fija de la evidencia que guarda la hoja firmada (foto/escaneo). */
const DESCRIPCION_HOJA = 'Hoja de lista de asistencia firmada';

const aTexto = (valor: string | null | undefined) => valor ?? '';
const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};

interface FormAsistencia {
  numero: string;
  nombreMedico: string;
  cedulaProfesional: string;
  puestoMedico: string;
  telefonoCelular: string;
  correoElectronico: string;
  observaciones: string;
}

const formVacio = (numero: number): FormAsistencia => ({
  numero: String(numero),
  nombreMedico: '',
  cedulaProfesional: '',
  puestoMedico: '',
  telefonoCelular: '',
  correoElectronico: '',
  observaciones: '',
});

const formDe = (asistencia: TallerAsistencia): FormAsistencia => ({
  numero: String(asistencia.numero),
  nombreMedico: asistencia.nombreMedico,
  cedulaProfesional: aTexto(asistencia.cedulaProfesional),
  puestoMedico: aTexto(asistencia.puestoMedico),
  telefonoCelular: aTexto(asistencia.telefonoCelular),
  correoElectronico: aTexto(asistencia.correoElectronico),
  observaciones: aTexto(asistencia.observaciones),
});

interface TallerAsistenciaModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  /** EV/EP del equipo (talleres.puede_capturar) y ventana Programado/EnCurso. */
  puedeCapturar: boolean;
  onChanged: () => void;
}

/** Lista de asistencia (FOR-008): transcripción 1–20 y la hoja firmada como evidencia (ADR-00008). */
export function TallerAsistenciaModal({
  open,
  onClose,
  taller,
  puedeCapturar,
  onChanged,
}: TallerAsistenciaModalProps) {
  const [asistencias, setAsistencias] = useState<TallerAsistencia[]>([]);
  const [evidencias, setEvidencias] = useState<TallerEvidencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<FormAsistencia | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [hojaUploaderOpen, setHojaUploaderOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [documentoPrint, setDocumentoPrint] = useState<TallerDocumentoAsistencia | null>(null);

  const idTaller = taller?.idTaller ?? null;
  const evidenciaHoja =
    evidencias.find((evidencia) => evidencia.descripcion === DESCRIPCION_HOJA) ?? null;
  const enCurso = taller?.estado === 'EnCurso';
  // La hoja firmada es una evidencia del taller: se gestiona En curso (regla del servicio).
  const puedeGestionarHoja = puedeCapturar && enCurso;

  const cargar = useCallback(async () => {
    if (idTaller == null) return;
    setLoading(true);
    try {
      const [resAsistencias, resEvidencias] = await Promise.all([
        educacionMedicaApi.talleres.asistencias(idTaller),
        educacionMedicaApi.talleres.evidencias(idTaller),
      ]);
      if (resAsistencias.data.success) {
        setAsistencias(resAsistencias.data.data ?? []);
      } else {
        toast.error(resAsistencias.data.message ?? 'No se pudo cargar la lista de asistencia');
      }
      if (resEvidencias.data.success) {
        setEvidencias(resEvidencias.data.data ?? []);
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar la lista de asistencia');
    } finally {
      setLoading(false);
    }
  }, [idTaller]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal; la carga ocurre tras el await
      setForm(null);
      setEditandoId(null);
      void cargar();
    }
  }, [open, cargar]);

  const guardar = async () => {
    if (idTaller == null || !form) return;
    if (!form.nombreMedico.trim()) {
      toast.error('El nombre del médico es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const payload: GuardarTallerAsistenciaRequest = {
        numero: Number(form.numero),
        nombreMedico: form.nombreMedico.trim(),
        cedulaProfesional: aTextoONull(form.cedulaProfesional),
        puestoMedico: aTextoONull(form.puestoMedico),
        telefonoCelular: aTextoONull(form.telefonoCelular),
        correoElectronico: aTextoONull(form.correoElectronico),
        observaciones: aTextoONull(form.observaciones),
      };
      const res = editandoId
        ? await educacionMedicaApi.talleres.actualizarAsistencia(idTaller, editandoId, payload)
        : await educacionMedicaApi.talleres.crearAsistencia(idTaller, payload);
      if (res.data.success) {
        toast.success(editandoId ? 'Asistencia actualizada.' : 'Asistencia capturada.');
        setForm(null);
        setEditandoId(null);
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo guardar la asistencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo guardar la asistencia');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (asistencia: TallerAsistencia) => {
    if (idTaller == null) return;
    if (!window.confirm(`¿Eliminar a ${asistencia.nombreMedico} de la lista?`)) return;
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.eliminarAsistencia(idTaller, asistencia.idAsistencia);
      if (res.data.success) {
        toast.success('Asistencia eliminada.');
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo eliminar la asistencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo eliminar la asistencia');
    } finally {
      setGuardando(false);
    }
  };

  const subirHoja = async (archivoId: number) => {
    if (idTaller == null) return;
    setGuardando(true);
    try {
      if (evidenciaHoja) {
        await educacionMedicaApi.talleres.eliminarEvidencia(idTaller, evidenciaHoja.idEvidencia);
      }
      const res = await educacionMedicaApi.talleres.agregarEvidencia(idTaller, {
        tipoEvidencia: 'documento',
        archivoUrl: archivoService.getPreviewUrl(archivoId),
        descripcion: DESCRIPCION_HOJA,
      });
      if (res.data.success) {
        toast.success('Hoja firmada guardada como evidencia del taller.');
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo guardar la hoja firmada');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo guardar la hoja firmada');
    } finally {
      setGuardando(false);
    }
  };

  const quitarHoja = async () => {
    if (idTaller == null || !evidenciaHoja) return;
    if (!window.confirm('¿Quitar la hoja firmada del expediente?')) return;
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.eliminarEvidencia(
        idTaller,
        evidenciaHoja.idEvidencia
      );
      if (res.data.success) {
        toast.success('Hoja firmada eliminada.');
        await cargar();
        onChanged();
      } else {
        toast.error(res.data.message ?? 'No se pudo eliminar la hoja firmada');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo eliminar la hoja firmada');
    } finally {
      setGuardando(false);
    }
  };

  const abrirImpresion = async () => {
    if (idTaller == null) return;
    setDocumentoPrint(null);
    setPrintOpen(true);
    try {
      const res = await educacionMedicaApi.talleres.documentoAsistencia(idTaller);
      if (res.data.success) setDocumentoPrint(res.data.data ?? null);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el documento');
    }
  };

  const completo = asistencias.length >= MAX_ASISTENTES;

  return (
    <>
      <Modal
        id="modal-taller-asistencia"
        open={open}
        setOpen={(o) => {
          if (!o) onClose();
        }}
        title={`Lista de asistencia${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
        size="wide"
        footer={
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => void abrirImpresion()} disabled={loading}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
            {puedeCapturar && !form && (
              <Button
                onClick={() => {
                  setEditandoId(null);
                  setForm(formVacio(asistencias.length + 1));
                }}
                disabled={completo || guardando}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar asistente
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {asistencias.length}/{MAX_ASISTENTES} asistentes
              </Badge>
              <span>
                Transcribe la lista llenada a mano en el taller; adjunta una sola foto/escaneo de
                la hoja firmada (se guarda como evidencia del taller).
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">Hoja firmada (foto/escaneo)</span>
                {evidenciaHoja ? (
                  <a
                    href={evidenciaHoja.archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary underline"
                  >
                    Ver hoja
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin adjuntar</span>
                )}
              </div>
              {puedeGestionarHoja && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHojaUploaderOpen(true)}
                    disabled={guardando}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    {evidenciaHoja ? 'Reemplazar' : 'Subir hoja'}
                  </Button>
                  {evidenciaHoja && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => void quitarHoja()}
                      disabled={guardando}
                      title="Quitar hoja firmada"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {puedeCapturar && !enCurso && (
              <p className="text-xs text-muted-foreground">
                La hoja firmada se adjunta cuando el taller está <strong>En curso</strong>.
              </p>
            )}

            {form && (
              <div className="space-y-3 rounded-md border bg-muted/40 p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>No.</Label>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_ASISTENTES}
                      value={form.numero}
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Nombre del médico *</Label>
                    <Input
                      value={form.nombreMedico}
                      onChange={(e) => setForm({ ...form, nombreMedico: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Cédula profesional</Label>
                    <Input
                      value={form.cedulaProfesional}
                      onChange={(e) => setForm({ ...form, cedulaProfesional: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Puesto</Label>
                    <Input
                      value={form.puestoMedico}
                      onChange={(e) => setForm({ ...form, puestoMedico: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Teléfono celular</Label>
                    <Input
                      value={form.telefonoCelular}
                      onChange={(e) => setForm({ ...form, telefonoCelular: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Correo electrónico</Label>
                    <Input
                      type="email"
                      value={form.correoElectronico}
                      onChange={(e) => setForm({ ...form, correoElectronico: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Observaciones (médico líder +/−)</Label>
                    <Input
                      value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setForm(null);
                      setEditandoId(null);
                    }}
                    disabled={guardando}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={() => void guardar()} disabled={guardando}>
                    {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar'}
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="px-2 py-1.5 text-left">No.</th>
                    <th className="px-2 py-1.5 text-left">Nombre</th>
                    <th className="px-2 py-1.5 text-left">Puesto</th>
                    <th className="px-2 py-1.5 text-left">Contacto</th>
                    {puedeCapturar && <th className="px-2 py-1.5 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {asistencias.length === 0 && (
                    <tr>
                      <td
                        colSpan={puedeCapturar ? 5 : 4}
                        className="px-2 py-4 text-center text-xs text-muted-foreground"
                      >
                        Sin asistentes registrados.
                      </td>
                    </tr>
                  )}
                  {asistencias.map((asistencia) => (
                    <tr key={asistencia.idAsistencia} className="border-t">
                      <td className="px-2 py-1.5 tabular-nums">{asistencia.numero}</td>
                      <td className="px-2 py-1.5">{asistencia.nombreMedico}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {asistencia.puestoMedico ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {[asistencia.telefonoCelular, asistencia.correoElectronico]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      {puedeCapturar && (
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditandoId(asistencia.idAsistencia);
                                setForm(formDe(asistencia));
                              }}
                              disabled={guardando}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => void eliminar(asistencia)}
                              disabled={guardando}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        id="modal-asistencia-hoja"
        open={hojaUploaderOpen}
        setOpen={(o) => {
          if (!o) setHojaUploaderOpen(false);
        }}
        title="Hoja de lista de asistencia firmada (foto/escaneo)"
        size="sm"
      >
        {hojaUploaderOpen && (
          <FileUploader
            entidadTipo="TallerEvidencia"
            entidadId={taller?.idTaller ?? 0}
            carpeta="educacion-medica-evidencias"
            tiposPermitidos={['.jpg', '.jpeg', '.png', '.pdf']}
            multiple={false}
            titulo="Sube la foto o escaneo de la hoja firmada"
            open
            inline
            onUploadComplete={(archivos) => {
              const archivo = archivos[0];
              setHojaUploaderOpen(false);
              if (archivo) void subirHoja(archivo.id);
            }}
            onClose={() => setHojaUploaderOpen(false)}
          />
        )}
      </Modal>

      <AsistenciaPrintDocument
        open={printOpen}
        onOpenChange={setPrintOpen}
        documento={documentoPrint}
      />
    </>
  );
}
