import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ESTADO_ENVIADA, VARIANTE_POR_ESTADO, estadoTexto, type SolicitudBandeja } from '../types/aprobaciones.types';

const MONEDA = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

interface AprobacionesBandejaTableProps {
  solicitudes: SolicitudBandeja[];
  puedeAutorizar: boolean;
  autorizandoId: number | null;
  onAutorizar: (solicitud: SolicitudBandeja) => void;
  onVerOpciones: (solicitud: SolicitudBandeja) => void;
}

export function AprobacionesBandejaTable({
  solicitudes,
  puedeAutorizar,
  autorizandoId,
  onAutorizar,
  onVerOpciones,
}: AprobacionesBandejaTableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">No.</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Periodo</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {solicitudes.map((solicitud) => {
            const pendientes = solicitud.precios_pendientes ?? 0;
            const autorizable = solicitud.estado === ESTADO_ENVIADA && pendientes === 0;
            const autorizando = autorizandoId === solicitud.id_solicitud;
            return (
              <TableRow key={solicitud.id_solicitud}>
                <TableCell className="text-sm text-muted-foreground">
                  {solicitud.id_solicitud}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {solicitud.nombre_solicitante || '—'}
                </TableCell>
                <TableCell className="text-sm">{solicitud.periodo || '—'}</TableCell>
                <TableCell className="text-sm">{solicitud.destino ?? '—'}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  <div className="flex flex-col items-end gap-0.5">
                    {(() => {
                      const tieneSplit =
                        solicitud.total_cotizado !== undefined || solicitud.total_estimado !== undefined;
                      const principal = tieneSplit ? solicitud.total_cotizado ?? null : solicitud.total;
                      return (
                        <span>
                          {principal === null
                            ? tieneSplit
                              ? 'Por cotizar'
                              : '—'
                            : MONEDA.format(principal)}
                        </span>
                      );
                    })()}
                    {typeof solicitud.total_estimado === 'number' && solicitud.total_estimado > 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        ref. {MONEDA.format(solicitud.total_estimado)}
                      </span>
                    ) : null}
                    {pendientes > 0 ? (
                      <Badge variant="secondary" className="whitespace-nowrap font-normal">
                        Precio pendiente
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={VARIANTE_POR_ESTADO[solicitud.estado] ?? 'secondary'}
                    className="whitespace-nowrap"
                  >
                    {estadoTexto(solicitud.estado)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {puedeAutorizar && (
                      <Button
                        size="sm"
                        onClick={() => onAutorizar(solicitud)}
                        disabled={!autorizable || autorizando}
                        title={
                          autorizable
                            ? `Autorizar la solicitud ${solicitud.id_solicitud}`
                            : pendientes > 0
                              ? `Faltan precios reales de ${pendientes} vuelo${pendientes === 1 ? '' : 's'}. Captúralos antes de autorizar.`
                              : `Solo se autorizan solicitudes en estado 'enviada' (esta está en '${solicitud.estado}')`
                        }
                      >
                        {autorizando ? 'Autorizando...' : 'Autorizar'}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onVerOpciones(solicitud)}>
                      Ver opciones
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}