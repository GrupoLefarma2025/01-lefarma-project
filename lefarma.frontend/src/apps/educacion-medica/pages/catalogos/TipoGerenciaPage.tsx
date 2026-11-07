import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Building2, Hospital, Layers3, RefreshCcw, Search } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { TipoGerencia } from '@/apps/educacion-medica/types/educacionMedica.types';

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

export default function TipoGerenciaPage() {
  usePageTitle('Tipo de Gerencia', 'Catálogo de Educación Médica');

  const [tipos, setTipos] = useState<TipoGerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const fetchTipos = async () => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.tipoGerencia.getAll();
      if (response.data.success) {
        setTipos(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar tipos de gerencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar tipos de gerencia');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    fetchTipos();
  }, []);

  const termino = busqueda.trim().toLowerCase();
  const tiposFiltrados = useMemo(
    () =>
      tipos.filter((tipo) =>
        termino.length === 0 ? true : tipo.descripcion.toLowerCase().includes(termino)
      ),
    [tipos, termino]
  );

  const stats = useMemo(() => {
    const totalHospitales = tipos.reduce((acc, tipo) => acc + tipo.totalHospitales, 0);
    const mayor = tipos.reduce<TipoGerencia | null>(
      (maximo, tipo) => (!maximo || tipo.totalHospitales > maximo.totalHospitales ? tipo : maximo),
      null
    );
    return { totalHospitales, mayor };
  }, [tipos]);

  const columns = useMemo<ColumnDef<TipoGerencia>[]>(
    () => [
      {
        accessorKey: 'idTipoGerencia',
        header: 'ID',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.idTipoGerencia}</span>
        ),
      },
      {
        accessorKey: 'descripcion',
        header: 'Descripción',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{row.original.descripcion}</span>
          </div>
        ),
      },
      {
        accessorKey: 'totalHospitales',
        header: 'Hospitales',
        cell: ({ row }) => (
          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px]">
            {row.original.totalHospitales.toLocaleString('es-MX')}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Layers3 className="h-4 w-4" />}
          label="Gerencias"
          value={loading ? '—' : tipos.length}
          hint="tipos registrados"
          tone="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-card"
        />
        <StatCard
          icon={<Hospital className="h-4 w-4" />}
          label="Hospitales"
          value={loading ? '—' : stats.totalHospitales.toLocaleString('es-MX')}
          hint="clasificados en el catálogo"
          tone="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card"
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Mayor cobertura"
          value={loading ? '—' : (stats.mayor?.totalHospitales ?? 0).toLocaleString('es-MX')}
          hint={stats.mayor?.descripcion ?? 'sin datos'}
          tone="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card"
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por tipo de gerencia..."
                className="bg-muted/50 h-10 rounded-xl border-transparent pl-9 focus-visible:bg-background"
              />
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => void fetchTipos()}
              disabled={loading}
            >
              <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={tiposFiltrados}
        title="Catálogo de gerencias"
        subtitle="Usados para clasificar hospitales en el catálogo"
        showRowCount
        loading={loading}
        globalFilter={false}
      />
    </div>
  );
}
