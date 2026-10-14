import { useState } from 'react';
import BandejaAprobacionesPage from './BandejaAprobacionesPage';
import { ConcentradoViaticosView } from './ConcentradoViaticosView';
import { DetalleSolicitudModal } from './DetalleSolicitudModal';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';

/**
 * Punto de montaje de T14: la bandeja con el visor de opciones conectado.
 *
 * `BandejaAprobacionesPage` ya acepta `onVerOpciones` y, sin él, cae a un
 * Dialog placeholder. Este host solo guarda qué fila se está viendo y monta el
 * modal, de modo que cablearlo en la ruta es sustituir un elemento:
 *
 *   <BandejaAprobacionesConDetalle />
 *
 * No se controla la fila por selección ni por permisos: el backend ya
 * responde 403 a quien no es el dueño y no tiene `viaticos.ver_todos`, y ese
 * error se muestra dentro del modal (ver DetalleSolicitudModal).
 *
 * Tambien monta el concentrado FOR-008 (`ConcentradoViaticosView`), que hasta
 * ahora era un componente huerfano: consulta su propia bandeja autorizada y la
 * imprime. No comparte el estado de la lista a proposito (el concentrado es un
 * documento contable del periodo, no la vista filtrada del admin).
 */
export function BandejaAprobacionesConDetalle() {
  const [viendo, setViendo] = useState<SolicitudBandeja | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <ConcentradoViaticosView />
      </div>
      <BandejaAprobacionesPage onVerOpciones={(solicitud) => setViendo(solicitud)} />
      <DetalleSolicitudModal
        solicitud={viendo}
        abierta={viendo !== null}
        onCerrar={() => setViendo(null)}
      />
    </>
  );
}

export default BandejaAprobacionesConDetalle;
