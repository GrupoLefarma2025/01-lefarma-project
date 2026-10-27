import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  LockKeyhole,
  MapPin,
  MoveRight,
  Plus,
  Presentation,
  Sparkles,
  Wallet,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermission } from '@/hooks/usePermission';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { educacionMedicaApi } from '../../../services/educacionMedica.api';
import type {
  CalendarioItem,
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  Taller,
} from '../../../types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import {
  estadoEtiqueta,
  estiloEvento,
  fechaCompacta,
  fmtHora,
  fmtMoneda,
  iniciales,
  tonoAvatar,
  tonoEvento,
} from '../calendarioUtils';

const HEREDAR = 'heredar';
const SIN_ESPECIALISTA = 'sin-especialista';

interface CalendarioInspectorProps {
  item: CalendarioItem | null;
  ejecutivos: EjecutivoRegion[];
  suplentes: EjecutivoSuplente[];
  especialistas: EspecialistaPersona[];
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onCrearTaller: (item: CalendarioItem) => void;
  pendientes: CalendarioItem[];
  onSelectItem: (item: CalendarioItem) => void;
}

function Dato({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
          {value}
        </p>
      </div>
    </div>
  );
}

export function CalendarioInspector({
  item,
  ejecutivos,
  suplentes,
  especialistas,
  onClose,
  onRefresh,
  onCrearTaller,
  pendientes,
  onSelectItem,
}: CalendarioInspectorProps) {
  const puedeGestionar = usePermission({
    require: 'educacion_medica.rutas.puede_gestionar',
  });
  const puedeCapturar = usePermission({
    require: 'educacion_medica.talleres.puede_capturar',
  });

  const [idEjecutivo, setIdEjecutivo] = useState(HEREDAR);
  const [idEspecialista, setIdEspecialista] = useState(SIN_ESPECIALISTA);
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardandoEjecutivo, setGuardandoEjecutivo] = useState(false);
  const [guardandoEspecialista, setGuardandoEspecialista] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [tab, setTab] = useState<'detalle' | 'talleres'>('detalle');
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [cargandoTalleres, setCargandoTalleres] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza el formulario con la actividad seleccionada */
  useEffect(() => {
    if (!item) return;
    setIdEjecutivo(item.idEjecutivo ? String(item.idEjecutivo) : HEREDAR);
    setIdEspecialista(item.idEspecialista ? String(item.idEspecialista) : SIN_ESPECIALISTA);
    setFecha(item.fecha);
    setMotivo('');
  }, [item?.idRutaVisita, item?.idEjecutivo, item?.idEspecialista, item?.fecha, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- carga los talleres de la visita seleccionada */
  useEffect(() => {
    if (!item?.idRutaVisita) {
      setTalleres([]);
      return;
    }

    let cancelado = false;
    setCargandoTalleres(true);
    void educacionMedicaApi.talleres
      .getByVisita(item.idRutaVisita)
      .then((response) => {
        if (!cancelado && response.data.success) {
          setTalleres(response.data.data ?? []);
        }
      })
      .catch(() => {
        if (!cancelado) setTalleres([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoTalleres(false);
      });

    return () => {
      cancelado = true;
    };
  }, [item?.idRutaVisita, item?.idTaller]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const opcionesEjecutivo = useMemo(() => {
    const mapa = new Map<number, { nombre: string; etiqueta: string }>();
    ejecutivos.forEach((ejecutivo) => {
      mapa.set(ejecutivo.idUsuario, {
        nombre: ejecutivo.nombreUsuario,
        etiqueta: `${ejecutivo.nombreRegion} · ${ejecutivo.nombreGerencia}`,
      });
    });
    suplentes.forEach((suplente) => {
      if (mapa.has(suplente.idUsuario)) return;
      mapa.set(suplente.idUsuario, {
        nombre: suplente.nombreUsuario,
        etiqueta: `${suplente.nombreRegion ?? 'Todas las regiones'} · Suplente`,
      });
    });
    if (item?.idEjecutivo && !mapa.has(item.idEjecutivo)) {
      mapa.set(item.idEjecutivo, {
        nombre: item.nombreEjecutivo ?? `Ejecutivo ${item.idEjecutivo}`,
        etiqueta: item.region ?? item.gerencia,
      });
    }
    return Array.from(mapa.entries()).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  }, [ejecutivos, suplentes, item]);

  const opcionesEspecialista = useMemo(() => {
    const compatibles = especialistas.filter((especialista) =>
      especialista.gerencias.some(
        (gerencia) => gerencia.activo && gerencia.nombreGerencia === item?.gerencia
      )
    );
    const base = compatibles.length > 0 ? compatibles : especialistas;
    const ordenados = [...base].sort((a, b) => a.nombreUsuario.localeCompare(b.nombreUsuario));
    if (
      item?.idEspecialista &&
      !ordenados.some((especialista) => especialista.idUsuario === item.idEspecialista)
    ) {
      ordenados.unshift({
        idUsuario: item.idEspecialista,
        nombreUsuario: item.nombreEspecialista ?? `Especialista ${item.idEspecialista}`,
        gerencias: [],
        regionPreferida: null,
        activo: true,
      });
    }
    return ordenados;
  }, [especialistas, item]);

  if (!item) {
    return (
      <aside className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
        <div className="flex flex-col items-center border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-orange-50/40 px-8 py-7 text-center dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-orange-950/20">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
            <CalendarDays className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Selecciona una actividad
          </p>
          <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Consulta el detalle, reasigna responsables o programa el taller desde aquí.
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Solicitudes pendientes
            </p>
            <Badge
              variant="secondary"
              className="rounded-full bg-slate-100 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              {pendientes.length}
            </Badge>
          </div>

          {pendientes.length > 0 ? (
            <div className="mt-2.5 space-y-1.5">
              {pendientes.slice(0, 4).map((pendiente) => (
                <button
                  key={pendiente.idRutaVisita}
                  type="button"
                  onClick={() => onSelectItem(pendiente)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/50 px-2.5 py-2 text-left transition-colors hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {pendiente.hospital}
                    </span>
                    <span className="block truncate text-[9px] text-slate-400">
                      {fechaCompacta(pendiente.fecha)}
                      {pendiente.hora ? ` · ${fmtHora(pendiente.hora)}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-400 dark:bg-slate-900/50">
              No hay solicitudes de cambio pendientes en el periodo visible.
            </p>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-400 dark:border-slate-800">
            Arrastra una tarjeta en el calendario para reprogramarla o usa los filtros rápidos para
            enfocar tu agenda.
          </div>
        </div>
      </aside>
    );
  }

  const estilo = estiloEvento[tonoEvento(item)];
  const hora = fmtHora(item.hora);

  const aplicarEjecutivo = async () => {
    if (!puedeGestionar || !item) return;
    const nuevo = idEjecutivo === HEREDAR ? null : Number(idEjecutivo);
    if (nuevo === item.idEjecutivo) return;

    setGuardandoEjecutivo(true);
    try {
      const response = await educacionMedicaApi.rutas.asignarEjecutivoVisita(
        item.idRuta,
        item.idRutaVisita,
        { idEjecutivo: nuevo, motivo: motivo.trim() || null }
      );
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo reasignar el ejecutivo.');
      }
      toast.success('Ejecutivo de la visita actualizado.');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo reasignar el ejecutivo.');
    } finally {
      setGuardandoEjecutivo(false);
    }
  };

  const aplicarEspecialista = async () => {
    if (!puedeGestionar || !item) return;
    const nuevo = idEspecialista === SIN_ESPECIALISTA ? null : Number(idEspecialista);
    if (nuevo === item.idEspecialista) return;

    setGuardandoEspecialista(true);
    try {
      const response = await educacionMedicaApi.calendario.asignarEspecialista(
        item.idRutaVisita,
        nuevo
      );
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo reasignar al especialista.');
      }
      toast.success('Especialista de la visita actualizado.');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo reasignar al especialista.');
    } finally {
      setGuardandoEspecialista(false);
    }
  };

  const mover = async () => {
    if (!puedeGestionar || !item || !fecha || fecha === item.fecha) return;
    setMoviendo(true);
    try {
      const response = await educacionMedicaApi.rutas.moverVisita(item.idRuta, item.idRutaVisita, {
        fechaVisita: fecha,
        orden: item.orden,
        motivo: motivo.trim() || null,
      });
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'No se pudo mover la visita.');
      }
      toast.success('Visita reprogramada.');
      await onRefresh();
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo mover la visita.');
    } finally {
      setMoviendo(false);
    }
  };

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800">
      <div className="relative border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-orange-50/50 px-5 pb-4 pt-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-orange-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm ${estilo.chip}`}
            >
              {iniciales(item.hospital)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                {item.hospital ?? 'Hospital sin nombre'}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.region ?? 'Sin región'}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span>{item.gerencia}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 h-8 w-8 rounded-full text-slate-400 hover:text-slate-700"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`rounded-full text-[10px] ${estilo.chip}`}>
            <span className={`mr-1 h-1.5 w-1.5 rounded-full ${estilo.punto}`} />
            {estadoEtiqueta[item.estado] ?? item.estado}
          </Badge>
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {item.idTaller ? 'Taller' : item.tipoVisita || 'Visita'}
          </Badge>
          {item.esExtraordinario && (
            <Badge
              variant="secondary"
              className="rounded-full border-violet-200 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
            >
              Extraordinaria
            </Badge>
          )}
          {item.solicitudCambioPendiente && (
            <Badge
              variant="secondary"
              className="rounded-full border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            >
              Cambio pendiente
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'detalle' | 'talleres')}>
        <div className="border-b border-slate-200/70 px-4 pt-1 dark:border-slate-800">
          <TabsList className="h-9 w-full justify-start gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="detalle"
              className="rounded-none border-b-2 border-transparent px-2 text-[11px] data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 data-[state=active]:shadow-none dark:data-[state=active]:text-orange-300"
            >
              Detalle
            </TabsTrigger>
            <TabsTrigger
              value="talleres"
              className="gap-1.5 rounded-none border-b-2 border-transparent px-2 text-[11px] data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 data-[state=active]:shadow-none dark:data-[state=active]:text-orange-300"
            >
              Talleres
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {talleres.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalle" className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2">
            <Dato icon={CalendarDays} label="Fecha" value={fechaCompacta(item.fecha)} />
            <Dato icon={Clock3} label="Hora" value={hora ?? 'Sin hora'} />
            <Dato
              icon={UserRound}
              label="Ejecutivo"
              value={item.nombreEjecutivo ?? 'Sin asignar'}
            />
            <Dato
              icon={Sparkles}
              label="Especialista"
              value={item.nombreEspecialista ?? 'Sin asignar'}
            />
          </div>

          {(item.tema || item.producto) && (
            <div className="rounded-xl border border-slate-200/70 px-3 py-3 dark:border-slate-800">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Actividad
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {item.tema ?? item.producto}
              </p>
              {item.producto && item.tema && (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.producto}
                  {item.cantidad ? ` · ${item.cantidad} unidades` : ''}
                </p>
              )}
              {item.participantes != null && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Users className="h-3 w-3" />
                  {item.participantes} participantes
                </p>
              )}
            </div>
          )}

          {item.conflictos.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 dark:border-rose-900 dark:bg-rose-950/40">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conflictos detectados
              </p>
              <ul className="mt-1.5 space-y-1 pl-5 text-[11px] leading-snug text-rose-600 dark:text-rose-300">
                {item.conflictos.map((conflicto) => (
                  <li key={conflicto} className="list-disc">
                    {conflicto}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.bloqueado && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                La actividad está bloqueada. Los ajustes requieren motivo y permiso de rutas.
              </span>
            </div>
          )}

          {puedeGestionar ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Ejecutivo responsable</Label>
                  {idEjecutivo !== (item.idEjecutivo ? String(item.idEjecutivo) : HEREDAR) && (
                    <Check className="h-3 w-3 text-emerald-500" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={idEjecutivo} onValueChange={setIdEjecutivo}>
                    <SelectTrigger className="h-9 min-w-0 flex-1 text-xs">
                      <SelectValue placeholder="Selecciona ejecutivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={HEREDAR}>
                        <span className="text-slate-500">Heredar de la selección</span>
                      </SelectItem>
                      {opcionesEjecutivo.map(([id, opcion]) => (
                        <SelectItem key={id} value={String(id)}>
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700">
                              {iniciales(opcion.nombre)}
                            </span>
                            <span className="truncate">{opcion.nombre}</span>
                            <span className="truncate text-[10px] text-slate-400">
                              {opcion.etiqueta}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    disabled={
                      guardandoEjecutivo ||
                      idEjecutivo === (item.idEjecutivo ? String(item.idEjecutivo) : HEREDAR)
                    }
                    onClick={() => void aplicarEjecutivo()}
                  >
                    {guardandoEjecutivo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Aplicar'
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Especialista</Label>
                <div className="flex gap-2">
                  <Select value={idEspecialista} onValueChange={setIdEspecialista}>
                    <SelectTrigger className="h-9 min-w-0 flex-1 text-xs">
                      <SelectValue placeholder="Selecciona especialista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ESPECIALISTA}>
                        <span className="text-slate-500">Sin especialista</span>
                      </SelectItem>
                      {opcionesEspecialista.map((especialista) => (
                        <SelectItem
                          key={especialista.idUsuario}
                          value={String(especialista.idUsuario)}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${tonoAvatar(especialista.nombreUsuario)}`}
                            >
                              {iniciales(especialista.nombreUsuario)}
                            </span>
                            {especialista.nombreUsuario}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    disabled={
                      guardandoEspecialista ||
                      idEspecialista ===
                        (item.idEspecialista ? String(item.idEspecialista) : SIN_ESPECIALISTA)
                    }
                    onClick={() => void aplicarEspecialista()}
                  >
                    {guardandoEspecialista ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Aplicar'
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calendario-mover" className="text-xs">
                  Reprogramar visita
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="calendario-mover"
                    type="date"
                    className="h-9 flex-1 text-xs"
                    value={fecha}
                    onChange={(event) => setFecha(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    disabled={moviendo || !fecha || fecha === item.fecha}
                    onClick={() => void mover()}
                  >
                    {moviendo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <MoveRight className="mr-1 h-3.5 w-3.5" />
                        Mover
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {(item.bloqueado || item.solicitudCambioPendiente) && (
                <div className="space-y-1.5">
                  <Label htmlFor="calendario-motivo" className="text-xs">
                    Motivo del ajuste
                  </Label>
                  <Input
                    id="calendario-motivo"
                    className="h-9 text-xs"
                    placeholder="Describe el motivo del cambio"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              Tienes acceso de consulta. Para reasignar responsables necesitas permiso de gestión de
              rutas.
            </div>
          )}
        </TabsContent>

        <TabsContent value="talleres" className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Talleres de esta visita
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {talleres.length} registrado{talleres.length === 1 ? '' : 's'}
              </p>
            </div>
            {puedeCapturar && (
              <Button
                size="sm"
                className="h-8 gap-1 rounded-lg bg-[#eb6c36] px-2.5 text-[10px] text-white hover:bg-[#d95a2b]"
                onClick={() => onCrearTaller(item)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo taller
              </Button>
            )}
          </div>

          {cargandoTalleres ? (
            <div className="space-y-2">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
            </div>
          ) : talleres.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center dark:border-slate-800 dark:bg-slate-900/30">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-900">
                <Presentation className="h-4 w-4" />
              </span>
              <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Sin taller registrado
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Programa el primer taller usando la fecha de la visita.
              </p>
              {puedeCapturar && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 rounded-lg text-[10px]"
                  onClick={() => onCrearTaller(item)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Programar taller
                </Button>
              )}
            </div>
          ) : (
            talleres.map((taller) => {
              const producto = taller.recursos.find(
                (recurso) => recurso.tipoRecurso === 'Producto'
              );
              return (
                <div
                  key={taller.idTaller}
                  className="rounded-xl border border-slate-200/80 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {taller.fechaTaller
                          ? fechaCompacta(taller.fechaTaller.slice(0, 10))
                          : fechaCompacta(item.fecha)}
                        {taller.horaTaller ? ` · ${fmtHora(taller.horaTaller)}` : ''}
                      </p>
                      <p className="mt-0.5 text-[9px] text-slate-400">
                        {producto?.nombreProducto ?? 'Sin producto'}
                        {producto?.cantidad != null ? ` · ${producto.cantidad} pzas` : ''}
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-full text-[9px]">
                      {estadoEtiqueta[taller.estado] ?? taller.estado}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Users className="h-3 w-3" />
                      {taller.numeroParticipantes ?? 0} participantes
                    </span>
                    <span className="inline-flex items-center justify-end gap-1 tabular-nums text-slate-600 dark:text-slate-300">
                      <Wallet className="h-3 w-3" />
                      {fmtMoneda(taller.costoTotal)}
                    </span>
                  </div>

                  <div className="mt-2 space-y-0.5 text-[9px] text-slate-400">
                    <p>Ejecutivo: {taller.nombreEjecutivo ?? 'Sin asignar'}</p>
                    <p>Especialista: {taller.nombreEspecialista ?? 'Sin asignar'}</p>
                  </div>

                  {(taller.solicitudCambioPendiente || taller.esExtraordinario) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {taller.solicitudCambioPendiente && (
                        <Badge
                          variant="secondary"
                          className="rounded-full border-amber-200 bg-amber-50 text-[8px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        >
                          Cambio pendiente
                        </Badge>
                      )}
                      {taller.esExtraordinario && (
                        <Badge
                          variant="secondary"
                          className="rounded-full border-violet-200 bg-violet-50 text-[8px] text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                        >
                          Extraordinario
                        </Badge>
                      )}
                    </div>
                  )}

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 w-full justify-between rounded-lg px-2.5 text-[9px]"
                  >
                    <Link to="/educacion-medica/talleres">
                      Abrir en matriz
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
