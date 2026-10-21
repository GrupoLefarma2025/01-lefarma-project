import { useEffect, useState } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { educacionMedicaApi } from '../../services/educacionMedica.api';
import type {
  Asignacion,
  MatrizGeneralResumen,
  MisTalleresResponse,
  PendienteAprobacion,
  Taller,
} from '../../types/educacionMedica.types';

const periodoActual = (): string => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};

export interface DashboardData {
  periodo: string;
  loading: boolean;
  puedeVerTalleres: boolean;
  puedeCapturar: boolean;
  pendientes: PendienteAprobacion[];
  misTalleres: MisTalleresResponse | null;
  asignaciones: Asignacion[];
  matrices: MatrizGeneralResumen[];
  talleresPeriodo: Taller[];
  solicitudes: Taller[];
  recargar: () => void;
}

/**
 * Datos del dashboard de Educación Médica (ADR-00012, Fase 2): una sola llamada
 * al endpoint agregado; el backend filtra por permisos del usuario.
 */
export function useDashboardData(): DashboardData {
  const [periodo] = useState(periodoActual);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendientes, setPendientes] = useState<PendienteAprobacion[]>([]);
  const [misTalleres, setMisTalleres] = useState<MisTalleresResponse | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [matrices, setMatrices] = useState<MatrizGeneralResumen[]>([]);
  const [talleresPeriodo, setTalleresPeriodo] = useState<Taller[]>([]);
  const [solicitudes, setSolicitudes] = useState<Taller[]>([]);

  const puedeVerTalleres = usePermission({ require: 'educacion_medica.talleres.puede_ver' });
  const puedeCapturar = usePermission({ require: 'educacion_medica.talleres.puede_capturar' });

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setLoading(true);
      try {
        const res = await educacionMedicaApi.dashboard.get(periodo);
        if (cancelado || !res.data.success || !res.data.data) return;

        const data = res.data.data;
        setPendientes(data.pendientes ?? []);
        setMisTalleres(data.misTalleres ?? null);
        setAsignaciones(data.asignaciones ?? []);
        setMatrices(data.matrices ?? []);
        setTalleresPeriodo(data.talleresPeriodo ?? []);
        setSolicitudes(data.solicitudes ?? []);
      } catch {
        if (cancelado) return;
        setPendientes([]);
        setMisTalleres(null);
        setAsignaciones([]);
        setMatrices([]);
        setTalleresPeriodo([]);
        setSolicitudes([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [periodo, puedeVerTalleres, puedeCapturar, refreshKey]);

  return {
    periodo,
    loading,
    puedeVerTalleres,
    puedeCapturar,
    pendientes,
    misTalleres,
    asignaciones,
    matrices,
    talleresPeriodo,
    solicitudes,
    recargar: () => setRefreshKey((k) => k + 1),
  };
}
