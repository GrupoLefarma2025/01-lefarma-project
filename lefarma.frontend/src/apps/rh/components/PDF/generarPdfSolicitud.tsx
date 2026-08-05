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

  console.log('[generarPdfSolicitud] portal encontrado:', {
    width: portalEl.clientWidth,
    height: portalEl.clientHeight,
    scrollWidth: portalEl.scrollWidth,
    scrollHeight: portalEl.scrollHeight,
    children: portalEl.children.length,
    firstChildHeight: portalEl.children[0]?.clientHeight,
    firstChildScrollHeight: portalEl.children[0]?.scrollHeight,
    htmlPreview: portalEl.innerHTML.slice(0, 300),
  });

  // Wait for images to load
  const imgs = portalEl.querySelectorAll<HTMLImageElement>('img');
  console.log('[generarPdfSolicitud] imágenes encontradas:', imgs.length);
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
    logging: true,
  });

  console.log('[generarPdfSolicitud] canvas:', {
    width: canvas.width,
    height: canvas.height,
    imgDataPrefix: canvas.toDataURL('image/png').slice(0, 100),
  });

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
