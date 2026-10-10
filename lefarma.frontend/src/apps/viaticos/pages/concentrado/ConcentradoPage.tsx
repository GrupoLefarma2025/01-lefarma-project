import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import {
  ESTADO_ENVIADA,
  estadoTexto,
  VARIANTE_POR_ESTADO,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';
import type { Solicitud } from '../../types/solicitud.types';
import { precioTexto } from '../../types/aprobaciones.types';

/**
 * Vista de revisión (prototipo UI). «Activo» es un contrato sin resolver: la
 * definición se elige en la interfaz y se muestra, no se fija como política de
 * archivo. La revisión autoriza la OPCIÓN ELEGIDA por la persona viajera; las
 * alternativas se muestran como evidencia histórica con sus precios originales.
 */
const DEFINICIONES_ACTIVO: { id: string; etiqueta: string; estados: string[] }[] = [
  { id: 'enviada', etiqueta: 'Enviadas (pendientes de autorización)', estados: ['enviada'] },
  { id: 'enviada-borrador', etiqueta: 'Enviadas + borradores', estados: ['enviada', 'borrador'] },
  { id: 'todas', etiqueta: 'Todas (incluye autorizadas y rechazadas)', estados: [] as string[] },
] as const;

type DefinicionActivo = string;

const TIPOS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'aereo', etiqueta: 'Aéreo' },
  { id: 'autobus', etiqueta: 'Autobús' },
  { id: 'propio', etiqueta: 'Carro propio' },
  { id: 'sin-clasificar', etiqueta: 'Sin clasificar' },
] as const;

function tipoDeFila(f: SolicitudBandeja): string {
  if (f.avion !== null && f.avion !== undefined) return 'aereo';
  if (f.autobus !== null && f.autobus !== undefined) return 'autobus';
  if (f.gasolina !== null && f.gasolina !== undefined) return 'propio';
  return 'sin-clasificar';
}

export function ConcentradoPage() {
  usePageTitle('Concentrado de viáticos', 'Viáticos');
  const veTodos = usePermission({ require: 'viaticos.ver_todos' });
  const puedeAutorizar = usePermission({ require: 'viaticos.autorizar' });

  const [filas, setFilas] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('');
  const [tipo, setTipo] = useState<string>('todos');
  const [definicion, setDefinicion] = useState<DefinicionActivo>('enviada');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [comentario, setComentario] = useState('');
  const [accionando, setAccionando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await aprobacionesApi.bandeja(periodo ? { periodo } : {});
      if (res.data.success) setFilas(res.data.data ?? []);
      else setError(res.data.message ?? 'No se pudo cargar el concentrado.');
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudo cargar el concentrado.');
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const estadosActivos = DEFINICIONES_ACTIVO.find((d) => d.id === definicion)!.estados;
  const visibles = filas.filter(
    (f) =>
      (estadosActivos.length === 0 || estadosActivos.includes(f.estado)) &&
      (tipo === 'todos' || tipoDeFila(f) === tipo),
  );

  async function revisar(id: number) {
    setRevisandoId(id);
    setDetalle(null);
    setComentario('');
    setCargandoDetalle(true);
    try {
      const res = await solicitudesApi.detalle(id);
      if (res.data.success && res.data.data) setDetalle(res.data.data);
      else toast.error(res.data.message ?? 'No se pudo cargar la revisión.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo cargar la revisión.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function aprobar() {
    if (revisandoId === null || accionando) return;
    setAccionando(true);
    try {
      const res = await aprobacionesApi.autorizar(revisandoId);
      if (res.data.success) {
        toast.success(res.data.message ?? `Solicitud ${revisandoId} autorizada.`);
        setFilas((fs) => fs.map((f) => (f.id_solicitud === revisandoId ? { ...f, estado: 'autorizada' } : f)));
      } else toast.error(res.data.message ?? 'No se pudo autorizar.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar.');
    } finally {
      setAccionando(false);
    }
  }

  async function rechazar() {
    if (revisandoId === null || accionando || comentario.trim() === '') return;
    setAccionando(true);
    try {
      const res = await aprobacionesApi.rechazar(revisandoId, comentario.trim());
      if (res.data.success) {
        toast.success(res.data.message ?? `Solicitud ${revisandoId} rechazada.`);
        setFilas((fs) => fs.map((f) => (f.id_solicitud === revisandoId ? { ...f, estado: 'rechazada' } : f)));
      } else toast.error(res.data.message ?? 'No se pudo rechazar.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo rechazar.');
    } finally {
      setAccionando(false);
    }
  }

  const filaRevisada = revisandoId !== null ? filas.find((f) => f.id_solicitud === revisandoId) ?? null : null;
  const esAutorizable = filaRevisada?.estado === ESTADO_ENVIADA && puedeAutorizar;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Concentrado de viáticos</CardTitle>
          <CardDescription>
            Solicitudes activas para revisión autorizada. Se autoriza la opción elegida por la persona viajera,
            nunca un reemplazo elegido en su nombre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!veTodos ? (
            <p role="note" className="rounded border border-dashed p-2 text-xs text-muted-foreground">
              Sin el permiso de revisión global solo ves tus propias solicitudes (recorte del servidor):
              este concentrado no puede mostrar las de everybody en producción.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="concentrado-periodo">Periodo (aaaa-mm)</Label>
              <Input id="concentrado-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026-11" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-tipo">Tipo de viaje</Label>
              <select id="concentrado-tipo" aria-label="Tipo de viaje" className="h-10 w-full rounded-md border bg-background px-3" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>{t.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="concentrado-activo">Definición de «activo» (prototipo)</Label>
              <select id="concentrado-activo" className="h-10 w-full rounded-md border bg-background px-3" value={definicion} onChange={(e) => setDefinicion(e.target.value as DefinicionActivo)}>
                {DEFINICIONES_ACTIVO.map((d) => (
                  <option key={d.id} value={d.id}>{d.etiqueta}</option>
                ))}
              </select>
            </div>
          </div>

          {cargando ? <p role="status">Cargando concentrado…</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {!cargando && !error && visibles.length === 0 ? <p role="status">Sin solicitudes activas para estos filtros.</p> : null}

          <ul className="space-y-2">
            {visibles.map((f) => (
              <li key={f.id_solicitud} data-testid={`concentrado-${f.id_solicitud}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.nombre_solicitante} · {f.destino ?? 'Destino por confirmar'}</span>
                  <Badge variant={VARIANTE_POR_ESTADO[f.estado] ?? 'secondary'}>{estadoTexto(f.estado)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Periodo {f.periodo} · registrada {f.fecha_creacion.slice(0, 10)}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => revisar(f.id_solicitud)}>
                  Revisar
                </Button>
              </li>
            ))}
          </ul>

          {revisandoId !== null ? (
            <div data-testid="revision-solicitud" className="space-y-3 rounded-md border p-3">
              {cargandoDetalle ? <p role="status">Cargando revisión…</p> : null}
              {detalle ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Registrada en el servidor el {detalle.fecha_creacion.slice(0, 10)}. La hora de cotización
                    original no la expone el servidor: esta foto distingue lo elegido de las alternativas.
                  </p>
                  <ul className="space-y-2">
                    {detalle.opciones.map((o) => (
                      <li key={o.id_opcion} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                        <span className="font-medium">{o.linea}</span>
                        <span>{precioTexto(o)}</span>
                        {o.fue_elegida ? (
                          <Badge>Elegida por la persona viajera</Badge>
                        ) : (
                          <Badge variant="outline">Alternativa descartada</Badge>
                        )}
                      </li>
                    ))}
                    {detalle.opciones.length === 0 ? <li className="text-sm">Sin opciones registradas.</li> : null}
                  </ul>
                  <div className="space-y-1">
                    <Label htmlFor="comentario-revision">Comentario de revisión</Label>
                    <Input id="comentario-revision" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Motivo u observaciones" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={!esAutorizable || accionando} onClick={aprobar}>
                      Aprobar la opción elegida
                    </Button>
                    <Button type="button" variant="outline" disabled={!esAutorizable || accionando || comentario.trim() === ''} onClick={rechazar}>
                      Rechazar
                    </Button>
                    <Button type="button" variant="outline" disabled title="Sin endpoint compatible en esta fase">
                      Devolver para corrección
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Devolver para corrección: prototipo sin endpoint compatible en esta fase.</p>
                  {!puedeAutorizar ? <p className="text-xs text-muted-foreground">Sin el permiso de autorización los botones no actúan.</p> : null}
                </>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => { setRevisandoId(null); setDetalle(null); }}>
                Cerrar revisión
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default ConcentradoPage;
