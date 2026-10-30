import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';

/** Datos del viaje que el agente extrae de la página (POST /buscar). */
export interface DatosViaje {
  transportista?: string | null;
  modo?: string | null;
  origen?: string | null;
  destino?: string | null;
  salida?: string | null;
  llegada?: string | null;
  duracion_min?: number | null;
  precio?: number | null;
  moneda?: string | null;
  asientos_disponibles?: number | null;
  notas?: string | null;
}

/**
 * Evidencia de una opción cotizada: el link de compra y la captura de pantalla
 * del precio. La produce `GET/POST /viaticos/solicitudes/{id}/capturas`.
 * `url_captura` es la ruta autenticada del PNG (`/api/viaticos/capturas/<file>`);
 * `ruta_captura` es la que viaja en la solicitud (`capturas-viaticos/<file>.png`).
 * `datos` llega tras `POST /viaticos/solicitudes/{id}/buscar`.
 */
export interface EvidenciaOpcion {
  id_opcion: number;
  tipo: string;
  linea: string;
  precio: number | null;
  moneda: string | null;
  fuente: string | null;
  fue_elegida: boolean;
  url_compra: string | null;
  ruta_captura: string | null;
  url_captura: string | null;
  capturada_en: string | null;
  error: string | null;
  datos: DatosViaje | null;
  buscado_en: string | null;
}

export interface EvidenciasSolicitud {
  id_solicitud: number;
  folio: string;
  opciones: EvidenciaOpcion[];
  generadas: number;
  reutilizadas: number;
  fallidas: number;
  aviso: string | null;
}

const BASE = '/viaticos/solicitudes';

export const evidenciasApi = {
  /** GET /viaticos/solicitudes/{id}/capturas: no captura, solo reporta lo que hay. */
  obtener: (id: number) =>
    API.get<ApiResponse<EvidenciasSolicitud>>(`${BASE}/${id}/capturas`),

  /**
   * POST /viaticos/solicitudes/{id}/capturas: captura con Playwright las
   * opciones que aún no tienen PNG y las persiste. `forzar` re-captura todas.
   * El backend corre el script local (Chromium) a través de un helper Node, así
   * que el timeout es amplio: 10 opciones pueden tardar ~2 min.
   */
  generar: (id: number, forzar = false) =>
    API.post<ApiResponse<EvidenciasSolicitud>>(
      `${BASE}/${id}/capturas`,
      { forzar },
      { timeout: 240_000 },
    ),

  /**
   * POST /viaticos/solicitudes/{id}/buscar: el agente (OpenCode + Playwright MCP
   * del servicio de capturas) abre el link de la oferta, llena el buscador del
   * sitio con la ruta y la fecha de la solicitud, y devuelve los RESULTADOS con
   * el costo. Con `opcionId` busca solo esa opción (la UI las pide una por una
   * para mostrarlas conforme terminan).
   */
  buscar: (id: number, opcionId?: number) =>
    API.post<ApiResponse<EvidenciasSolicitud>>(
      `${BASE}/${id}/buscar`,
      opcionId === undefined ? {} : { opcion_id: opcionId },
      { timeout: 900_000 },
    ),
};
