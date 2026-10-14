import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, History, Loader2, Pencil, Plus, Trash2, PlaneTakeoff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/hooks/usePermission';
import { toApiError } from '@/utils/errors';
import { CeldaFuente } from '../../components/celdasCotizacion';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import {
  PERMISO_AJUSTAR,
  campoTexto,
  construirPayloadAjuste,
  esAjustable,
  estadoTexto,
  lineaTiempoAjustes,
  precioTexto,
  VARIANTE_POR_ESTADO,
  type AccionAjuste,
  type AjusteSolicitudPayload,
} from '../../types/aprobaciones.types';
import type { Solicitud, SolicitudOpcion } from '../../types/solicitud.types';

/**
 * Editor de ajustes del admin sobre una solicitud ya autorizada.
 *
 * Cuatro acciones, todas con `viaticos.ajustar`: cambiar el vuelo elegido por
 * cualquiera de las otras opciones, editar el precio de una partida, agregar una
 * partida y quitar una.
 *
 * Tres reglas que este componente no rompe nunca:
 *
 * 1. Sin `motivo` no hay ajuste. El payload se construye con
 *    `construirPayloadAjuste`, que devuelve `null` si el motivo esta vacio, y
 *    el boton Guardar depende de ese `null`: no es una validacion de estilo, es
 *    la condicion de existencia del request.
 * 2. El valor del solicitante no se borra. Cada payload lleva `valor_anterior`
 *    (lo que habia) y `valor_nuevo` (lo que queda); el backend los agrega a
 *    `solicitud_ajustes` sin tocar filas previas.
 * 3. Si la solicitud no esta en un estado ajustable, no se ofrecen acciones:
 *    el backend responde 409 y un boton que solo falla es peor que no tenerlo.
 */

const TIPO_VUELO = 'vuelo';

const esVuelo = (opcion: SolicitudOpcion): boolean =>
  opcion.tipo.toLowerCase() === TIPO_VUELO;

function fechaTexto(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha);
}

export interface EditorAjustesProps {
  /** Solicitud a editar; null mantiene el editor cerrado. */
  solicitud: Solicitud | null;
  /** Se llama tras un ajuste aceptado para que el padre recargue el detalle. */
  onAjusteRegistrado?: (payload: AjusteSolicitudPayload) => void;
}

export default function EditorAjustes({
  solicitud,
  onAjusteRegistrado,
}: EditorAjustesProps) {
  const puedeAjustar = usePermission({ require: PERMISO_AJUSTAR });
  const id = solicitud?.id_solicitud ?? null;

  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accion, setAccion] = useState<AccionAjuste | null>(null);
  const [motivo, setMotivo] = useState('');
  const [nuevoImporte, setNuevoImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async (idSolicitud: number) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await solicitudesApi.detalle(idSolicitud);
      if (respuesta.data.success) {
        setDetalle(respuesta.data.data ?? null);
      } else {
        setDetalle(null);
        setError(respuesta.data.message ?? 'No se pudo cargar la solicitud.');
      }
    } catch (falla: unknown) {
      setDetalle(null);
      setError(toApiError(falla).message || 'No se pudo cargar la solicitud.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (id === null) {
      setDetalle(null);
      setError(null);
      setCargando(false);
      return;
    }
    void cargar(id);
  }, [id, cargar]);

  const opciones = useMemo(() => detalle?.opciones ?? [], [detalle]);
  const partidas = useMemo(() => opciones.filter((o) => o.fue_elegida), [opciones]);
  const vuelos = useMemo(() => opciones.filter(esVuelo), [opciones]);
  const vueloElegido = useMemo(
    () => vuelos.find((o) => o.fue_elegida) ?? null,
    [vuelos],
  );
  const alternativasVuelo = useMemo(
    () => vuelos.filter((o) => !o.fue_elegida),
    [vuelos],
  );
  const ajustes = useMemo(
    () => lineaTiempoAjustes(detalle?.eventos ?? []),
    [detalle],
  );

  const ajustable = detalle !== null && esAjustable(detalle.estado);
  const accionesVisibles = puedeAjustar && ajustable;

  const abrir = (nueva: AccionAjuste) => {
    setAccion(nueva);
    setMotivo('');
    setNuevoImporte('');
    setConcepto('');
    setMonto('');
    setErrorAccion(null);
    if (nueva.tipo === 'precio') {
      setNuevoImporte(nueva.datos.partida.precio === null ? '' : String(nueva.datos.partida.precio));
    }
  };

  const cerrar = () => {
    if (guardando) return;
    setAccion(null);
    setMotivo('');
    setNuevoImporte('');
    setConcepto('');
    setMonto('');
    setErrorAccion(null);
  };

  // Unica fuente de verdad del boton Guardar: si no hay payload, no hay ajuste.
  // `accion` es la foto que se tomo al abrir el dialogo, asi que los campos
  // que el admin escribe mientras esta abierto se le funden aqui: sin esto el
  // payload se construiria siempre con los valores vacios de apertura.
  const payload = useMemo(() => {
    if (accion === null) return null;
    const accionViva: AccionAjuste =
      accion.tipo === 'precio'
        ? { ...accion, datos: { ...accion.datos, nuevoImporte } }
        : accion.tipo === 'agregar'
          ? { ...accion, datos: { ...accion.datos, concepto, monto } }
          : accion;
    return construirPayloadAjuste(accionViva, motivo);
  }, [accion, motivo, nuevoImporte, concepto, monto]);

  const guardar = async () => {
    if (id === null || payload === null || guardando) return;
    setGuardando(true);
    setErrorAccion(null);
    try {
      const respuesta = await aprobacionesApi.registrarAjuste(id, payload);
      if (respuesta.data.success) {
        toast.success(respuesta.data.message ?? 'Ajuste registrado.');
        setAccion(null);
        setMotivo('');
        await cargar(id);
        onAjusteRegistrado?.(payload);
      } else {
        setErrorAccion(respuesta.data.message ?? 'No se pudo registrar el ajuste.');
      }
    } catch (falla: unknown) {
      setErrorAccion(toApiError(falla).message || 'No se pudo registrar el ajuste.');
    } finally {
      setGuardando(false);
    }
  };

  if (id === null) return null;

  const tituloAccion =
    accion === null
      ? ''
      : accion.tipo === 'vuelo'
        ? 'Cambiar el vuelo'
        : accion.tipo === 'precio'
          ? 'Editar el precio'
          : accion.tipo === 'agregar'
            ? 'Agregar una partida'
            : 'Quitar una partida';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Ajustes de la solicitud {id}</h2>
          <p className="text-sm text-muted-foreground">
            Cada cambio queda registrado con el valor anterior, el nuevo y el motivo.
          </p>
        </div>
        {detalle && (
          <Badge variant={VARIANTE_POR_ESTADO[detalle.estado] ?? 'secondary'}>
            {estadoTexto(detalle.estado)}
          </Badge>
        )}
      </div>

      {cargando ? (
        <div
          data-testid="editor-cargando"
          className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando la solicitud...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void cargar(id)}>
              Reintentar
            </Button>
          </div>
        </div>
      ) : !detalle ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No hay una solicitud cargada que ajustar.
        </p>
      ) : (
        <>
          {!puedeAjustar && (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              No tienes el permiso {PERMISO_AJUSTAR}: puedes consultar el detalle y el
              historial de ajustes, pero no modificarlo.
            </p>
          )}
          {puedeAjustar && !ajustable && (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              Los ajustes solo aplican a solicitudes autorizadas. Esta está en estado{' '}
              {estadoTexto(detalle.estado.toLowerCase())}.
            </p>
          )}

          <section aria-labelledby="editor-vuelo" className="space-y-2">
            <h3 id="editor-vuelo" className="font-medium">
              Vuelo
            </h3>
            {vueloElegido ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">{vueloElegido.linea}</div>
                  <div className="text-xs text-muted-foreground">
                    {precioTexto(vueloElegido)}
                  </div>
                </div>
                <Badge>Elegido</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                El solicitante no dejó ningún vuelo elegido.
              </p>
            )}

            {alternativasVuelo.length > 0 ? (
              <ul className="space-y-2">
                {alternativasVuelo.map((opcion) => (
                  <li
                    key={opcion.id_opcion}
                    data-testid={`alternativa-${opcion.id_opcion}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{opcion.linea}</div>
                      <div className="tabular-nums">{precioTexto(opcion)}</div>
                      <CeldaFuente
                        fuente={opcion.fuente}
                        estimado={opcion.precio === null}
                      />
                    </div>
                    {accionesVisibles && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Cambiar el vuelo a ${opcion.linea}`}
                        onClick={() =>
                          abrir({
                            tipo: 'vuelo',
                            datos: { alternativa: opcion, elegidaActual: vueloElegido },
                          })
                        }
                      >
                        <PlaneTakeoff className="mr-1.5 h-4 w-4" />
                        Elegir este vuelo
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay otras opciones de vuelo para cambiar.
              </p>
            )}
          </section>

          <section aria-labelledby="editor-partidas" className="space-y-2">
            <h3 id="editor-partidas" className="font-medium">
              Partidas ({partidas.length})
            </h3>
            {partidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta solicitud no tiene partidas registradas.
              </p>
            ) : (
              <ul className="space-y-2">
                {partidas.map((opcion) => (
                  <li
                    key={opcion.id_opcion}
                    data-testid={`partida-${opcion.id_opcion}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{opcion.linea}</div>
                      <div className="tabular-nums text-muted-foreground">
                        {precioTexto(opcion)}
                      </div>
                    </div>
                    {accionesVisibles && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Editar el precio de ${opcion.linea}`}
                          onClick={() =>
                            abrir({ tipo: 'precio', datos: { partida: opcion, nuevoImporte: '' } })
                          }
                        >
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Editar precio
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Quitar ${opcion.linea}`}
                          onClick={() => abrir({ tipo: 'quitar', datos: { partida: opcion } })}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          Quitar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {accionesVisibles && (
              <Button
                variant="outline"
                size="sm"
                aria-label="Agregar una partida"
                onClick={() =>
                  abrir({ tipo: 'agregar', datos: { concepto: '', monto: '' } })
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar partida
              </Button>
            )}
          </section>

          <section aria-labelledby="editor-historial" className="space-y-2">
            <h3 id="editor-historial" className="flex items-center gap-2 font-medium">
              <History className="h-4 w-4" />
              Ajustes registrados ({ajustes.length})
            </h3>
            {ajustes.length === 0 ? (
              <p
                data-testid="historial-vacio"
                className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
              >
                Todavía no se registró ningún ajuste en esta solicitud.
              </p>
            ) : (
              <ul className="space-y-2">
                {ajustes.map((ajuste) => (
                  <li
                    key={ajuste.id_evento}
                    data-testid={`ajuste-${ajuste.id_evento}`}
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {ajuste.hayDetalle ? campoTexto(ajuste.campo) : 'Ajuste aplicado'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Usuario #{ajuste.id_usuario} · {fechaTexto(ajuste.fecha_creacion)}
                      </span>
                    </div>
                    {ajuste.hayDetalle ? (
                      <>
                        <div className="mt-1">
                          <span className="text-muted-foreground">Antes: </span>
                          <span className="line-through">{ajuste.valorAnterior || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ahora: </span>
                          <span>{ajuste.valorNuevo || '—'}</span>
                        </div>
                        <div className="mt-1">
                          <span className="text-muted-foreground">Motivo: </span>
                          <span>{ajuste.motivo}</span>
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No se registró el detalle de este ajuste: falta el campo modificado o el
                        motivo, así que solo consta quién lo hizo y cuándo.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Dialog open={accion !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tituloAccion}</DialogTitle>
            <DialogDescription>
              El valor anterior queda guardado: el cambio se agrega al historial, nunca
              reemplaza lo que eligió el solicitante.
            </DialogDescription>
          </DialogHeader>

          {accion?.tipo === 'precio' && (
            <div className="space-y-1">
              <Label htmlFor="ajuste-precio">Nuevo precio</Label>
              <Input
                id="ajuste-precio"
                inputMode="decimal"
                placeholder="0.00"
                value={nuevoImporte}
                onChange={(evento) => setNuevoImporte(evento.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Antes: {precioTexto(accion.datos.partida)}
              </p>
            </div>
          )}

          {accion?.tipo === 'agregar' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ajuste-concepto">Concepto</Label>
                <Input
                  id="ajuste-concepto"
                  placeholder="Cena de trabajo"
                  value={concepto}
                  onChange={(evento) => setConcepto(evento.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ajuste-monto">Monto</Label>
                <Input
                  id="ajuste-monto"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={monto}
                  onChange={(evento) => setMonto(evento.target.value)}
                />
              </div>
            </div>
          )}

          {accion?.tipo === 'vuelo' && accion.datos.elegidaActual && (
            <p className="text-sm text-muted-foreground">
              Antes: {accion.datos.elegidaActual.linea} ·{' '}
              {precioTexto(accion.datos.elegidaActual)}
              <br />
              Ahora: {accion.datos.alternativa.linea} ·{' '}
              {precioTexto(accion.datos.alternativa)}
            </p>
          )}

          {accion?.tipo === 'quitar' && (
            <p className="text-sm text-muted-foreground">
              Se quitará: {accion.datos.partida.linea} ·{' '}
              {precioTexto(accion.datos.partida)}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="ajuste-motivo">Motivo (obligatorio)</Label>
            <Input
              id="ajuste-motivo"
              placeholder="Por qué se hace este cambio"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sin motivo no se puede registrar el ajuste.
            </p>
          </div>

          {errorAccion && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="font-medium text-destructive">{errorAccion}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={payload === null || guardando}>
              {guardando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Registrar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
