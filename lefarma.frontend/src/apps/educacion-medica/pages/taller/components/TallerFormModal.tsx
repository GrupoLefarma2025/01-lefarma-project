import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import {
  CatalogoSearchSelect,
  type CatalogoItem,
} from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import type {
  ActualizarTallerRequest,
  Asignacion,
  CrearTallerRequest,
  EquipoPareo,
  Hospital,
  HospitalElegible,
  Producto,
  Taller,
  TipoRecursoTaller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface RecursoForm {
  tipoRecurso: TipoRecursoTaller;
  idProducto: string;
  descripcion: string;
  tipoEnvio: string;
  cantidad: string;
  observaciones: string;
}

const RECURSOS: { value: TipoRecursoTaller; label: string }[] = [
  { value: 'Producto', label: 'Muestras de producto' },
  { value: 'Folleto', label: 'Folletos' },
  { value: 'Envio', label: 'Gastos de envío' },
  { value: 'BoxLunch', label: 'Box lunch' },
];

function recursoVacio(tipoRecurso: TipoRecursoTaller = 'Producto'): RecursoForm {
  return {
    tipoRecurso,
    idProducto: '',
    descripcion: '',
    tipoEnvio: '',
    cantidad: '',
    observaciones: '',
  };
}

const aTexto = (valor: string | null | undefined) => valor ?? '';
const aNumero = (valor: string): number | null => {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};
const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};
const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

interface TallerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Taller en edición; null para alta. */
  taller: Taller | null;
  asignaciones: Asignacion[];
  /** Hospital preseleccionado (deep-link "Registrar taller"). */
  idSeleccionHospitalInicial?: number | null;
  /** Equipo de pareo (datos de solo lectura del encabezado FOR-008). */
  nombreEjecutivo?: string | null;
  nombreEspecialista?: string | null;
  guardando?: boolean;
  onGuardar: (
    payload: CrearTallerRequest | ActualizarTallerRequest,
    idTaller: number | null
  ) => void | Promise<void>;
}

/**
 * Alta/edición de un taller con los campos FOR-005 1–12 (sin costos: los registra el AEM).
 * Incluye captura asistida del CEM (equipo explícito; ADR-00011), taller extraordinario
 * (hospital del catálogo + motivo) y modo ajuste post-cierre (ADR-00010).
 */
export function TallerFormModal({
  open,
  onClose,
  taller,
  asignaciones,
  idSeleccionHospitalInicial,
  nombreEjecutivo,
  nombreEspecialista,
  guardando,
  onGuardar,
}: TallerFormModalProps) {
  const puedeAsistida = usePermission({
    require: 'educacion_medica.talleres.puede_capturar_asistida',
  });
  const puedeExtraordinarios = usePermission({
    require: 'educacion_medica.talleres.puede_capturar_extraordinarios',
  });
  const puedeAjustar = usePermission({ require: 'educacion_medica.talleres.puede_ajustar' });

  const esAjuste =
    taller != null &&
    puedeAjustar &&
    (taller.estado === 'Autorizado' || taller.estado === 'Programado');

  const [idSeleccionHospital, setIdSeleccionHospital] = useState('');
  const [numeroParticipantes, setNumeroParticipantes] = useState('');
  const [unidadMedica, setUnidadMedica] = useState('');
  const [lugar, setLugar] = useState('');
  const [fechaTaller, setFechaTaller] = useState('');
  const [horaTaller, setHoraTaller] = useState('');
  const [requiereEquipo, setRequiereEquipo] = useState(false);
  const [tipoEquipo, setTipoEquipo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [recursos, setRecursos] = useState<RecursoForm[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Captura asistida / extraordinario
  const [equipos, setEquipos] = useState<EquipoPareo[]>([]);
  const [idEquipo, setIdEquipo] = useState<number | null>(null);
  const [hospitalesElegibles, setHospitalesElegibles] = useState<HospitalElegible[]>([]);
  const [extraordinario, setExtraordinario] = useState(false);
  const [idHospitalCatalogo, setIdHospitalCatalogo] = useState<number | null>(null);
  const [motivoExtraordinario, setMotivoExtraordinario] = useState('');
  const [hospitalesCatalogo, setHospitalesCatalogo] = useState<Hospital[]>([]);

  // Motivo del ajuste post-cierre
  const [motivoAjuste, setMotivoAjuste] = useState('');

  const hospitalesAsignados = useMemo(() => {
    const vistos = new Map<number, Asignacion>();
    for (const a of asignaciones) {
      if (a.idSeleccionHospital == null) continue;
      if (!vistos.has(a.idSeleccionHospital)) vistos.set(a.idSeleccionHospital, a);
    }
    return [...vistos.values()];
  }, [asignaciones]);

  const itemsHospitales = useMemo<CatalogoItem[]>(() => {
    if (extraordinario) {
      return hospitalesCatalogo.map((h) => ({
        id: h.codigoContacto,
        label: h.nombreContacto,
        description: [h.ciudad, h.clues].filter(Boolean).join(' · ') || undefined,
      }));
    }
    const fuente = hospitalesElegibles.length > 0
      ? hospitalesElegibles.map((h) => ({
          id: h.idSeleccionHospital,
          label: h.nombreHospital ?? `Hospital ${h.idHospital}`,
          description: [h.region, h.ciudadMunicipio].filter(Boolean).join(' · ') || undefined,
        }))
      : hospitalesAsignados.map((a) => ({
          id: a.idSeleccionHospital as number,
          label: a.nombreHospital ?? `Hospital ${a.idHospital ?? a.idSeleccionHospital}`,
          description: [a.nombreRegion, a.ciudadMunicipio].filter(Boolean).join(' · ') || undefined,
        }));
    return fuente;
  }, [extraordinario, hospitalesCatalogo, hospitalesElegibles, hospitalesAsignados]);

  const itemsEquipos = useMemo<CatalogoItem[]>(
    () =>
      equipos.map((e) => ({
        id: e.idEquipo,
        label: `${e.nombreEjecutivo} + ${e.nombreEspecialista}`,
        description: e.nombreRegion ?? undefined,
      })),
    [equipos]
  );

  // Datos del encabezado FOR-008 (solo lectura): de la asignación del hospital o del taller en edición.
  const asignacionSeleccionada = useMemo(() => {
    const id = taller
      ? taller.idSeleccionHospital
      : idSeleccionHospital
        ? Number(idSeleccionHospital)
        : null;
    return id ? (hospitalesAsignados.find((a) => a.idSeleccionHospital === id) ?? null) : null;
  }, [taller, idSeleccionHospital, hospitalesAsignados]);

  const datosUbicacion = useMemo(() => {
    if (asignacionSeleccionada) {
      return {
        region: asignacionSeleccionada.nombreRegion,
        entidadFederativa: asignacionSeleccionada.entidadFederativa,
        ciudadMunicipio: asignacionSeleccionada.ciudadMunicipio,
        institucion: asignacionSeleccionada.institucion,
        fechaVisita: asignacionSeleccionada.fechaVisita,
      };
    }
    if (taller) {
      return {
        region: taller.region,
        entidadFederativa: taller.entidadFederativa,
        ciudadMunicipio: taller.ciudadMunicipio,
        institucion: null,
        fechaVisita: null,
      };
    }
    return null;
  }, [asignacionSeleccionada, taller]);

  // Al elegir hospital de la selección se prellenan la unidad médica y la fecha de la visita planeada.
  const seleccionarHospitalSeleccion = (valor: number | null) => {
    setIdSeleccionHospital(valor != null ? String(valor) : '');
    const asignacion = hospitalesAsignados.find((a) => a.idSeleccionHospital === valor);
    const elegible = hospitalesElegibles.find((h) => h.idSeleccionHospital === valor);
    const nombre = asignacion?.nombreHospital ?? elegible?.nombreHospital ?? null;
    const fecha = asignacion?.fechaVisita ?? elegible?.fechaVisita ?? null;
    if (nombre) setUnidadMedica(nombre);
    if (fecha) setFechaTaller(fecha.slice(0, 10));
  };

  const capturadoPorOtro =
    taller?.capturadoPor != null &&
    taller.idUsuarioCreacion !== taller.idEjecutivo &&
    taller.idUsuarioCreacion !== taller.idEspecialista;

  // Al abrir: precarga el taller a editar o reinicia el formulario de alta.
  const [aperturaAnterior, setAperturaAnterior] = useState(false);
  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    if (open) {
      setMotivoAjuste('');
      setExtraordinario(false);
      setIdHospitalCatalogo(null);
      setMotivoExtraordinario('');
      setIdEquipo(null);
      setHospitalesElegibles([]);
      if (taller) {
        setIdSeleccionHospital(String(taller.idSeleccionHospital ?? ''));
        setNumeroParticipantes(aTexto(taller.numeroParticipantes?.toString()));
        setUnidadMedica(aTexto(taller.unidadMedica));
        setLugar(aTexto(taller.lugar));
        setFechaTaller(aTexto(taller.fechaTaller));
        setHoraTaller(taller.horaTaller ? taller.horaTaller.slice(0, 5) : '');
        setRequiereEquipo(taller.requiereEquipoProyeccion ?? false);
        setTipoEquipo(aTexto(taller.tipoEquipoProyeccion));
        setObservaciones(aTexto(taller.observaciones));
        setRecursos(
          taller.recursos.map((r) => ({
            tipoRecurso: (r.tipoRecurso as TipoRecursoTaller) ?? 'Producto',
            idProducto: aTexto(r.idProducto),
            descripcion: aTexto(r.descripcion),
            tipoEnvio: aTexto(r.tipoEnvio),
            cantidad: aTexto(r.cantidad?.toString()),
            observaciones: aTexto(r.observaciones),
          }))
        );
      } else {
        const idInicial = idSeleccionHospitalInicial ? String(idSeleccionHospitalInicial) : '';
        const asignacionInicial = idInicial
          ? (hospitalesAsignados.find((a) => String(a.idSeleccionHospital) === idInicial) ?? null)
          : null;
        setIdSeleccionHospital(idInicial);
        setNumeroParticipantes('');
        setUnidadMedica(asignacionInicial?.nombreHospital ?? '');
        setLugar('');
        setFechaTaller(asignacionInicial ? asignacionInicial.fechaVisita.slice(0, 10) : '');
        setHoraTaller('');
        setRequiereEquipo(false);
        setTipoEquipo('');
        setObservaciones('');
        setRecursos([]);
      }
    }
  }

  // Catálogo de productos para el recurso "Muestras de producto" (se carga al primer uso).
  const productosSolicitados = useRef(false);
  useEffect(() => {
    if (!open || productosSolicitados.current) return;
    productosSolicitados.current = true;
    void educacionMedicaApi.productos
      .getAll()
      .then((res) => {
        if (res.data.success) setProductos(res.data.data ?? []);
      })
      .catch(() => setProductos([]));
  }, [open]);

  // Equipos (captura asistida/extraordinario) y hospitales elegibles del equipo elegido.
  useEffect(() => {
    if (!open || (!puedeAsistida && !puedeExtraordinarios)) return;
    educacionMedicaApi.equiposPareo
      .getAll({ soloVigentes: true })
      .then((res) => {
        if (res.data.success) setEquipos(res.data.data ?? []);
      })
      .catch(() => setEquipos([]));
  }, [open, puedeAsistida, puedeExtraordinarios]);

  useEffect(() => {
    if (!open || extraordinario || idEquipo == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpieza de elegibles cuando no aplica la captura asistida
      setHospitalesElegibles([]);
      return;
    }
    educacionMedicaApi.rutas
      .hospitalesElegibles(idEquipo)
      .then((res) => {
        if (res.data.success) setHospitalesElegibles(res.data.data ?? []);
      })
      .catch(() => setHospitalesElegibles([]));
  }, [open, extraordinario, idEquipo]);

  // Catálogo completo de hospitales para el modo extraordinario (búsqueda local en el select).
  useEffect(() => {
    if (!open || !extraordinario || hospitalesCatalogo.length > 0) return;
    educacionMedicaApi.hospitales
      .getAll({ activo: true, pageSize: 500, orderBy: 'nombreContacto' })
      .then((res) => {
        if (res.data.success) setHospitalesCatalogo(res.data.data?.items ?? []);
      })
      .catch(() => setHospitalesCatalogo([]));
  }, [open, extraordinario, hospitalesCatalogo.length]);

  const actualizarRecurso = (idx: number, cambios: Partial<RecursoForm>) => {
    setRecursos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...cambios } : r)));
  };

  const guardar = () => {
    if (esAjuste && taller) {
      if (motivoAjuste.trim().length < 5) {
        toast.error('El motivo del ajuste es obligatorio.');
        return;
      }
      void onGuardar(
        {
          fechaTaller: aTextoONull(fechaTaller),
          horaTaller: aTextoONull(horaTaller),
          lugar: aTextoONull(lugar),
          numeroParticipantes: aNumero(numeroParticipantes),
          motivo: motivoAjuste.trim(),
        } as ActualizarTallerRequest,
        taller.idTaller
      );
      return;
    }

    if (!taller) {
      if (extraordinario) {
        if (idEquipo == null) {
          toast.error('Selecciona el equipo del taller extraordinario.');
          return;
        }
        if (idHospitalCatalogo == null) {
          toast.error('Selecciona el hospital del catálogo.');
          return;
        }
        if (motivoExtraordinario.trim().length < 5) {
          toast.error('El motivo del taller extraordinario es obligatorio.');
          return;
        }
      } else if (!idSeleccionHospital) {
        toast.error('Selecciona el hospital de la selección.');
        return;
      }
    }

    const payloadBase = {
      numeroParticipantes: aNumero(numeroParticipantes),
      unidadMedica: aTextoONull(unidadMedica),
      lugar: aTextoONull(lugar),
      fechaTaller: aTextoONull(fechaTaller),
      horaTaller: aTextoONull(horaTaller),
      requiereEquipoProyeccion: requiereEquipo,
      tipoEquipoProyeccion: requiereEquipo ? aTextoONull(tipoEquipo) : null,
      observaciones: aTextoONull(observaciones),
      recursos: recursos.map((r) => ({
        tipoRecurso: r.tipoRecurso,
        idProducto: r.tipoRecurso === 'Producto' ? aTextoONull(r.idProducto) : null,
        descripcion: aTextoONull(r.descripcion),
        tipoEnvio: r.tipoRecurso === 'Envio' ? aTextoONull(r.tipoEnvio) : null,
        cantidad: aNumero(r.cantidad),
        observaciones: aTextoONull(r.observaciones),
      })),
    };

    if (taller) {
      void onGuardar(payloadBase as ActualizarTallerRequest, taller.idTaller);
    } else if (extraordinario) {
      void onGuardar(
        {
          ...payloadBase,
          esExtraordinario: true,
          idHospital: idHospitalCatalogo,
          idEquipo,
          motivoExtraordinario: motivoExtraordinario.trim(),
        } as CrearTallerRequest,
        null
      );
    } else {
      void onGuardar(
        {
          ...payloadBase,
          idSeleccionHospital: Number(idSeleccionHospital),
          idEquipo: idEquipo ?? undefined,
        } as CrearTallerRequest,
        null
      );
    }
  };

  return (
    <Modal
      id="modal-taller-form"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        esAjuste
          ? 'Ajustar taller (post-cierre)'
          : taller
            ? 'Editar taller'
            : 'Capturar taller'
      }
      size="wide"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando
              ? 'Guardando...'
              : esAjuste
                ? 'Aplicar ajuste'
                : taller
                  ? 'Guardar cambios'
                  : 'Capturar taller'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {capturadoPorOtro && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-800 dark:bg-amber-950/30">
            Capturado por: <strong>{taller?.capturadoPor}</strong> (captura asistida)
          </p>
        )}

        {esAjuste && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            El taller está {taller?.estado}: solo puedes ajustar fecha, hora, lugar y participantes.
            El cambio exige motivo y queda auditado; si cambias la fecha se mueve la visita de la
            ruta activa (ADR-00010).
          </p>
        )}

        {!esAjuste && (datosUbicacion || nombreEjecutivo || nombreEspecialista) && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Ruta planeada de la visita
            </p>

            {datosUbicacion && (
              <dl className="mt-2 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <dt className="text-muted-foreground">Región</dt>
                  <dd className="font-medium">{datosUbicacion.region ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd className="font-medium">{datosUbicacion.entidadFederativa ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ciudad / Municipio</dt>
                  <dd className="font-medium">{datosUbicacion.ciudadMunicipio ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Institución</dt>
                  <dd className="font-medium">{datosUbicacion.institucion ?? '—'}</dd>
                </div>
                {datosUbicacion.fechaVisita && (
                  <div>
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      Visita planeada
                    </dt>
                    <dd className="font-medium">{fmtFecha(datosUbicacion.fechaVisita)}</dd>
                  </div>
                )}
              </dl>
            )}

            {(nombreEjecutivo || nombreEspecialista) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Equipo de pareo
                </span>
                <span className="font-medium">
                  {nombreEjecutivo ?? '—'}{' '}
                  <span className="font-normal text-muted-foreground">(Ejecutivo)</span>
                </span>
                <span className="font-medium">
                  {nombreEspecialista ?? '—'}{' '}
                  <span className="font-normal text-muted-foreground">(Especialista)</span>
                </span>
              </div>
            )}
          </div>
        )}

          {!taller && puedeExtraordinarios && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch checked={extraordinario} onCheckedChange={setExtraordinario} />
                <Label>Hospital extraordinario</Label>
              </div>
              {extraordinario && (
                <div className="min-w-[240px] flex-1 space-y-1">
                  <Label className="text-xs">Motivo del extraordinario *</Label>
                  <Input
                    value={motivoExtraordinario}
                    onChange={(e) => setMotivoExtraordinario(e.target.value)}
                    placeholder="Imprevisto que origina el taller"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
          {!esAjuste && (
            <>
              {(puedeAsistida || (puedeExtraordinarios && !taller)) && (
                <div className="space-y-1">
                  <Label>Equipo {extraordinario ? '*' : '(captura asistida)'}</Label>
                  <CatalogoSearchSelect
                    items={itemsEquipos}
                    value={idEquipo}
                    onChange={(valor) => {
                      setIdEquipo(valor);
                      setIdSeleccionHospital('');
                      setUnidadMedica('');
                      setFechaTaller('');
                    }}
                    placeholder="Buscar equipo..."
                    disabled={Boolean(taller)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Captura a nombre del equipo elegido (hospitales de su selección).
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label>
                  {extraordinario ? 'Hospital del catálogo *' : 'Hospital (selección del mes)'}
                </Label>
                {taller ? (
                  <Input value={taller.nombreHospital ?? '—'} disabled />
                ) : extraordinario ? (
                  <CatalogoSearchSelect
                    items={itemsHospitales}
                    value={idHospitalCatalogo}
                    onChange={(valor) => {
                      setIdHospitalCatalogo(valor);
                      const h = hospitalesCatalogo.find((x) => x.codigoContacto === valor);
                      if (h) setUnidadMedica(h.nombreContacto);
                    }}
                    placeholder="Buscar en el catálogo de hospitales..."
                  />
                ) : (
                  <CatalogoSearchSelect
                    items={itemsHospitales}
                    value={idSeleccionHospital ? Number(idSeleccionHospital) : null}
                    onChange={seleccionarHospitalSeleccion}
                    placeholder="Buscar hospital asignado..."
                  />
                )}
                {!taller && (
                  <p className="text-xs text-muted-foreground">
                    {extraordinario
                      ? 'Hospital del catálogo fuera de la selección autorizada.'
                      : 'Solo hospitales con ruta autorizada de tu equipo.'}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label>No. de participantes</Label>
            <Input
              type="number"
              min={0}
              value={numeroParticipantes}
              onChange={(e) => setNumeroParticipantes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Asistentes estimados al taller.</p>
          </div>

          {!esAjuste && (
            <div className="space-y-1">
              <Label>Unidad médica</Label>
              <Input value={unidadMedica} onChange={(e) => setUnidadMedica(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Se prellena con el nombre del hospital; ajústala si la unidad se llama distinto.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Lugar</Label>
            <Input value={lugar} onChange={(e) => setLugar(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Sala, auditorio o área donde se impartirá el taller.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Fecha del taller</Label>
            <Input
              type="date"
              value={fechaTaller}
              onChange={(e) => setFechaTaller(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {esAjuste
                ? 'Al cambiar la fecha se mueve la visita de la ruta activa (misma transacción).'
                : 'Se prellena con la fecha planeada de la visita; puedes ajustarla.'}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Hora del taller</Label>
            <Input
              type="time"
              value={horaTaller}
              onChange={(e) => setHoraTaller(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Hora programada del taller.</p>
          </div>

          {esAjuste && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo del ajuste *</Label>
              <Textarea
                rows={2}
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
                placeholder="Explica por qué se ajusta el taller (obligatorio, queda auditado)"
              />
            </div>
          )}

          {!esAjuste && (
            <div className="space-y-1">
              <Label>¿Requiere equipo de proyección?</Label>
              <div className="flex h-9 items-center gap-3">
                <Switch checked={requiereEquipo} onCheckedChange={setRequiereEquipo} />
                {requiereEquipo && (
                  <Select value={tipoEquipo} onValueChange={setTipoEquipo}>
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue placeholder="Propio o rentado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Propio">Propio</SelectItem>
                      <SelectItem value="Rentado">Rentado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Indica si se requiere proyector y si es propio o rentado.
              </p>
            </div>
          )}
        </div>

        {!esAjuste && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recursos del taller</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecursos((prev) => [...prev, recursoVacio()])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar recurso
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Captura muestras, folletos, gastos de envío y box lunch con su cantidad; los costos
                los registra el Auxiliar de Educación Médica.
              </p>
              {recursos.map((recurso, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={recurso.tipoRecurso}
                      onValueChange={(v) =>
                        actualizarRecurso(idx, { tipoRecurso: v as TipoRecursoTaller })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURSOS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {recurso.tipoRecurso === 'Producto' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Producto</Label>
                      <Select
                        value={recurso.idProducto}
                        onValueChange={(v) => actualizarRecurso(idx, { idProducto: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecciona producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((p) => (
                            <SelectItem key={p.codigoProducto} value={String(p.codigoProducto)}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : recurso.tipoRecurso === 'Envio' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de envío</Label>
                      <Select
                        value={recurso.tipoEnvio}
                        onValueChange={(v) => actualizarRecurso(idx, { tipoEnvio: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Interno o externo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Interno">Interno</SelectItem>
                          <SelectItem value="Externo">Externo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        value={recurso.descripcion}
                        onChange={(e) => actualizarRecurso(idx, { descripcion: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">
                      {recurso.tipoRecurso === 'BoxLunch'
                        ? 'No. de servicios'
                        : recurso.tipoRecurso === 'Envio'
                          ? 'Cantidad'
                          : 'Cantidad (piezas)'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={recurso.cantidad}
                      onChange={(e) => actualizarRecurso(idx, { cantidad: e.target.value })}
                    />
                  </div>

                  <div className="flex items-end pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setRecursos((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="space-y-1 sm:col-span-4">
                    <Label className="text-xs">Observaciones del recurso</Label>
                    <Input
                      value={recurso.observaciones}
                      onChange={(e) => actualizarRecurso(idx, { observaciones: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Notas o acuerdos del taller (opcional).
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
