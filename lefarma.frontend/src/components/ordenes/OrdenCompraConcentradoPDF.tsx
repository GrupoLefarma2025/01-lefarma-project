import React from 'react';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import logoDefault from '@/assets/logo.png';
import logo1 from '@/assets/logo_1.png';
import logo2 from '@/assets/logo_2.png';
import logo3 from '@/assets/logo_3.png';
import logo4 from '@/assets/logo_4.png';
import logo5 from '@/assets/logo_5.png';

// ponytail: static imports — Vite can't bundle dynamic asset paths
const LOGOS: Record<number, string> = { 1: logo1, 2: logo2, 3: logo3, 4: logo4, 5: logo5 };

interface Props {
  orden: OrdenCompraResponse;
  firmaElaboro?: string;
  id?: string;
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const DARK_BLUE = '#1a3a5c';
const HEADER_BG = '#1a3a5c';
const ROW_LABEL = '#2c5f8a';
const BORDER = '#4a7aad';
const WHITE = '#ffffff';

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
  tdValue: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
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
  // ── Firmas (concentrado) ──
  firmaSection: {
    marginTop: 14,
    pageBreakInside: 'avoid' as const,
  },
  firmaHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    fontSize: 9,
    padding: '3px 6px',
    letterSpacing: 0.5,
    border: `1px solid ${BORDER}`,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaGrid: {
    display: 'flex',
    gap: 12,
    marginTop: 0,
  },
  firmaBox: {
    flex: 1,
    border: `1px solid ${BORDER}`,
    borderTop: 'none',
    padding: '4px 6px',
    minHeight: 60,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  firmaLabel: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    fontSize: 8,
    padding: '2px 5px',
    textAlign: 'center' as const,
    marginBottom: 4,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  firmaPlaceholder: {
    fontWeight: 700,
    fontSize: 14,
    color: DARK_BLUE,
    letterSpacing: 2,
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

export function OrdenCompraConcentradoPDF({ orden, firmaElaboro, id = 'orden-compra-concentrado-pdf-print' }: Props) {
  const emptyRows = Math.max(0, EMPTY_LINES - (orden.partidas?.length ?? 0));

  const fmt = (n: number) =>
    n === 0
      ? '0.00'
      : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div id={id} style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.headerRow}>
        <Logo src={LOGOS[orden.idEmpresa] ?? logoDefault} />
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
              {orden.razonSocialProveedor ?? '-'}
            </td>
          </tr>
          <tr>
            <td style={s.thBlue}>Forma de pago</td>
            <td style={s.tdValue} colSpan={5}>
              {orden.formasPagoNombres?.length ? orden.formasPagoNombres.join(', ') : '-'}
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
          <div style={{ fontSize: 8, lineHeight: 1.4 }}>{orden.notasGenerales ?? '-'}</div>
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

      {/* ── FIRMAS (Concentrado) ── */}
      <div style={s.firmaSection}>
        <div style={s.firmaHeader}>Autorizaciones</div>
        <div style={s.firmaGrid}>
          {/* Elaboró (GAF) */}
          <div style={s.firmaBox}>
            <div style={s.firmaLabel}>Elaboró (GAF)</div>
            <div style={s.firmaContent}>
              {firmaElaboro ? (
                <img
                  src={firmaElaboro}
                  alt="Firma"
                  style={{ maxWidth: 120, maxHeight: 40, objectFit: 'contain' }}
                  crossOrigin="anonymous"
                />
              ) : (
                <span style={s.firmaPlaceholder}> sin firma </span>
              )}
            </div>
          </div>
          {/* Visto Bueno — Dirección Corporativa */}
          <div style={s.firmaBox}>
            <div style={s.firmaLabel}>Visto Bueno — Dirección Corporativa</div>
            <div style={s.firmaContent}>
              <span style={s.firmaPlaceholder}> #firmad </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrdenCompraConcentradoPDF;
