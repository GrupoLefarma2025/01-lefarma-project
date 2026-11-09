import { useEffect, useMemo, useState } from 'react';
import { calcularTiempoAtencion, formatDuracion } from '@/utils/tiempoAtencion';

interface TiempoAtencionProps {
  /** Fecha en que la orden llegó al paso. */
  desde: string | null | undefined;
  /** Fecha en que se autorizó el paso. Se ignora cuando enCurso = true. */
  hasta?: string | null;
  /** Si el paso es el actual, el contador avanza hasta que se autorice. */
  enCurso?: boolean;
}

/**
 * Muestra el tiempo real (natural) y el tiempo laboral transcurridos en un
 * paso. En el paso actual funciona como contador en vivo.
 */
export function TiempoAtencion({ desde, hasta, enCurso = false }: TiempoAtencionProps) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!enCurso) return;
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enCurso]);

  const tiempo = useMemo(() => {
    if (!desde) return null;
    const desdeFecha = new Date(desde);
    if (Number.isNaN(desdeFecha.getTime())) return null;

    const hastaFecha = enCurso ? new Date(ahora) : hasta ? new Date(hasta) : null;
    if (!hastaFecha || Number.isNaN(hastaFecha.getTime())) return null;

    return calcularTiempoAtencion(desdeFecha, hastaFecha);
  }, [desde, hasta, enCurso, ahora]);

  if (!tiempo) {
    return <p className="text-[11px] text-muted-foreground">—</p>;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium">
        Real: {formatDuracion(tiempo.realMs, enCurso)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Laboral: {formatDuracion(tiempo.laboralMs, enCurso)}
      </p>
    </div>
  );
}
