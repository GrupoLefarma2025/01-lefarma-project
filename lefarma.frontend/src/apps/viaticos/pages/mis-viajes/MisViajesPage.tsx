import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { solicitudesApi } from '../../services/solicitudes.api';
import { estadoTexto, VARIANTE_POR_ESTADO } from '../../types/aprobaciones.types';
import type { Solicitud } from '../../types/solicitud.types';
import { textoTotalElegidas, totalDeOpcionesElegidas } from '../aprobaciones/DetalleSolicitudModal';
import {
  ETIQUETA_PERIODO,
  clasificarRelacion,
  enRango,
  leerDatosViaje,
  rangoDelFiltro,
  type FiltroPeriodo,
  type TipoViaje,
} from './viajes.helpers';

const TIPOS_VIAJE: { id: TipoViaje | 'todos'; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'solicitado', etiqueta: 'Transporte solicitado' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
];

export function MisViajesPage({ hoy = new Date() }: { hoy?: Date }) {
  usePageTitle('Mis viajes', 'Viáticos');
  const miId = useAuthStore((s) => s.user?.id);
  const miNombre = useAuthStore((s) => s.user?.nombre);

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('todo');
  const [tipo, setTipo] = useState<TipoViaje | 'todos'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [viendoId, setViendoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await solicitudesApi.misSolicitudes();
        if (cancelado) return;
        if (res.data.success) setSolicitudes(res.data.data ?? []);
        else setError(res.data.message ?? 'No se pudieron cargar tus viajes.');
      } catch (falla: unknown) {
        if (!cancelado) setError(toApiError(falla).message || 'No se pudieron cargar tus viajes.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Referencia «hoy» en hora local; el rango siempre se muestra.
  const rango = rangoDelFiltro(periodo, hoy, desde, hasta);

  const filas = useMemo(
    () =>
      solicitudes
        .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
        .filter(({ resumen }) => (tipo === 'todos' ? true : resumen.tipoViaje === tipo))
        .filter(({ solicitud }) => enRango(solicitud.fecha_creacion, rango)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solicitudes, tipo, periodo, desde, hasta],
  );

  async function verDetalle(id: number) {
    setViendoId(id);
    setDetalle(null);
    setCargandoDetalle(true);
    try {
      const res = await solicitudesApi.detalle(id);
      if (res.data.success && res.data.data) setDetalle(res.data.data);
      else toast.error(res.data.message ?? 'No se pudo cargar el detalle.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo cargar el detalle.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mis viajes</CardTitle>
          <CardDescription>
            Tus solicitudes, las que creaste para otra persona, las que pidieron para ti y las que compartieron contigo.
            Cada viaje aparece una sola vez. El filtrado aquí es visual, no es autorización.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="filtro-periodo">Periodo</Label>
              <select id="filtro-periodo" aria-label="Periodo" className="h-10 w-full rounded-md border bg-background px-3" value={periodo} onChange={(e) => setPeriodo(e.target.value as FiltroPeriodo)}>
                {(Object.keys(ETIQUETA_PERIODO) as FiltroPeriodo[]).map((p) => (
                  <option key={p} value={p}>{ETIQUETA_PERIODO[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filtro-tipo">Tipo de viaje</Label>
              <select id="filtro-tipo" aria-label="Tipo de viaje" className="h-10 w-full rounded-md border bg-background px-3" value={tipo} onChange={(e) => setTipo(e.target.value as TipoViaje | 'todos')}>
                {TIPOS_VIAJE.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </div>
            {periodo === 'personalizado' ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="filtro-desde">Desde</Label>
                  <Input id="filtro-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filtro-hasta">Hasta</Label>
                  <Input id="filtro-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </>
            ) : null}
          </div>
          <p data-testid="rango-visible" className="text-xs text-muted-foreground">
            {rango
              ? `Mostrando por fecha de creación (provisional): ${rango.inicio} al ${rango.fin}.`
              : 'Sin filtro de periodo: se muestran todos tus viajes.'}
          </p>

          {cargando ? <p role="status">Cargando tus viajes…</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {!cargando && !error && filas.length === 0 ? <p role="status">No hay viajes para este filtro.</p> : null}

          <ul className="space-y-2">
            {filas.map(({ solicitud, resumen }) => (
              <li key={solicitud.id_solicitud} data-testid={`viaje-${solicitud.id_solicitud}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Viaje {solicitud.id_solicitud} · {resumen.destino ?? 'Destino por confirmar'}</span>
                  <Badge variant={VARIANTE_POR_ESTADO[solicitud.estado] ?? 'secondary'}>{estadoTexto(solicitud.estado)}</Badge>
                  {clasificarRelacion(solicitud, resumen, miId, miNombre).map((d) => (
                    <Badge key={d.clave} variant="outline">{d.texto}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Creada el {solicitud.fecha_creacion.slice(0, 10)} · Periodo {solicitud.periodo}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => verDetalle(solicitud.id_solicitud)}>
                  Ver detalle
                </Button>
              </li>
            ))}
          </ul>

          {viendoId !== null ? (
            <div data-testid="detalle-viaje" className="space-y-2 rounded-md border p-3">
              {cargandoDetalle ? <p role="status">Cargando detalle…</p> : null}
              {detalle ? <DetalleViaje solicitud={detalle} /> : null}
              <Button type="button" variant="outline" size="sm" onClick={() => { setViendoId(null); setDetalle(null); }}>
                Cerrar detalle
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DetalleViaje({ solicitud }: { solicitud: Solicitud }) {
  const resumen = leerDatosViaje(solicitud.datos);
  const total = totalDeOpcionesElegidas(solicitud.opciones);
  const elegidas = solicitud.opciones.filter((o) => o.fue_elegida);
  const descartadas = solicitud.opciones.filter((o) => !o.fue_elegida);
  return (
    <div className="space-y-2 text-sm">
      <p><strong>Itinerario:</strong> {resumen.destino ?? 'Destino por confirmar'}</p>
      <p><strong>Participantes:</strong> {resumen.beneficiarioNombre ?? 'Por confirmar'}</p>
      <p><strong>Estado:</strong> {estadoTexto(solicitud.estado)}</p>
      <p><strong>Transporte y hospedaje elegidos:</strong> {elegidas.length === 0 ? 'Sin opciones elegidas.' : elegidas.map((o) => o.linea).join(' · ')}</p>
      {descartadas.length > 0 ? (
        <p className="text-muted-foreground"><strong>Alternativas descartadas:</strong> {descartadas.map((o) => o.linea).join(' · ')}</p>
      ) : null}
      <p><strong>Desglose:</strong> {textoTotalElegidas(total)}</p>
    </div>
  );
}

export default MisViajesPage;
