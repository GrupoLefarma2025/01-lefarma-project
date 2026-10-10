import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import {
  CatalogoSearchSelect,
  type CatalogoItem,
} from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import type {
  EquipoPareo,
  Hospital,
  VisitaExtraordinariaRequest,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface VisitaExtraordinariaModalProps {
  open: boolean;
  onClose: () => void;
  idSeleccionMensual: number;
  onCreated: (avisos: string[]) => void;
}

/**
 * Alta de visita extraordinaria (ADR-00011): hospital del catálogo (FOR-002) fuera de
 * la selección, equipo explícito (get-or-create de su ruta), fecha y motivo obligatorio.
 */
export function VisitaExtraordinariaModal({
  open,
  onClose,
  idSeleccionMensual,
  onCreated,
}: VisitaExtraordinariaModalProps) {
  const [equipos, setEquipos] = useState<EquipoPareo[]>([]);
  const [hospitales, setHospitales] = useState<Hospital[]>([]);
  const [idEquipo, setIdEquipo] = useState<number | null>(null);
  const [idHospital, setIdHospital] = useState<number | null>(null);
  const [fechaVisita, setFechaVisita] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal
    setIdEquipo(null);
    setIdHospital(null);
    setFechaVisita('');
    setMotivo('');

    educacionMedicaApi.equiposPareo
      .getAll({ soloVigentes: true })
      .then((res) => {
        if (res.data.success) setEquipos(res.data.data ?? []);
      })
      .catch(() => setEquipos([]));

    educacionMedicaApi.hospitales
      .getAll({ activo: true, pageSize: 500, orderBy: 'nombreContacto' })
      .then((res) => {
        if (res.data.success) setHospitales(res.data.data?.items ?? []);
      })
      .catch(() => setHospitales([]));
  }, [open]);

  const itemsEquipos = useMemo<CatalogoItem[]>(
    () =>
      equipos.map((e) => ({
        id: e.idEquipo,
        label: `${e.nombreEjecutivo} + ${e.nombreEspecialista}`,
        description: e.nombreRegion ?? undefined,
      })),
    [equipos]
  );

  const itemsHospitales = useMemo<CatalogoItem[]>(
    () =>
      hospitales.map((h) => ({
        id: h.codigoContacto,
        label: h.nombreContacto,
        description: [h.ciudad, h.clues].filter(Boolean).join(' · ') || undefined,
      })),
    [hospitales]
  );

  const guardar = async () => {
    if (idEquipo == null) {
      toast.error('Selecciona el equipo.');
      return;
    }
    if (idHospital == null) {
      toast.error('Selecciona el hospital del catálogo.');
      return;
    }
    if (!fechaVisita) {
      toast.error('Selecciona la fecha de la visita.');
      return;
    }
    if (motivo.trim().length < 5) {
      toast.error('El motivo de la visita extraordinaria es obligatorio.');
      return;
    }

    const payload: VisitaExtraordinariaRequest = {
      idEquipo,
      idHospital,
      fechaVisita,
      motivo: motivo.trim(),
    };

    setGuardando(true);
    try {
      const res = await educacionMedicaApi.rutas.agregarVisitaExtraordinaria(
        idSeleccionMensual,
        payload
      );
      if (res.data.success) {
        toast.success('Visita extraordinaria agregada.');
        onCreated(res.data.data?.avisos ?? []);
        onClose();
      } else {
        toast.error(res.data.message ?? 'No se pudo agregar la visita extraordinaria');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo agregar la visita extraordinaria');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      id="modal-visita-extraordinaria"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title="Visita extraordinaria (ADR-00011)"
      size="sm"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Agregando...' : 'Agregar visita'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Hospital del catálogo fuera de la selección autorizada. Se agrega a la ruta del
          equipo en la versión Cerrada (get-or-create) y queda auditado.
        </p>
        <div className="space-y-1">
          <Label>Equipo *</Label>
          <CatalogoSearchSelect
            items={itemsEquipos}
            value={idEquipo}
            onChange={setIdEquipo}
            placeholder="Buscar equipo..."
          />
        </div>
        <div className="space-y-1">
          <Label>Hospital del catálogo *</Label>
          <CatalogoSearchSelect
            items={itemsHospitales}
            value={idHospital}
            onChange={setIdHospital}
            placeholder="Buscar hospital..."
          />
        </div>
        <div className="space-y-1">
          <Label>Fecha de la visita *</Label>
          <Input
            type="date"
            value={fechaVisita}
            onChange={(e) => setFechaVisita(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Solo días laborales (Lun–Vie).</p>
        </div>
        <div className="space-y-1">
          <Label>Motivo *</Label>
          <Textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Imprevisto que origina la visita"
          />
        </div>
      </div>
    </Modal>
  );
}
