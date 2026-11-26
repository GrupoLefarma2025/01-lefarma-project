export type OrientacionHoja = 'landscape' | 'portrait';

const cssHoja = (orientacion: OrientacionHoja): string => `
@page { size: A4 ${orientacion}; margin: 10mm; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

async function esperarImagenes(documento: Document): Promise<void> {
  const imagenes = [...documento.querySelectorAll<HTMLImageElement>('img')];
  await Promise.all(
    imagenes.map(async (imagen) => {
      if (imagen.complete && imagen.naturalWidth > 0) return;
      try {
        await imagen.decode();
      } catch {}
    }),
  );
}

export async function imprimirDocumentoEnIframe(
  documento: HTMLElement,
  orientacion: OrientacionHoja,
): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position: fixed; left: -9999px; top: 0; width: 1px; height: 1px; border: 0;';
  document.body.appendChild(iframe);

  const destino = iframe.contentDocument;
  const ventana = iframe.contentWindow;
  if (!destino || !ventana) {
    iframe.remove();
    return;
  }

  const estilo = destino.createElement('style');
  estilo.textContent = cssHoja(orientacion);
  destino.head.appendChild(estilo);
  destino.body.appendChild(destino.importNode(documento, true));

  await esperarImagenes(destino);

  let respaldo = 0;
  const limpiar = () => {
    window.clearTimeout(respaldo);
    ventana.removeEventListener('afterprint', limpiar);
    iframe.remove();
  };

  ventana.addEventListener('afterprint', limpiar);
  respaldo = window.setTimeout(limpiar, 60000);
  ventana.focus();
  ventana.print();
}
