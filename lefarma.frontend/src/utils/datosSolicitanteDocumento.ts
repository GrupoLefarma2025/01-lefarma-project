import type { OrdenCompraResponse } from '@/types/ordenCompra.types';

export function datosSolicitanteDocumento(orden: OrdenCompraResponse) {
  const esCorreoGrupolefarma = (orden.solicitanteCorreo ?? '')
    .toLowerCase()
    .trim()
    .endsWith('@grupolefarma.com.mx');

  const usaJefe = esCorreoGrupolefarma && !!orden.segundoAutorizador;

  return {
    nombre: usaJefe ? orden.segundoAutorizador! : (orden.solicitanteNombre ?? '-'),
    puesto: usaJefe
      ? (orden.segundoAutorizadorPuesto ?? orden.solicitantePuesto)
      : orden.solicitantePuesto,
    area: usaJefe
      ? (orden.segundoAutorizadorArea ?? orden.solicitanteArea)
      : orden.solicitanteArea,
  };
}

export function areaDocumento(orden: OrdenCompraResponse): string {
  const { area } = datosSolicitanteDocumento(orden);
  return (
    area?.trim() ||
    orden.areaNombre?.trim() ||
    `Área ${orden.idArea}`
  );
}
