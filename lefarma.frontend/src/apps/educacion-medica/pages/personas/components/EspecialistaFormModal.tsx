import { useMemo, useState } from 'react';
import { Loader2, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UsuarioSearchSelect } from '@/apps/educacion-medica/components/UsuarioSearchSelect';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  EspecialistaPersona,
  Region,
  TipoGerencia,
  UsuarioCatalogo,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';

const SIN_REGION = 'sin-region';

interface EspecialistaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  especialista: EspecialistaPersona | null;
  usuarios: UsuarioCatalogo[];
  gerencias: TipoGerencia[];
  regiones: Region[];
  especialistas: EspecialistaPersona[];
  onSaved: () => void;
}

export function EspecialistaFormModal({
  open,
  onOpenChange,
  especialista,
  usuarios,
  gerencias,
  regiones,
  especialistas,
  onSaved,
}: EspecialistaFormModalProps) {
  const [idUsuario, setIdUsuario] = useState<number | null>(
    especialista?.idUsuario ?? null
  );
  const [idsGerencias, setIdsGerencias] = useState<string[]>(
    especialista?.gerencias
      .filter((gerencia) => gerencia.activo)
      .map((gerencia) => String(gerencia.idTipoGerencia)) ?? []
  );
  const [idRegion, setIdRegion] = useState<number | null>(
    especialista?.regionPreferida?.idRegionCatalogo ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesGerencias = useMemo(
    () =>
      gerencias.map((gerencia) => ({
        value: String(gerencia.idTipoGerencia),
        label: gerencia.descripcion,
      })),
    [gerencias]
  );

  const seleccionarUsuario = (id: number | null) => {
    setIdUsuario(id);
    const existente = especialistas.find((persona) => persona.idUsuario === id);
    if (!existente) return;
    setIdsGerencias(
      existente.gerencias
        .filter((gerencia) => gerencia.activo)
        .map((gerencia) => String(gerencia.idTipoGerencia))
    );
    setIdRegion(existente.regionPreferida?.idRegionCatalogo ?? null);
  };

  const guardar = async () => {
    if (!idUsuario || idsGerencias.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const response = await educacionMedicaApi.personas.especialistas.save(idUsuario, {
        idUsuario,
        idsTipoGerencia: idsGerencias.map(Number),
        idRegionCatalogo: idRegion,
      });
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo guardar el especialista.');
      }
      toast.success('Especialista guardado.');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo guardar el especialista.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="personas-especialista-form"
      open={open}
      setOpen={onOpenChange}
      title={especialista ? 'Editar especialista' : 'Nuevo especialista'}
      subtitle="Define las gerencias que puede atender y, opcionalmente, su región preferida."
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void guardar()}
            disabled={!idUsuario || idsGerencias.length === 0 || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {especialista ? 'Guardar cambios' : 'Guardar especialista'}
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
            onChange={seleccionarUsuario}
            placeholder="Buscar especialista de producto..."
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            La elegibilidad se define por gerencia; la región es solo una preferencia para sugerencias.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Gerencias permitidas</Label>
          <MultiSelect
            options={opcionesGerencias}
            value={idsGerencias}
            onChange={setIdsGerencias}
            placeholder="Selecciona una o más gerencias..."
            searchPlaceholder="Buscar gerencia..."
          />
          <p className="text-xs text-muted-foreground">
            Selecciona al menos una. Si no tiene filas, se considera no elegible.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Región preferida (opcional)</Label>
          <Select
            value={idRegion ? String(idRegion) : SIN_REGION}
            onValueChange={(value) => setIdRegion(value === SIN_REGION ? null : Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_REGION}>
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  Sin preferencia
                </span>
              </SelectItem>
              {regiones.map((region) => (
                <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {region.nombre}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
