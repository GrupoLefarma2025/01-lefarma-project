import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import logoImage from '@/assets/logo.png';

export type AgrupacionKey = 'sucursal' | 'empresa' | 'area' | 'proveedor';

export const AGRUPACION_LABELS: Record<AgrupacionKey, string> = {
  sucursal: 'Sucursal',
  empresa: 'Empresa',
  area: 'Área',
  proveedor: 'Proveedor',
};

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

function nombreSolicitanteMostrar(o: OrdenCompraResponse): string {
  const esCorreoGrupolefarma = (o.solicitanteCorreo ?? '')
    .toLowerCase()
    .trim()
    .endsWith('@grupolefarma.com.mx');
  return esCorreoGrupolefarma
    ? (o.segundoAutorizador ?? o.solicitanteNombre ?? '—')
    : (o.solicitanteNombre ?? '—');
}

interface OrdenRow {
  folio: string;
  fechaElaboracion: string;
  solicitante: string;
  fechaLimitePago: string;
  mes: string;
  sucursal: string;
  cantidad: string;
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
  notaOrden: string;
  groupKey: string;
}

function buildRows(ordenes: OrdenCompraResponse[], agrupacion: AgrupacionKey): OrdenRow[] {
  const rows: OrdenRow[] = [];
  for (const o of ordenes) {
    const gk = getGroupKey(o, agrupacion);
    const cantidad = o.partidas.map((p) => String(p.cantidad)).join('\n');
    const precioUnitario = o.partidas.reduce((s, p) => s + p.precioUnitario, 0);
    const subtotalPartida = o.partidas.reduce((s, p) => s + (p.cantidad * p.precioUnitario - p.descuento), 0);
    const descuento = o.partidas.reduce((s, p) => s + p.descuento, 0);
    const iva = o.partidas.reduce((s, p) => {
      const base = p.cantidad * p.precioUnitario - p.descuento;
      return s + base * (p.porcentajeIva / 100);
    }, 0);
    const otrosImpuestos = o.partidas.reduce((s, p) => s + p.otrosImpuestos, 0);
    const importeTotal = o.partidas.reduce((s, p) => s + p.total, 0);
    const descripcion = o.partidas.map((p) => p.descripcion).join('\n');
    const unidadMedida = o.partidas.map((p) => p.unidadMedidaNombre ?? String(p.idUnidadMedida)).join('\n');

    rows.push({
      folio: o.folio,
      fechaElaboracion: o.fechaSolicitud ? fmtDate(o.fechaSolicitud) : '—',
      solicitante: nombreSolicitanteMostrar(o),
      fechaLimitePago: o.fechaLimitePago ? fmtDate(o.fechaLimitePago) : '—',
      mes: o.fechaLimitePago ? getMes(o.fechaLimitePago) : '—',
      sucursal: o.sucursalNombre ?? `Suc. ${o.idSucursal}`,
      cantidad,
      unidadMedida,
      proveedor: o.razonSocialProveedor ?? (o.idProveedor ? `Proveedor ${o.idProveedor}` : '—'),
      descripcion,
      precioUnitario,
      subtotalPartida,
      descuento,
      iva,
      otrosImpuestos,
      importeTotal,
      formaPago: o.formasPagoNombres?.length ? o.formasPagoNombres.join(', ') : '—',
      medioPago: o.notaFormaPago ?? '—',
      notaOrden: o.notasGenerales ?? '—',
      groupKey: gk,
    });
  }
  return rows;
}

function agruparRows(rows: OrdenRow[]): Array<{ grupo: string; rows: OrdenRow[]; subtotal: number }> {
  const map = new Map<string, OrdenRow[]>();
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

// One flat row per partida (modo detalle con 2+ órdenes)
interface PartidaRow {
  idOrden: number;
  folio: string;
  numeroPartida: number;
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
  notaOrden: string;
  groupKey: string;
}

function buildPartidaRows(ordenes: OrdenCompraResponse[], agrupacion: AgrupacionKey): PartidaRow[] {
  const rows: PartidaRow[] = [];
  for (const o of ordenes) {
    const gk = getGroupKey(o, agrupacion);
    for (const p of o.partidas) {
      const base = p.cantidad * p.precioUnitario - p.descuento;
      rows.push({
        idOrden: o.idOrden,
        folio: o.folio,
        numeroPartida: p.numeroPartida,
        fechaElaboracion: o.fechaSolicitud ? fmtDate(o.fechaSolicitud) : '—',
        solicitante: nombreSolicitanteMostrar(o),
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
        iva: base * (p.porcentajeIva / 100),
        otrosImpuestos: p.otrosImpuestos,
        importeTotal: p.total,
        formaPago: o.formasPagoNombres?.length ? o.formasPagoNombres.join(', ') : '—',
        medioPago: o.notaFormaPago ?? '—',
        notaOrden: o.notasGenerales ?? '—',
        groupKey: gk,
      });
    }
  }
  return rows;
}

function agruparPartidas(rows: PartidaRow[]): Array<{
  grupo: string;
  ordenes: Array<{ idOrden: number; folio: string; partidas: PartidaRow[]; subtotal: number }>;
  subtotal: number;
}> {
  const map = new Map<string, PartidaRow[]>();
  for (const r of rows) {
    if (!map.has(r.groupKey)) map.set(r.groupKey, []);
    map.get(r.groupKey)!.push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'es-MX'))
    .map(([grupo, filas]) => {
      const ordenes: Array<{ idOrden: number; folio: string; partidas: PartidaRow[]; subtotal: number }> = [];
      for (const f of filas) {
        const actual = ordenes[ordenes.length - 1];
        if (actual && actual.idOrden === f.idOrden) {
          actual.partidas.push(f);
        } else {
          ordenes.push({ idOrden: f.idOrden, folio: f.folio, partidas: [f], subtotal: 0 });
        }
      }
      for (const ord of ordenes) ord.subtotal = ord.partidas.reduce((s, p) => s + p.importeTotal, 0);
      return {
        grupo,
        ordenes,
        subtotal: ordenes.reduce((s, o) => s + o.subtotal, 0),
      };
    });
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

async function loadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface GenerarPdfOptions {
  ordenes: OrdenCompraResponse[];
  agrupacion: AgrupacionKey;
  generadoPor?: string;
  /** Firma del GAF — rol Autorizó */
  firmaAutorizo?: string;
  /** Firma del revisor (usuario 44) — rol Revisó */
  firmaReviso?: string;
  /** Nombre completo del revisor (usuario 44) para la etiqueta */
  nombreReviso?: string;
  /** Nombre completo del autorizador (GAF, usuario 41) para la etiqueta */
  nombreAutorizo?: string;
}

const DARK = '#1a3a5c';
const COL_BG = '#2c5f8a';
const WHITE = '#ffffff';

export async function generarConcentradoPDF(options: GenerarPdfOptions): Promise<Blob> {
  const { ordenes, agrupacion, generadoPor, firmaAutorizo, firmaReviso, nombreReviso, nombreAutorizo } = options;
  
  const allRows = buildRows(ordenes, agrupacion);
  const detallePartidas = ordenes.length > 1;
  const partidaRows = detallePartidas ? buildPartidaRows(ordenes, agrupacion) : [];
  const grupos = agruparRows(allRows);
  const gruposPartidas = detallePartidas ? agruparPartidas(partidaRows) : [];
  const grandTotal = detallePartidas
    ? partidaRows.reduce((s, r) => s + r.importeTotal, 0)
    : allRows.reduce((s, r) => s + r.importeTotal, 0);
  const totalPartidas = detallePartidas ? partidaRows.length : allRows.length;
  
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const fechaStr = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const EVEN_BG = '#f0f5fb';
  // Separador sutil entre bloques de orden (modo detalle por partida)
  const ORDER_TINT = '#f7fafd';
  const ORDER_SUBTOTAL_BG = '#e6effb';
  const pageW = doc.internal.pageSize.width;

  // ── HEADER ──
  // Load logo
  const logoBase64 = await loadImageAsBase64(logoImage);
  
  // Header background
  doc.setFillColor(WHITE);
  doc.rect(0, 0, pageW, 22, 'F');
  
  // Logo
  doc.addImage(logoBase64, 'PNG', 10, 4, 28, 12);
  
  // Title
  doc.setTextColor(DARK);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CONCENTRADO DE ÓRDENES DE COMPRA', 42, 10);
  
  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#555');
  doc.text(`Pendientes de Aprobación — Dirección Corporativa · Agrupado por: ${AGRUPACION_LABELS[agrupacion]}`, 42, 15);

  // Separator line
  doc.setDrawColor(DARK);
  doc.setLineWidth(0.5);
  doc.line(10, 18, pageW - 10, 18);

  // Meta info (right side)
  doc.setFontSize(7);
  doc.setTextColor('#444');
  doc.text(`Fecha: ${fechaStr}`, pageW - 10, 8, { align: 'right' });
  if (generadoPor) {
    doc.text(`Preparado por: ${generadoPor}`, pageW - 10, 12, { align: 'right' });
  }
  doc.text(`Órdenes: ${ordenes.length} · Partidas: ${totalPartidas}`, pageW - 10, 16, { align: 'right' });

  let startY = 24;

  // ── TABLE COLUMNS ──
  const colHeaders = [
    'Folio', 'F. Elab.', 'Solicitante', 'F. Límite Pago', 'Mes', 'Sucursal',
    'Cant.', 'U. Med.', 'Proveedor', 'Descripción', 'P. Unitario', 'Subtotal',
    'Descuento', 'Impuesto', 'Otros Imp.', 'Importe Total', 'Forma Pago',
    'Comentario de Pago', 'Nota de la Orden'
  ];

  const colStyles = [
    { cellWidth: 18 }, { cellWidth: 12 }, { cellWidth: 20 }, { cellWidth: 14 },
    { cellWidth: 12 }, { cellWidth: 18 }, { cellWidth: 10 }, { cellWidth: 14 },
    { cellWidth: 22 }, { cellWidth: 30 }, { cellWidth: 18 }, { cellWidth: 18 },
    { cellWidth: 16 }, { cellWidth: 16 }, { cellWidth: 14 }, { cellWidth: 20 },
    { cellWidth: 20 }, { cellWidth: 24 }, { cellWidth: 24 }
  ];

  // ── GROUPS ──
  for (let gi = 0; gi < grupos.length; gi++) {
    const { grupo, subtotal } = grupos[gi];
    const pg = detallePartidas ? gruposPartidas[gi] : null;

    // Group header
    doc.setFillColor(DARK);
    doc.rect(10, startY - 4, pageW - 20, 6, 'F');
    doc.setTextColor(WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`▸ ${grupo.toUpperCase()}`, 12, startY);
    startY += 4;

    const body: any[] = [];

    if (detallePartidas && pg) {
      // Una fila por partida, agrupadas por orden
      pg.ordenes.forEach((orden, oi) => {
        const tinted = oi % 2 === 1;
        orden.partidas.forEach((r, i) => {
          const isFirst = i === 0;
          const cells = [
            `${r.folio} - ${r.numeroPartida}`,
            r.fechaElaboracion,
            r.solicitante,
            r.fechaLimitePago,
            r.mes,
            r.sucursal,
            String(r.cantidad),
            r.unidadMedida,
            r.proveedor,
            r.descripcion,
            fmtMoney(r.precioUnitario),
            fmtMoney(r.subtotalPartida),
            r.descuento > 0 ? fmtMoney(r.descuento) : '—',
            fmtMoney(r.iva),
            r.otrosImpuestos > 0 ? fmtMoney(r.otrosImpuestos) : '—',
            fmtMoney(r.importeTotal),
            isFirst ? r.formaPago : '',
            isFirst ? r.medioPago : '',
            isFirst ? r.notaOrden : '',
          ];
          body.push(tinted ? cells.map((c) => ({ content: c, styles: { fillColor: ORDER_TINT } })) : cells);
        });
        // Subtotal por orden — separador sutil entre órdenes
        body.push([
          { content: `Subtotal — Orden ${orden.folio}`, colSpan: 16, styles: { fontStyle: 'bold', fillColor: ORDER_SUBTOTAL_BG } },
          { content: fmtMoney(orden.subtotal), colSpan: 3, styles: { fontStyle: 'bold', fillColor: ORDER_SUBTOTAL_BG, halign: 'right' } }
        ]);
      });
    } else {
      const rows = grupos[gi].rows;
      rows.forEach((r) => {
        body.push([
          r.folio,
          r.fechaElaboracion,
          r.solicitante,
          r.fechaLimitePago,
          r.mes,
          r.sucursal,
          r.cantidad,
          r.unidadMedida,
          r.proveedor,
          r.descripcion,
          fmtMoney(r.precioUnitario),
          fmtMoney(r.subtotalPartida),
          r.descuento > 0 ? fmtMoney(r.descuento) : '—',
          fmtMoney(r.iva),
          r.otrosImpuestos > 0 ? fmtMoney(r.otrosImpuestos) : '—',
          fmtMoney(r.importeTotal),
          r.formaPago,
          r.medioPago,
          r.notaOrden,
        ]);
      });
    }

    // Subtotal row (grupo)
    body.push([
      { content: `Subtotal — ${grupo}`, colSpan: 16, styles: { fontStyle: 'bold', fillColor: '#d9e8f8' } },
      { content: fmtMoney(subtotal), colSpan: 3, styles: { fontStyle: 'bold', fillColor: '#d9e8f8', halign: 'right' } }
    ]);

    autoTable(doc, {
      head: [colHeaders],
      body,
      startY,
      theme: 'grid',
      styles: {
        fontSize: 6,
        cellPadding: 1,
        lineColor: '#a0b8d0',
        lineWidth: 0.2,
        valign: 'middle',
      },
      headStyles: {
        fillColor: COL_BG,
        textColor: WHITE,
        fontSize: 6,
        fontStyle: 'bold',
        cellPadding: 1,
      },
      alternateRowStyles: detallePartidas ? {} : { fillColor: EVEN_BG },
      columnStyles: Object.fromEntries(
        colStyles.map((s, i) => [i, { ...s, fontSize: 5.5 }])
      ),
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        // Re-draw header on new pages
        if (data.pageNumber > 1) {
          doc.setFillColor(DARK);
          doc.rect(0, 0, doc.internal.pageSize.width, 12, 'F');
          doc.setTextColor(WHITE);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Concentrado de Órdenes de Compra (continuación)', 10, 8);
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── GRAND TOTAL ──
  doc.setFillColor(DARK);
  doc.rect(pageW - 90, startY, 40, 6, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GENERAL', pageW - 88, startY + 4);
  
  doc.setFillColor('#f0f5ff');
  doc.rect(pageW - 50, startY, 40, 6, 'F');
  doc.setTextColor(DARK);
  doc.setFontSize(9);
  doc.text(fmtMoney(grandTotal), pageW - 12, startY + 4, { align: 'right' });
  
  startY += 10;

  doc.setFillColor(COL_BG);
  doc.rect(pageW - 90, startY, 40, 5, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(7);
  doc.text(detallePartidas ? 'Partidas totales' : 'Ordenes totales', pageW - 88, startY + 3.5);
  
  doc.setFillColor(WHITE);
  doc.rect(pageW - 50, startY, 40, 5, 'F');
  doc.setTextColor(DARK);
  doc.setFontSize(8);
  doc.text(String(totalPartidas), pageW - 12, startY + 3.5, { align: 'right' });

  startY += 12;

  // ── FIRMAS ──
  if (startY > doc.internal.pageSize.height - 40) {
    doc.addPage();
    startY = 20;
  }

  doc.setFillColor(DARK);
  doc.rect(10, startY - 4, pageW - 20, 6, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Autorizaciones', 12, startY);
  startY += 8;

  // Firrmas: Revisó | Autorizó (GAF) | Visto Bueno
  const boxW = (pageW - 40) / 3;
  const gap = 10;
  drawFirmaBox(doc, 10, startY, boxW, nombreReviso ? `Revisó — ${nombreReviso}` : 'Revisó', firmaReviso);
  drawFirmaBox(doc, 10 + (boxW + gap), startY, boxW, nombreAutorizo ? `Autorizó — ${nombreAutorizo}` : 'Autorizó', firmaAutorizo);

  // Visto Bueno
  const vx = 10 + 2 * (boxW + gap);
  doc.setDrawColor('#a0b8d0');
  doc.setLineWidth(0.3);
  doc.rect(vx, startY, boxW, 25);
  
  doc.setFillColor(COL_BG);
  doc.rect(vx, startY, boxW, 5, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(7);
  doc.text('Visto Bueno — Dirección Corporativa', vx + 2, startY + 3.5);
  
  doc.setTextColor(DARK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('#firmad', vx + boxW / 2, startY + 18, { align: 'center' });

  startY += 30;

  // ── FOOTER ──
  doc.setDrawColor('#ccc');
  doc.setLineWidth(0.2);
  doc.line(10, doc.internal.pageSize.height - 10, pageW - 10, doc.internal.pageSize.height - 10);
  
  doc.setTextColor('#888');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('LEF-AYF — Concentrado de Órdenes', 10, doc.internal.pageSize.height - 6);
  doc.text(`Generado: ${fechaStr}`, pageW / 2, doc.internal.pageSize.height - 6, { align: 'center' });
  doc.text('Documento interno — No válido sin firma', pageW - 10, doc.internal.pageSize.height - 6, { align: 'right' });

  return doc.output('blob');
}

/** Caja de firma con imagen (draws 'sin firma' si no hay imagen). Declaración hoisted. */
function drawFirmaBox(doc: jsPDF, x: number, y: number, w: number, label: string, imgSrc?: string) {
  doc.setDrawColor('#a0b8d0');
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, 25);

  doc.setFillColor(COL_BG);
  doc.rect(x, y, w, 5, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 2, y + 3.5);

  if (imgSrc) {
    try {
      // Add signature image if available
      doc.addImage(imgSrc, 'PNG', x + w / 2 - 20, y + 8, 40, 12);
    } catch {
      doc.setTextColor(DARK);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('sin firma', x + w / 2, y + 18, { align: 'center' });
    }
  } else {
    doc.setTextColor(DARK);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('sin firma', x + w / 2, y + 18, { align: 'center' });
  }
}
