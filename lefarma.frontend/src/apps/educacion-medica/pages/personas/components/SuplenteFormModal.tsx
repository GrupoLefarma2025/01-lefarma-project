import { useMemo, useState } from 'react';
import { Building2, Globe2, Loader2, MapPin, Sparkles } from 'lucide-react';
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
  EjecutivoSuplente,
  Region,
  TipoGerencia,
  UsuarioCatalogo,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';

const TODAS = 'todas';

interface SuplenteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suplente: EjecutivoSuplente | null;
  usuarios: UsuarioCatalogo[];
  gerencias: TipoGerencia[];
  regiones: Region[];
  onSaved: () => void;
}

export function SuplenteFormModal({
  open,
  onOpenChange,
  suplente,
  usuarios,
  gerencias,
  regiones,
  onSaved,
}: SuplenteFormModalProps) {
  const [idUsuario, setIdUsuario] = useState<number | null>(suplente?.idUsuario ?? null);
  const [idGerencia, setIdGerencia] = useState<number | null>(
    suplente?.idTipoGerencia ?? null
  );
  const [idRegion, setIdRegion] = useState<number | null>(
    suplente?.idRegionCatalogo ?? null
  );
  const [activo, setActivo] = useState(suplente?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regionesDisponibles = useMemo(
    () =>
      idGerencia
        ? regiones.filter((region) => region.idTipoGerencia === idGerencia)
        : regiones,
    [regiones, idGerencia]
  );

  const regionSeleccionada = useMemo(
    () => regiones.find((region) => region.idRegion === idRegion) ?? null,
    [regiones, idRegion]
  );

  const cobertura = useMemo(() => {
    if (idRegion && regionSeleccionada) {
      return `${regionSeleccionada.nombre} · ${regionSeleccionada.nombreGerencia ?? 'Gerencia'}`;
    }
    if (idGerencia) {
      const gerencia = gerencias.find((item) => item.idTipoGerencia === idGerencia);
      return `${gerencia?.descripcion ?? 'Gerencia'} · Todas las regiones`;
    }
    return 'Cobertura total · Todas las gerencias y regiones';
  }, [idRegion, idGerencia, regionSeleccionada, gerencias]);

  const cambiarGerencia = (value: string) => {
    const nueva = value === TODAS ? null : Number(value);
    setIdGerencia(nueva);

    if (nueva && regionSeleccionada && regionSeleccionada.idTipoGerencia !== nueva) {
      setIdRegion(null);
    }
  };

  const cambiarRegion = (value: string) => {
    if (value === TODAS) {
      setIdRegion(null);
      return;
    }

    const region = regiones.find((item) => item.idRegion === Number(value));
    setIdRegion(region?.idRegion ?? null);
    if (region) {
      setIdGerencia(region.idTipoGerencia);
    }
  };

  const guardar = async () => {
    if (!idUsuario) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        idTipoGerencia: idGerencia,
        idRegionCatalogo: idRegion,
        activo,
      };

      if (suplente) {
        const response = await educacionMedicaApi.personas.suplentes.update(
          suplente.idEjecutivoSuplente,
          payload
        );
        if (!response.data.success) {
          throw new Error(response.data.message ?? 'No se pudo actualizar el suplente.');
        }
        toast.success('Ejecutivo suplente actualizado.');
      } else {
        const response = await educacionMedicaApi.personas.suplentes.create({
          idUsuario,
          ...payload,
        });
        if (!response.data.success) {
          throw new Error(response.data.message ?? 'No se pudo crear el suplente.');
        }
        toast.success('Ejecutivo suplente agregado.');
      }

      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo guardar el suplente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="personas-suplente-form"
      open={open}
      setOpen={onOpenChange}
      title={suplente ? 'Editar ejecutivo suplente' : 'Nuevo ejecutivo suplente'}
      subtitle="Cubre regiones sin ejecutivo primario. Nunca es la primera sugerencia."
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={!idUsuario || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {suplente ? 'Guardar cambios' : 'Agregar suplente'}
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
            placeholder="Buscar usuario suplente..."
            disabled={Boolean(suplente)}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Puede ser un coordinador o un ejecutivo que cubre varias gerencias.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Gerencia</Label>
            <Select value={idGerencia ? String(idGerencia) : TODAS} onValueChange={cambiarGerencia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Todas las gerencias
                  </span>
                </SelectItem>
                {gerencias.map((gerencia) => (
                  <SelectItem
                    key={gerencia.idTipoGerencia}
                    value={String(gerencia.idTipoGerencia)}
                  >
                    {gerencia.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Región</Label>
            <Select value={idRegion ? String(idRegion) : TODAS} onValueChange={cambiarRegion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>
                  <span className="flex items-center gap-2">
                    <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Todas las regiones
                  </span>
                </SelectItem>
                {regionesDisponibles.map((region) => (
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
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Cobertura configurada
          </div>
          <p className="mt-1 text-sm font-medium text-violet-950 dark:text-violet-50">{cobertura}</p>
        </div>

        {suplente && (
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Estado</p>
              <p className="text-xs text-muted-foreground">
                Inactivo deja de usarse en cierres y sugerencias.
              </p>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
