import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { TallerDocumentoAsistencia } from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const CELDA = 'border border-border px-2 py-1.5 text-left align-middle';
const CELDA_ENC = 'border border-border bg-muted px-2 py-1.5 text-center align-middle font-medium';

function ContenidoAsistencia({ documento }: { documento: TallerDocumentoAsistencia }) {
  const { taller, asistencias } = documento;

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1 text-center">
        <h2 className="text-base font-bold uppercase">Registro de Asistencia</h2>
        <p className="text-xs text-muted-foreground">
          Taller Médico en Hospitales — lista de asistentes
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <p>
          <span className="text-muted-foreground">Hospital: </span>
          <span className="font-medium">{taller.nombreHospital ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Fecha: </span>
          <span className="font-medium">{fmtFecha(taller.fechaTaller)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Hora: </span>
          <span className="font-medium">{taller.horaTaller?.slice(0, 5) ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Lugar: </span>
          <span className="font-medium">{taller.lugar ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Especialista: </span>
          <span className="font-medium">{taller.nombreEspecialista ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Tema: </span>
          <span className="font-medium">{taller.unidadMedica ?? '—'}</span>
        </p>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${CELDA_ENC} w-8`}>No.</th>
            <th className={CELDA_ENC}>Nombre</th>
            <th className={CELDA_ENC}>Puesto</th>
            <th className={CELDA_ENC}>Teléfono celular</th>
            <th className={CELDA_ENC}>Correo electrónico</th>
            <th className={`${CELDA_ENC} w-24`}>Firma</th>
          </tr>
        </thead>
        <tbody>
          {asistencias.length === 0 && (
            <tr>
              <td className={CELDA} colSpan={6}>
                Sin asistentes registrados.
              </td>
            </tr>
          )}
          {asistencias.map((asistencia) => (
            <tr key={asistencia.idAsistencia}>
              <td className={`${CELDA} text-center tabular-nums`}>{asistencia.numero}</td>
              <td className={CELDA}>{asistencia.nombreMedico}</td>
              <td className={CELDA}>{asistencia.puestoMedico ?? '—'}</td>
              <td className={CELDA}>{asistencia.telefonoCelular ?? '—'}</td>
              <td className={CELDA}>{asistencia.correoElectronico ?? '—'}</td>
              <td className={`${CELDA} text-center`}>
                <div className="h-8" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="pt-2 text-xs text-muted-foreground">
        Total de asistentes: <span className="font-semibold">{asistencias.length}</span> / 20
      </p>
    </div>
  );
}

interface AsistenciaPrintDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: TallerDocumentoAsistencia | null;
}

/** Vista de impresión de la lista de asistencia (FOR-008) pre-llenada. */
export function AsistenciaPrintDocument({
  open,
  onOpenChange,
  documento,
}: AsistenciaPrintDocumentProps) {
  const imprimir = () => window.print();

  return (
    <>
      <Modal
        id="modal-asistencia-print"
        open={open}
        setOpen={onOpenChange}
        title="Vista de impresión — Registro de asistencia"
        size="wide"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button onClick={imprimir} disabled={!documento}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        }
      >
        {documento ? (
          <ContenidoAsistencia documento={documento} />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando documento...</p>
        )}
      </Modal>

      {documento &&
        createPortal(
          <div id="asistencia-print" className="hidden print:block">
            <ContenidoAsistencia documento={documento} />
          </div>,
          document.body
        )}
    </>
  );
}
