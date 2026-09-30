import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';

const PORTAL_ID = 'solicitud-personal-envio-director-pdf-portal';

export async function generarPdfSolicitud(
  _solicitud: SolicitudPersonalResponse,
  _historial: HistorialWorkflowItemResponse[],
  _pasosWorkflow: WorkflowPasoFlowResponse[]
): Promise<Blob> {
  const portalEl = document.getElementById(PORTAL_ID);
  if (!portalEl) {
    throw new Error('No se encontró el portal del PDF para envío a director');
  }

  // Wait for images to load
  const imgs = portalEl.querySelectorAll<HTMLImageElement>('img');
  await Promise.all(
    [...imgs].map((img) =>
      img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => {})
    )
  );

  await new Promise((resolve) => setTimeout(resolve, 300));

  const canvas = await html2canvas(portalEl, {
    scale: 2,
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

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'letter');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
  const scaledWidth = imgWidth * ratio;
  const scaledHeight = imgHeight * ratio;
  const x = (pageWidth - scaledWidth) / 2;
  const y = 0;

  pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

  return pdf.output('blob');
}
