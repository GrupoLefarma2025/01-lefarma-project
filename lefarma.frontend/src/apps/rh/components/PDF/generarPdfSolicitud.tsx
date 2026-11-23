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

  if (categoria === 'Incidencia' || categoria === 'Permiso') {
    return generarIncidenciaPDF(solicitud, historial, pasosWorkflow);
  }

  const portalEl = document.getElementById(PORTAL_ID);
  if (!portalEl) {
    throw new Error('No se encontró el portal del PDF para envío a director');
  }

  await waitForPrintImages(`#${PORTAL_ID}`);

  const canvas = await html2canvas(portalEl, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  if (canvas.width < 100 || canvas.height < 100) {
    throw new Error(
      `El PDF de la solicitud no se pudo renderizar (captura de ${canvas.width}x${canvas.height}px).`
    );
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

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
