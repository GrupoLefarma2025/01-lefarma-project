import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoAsokam from '@/assets/logo_7.png';
import type { MacroViatico } from '@/types/macroViatico.types';
import {
  fmtFechaViaje,
  fmtMoney,
  fmtMoneyCelda,
  sumarCostos,
  texto,
  totalViatico,
} from './concentradoViaticos.helpers';

const NAVY = '#1f3864';
const HEADER_FILL = '#dbe5f1';
const BORDER = '#777';

const COL_WIDTHS = [8, 36, 28, 26, 38, 19, 19, 15, 15, 19, 17, 17, 20];

const REVISORES: Array<{
  accion: string;
  puesto: string;
  nombre: string;
  firma: string;
  firmaKey?: 'diego' | 'luis' | 'erick';
}> = [
  {
    accion: 'REVISÓ',
    puesto: 'Coordinador Administrativo',
    nombre: 'Erick Israel Aguilera Diaz',
    firma: '',
    firmaKey: 'erick',
  },
  {
    accion: 'REVISÓ',
    puesto: 'Gerente General',
    nombre: 'Luis Pozo Urquizo',
    firma: '',
    firmaKey: 'luis',
  },
  {
    accion: 'REVISÓ',
    puesto: 'Gerente de Administración y Finanzas',
    nombre: 'Diego Angel Villaseñor Garduño',
    firma: '',
    firmaKey: 'diego',
  },
  {
    accion: 'AUTORIZÓ',
    puesto: 'Dirección Corporativa',
    nombre: 'Lic. Héctor Vélez Rivera',
    firma: '#firmad',
  },
];

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

interface CeldaOpts {
  fill?: string;
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
}

function celda(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  contenido: string,
  opts: CeldaOpts = {},
) {
  if (opts.fill) {
    doc.setFillColor(opts.fill);
    doc.rect(x, y, w, h, 'F');
  }

  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h);

  doc.setTextColor(opts.color ?? '#222');
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.fontSize ?? 7.5);

  const align = opts.align ?? 'left';
  const tx = align === 'left' ? x + 1.5 : align === 'center' ? x + w / 2 : x + w - 1.5;
  const ty = y + h / 2 + 1.1;

  doc.text(contenido, tx, ty, { align, maxWidth: w - 3 });
}

function costosDe(fila: MacroViatico): Array<number | null> {
  return [
    fila.costoAutobus,
    fila.costoAvion,
    fila.costoGasolina,
    fila.costoCasetas,
    fila.costoHospedaje,
    fila.costoComida,
    fila.costoTaxi,
  ];
}

export interface GenerarConcentradoViaticosPdfOptions {
  filas: MacroViatico[];
  nombre: string;
  gerencia: string;
  fecha: string;
  firmas?: {
    diego?: string | null;
    luis?: string | null;
    erick?: string | null;
  };
}

export async function generarConcentradoViaticosPDF(
  options: GenerarConcentradoViaticosPdfOptions,
): Promise<Blob> {
  const { filas, nombre, gerencia, fecha } = options;

  let firmaDiegoBase64: string | null = null;
  let firmaLuisBase64: string | null = null;
  let firmaErickBase64: string | null = null;
  await Promise.all([
    options.firmas?.diego
      ? loadImageAsBase64(options.firmas.diego)
          .then((base64) => {
            firmaDiegoBase64 = base64;
          })
          .catch(() => {
            firmaDiegoBase64 = null;
          })
      : Promise.resolve(),
    options.firmas?.luis
      ? loadImageAsBase64(options.firmas.luis)
          .then((base64) => {
            firmaLuisBase64 = base64;
          })
          .catch(() => {
            firmaLuisBase64 = null;
          })
      : Promise.resolve(),
    options.firmas?.erick
      ? loadImageAsBase64(options.firmas.erick)
          .then((base64) => {
            firmaErickBase64 = base64;
          })
          .catch(() => {
            firmaErickBase64 = null;
          })
      : Promise.resolve(),
  ]);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;

  const logoBase64 = await loadImageAsBase64(logoAsokam);
  doc.addImage(logoBase64, 'PNG', 10, 8, 26, 9.5);

  doc.setTextColor('#5b9bd5');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Concentrado de Viáticos', pageW - 10, 16, { align: 'right' });

  doc.setTextColor('#222222');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre:', 10, 30);
  doc.text('Gerencia:', 92, 30);
  doc.text('Fecha:', 214, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(texto(nombre), 27, 30);
  doc.text(texto(gerencia), 117, 30);
  doc.text(texto(fecha), 230, 30);

  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.15);
  doc.line(27, 33.5, 90, 33.5);
  doc.line(117, 33.5, 210, 33.5);
  doc.line(230, 33.5, 287, 33.5);

  const body = filas.map((fila, indice) => [
    (indice + 1).toString(),
    texto(fila.solicitante),
    fmtFechaViaje(fila.fechInicio, fila.fechaFin),
    texto(fila.origen),
    texto(fila.destino),
    ...costosDe(fila).map(fmtMoneyCelda),
    fmtMoney(totalViatico(fila)),
  ]);

  autoTable(doc, {
    head: [
      [
        { content: 'No.', rowSpan: 2 },
        { content: 'Solicitante', rowSpan: 2 },
        { content: 'Fecha', rowSpan: 2 },
        { content: 'Origen', rowSpan: 2 },
        { content: 'Destino', rowSpan: 2 },
        { content: 'Transporte', colSpan: 2 },
        { content: 'Automóvil propio', colSpan: 2 },
        { content: 'Hospedaje', rowSpan: 2 },
        { content: 'Comida', rowSpan: 2 },
        { content: 'Taxi', rowSpan: 2 },
        { content: 'Total', rowSpan: 2 },
      ],
      [
        { content: 'Costo boleto Autobús' },
        { content: 'Costo boleto Avión' },
        { content: 'Gasolina' },
        { content: 'Casetas' },
      ],
    ],
    body,
    startY: 38,
    theme: 'grid',
    showHead: 'firstPage',
    styles: {
      fontSize: 7,
      cellPadding: 1.4,
      lineColor: BORDER,
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: NAVY,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: COL_WIDTHS[0], halign: 'center' },
      1: { cellWidth: COL_WIDTHS[1] },
      2: { cellWidth: COL_WIDTHS[2], halign: 'center' },
      3: { cellWidth: COL_WIDTHS[3] },
      4: { cellWidth: COL_WIDTHS[4] },
      5: { cellWidth: COL_WIDTHS[5], halign: 'right' },
      6: { cellWidth: COL_WIDTHS[6], halign: 'right' },
      7: { cellWidth: COL_WIDTHS[7], halign: 'right' },
      8: { cellWidth: COL_WIDTHS[8], halign: 'right' },
      9: { cellWidth: COL_WIDTHS[9], halign: 'right' },
      10: { cellWidth: COL_WIDTHS[10], halign: 'right' },
      11: { cellWidth: COL_WIDTHS[11], halign: 'right' },
      12: { cellWidth: COL_WIDTHS[12], halign: 'right' },
    },
    margin: { top: 10, left: 10, right: 10, bottom: 14 },
  });

  const totales = sumarCostos(filas);
  const totalRowHeight = 7;
  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 38;

  if (y + totalRowHeight + 50 > pageH - 10) {
    doc.addPage();
    y = 14;
  }

  const firstFiveWidth = COL_WIDTHS.slice(0, 5).reduce((sum, w) => sum + w, 0);
  const totalLabelX = 10 + firstFiveWidth - COL_WIDTHS[4];
  celda(doc, totalLabelX, y, COL_WIDTHS[4], totalRowHeight, 'Total', {
    fill: HEADER_FILL,
    color: '#000000',
    bold: true,
    align: 'right',
  });

  const totalValues = [
    fmtMoneyCelda(totales.costoAutobus),
    fmtMoneyCelda(totales.costoAvion),
    fmtMoneyCelda(totales.costoGasolina),
    fmtMoneyCelda(totales.costoCasetas),
    fmtMoneyCelda(totales.costoHospedaje),
    fmtMoneyCelda(totales.costoComida),
    fmtMoneyCelda(totales.costoTaxi),
    fmtMoney(totales.total),
  ];

  let totalX = 10 + firstFiveWidth;
  for (let i = 0; i < totalValues.length; i++) {
    const width = COL_WIDTHS[i + 5];
    celda(doc, totalX, y, width, totalRowHeight, totalValues[i], {
      bold: true,
      align: 'right',
      fontSize: 6.8,
    });
    totalX += width;
  }

  y += totalRowHeight;

  const signatureWidths = [22, 55, 60, 33];
  const signatureHeaderH = 7;
  const signatureRowH = 9;

  if (y + signatureHeaderH + signatureRowH * REVISORES.length > pageH - 10) {
    doc.addPage();
    y = 14;
  }

  const signatureX = 10;
  const [actionW, puestoW, nombreW, firmaW] = signatureWidths;

  celda(doc, signatureX, y, actionW, signatureHeaderH, '', {
    fill: '#ffffff',
    color: '#222222',
    bold: true,
    align: 'center',
  });
  celda(doc, signatureX + actionW, y, puestoW, signatureHeaderH, 'PUESTO', {
    fill: NAVY,
    color: '#ffffff',
    bold: true,
    align: 'center',
  });
  celda(doc, signatureX + actionW + puestoW, y, nombreW, signatureHeaderH, 'NOMBRE', {
    fill: NAVY,
    color: '#ffffff',
    bold: true,
    align: 'center',
  });
  celda(
    doc,
    signatureX + actionW + puestoW + nombreW,
    y,
    firmaW,
    signatureHeaderH,
    'FIRMA',
    { fill: NAVY, color: '#ffffff', bold: true, align: 'center' },
  );

  const firstRowY = y + signatureHeaderH;

  REVISORES.forEach((revisor, index) => {
    const rowY = firstRowY + signatureRowH * index;
    const actionX = signatureX;
    const puestoX = signatureX + actionW;
    const nombreX = puestoX + puestoW;
    const firmaX = nombreX + nombreW;

    celda(doc, actionX, rowY, actionW, signatureRowH, revisor.accion, {
      fill: NAVY,
      color: '#ffffff',
      bold: true,
      align: 'center',
      fontSize: 6.8,
    });

    celda(doc, puestoX, rowY, puestoW, signatureRowH, revisor.puesto, {
      align: 'center',
    });
    celda(doc, nombreX, rowY, nombreW, signatureRowH, revisor.nombre, {
      align: 'center',
    });

    const firmaBase64 =
      revisor.firmaKey === 'diego'
        ? firmaDiegoBase64
        : revisor.firmaKey === 'luis'
          ? firmaLuisBase64
          : revisor.firmaKey === 'erick'
            ? firmaErickBase64
            : null;

    if (firmaBase64) {
      celda(doc, firmaX, rowY, firmaW, signatureRowH, '', { align: 'center' });
      const props = doc.getImageProperties(firmaBase64);
      const maxW = firmaW - 4;
      const maxH = signatureRowH - 2;
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const imgW = props.width * ratio;
      const imgH = props.height * ratio;
      doc.addImage(
        firmaBase64,
        'PNG',
        firmaX + (firmaW - imgW) / 2,
        rowY + (signatureRowH - imgH) / 2,
        imgW,
        imgH,
      );
    } else {
      celda(doc, firmaX, rowY, firmaW, signatureRowH, revisor.firma, {
        align: 'center',
      });
    }
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor('#999999');
    doc.setLineWidth(0.2);
    doc.line(10, pageH - 8, pageW - 10, pageH - 8);

    doc.setTextColor('#555555');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('ASK-ADM-FOR-008', 10, pageH - 4);
    doc.text('Versió:01', 70, pageH - 4);
    doc.text('Prohibida su reproducción no autorizada', 110, pageH - 4);
    doc.text(`Página ${page} de ${totalPages}`, pageW - 10, pageH - 4, {
      align: 'right',
    });
  }

  return doc.output('blob');
}
