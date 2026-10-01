/**
 * Espera a que el contenido de un contenedor de impresión esté listo:
 * 1. Que no queden firmas descargándose ([data-firma-loading] de FirmaImg).
 * 2. Que todas las imágenes estén decodificadas (el contenedor suele estar
 *    oculto en pantalla, así que el navegador difiere el decode y
 *    window.print() capturaría imágenes en blanco).
 */
export async function waitForPrintImages(selector: string): Promise<void> {
  const root = document.querySelector(selector);
  if (!root) return;

  const deadline = Date.now() + 5000;
  while (root.querySelector('[data-firma-loading]') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const imgs = root.querySelectorAll<HTMLImageElement>('img');
  await Promise.all(
    [...imgs].map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : img.decode().catch(() => {}),
    ),
  );
}
