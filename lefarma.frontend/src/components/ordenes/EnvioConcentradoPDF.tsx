import React from 'react';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import logoImage from '@/assets/logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgrupacionKey = 'sucursal' | 'empresa' | 'area' | 'proveedor';

export const AGRUPACION_LABELS: Record<AgrupacionKey, string> = {
  sucursal: 'Sucursal',
  empresa: 'Empresa',
  area: 'Área',
  proveedor: 'Proveedor',
};

interface Props {
  ordenes: OrdenCompraResponse[];
  agrupacion: AgrupacionKey;
  generadoPor?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return d;
  }
}

function getMes(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
  } catch {
    return '';
  }
}

function getGroupKey(orden: OrdenCompraResponse, agrupacion: AgrupacionKey): string {
  switch (agrupacion) {
    case 'sucursal':
      return orden.sucursalNombre ?? `Sucursal ${orden.idSucursal}`;
    case 'empresa':
      return orden.empresaNombre ?? `Empresa ${orden.idEmpresa}`;
    case 'area':
      return orden.areaNombre ?? `Área ${orden.idArea}`;
    case 'proveedor':
      return orden.razonSocialProveedor ?? (orden.idProveedor ? `Proveedor ${orden.idProveedor}` : 'Sin proveedor');
  }
}

// One flat row per partida
interface PartidaRow {
  folio: string;
  fechaElaboracion: string;
  solicitante: string;
  fechaLimitePago: string;
  mes: string;
  sucursal: string;
  cantidad: number;
  unidadMedida: string;
  proveedor: string;
  descripcion: string;
  precioUnitario: number;
  subtotalPartida: number;
  descuento: number;
  iva: number;
  otrosImpuestos: number;
  importeTotal: number;
  formaPago: string;
  medioPago: string;
  groupKey: string;
}

function buildRows(ordenes: OrdenCompraResponse[], agrupacion: AgrupacionKey): PartidaRow[] {
  const rows: PartidaRow[] = [];
  for (const o of ordenes) {
    const gk = getGroupKey(o, agrupacion);
    for (const p of o.partidas) {
      const base = p.cantidad * p.precioUnitario - p.descuento;
      const ivaAmt = base * (p.porcentajeIva / 100);
      rows.push({
        folio: o.folio,
        fechaElaboracion: o.fechaSolicitud ? fmtDate(o.fechaSolicitud) : '—',
        solicitante: o.solicitanteNombre ?? '—',
        fechaLimitePago: o.fechaLimitePago ? fmtDate(o.fechaLimitePago) : '—',
        mes: o.fechaLimitePago ? getMes(o.fechaLimitePago) : '—',
        sucursal: o.sucursalNombre ?? `Suc. ${o.idSucursal}`,
        cantidad: p.cantidad,
        unidadMedida: p.unidadMedidaNombre ?? String(p.idUnidadMedida),
        proveedor: o.razonSocialProveedor ?? (o.idProveedor ? `Proveedor ${o.idProveedor}` : '—'),
        descripcion: p.descripcion,
        precioUnitario: p.precioUnitario,
        subtotalPartida: base,
        descuento: p.descuento,
        iva: ivaAmt,
        otrosImpuestos: p.otrosImpuestos,
        importeTotal: p.total,
        formaPago: o.notaFormaPago ?? '—',
        medioPago: o.notaFormaPago ?? '—',
        groupKey: gk,
      });
    }
  }
  return rows;
}

function agruparRows(rows: PartidaRow[]): Array<{ grupo: string; rows: PartidaRow[]; subtotal: number }> {
  const map = new Map<string, PartidaRow[]>();
  for (const r of rows) {
    if (!map.has(r.groupKey)) map.set(r.groupKey, []);
    map.get(r.groupKey)!.push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'es-MX'))
    .map(([grupo, rows]) => ({
      grupo,
      rows,
      subtotal: rows.reduce((s, r) => s + r.importeTotal, 0),
    }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const DARK = '#1a3a5c';
const BORDER = '#a0b8d0';
const WHITE = '#ffffff';
const HEADER_BG = '#1a3a5c';
const COL_BG = '#2c5f8a';
const EVEN_BG = '#f0f5fb';

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Arial', sans-serif",
    fontSize: 7,
    color: '#000',
    background: WHITE,
    padding: '10px 12px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `2px solid ${DARK}`,
    paddingBottom: 6,
    marginBottom: 8,
  },
  docTitle: {
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    color: DARK,
    textTransform: 'uppercase' as const,
  },
  docSub: {
    fontSize: 7.5,
    color: '#555',
    marginTop: 2,
  },
  docMeta: {
    textAlign: 'right' as const,
    fontSize: 7,
    color: '#444',
    lineHeight: 1.5,
  },
  groupHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    fontSize: 8,
    padding: '3px 6px',
    letterSpacing: 0.5,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: 8,
    tableLayout: 'fixed' as const,
  },
  th: {
    background: COL_BG,
    color: WHITE,
    fontWeight: 700,
    fontSize: 6.5,
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    textAlign: 'left' as const,
    verticalAlign: 'bottom' as const,
    wordBreak: 'break-word' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
    lineHeight: 1.2,
  },
  thR: {
    background: COL_BG,
    color: WHITE,
    fontWeight: 700,
    fontSize: 6.5,
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    textAlign: 'right' as const,
    verticalAlign: 'bottom' as const,
    wordBreak: 'break-word' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
    lineHeight: 1.2,
  },
  td: {
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    fontSize: 7,
    verticalAlign: 'top' as const,
    wordBreak: 'break-word' as const,
    overflow: 'hidden' as const,
    lineHeight: 1.2,
  },
  tdR: {
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    fontSize: 7,
    textAlign: 'right' as const,
    verticalAlign: 'top' as const,
    lineHeight: 1.2,
  },
  tdEven: {
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    fontSize: 7,
    verticalAlign: 'top' as const,
    wordBreak: 'break-word' as const,
    overflow: 'hidden' as const,
    background: EVEN_BG,
    lineHeight: 1.2,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdEvenR: {
    padding: '2px 3px',
    border: `1px solid ${BORDER}`,
    fontSize: 7,
    textAlign: 'right' as const,
    verticalAlign: 'top' as const,
    background: EVEN_BG,
    lineHeight: 1.2,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  subtotalRow: {
    background: '#d9e8f8',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  grandTotalBox: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  grandTotalTable: {
    borderCollapse: 'collapse' as const,
    width: 240,
  },
  firmaSection: {
    marginTop: 14,
    pageBreakInside: 'avoid' as const,
  },
  firmaGrid: {
    display: 'flex',
    gap: 12,
    marginTop: 6,
  },
  firmaBox: {
    flex: 1,
    border: `1px solid ${BORDER}`,
    padding: '4px 6px',
    minHeight: 50,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end',
  },
  firmaLabel: {
    background: COL_BG,
    color: WHITE,
    fontWeight: 700,
    fontSize: 7,
    padding: '2px 5px',
    textAlign: 'center' as const,
    marginBottom: 4,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaLine: {
    borderTop: `1px solid #999`,
    marginTop: 20,
    paddingTop: 3,
    fontSize: 7,
    color: '#444',
    textAlign: 'center' as const,
  },
  footer: {
    marginTop: 8,
    borderTop: `1px solid #ccc`,
    paddingTop: 3,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 6.5,
    color: '#888',
  },
};

// Column widths for 18 columns in landscape A4 (~277mm usable)
const COL_WIDTHS = [
  '6%',   // Folio
  '4%',   // Fecha elab
  '5%',   // Solicitante
  '4%',   // F. Límite Pago
  '3%',   // Mes
  '5%',   // Sucursal
  '2.5%', // Cantidad
  '3%',   // U. Medida
  '7%',   // Proveedor
  '10%',  // Descripción
  '5%',   // Precio Unit
  '5%',   // Subtotal
  '4%',   // Descuento
  '5%',   // IVA
  '4%',   // Otros Imp
  '5.5%', // Importe Total
  '6%',   // Forma Pago
  '6%',   // Medio Pago
];

const COL_HEADERS = [
  'Folio',
  'F. Elab.',
  'Solicitante',
  'F. Límite Pago',
  'Mes',
  'Sucursal',
  'Cant.',
  'U. Med.',
  'Proveedor',
  'Descripción',
  'P. Unitario',
  'Subtotal',
  'Descuento',
  'IVA',
  'Otros Imp.',
  'Importe Total',
  'Forma Pago',
  'Medio Pago',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function EnvioConcentradoPDF({ ordenes, agrupacion, generadoPor }: Props) {
  const allRows = buildRows(ordenes, agrupacion);
  const grupos = agruparRows(allRows);
  const grandTotal = allRows.reduce((s, r) => s + r.importeTotal, 0);
  const totalPartidas = allRows.length;
  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div id="envio-concentrado-pdf-print" style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={logoImage}
            alt="Grupo Lefarma"
            style={{ width: 80, height: 32, objectFit: 'contain' }}
          />
          <div>
            <div style={s.docTitle}>Concentrado de Órdenes de Compra</div>
            <div style={s.docSub}>
              Pendientes de Aprobación — Dirección Corporativa · Agrupado por: {AGRUPACION_LABELS[agrupacion]}
            </div>
          </div>
        </div>
        <div style={s.docMeta}>
          <div><strong>Fecha:</strong> {fechaStr}</div>
          {generadoPor && <div><strong>Preparado por:</strong> {generadoPor}</div>}
          <div><strong>Órdenes:</strong> {ordenes.length} &nbsp;·&nbsp; <strong>Partidas:</strong> {totalPartidas}</div>
        </div>
      </div>

      {/* ── GRUPOS ── */}
      {grupos.map(({ grupo, rows, subtotal }) => (
        <div key={grupo} style={{ marginBottom: 4, pageBreakInside: 'avoid' as const }}>
          <div style={s.groupHeader}>▸ {grupo.toUpperCase()}</div>
          <table style={s.table}>
            <colgroup>
              {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                {COL_HEADERS.map((h, i) => (
                  <th key={i} style={i >= 10 && i <= 15 ? s.thR : s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const even = i % 2 === 1;
                const td = even ? s.tdEven : s.td;
                const tdr = even ? s.tdEvenR : s.tdR;
                return (
                  <tr key={i}>
                    <td style={td}>{r.folio}</td>
                    <td style={td}>{r.fechaElaboracion}</td>
                    <td style={td}>{r.solicitante}</td>
                    <td style={td}>{r.fechaLimitePago}</td>
                    <td style={td}>{r.mes}</td>
                    <td style={td}>{r.sucursal}</td>
                    <td style={tdr}>{r.cantidad}</td>
                    <td style={td}>{r.unidadMedida}</td>
                    <td style={td}>{r.proveedor}</td>
                    <td style={td}>{r.descripcion}</td>
                    <td style={tdr}>{fmtMoney(r.precioUnitario)}</td>
                    <td style={tdr}>{fmtMoney(r.subtotalPartida)}</td>
                    <td style={tdr}>{r.descuento > 0 ? fmtMoney(r.descuento) : '—'}</td>
                    <td style={tdr}>{fmtMoney(r.iva)}</td>
                    <td style={tdr}>{r.otrosImpuestos > 0 ? fmtMoney(r.otrosImpuestos) : '—'}</td>
                    <td style={{ ...tdr, fontWeight: 600 }}>{fmtMoney(r.importeTotal)}</td>
                    <td style={td}>{r.formaPago}</td>
                    <td style={td}>{r.medioPago}</td>
                  </tr>
                );
              })}
              {/* Group subtotal */}
              <tr style={s.subtotalRow}>
                <td
                  colSpan={15}
                  style={{
                    padding: '2px 4px',
                    border: `1px solid ${BORDER}`,
                    fontSize: 7,
                    fontWeight: 700,
                    textAlign: 'right' as const,
                    background: '#d9e8f8',
                    printColorAdjust: 'exact' as const,
                    WebkitPrintColorAdjust: 'exact' as const,
                  }}
                >
                  Subtotal — {grupo}
                </td>
                <td
                  colSpan={3}
                  style={{
                    padding: '2px 4px',
                    border: `1px solid ${BORDER}`,
                    fontSize: 7.5,
                    fontWeight: 700,
                    textAlign: 'right' as const,
                    color: DARK,
                    background: '#d9e8f8',
                    printColorAdjust: 'exact' as const,
                    WebkitPrintColorAdjust: 'exact' as const,
                  }}
                >
                  {fmtMoney(subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* ── GRAND TOTAL ── */}
      <div style={s.grandTotalBox}>
        <table style={s.grandTotalTable}>
          <tbody>
            <tr>
              <td style={{
                background: HEADER_BG,
                color: WHITE,
                fontWeight: 700,
                padding: '3px 8px',
                border: `1px solid ${BORDER}`,
                fontSize: 8,
                textAlign: 'right' as const,
                letterSpacing: 0.5,
                printColorAdjust: 'exact' as const,
                WebkitPrintColorAdjust: 'exact' as const,
              }}>
                TOTAL GENERAL
              </td>
              <td style={{
                padding: '3px 8px',
                border: `1px solid ${BORDER}`,
                fontSize: 9,
                fontWeight: 700,
                textAlign: 'right' as const,
                color: DARK,
                background: '#f0f5ff',
                printColorAdjust: 'exact' as const,
                WebkitPrintColorAdjust: 'exact' as const,
              }}>
                {fmtMoney(grandTotal)}
              </td>
            </tr>
            <tr>
              <td style={{
                background: COL_BG,
                color: WHITE,
                fontWeight: 700,
                padding: '3px 8px',
                border: `1px solid ${BORDER}`,
                fontSize: 7,
                textAlign: 'right' as const,
                printColorAdjust: 'exact' as const,
                WebkitPrintColorAdjust: 'exact' as const,
              }}>
                Partidas totales
              </td>
              <td style={{
                padding: '3px 8px',
                border: `1px solid ${BORDER}`,
                fontSize: 8,
                fontWeight: 700,
                textAlign: 'right' as const,
                color: DARK,
              }}>
                {totalPartidas}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FIRMAS ── */}
      <div style={s.firmaSection}>
        <div style={s.groupHeader}>Autorizaciones</div>
        <div style={s.firmaGrid}>
          {['Elaboró (GAF)', 'Visto Bueno — Dirección Corporativa'].map((label) => (
            <div key={label} style={s.firmaBox}>
              <div style={s.firmaLabel}>{label}</div>
              <div style={s.firmaLine}>Nombre y Firma</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={s.footer}>
        <span>LEF-AYF — Concentrado de Órdenes</span>
        <span>Generado: {fechaStr}</span>
        <span>Documento interno — No válido sin firma</span>
      </div>
    </div>
  );
}

export default EnvioConcentradoPDF;
