import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Lock, LockOpen, Pencil, Plus, Printer, RefreshCcw, Trash2 } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  ActualizarTallerRequest,
  Asignacion,
  CrearTallerRequest,
  MatrizDocumento,
  MisTalleresResponse,
  Taller,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { TallerFormModal } from './components/TallerFormModal';
import { MatrizPrintDocument } from './components/MatrizPrintDocument';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

export default function MisTalleresPage() {
  usePageTitle('Mis talleres', 'Educación Médica');

  const userId = useAuthStore((s) => s.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<MisTalleresResponse | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  // Deep-link "Registrar taller" desde Mis hospitales del mes: el modal abre con el hospital precargado.
  const [modalOpen, setModalOpen] = useState(() => searchParams.get('nuevo') === '1');
  const [editando, setEditando] = useState<Taller | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const idSeleccionHospitalPrecarga = useMemo(() => {
    const valor = searchParams.get('idSeleccionHospital');
    return valor ? Number(valor) : null;
  }, [searchParams]);

  const fetchMisTalleres = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.talleres.misTalleres(periodo);
      if (response.data.success) {
        setData(response.data.data ?? null);
      } else {
        toast.error(response.data.message ?? 'Error al cargar tus talleres');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar tus talleres');
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  const recargar = useCallback(() => {
    setLoading(true);
    void fetchMisTalleres();
  }, [fetchMisTalleres]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    void fetchMisTalleres();
  }, [fetchMisTalleres]);

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    educacionMedicaApi.rutas
      .asignaciones(userId)
      .then((res) => {
        if (!cancelado && res.data.success) setAsignaciones(res.data.data ?? []);
      })
      .catch(() => setAsignaciones([]));
    return () => {
      cancelado = true;
    };
  }, [userId]);

  const matriz = data?.matriz ?? null;
  const editable = !matriz || matriz.estado === 'EnCaptura';
  const sinEquipo = data !== null && data.idEquipo === null;

  const documentoIndividual = useMemo<MatrizDocumento | null>(() => {
    if (!data || data.talleres.length === 0) return null;
    const titulo = `Matriz individual de talleres ${periodo
      .slice(0, 7)
      .split('-')
      .reverse()
      .join('/')}${data.nombreRegion ? ` – ${data.nombreRegion}` : ''}`;
    return {
      titulo,
      gerencia: null,
      periodo: data.periodo,
      pasoNombre: null,
      estadoNombre: matriz?.estado ?? null,
      talleres: data.talleres,
      costoTotal: data.talleres.reduce((acc, t) => acc + t.costoTotal, 0),
      firmas: [],
    };
  }, [data, periodo, matriz]);

  const abrirNuevo = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const abrirEditar = useCallback((taller: Taller) => {
    setEditando(taller);
    setModalOpen(true);
  }, []);

  const guardar = async (
    payload: CrearTallerRequest | ActualizarTallerRequest,
    idTaller: number | null
  ) => {
    setGuardando(true);
    try {
      const response = idTaller
        ? await educacionMedicaApi.talleres.actualizar(
            idTaller,
            payload as ActualizarTallerRequest
          )
        : await educacionMedicaApi.talleres.crear(payload as CrearTallerRequest);
      if (response.data.success) {
        toast.success(response.data.message ?? 'Taller guardado.');
        setModalOpen(false);
        setEditando(null);
        recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo guardar el taller');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo guardar el taller');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = useCallback(
    async (taller: Taller) => {
      if (!window.confirm(`¿Eliminar el taller de ${taller.nombreHospital ?? 'este hospital'}?`)) {
        return;
      }
      setProcesando(true);
      try {
        const response = await educacionMedicaApi.talleres.eliminar(taller.idTaller);
        if (response.data.success) {
          toast.success('Taller eliminado.');
          recargar();
        } else {
          toast.error(response.data.message ?? 'No se pudo eliminar el taller');
        }
      } catch (error: unknown) {
        toast.error(toApiError(error).message ?? 'No se pudo eliminar el taller');
      } finally {
        setProcesando(false);
      }
    },
    [recargar]
  );

  const generar = async () => {
    if (!matriz) return;
    setProcesando(true);
    try {
      const response = await educacionMedicaApi.talleres.generarMatrizIndividual(
        matriz.idMatrizIndividual
      );
      if (response.data.success) {
        toast.success('Matriz individual generada: la captura queda bloqueada.');
        recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo generar la matriz');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo generar la matriz');
    } finally {
      setProcesando(false);
    }
  };

  const reabrir = async () => {
    if (!matriz) return;
    setProcesando(true);
    try {
      const response = await educacionMedicaApi.talleres.reabrirMatrizIndividual(
        matriz.idMatrizIndividual
      );
      if (response.data.success) {
        toast.success('Captura reabierta.');
        recargar();
      } else {
        toast.error(response.data.message ?? 'No se pudo reabrir la captura');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo reabrir la captura');
    } finally {
      setProcesando(false);
    }
  };

  const columnas = useMemo<ColumnDef<Taller>[]>(
    () => [
      { accessorKey: 'nombreHospital', header: 'Hospital' },
      {
        accessorKey: 'fechaTaller',
        header: 'Fecha',
        cell: ({ row }) => fmtFecha(row.original.fechaTaller),
      },
      {
        accessorKey: 'horaTaller',
        header: 'Hora',
        cell: ({ row }) => row.original.horaTaller?.slice(0, 5) ?? '—',
      },
      {
        accessorKey: 'numeroParticipantes',
        header: 'Participantes',
        cell: ({ row }) => row.original.numeroParticipantes ?? '—',
      },
      {
        id: 'recursos',
        header: 'Recursos',
        cell: ({ row }) => row.original.recursos.length,
      },
      {
        accessorKey: 'costoTotal',
        header: 'Costo total',
        cell: ({ row }) => fmtMoneda(row.original.costoTotal),
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        cell: ({ row }) => <Badge variant="outline">{row.original.estado}</Badge>,
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={!editable || procesando}
              onClick={() => abrirEditar(row.original)}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={!editable || procesando}
              onClick={() => void eliminar(row.original)}
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [editable, procesando, abrirEditar, eliminar]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Mis talleres (FOR-005)</h1>
          <p className="text-sm text-muted-foreground">
            Captura mensual del equipo de pareo. La matriz individual se bloquea al generarla y el
            Gerente de Ventas puede reabrirla mientras la matriz general siga en Creada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={periodo}
            onChange={(e) => {
              setLoading(true);
              setPeriodo(e.target.value);
            }}
          />
          <Button variant="outline" size="sm" onClick={recargar}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintOpen(true)}
            disabled={!documentoIndividual}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border px-4 py-3">
          <p className="text-xs text-muted-foreground">Equipo</p>
          <p className="text-sm font-semibold">
            {sinEquipo
              ? 'Sin equipo de pareo activo'
              : data?.matriz
                ? `${data.matriz.nombreEjecutivo ?? 'EV'} + ${data.matriz.nombreEspecialista ?? 'EP'}`
                : data?.idEquipo
                  ? `Equipo ${data.idEquipo}`
                  : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{data?.nombreRegion ?? ''}</p>
        </div>
        <div className="rounded-md border px-4 py-3">
          <p className="text-xs text-muted-foreground">Matriz individual del mes</p>
          <div className="flex items-center gap-2">
            {matriz ? (
              <Badge variant={matriz.estado === 'Generada' ? 'default' : 'outline'}>
                {matriz.estado}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Aún sin capturas</span>
            )}
            {matriz?.fechaGeneracion && (
              <span className="text-xs text-muted-foreground">
                Generada el {new Date(matriz.fechaGeneracion).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border px-4 py-3">
          <Button size="sm" onClick={abrirNuevo} disabled={!editable || sinEquipo || procesando}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo taller
          </Button>
          {matriz?.estado === 'EnCaptura' && (
            <Button size="sm" variant="outline" onClick={() => void generar()} disabled={procesando}>
              <Lock className="mr-1 h-4 w-4" />
              Generar matriz
            </Button>
          )}
          {matriz?.estado === 'Generada' && (
            <Button size="sm" variant="outline" onClick={() => void reabrir()} disabled={procesando}>
              <LockOpen className="mr-1 h-4 w-4" />
              Reabrir captura
            </Button>
          )}
        </div>
      </div>

      {sinEquipo ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No participas en un equipo de pareo activo; pide al administrador que te asigne uno para
          capturar talleres.
        </p>
      ) : (
        <DataTable
          columns={columnas}
          data={data?.talleres ?? []}
          title="Talleres capturados"
          subtitle="Filas de la Matriz (FOR-005). Los costos los registra el Auxiliar de Educación Médica."
          showRowCount
          loading={loading}
        />
      )}

      <TallerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditando(null);
          if (searchParams.toString()) setSearchParams({}, { replace: true });
        }}
        taller={editando}
        asignaciones={asignaciones}
        idSeleccionHospitalInicial={idSeleccionHospitalPrecarga}
        guardando={guardando}
        onGuardar={guardar}
      />

      <MatrizPrintDocument
        open={printOpen}
        onOpenChange={setPrintOpen}
        documento={documentoIndividual}
      />
    </div>
  );
}
