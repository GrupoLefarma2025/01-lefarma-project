import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { RefreshCcw } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { Asignacion } from '@/apps/educacion-medica/types/educacionMedica.types';

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

export default function MisAsignacionesPage() {
  usePageTitle('Mis hospitales del mes', 'Educación Médica');

  const userId = useAuthStore((s) => s.user?.id);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAsignaciones = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await educacionMedicaApi.rutas.asignaciones(userId);
      if (response.data.success) {
        setAsignaciones(response.data.data ?? []);
      } else {
        toast.error(response.data.message ?? 'Error al cargar asignaciones');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAsignaciones();
  }, [fetchAsignaciones]);

  const hoy = new Date().toISOString().slice(0, 10);
  const finSemana = useMemo(() => {
    const dt = new Date();
    const dia = dt.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(dt);
    lunes.setDate(dt.getDate() + diff);
    const fin = new Date(lunes);
    fin.setDate(lunes.getDate() + 4);
    return { inicio: lunes.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
  }, []);

  const columnas = useMemo<ColumnDef<Asignacion>[]>(
    () => [
      { accessorKey: 'nombreHospital', header: 'Hospital' },
      {
        accessorKey: 'fechaVisita',
        header: 'Fecha',
        cell: ({ row }) => {
          const fecha = row.original.fechaVisita;
          const dt = new Date(`${fecha}T00:00:00`);
          return `${DIAS[dt.getDay()]} ${formatearFecha(fecha)}`;
        },
      },
      {
        accessorKey: 'orden',
        header: 'Posición',
        cell: ({ row }) => `Visita ${row.original.orden}`,
      },
      { accessorKey: 'nombreRegion', header: 'Región' },
      { accessorKey: 'nombreRuta', header: 'Ruta' },
      {
        accessorKey: 'fechaVisita',
        id: 'cuando',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.fechaVisita === hoy ? (
            <Badge>Hoy</Badge>
          ) : (
            <Badge variant="outline">Programada</Badge>
          ),
      },
    ],
    [hoy]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border px-4 py-3">
            <p className="text-xs text-muted-foreground">Hospitales asignados</p>
            <p className="text-2xl font-semibold">{asignaciones.length}</p>
          </div>
          <div className="rounded-md border px-4 py-3">
            <p className="text-xs text-muted-foreground">Visitas hoy</p>
            <p className="text-2xl font-semibold">
              {asignaciones.filter((a) => a.fechaVisita === hoy).length}
            </p>
          </div>
          <div className="rounded-md border px-4 py-3">
            <p className="text-xs text-muted-foreground">Esta semana</p>
            <p className="text-2xl font-semibold">
              {
                asignaciones.filter(
                  (a) => a.fechaVisita >= finSemana.inicio && a.fechaVisita <= finSemana.fin
                ).length
              }
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAsignaciones}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <DataTable
        columns={columnas}
        data={asignaciones}
        title="Mis hospitales del mes"
        subtitle="Visitas confirmadas de tus equipos (reemplaza el correo del día 15)"
        showRowCount
        loading={loading}
      />
    </div>
  );
}
