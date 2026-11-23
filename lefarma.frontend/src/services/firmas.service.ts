import { API } from '@/shared/api/apiClient';

export const firmasEndpoints = {
  miFirma: '/firmas/mi-firma',
  firmaUsuario: (idUsuario: number) => `/firmas/usuarios/${idUsuario}/firma`,
  firmaEvento: (idEvento: number) => `/firmas/bitacora/${idEvento}/imagen`,
  ineUsuario: (idUsuario: number) => `/firmas/usuarios/${idUsuario}/ine`,
  firmaPendiente: (idUsuario: number) => `/firmas/usuarios/${idUsuario}/pendiente`,
  firmaSolicitante: (idSolicitud: number) => `/firmas/solicitud-personal/${idSolicitud}/solicitante`,
} as const;

export async function fetchFirmaObjectUrl(endpoint: string): Promise<string | null> {
  try {
    const res = await API.get(endpoint, { responseType: 'blob' });
    const blob = res.data as Blob;
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
