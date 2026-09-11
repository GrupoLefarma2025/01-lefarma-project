import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Search, Loader2, Plus, PowerOff, RotateCcw, MapPin, Users, Map } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { UsuarioSearchSelect } from '@/apps/educacion-medica/components/UsuarioSearchSelect';
import type {
  EquipoPareo,
  EquipoPareoFiltros,
  EquipoOperacion,
  UsuarioCatalogo,
  Region,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const ESTADO_VIGENTES = 'vigentes';
const ESTADO_INACTIVOS = 'inactivos';
const ESTADO_TODOS = 'todos';

interface DraftFiltros {
  estado: string;
  busqueda: string;
  idUsuario: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

const initialDraft: DraftFiltros = {
  estado: ESTADO_VIGENTES,
  busqueda: '',
  idUsuario: null,
  fechaInicio: null,
  fechaFin: null,
};

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

export default function EquiposPareoPage() {
  usePageTitle('Equipos y Pareo', 'Catálogo de Educación Médica');

  const [equipos, setEquipos] = useState<EquipoPareo[]>([]);
  const [equiposVigentes, setEquiposVigentes] = useState<EquipoPareo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<DraftFiltros>(initialDraft);
  const [aplicados, setAplicados] = useState<EquipoPareoFiltros>({ soloVigentes: true });

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmEquipo, setConfirmEquipo] = useState<EquipoPareo | null>(null);
  const [operacionEquipo, setOperacionEquipo] = useState<EquipoPareo | null>(null);
  const [operacion, setOperacion] = useState<EquipoOperacion | null>(null);
  const [loadingOperacion, setLoadingOperacion] = useState(false);

  const [idEjecutivo, setIdEjecutivo] = useState<number | null>(null);
  const [idEspecialista, setIdEspecialista] = useState<number | null>(null);
  const [idRegionPareo, setIdRegionPareo] = useState<number | null>(null);
  const [fechaInicioPareo, setFechaInicioPareo] = useState<string | null>(null);

  const [regionEquipo, setRegionEquipo] = useState<EquipoPareo | null>(null);
  const [idRegionReasignar, setIdRegionReasignar] = useState<number | null>(null);
  const [savingRegion, setSavingRegion] = useState(false);

  const fetchEquipos = useCallback(async (filtros: EquipoPareoFiltros) => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.equiposPareo.getAll(filtros);
      if (response.data.success) {
        setEquipos(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar equipos de pareo');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar equipos de pareo');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEquiposVigentes = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.equiposPareo.getAll({ soloVigentes: true });
      if (response.data.success) {
        setEquiposVigentes(response.data.data ?? []);
      }
    } catch {
      // El aviso de integrante ocupado es solo preventivo; el backend valida de todas formas
    }
  }, []);

  useEffect(() => {
    fetchEquipos({ soloVigentes: true });
    fetchEquiposVigentes();
    educacionMedicaApi.usuarios
      .getAll()
      .then((response) => {
        if (response.data.success) setUsuarios(response.data.data ?? []);
      })
      .catch(() => undefined);
    educacionMedicaApi.regiones
      .getAll()
      .then((response) => {
        if (response.data.success) {
          setRegiones((response.data.data ?? []).filter((z) => z.activo));
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = () => {
    const filtros: EquipoPareoFiltros = {};
    if (draft.estado === ESTADO_VIGENTES) filtros.soloVigentes = true;
    if (draft.estado === ESTADO_INACTIVOS) filtros.soloVigentes = false;
    if (draft.busqueda.trim()) filtros.busqueda = draft.busqueda.trim();
    if (draft.idUsuario) filtros.idUsuario = draft.idUsuario;
    if (draft.fechaInicio) filtros.fechaInicio = draft.fechaInicio;
    if (draft.fechaFin) filtros.fechaFin = draft.fechaFin;

    setAplicados(filtros);
    void fetchEquipos(filtros);
  };

  const limpiar = () => {
    setDraft(initialDraft);
    const filtros: EquipoPareoFiltros = { soloVigentes: true };
    setAplicados(filtros);
    void fetchEquipos(filtros);
  };

  const refrescar = () => {
    void fetchEquipos(aplicados);
    void fetchEquiposVigentes();
  };

  const abrirOperacion = async (equipo: EquipoPareo) => {
    setOperacionEquipo(equipo);
    setOperacion(null);
    setLoadingOperacion(true);
    try {
      const response = await educacionMedicaApi.equiposPareo.getOperacion(equipo.idEquipo);
      if (response.data.success) {
        setOperacion(response.data.data ?? null);
      } else {
        toast.error(response.data.message ?? 'Error al cargar la operación del equipo');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar la operación del equipo');
    } finally {
      setLoadingOperacion(false);
    }
  };

  const idsOcupados = useMemo(
    () =>
      new Set(
        equiposVigentes
          .filter((e) => e.idEquipo !== confirmEquipo?.idEquipo)
          .flatMap((e) => [e.idEjecutivo, e.idEspecialista])
      ),
    [equiposVigentes, confirmEquipo]
  );

  const errorPareo = useMemo(() => {
    if (idEjecutivo && idEspecialista && idEjecutivo === idEspecialista) {
      return 'El ejecutivo y el especialista no pueden ser la misma persona.';
    }
    if (idEjecutivo && idsOcupados.has(idEjecutivo)) {
      const equipo = equiposVigentes.find(
        (e) => e.idEjecutivo === idEjecutivo || e.idEspecialista === idEjecutivo
      );
      return `Ya pertenece al equipo ${equipo?.idEquipo} vigente. Desactívalo primero o elige otra persona.`;
    }
    if (idEspecialista && idsOcupados.has(idEspecialista)) {
      const equipo = equiposVigentes.find(
        (e) => e.idEjecutivo === idEspecialista || e.idEspecialista === idEspecialista
      );
      return `Ya pertenece al equipo ${equipo?.idEquipo} vigente. Desactívalo primero o elige otra persona.`;
    }
    return null;
  }, [idEjecutivo, idEspecialista, idsOcupados, equiposVigentes]);

  const regionesOcupadasIds = useMemo(
    () =>
      new Set(
        equiposVigentes
          .filter((e) => e.idEquipo !== regionEquipo?.idEquipo)
          .map((e) => e.idRegion)
      ),
    [equiposVigentes, regionEquipo]
  );

  const errorRegionPareo = useMemo(() => {
    if (!idRegionPareo) return 'Selecciona la región que operará el equipo.';
    const ocupante = equiposVigentes.find((e) => e.idRegion === idRegionPareo);
    if (ocupante) {
      return `La región ya la opera el equipo ${ocupante.idEquipo}. Desactívalo primero o elige otra región.`;
    }
    return null;
  }, [idRegionPareo, equiposVigentes]);

  const crearPareo = async () => {
    if (!idEjecutivo || !idEspecialista || !idRegionPareo || errorPareo || errorRegionPareo) return;
    setSaving(true);
    try {
      const response = await educacionMedicaApi.equiposPareo.create({
        idEjecutivo,
        idEspecialista,
        idRegion: idRegionPareo,
        fechaInicio: fechaInicioPareo,
      });
      if (response.data.success) {
        toast.success('Equipo de pareo creado exitosamente.');
        setModalOpen(false);
        setIdEjecutivo(null);
        setIdEspecialista(null);
        setIdRegionPareo(null);
        setFechaInicioPareo(null);
        refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al crear el equipo');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al crear el equipo');
    } finally {
      setSaving(false);
    }
  };

  const abrirReasignarRegion = (equipo: EquipoPareo) => {
    setRegionEquipo(equipo);
    setIdRegionReasignar(equipo.idRegion);
  };

  const reasignarRegion = async () => {
    if (!regionEquipo || !idRegionReasignar) return;
    setSavingRegion(true);
    try {
      const response = await educacionMedicaApi.equiposPareo.asignarRegion(regionEquipo.idEquipo, {
        idRegion: idRegionReasignar,
      });
      if (response.data.success) {
        toast.success('Región del equipo actualizada exitosamente.');
        setRegionEquipo(null);
        refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al asignar la región');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al asignar la región');
    } finally {
      setSavingRegion(false);
    }
  };

  const desactivar = async (equipo: EquipoPareo) => {
    try {
      const response = await educacionMedicaApi.equiposPareo.desactivar(equipo.idEquipo);
      if (response.data.success) {
        toast.success(`Equipo ${equipo.idEquipo} desactivado.`);
        setConfirmEquipo(null);
        refrescar();
      } else {
        toast.error(response.data.message ?? 'Error al desactivar el equipo');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al desactivar el equipo');
    }
  };

  const columns = useMemo<ColumnDef<EquipoPareo>[]>(
    () => [
      { accessorKey: 'idEquipo', header: 'ID' },
      { accessorKey: 'nombreEjecutivo', header: 'Ejecutivo de Ventas' },
      { accessorKey: 'nombreEspecialista', header: 'Especialista de Producto' },
      {
        id: 'region',
        header: 'Región',
        cell: ({ row }) =>
          row.original.nombreRegion ?? (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'fechaInicio',
        header: 'Vigencia',
        cell: ({ row }) =>
          `${formatearFecha(row.original.fechaInicio)} — ${
            row.original.fechaFin ? formatearFecha(row.original.fechaFin) : 'hoy'
          }`,
      },
      {
        id: 'regionesActuales',
        header: 'Regiones actuales',
        cell: ({ row }) => {
          const regionesBadge = row.original.regionesActuales ?? [];
          if (regionesBadge.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {regionesBadge.slice(0, 2).map((region) => (
                <Badge key={region} variant="secondary" className="text-[10px]">
                  {region}
                </Badge>
              ))}
              {regionesBadge.length > 2 && (
                <Badge variant="outline" className="text-[10px]">
                  +{regionesBadge.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'activo',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.activo ? (
            <Badge>Vigente</Badge>
          ) : (
            <Badge variant="outline">Inactivo</Badge>
          ),
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Asignar o cambiar región"
              onClick={() => abrirReasignarRegion(row.original)}
            >
              <Map className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Dónde ha operado"
              onClick={() => abrirOperacion(row.original)}
            >
              <MapPin className="h-4 w-4" />
            </Button>
            {row.original.activo && (
              <Button
                variant="ghost"
                size="icon"
                title="Desactivar equipo"
                onClick={() => setConfirmEquipo(row.original)}
              >
                <PowerOff className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="w-full space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select
                value={draft.estado}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, estado: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ESTADO_VIGENTES}>Vigentes</SelectItem>
                  <SelectItem value={ESTADO_INACTIVOS}>No vigentes</SelectItem>
                  <SelectItem value={ESTADO_TODOS}>Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Buscar integrante
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Nombre del EV o EP..."
                  value={draft.busqueda}
                  onChange={(e) => setDraft((prev) => ({ ...prev, busqueda: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Integrante</label>
              <UsuarioSearchSelect
                usuarios={usuarios}
                value={draft.idUsuario}
                onChange={(id) => setDraft((prev) => ({ ...prev, idUsuario: id }))}
                placeholder="Todos"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vigencia desde</label>
                <DatePicker
                  value={draft.fechaInicio}
                  onChange={(v) => setDraft((prev) => ({ ...prev, fechaInicio: v }))}
                  placeholder="Desde"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vigencia hasta</label>
                <DatePicker
                  value={draft.fechaFin}
                  onChange={(v) => setDraft((prev) => ({ ...prev, fechaFin: v }))}
                  placeholder="Hasta"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-sm text-muted-foreground">
              El rango de vigencia filtra equipos cuyo periodo se traslape con las fechas.
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={limpiar} disabled={loading}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Limpiar filtros
              </Button>
              <Button size="sm" onClick={buscar} disabled={loading}>
                <Search className="mr-1.5 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo pareo
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={equipos}
        title="Equipos de pareo"
        subtitle="Cada ruta la opera 1 Ejecutivo de Ventas + 1 Especialista de Producto. Un integrante solo puede estar en un equipo vigente a la vez."
        showRowCount
        showRefreshButton
        onRefresh={refrescar}
        loading={loading}
      />

      <Modal
        id="modal-nuevo-pareo"
        open={modalOpen}
        setOpen={setModalOpen}
        title="Nuevo equipo de pareo"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !idEjecutivo || !idEspecialista || !idRegionPareo || Boolean(errorPareo) || Boolean(errorRegionPareo)}
              onClick={crearPareo}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear equipo
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ejecutivo de Ventas</label>
            <UsuarioSearchSelect
              usuarios={usuarios}
              value={idEjecutivo}
              onChange={setIdEjecutivo}
              placeholder="Buscar ejecutivo..."
              mensajeExcluido="Ya está en un equipo vigente"
            />
            <p className="text-xs text-muted-foreground">
              Lidera la visita comercial y la relación con el hospital.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Especialista de Producto</label>
            <UsuarioSearchSelect
              usuarios={usuarios}
              value={idEspecialista}
              onChange={setIdEspecialista}
              placeholder="Buscar especialista..."
              mensajeExcluido="Ya está en un equipo vigente"
            />
            <p className="text-xs text-muted-foreground">
              Imparte la parte educativa del taller médico.
            </p>
          </div>

          {errorPareo && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorPareo}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Región</label>
            <Select
              value={idRegionPareo ? String(idRegionPareo) : ''}
              onValueChange={(v) => setIdRegionPareo(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar región..." />
              </SelectTrigger>
              <SelectContent>
                {regiones.map((region) => (
                  <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                    {region.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorRegionPareo ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorRegionPareo}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Región fija que operará el equipo. Una región solo puede tener un equipo
                vigente; la asignación en la selección mensual se hace automática.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Inicio de vigencia</label>
            <DatePicker
              value={fechaInicioPareo}
              onChange={setFechaInicioPareo}
              placeholder="Hoy por defecto"
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejas vacío inicia hoy. La vigencia se cierra al desactivar el equipo y el
              histórico conserva la pareja para las rutas ya planificadas.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        id="modal-region-equipo"
        open={regionEquipo !== null}
        setOpen={(open) => !open && setRegionEquipo(null)}
        title={regionEquipo ? `Región del equipo ${regionEquipo.idEquipo}` : 'Región del equipo'}
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRegionEquipo(null)}>
              Cancelar
            </Button>
            <Button
              disabled={savingRegion || !idRegionReasignar}
              onClick={() => void reasignarRegion()}
            >
              {savingRegion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Región</label>
            <Select
              value={idRegionReasignar ? String(idRegionReasignar) : ''}
              onValueChange={(v) => setIdRegionReasignar(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar región..." />
              </SelectTrigger>
              <SelectContent>
                {regiones
                  .filter((z) => !regionesOcupadasIds.has(z.idRegion))
                  .map((region) => (
                    <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                      {region.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Solo se muestran las regiones sin equipo vigente. La región actual del equipo también está
              disponible.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        id="modal-operacion-equipo"
        open={operacionEquipo !== null}
        setOpen={(open) => !open && setOperacionEquipo(null)}
        title={
          operacionEquipo
            ? `Operación del equipo ${operacionEquipo.idEquipo}`
            : 'Operación del equipo'
        }
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setOperacionEquipo(null)}>
            Cerrar
          </Button>
        }
      >
        {loadingOperacion ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !operacion ? (
          <p className="text-sm text-muted-foreground">Sin información de operación.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {operacion.nombreEjecutivo} + {operacion.nombreEspecialista}
              </span>
              {operacion.activo ? <Badge>Vigente</Badge> : <Badge variant="outline">Inactivo</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Selecciones</p>
                <p className="text-xl font-semibold">{operacion.totalSelecciones}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Visitas confirmadas</p>
                <p className="text-xl font-semibold">{operacion.totalVisitasConfirmadas}</p>
              </div>
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Vigencia</p>
                <p className="text-sm font-medium">
                  {formatearFecha(operacion.fechaInicio)} —{' '}
                  {operacion.fechaFin ? formatearFecha(operacion.fechaFin) : 'hoy'}
                </p>
              </div>
            </div>

            {operacion.participaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este equipo aún no ha participado en ninguna selección.
              </p>
            ) : (
              <div className="space-y-3">
                {operacion.participaciones.map((participacion) => (
                  <div key={participacion.idSeleccionMensual} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Selección {formatearFecha(participacion.fechaSeleccion)} ·{' '}
                        {participacion.estadoSeleccion}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        #{participacion.idSeleccionMensual}
                      </span>
                    </div>
                    {participacion.regiones.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {participacion.regiones.map((region) => (
                          <Badge key={region.idRegion} variant="secondary" className="text-[10px]">
                            {region.nombre} · {region.cantidadHospitales} hosp.
                          </Badge>
                        ))}
                      </div>
                    )}
                    {participacion.rutas.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {participacion.rutas.map((ruta) => (
                          <p key={ruta.idRuta} className="text-xs text-muted-foreground">
                            Ruta v{ruta.version} · {ruta.estado} · {ruta.totalVisitas} visita(s)
                            {ruta.fechaConfirmacion
                              ? ` · confirmada ${formatearFecha(ruta.fechaConfirmacion.slice(0, 10))}`
                              : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        id="modal-desactivar-pareo"
        open={confirmEquipo !== null}
        setOpen={(open) => !open && setConfirmEquipo(null)}
        title="Desactivar equipo"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmEquipo(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmEquipo && desactivar(confirmEquipo)}
            >
              Desactivar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          El equipo {confirmEquipo?.idEquipo} ({confirmEquipo?.nombreEjecutivo} +{' '}
          {confirmEquipo?.nombreEspecialista}) dejará de estar vigente. El histórico conserva la
          pareja para las rutas ya planificadas.
        </p>
      </Modal>
    </div>
  );
}
