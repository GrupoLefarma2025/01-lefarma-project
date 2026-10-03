import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { MatrizDocumento } from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

const RESUMEN_RECURSOS: Record<string, string> = {
  Producto: 'Producto',
  Folleto: 'Folleto',
  Envio: 'Envío',
  BoxLunch: 'Box lunch',
};

const CELDA = 'border border-border px-2 py-1 text-left align-top';
const CELDA_ENC = `${CELDA} bg-muted font-medium`;

function ContenidoMatriz({ documento }: { documento: MatrizDocumento }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <h2 className="text-base font-bold uppercase">{documento.titulo}</h2>
        <p className="text-xs text-muted-foreground">
          {documento.gerencia ?? 'Sin gerencia'} · Periodo {fmtPeriodo(documento.periodo)}
          {documento.pasoNombre ? ` · Paso: ${documento.pasoNombre}` : ''}
          {documento.estadoNombre ? ` · ${documento.estadoNombre}` : ''}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={`${CELDA_ENC} w-8 text-center`}>#</th>
            <th className={CELDA_ENC}>Región</th>
            <th className={CELDA_ENC}>Hospital</th>
            <th className={CELDA_ENC}>Estado</th>
            <th className={CELDA_ENC}>Ciudad / Municipio</th>
            <th className={`${CELDA_ENC} w-12 text-center`}>Part.</th>
            <th className={CELDA_ENC}>Ejecutivo</th>
            <th className={`${CELDA_ENC} w-20`}>Fecha</th>
            <th className={`${CELDA_ENC} w-14`}>Hora</th>
            <th className={`${CELDA_ENC} w-16 text-center`}>Eq. proy.</th>
            <th className={CELDA_ENC}>Recursos</th>
            <th className={`${CELDA_ENC} w-24 text-right`}>Costo total</th>
          </tr>
        </thead>
        <tbody>
          {documento.talleres.map((taller, idx) => (
            <tr key={taller.idTaller} className="break-inside-avoid">
              <td className={`${CELDA} text-center tabular-nums`}>{idx + 1}</td>
              <td className={CELDA}>{taller.region ?? '—'}</td>
              <td className={CELDA}>{taller.nombreHospital ?? '—'}</td>
              <td className={CELDA}>{taller.entidadFederativa ?? '—'}</td>
              <td className={CELDA}>{taller.ciudadMunicipio ?? '—'}</td>
              <td className={`${CELDA} text-center tabular-nums`}>
                {taller.numeroParticipantes ?? '—'}
              </td>
              <td className={CELDA}>{taller.nombreEjecutivo ?? '—'}</td>
              <td className={CELDA}>{fmtFecha(taller.fechaTaller)}</td>
              <td className={CELDA}>{taller.horaTaller?.slice(0, 5) ?? '—'}</td>
              <td className={`${CELDA} text-center`}>
                {taller.requiereEquipoProyeccion
                  ? (taller.tipoEquipoProyeccion ?? 'Sí')
                  : 'No'}
              </td>
              <td className={CELDA}>
                {taller.recursos.length === 0
                  ? '—'
                  : taller.recursos
                      .map(
                        (r) =>
                          `${RESUMEN_RECURSOS[r.tipoRecurso] ?? r.tipoRecurso}${
                            r.cantidad != null ? ` ×${r.cantidad}` : ''
                          }${r.costoUnitario != null ? ` @ ${fmtMoneda(r.costoUnitario)}` : ''}`
                      )
                      .join('; ')}
              </td>
              <td className={`${CELDA} text-right tabular-nums`}>
                {fmtMoneda(taller.costoTotal)}
              </td>
            </tr>
          ))}
          {documento.talleres.length === 0 && (
            <tr>
              <td className={CELDA} colSpan={12}>
                Sin talleres capturados.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${CELDA_ENC} text-right`} colSpan={11}>
              Costo total de la matriz
            </td>
            <td className={`${CELDA_ENC} text-right tabular-nums`}>
              {fmtMoneda(documento.costoTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      <section className="break-inside-avoid space-y-3 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Firmas
        </h3>
        <div className="grid gap-6 sm:grid-cols-3">
          {documento.firmas.length === 0 && (
            <p className="text-xs text-muted-foreground">Documento aún sin firmas.</p>
          )}
          {documento.firmas.map((firma, idx) => (
            <div key={`${firma.idUsuario}-${idx}`} className="border-t border-border pt-2 text-xs">
              <p className="font-semibold">{firma.nombreUsuario ?? `Usuario ${firma.idUsuario}`}</p>
              <p className="text-muted-foreground">{firma.pasoNombre ?? '—'}</p>
              <p className="text-muted-foreground">
                {new Date(firma.fecha).toLocaleString('es-MX')}
              </p>
              {firma.comentario && <p className="italic">“{firma.comentario}”</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface MatrizPrintDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: MatrizDocumento | null;
}

/** Vista de impresión de la Matriz (layout FOR-005): general o individual. */
export function MatrizPrintDocument({ open, onOpenChange, documento }: MatrizPrintDocumentProps) {
  return (
    <>
      <Modal
        id="modal-matriz-print"
        open={open}
        setOpen={onOpenChange}
        title="Vista de impresión — Matriz de talleres (FOR-005)"
        size="wide"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button onClick={() => window.print()} disabled={!documento}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        }
      >
        {documento ? (
          <ContenidoMatriz documento={documento} />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando documento...</p>
        )}
      </Modal>

      {/* Copia exclusiva para impresión: flujo normal de página, sin las animaciones del diálogo */}
      {documento &&
        createPortal(
          <div id="matriz-print" className="hidden print:block">
            <ContenidoMatriz documento={documento} />
          </div>,
          document.body
        )}
    </>
  );
}
