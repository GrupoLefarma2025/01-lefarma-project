import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CrearSolicitudDesdeEducacionMedicaPayload,
  CalculoViaje,
  CrearSolicitudPayload,
  DeteccionPrecioResponse,
  DeteccionPrecioPreviewPayload,
  DeteccionPrecioPreviewResponse,
  OpcionCotizacion,
  PrecioRealPayload,
  Solicitud,
  SolicitudDesdeEducacionMedicaResponse,
  SolicitudOrigenEmResumen,
} from '../types/solicitud.types';

const BASE = '/viaticos/solicitudes';

const esEstimada = (opcion: OpcionCotizacion): boolean => {
  const tipo = opcion.datos?.tipo_precio;
  if (typeof tipo === 'string' && tipo.trim() !== '') {
    return tipo.trim().toLowerCase() !== 'cotizado';
  }
  return /estimad/i.test(opcion.fuente ?? '');
};

/**
 * El motor calcula un estimado para planear, pero al persistir `precio` es
 * SOLO el precio real. El estimado viaja como `datos.precio_estimado` y el
 * backend lo suma aparte en `total_estimado` (nunca en `total_cotizado`).
 */
const paraPersistencia = (opcion: OpcionCotizacion): OpcionCotizacion => {
  if (!esEstimada(opcion)) return opcion;

  const referencia = typeof opcion.precio === 'number' && Number.isFinite(opcion.precio)
    ? opcion.precio
    : (typeof opcion.datos?.precio_estimado === 'number'
      ? opcion.datos.precio_estimado
      : null);

  const datos = {
    ...opcion.datos,
    tipo_precio: opcion.datos?.tipo_precio ?? 'estimado',
    ...(referencia !== null ? { precio_estimado: referencia } : {}),
  };

  // El vuelo estimado NUNCA puede viajar como precio real: se anula y la
  // referencia queda aparte. Taxi/renta/hotel conservan su importe de
  // referencia (tipo_precio los distingue) para que el resumen autorizado y
  // el concentrado no pierdan esos conceptos.
  const tipo = (opcion.tipo ?? '').trim().toLowerCase();
  const esVuelo = tipo === 'vuelo' || tipo === 'avion';
  return {
    ...opcion,
    precio: esVuelo ? null : (referencia ?? opcion.precio),
    datos,
  };
};

/**
 * Totales de las opciones elegidas. `total_cotizado` usa solo precios reales;
 * `total_estimado` suma las referencias. `total` conserva la suma completa
 * para el presupuesto, pero la UI y las aprobaciones muestran el desglose.
 * Si no hay importes o mezclan monedas, no se envía ninguno (null).
 */
const totalDeOpciones = (
  opciones: OpcionCotizacion[],
): { total_cotizado?: number; total_estimado?: number; total?: number } => {
  let cotizado = 0;
  let estimado = 0;
  let tieneCotizado = false;
  let tieneEstimado = false;
  const monedas = new Set<string>();

  for (const opcion of opciones) {
    if (!opcion.fue_elegida) continue;
    const esReal = !esEstimada(opcion);
    const monto = esReal
      ? opcion.precio
      : (typeof opcion.datos?.precio_estimado === 'number'
        ? opcion.datos.precio_estimado
        : opcion.precio);
    if (typeof monto !== 'number' || !Number.isFinite(monto)) continue;

    monedas.add((opcion.moneda ?? 'MXN').trim().toUpperCase());
    if (esReal) {
      cotizado += monto;
      tieneCotizado = true;
    } else {
      estimado += monto;
      tieneEstimado = true;
    }
  }

  if ((!tieneCotizado && !tieneEstimado) || monedas.size > 1) return {};

  const redondear = (valor: number) => Math.round(valor * 100) / 100;
  return {
    ...(tieneCotizado ? { total_cotizado: redondear(cotizado) } : {}),
    ...(tieneEstimado ? { total_estimado: redondear(estimado) } : {}),
    total: redondear(cotizado + estimado),
  };
};

export const solicitudesApi = {
  /** POST /viaticos/solicitudes: crea el borrador de la solicitud. */
  crear: (payload: CrearSolicitudPayload) =>
    API.post<ApiResponse<Solicitud>>(BASE, payload),
  /** POST /viaticos/solicitudes/desde-educacion-medica: crea o reutiliza por ruta. */
  crearDesdeEducacionMedica: (payload: CrearSolicitudDesdeEducacionMedicaPayload) =>
    API.post<ApiResponse<SolicitudDesdeEducacionMedicaResponse>>(
      `${BASE}/desde-educacion-medica`,
      payload
    ),
  /** GET /viaticos/solicitudes/por-ruta/{idRuta}: todas las cotizaciones de la ruta. */
  porRuta: (idRuta: number) =>
    API.get<ApiResponse<SolicitudOrigenEmResumen[]>>(`${BASE}/por-ruta/${idRuta}`),
  /** GET /viaticos/solicitudes/mis */
  misSolicitudes: () => API.get<ApiResponse<Solicitud[]>>(`${BASE}/mis`),
  /** GET /viaticos/solicitudes/gerencia-sugerida: última gerencia del usuario. */
  gerenciaSugerida: () =>
    API.get<ApiResponse<{ gerencia: string | null }>>(`${BASE}/gerencia-sugerida`),
  /** GET /viaticos/solicitudes/{id} */
  detalle: (id: number) => API.get<ApiResponse<Solicitud>>(`${BASE}/${id}`),
  /** PUT /viaticos/solicitudes/{id}: reemplaza el snapshot de un borrador. */
  actualizar: (id: number, payload: CrearSolicitudPayload) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}`, payload),
  /** DELETE /viaticos/solicitudes/{id}: soft delete de un borrador. */
  eliminar: (id: number) => API.delete<ApiResponse<object>>(`${BASE}/${id}`),
  /** POST /viaticos/solicitudes/{id}/enviar: borrador -> concentrado. */
  enviar: (id: number, calculo?: CalculoViaje) =>
    API.post<ApiResponse<Solicitud>>(`${BASE}/${id}/enviar`, calculo ? { calculo } : {}),
  /** PUT /viaticos/solicitudes/{id}/opciones: persiste la cotización elegida. */
  guardarOpciones: (id: number, opciones: OpcionCotizacion[], calculo?: CalculoViaje) => {
    const persistidas = opciones.map(paraPersistencia);
    return API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones`, {
      cotizacion: {
        opciones: persistidas,
        ...totalDeOpciones(persistidas),
      },
      ...(calculo ? { calculo } : {}),
    });
  },

  /**
   * PUT /viaticos/solicitudes/{id}/opciones/{idOpcion}/precio: convierte una
   * opción estimada en cotizada con precio real, URL y captura.
   */
  registrarPrecioReal: (id: number, idOpcion: number, payload: PrecioRealPayload) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones/${idOpcion}/precio`, payload),

  /**
   * POST /viaticos/solicitudes/{id}/opciones/{idOpcion}/detectar-precio:
   * Playwright + Firecrawl detectan el precio real y, si hay un vuelo que
   * llega a tiempo, lo aplican. Puede tardar ~1-2 minutos.
   */
  detectarPrecio: (id: number, idOpcion: number) =>
    API.post<ApiResponse<DeteccionPrecioResponse>>(
      `${BASE}/${id}/opciones/${idOpcion}/detectar-precio`,
      {},
      { timeout: 180_000 },
    ),

  /**
   * POST /viaticos/opciones/detectar-precio: vista previa al seleccionar una
   * opción en el wizard. No guarda nada; devuelve precio y captura para que el
   * frontend los adjunte a la opción.
   */
  detectarPrecioPreview: (
    payload: DeteccionPrecioPreviewPayload,
    signal?: AbortSignal,
  ) =>
    API.post<ApiResponse<DeteccionPrecioPreviewResponse>>(
      '/viaticos/opciones/detectar-precio',
      payload,
      { timeout: 80_000, signal },
    ),
};