import { API } from './api';
import type { ApiResponse } from '@/types/api.types';
import type {
  CfdiPreviewResponse,
  ComprobanteResponse,
  PartidaPendienteResponse,
  PartidaFacturacionResponse,
  AsignarPartidasRequest,
} from '@/types/comprobante.types';

const BASE = '/facturas';

export const comprobanteService = {
  /**
   * Parsea un XML CFDI y devuelve preview sin guardar nada.
   */
  async parsearXml(xmlFile: File): Promise<CfdiPreviewResponse> {
    const form = new FormData();
    form.append('xmlFile', xmlFile);
    const res = await API.post<ApiResponse<CfdiPreviewResponse>>(
      `${BASE}/parsear-xml`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data!;
  },

  /**
   * Sube un comprobante con sus archivos.
   * xmlFile: solo para CFDI
   * archivo: PDF (CFDI) o imagen/ticket (sin CFDI)
   */
  async subir(params: {
    idEmpresa: number;
    idOrden?: number | null;
    idPasoWorkflow?: number | null;
    tipoComprobante: string;
    categoria: 'gasto' | 'pago';
    totalManual?: number | null;
    notas?: string | null;
    xmlFile?: File | null;
    archivo?: File | null;
    nombrePaso?: string | null;
    nombreAccion?: string | null;
    // pago
    referenciaPago?: string | null;
    fechaPago?: string | null;
    montoPago?: number | null;
  }): Promise<ComprobanteResponse> {
    const form = new FormData();
    form.append('idEmpresa', String(params.idEmpresa));
    form.append('tipoComprobante', params.tipoComprobante);
    form.append('categoria', params.categoria);
    if (params.idOrden != null) form.append('idOrden', String(params.idOrden));
    if (params.idPasoWorkflow != null) form.append('idPasoWorkflow', String(params.idPasoWorkflow));
    if (params.totalManual != null) form.append('totalManual', String(params.totalManual));
    if (params.notas) form.append('notas', params.notas);
    if (params.xmlFile) form.append('xmlFile', params.xmlFile);
    if (params.archivo) form.append('archivo', params.archivo);
    if (params.nombrePaso) form.append('nombrePaso', params.nombrePaso);
    if (params.nombreAccion) form.append('nombreAccion', params.nombreAccion);
    if (params.referenciaPago) form.append('referenciaPago', params.referenciaPago);
    if (params.fechaPago) form.append('fechaPago', params.fechaPago);
    if (params.montoPago != null) form.append('montoPago', String(params.montoPago));

    const res = await API.post<ApiResponse<ComprobanteResponse>>(
      BASE,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data!;
  },

  async getById(idComprobante: number): Promise<ComprobanteResponse> {
    const res = await API.get<ApiResponse<ComprobanteResponse>>(`${BASE}/${idComprobante}`);
    return res.data.data!;
  },

  async getPartidasPendientes(idOrden: number, categoria: string = 'gasto'): Promise<PartidaPendienteResponse[]> {
    const res = await API.get<ApiResponse<PartidaPendienteResponse[]>>(
      `${BASE}/partidas-pendientes?idOrden=${idOrden}&categoria=${categoria}`
    );
    return res.data.data ?? [];
  },

  async asignarPartidas(
    idComprobante: number,
    request: AsignarPartidasRequest,
    idPasoWorkflow?: number | null
  ): Promise<ComprobanteResponse> {
    const url = idPasoWorkflow
      ? `${BASE}/${idComprobante}/asignar-partidas?idPasoWorkflow=${idPasoWorkflow}`
      : `${BASE}/${idComprobante}/asignar-partidas`;
    const res = await API.post<ApiResponse<ComprobanteResponse>>(url, request);
    return res.data.data!;
  },

  async getFacturacionPartida(idPartida: number): Promise<PartidaFacturacionResponse> {
    const res = await API.get<ApiResponse<PartidaFacturacionResponse>>(
      `${BASE}/partidas/${idPartida}/facturacion`
    );
    return res.data.data!;
  },
};
