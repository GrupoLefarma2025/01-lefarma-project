import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { List, Search, Loader2, RefreshCcw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENDPOINT = '/catalogos/EstatusOrden';

interface EstatusOrden {
  idEstatusOrden: number;
  nombre: string;
  descripcion?: string;
  siguienteEstatusId?: number;
  siguienteEstatusNombre?: string;
  requiereAccion: boolean;
  activo: boolean;
  fechaCreacion: string;
}

export default function EstatusOrdenList() {
  usePageTitle('Estatus de Orden', 'Flujo de autorizaciones - READ ONLY');
  const [estatus, setEstatus] = useState<EstatusOrden[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEstatus = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<EstatusOrden[]>>(ENDPOINT);
      if (response.data.success) {
        setEstatus(response.data.data || []);
      }
    } catch (error: any) {
      const isNotFound = error?.errors?.some((e: any) => e.code === 'EstatusOrden.NotFound');
      if (isNotFound) {
        setEstatus([]);
        toast.warning('No se encontraron estatus de orden en el sistema');
      } else {
        toast.error(error?.message ?? 'Error al cargar los estatus de orden');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstatus();
  }, []);

  const filteredEstatus = useMemo(() => {
    return estatus.filter((e) =>
      e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.descripcion?.toLowerCase().includes(search.toLowerCase())
    );
  }, [estatus, search]);

  const columns: ColumnDef<EstatusOrden>[] = [
    {
      accessorKey: 'idEstatusOrden',
      header: 'ID',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <List className="h-4 w-4 text-foreground" />
          </div>
          <span className="text-sm font-mono font-medium">{row.original.idEstatusOrden}</span>
        </div>
      ),
    },
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.nombre}</span>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.descripcion || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'siguienteEstatusNombre',
      header: 'Siguiente Estatus',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.siguienteEstatusNombre || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'requiereAccion',
      header: 'Req. Acción',
      cell: ({ row }) => (
        <Badge
          variant={row.original.requiereAccion ? 'default' : 'secondary'}
          className={row.original.requiereAccion ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          {row.original.requiereAccion ? 'Sí' : 'No'}
        </Badge>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'} className="h-5">
          {row.original.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o descripción..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Solo lectura
          </Badge>
        </div>
        <Button variant="outline" onClick={fetchEstatus}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </div>

      <div className="relative">
        {!loading && estatus.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <List className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No hay estatus registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Flujo de autorizaciones del sistema</p>
            <Button className="mt-4" size="sm" onClick={fetchEstatus}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refrescar
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredEstatus}
              title="Estatus de Orden (Flujo de Autorizaciones)"
              showRowCount
              showRefreshButton={false}
              filterConfig={{
                tableId: 'estatus-orden',
                searchableColumns: ['nombre', 'descripcion'],
                defaultSearchColumns: ['nombre'],
              }}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
