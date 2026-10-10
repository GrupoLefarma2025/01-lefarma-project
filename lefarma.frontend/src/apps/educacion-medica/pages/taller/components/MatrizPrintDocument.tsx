import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type {
  MatrizDocumento,
  Taller,
  TallerRecurso,
  TipoRecursoTaller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const fmtPeriodo = (periodo: string) => periodo.slice(0, 7).split('-').reverse().join('/');

const CELDA = 'border border-border px-1.5 py-1 text-left align-top';
const CELDA_ENC = 'border border-border bg-muted px-1.5 py-1 text-center align-middle font-medium';
const CELDA_NUM = `${CELDA} text-right tabular-nums whitespace-nowrap`;

const recursosDe = (taller: Taller, tipo: TipoRecursoTaller) =>
  taller.recursos.filter((r) => r.tipoRecurso === tipo);

const sumaCantidades = (recursos: TallerRecurso[]) =>
  recursos.reduce((acc, r) => acc + (r.cantidad ?? 0), 0);

const sumaSubtotales = (recursos: TallerRecurso[]) =>
  recursos.reduce((acc, r) => acc + (r.subtotal ?? 0), 0);

const unirValores = (valores: (string | null | undefined)[]) => {
  const limpios = [...new Set(valores.filter((v): v is string => !!v))];
  return limpios.length > 0 ? limpios.join(' / ') : null;
};

const costosUnitarios = (recursos: TallerRecurso[]) =>
  unirValores(recursos.map((r) => (r.costoUnitario != null ? fmtMoneda(r.costoUnitario) : null)));

function ContenidoMatriz({ documento }: { documento: MatrizDocumento }) {
  const totales = documento.talleres.reduce(
    (acc, t) => {
      acc.producto += sumaSubtotales(recursosDe(t, 'Producto'));
      acc.folleto += sumaSubtotales(recursosDe(t, 'Folleto'));
      acc.envio += sumaSubtotales(recursosDe(t, 'Envio'));
      acc.boxLunch += sumaSubtotales(recursosDe(t, 'BoxLunch'));
      return acc;
    },
    { producto: 0, folleto: 0, envio: 0, boxLunch: 0 }
  );

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <h2 className="text-base font-bold uppercase">{documento.titulo}</h2>
        <p className="text-xs text-muted-foreground">
          {documento.gerencia ? `${documento.gerencia} · ` : ''}Periodo{' '}
          {fmtPeriodo(documento.periodo)}
          {documento.pasoNombre ? ` · Paso: ${documento.pasoNombre}` : ''}
          {documento.estadoNombre ? ` · ${documento.estadoNombre}` : ''}
        </p>
      </div>

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className={`${CELDA_ENC} w-7`} rowSpan={2}>
              #
            </th>
            <th className={CELDA_ENC} rowSpan={2}>
              Región
            </th>
            <th className={CELDA_ENC} rowSpan={2}>
              Hospital
            </th>
            <th className={CELDA_ENC} rowSpan={2}>
              Estado
            </th>
            <th className={CELDA_ENC} rowSpan={2}>
              Ciudad / Municipio
            </th>
            <th className={`${CELDA_ENC} w-10`} rowSpan={2}>
              Part.
            </th>
            <th className={CELDA_ENC} rowSpan={2}>
              Ejecutivo
            </th>
            <th className={`${CELDA_ENC} w-16`} rowSpan={2}>
              Fecha
            </th>
            <th className={`${CELDA_ENC} w-12`} rowSpan={2}>
              Hora
            </th>
            <th className={CELDA_ENC} colSpan={2}>
              Equipo de proyección
            </th>
            <th className={CELDA_ENC} colSpan={2}>
              Muestras
            </th>
            <th className={CELDA_ENC} colSpan={2}>
              Folletos
            </th>
            <th className={CELDA_ENC} colSpan={2}>
              Gastos de envío
            </th>
            <th className={CELDA_ENC} colSpan={2}>
              Box lunch
            </th>
          </tr>
          <tr>
            <th className={CELDA_ENC}>¿Se requiere?</th>
            <th className={CELDA_ENC}>Propio o rentado</th>
            <th className={CELDA_ENC}>Producto</th>
            <th className={CELDA_ENC}>Cant. piezas</th>
            <th className={CELDA_ENC}>Cant. piezas</th>
            <th className={CELDA_ENC}>Costo unit.</th>
            <th className={CELDA_ENC}>Tipo</th>
            <th className={CELDA_ENC}>Costo unit.</th>
            <th className={CELDA_ENC}>No. servicios</th>
            <th className={CELDA_ENC}>Costo unit.</th>
          </tr>
        </thead>
        <tbody>
          {documento.talleres.map((taller, idx) => {
            const productos = recursosDe(taller, 'Producto');
            const folletos = recursosDe(taller, 'Folleto');
            const envios = recursosDe(taller, 'Envio');
            const boxLunch = recursosDe(taller, 'BoxLunch');
            return (
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
                  {taller.requiereEquipoProyeccion == null
                    ? '—'
                    : taller.requiereEquipoProyeccion
                      ? 'Sí'
                      : 'No'}
                </td>
                <td className={`${CELDA} text-center`}>
                  {taller.requiereEquipoProyeccion ? (taller.tipoEquipoProyeccion ?? '—') : '—'}
                </td>
                <td className={CELDA}>
                  {unirValores(productos.map((r) => r.nombreProducto ?? r.idProducto)) ?? '—'}
                </td>
                <td className={`${CELDA} text-center tabular-nums`}>
                  {productos.length > 0 ? sumaCantidades(productos) : '—'}
                </td>
                <td className={`${CELDA} text-center tabular-nums`}>
                  {folletos.length > 0 ? sumaCantidades(folletos) : '—'}
                </td>
                <td className={CELDA_NUM}>{costosUnitarios(folletos) ?? '—'}</td>
                <td className={CELDA}>{unirValores(envios.map((r) => r.tipoEnvio)) ?? '—'}</td>
                <td className={CELDA_NUM}>{costosUnitarios(envios) ?? '—'}</td>
                <td className={`${CELDA} text-center tabular-nums`}>
                  {boxLunch.length > 0 ? sumaCantidades(boxLunch) : '—'}
                </td>
                <td className={CELDA_NUM}>{costosUnitarios(boxLunch) ?? '—'}</td>
              </tr>
            );
          })}
          {documento.talleres.length === 0 && (
            <tr>
              <td className={CELDA} colSpan={19}>
                Sin talleres capturados.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="break-inside-avoid space-y-2 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Costo por Recurso Solicitado
        </h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${CELDA_ENC} w-8`}>#</th>
              <th className={CELDA_ENC}>Producto</th>
              <th className={CELDA_ENC}>Folleto impreso</th>
              <th className={CELDA_ENC}>Gastos de envío</th>
              <th className={CELDA_ENC}>Box lunch</th>
              <th className={CELDA_ENC}>Costo Total</th>
            </tr>
          </thead>
          <tbody>
            {documento.talleres.map((taller, idx) => (
              <tr key={taller.idTaller} className="break-inside-avoid">
                <td className={`${CELDA} text-center tabular-nums`}>{idx + 1}</td>
                <td className={CELDA_NUM}>
                  {fmtMoneda(sumaSubtotales(recursosDe(taller, 'Producto')))}
                </td>
                <td className={CELDA_NUM}>
                  {fmtMoneda(sumaSubtotales(recursosDe(taller, 'Folleto')))}
                </td>
                <td className={CELDA_NUM}>
                  {fmtMoneda(sumaSubtotales(recursosDe(taller, 'Envio')))}
                </td>
                <td className={CELDA_NUM}>
                  {fmtMoneda(sumaSubtotales(recursosDe(taller, 'BoxLunch')))}
                </td>
                <td className={CELDA_NUM}>{fmtMoneda(taller.costoTotal)}</td>
              </tr>
            ))}
            {documento.talleres.length === 0 && (
              <tr>
                <td className={CELDA} colSpan={6}>
                  Sin costos capturados.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${CELDA_ENC} text-right`} colSpan={1}>
                Total
              </td>
              <td className={CELDA_NUM}>{fmtMoneda(totales.producto)}</td>
              <td className={CELDA_NUM}>{fmtMoneda(totales.folleto)}</td>
              <td className={CELDA_NUM}>{fmtMoneda(totales.envio)}</td>
              <td className={CELDA_NUM}>{fmtMoneda(totales.boxLunch)}</td>
              <td className={CELDA_NUM}>{fmtMoneda(documento.costoTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

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
  // El FOR-005 tiene 19 columnas en la tabla principal: se imprime en A4 horizontal
  // (body.print-matriz activa la página nombrada @page landscape de index_educacion_medica.css).
  const imprimir = () => {
    document.body.classList.add('print-matriz');
    const limpiar = () => {
      document.body.classList.remove('print-matriz');
      window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    window.print();
  };

  return (
    <>
      <Modal
        id="modal-matriz-print"
        open={open}
        setOpen={onOpenChange}
        title="Vista de impresión — Matriz de talleres"
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
