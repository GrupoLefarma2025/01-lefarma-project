import { jsPDF } from 'jspdf';
import { API } from '@/shared/api/apiClient';

/** Tamaño carta en mm (jsPDF con unit:'mm'). */
export const CARTA = { w: 215.9, h: 279.4 } as const;

export const COLOR = {
  negro: '#000000',
  azulTitulo: '#00B0F0',
  bordeCheckbox: '#41719C',
  grisBanda: '#EDEDED',
  tintaFirmad: '#1a3a5c',
} as const;

export interface ConfigPagina {
  format?: 'letter' | 'a4';
  orientation?: 'portrait' | 'landscape';
}

/** Crea el documento con la página CONFIGURADA del formato. */
export function crearDoc(config: ConfigPagina = {}): jsPDF {
  return new jsPDF({
    orientation: config.orientation ?? 'portrait',
    unit: 'mm',
    format: config.format ?? 'letter',
    compress: false, // sin comprimir: la capa de texto queda buscable (#firmad, folios)
  });
}

export interface OpcionesTexto {
  size?: number; // pt
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  maxWidth?: number;
}

export function texto(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  opts: OpcionesTexto = {}
) {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 6);
  doc.setTextColor(opts.color ?? COLOR.negro);
  doc.text(value, x, y, {
    align: opts.align ?? 'left',
    ...(opts.maxWidth ? { maxWidth: opts.maxWidth } : {}),
  });
}

export function caja(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: string; borde?: boolean; grosor?: number } = {}
) {
  const conBorde = opts.borde !== false;
  if (opts.fill) doc.setFillColor(opts.fill);
  if (conBorde) {
    doc.setDrawColor(COLOR.negro);
    doc.setLineWidth(opts.grosor ?? 0.15);
  }
  doc.rect(x, y, w, h, opts.fill ? (conBorde ? 'FD' : 'F') : 'S');
}

export function linea(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, grosor = 0.15) {
  doc.setDrawColor(COLOR.negro);
  doc.setLineWidth(grosor);
  doc.line(x1, y1, x2, y2);
}

/** Casilla de verificación (cuadro + X). `lado` en mm. */
export function casilla(doc: jsPDF, x: number, y: number, lado: number, marcada: boolean) {
  doc.setDrawColor(COLOR.bordeCheckbox);
  doc.setLineWidth(0.2);
  doc.setFillColor('#ffffff');
  doc.rect(x, y, lado, lado, 'FD');
  if (marcada) {
    texto(doc, 'X', x + lado / 2, y + lado - 0.25, {
      size: 5.5,
      bold: true,
      align: 'center',
    });
  }
}

/**
 * Recorta un texto al ancho disponible agregando '…'.
 * IMPORTANTE: llamar con la fuente/tamaño ya fijados en el doc (usa getTextWidth).
 */
export function truncar(doc: jsPDF, value: string, maxW: number): string {
  if (doc.getTextWidth(value) <= maxW) return value;
  let s = value;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

/** Formato jsPDF según el data URL (las firmas capturadas son PNG; hay legacy JPEG). */
export function formatoImagen(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')
    ? 'JPEG'
    : 'PNG';
}

/** Mide una imagen desde su data URL (para no deformar firmas). Nunca rechaza. */
export function medirImagen(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const fin = (w: number, h: number) => resolve({ w: w || 3, h: h || 1 });
    const timer = setTimeout(() => fin(3, 1), 500); // jsdom no carga imágenes: fallback
    img.onload = () => {
      clearTimeout(timer);
      fin(img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => {
      clearTimeout(timer);
      fin(3, 1);
    };
    img.src = dataUrl;
  });
}

/** Descarga autenticada de una firma como data URL (null en 403/404/vacío). */
export async function fetchFirmaBase64(endpoint: string): Promise<string | null> {
  try {
    const res = await API.get(endpoint, { responseType: 'blob' });
    const blob = res.data as Blob;
    if (!blob || blob.size === 0) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Convierte una URL (p. ej. el logo importado) a data URL. null si falla. */
export async function cargarImagenBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Marcador visible de la firma del director, como el concentrado de OC. */
export function firmad(doc: jsPDF, cx: number, baselineY: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(COLOR.tintaFirmad);
  doc.text('#firmad', cx, baselineY, { align: 'center' });
}

export interface FirmaDibujo {
  nombre: string;
  imagen?: string | null;
  esSolicitante: boolean;
  /** Etiqueta de la caja (SOLICITA/AUTORIZA/ELABORA); si falta se deduce de esSolicitante. */
  rol?: string;
  pendienteFirma?: boolean;
}

export interface OpcionesFirmas {
  altoFirma?: number; // mm de la zona de firma (default 11.5)
  altoEtiqueta?: number; // mm de la zona rol+nombre (default 7.5)
  maxPorFila?: number; // default 4
}

/**
 * Dibuja la fila de cajas de firma (una por firmante) y devuelve el Y inferior.
 * `w` es el ancho total disponible; las cajas se reparten en partes iguales.
 * Las firmas pendientes llevan '#firmad' visible; las demás, su imagen.
 */
export async function dibujarFirmas(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  firmantes: FirmaDibujo[],
  opts: OpcionesFirmas = {}
): Promise<number> {
  const altoFirma = opts.altoFirma ?? 11.5;
  const altoEtiqueta = opts.altoEtiqueta ?? 7.5;
  const maxPorFila = opts.maxPorFila ?? 4;
  if (firmantes.length === 0) return y;

  const filas: FirmaDibujo[][] = [];
  for (let i = 0; i < firmantes.length; i += maxPorFila) {
    filas.push(firmantes.slice(i, i + maxPorFila));
  }

  let cursor = y;
  for (const fila of filas) {
    const bw = w / fila.length;
    for (let i = 0; i < fila.length; i++) {
      const f = fila[i];
      const bx = x + i * bw;

      // Separador vertical entre cajas
      if (i > 0) linea(doc, bx, cursor, bx, cursor + altoFirma + altoEtiqueta);

      // Firma o marcador
      if (f.pendienteFirma) {
        firmad(doc, bx + bw / 2, cursor + altoFirma - 2);
      } else if (f.imagen) {
        const { w: iw, h: ih } = await medirImagen(f.imagen);
        const maxW = Math.max(bw - 8, 10);
        const maxH = Math.max(altoFirma - 2, 5);
        const escala = Math.min(maxW / iw, maxH / ih);
        const dw = iw * escala;
        const dh = ih * escala;
        try {
          doc.addImage(
            f.imagen,
            formatoImagen(f.imagen),
            bx + (bw - dw) / 2,
            cursor + altoFirma - dh,
            dw,
            dh
          );
        } catch {
          // Imagen ilegible: la caja queda solo con la etiqueta
        }
      }

      // Etiqueta (línea superior + rol + nombre)
      linea(doc, bx, cursor + altoFirma, bx + bw, cursor + altoFirma);
      texto(doc, f.rol ?? (f.esSolicitante ? 'SOLICITA' : 'AUTORIZA'), bx + bw / 2, cursor + altoFirma + 3, {
        size: 5,
        bold: true,
        align: 'center',
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      const lineas = doc.splitTextToSize(f.nombre, bw - 4) as string[];
      texto(doc, lineas[0] ?? '', bx + bw / 2, cursor + altoFirma + 6, { size: 5, align: 'center' });
      if (lineas[1]) {
        texto(doc, lineas[1], bx + bw / 2, cursor + altoFirma + 8.2, { size: 5, align: 'center' });
      }
    }
    cursor += altoFirma + altoEtiqueta;
  }
  return cursor;
}
