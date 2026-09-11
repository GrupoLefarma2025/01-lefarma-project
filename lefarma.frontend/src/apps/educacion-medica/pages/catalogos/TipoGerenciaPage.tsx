import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { TipoGerencia } from '@/apps/educacion-medica/types/educacionMedica.types';

export default function TipoGerenciaPage() {
  usePageTitle('Tipo de Gerencia', 'Catálogo de Educación Médica');

  const [tipos, setTipos] = useState<TipoGerencia[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchTipos();
  }, []);

  const columns = useMemo<ColumnDef<TipoGerencia>[]>(
    () => [
      {
        accessorKey: 'idTipoGerencia',
        header: 'ID',
      },
      {
        accessorKey: 'descripcion',
        header: 'Descripción',
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={fetchTipos}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tipos}
        title="Tipos de Gerencia"
        subtitle="Usados para clasificar hospitales en el catálogo"
        showRowCount
        showRefreshButton
        onRefresh={fetchTipos}
        loading={loading}
      />
    </div>
  );
}
