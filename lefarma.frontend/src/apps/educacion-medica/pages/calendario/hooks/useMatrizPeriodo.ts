import { useCallback, useEffect, useRef, useState } from 'react';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ConcentracionEquipo,
  MatrizRevision,
  MatrizTalleresDetalle,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { toApiError } from '@/utils/errors';

interface UseMatrizPeriodoResult {
  matriz: MatrizTalleresDetalle | null;
  concentracion: ConcentracionEquipo[];
  revision: MatrizRevision | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Carga la matriz general de la gerencia/periodo y su cobertura de visitas. */
export function useMatrizPeriodo(
  idGerencia: number | null,
  periodo: string,
  idMatrizInicial?: number | null
): UseMatrizPeriodoResult {
  const [matriz, setMatriz] = useState<MatrizTalleresDetalle | null>(null);
  const [concentracion, setConcentracion] = useState<ConcentracionEquipo[]>([]);
  const [revision, setRevision] = useState<MatrizRevision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitudRef = useRef(0);

  const cargar = useCallback(async () => {
    const solicitud = ++solicitudRef.current;

    if (idGerencia == null) {
      setMatriz(null);
      setConcentracion([]);
      setRevision(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resumenResponse = await educacionMedicaApi.matricesTalleres.getAll(idGerencia, periodo);
      if (solicitud !== solicitudRef.current) return;

      const lista = resumenResponse.data.success ? (resumenResponse.data.data ?? []) : [];
      const idMatriz =
        idMatrizInicial && lista.some((m) => m.idMatrizGeneral === idMatrizInicial)
          ? idMatrizInicial
          : (idMatrizInicial ?? lista[0]?.idMatrizGeneral ?? null);

      if (!idMatriz) {
        setMatriz(null);
        setConcentracion([]);
        setRevision(null);
        return;
      }

      const [detalleResponse, concentracionResponse, revisionResponse] = await Promise.all([
        educacionMedicaApi.matricesTalleres.getById(idMatriz),
        educacionMedicaApi.matricesTalleres.concentracion(idMatriz),
        educacionMedicaApi.matricesTalleres
          .revision(idMatriz)
          .catch(() => null),
      ]);

      if (solicitud !== solicitudRef.current) return;

      if (detalleResponse.data.success) {
        setMatriz(detalleResponse.data.data ?? null);
      } else {
        setMatriz(null);
        setError(detalleResponse.data.message ?? 'No se pudo cargar la matriz.');
      }

      setConcentracion(
        concentracionResponse.data.success ? (concentracionResponse.data.data ?? []) : []
      );
      setRevision(
        revisionResponse?.data.success ? (revisionResponse.data.data ?? null) : null
      );
    } catch (err: unknown) {
      if (solicitud !== solicitudRef.current) return;
      setMatriz(null);
      setConcentracion([]);
      setRevision(null);
      setError(toApiError(err).message ?? 'No se pudo cargar la matriz.');
    } finally {
      if (solicitud === solicitudRef.current) setLoading(false);
    }
  }, [idGerencia, periodo, idMatrizInicial]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    void cargar();
    return () => {
      solicitudRef.current += 1;
    };
  }, [cargar]);

  return { matriz, concentracion, revision, loading, error, reload: cargar };
}
