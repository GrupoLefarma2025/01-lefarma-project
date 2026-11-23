import { useState } from 'react';
import BandejaAprobacionesPage from './BandejaAprobacionesPage';
import { ConcentradoViaticosView } from './ConcentradoViaticosView';
import { DetalleSolicitudModal } from './DetalleSolicitudModal';
import type { SolicitudBandeja } from '../../types/aprobaciones.types';

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
