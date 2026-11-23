import { API } from '@/shared/api/apiClient';
import { authService } from '@/shared/auth/authService';
import type { ApiResponse } from '@/types/api.types';

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
  obtener: (id: number) =>
    API.get<ApiResponse<EvidenciasSolicitud>>(`${BASE}/${id}/capturas`),

  generar: async (id: number, forzar = false, opcionId?: number) =>
    API.post<ApiResponse<EvidenciasSolicitud>>(
      `${BASE}/${id}/capturas`,
      opcionId === undefined ? { forzar } : { forzar, opcion_id: opcionId },
      { timeout: 300_000 },
    ),

  subirCaptura: (id: number, idOpcion: number, archivo: File) => {
    const datos = new FormData();
    datos.append('Archivo', archivo);
    return API.post<ApiResponse<EvidenciasSolicitud>>(
      `${BASE}/${id}/opciones/${idOpcion}/captura`,
      datos,
      { timeout: 120_000 },
    );
  },

  buscar: (id: number, opcionId?: number) =>
    API.post<ApiResponse<EvidenciasSolicitud>>(
      `${BASE}/${id}/buscar`,
      opcionId === undefined ? {} : { opcion_id: opcionId },
      { timeout: 900_000 },
    ),
};

export function generarCapturasEnSegundoPlano(id: number): void {
  try {
    const configurada = import.meta.env.VITE_API_URL;
    const base = configurada?.startsWith('/') ? configurada : '/api';
    const token = authService.getAccessToken();
    void fetch(`${base}/viaticos/solicitudes/${id}/capturas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ forzar: false }),
      keepalive: true,
    }).catch(() => {
    });
  } catch {
  }
}
