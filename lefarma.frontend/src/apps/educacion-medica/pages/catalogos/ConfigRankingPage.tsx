import { useCallback, useEffect, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Eye, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import ConfigRankingFactoresModal from '@/apps/educacion-medica/components/ConfigRankingFactoresModal';
import type { ConfigRankingResumen } from '@/apps/educacion-medica/types/educacionMedica.types';

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('es-MX');
}

export default function ConfigRankingPage() {
  usePageTitle('Configuración del ranking', 'Educación Médica');

  const [configs, setConfigs] = useState<ConfigRankingResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [idFactores, setIdFactores] = useState<number | null>(null);
  const [factoresAbierto, setFactoresAbierto] = useState(false);

  const [nuevaVersionAbierta, setNuevaVersionAbierta] = useState(false);
  const [idBaseSeleccionada, setIdBaseSeleccionada] = useState<number | null>(null);
  const [creandoVersion, setCreandoVersion] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const response = await educacionMedicaApi.configRanking.listado();
      if (response.data.success) {
        setConfigs(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar el listado');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar el listado');
    }
  }, []);

  // Carga inicial: setState solo tras await (evita renders en cascada).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const response = await educacionMedicaApi.configRanking.listado();
        if (cancelado) return;
        if (response.data.success) {
          setConfigs(response.data.data ?? []);
        } else {
          toast.error(response.data.message ?? 'Error al cargar el listado');
        }
      } catch (error: unknown) {
        if (!cancelado) {
          toast.error(toApiError(error).message ?? 'Error al cargar el listado');
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const abrirFactores = useCallback((idConfiguracion: number) => {
    setIdFactores(idConfiguracion);
    setFactoresAbierto(true);
  }, []);

  const crearNuevaVersion = async () => {
    if (!idBaseSeleccionada) return;
    setCreandoVersion(true);
    try {
      const response = await educacionMedicaApi.configRanking.crearNuevaVersion(
        idBaseSeleccionada
      );
      if (response.data.success) {
        const nueva = response.data.data;
        toast.success(
          `Nueva versión ${nueva.version} creada a partir de la versión seleccionada (queda activa).`
        );
        setNuevaVersionAbierta(false);
        await cargar();
        abrirFactores(nueva.idConfiguracion);
      } else {
        toast.error(response.data.message ?? 'Error al crear la nueva versión');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al crear la nueva versión');
    } finally {
      setCreandoVersion(false);
    }
  };

  const columns = [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>,
    },
    {
      accessorKey: 'version',
      header: 'Versión',
      cell: ({ row }) => <span>v{row.original.version}</span>,
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'}>
          {row.original.activo ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      accessorKey: 'usada',
      header: 'Usada',
      cell: ({ row }) => (
        <Badge variant={row.original.usada ? 'secondary' : 'outline'}>
          {row.original.usada ? 'Sí' : 'No'}
        </Badge>
      ),
    },
    {
      id: 'vigencia',
      header: 'Vigencia',
      cell: ({ row }) => (
        <span>
          {formatDate(row.original.fechaVigenciaInicio)} — {formatDate(row.original.fechaVigenciaFin)}
        </span>
      ),
    },
    {
      accessorKey: 'fechaCreacion',
      header: 'Fecha creación',
      cell: ({ row }) => <span>{formatDate(row.original.fechaCreacion)}</span>,
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => abrirFactores(row.original.idConfiguracion)}
          >
            <Eye className="h-3.5 w-3.5" />
            Ver factores
          </Button>
        </div>
      ),
    },
  ] satisfies ColumnDef<ConfigRankingResumen>[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          onClick={() => {
            setIdBaseSeleccionada(null);
            setNuevaVersionAbierta(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva versión
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={configs}
        title="Listado de configuración"
        subtitle="Versiones de pesos y parámetros del ranking de hospitales. Las configuraciones ya usadas no se pueden editar; cree una nueva versión para cambiarlas."
        showRowCount
        showRefreshButton
        onRefresh={() => {
          setCargando(true);
          void cargar().finally(() => setCargando(false));
        }}
        loading={cargando}
      />

      <ConfigRankingFactoresModal
        idConfiguracion={idFactores}
        open={factoresAbierto}
        onOpenChange={setFactoresAbierto}
        onGuardado={cargar}
      />

      <Modal
        id="modal-nueva-version-config-ranking"
        open={nuevaVersionAbierta}
        setOpen={setNuevaVersionAbierta}
        title="Nueva versión de configuración"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNuevaVersionAbierta(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void crearNuevaVersion()}
              disabled={!idBaseSeleccionada || creandoVersion}
            >
              {creandoVersion ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Crear nueva versión
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecciona la configuración sobre la cual se creará la nueva versión. La nueva versión
            copia los factores, pesos y parámetros de la base, queda activa y desactiva a la
            anterior. La vigencia es automática: la nueva inicia hoy y la anterior cierra ayer.
          </p>
          <RadioGroup
            value={idBaseSeleccionada != null ? String(idBaseSeleccionada) : undefined}
            onValueChange={(v) => setIdBaseSeleccionada(Number(v))}
            className="gap-2"
          >
            {configs.map((config) => (
              <Label
                key={config.idConfiguracion}
                htmlFor={`base-${config.idConfiguracion}`}
                className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 hover:bg-muted/50"
              >
                <RadioGroupItem value={String(config.idConfiguracion)} id={`base-${config.idConfiguracion}`} />
                <span className="flex flex-1 flex-wrap items-center gap-2 text-sm font-normal">
                  <span className="font-medium">{config.nombre}</span>
                  <Badge variant="outline">v{config.version}</Badge>
                  {config.activo && <Badge>Activa</Badge>}
                  {config.usada && <Badge variant="secondary">Usada</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(config.fechaCreacion)}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </Modal>
    </div>
  );
}
