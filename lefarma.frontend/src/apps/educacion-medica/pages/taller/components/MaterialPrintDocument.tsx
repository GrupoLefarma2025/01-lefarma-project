import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { TallerDocumentoMaterial } from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const siNo = (valor: boolean | null | undefined) => (valor == null ? '—' : valor ? 'Sí' : 'No');

const CELDA = 'border border-border px-2 py-1.5 text-left align-top';

function ContenidoMaterial({ documento }: { documento: TallerDocumentoMaterial }) {
  const { taller, material } = documento;

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1 text-center">
        <h2 className="text-base font-bold uppercase">Material para Talleres Médicos</h2>
        <p className="text-xs text-muted-foreground">
          Acuse de entrega y recepción del paquete de material del taller
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <p>
          <span className="text-muted-foreground">Hospital: </span>
          <span className="font-medium">{taller.nombreHospital ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Fecha del taller: </span>
          <span className="font-medium">{fmtFecha(taller.fechaTaller)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Fecha de entrega: </span>
          <span className="font-medium">{fmtFecha(material?.fechaEntrega)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Unidad médica: </span>
          <span className="font-medium">{taller.unidadMedica ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Ejecutivo de Ventas: </span>
          <span className="font-medium">{taller.nombreEjecutivo ?? '—'}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Especialista: </span>
          <span className="font-medium">{taller.nombreEspecialista ?? '—'}</span>
        </p>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-muted">
            <th className={CELDA}>Cargo / Puesto</th>
            <th className={CELDA}>Nombre del producto</th>
            <th className={CELDA}>Cantidad</th>
            <th className={CELDA}>Lista de asistencia</th>
            <th className={CELDA}>Flayers</th>
            <th className={CELDA}>Equipo de cómputo</th>
            <th className={CELDA}>Proyector</th>
            <th className={CELDA}>Dulces</th>
            <th className={CELDA}>Modelo anatómico</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={CELDA}>{material?.cargoPuesto ?? '—'}</td>
            <td className={CELDA}>{material?.nombreProducto ?? '—'}</td>
            <td className={`${CELDA} text-right tabular-nums`}>{material?.cantidadProducto ?? '—'}</td>
            <td className={CELDA}>{siNo(material?.incluyeListaAsistencia)}</td>
            <td className={CELDA}>{siNo(material?.incluyeFlayers)}</td>
            <td className={CELDA}>{siNo(material?.incluyeEquipoComputo)}</td>
            <td className={CELDA}>{siNo(material?.incluyeProyector)}</td>
            <td className={CELDA}>{siNo(material?.incluyeDulces)}</td>
            <td className={CELDA}>{siNo(material?.incluyeModeloAnatomico)}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-xs">
        <span className="text-muted-foreground">Observaciones: </span>
        {material?.observaciones ?? '—'}
      </p>

      <section className="break-inside-avoid grid gap-6 pt-10 sm:grid-cols-2">
        <div className="border-t border-border pt-2 text-center text-xs">
          <p className="font-semibold">
            {material?.nombreEjecutivoRecepcion ?? taller.nombreEjecutivo ?? '—'}
          </p>
          <p className="text-muted-foreground">Nombre del Ejecutivo que recibe</p>
        </div>
        <div className="border-t border-border pt-2 text-center text-xs">
          {material?.firmaUrl ? (
            <img
              src={material.firmaUrl}
              alt="Firma de recepción"
              className="mx-auto h-12 object-contain"
            />
          ) : (
            <p className="h-12" />
          )}
          <p className="text-muted-foreground">
            Firma de recibido
            {material?.fechaRecepcion
              ? ` · ${new Date(material.fechaRecepcion).toLocaleString('es-MX')}`
              : ' (pendiente)'}
          </p>
        </div>
      </section>
    </div>
  );
}

interface MaterialPrintDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: TallerDocumentoMaterial | null;
}

/** Vista de impresión del acuse de material (FOR-007) pre-llenado. */
export function MaterialPrintDocument({
  open,
  onOpenChange,
  documento,
}: MaterialPrintDocumentProps) {
  const imprimir = () => window.print();

  return (
    <>
      <Modal
        id="modal-material-print"
        open={open}
        setOpen={onOpenChange}
        title="Vista de impresión — Material"
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
          <ContenidoMaterial documento={documento} />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando documento...</p>
        )}
      </Modal>

      {documento &&
        createPortal(
          <div id="material-print" className="hidden print:block">
            <ContenidoMaterial documento={documento} />
          </div>,
          document.body
        )}
    </>
  );
}
