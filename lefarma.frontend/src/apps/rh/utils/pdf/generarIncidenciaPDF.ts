import { jsPDF } from 'jspdf';
import logoImage from '@/assets/logo.png';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { firmantesDelFlujo } from '@/apps/rh/components/PDF/SolicitudPersonalPDF';
import { fmtDate } from '@/apps/rh/components/PDF/pdfFormat';
import {
  INCIDENCIA_OPCIONES,
  NOTES,
  PERMISO_OPCIONES,
  indicesIncidencia,
  normalize,
  splitFechaISO,
} from './incidenciaFormato';
import {
  COLOR,
  cargarImagenBase64,
  casilla,
  caja,
  crearDoc,
  dibujarFirmas,
  fetchFirmaBase64,
  linea,
  texto,
  truncar,
  type ConfigPagina,
  type FirmaDibujo,
} from './pdfDoc';

/** LEF-RHU-FOR-007: hoja carta vertical (formato físico). El generador usa ESTA config. */
export const PAGINA_INCIDENCIA: ConfigPagina = { format: 'letter', orientation: 'portrait' };

const MARGEN_X = 4;
const ANCHO_UTIL = 215.9 - MARGEN_X * 2;
const Y_INICIAL = 6;
const GAP_COPIAS = 6;
const ALTO_FILA = 4.5;

export interface OpcionesGenerar {
  /** Inyectable en pruebas; por defecto descarga la firma autenticada como data URL. */
  loadFirma?: (endpoint: string) => Promise<string | null>;
}

interface DatosCopia {
  solicitud: SolicitudPersonalResponse;
  firmantes: FirmaDibujo[];
  logo: string | null;
}

/** Fila de opción con casilla; `shaded` pinta la banda gris (filas impares de Permiso). */
function dibujarOpcion(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  checked: boolean,
  shaded: boolean,
  spaced: boolean
): number {
  const alto = 3.2;
  if (shaded) caja(doc, x, y, w, alto, { fill: COLOR.grisBanda, borde: false });
  casilla(doc, x + 0.8, y + 0.5, 2.2, checked);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  texto(doc, truncar(doc, label, w - 4), x + 3.6, y + 2.45, { size: 5 });
  return y + alto + (spaced ? 2.2 : 0);
}

/** Rejilla DÍA/MES/AÑO; la fecha solo se escribe en la fila `fillRow` (1-based). */
function dibujarFechaGrid(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  filas: number,
  fecha: string | null | undefined,
  fillRow: number
): number {
  const hHeader = 3.5;
  const hFila = 2.5;
  const c1 = w * 0.34;
  const c2 = w * 0.33;
  const alto = hHeader + filas * hFila;

  caja(doc, x, y, w, alto);
  linea(doc, x + c1, y, x + c1, y + alto);
  linea(doc, x + c1 + c2, y, x + c1 + c2, y + alto);
  linea(doc, x, y + hHeader, x + w, y + hHeader);

  texto(doc, 'DÍA', x + c1 / 2, y + 2.6, { size: 4.2, bold: true, align: 'center' });
  texto(doc, 'MES', x + c1 + c2 / 2, y + 2.6, { size: 4.2, bold: true, align: 'center' });
  texto(doc, 'AÑO', x + w - c2 / 2, y + 2.6, { size: 4.2, bold: true, align: 'center' });

  for (let i = 0; i < filas; i++) {
    const fy = y + hHeader + i * hFila;
    if (i > 0) linea(doc, x, fy, x + w, fy);
    if (fecha && i + 1 === fillRow) {
      const { d, m, y: anio } = splitFechaISO(fecha);
      texto(doc, d, x + c1 / 2, fy + 1.9, { size: 4.5, align: 'center' });
      texto(doc, m, x + c1 + c2 / 2, fy + 1.9, { size: 4.5, align: 'center' });
      texto(doc, anio, x + w - c2 / 2, fy + 1.9, { size: 4.5, align: 'center' });
    }
  }
  return y + alto;
}

/** Dibuja una copia completa del formato y devuelve su altura total (incluye pie). */
async function dibujarCopia(
  doc: jsPDF,
  x: number,
  y0: number,
  w: number,
  datos: DatosCopia
): Promise<number> {
  const { solicitud, firmantes, logo } = datos;
  const { idxJust, idxPerm, fillRepos } = indicesIncidencia(solicitud.tipoSolicitudNombre);
  let y = y0;

  // ── ENCABEZADO (logo + título, sin divisor vertical) ──
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', x + 1, y + 0.5, 25, 7);
    } catch {
      // logo ilegible: el encabezado queda solo con el título
    }
  }
  texto(doc, 'FORMATO DE INCIDENCIAS Y PERMISOS', x + w - 3, y + 5.5, {
    size: 8,
    bold: true,
    color: COLOR.azulTitulo,
    align: 'right',
  });
  linea(doc, x, y + 9, x + w, y + 9);
  y += 9;

  // ── DATOS (Empresa | Area | Puesto | Fecha) ──
  const cw4 = w / 4;
  caja(doc, x, y, w, ALTO_FILA);
  for (let i = 1; i < 4; i++) linea(doc, x + i * cw4, y, x + i * cw4, y + ALTO_FILA);
  const celdas: Array<[string, string]> = [
    ['Empresa:', solicitud.empresaNombre ?? `ID ${solicitud.idEmpresa}`],
    ['Area:', solicitud.areaNombre ?? `ID ${solicitud.idArea ?? '-'}`],
    ['Puesto:', solicitud.solicitantePuesto ?? '-'],
    ['Fecha:', fmtDate(solicitud.fechaCreacion)],
  ];
  celdas.forEach(([etiqueta, valor], i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const cx = x + i * cw4 + 1.2;
    doc.text(etiqueta, cx, y + 3.1);
    const wEt = doc.getTextWidth(etiqueta) + 1;
    doc.setFont('helvetica', 'normal');
    texto(doc, truncar(doc, valor, cw4 - 2.5 - wEt), cx + wEt, y + 3.1, { size: 5.5 });
  });
  linea(doc, x, y + ALTO_FILA, x + w, y + ALTO_FILA);
  y += ALTO_FILA;

  // ── NOMBRE ──
  const wNomLabel = w * 0.24;
  caja(doc, x, y, w, ALTO_FILA);
  linea(doc, x + wNomLabel, y, x + wNomLabel, y + ALTO_FILA);
  texto(doc, 'NOMBRE:', x + wNomLabel / 2, y + 3.1, { size: 5.5, bold: true, align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  texto(
    doc,
    truncar(doc, solicitud.solicitanteNombre ?? '-', w - wNomLabel - 3),
    x + wNomLabel + 1.2,
    y + 3.1,
    { size: 5.5 }
  );
  linea(doc, x, y + ALTO_FILA, x + w, y + ALTO_FILA);
  y += ALTO_FILA;

  // ── BLOQUE CENTRAL (sin líneas internas, como el formato) ──
  const cw38 = w * 0.38;
  const cw24 = w * 0.24;
  const bloqueY = y;

  // Banda 1: Justificación de Incidencia | Fecha de incidencia
  let yB = bloqueY + 2;
  texto(doc, 'Justificación de Incidencia:', x + 2, yB + 2.5, { size: 5.5, bold: true });
  let yChk = yB + 4.5;
  INCIDENCIA_OPCIONES.forEach((o) => {
    yChk = dibujarOpcion(doc, x + 2, yChk, cw38 - 4, o.label, o.match(normalize(solicitud.tipoSolicitudNombre)), false, true);
  });
  const finBanda1Izq = yChk;
  const gridW = 39;
  const gridX = x + cw38 + 4;
  texto(doc, 'Fecha de incidencia', gridX + gridW / 2, yB + 2.2, { size: 5, bold: true, align: 'center' });
  const finBanda1Der = dibujarFechaGrid(doc, gridX, yB + 3, gridW, 3, solicitud.fechaInicio, idxJust >= 0 ? idxJust + 1 : 0);
  y = Math.max(finBanda1Izq, finBanda1Der) + 1;

  // Banda 2: Solicitud de Permiso | Fecha de aplicación | Reposición / Lugar de comisión
  yB = y;
  texto(doc, 'Solicitud de Permiso:', x + 2, yB + 2.5, { size: 5.5, bold: true });
  yChk = yB + 4.5;
  PERMISO_OPCIONES.forEach((o, i) => {
    yChk = dibujarOpcion(doc, x + 2, yChk, cw38 - 4, o.label, o.match(normalize(solicitud.tipoSolicitudNombre)), i % 2 === 1, false);
  });
  const finBanda2Izq = yChk;

  const medioX = x + cw38 + 4;
  const medioW = cw24 - 6;
  texto(doc, 'Fecha de aplicación:', medioX + medioW / 2, yB + 2.2, { size: 5, bold: true, align: 'center' });
  const finMedio = dibujarFechaGrid(
    doc,
    medioX,
    yB + 3,
    medioW,
    4,
    solicitud.fechaInicio,
    idxPerm >= 0 && idxPerm <= 3 ? idxPerm + 1 : 0
  );

  const derX = x + cw38 + cw24 + 2;
  const derW = w - cw38 - cw24 - 4;
  texto(doc, 'En caso de reposición de tiempo especificar:', derX, yB + 2.2, { size: 5, bold: true });
  const reposW = derW * 0.78;
  const finRepos = dibujarFechaGrid(doc, derX, yB + 3, reposW, 2, solicitud.fechaReposicion, fillRepos);
  texto(doc, 'Lugar de comisión:', derX, finRepos + 3.4, { size: 5, bold: true });
  caja(doc, derX, finRepos + 4, reposW, 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  texto(doc, truncar(doc, solicitud.lugarComision ?? '', reposW - 2), derX + 1, finRepos + 6.8, { size: 5 });
  const finBanda2Der = finRepos + 8;
  y = Math.max(finBanda2Izq, finMedio, finBanda2Der) + 1;

  // Banda 3: Consideraciones
  yB = y;
  texto(doc, 'Consideraciones:', x + 2, yB + 2.5, { size: 5.5, bold: true });
  let yNota = yB + 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  for (const nota of NOTES) {
    const lineas = doc.splitTextToSize(nota, w - 6) as string[];
    for (const ln of lineas) {
      texto(doc, ln, x + 2, yNota, { size: 4.2 });
      yNota += 1.9;
    }
  }
  y = yNota + 1;
  linea(doc, x, y, x + w, y);

  // ── DESCRIPCIÓN / MOTIVO ──
  texto(doc, 'Descripción / Motivo  / Incidencia o Permiso:', x + 2, y + 3, { size: 5.5, bold: true });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  const motivoLineas = doc.splitTextToSize(solicitud.motivo ?? '', w - 6) as string[];
  let yMotivo = y + 5.5;
  for (const ln of motivoLineas) {
    texto(doc, ln, x + 2, yMotivo, { size: 5 });
    yMotivo += 2.2;
  }
  y = Math.max(yMotivo, y + 11);
  linea(doc, x, y, x + w, y);

  // ── FIRMAS ──
  texto(doc, 'FIRMAS DE AUTORIZACIÓN', x + w / 2, y + 2.8, { size: 5, bold: true, align: 'center' });
  linea(doc, x, y + 3.8, x + w, y + 3.8);
  y += 3.8;
  const altoFirma = firmantes.length > 4 ? 9 : 11.5;
  y = await dibujarFirmas(doc, x, y, w, firmantes, { altoFirma });

  // ── BORDE EXTERIOR + PIE ──
  caja(doc, x, y0, w, y - y0);
  const pieY = y + 2.6;
  texto(doc, 'LEF-RHU-FOR-007', x + 1, pieY, { size: 4 });
  texto(doc, 'Versión: 01', x + w * 0.3, pieY, { size: 4 });
  texto(doc, 'Prohibida su reproducción no autorizada', x + w * 0.58, pieY, { size: 4 });
  texto(doc, 'Página 1 de 1', x + w - 1, pieY, { size: 4, align: 'right' });
  return pieY + 1.5 - y0;
}

/** Construye el documento (exportado para pruebas: página, texto y nº de #firmad). */
export async function generarIncidenciaDoc(
  solicitud: SolicitudPersonalResponse,
  historial: HistorialWorkflowItemResponse[] = [],
  pasosWorkflow: WorkflowPasoFlowResponse[] = [],
  opts: OpcionesGenerar = {}
): Promise<jsPDF> {
  const doc = crearDoc(PAGINA_INCIDENCIA);
  const firmantes = firmantesDelFlujo(pasosWorkflow, historial, true);
  const cargar = opts.loadFirma ?? fetchFirmaBase64;
  const [logo, imagenes] = await Promise.all([
    cargarImagenBase64(logoImage),
    Promise.all(firmantes.map((f) => (f.url ? cargar(f.url) : Promise.resolve(null)))),
  ]);
  const datos: DatosCopia = {
    solicitud,
    firmantes: firmantes.map((f, i) => ({
      nombre: f.nombre,
      imagen: imagenes[i],
      esSolicitante: f.esSolicitante,
      rol: f.rol,
      pendienteFirma: f.pendienteFirma,
    })),
    logo,
  };

  // El formato físico lleva 2 copias idénticas por hoja (original + empleado).
  const alto = await dibujarCopia(doc, MARGEN_X, Y_INICIAL, ANCHO_UTIL, datos);
  await dibujarCopia(doc, MARGEN_X, Y_INICIAL + alto + GAP_COPIAS, ANCHO_UTIL, datos);
  return doc;
}

export async function generarIncidenciaPDF(
  solicitud: SolicitudPersonalResponse,
  historial: HistorialWorkflowItemResponse[] = [],
  pasosWorkflow: WorkflowPasoFlowResponse[] = [],
  opts: OpcionesGenerar = {}
): Promise<Blob> {
  const doc = await generarIncidenciaDoc(solicitud, historial, pasosWorkflow, opts);
  return doc.output('blob');
}
