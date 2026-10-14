import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/hooks/usePermission';
import { toApiError } from '@/utils/errors';
import { CeldaCaptura, CeldaFuente } from '../../components/celdasCotizacion';
import { solicitudesApi } from '../../services/solicitudes.api';
import {
  PERMISO_AJUSTAR,
  VARIANTE_POR_ESTADO,
  estadoTexto,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';
import type { Solicitud, SolicitudOpcion } from '../../types/solicitud.types';
import EditorAjustes from './EditorAjustes';

/**
 * Visor de "qué me habían dado": TODAS las opciones que el solicitante recibió,
 * incluidas las que descartó. Es la respuesta a la pregunta que hace el
 * solicitante ("eso era lo que había") y la que hace el aprobador ("por qué
 * no se eligió lo más barato").
 *
 * Dos reglas de negocio viven aquí y en ningún otro lado:
 *
 * 1. El total que se muestra se calcula SOLO con las opciones elegidas. Una
 *    opción descartada nunca suma al total: si sumara, el aprobador vería un
 *    monto que la solicitud nunca pidió. Cuando faltan precios o hay varias
 *    monedas el total se declara no sumable en vez de inventar una cifra.
 * 2. Una opción sin captura no dibuja una <img> rota: `CeldaCaptura` muestra
 *    un placeholder textual. `CeldaFuente` mantiene la regla estimado-vs-
 *    cotizado en el mismo lugar que las tablas del wizard.
 *
 * La captura se lee de `ruta_captura`, que es la única columna que persiste
 * [viaticos].[solicitud_opciones] (ver SolicitudOpcionDto): el resto de
 * `capturas[]` viaja solo en el body de PUT y no vuelve en el GET.
 */

/** Misma regla que analizadorCotizacion.ts: sin precio no hay cotización. */
const esEstimado = (opcion: SolicitudOpcion): boolean => opcion.precio === null;

export interface TotalElegidas {
  /** Suma de las elegidas con precio; null cuando no se puede sumar. */
  suma: number | null;
  /** Moneda de la suma, solo si todas las elegidas cotizadas comparten una. */
  moneda: string | null;
  monedasDistintas: string[];
  contadas: number;
  sinPrecio: number;
  totalElegidas: number;
}

/**
 * Total de las opciones ELEGIDAS. Las descartadas se ignoran por completo: no
 * se suman, no se mezclan por moneda ni entran en el conteo.
 */
export function totalDeOpcionesElegidas(opciones: SolicitudOpcion[]): TotalElegidas {
  const elegidas = opciones.filter((opcion) => opcion.fue_elegida);
  const conPrecio = elegidas.filter((opcion) => opcion.precio !== null);
  const monedas = [...new Set(conPrecio.map((opcion) => opcion.moneda ?? 'MXN'))];

  // Con más de una moneda el total en una sola cifra sería una mentira.
  const suma = conPrecio.length === 0 || monedas.length > 1
    ? null
    : conPrecio.reduce((acumulado, opcion) => acumulado + (opcion.precio ?? 0), 0);

  return {
    suma,
    moneda: monedas.length === 1 ? monedas[0] : null,
    monedasDistintas: monedas,
    contadas: conPrecio.length,
    sinPrecio: elegidas.length - conPrecio.length,
    totalElegidas: elegidas.length,
  };
}

/**
 * Texto del total. Nunca devuelve `$0.00` cuando lo que falta es información:
 * un estimado sin proveedor de precios se declara estimado.
 */
export function textoTotalElegidas(total: TotalElegidas): string {
  if (total.totalElegidas === 0) return 'Sin total: la solicitud no tiene opciones elegidas.';
  if (total.suma === null && total.contadas === 0) {
    return `Estimado: ninguna de las ${total.totalElegidas} opciones elegidas trae precio de proveedor.`;
  }
  if (total.suma === null) {
    return `No sumable: las opciones elegidas mezclan ${total.monedasDistintas.join(' y ')}.`;
  }
  const importe = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: total.moneda ?? 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total.suma);
  if (total.sinPrecio === 0) return importe;
  return `${importe} (parcial: ${total.sinPrecio} de ${total.totalElegidas} elegidas sin precio de proveedor)`;
}

/** `datos_json` llega como `unknown`; solo se lee `destino`, igual que el backend. */
function destinoDesdeDatos(datos: unknown): string | null {
  if (typeof datos !== 'object' || datos === null) return null;
  const destino = (datos as { destino?: unknown }).destino;
  return typeof destino === 'string' && destino.trim() !== '' ? destino : null;
}

const precio = (opcion: SolicitudOpcion): string =>
  opcion.precio === null
    ? 'Estimado · sin precio de proveedor'
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: opcion.moneda ?? 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(opcion.precio);

const SIN_URL_COMPRA =
  'Esta opción se ofreció sin URL de compra: la fuente no trajo un enlace real. Pide la cotización al proveedor.';

function TarjetaOpcion({ opcion }: { opcion: SolicitudOpcion }) {
  const etiqueta = `${opcion.linea} (${opcion.tipo})`;
  return (
    <li
      data-testid={`opcion-${opcion.id_opcion}`}
      className="space-y-2 rounded-lg border border-border bg-card p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{opcion.linea}</div>
          <Badge variant="outline">{opcion.tipo}</Badge>
          {opcion.fue_elegida && (
            <Badge variant="default" className="ml-1">
              Elegida
            </Badge>
          )}
        </div>
        <div className="text-sm tabular-nums">{precio(opcion)}</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Fuente</div>
          <CeldaFuente fuente={opcion.fuente} estimado={esEstimado(opcion)} />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Captura</div>
          <CeldaCaptura ruta={opcion.ruta_captura ?? undefined} etiqueta={etiqueta} />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Comprar</div>
          {opcion.url_compra ? (
            <Button asChild variant="outline" size="sm">
              <a href={opcion.url_compra} target="_blank" rel="noreferrer" aria-label={`Comprar ${etiqueta}`}>
                Comprar ↗
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Comprar sin URL
              <span className="sr-only">{SIN_URL_COMPRA}</span>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Origen del visor. El admin pasa la fila completa de la bandeja; el propio
 * solicitante, que no tiene fila de bandeja, pasa al menos `id_solicitud` y el
 * resto de la cabecera se arma con lo que devuelve `solicitudesApi.detalle`.
 */
export type OrigenDetalleSolicitud = Pick<SolicitudBandeja, 'id_solicitud'> &
  Partial<SolicitudBandeja>;

export interface DetalleSolicitudModalProps {
  /** Solicitud a inspeccionar; null mantiene el modal cerrado. */
  solicitud: OrigenDetalleSolicitud | null;
  abierta: boolean;
  onCerrar: () => void;
}

export function DetalleSolicitudModal({ solicitud, abierta, onCerrar }: DetalleSolicitudModalProps) {
  // El editor de ajustes se monta aqui (dentro del detalle) y solo para quien
  // tiene `viaticos.ajustar`: es el unico punto desde donde el administrador
  // llega a cambiar un vuelo, un precio o las partidas de una solicitud.
  const puedeAjustar = usePermission({ require: PERMISO_AJUSTAR });
  const id = solicitud?.id_solicitud ?? null;
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (idSolicitud: number) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await solicitudesApi.detalle(idSolicitud);
      if (respuesta.data.success) {
        setDetalle(respuesta.data.data ?? null);
      } else {
        setDetalle(null);
        setError(respuesta.data.message ?? 'No se pudo cargar el detalle de la solicitud.');
      }
    } catch (falla: unknown) {
      setDetalle(null);
      setError(toApiError(falla).message || 'No se pudo cargar el detalle de la solicitud.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!abierta || id === null) {
      setDetalle(null);
      setError(null);
      setCargando(false);
      return;
    }
    void cargar(id);
  }, [abierta, id, cargar]);

  const opciones = useMemo(() => detalle?.opciones ?? [], [detalle]);
  const elegidas = useMemo(() => opciones.filter((o) => o.fue_elegida), [opciones]);
  const descartadas = useMemo(() => opciones.filter((o) => !o.fue_elegida), [opciones]);
  const total = useMemo(() => totalDeOpcionesElegidas(opciones), [opciones]);

  const periodo = solicitud?.periodo || detalle?.periodo || '—';
  const destino = solicitud?.destino ?? destinoDesdeDatos(detalle?.datos) ?? '—';
  const estado = detalle?.estado ?? solicitud?.estado ?? '';
  const solicitante =
    solicitud?.nombre_solicitante ||
    (detalle ? `Usuario #${detalle.id_usuario_solicitante}` : '—');

  return (
    <Dialog open={abierta} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Opciones de la solicitud {solicitud?.id_solicitud ?? detalle?.id_solicitud ?? ''}
          </DialogTitle>
          <DialogDescription>
            Todas las opciones que se le ofrecieron, incluidas las que no se eligieron.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div
            data-testid="detalle-cargando"
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando opciones de la solicitud...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-destructive">{error}</p>
              {id !== null && (
                <Button variant="outline" size="sm" onClick={() => void cargar(id)}>
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        ) : !detalle ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay detalle de esta solicitud que mostrar.
          </p>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 text-sm sm:grid-cols-5">
              <div>
                <dt className="text-xs text-muted-foreground">Solicitante</dt>
                <dd className="font-medium">{solicitante}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Periodo</dt>
                <dd>{periodo}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Destino</dt>
                <dd>{destino}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Estado</dt>
                <dd>
                  <Badge variant={VARIANTE_POR_ESTADO[estado] ?? 'secondary'}>
                    {estadoTexto(estado)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total (opciones elegidas)</dt>
                <dd data-testid="total-elegidas" className="font-medium tabular-nums">
                  {textoTotalElegidas(total)}
                </dd>
              </div>
            </dl>

            {opciones.length === 0 ? (
              <p
                data-testid="detalle-sin-opciones"
                className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
              >
                Esta solicitud todavía no tiene opciones registradas: se envió sin cotización.
              </p>
            ) : (
              <>
                <section aria-labelledby="opciones-elegidas">
                  <h3 id="opciones-elegidas" className="mb-2 font-medium">
                    Opciones elegidas ({elegidas.length})
                  </h3>
                  {elegidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ninguna opción quedó elegida: las {descartadas.length} de abajo son las que se
                      ofrecen, pero no suman al total.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {elegidas.map((opcion) => (
                        <TarjetaOpcion key={opcion.id_opcion} opcion={opcion} />
                      ))}
                    </ul>
                  )}
                </section>

                {descartadas.length > 0 && (
                  <section aria-labelledby="opciones-descartadas">
                    <h3 id="opciones-descartadas" className="mb-2 font-medium">
                      Opciones no elegidas ({descartadas.length})
                    </h3>
                    <ul className="space-y-2">
                      {descartadas.map((opcion) => (
                        <TarjetaOpcion key={opcion.id_opcion} opcion={opcion} />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {puedeAjustar && (
              <EditorAjustes
                solicitud={detalle}
                onAjusteRegistrado={() => {
                  if (id !== null) void cargar(id);
                }}
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DetalleSolicitudModal;
