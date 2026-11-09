import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Hospital, Plane, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { solicitudesApi } from '@/apps/viaticos/services/solicitudes.api';
import type { SolicitudOrigenEmResumen } from '@/apps/viaticos/types/solicitud.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fechaLarga } from '../rutasUtils';
import { tieneCoordenadas } from '../viaticosHandoff';
import type { RutaParaCotizar, VisitaCotizable } from '../viaticosHandoff';

interface CotizarRutaModalProps {
  rutas: RutaParaCotizar[];
  rutaInicialId?: number | null;
  onAbrirCotizacion?: (idSolicitud: number, estado: string) => void;
  onConfirm: (ruta: RutaParaCotizar, visitas: VisitaCotizable[]) => Promise<void>;
  onClose: () => void;
}

export interface VisitaCotizada {
  idSolicitud: number;
  folio: string | null;
  estado: string;
}

const ESTADO_COTIZACION: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  autorizada: 'Autorizada',
  autorizada_con_ajustes: 'Con ajustes',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

const estadoCotizacion = (estado: string) => ESTADO_COTIZACION[estado] ?? estado;

/**
 * Selección de destinos de una ruta para el handoff a Viáticos. Agrupa por día,
 * permite seleccionar el día completo o hospitales sueltos y excluye (con aviso)
 * los hospitales sin coordenadas y los que ya están en una cotización activa.
 */
export function CotizarRutaModal({
  rutas,
  rutaInicialId,
  onAbrirCotizacion,
  onConfirm,
  onClose,
}: CotizarRutaModalProps) {
  const [idRutaSeleccionada, setIdRutaSeleccionada] = useState<number | null>(
    () => rutaInicialId ?? rutas.find((item) => item.viajero)?.idRuta ?? rutas[0]?.idRuta ?? null
  );
  const ruta = rutas.find((item) => item.idRuta === idRutaSeleccionada) ??
    rutas[0] ?? {
      idRuta: 0,
      nombre: 'Sin ruta',
      visitas: [],
    };

  const [cotizaciones, setCotizaciones] = useState<SolicitudOrigenEmResumen[]>([]);
  useEffect(() => {
    if (!ruta.idRuta) return;
    let cancelado = false;

    void solicitudesApi
      .porRuta(ruta.idRuta)
      .then((response) => {
        if (cancelado || !response.data.success) return;
        setCotizaciones(response.data.data ?? []);
      })
      .catch(() => {
        if (!cancelado) setCotizaciones([]);
      });

    return () => {
      cancelado = true;
    };
  }, [ruta.idRuta]);

  const visitasCotizadas = useMemo(() => {
    const mapa = new Map<number, VisitaCotizada>();
    for (const cotizacion of cotizaciones) {
      for (const idRutaVisita of cotizacion.id_ruta_visitas) {
        if (!mapa.has(idRutaVisita)) {
          mapa.set(idRutaVisita, {
            idSolicitud: cotizacion.id_solicitud,
            folio: cotizacion.folio,
            estado: cotizacion.estado,
          });
        }
      }
    }
    return mapa;
  }, [cotizaciones]);

  const seleccionables = useMemo(
    () =>
      ruta.visitas.filter(
        (visita) => tieneCoordenadas(visita) && !visitasCotizadas.has(visita.idRutaVisita)
      ),
    [ruta.visitas, visitasCotizadas]
  );
  const bloqueadas = useMemo(
    () => ruta.visitas.filter((visita) => visitasCotizadas.has(visita.idRutaVisita)),
    [ruta.visitas, visitasCotizadas]
  );
  const sinCoordenadas = useMemo(
    () => ruta.visitas.filter((visita) => !tieneCoordenadas(visita)),
    [ruta.visitas]
  );
  const grupos = useMemo(() => {
    const mapa = new Map<string, VisitaCotizable[]>();
    for (const visita of ruta.visitas) {
      const lista = mapa.get(visita.fechaVisita) ?? [];
      lista.push(visita);
      mapa.set(visita.fechaVisita, lista);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, visitas]) => ({
        fecha,
        visitas: [...visitas].sort((a, b) => a.orden - b.orden),
      }));
  }, [ruta.visitas]);

  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(() => new Set());
  const [enviando, setEnviando] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicia la selección al cambiar de ruta */
  useEffect(() => {
    setSeleccionadas(new Set(seleccionables.map((visita) => visita.idRutaVisita)));
  }, [ruta.idRuta]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const todas =
    seleccionables.length > 0 &&
    seleccionables.every((visita) => seleccionadas.has(visita.idRutaVisita));
  const algunas = seleccionables.some((visita) => seleccionadas.has(visita.idRutaVisita)) && !todas;
  const cantidadSeleccionada = seleccionables.filter((visita) =>
    seleccionadas.has(visita.idRutaVisita)
  ).length;

  const alternar = (id: number) => {
    setSeleccionadas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const alternarTodas = () => {
    setSeleccionadas(
      todas ? new Set() : new Set(seleccionables.map((visita) => visita.idRutaVisita))
    );
  };

  const alternarDia = (visitasDia: VisitaCotizable[]) => {
    const ids = visitasDia
      .filter((visita) => tieneCoordenadas(visita) && !visitasCotizadas?.has(visita.idRutaVisita))
      .map((visita) => visita.idRutaVisita);
    if (ids.length === 0) return;

    const todasDelDia = ids.every((id) => seleccionadas.has(id));
    setSeleccionadas((previas) => {
      const siguientes = new Set(previas);
      for (const id of ids) {
        if (todasDelDia) siguientes.delete(id);
        else siguientes.add(id);
      }
      return siguientes;
    });
  };

  const confirmar = async () => {
    const elegidas = ruta.visitas.filter(
      (visita) =>
        seleccionadas.has(visita.idRutaVisita) &&
        tieneCoordenadas(visita) &&
        !visitasCotizadas?.has(visita.idRutaVisita)
    );
    if (elegidas.length === 0 || enviando || !ruta.viajero) return;

    setEnviando(true);
    try {
      await onConfirm(ruta, elegidas);
    } finally {
      setEnviando(false);
    }
  };

  const copiarSinCoordenadas = async () => {
    try {
      await navigator.clipboard.writeText(
        sinCoordenadas
          .map((visita) => visita.nombreHospital ?? `Hospital ${visita.idRutaVisita}`)
          .join('\n')
      );
      toast.success('Lista de hospitales sin coordenadas copiada.');
    } catch {
      toast.error('No se pudo copiar la lista.');
    }
  };

  return (
    <Modal
      id="modal-cotizar-ruta"
      open
      setOpen={(abierto) => {
        if (!abierto) onClose();
      }}
      title="Cotizar viáticos"
      size="lg"
      canClose={!enviando}
      beforeClose={() => !enviando}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={cantidadSeleccionada === 0 || enviando || !ruta.viajero}
          >
            <Plane className="mr-1.5 h-4 w-4" />
            {enviando
              ? 'Creando borrador.'
              : !ruta.idRuta
                ? 'Sin rutas disponibles'
                : !ruta.viajero
                  ? 'Ruta sin especialista'
                  : `Cotizar ${cantidadSeleccionada} destino${cantidadSeleccionada === 1 ? '' : 's'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Ruta del especialista
          </p>
          {rutas.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No hay rutas disponibles en esta versión. Genera o revisa la planeación primero.
            </p>
          ) : (
            <Select
              value={ruta.idRuta ? String(ruta.idRuta) : undefined}
              onValueChange={(valor) => setIdRutaSeleccionada(Number(valor))}
            >
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder="Selecciona una ruta" />
              </SelectTrigger>
              <SelectContent>
                {rutas.map((opcion) => (
                  <SelectItem key={opcion.idRuta} value={String(opcion.idRuta)}>
                    {opcion.viajero?.nombre ?? 'Sin especialista'} · {opcion.visitas.length} visitas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Elige todos o algunos destinos disponibles. Los hospitales sin coordenadas no se envían a
          cotización y los que ya tienen folio no se pueden volver a cotizar.
        </p>

        {ruta.viajero ? (
          <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <UserRound className="h-4 w-4 shrink-0" />
            <span>
              Viajero: <strong>{ruta.viajero.nombre}</strong>{' '}
              <span className="opacity-70">({ruta.viajero.rol})</span>
            </span>
          </div>
        ) : ruta.idRuta ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            La ruta no tiene especialista asignado. Corrige la ruta antes de cotizar.
          </div>
        ) : null}

        {bloqueadas.length > 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
            <div className="flex items-start gap-2">
              <Plane className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  {bloqueadas.length} visita(s) ya en una cotización activa
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Las filas con folio están bloqueadas. Abre la cotización existente para revisarla
                  o eliminarla.
                </p>
              </div>
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium">
          <Checkbox
            checked={todas ? true : algunas ? 'indeterminate' : false}
            onCheckedChange={alternarTodas}
            disabled={seleccionables.length === 0}
          />
          Seleccionar todos
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {cantidadSeleccionada}/{seleccionables.length} disponibles
            {bloqueadas.length > 0 ? ` - ${bloqueadas.length} cotizada(s)` : ''}
          </span>
        </label>

        {sinCoordenadas.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {sinCoordenadas.length} hospital(es) sin coordenadas
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No se enviarán a cotización. Avisa al gerente para actualizar sus coordenadas en
                  el catálogo.
                </p>
                <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                  {sinCoordenadas.map((visita) => (
                    <li key={visita.idRutaVisita}>
                      {visita.nombreHospital ?? `Hospital ${visita.idRutaVisita}`}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" onClick={() => void copiarSinCoordenadas()}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar lista
                </Button>
              </div>
            </div>
          </div>
        )}

        <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {grupos.map((grupo) => {
            const seleccionablesDia = grupo.visitas.filter(
              (visita) => tieneCoordenadas(visita) && !visitasCotizadas?.has(visita.idRutaVisita)
            );
            const seleccionadasDia = seleccionablesDia.filter((visita) =>
              seleccionadas.has(visita.idRutaVisita)
            ).length;
            const bloqueadasDia = grupo.visitas.filter((visita) =>
              visitasCotizadas?.has(visita.idRutaVisita)
            ).length;
            const todasDelDia =
              seleccionablesDia.length > 0 && seleccionadasDia === seleccionablesDia.length;
            const algunasDelDia = seleccionadasDia > 0 && !todasDelDia;
            const sinCoordenadasDia =
              grupo.visitas.length - seleccionablesDia.length - bloqueadasDia;

            return (
              <li key={grupo.fecha} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
                  <Checkbox
                    checked={todasDelDia ? true : algunasDelDia ? 'indeterminate' : false}
                    onCheckedChange={() => alternarDia(grupo.visitas)}
                    disabled={seleccionablesDia.length === 0}
                  />
                  <span className="text-sm font-semibold">{fechaLarga(grupo.fecha)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {seleccionadasDia}/{seleccionablesDia.length} disponibles
                  </span>
                  {bloqueadasDia > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      {bloqueadasDia} cotizada(s)
                    </Badge>
                  )}
                  {sinCoordenadasDia > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    >
                      {sinCoordenadasDia} sin coordenadas
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {grupo.visitas.map((visita) => {
                    const conCoordenadas = tieneCoordenadas(visita);
                    const cotizada = visitasCotizadas?.get(visita.idRutaVisita);
                    const habilitada = conCoordenadas && !cotizada;
                    return (
                      <label
                        key={visita.idRutaVisita}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
                          cotizada
                            ? 'cursor-default border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
                            : habilitada
                              ? 'cursor-pointer bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950'
                              : 'cursor-not-allowed bg-muted'
                        }`}
                      >
                        <Checkbox
                          checked={habilitada && seleccionadas.has(visita.idRutaVisita)}
                          onCheckedChange={() => alternar(visita.idRutaVisita)}
                          disabled={!habilitada}
                        />
                        <Hospital className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {visita.nombreHospital ?? 'Hospital'}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {visita.nombreRegion ?? '-'}
                          </span>
                        </span>
                        {cotizada && (
                          <Badge
                            variant="secondary"
                            className="max-w-[170px] shrink-0 truncate bg-emerald-50 text-[9px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            {cotizada.folio ?? `Solicitud #${cotizada.idSolicitud}`}-{' '}
                            {estadoCotizacion(cotizada.estado)}
                          </Badge>
                        )}
                        {cotizada && onAbrirCotizacion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 shrink-0 px-1.5 text-[11px]"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onAbrirCotizacion(cotizada.idSolicitud, cotizada.estado);
                            }}
                          >
                            Abrir
                          </Button>
                        )}
                        {!conCoordenadas && !cotizada && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-amber-50 text-[9px] text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          >
                            Sin coordenadas
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
