import { useMemo, useState } from 'react';
import { Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UsuarioSearchSelect } from '@/apps/educacion-medica/components/UsuarioSearchSelect';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  EjecutivoRegion,
  Region,
  TipoGerencia,
  UsuarioCatalogo,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';

interface EjecutivoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ejecutivo: EjecutivoRegion | null;
  usuarios: UsuarioCatalogo[];
  gerencias: TipoGerencia[];
  regiones: Region[];
  ejecutivos: EjecutivoRegion[];
  onSaved: () => void;
}

export function EjecutivoFormModal({
  open,
  onOpenChange,
  ejecutivo,
  usuarios,
  gerencias,
  regiones,
  ejecutivos,
  onSaved,
}: EjecutivoFormModalProps) {
  const [idUsuario, setIdUsuario] = useState<number | null>(ejecutivo?.idUsuario ?? null);
  const [idRegion, setIdRegion] = useState<number | null>(
    ejecutivo?.idRegionCatalogo ?? null
  );
  const [activo, setActivo] = useState(ejecutivo?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regionSeleccionada = useMemo(
    () => regiones.find((region) => region.idRegion === idRegion) ?? null,
    [regiones, idRegion]
  );

  const gerenciaSeleccionada = useMemo(
    () => gerencias.find((gerencia) => gerencia.idTipoGerencia === regionSeleccionada?.idTipoGerencia),
    [gerencias, regionSeleccionada]
  );

  const regionesDelUsuario = useMemo(
    () =>
      ejecutivos.filter(
        (fila) =>
          fila.activo &&
          fila.idUsuario === idUsuario &&
          fila.idEjecutivoRegion !== ejecutivo?.idEjecutivoRegion
      ),
    [ejecutivos, idUsuario, ejecutivo]
  );

  const conflictoGerencia = useMemo(() => {
    if (!regionSeleccionada) return null;
    const otra = regionesDelUsuario.find(
      (fila) => fila.idTipoGerencia !== regionSeleccionada.idTipoGerencia
    );
    if (!otra) return null;
    return `Este usuario ya opera ${otra.nombreRegion} en ${otra.nombreGerencia}. Todas sus regiones deben ser de la misma gerencia.`;
  }, [regionesDelUsuario, regionSeleccionada]);

  const puedeGuardar =
    idUsuario !== null && idRegion !== null && !conflictoGerencia && !saving;

  const guardar = async () => {
    if (!idUsuario || !idRegion || conflictoGerencia) return;

    setSaving(true);
    setError(null);
    try {
      if (ejecutivo) {
        const response = await educacionMedicaApi.personas.ejecutivos.update(
          ejecutivo.idEjecutivoRegion,
          { idRegionCatalogo: idRegion, activo }
        );
        if (!response.data.success) {
          throw new Error(response.data.message ?? 'No se pudo actualizar el ejecutivo.');
        }
        toast.success('Ejecutivo actualizado.');
      } else {
        const response = await educacionMedicaApi.personas.ejecutivos.create({
          idUsuario,
          idRegionCatalogo: idRegion,
        });
        if (!response.data.success) {
          throw new Error(response.data.message ?? 'No se pudo crear el ejecutivo.');
        }
        toast.success('Región asignada al ejecutivo.');
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo guardar el ejecutivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="personas-ejecutivo-form"
      open={open}
      setOpen={onOpenChange}
      title={ejecutivo ? 'Editar ejecutivo' : 'Nuevo ejecutivo'}
      subtitle="Un ejecutivo puede cubrir una o más regiones de la misma gerencia."
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!puedeGuardar}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ejecutivo ? 'Guardar cambios' : 'Asignar región'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Persona</Label>
          <UsuarioSearchSelect
            usuarios={usuarios}
            value={idUsuario}
            onChange={setIdUsuario}
            placeholder="Buscar ejecutivo de ventas..."
            disabled={Boolean(ejecutivo)}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            El ejecutivo es el dueño comercial de la región dentro de la selección mensual.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Región</Label>
          <Select
            value={idRegion ? String(idRegion) : ''}
            onValueChange={(value) => setIdRegion(Number(value))}
            disabled={idUsuario === null}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una región..." />
            </SelectTrigger>
            <SelectContent>
              {regiones.map((region) => (
                <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {region.nombre}
                    {region.nombreGerencia ? (
                      <span className="text-muted-foreground">· {region.nombreGerencia}</span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {regionSeleccionada && (
          <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/20">
            <div className="flex items-center gap-2 text-sm text-sky-900 dark:text-sky-100">
              <ShieldCheck className="h-4 w-4" />
              Gerencia derivada
            </div>
            <Badge variant="outline" className="border-sky-200 bg-white/70 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
              {gerenciaSeleccionada?.descripcion ?? 'Sin gerencia'}
            </Badge>
          </div>
        )}

        {ejecutivo && (
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Estado</p>
              <p className="text-xs text-muted-foreground">
                Inactivo deja de aparecer como candidato.
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </div>
        )}

        {(conflictoGerencia || error) && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {conflictoGerencia ?? error}
          </p>
        )}
      </div>
    </Modal>
  );
}
