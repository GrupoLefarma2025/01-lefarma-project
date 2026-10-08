import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { waitForPrintImages } from '@/utils/waitForPrintImages';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { generarIncidenciaPDF } from '@/apps/rh/utils/pdf/generarIncidenciaPDF';

const PORTAL_ID = 'solicitud-personal-envio-director-pdf-portal';

export async function generarPdfSolicitud(
  solicitud: SolicitudPersonalResponse,
  historial: HistorialWorkflowItemResponse[],
  pasosWorkflow: WorkflowPasoFlowResponse[]
): Promise<Blob> {
  const categoria = getCategoriaNombre(solicitud.categoria);

  // Migradas a generador de texto (nítido, sin html2canvas, #firmad visible y redactable).
  if (categoria === 'Incidencia' || categoria === 'Permiso') {
    return generarIncidenciaPDF(solicitud, historial, pasosWorkflow);
  }

  // No migradas: se conserva el método de imagen (portal + html2canvas) como fallback.
  const portalEl = document.getElementById(PORTAL_ID);
  if (!portalEl) {
    throw new Error('No se encontró el portal del PDF para envío a director');
  }

  // Espera a que las firmas terminen de descargarse ([data-firma-loading] de FirmaImg)
  // y a que las imágenes estén decodificadas; si no, la captura sale sin firmas.
  await waitForPrintImages(`#${PORTAL_ID}`);

  // scale 3 ≈ 288 DPI sobre la página (carta), para que el texto salga nítido.
  const canvas = await html2canvas(portalEl, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  // A collapsed capture (e.g. the print doc hidden with display:none) yields a blank
  // strip; fail loudly instead of uploading/storing a blank PDF.
  if (canvas.width < 100 || canvas.height < 100) {
    throw new Error(
      `El PDF de la solicitud no se pudo renderizar (captura de ${canvas.width}x${canvas.height}px).`
    );
  }

  // JPEG de alta calidad: a escala 3 (~288 DPI) el texto sale nítido y el PDF pesa
  // ~1 MB en vez de ~9 MB (jsPDF re-comprime mal el PNG y lo infla al tamaño crudo).
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // La página del PDF es EXACTAMENTE el tamaño del documento en px CSS @96dpi → pt,
  // sin reescalar ni centrar: lo que se ve en el preview es lo que queda guardado.
  const portalRect = portalEl.getBoundingClientRect();
  const PX_TO_PT = 0.75;
  const pageWidth = portalRect.width * PX_TO_PT;
  const pageHeight = portalRect.height * PX_TO_PT;

  const pdf = new jsPDF({
    orientation: pageHeight >= pageWidth ? 'portrait' : 'landscape',
    unit: 'pt',
    format: [pageWidth, pageHeight],
  });

  pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

  // Marca invisible "#firmad" (texto blanco) en la capa de texto del PDF: la captura
  // es una imagen rasterizada (sin texto) y el sistema externo (PyMuPDF) necesita
  // encontrar el marcador para estampar la firma del director. Se agrega por CADA
  // marcador (incidencia/permiso/goce/incapacidad llevan 2 copias) y la posición se
  // mide del DOM del portal (px CSS → pt).
  if (portalRect.width > 0 && portalRect.height > 0) {
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    portalEl.querySelectorAll<HTMLElement>('[data-firmad]').forEach((firmadEl) => {
      const firmadRect = firmadEl.getBoundingClientRect();
      const cx = firmadRect.left - portalRect.left + firmadRect.width / 2;
      const cy = firmadRect.top - portalRect.top + firmadRect.height / 2;
      pdf.text('#firmad', cx * PX_TO_PT, cy * PX_TO_PT, { align: 'center' });
    });
  }

  return pdf.output('blob');
}
