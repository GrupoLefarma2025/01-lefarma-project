import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { exportRowsToCsv } from '@/utils/csv';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { ResponsiveFilters } from '@/components/common/ResponsiveFilters';
import { CatalogoToolbar } from '@/apps/educacion-medica/components/CatalogoToolbar';
import { ResumenCompacto } from '@/apps/educacion-medica/components/ResumenCompacto';
import { numericParam, useQueryState } from '@/apps/educacion-medica/hooks/useQueryState';
import type {
  EjecutivoRegion,
  EjecutivoSuplente,
  EspecialistaPersona,
  Region,
  TipoGerencia,
  UsuarioCatalogo,
} from '@/apps/educacion-medica/types/educacionMedica.types';
import { EjecutivoFormModal } from './components/EjecutivoFormModal';
import { EspecialistaFormModal } from './components/EspecialistaFormModal';
import { SuplenteFormModal } from './components/SuplenteFormModal';
import { ActionMenuItem } from '@/apps/educacion-medica/components/ActionMenuItem';

type TabKey = 'ejecutivos' | 'suplentes' | 'especialistas';

const TODAS = 'todas';

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  {
    key: 'ejecutivos',
    label: 'Ejecutivos',
    description: 'Dueños comerciales de las regiones.',
  },
  {
    key: 'suplentes',
    label: 'Suplentes',
    description: 'Cobertura cuando una región no tiene primario.',
  },
  {
    key: 'especialistas',
    label: 'Especialistas',
    description: 'Gerencias y región preferida para sugerencias.',
  },
];

const avatarTones = [
  'from-sky-100 to-blue-100 text-sky-700 dark:from-sky-950 dark:to-blue-950 dark:text-sky-200',
  'from-violet-100 to-fuchsia-100 text-violet-700 dark:from-violet-950 dark:to-fuchsia-950 dark:text-violet-200',
  'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-200',
  'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950 dark:to-orange-950 dark:text-amber-200',
  'from-rose-100 to-pink-100 text-rose-700 dark:from-rose-950 dark:to-pink-950 dark:text-rose-200',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function PersonaCell({
  idUsuario,
  nombre,
  correo,
}: {
  idUsuario: number;
  nombre: string;
  correo?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9 border border-white/70 shadow-sm">
        <AvatarFallback
          className={cn(
            'bg-gradient-to-br text-[11px] font-semibold',
            avatarTones[idUsuario % avatarTones.length]
          )}
        >
          {initials(nombre)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{nombre}</p>
        <p className="truncate text-xs text-muted-foreground">
          {correo?.trim() || 'Usuario de Asokam'}
        </p>
      </div>
    </div>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-0 px-2 py-0.5 text-[11px] font-medium',
        activo
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          activo ? 'bg-emerald-500' : 'bg-muted-foreground/50'
        )}
      />
      {activo ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}

interface EditState<T> {
  open: boolean;
  item: T | null;
}

const emptyEdit = <T,>(): EditState<T> => ({ open: false, item: null });

export default function ColaboradoresPage() {
  usePageTitle('Colaboradores', 'Catálogos de Educación Médica');

  const { searchParams, setParams } = useQueryState();
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey =
    tabParam === 'suplentes' || tabParam === 'especialistas' ? tabParam : 'ejecutivos';
  const busqueda = searchParams.get('q') ?? '';
  const idGerencia = numericParam(searchParams.get('gerencia'));
  const idRegion = numericParam(searchParams.get('region'));
  const soloActivos = searchParams.get('activos') !== '0';

  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoRegion[]>([]);
  const [suplentes, setSuplentes] = useState<EjecutivoSuplente[]>([]);
  const [especialistas, setEspecialistas] = useState<EspecialistaPersona[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [ejecutivoModal, setEjecutivoModal] = useState<EditState<EjecutivoRegion>>(emptyEdit());
  const [suplenteModal, setSuplenteModal] = useState<EditState<EjecutivoSuplente>>(emptyEdit());
  const [especialistaModal, setEspecialistaModal] =
    useState<EditState<EspecialistaPersona>>(emptyEdit());

  const cargarTodo = useCallback(async (silencioso = false) => {
    if (silencioso) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        usuariosResponse,
        gerenciasResponse,
        regionesResponse,
        ejecutivosResponse,
        suplentesResponse,
        especialistasResponse,
      ] = await Promise.all([
        educacionMedicaApi.usuarios.getAll(),
        educacionMedicaApi.tipoGerencia.getAll(),
        educacionMedicaApi.regiones.getAll(),
        educacionMedicaApi.personas.ejecutivos.getAll({ soloActivos: false }),
        educacionMedicaApi.personas.suplentes.getAll({ soloActivos: false }),
        educacionMedicaApi.personas.especialistas.getAll(undefined, false),
      ]);

      setUsuarios(usuariosResponse.data.data ?? []);
      setGerencias(gerenciasResponse.data.data ?? []);
      setRegiones(regionesResponse.data.data ?? []);
      setEjecutivos(ejecutivosResponse.data.data ?? []);
      setSuplentes(suplentesResponse.data.data ?? []);
      setEspecialistas(especialistasResponse.data.data ?? []);
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudieron cargar los colaboradores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    void cargarTodo();
  }, [cargarTodo]);

  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((usuario) => [usuario.idUsuario, usuario])),
    [usuarios]
  );

  const gerenciasPorId = useMemo(
    () => new Map(gerencias.map((gerencia) => [gerencia.idTipoGerencia, gerencia])),
    [gerencias]
  );

  const regionesFiltradas = useMemo(
    () => (idGerencia ? regiones.filter((region) => region.idTipoGerencia === idGerencia) : []),
    [regiones, idGerencia]
  );

  const columnasEjecutivos = useMemo<ColumnDef<EjecutivoRegion>[]>(
    () => [
      {
        id: 'persona',
        header: 'Persona',
        cell: ({ row }) => {
          const usuario = usuariosPorId.get(row.original.idUsuario);
          return (
            <PersonaCell
              idUsuario={row.original.idUsuario}
              nombre={row.original.nombreUsuario}
              correo={usuario?.correo}
            />
          );
        },
      },
      {
        id: 'gerencia',
        header: 'Gerencia',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200"
          >
            {row.original.nombreGerencia}
          </Badge>
        ),
      },
      {
        id: 'region',
        header: 'Región',
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {row.original.nombreRegion}
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => <EstadoBadge activo={row.original.activo} />,
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="Acciones del ejecutivo"
                  title="Acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <ActionMenuItem
                  label="Editar"
                  icon={Pencil}
                  onClick={() => setEjecutivoModal({ open: true, item: row.original })}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [usuariosPorId, setEjecutivoModal]
  );

  const columnasSuplentes = useMemo<ColumnDef<EjecutivoSuplente>[]>(
    () => [
      {
        id: 'persona',
        header: 'Persona',
        cell: ({ row }) => {
          const usuario = usuariosPorId.get(row.original.idUsuario);
          return (
            <PersonaCell
              idUsuario={row.original.idUsuario}
              nombre={row.original.nombreUsuario}
              correo={usuario?.correo}
            />
          );
        },
      },
      {
        id: 'cobertura',
        header: 'Cobertura',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                'border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200',
                row.original.idTipoGerencia === null &&
                  'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
              )}
            >
              {row.original.nombreGerencia}
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {row.original.nombreRegion}
            </span>
          </div>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => <EstadoBadge activo={row.original.activo} />,
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="Acciones del suplente"
                  title="Acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <ActionMenuItem
                  label="Editar"
                  icon={Pencil}
                  onClick={() => setSuplenteModal({ open: true, item: row.original })}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [usuariosPorId, setSuplenteModal]
  );

  const columnasEspecialistas = useMemo<ColumnDef<EspecialistaPersona>[]>(
    () => [
      {
        id: 'persona',
        header: 'Persona',
        cell: ({ row }) => {
          const usuario = usuariosPorId.get(row.original.idUsuario);
          return (
            <PersonaCell
              idUsuario={row.original.idUsuario}
              nombre={row.original.nombreUsuario}
              correo={usuario?.correo}
            />
          );
        },
      },
      {
        id: 'gerencias',
        header: 'Gerencias',
        cell: ({ row }) => (
          <div className="flex max-w-60 flex-wrap gap-1">
            {row.original.gerencias
              .filter((gerencia) => gerencia.activo)
              .map((gerencia) => (
                <Badge
                  key={gerencia.idEspecialistaGerencia}
                  variant="outline"
                  className="border-emerald-100 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
                >
                  {gerencia.nombreGerencia ||
                    gerenciasPorId.get(gerencia.idTipoGerencia)?.descripcion}
                </Badge>
              ))}
          </div>
        ),
      },
      {
        id: 'regionPreferida',
        header: 'Región preferida',
        cell: ({ row }) =>
          row.original.regionPreferida?.activo ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {row.original.regionPreferida.nombreRegion}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin preferencia</span>
          ),
      },
      {
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => <EstadoBadge activo={row.original.activo} />,
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="Acciones del especialista"
                  title="Acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <ActionMenuItem
                  label="Editar"
                  icon={Pencil}
                  onClick={() => setEspecialistaModal({ open: true, item: row.original })}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [usuariosPorId, gerenciasPorId, setEspecialistaModal]
  );

  const termino = busqueda.trim().toLowerCase();

  const ejecutivosFiltrados = useMemo(
    () =>
      ejecutivos.filter((ejecutivo) => {
        if (soloActivos && !ejecutivo.activo) return false;
        if (idGerencia && ejecutivo.idTipoGerencia !== idGerencia) return false;
        if (idRegion && ejecutivo.idRegionCatalogo !== idRegion) return false;
        if (!termino) return true;
        return [ejecutivo.nombreUsuario, ejecutivo.nombreRegion, ejecutivo.nombreGerencia].some(
          (value) => value.toLowerCase().includes(termino)
        );
      }),
    [ejecutivos, soloActivos, idGerencia, idRegion, termino]
  );

  const suplentesFiltrados = useMemo(
    () =>
      suplentes.filter((suplente) => {
        if (soloActivos && !suplente.activo) return false;
        if (
          idGerencia &&
          suplente.idTipoGerencia !== null &&
          suplente.idTipoGerencia !== idGerencia
        ) {
          return false;
        }
        if (
          idRegion &&
          suplente.idRegionCatalogo !== null &&
          suplente.idRegionCatalogo !== idRegion
        ) {
          return false;
        }
        if (!termino) return true;
        return [suplente.nombreUsuario, suplente.nombreGerencia, suplente.nombreRegion].some(
          (value) => value.toLowerCase().includes(termino)
        );
      }),
    [suplentes, soloActivos, idGerencia, idRegion, termino]
  );

  const especialistasFiltrados = useMemo(
    () =>
      especialistas.filter((especialista) => {
        if (soloActivos && !especialista.activo) return false;
        if (
          idGerencia &&
          !especialista.gerencias.some(
            (gerencia) => gerencia.activo && gerencia.idTipoGerencia === idGerencia
          )
        ) {
          return false;
        }
        if (idRegion && especialista.regionPreferida?.idRegionCatalogo !== idRegion) {
          return false;
        }
        if (!termino) return true;
        return [
          especialista.nombreUsuario,
          especialista.regionPreferida?.nombreRegion ?? '',
          ...especialista.gerencias.map((gerencia) => gerencia.nombreGerencia),
        ].some((value) => value.toLowerCase().includes(termino));
      }),
    [especialistas, soloActivos, idGerencia, idRegion, termino]
  );

  const stats = useMemo(() => {
    const ejecutivosActivos = new Set(
      ejecutivos.filter((fila) => fila.activo).map((fila) => fila.idUsuario)
    ).size;
    const suplentesActivos = suplentes.filter((fila) => fila.activo).length;
    const especialistasActivos = especialistas.filter((fila) => fila.activo).length;
    const coberturaTotal = suplentes.filter(
      (fila) => fila.activo && fila.idTipoGerencia === null && fila.idRegionCatalogo === null
    ).length;

    return { ejecutivosActivos, suplentesActivos, especialistasActivos, coberturaTotal };
  }, [ejecutivos, suplentes, especialistas]);

  const cambiarGerencia = (value: string) => {
    setParams({
      gerencia: value === TODAS ? null : value,
      region: null,
    });
  };

  const cambiarRegion = (value: string) => {
    setParams({ region: value === TODAS ? null : value });
  };

  const cambiarSoloActivos = (checked: boolean) => {
    setParams({ activos: checked ? null : '0' });
  };

  const limpiarFiltros = () => {
    setParams({ q: null, gerencia: null, region: null, activos: null });
  };

  const quitarFiltro = (id: string) => {
    if (id === 'search') setParams({ q: null });
    if (id === 'gerencia') setParams({ gerencia: null, region: null });
    if (id === 'region') setParams({ region: null });
    if (id === 'activos') setParams({ activos: null });
  };

  const extraFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string }> = [];
    if (busqueda.trim()) {
      chips.push({ id: 'search', label: `Buscar: ${busqueda.trim()}` });
    }
    if (idGerencia) {
      chips.push({
        id: 'gerencia',
        label: gerenciasPorId.get(idGerencia)?.descripcion ?? `Gerencia ${idGerencia}`,
      });
    }
    if (idRegion) {
      const region = regiones.find((item) => item.idRegion === idRegion);
      chips.push({
        id: 'region',
        label: region?.nombre ?? `Región ${idRegion}`,
      });
    }
    if (!soloActivos) {
      chips.push({ id: 'activos', label: 'Incluye inactivos' });
    }
    return chips;
  }, [busqueda, gerenciasPorId, idGerencia, idRegion, regiones, soloActivos]);

  const resumenItems = [
    { label: 'ejecutivos', value: stats.ejecutivosActivos, dotClassName: 'bg-sky-500' },
    { label: 'suplentes', value: stats.suplentesActivos, dotClassName: 'bg-violet-500' },
    { label: 'especialistas', value: stats.especialistasActivos, dotClassName: 'bg-emerald-500' },
    { label: 'cobertura total', value: stats.coberturaTotal, dotClassName: 'bg-amber-500' },
  ];

  const abrirNuevo = () => {
    if (activeTab === 'ejecutivos') setEjecutivoModal({ open: true, item: null });
    if (activeTab === 'suplentes') setSuplenteModal({ open: true, item: null });
    if (activeTab === 'especialistas') setEspecialistaModal({ open: true, item: null });
  };

  const tabActual = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const actionLabel =
    activeTab === 'ejecutivos'
      ? 'Nuevo ejecutivo'
      : activeTab === 'suplentes'
        ? 'Nuevo suplente'
        : 'Nuevo especialista';

  const emptyState = (
    <EmptyState
      icon={<UsersRound className="h-8 w-8" />}
      title="Sin colaboradores"
      description={
        extraFilters.length > 0
          ? 'Ajusta o limpia los filtros para ver más resultados.'
          : 'Agrega el primer colaborador de esta sección.'
      }
      action={
        extraFilters.length > 0 ? (
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        ) : (
          <Button size="sm" className="h-8 rounded-lg" onClick={abrirNuevo}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {actionLabel}
          </Button>
        )
      }
    />
  );

  const exportar = () => {
    if (activeTab === 'ejecutivos') {
      exportRowsToCsv(
        ejecutivosFiltrados.map((fila) => ({
          Persona: fila.nombreUsuario,
          Gerencia: fila.nombreGerencia,
          Region: fila.nombreRegion,
          Estado: fila.activo ? 'Activo' : 'Inactivo',
        })),
        'colaboradores-ejecutivos.csv'
      );
      return;
    }

    if (activeTab === 'suplentes') {
      exportRowsToCsv(
        suplentesFiltrados.map((fila) => ({
          Persona: fila.nombreUsuario,
          Cobertura: fila.nombreGerencia,
          Region: fila.nombreRegion,
          Estado: fila.activo ? 'Activo' : 'Inactivo',
        })),
        'colaboradores-suplentes.csv'
      );
      return;
    }

    exportRowsToCsv(
      especialistasFiltrados.map((fila) => ({
        Persona: fila.nombreUsuario,
        Gerencias: fila.gerencias
          .filter((gerencia) => gerencia.activo)
          .map(
            (gerencia) =>
              gerencia.nombreGerencia ||
              gerenciasPorId.get(gerencia.idTipoGerencia)?.descripcion ||
              ''
          )
          .join(' | '),
        RegionPreferida: fila.regionPreferida?.nombreRegion ?? 'Sin preferencia',
        Estado: fila.activo ? 'Activo' : 'Inactivo',
      })),
      'colaboradores-especialistas.csv'
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <ResumenCompacto items={resumenItems} loading={loading} />

      <CatalogoToolbar
        left={
          <>
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setParams({ tab: value === 'ejecutivos' ? null : value })
              }
            >
              <TabsList className="grid h-9 w-full max-w-md grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
                {tabs.map((tab) => {
                  const count =
                    tab.key === 'ejecutivos'
                      ? ejecutivosFiltrados.length
                      : tab.key === 'suplentes'
                        ? suplentesFiltrados.length
                        : especialistasFiltrados.length;
                  return (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="group gap-1.5 rounded-lg border-0 px-2 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    >
                      {tab.label}
                      <span className="bg-background/70 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-foreground group-data-[state=active]:bg-black/20 group-data-[state=active]:text-primary-foreground">
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground 2xl:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Cambios auditados · sin vigencia
            </span>
          </>
        }
        right={
          <>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(event) => setParams({ q: event.target.value || null })}
                placeholder="Buscar nombre, región o gerencia..."
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
              />
            </div>

            <ResponsiveFilters
              activeCount={extraFilters.length}
              onClear={limpiarFiltros}
              title="Filtros de colaboradores"
              description="Acota por gerencia, región o estado."
              desktopWidthClassName="w-[340px]"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Gerencia</label>
                <Select
                  value={idGerencia ? String(idGerencia) : TODAS}
                  onValueChange={cambiarGerencia}
                >
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                    <SelectValue placeholder="Todas las gerencias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas las gerencias</SelectItem>
                    {gerencias.map((gerencia) => (
                      <SelectItem
                        key={gerencia.idTipoGerencia}
                        value={String(gerencia.idTipoGerencia)}
                      >
                        {gerencia.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Región</label>
                <Select
                  value={idRegion ? String(idRegion) : TODAS}
                  onValueChange={cambiarRegion}
                  disabled={!idGerencia}
                >
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                    <SelectValue
                      placeholder={idGerencia ? 'Todas las regiones' : 'Selecciona una gerencia'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas las regiones</SelectItem>
                    {regionesFiltradas.map((region) => (
                      <SelectItem key={region.idRegion} value={String(region.idRegion)}>
                        {region.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
                <div>
                  <p className="text-xs font-medium">Solo activos</p>
                  <p className="text-[10px] text-muted-foreground">Oculta registros inactivos</p>
                </div>
                <Switch checked={soloActivos} onCheckedChange={cambiarSoloActivos} />
              </div>
            </ResponsiveFilters>

            <Button size="sm" className="h-9 gap-1.5 rounded-lg px-3" onClick={abrirNuevo}>
              <Plus className="h-3.5 w-3.5" />
              {actionLabel}
            </Button>
          </>
        }
        onRefresh={() => void cargarTodo(true)}
        refreshing={loading || refreshing}
        refreshLabel="Actualizar colaboradores"
      />

      {activeTab === 'ejecutivos' && (
        <DataTable
          columns={columnasEjecutivos}
          data={ejecutivosFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          loading={loading || refreshing}
          globalFilter={false}
          extraFilters={extraFilters}
          onRemoveExtraFilter={quitarFiltro}
          onClearExtraFilters={limpiarFiltros}
          emptyState={emptyState}
          showDensityToggle
          showColumnToggle
          showExportButton
          onExport={exportar}
        />
      )}

      {activeTab === 'suplentes' && (
        <DataTable
          columns={columnasSuplentes}
          data={suplentesFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          loading={loading || refreshing}
          globalFilter={false}
          extraFilters={extraFilters}
          onRemoveExtraFilter={quitarFiltro}
          onClearExtraFilters={limpiarFiltros}
          emptyState={emptyState}
          showDensityToggle
          showColumnToggle
          showExportButton
          onExport={exportar}
        />
      )}

      {activeTab === 'especialistas' && (
        <DataTable
          columns={columnasEspecialistas}
          data={especialistasFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          loading={loading || refreshing}
          globalFilter={false}
          extraFilters={extraFilters}
          onRemoveExtraFilter={quitarFiltro}
          onClearExtraFilters={limpiarFiltros}
          emptyState={emptyState}
          showDensityToggle
          showColumnToggle
          showExportButton
          onExport={exportar}
        />
      )}

      {ejecutivoModal.open && (
        <EjecutivoFormModal
          open
          onOpenChange={(open) => setEjecutivoModal((prev) => ({ ...prev, open }))}
          ejecutivo={ejecutivoModal.item}
          usuarios={usuarios}
          gerencias={gerencias}
          regiones={regiones}
          ejecutivos={ejecutivos}
          onSaved={() => void cargarTodo(true)}
        />
      )}

      {suplenteModal.open && (
        <SuplenteFormModal
          open
          onOpenChange={(open) => setSuplenteModal((prev) => ({ ...prev, open }))}
          suplente={suplenteModal.item}
          usuarios={usuarios}
          gerencias={gerencias}
          regiones={regiones}
          onSaved={() => void cargarTodo(true)}
        />
      )}

      {especialistaModal.open && (
        <EspecialistaFormModal
          open
          onOpenChange={(open) => setEspecialistaModal((prev) => ({ ...prev, open }))}
          especialista={especialistaModal.item}
          usuarios={usuarios}
          gerencias={gerencias}
          regiones={regiones}
          especialistas={especialistas}
          onSaved={() => void cargarTodo(true)}
        />
      )}
    </div>
  );
}
