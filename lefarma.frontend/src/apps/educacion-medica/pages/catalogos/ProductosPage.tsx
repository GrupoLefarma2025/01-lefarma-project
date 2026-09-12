import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCcw } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { Producto } from '@/apps/educacion-medica/types/educacionMedica.types';

export default function ProductosPage() {
  usePageTitle('Productos', 'Catálogo de Educación Médica');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProductos = async (s?: string) => {
    setLoading(true);
    try {
      const response = await educacionMedicaApi.productos.getAll(s);
      if (response.data.success) {
        setProductos(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar productos');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProductos(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const columns = useMemo<ColumnDef<Producto>[]>(
    () => [
      {
        accessorKey: 'codigoProducto',
        header: 'Clave',
      },
      {
        accessorKey: 'nombre',
        header: 'Nombre',
      },
      {
        accessorKey: 'descripcionCorta',
        header: 'Descripción corta',
        cell: ({ row }) => row.original.descripcionCorta ?? '-',
      },
      {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => row.original.tipo ?? '-',
      },
      {
        accessorKey: 'tipoAsokam',
        header: 'Tipo Asokam',
        cell: ({ row }) => row.original.tipoAsokam ?? '-',
      },
      {
        accessorKey: 'marcaImss',
        header: 'Marca IMSS',
        cell: ({ row }) => row.original.marcaImss ?? '-',
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por clave o nombre..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchProductos(search)}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={productos}
        title="Listado de Productos"
        subtitle="Catálogo de solo lectura desde Asokam"
        showRowCount
        showRefreshButton
        onRefresh={() => fetchProductos(search)}
        loading={loading}
      />
    </div>
  );
}
