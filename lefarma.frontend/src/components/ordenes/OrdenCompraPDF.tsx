import React from 'react';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import type { ProveedorCuentaBancaria } from '@/types/catalogo.types';
import logoDefault from '@/assets/logo.png';
import logoArtricenter from '@/assets/logo_1.png?no-inline';
import logoAsokam from '@/assets/logo_7.png?no-inline';
import logoLefarma from '@/assets/logo_8.png?no-inline';
import logoConstrumedika from '@/assets/logo_11.png?no-inline';
import logoGrupoLefarma from '@/assets/logo_12.png?no-inline';

// ponytail: static imports — Vite can't bundle dynamic asset paths
const LOGOS: Record<number, string> = {
  1: logoArtricenter,
  7: logoAsokam,
  8: logoLefarma,
  11: logoConstrumedika,
  12: logoGrupoLefarma,
};

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

interface PasoFlowItem {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  esInicio: boolean;
  esFinal: boolean;
}

interface Props {
  orden: OrdenCompraResponse;
  historial?: HistorialWorkflowItem[];
  pasosWorkflow?: PasoFlowItem[];
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

// Formato largo para el encabezado: "20 de enero del 2026"
function fmtDateLarga(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const dia = d.getDate();
    const mes = d.toLocaleDateString('es-MX', { month: 'long' });
    const anio = d.getFullYear();
    return `${dia} de ${mes} del ${anio}`;
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
    fontSize: 12,
    color: '#000',
    background: WHITE,
    padding: '18px 16px',
    maxWidth: 800,
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
    fontSize: 10,
    color: DARK_BLUE,
    letterSpacing: 2,
    marginTop: 1,
  },
  logoTagline: {
    fontSize: 10,
    color: '#e74c3c',
    fontStyle: 'italic',
    marginTop: 2,
  },
  docTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 2,
    color: '#000',
    textTransform: 'uppercase',
  },
  folioBox: {
    width: 280,
    border: `1px solid ${BORDER}`,
    fontSize: 12,
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
    textAlign: 'center',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  folioValueCell: {
    padding: '2px 6px',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
  },
  sectionHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    textAlign: 'center',
    padding: '3px 0',
    fontSize: 12,
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
    fontSize: 12,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdLabel: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdValue: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    verticalAlign: 'top' as const,
  },
  tdLink: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
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
    fontSize: 12,
    textAlign: 'center' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  deliveryTd: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    verticalAlign: 'top' as const,
    textAlign: 'center' as const,
  },
  deliveryTdDesc: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    verticalAlign: 'top' as const,
    textAlign: 'left' as const,
  },
  deliveryTdRight: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    verticalAlign: 'top' as const,
    textAlign: 'right' as const,
  },
  emptyTd: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 12,
    height: 24,
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
  freeFieldsSection: {
    display: 'flex',
    gap: 0,
    border: `1px solid ${BORDER}`,
    borderTop: 'none',
  },
  freeField: {
    flex: 1,
    padding: '4px 6px',
    borderRight: `1px solid ${BORDER}`,
    fontSize: 12,
  },
  obsBox: {
    flex: 1,
    padding: '4px 6px',
    borderRight: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: 12,
  },
  obsHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    textAlign: 'center' as const,
    padding: '2px 4px',
    marginBottom: 4,
    fontSize: 12,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  totalsBox: {
    width: 240,
    fontSize: 12,
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
    width: 110,
    textAlign: 'right' as const,
    padding: '2px 6px',
    borderLeft: `1px solid ${BORDER}`,
  },
  totalValueBold: {
    width: 110,
    textAlign: 'right' as const,
    padding: '2px 6px',
    borderLeft: `1px solid ${BORDER}`,
    fontWeight: 700,
    fontSize: 12,
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
    fontSize: 10,
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
    fontSize: 10,
    width: 90,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaTd: {
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 10,
    height: 22,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 6,
    fontSize: 10,
    color: '#333',
  },
};

// ─── Logo ──────────────────────────────────────────────────────────────────────

const Logo: React.FC<{ src: string }> = ({ src }) => (
  <div style={s.logoBox}>
    <img
      src={src}
      alt="Grupo Lefarma"
      style={{ width: 120, height: 50, objectFit: 'contain' }}
    />
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const EMPTY_LINES = 7;

export function OrdenCompraPDF({ orden, historial = [], pasosWorkflow = [], proveedoresMap, firmasMap, formasPagoMap }: Props) {
  const proveedores = proveedoresMap ?? new Map<number, ProveedorInfo>();
  const emptyRows = Math.max(0, EMPTY_LINES - (orden.partidas?.length ?? 0));

  const historialPorPaso = new Map<number, HistorialWorkflowItem[]>();
  for (const h of historial) {
    const arr = historialPorPaso.get(h.idPaso) ?? [];
    arr.push(h);
    historialPorPaso.set(h.idPaso, arr);
  }

  const flujoPasos = pasosWorkflow.map((paso) => {
    const eventos = historialPorPaso.get(paso.idPaso) ?? [];
    const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : null;
    return {
      idPaso: paso.idPaso,
      orden: paso.orden,
      nombrePaso: paso.nombrePaso,
      esInicio: paso.esInicio,
      esFinal: paso.esFinal,
      participante: ultimo ? (ultimo.nombreUsuario ?? `Usuario ${ultimo.idUsuario}`) : null,
      idUsuario: ultimo?.idUsuario ?? null,
      accion: ultimo ? (ultimo.nombreAccion ?? '') : null,
      fecha: ultimo?.fechaEvento ?? null,
      tieneEvento: eventos.length > 0,
    };
  });

  const fmt = (n: number) =>
    n === 0
      ? '0.00'
      : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
     const _logoKey = Number(orden.idEmpresa);
  const _logoSrc = LOGOS[_logoKey] ;

  const esCorreoGrupolefarma = (orden.solicitanteCorreo ?? '')
    .toLowerCase()
    .trim()
    .endsWith('@grupolefarma.com.mx');
  const nombreSolicitanteMostrar = esCorreoGrupolefarma
    ? (orden.segundoAutorizador ?? orden.solicitanteNombre ?? '-')
    : (orden.solicitanteNombre ?? '-');

  return (
    <div id="orden-compra-pdf-print" style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.headerRow}>
        <Logo src={_logoSrc} />
        <div style={s.docTitle}>ORDEN DE COMPRA</div>
        <div style={s.folioBox}>
          <div style={{ ...s.folioRow, borderBottom: `1px solid ${BORDER}` }}>
            <div style={s.folioLabelCell}>OC</div>
            <div style={s.folioValueCell}>{orden.folio ?? '-'}</div>
          </div>
          <div style={s.folioRow}>
            <div style={s.folioLabelCell}>Fecha</div>
            <div style={s.folioValueCell}>
              {orden.fechaSolicitud ? fmtDateLarga(orden.fechaSolicitud) : orden.fechaCreacion ? fmtDateLarga(orden.fechaCreacion) : '-'}
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
            <td style={s.tdValue}>{nombreSolicitanteMostrar}</td>
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
          <tr>
            <td style={s.thBlue}>Cuenta bancaria</td>
            <td style={s.tdValue} colSpan={5}>
              {orden.idsCuentasBancarias?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {orden.idsCuentasBancarias.map((idCb, idx) => {
                    let cuenta: ProveedorCuentaBancaria | undefined;
                    proveedoresMap?.forEach((prov) => {
                      const found = prov.cuentasFormaPago?.find((c: ProveedorCuentaBancaria) => c.idCuenta === idCb);
                      if (found) cuenta = found;
                    });
                    if (!cuenta) return <span key={idx}>ID {idCb}</span>;
                    return (
                      <span key={idx}>
                        {cuenta.bancoNombre ?? 'Banco'} • {cuenta.numeroCuenta ?? 'Sin cuenta'}
                        {cuenta.clabe ? ` • CLABE: ${cuenta.clabe}` : ''}
                        {cuenta.numeroTarjeta ? ` • Tarjeta: ${cuenta.numeroTarjeta}` : ''}
                      </span>
                    );
                  })}
                </div>
              ) : '-'}
            </td>
          </tr>
          {orden.numeroMensualidades !== 1 && (
            <tr>
              <td style={s.thBlue}>Parcialidades</td>
              <td style={s.tdValue} colSpan={5}>
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
                {(p.precioUnitario * p.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
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
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>{orden.notasGenerales ?? '-'}</div>
        </div>
        <div style={s.totalsBox}>
          {[
            { label: 'Subtotal', value: (orden.partidas ?? []).reduce((sum, p) => sum + (p.precioUnitario * p.cantidad), 0), bold: false },
            { label: 'Descuentos', value: (orden.partidas ?? []).reduce((sum, p) => sum + p.descuento, 0), bold: false },
            { label: 'Impuesto', value: orden.totalIva, bold: false },
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

      {/* ── FOLIO DE TRANSPORTE / FACTURAR A / DOMICILIO (una fila por campo, ancho completo) ── */}
      {(orden.nombreTraslado || orden.facturarA || orden.domicilioEntrega) && (
        <table style={{ ...s.table, marginTop: 6 }}>
          <tbody>
            {orden.nombreTraslado && (
              <tr>
                <td style={s.thBlue}>Folio de transporte</td>
                <td style={s.tdValue} colSpan={5}>{orden.nombreTraslado}</td>
              </tr>
            )}
            {orden.facturarA && (
              <tr>
                <td style={s.thBlue}>Facturar a</td>
                <td style={s.tdValue} colSpan={5}>{orden.facturarA}</td>
              </tr>
            )}
            {orden.domicilioEntrega && (
              <tr>
                <td style={s.thBlue}>Domicilio de entrega</td>
                <td style={s.tdValue} colSpan={5}>{orden.domicilioEntrega}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* ── FLUJO DINÁMICO ── */}
      {flujoPasos.length > 0 && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <table style={{ ...s.firmasTable, width: '100%' }}>
          <thead>
            <tr style={s.firmaThRow}>
              <th style={{ ...s.firmaTh, width: '5%' }}>#</th>
              <th style={{ ...s.firmaTh, width: '20%' }}>Paso</th>
              <th style={{ ...s.firmaTh, width: '22%' }}>Participante</th>
              <th style={{ ...s.firmaTh, width: '18%' }}>Acción</th>
              <th style={{ ...s.firmaTh, width: '15%' }}>Fecha</th>
              <th style={{ ...s.firmaTh, width: '20%' }}>Firma</th>
            </tr>
          </thead>
          <tbody>
            {flujoPasos.filter((paso, idx) => {
              const siguiente = idx < flujoPasos.length - 1 ? flujoPasos[idx + 1] : null;
              if (!(siguiente?.tieneEvento ?? false)) return false;
              if (siguiente?.idUsuario != null && firmasMap !== undefined && !firmasMap.has(siguiente.idUsuario)) return false;
              return true;
            }).map((paso, idx) => {
              const originalIdx = flujoPasos.indexOf(paso);
              const siguiente = flujoPasos[originalIdx + 1];
              return (
                <tr key={paso.idPaso}>
                  <td style={{ ...s.firmaTd, textAlign: 'center' }}>{paso.orden}</td>
                  <td style={s.firmaTd}>{paso.nombrePaso}</td>
                  <td style={s.firmaTd}>{siguiente?.participante ?? '—'}</td>
                  <td style={s.firmaTd}>{siguiente?.accion ?? '—'}</td>
                  <td style={s.firmaTd}>
                    {siguiente?.fecha
                      ? new Date(siguiente.fecha).toLocaleDateString('es-MX', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td style={s.firmaTd}>
                    {siguiente?.idUsuario != null && firmasMap?.get(siguiente.idUsuario) ? (
                      <img
                        src={firmasMap.get(siguiente.idUsuario)}
                        alt="Firma"
                        style={{
                          height: 28,
                          width: 80,
                          objectFit: 'contain',
                          display: 'block',
                          marginLeft: 'auto',
                          printColorAdjust: 'exact',
                          WebkitPrintColorAdjust: 'exact',
                        }}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
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
