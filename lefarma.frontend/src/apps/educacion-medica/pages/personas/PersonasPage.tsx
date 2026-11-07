import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BriefcaseBusiness,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
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

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  hint: string;
  tone: string;
}) {
  return (
    <Card className={cn('border-0 shadow-sm', tone)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2 text-muted-foreground shadow-sm dark:bg-black/10">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

interface EditState<T> {
  open: boolean;
  item: T | null;
}

const emptyEdit = <T,>(): EditState<T> => ({ open: false, item: null });

export default function ColaboradoresPage() {
  usePageTitle('Colaboradores', 'Catálogos de Educación Médica');

  const [activeTab, setActiveTab] = useState<TabKey>('ejecutivos');
  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [gerencias, setGerencias] = useState<TipoGerencia[]>([]);
  const [regiones, setRegiones] = useState<Region[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoRegion[]>([]);
  const [suplentes, setSuplentes] = useState<EjecutivoSuplente[]>([]);
  const [especialistas, setEspecialistas] = useState<EspecialistaPersona[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [idGerencia, setIdGerencia] = useState<number | null>(null);
  const [idRegion, setIdRegion] = useState<number | null>(null);
  const [soloActivos, setSoloActivos] = useState(true);

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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              title="Editar"
              onClick={() => setEjecutivoModal({ open: true, item: row.original })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [usuariosPorId]
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              title="Editar"
              onClick={() => setSuplenteModal({ open: true, item: row.original })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [usuariosPorId]
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              title="Editar"
              onClick={() => setEspecialistaModal({ open: true, item: row.original })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [usuariosPorId, gerenciasPorId]
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
    setIdGerencia(value === TODAS ? null : Number(value));
    setIdRegion(null);
  };

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

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="Ejecutivos"
          value={loading ? '—' : stats.ejecutivosActivos}
          hint="con al menos una región"
          tone="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card"
        />
        <StatCard
          icon={<UsersRound className="h-4 w-4" />}
          label="Suplentes"
          value={loading ? '—' : stats.suplentesActivos}
          hint="coberturas activas"
          tone="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-card"
        />
        <StatCard
          icon={<UserRoundCog className="h-4 w-4" />}
          label="Especialistas"
          value={loading ? '—' : stats.especialistasActivos}
          hint="elegibles por gerencia"
          tone="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Cobertura total"
          value={loading ? '—' : stats.coberturaTotal}
          hint="suplentes para todo el país"
          tone="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card"
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
          <TabsList className="bg-muted/60 grid h-12 w-full max-w-2xl grid-cols-3 gap-1 rounded-xl p-1">
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
                  className="group gap-1.5 rounded-lg border-0 px-2 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:gap-2 sm:px-4 sm:text-sm"
                >
                  {tab.label}
                  <span className="bg-background/70 inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-foreground group-data-[state=active]:bg-black/20 group-data-[state=active]:text-primary-foreground">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Cambios auditados · sin vigencia
          </div>
          <Button className="rounded-xl px-4 shadow-sm" onClick={abrirNuevo}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] xl:items-end">
            <div className="space-y-1.5">
              <label
                htmlFor="filtro-colaboradores"
                className="text-xs font-medium text-muted-foreground"
              >
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="filtro-colaboradores"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Nombre, región o gerencia..."
                  className="bg-muted/50 h-10 rounded-xl border-transparent pl-9 focus-visible:bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gerencia</label>
              <Select
                value={idGerencia ? String(idGerencia) : TODAS}
                onValueChange={cambiarGerencia}
              >
                <SelectTrigger className="bg-muted/50 h-10 rounded-xl border-transparent">
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
                onValueChange={(value) => setIdRegion(value === TODAS ? null : Number(value))}
                disabled={!idGerencia}
              >
                <SelectTrigger className="bg-muted/50 h-10 rounded-xl border-transparent">
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

            <div className="bg-muted/50 flex h-10 items-center gap-3 rounded-xl border border-transparent px-3">
              <Switch checked={soloActivos} onCheckedChange={setSoloActivos} />
              <span className="text-sm font-medium">Solo activos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeTab === 'ejecutivos' && (
        <DataTable
          columns={columnasEjecutivos}
          data={ejecutivosFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          showRefreshButton
          onRefresh={() => void cargarTodo(true)}
          loading={loading || refreshing}
          globalFilter={false}
        />
      )}

      {activeTab === 'suplentes' && (
        <DataTable
          columns={columnasSuplentes}
          data={suplentesFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          showRefreshButton
          onRefresh={() => void cargarTodo(true)}
          loading={loading || refreshing}
          globalFilter={false}
        />
      )}

      {activeTab === 'especialistas' && (
        <DataTable
          columns={columnasEspecialistas}
          data={especialistasFiltrados}
          title={tabActual.label}
          subtitle={tabActual.description}
          showRowCount
          showRefreshButton
          onRefresh={() => void cargarTodo(true)}
          loading={loading || refreshing}
          globalFilter={false}
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
