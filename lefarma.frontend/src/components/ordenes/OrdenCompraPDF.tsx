import React from 'react';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import type { ProveedorCuentaBancaria } from '@/types/catalogo.types';
import logoImage from '@/assets/logo.png';

interface HistorialWorkflowItem {
  idEvento: number;
  idPaso: number;
  nombrePaso?: string | null;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  fechaEvento: string;
}

interface ProveedorInfo {
  idProveedor: number;
  razonSocial: string;
  rfc?: string;
  cuentasFormaPago?: ProveedorCuentaBancaria[];
}

interface Props {
  orden: OrdenCompraResponse;
  historial?: HistorialWorkflowItem[];
  proveedoresMap?: Map<number, ProveedorInfo>;
  firmasMap?: Map<number, string>;
  formasPagoMap?: Map<number, { idFormaPago: number; nombre: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// function fmtMoney(n: number) {
//   return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
// }

// ─── Styles ───────────────────────────────────────────────────────────────────

const DARK_BLUE = '#1a3a5c';
const HEADER_BG = '#1a3a5c';
const ROW_LABEL = '#2c5f8a';
const BORDER = '#4a7aad';
const WHITE = '#ffffff';
// const LIGHT_GRAY = '#f5f5f5';

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Arial', sans-serif",
    fontSize: 9,
    color: '#000',
    background: WHITE,
    padding: '20px 24px',
    maxWidth: 820,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoBox: {
    width: 140,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: 900,
    fontSize: 18,
    color: DARK_BLUE,
    letterSpacing: 1,
    lineHeight: 1,
  },
  logoSubText: {
    fontSize: 8,
    color: DARK_BLUE,
    letterSpacing: 2,
    marginTop: 1,
  },
  logoTagline: {
    fontSize: 8,
    color: '#e74c3c',
    fontStyle: 'italic',
    marginTop: 2,
  },
  docTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 2,
    color: '#000',
    textTransform: 'uppercase',
  },
  folioBox: {
    width: 180,
    border: `1px solid ${BORDER}`,
    fontSize: 9,
  },
  folioRow: {
    display: 'flex',
    borderBottom: `1px solid ${BORDER}`,
  },
  folioLabelCell: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '2px 6px',
    width: 110,
    textAlign: 'right',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  folioValueCell: {
    padding: '2px 6px',
    flex: 1,
  },
  sectionHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    textAlign: 'center',
    padding: '3px 0',
    fontSize: 9,
    letterSpacing: 0.5,
    border: `1px solid ${BORDER}`,
    borderBottom: 'none',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: 0,
  },
  thBlue: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    textAlign: 'left' as const,
    fontSize: 8.5,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdLabel: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdValue: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
  },
  tdLink: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    color: '#1155cc',
    textDecoration: 'underline',
    verticalAlign: 'top' as const,
  },
  deliveryTh: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    textAlign: 'center' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  deliveryTd: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'center' as const,
  },
  deliveryTdDesc: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'left' as const,
  },
  deliveryTdRight: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'right' as const,
  },
  emptyTd: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    height: 18,
    textAlign: 'right' as const,
    color: '#555',
  },
  bottomSection: {
    display: 'flex',
    gap: 0,
    marginTop: 0,
    border: `1px solid ${BORDER}`,
    borderTop: 'none',
  },
  obsBox: {
    flex: 1,
    padding: '4px 6px',
    borderRight: `1px solid ${BORDER}`,
    fontSize: 8.5,
  },
  obsHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    textAlign: 'center' as const,
    padding: '2px 4px',
    marginBottom: 4,
    fontSize: 8.5,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  totalsBox: {
    width: 220,
    fontSize: 8.5,
  },
  totalRow: {
    display: 'flex',
    borderBottom: `1px solid ${BORDER}`,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right' as const,
    padding: '2px 6px',
    fontWeight: 600,
  },
  totalValue: {
    width: 80,
    textAlign: 'right' as const,
    padding: '2px 6px',
    borderLeft: `1px solid ${BORDER}`,
  },
  totalValueBold: {
    width: 80,
    textAlign: 'right' as const,
    padding: '2px 6px',
    borderLeft: `1px solid ${BORDER}`,
    fontWeight: 700,
    fontSize: 9.5,
  },
  firmasTable: {
    width: '70%',
    borderCollapse: 'collapse' as const,
    marginTop: 8,
    marginLeft: 'auto',
  },
  firmaThRow: {
    background: HEADER_BG,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaTh: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 7.5,
    textAlign: 'left' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaRoleCell: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 7.5,
    width: 60,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaTd: {
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 7.5,
    height: 14,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 6,
    fontSize: 7.5,
    color: '#333',
  },
};

// ─── Logo ──────────────────────────────────────────────────────────────────────

const Logo: React.FC = () => (
  <div style={s.logoBox}>
    <img
      src={logoImage}
      alt="Grupo Lefarma"
      style={{ width: 120, height: 50, objectFit: 'contain' }}
    />
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_LINES = 7;

export function OrdenCompraPDF({ orden, historial = [], proveedoresMap, firmasMap, formasPagoMap }: Props) {
  const proveedores = proveedoresMap ?? new Map<number, ProveedorInfo>();
  const emptyRows = Math.max(0, EMPTY_LINES - (orden.partidas?.length ?? 0));

  const firmas = historial.filter((h) => {
    const accion = (h.nombreAccion || '').toLowerCase();
    const paso = (h.nombrePaso || '').toLowerCase();
    if (accion.includes('creada')) return false;
    if (paso.includes('cxp') || paso.includes('cuentas por pagar')) return false;
    return accion.includes('autoriz') || accion.includes('aproba') || accion.includes('firm');
  });

  const tieneFirma = firmas.some((f) => firmasMap?.get(f.idUsuario));

  const fmt = (n: number) =>
    n === 0
      ? '0.00'
      : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // DEBUG: formas de pago en PDF
  console.log('[OrdenCompraPDF] idsFormaPago:', orden.idsFormaPago);
  console.log('[OrdenCompraPDF] idsCuentasBancarias:', orden.idsCuentasBancarias);
  console.log('[OrdenCompraPDF] numeroMensualidades:', orden.numeroMensualidades);
  console.log('[OrdenCompraPDF] formasPagoMap:', formasPagoMap);
  console.log('[OrdenCompraPDF] proveedoresMap:', proveedoresMap);

  return (
    <div id="orden-compra-pdf-print" style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.headerRow}>
        <Logo />
        <div style={s.docTitle}>ORDEN DE COMPRA</div>
        <div style={s.folioBox}>
          <div style={{ ...s.folioRow, borderBottom: `1px solid ${BORDER}` }}>
            <div style={s.folioLabelCell}>Folio</div>
            <div style={s.folioValueCell}>{orden.folio ?? '-'}</div>
          </div>
          <div style={s.folioRow}>
            <div style={s.folioLabelCell}>Fecha Elaboración</div>
            <div style={s.folioValueCell}>
              {orden.fechaSolicitud ? fmtDate(orden.fechaSolicitud) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* ── DATOS DEL SOLICITANTE ── */}
      <div style={s.sectionHeader}>Datos del solicitante</div>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.thBlue}>Empresa</td>
            <td style={s.tdValue}>
              {orden.empresaNombre?.toUpperCase() ?? orden.idEmpresa ?? '-'}
            </td>
            <td style={s.thBlue}>Sucursal</td>
            <td style={s.tdValue}>
              {orden.sucursalNombre?.toUpperCase() ?? orden.idSucursal ?? '-'}
            </td>
            <td style={s.thBlue}>Área</td>
            <td style={s.tdValue}>{orden.areaNombre?.toUpperCase() ?? orden.idArea ?? '-'}</td>
          </tr>
          <tr>
            <td style={s.thBlue}>Nombre del solicitante</td>
            <td style={s.tdValue}>{orden.solicitanteNombre ?? '-'}</td>
            <td style={s.thBlue}>Puesto</td>
            <td style={s.tdValue}>{orden.solicitantePuesto ?? '-'}</td>
            <td style={s.thBlue}>Fecha máxima de pago</td>
            <td style={s.tdValue}>
              {orden.fechaLimitePago ? fmtDate(orden.fechaLimitePago) : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── DATOS DEL PROVEEDOR ── */}
      <div style={{ ...s.sectionHeader, marginTop: 6 }}>Datos del Proveedor</div>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.thBlue}>Nombre, Denominación o Razón social</td>
            <td style={s.tdValue} colSpan={5}>
              {orden.idProveedor
                ? (proveedores.get(Number(orden.idProveedor))?.razonSocial ?? '-')
                : '-'}
            </td>
          </tr>
          <tr>
            <td style={s.thBlue}>Forma de pago</td>
            <td style={s.tdValue} colSpan={5}>
              {orden.idsFormaPago?.map((idFp) => {
                const fp = formasPagoMap?.get(idFp);
                return fp?.nombre ?? `ID ${idFp}`;
              }).join(', ') ?? '-'}
            </td>
          </tr>
          {orden.numeroMensualidades !== 1 && (
            <tr>
              <td style={s.thBlue}>Cuenta bancaria</td>
              <td style={s.tdValue}>
                {orden.idsCuentasBancarias?.map((idCb) => {
                  let info: string | undefined;
                  proveedoresMap?.forEach((prov) => {
                    const cuenta = prov.cuentasFormaPago?.find((c: ProveedorCuentaBancaria) => c.idCuen === idCb);
                    if (cuenta) {
                      info = `${cuenta.bancoNombre ?? 'Banco'} • ${cuenta.numeroCuenta ?? 'Sin cuenta'}`;
                    }
                  });
                  return info ?? `ID ${idCb}`;
                }).join(', ') ?? '-'}
              </td>
              <td style={s.thBlue}>Parcialidades</td>
              <td style={s.tdValue}>
                {orden.numeroMensualidades ? `${orden.numeroMensualidades} parcialidad(es)` : '-'}
              </td>
            </tr>
          )}
          <tr>
            <td style={s.thBlue}>Comentarios sobre el pago</td>
            <td style={{ ...s.tdValue, textAlign: 'justify' }} colSpan={5}>{orden.notaFormaPago ?? '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* ── DATOS DE ENTREGA ── */}
      <div style={{ ...s.sectionHeader, marginTop: 6 }}>Datos de entrega</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={{ ...s.deliveryTh, width: '5%' }}>Cant.</th>
            <th style={{ ...s.deliveryTh, width: '5%' }}>U.M.</th>
            <th style={s.deliveryTh}>Descripción</th>
            <th style={{ ...s.deliveryTh, width: '12%' }}>Precio Unitario S/IVA</th>
            <th style={{ ...s.deliveryTh, width: '10%' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {(orden.partidas ?? []).map((p, i) => (
            <tr key={p.idPartida ?? i}>
              <td style={s.deliveryTd}>{p.cantidad}</td>
              <td style={s.deliveryTd}>{p.unidadMedidaNombre ?? p.idUnidadMedida}</td>
              <td style={s.deliveryTdDesc}>{p.descripcion}</td>
              <td style={s.deliveryTdRight}>
                {p.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </td>
              <td style={s.deliveryTdRight}>
                {p.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ ...s.emptyTd, textAlign: 'center' }}></td>
              <td style={s.emptyTd}></td>
              <td style={s.emptyTd}></td>
              <td style={s.emptyTd}></td>
              <td style={s.emptyTd}>0.00</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── OBSERVACIONES + TOTALES ── */}
      <div style={s.bottomSection}>
        <div style={s.obsBox}>
          <div style={s.obsHeader}>Observaciones</div>
          <div style={{ fontSize: 8, lineHeight: 1.4 }}>{orden.notasGenerales ?? '-'}</div>
        </div>
        <div style={s.totalsBox}>
          {[
            { label: 'Subtotal', value: orden.subtotal, bold: false },
            { label: 'IVA', value: orden.totalIva, bold: false },
            { label: 'Total', value: orden.total, bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label} style={s.totalRow}>
              <div style={{ ...s.totalLabel, fontWeight: bold ? 700 : 600 }}>{label}</div>
              <div style={bold ? s.totalValueBold : s.totalValue}>
                {value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FIRMAS ── */}
      {firmas.length > 0 && (
        <table style={s.firmasTable}>
          <thead>
            <tr style={s.firmaThRow}>
              <th style={s.firmaTh}>Puesto</th>
              <th style={s.firmaTh}>Nombre</th>
              {tieneFirma && <th style={s.firmaTh}>Firma</th>}
            </tr>
          </thead>
          <tbody>
            {firmas.map((f) => {
              const firmaUrl = firmasMap?.get(f.idUsuario);
              return (
                <tr key={f.idEvento}>
                  <td style={s.firmaTd}>{f.nombrePaso ?? '-'}</td>
                  <td style={s.firmaTd}>{f.nombreUsuario ?? `Usuario ${f.idUsuario}`}</td>
                  {tieneFirma && (
                    <td style={s.firmaTd}>
                      {firmaUrl ? (
                        <img
                          src={firmaUrl}
                          alt="Firma"
                          style={{
                            height: 30,
                            width: 80,
                            objectFit: 'cover',
                            display: 'block',
                            marginLeft: 'auto',
                          }}
                        />
                      ) : null}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── FOOTER ── */}
      {/* <div style={s.footer}>
        <span>LEF-AYF-FOR-009</span>
        <span>Versión: 01 · Prohibida la reproducción no autorizada</span>
        <span>Pág 1 de 1</span>
      </div> */}
    </div>
  );
}

export default OrdenCompraPDF;
