import type { OrdenCompraResponse } from '@/types/ordenCompra.types';

/**
 * Datos que se imprimen en "Datos del solicitante".
 *
 * Regla de negocio: cuando el creador tiene correo @grupolefarma.com.mx, el
 * documento muestra al jefe (segundo autorizador del workflow) y sus datos
 * tomados de Asistencias.dbo.vwEmpleados, no los del creador.
 */
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

/**
 * Área visible de la orden para pantallas y PDFs: la del empleado según
 * Asistencias.dbo.vwEmpleados y, solo si no hay dato, la del catálogo CxP
 * (que en producción es un catálogo heredado de puestos, no de áreas).
 */
export function areaDocumento(orden: OrdenCompraResponse): string {
  const { area } = datosSolicitanteDocumento(orden);
  return (
    area?.trim() ||
    orden.areaNombre?.trim() ||
    `Área ${orden.idArea}`
  );
}
