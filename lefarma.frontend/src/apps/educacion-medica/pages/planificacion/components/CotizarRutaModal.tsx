import { useState } from 'react';
import { Plane } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { diaSemana, fechaCorta } from '../rutasUtils';
import type { Asignacion } from '../../../types/educacionMedica.types';

interface CotizarRutaModalProps {
  ruta: { idRuta: number; nombre: string; visitas: Asignacion[] };
  onClose: () => void;
}

const horasDe = (visita: Asignacion) => {
  const salida = visita.horaSalida ? visita.horaSalida.slice(0, 5) : null;
  const llegada = visita.horaLlegada ? visita.horaLlegada.slice(0, 5) : null;
  if (salida && llegada) return `${salida}–${llegada}`;
  return salida ?? llegada ?? 'Sin hora';
};

/**
 * Selección visual de destinos de una ruta para el futuro handoff a viáticos.
 * Por ahora solo muestra el resumen y el toast; no envía nada.
 */
export function CotizarRutaModal({ ruta, onClose }: CotizarRutaModalProps) {
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(
    () => new Set(ruta.visitas.map((visita) => visita.idRutaVisita))
  );

  const todas = seleccionadas.size === ruta.visitas.length && ruta.visitas.length > 0;
  const algunas = seleccionadas.size > 0 && !todas;

  const alternar = (id: number) => {
    setSeleccionadas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const alternarTodas = () => {
    setSeleccionadas(
      todas ? new Set() : new Set(ruta.visitas.map((visita) => visita.idRutaVisita))
    );
  };

  const cotizar = () => {
    const total = seleccionadas.size;
    toast.info(
      total === ruta.visitas.length
        ? `Próximamente: se enviará toda la ruta ${ruta.nombre} (${total} destinos) a la cotización de viáticos.`
        : `Próximamente: se enviarán ${total} de ${ruta.visitas.length} destinos de ${ruta.nombre} a la cotización de viáticos.`
    );
    onClose();
  };

  return (
    <Modal
      id="modal-cotizar-ruta"
      open
      setOpen={(abierto) => {
        if (!abierto) onClose();
      }}
      title={`Cotizar viáticos — ${ruta.nombre}`}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={cotizar} disabled={seleccionadas.size === 0}>
            <Plane className="mr-1.5 h-4 w-4" />
            Cotizar {seleccionadas.size} destino{seleccionadas.size === 1 ? '' : 's'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {ruta.visitas.length} destinos en la ruta. Elige todos o solo los que quieras cotizar.
          </span>
          <Badge variant="outline">Próximamente</Badge>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
          <Checkbox
            checked={todas ? true : algunas ? 'indeterminate' : false}
            onCheckedChange={alternarTodas}
          />
          Seleccionar todos
        </label>

        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {ruta.visitas.map((visita) => (
            <li key={visita.idRutaVisita}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
                <Checkbox
                  checked={seleccionadas.has(visita.idRutaVisita)}
                  onCheckedChange={() => alternar(visita.idRutaVisita)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {visita.nombreHospital ?? 'Hospital'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {diaSemana(visita.fechaVisita)} {fechaCorta(visita.fechaVisita)} ·{' '}
                    {horasDe(visita)}
                    {visita.nombreRegion ? ` · ${visita.nombreRegion}` : ''}
                  </span>
                </span>
                {visita.esExtraordinaria && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-300 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  >
                    Extra
                  </Badge>
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
