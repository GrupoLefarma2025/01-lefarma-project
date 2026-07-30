import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
  Building2,
  Download,
  X,
  CheckCircle2,
  Inbox,
  Calendar,
  Save,
  Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { toApiError } from '@/utils/errors';
import { authService } from '@/shared/auth/authService';
import { vacacionesApi } from '../../services/vacaciones.api';
import {
  buildPlantillaDiasNoHabilesCsv,
  downloadCsv,
  parseDiasNoHabilesCsv,
} from '@/utils/csv';
import type {
  DiaNoHabilResponse,
  DiaUsuarioResponse,
  DiaNoHabilFechaRequest,
} from '@/types/vacaciones.types';
import type { Empresa } from '@/types/auth.types';

interface StagedItem extends DiaNoHabilFechaRequest {
  source: 'manual' | 'csv';
  rowNumber?: number;
  idEmpresa: number | '__all__';
  empresaNombre: string;
}

export function DiasNoHabilesPage() {
  usePageTitle('Días no hábiles de vacaciones', 'Gestión de días no hábiles por empresa');

  const [items, setItems] = useState<DiaNoHabilResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('__all__');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cola unificada (manual + CSV)
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carga manual
  const [fechaInput, setFechaInput] = useState('');
  const [descripcionInput, setDescripcionInput] = useState('');

  // Carga CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Usuarios afectados
  const [afectados, setAfectados] = useState<DiaUsuarioResponse[] | null>(null);
  const [loadingAfectados, setLoadingAfectados] = useState(false);
  const [diaADesactivar, setDiaADesactivar] = useState<number | null>(null);



  const empresaNombre = useMemo(() => {
    if (selectedEmpresa === '__all__') return 'Todas las empresas';
    return empresas.find((e) => String(e.idEmpresa) === selectedEmpresa)?.nombre ?? '';
  }, [selectedEmpresa, empresas]);

  const getTargetEmpresaIds = (item: { idEmpresa: number | '__all__' }): number[] => {
    if (item.idEmpresa === '__all__') return empresas.map((e) => Number(e.idEmpresa));
    return [item.idEmpresa];
  };

  const loadCatalogos = async () => {
    try {
      const empresasData = await authService.getEmpresas();
      setEmpresas(empresasData);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al cargar catálogos');
    }
  };

  const loadDias = async () => {
    try {
      setLoading(true);
      const response = await vacacionesApi.getDiasNoHabiles({
        idEmpresa: selectedEmpresa !== '__all__' ? Number(selectedEmpresa) : undefined,
      });
      setItems(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al cargar días no hábiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogos();
  }, []);

  useEffect(() => {
    loadDias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpresa]);

  const handleDesactivar = async (id: number) => {
    setIsDeleting(true);
    setDiaADesactivar(null);
    try {
      await vacacionesApi.deleteDiaNoHabil(id);
      toast.success('Día no hábil desactivado');
      loadDias();
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al desactivar día no hábil');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerAfectados = async (id: number) => {
    try {
      setLoadingAfectados(true);
      const response = await vacacionesApi.getUsuariosAfectados(id);
      setAfectados(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener usuarios afectados');
    } finally {
      setLoadingAfectados(false);
    }
  };

  const mainColumns: ColumnDef<DiaNoHabilResponse>[] = [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      cell: ({ row }) => new Date(row.original.fecha).toLocaleDateString('es-MX'),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => row.original.descripcion || '—',
    },
    {
      accessorKey: 'empresaNombre',
      header: 'Empresa',
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: ({ row }) =>
        row.original.activo ? (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVerAfectados(row.original.idDiaNoHabil)}
            title="Ver usuarios asignados"
          >
            <Users className="mr-1 h-4 w-4" />
            Usuarios
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiaADesactivar(row.original.idDiaNoHabil)}
            disabled={isDeleting}
            title="Desactivar día"
          >
            <Power className="mr-1 h-4 w-4" />
            Desactivar
          </Button>
        </div>
      ),
    },
  ];

  const stagedColumns: ColumnDef<StagedItem>[] = [
    {
      accessorKey: 'anio',
      header: 'Fecha',
      cell: ({ row }) =>
        new Date(row.original.anio, row.original.mes - 1, row.original.dia).toLocaleDateString('es-MX'),
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => row.original.descripcion || '—',
    },
    {
      accessorKey: 'empresaNombre',
      header: 'Empresa',
    },
    {
      accessorKey: 'source',
      header: 'Origen',
      cell: ({ row }) =>
        row.original.source === 'manual' ? <Badge variant="secondary">Manual</Badge> : <Badge variant="outline">CSV</Badge>,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => quitarStaged(row.original)}
          title="Quitar de la cola"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      ),
    },
  ];

  // --- Helpers ---
  const fechaKey = (f: DiaNoHabilFechaRequest) =>
    `${f.anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;

  const stagedKey = (s: StagedItem) => `${s.source}:${s.idEmpresa}:${fechaKey(s)}`;

  const existeDuplicado = (nueva: DiaNoHabilFechaRequest, empresaIds: number[]) => {
    const nuevaKey = fechaKey(nueva);
    const targetIds = new Set(empresaIds);
    const enBd = items.some((i) => {
      const fecha = i.fecha.slice(0, 10);
      return fecha === nuevaKey && targetIds.has(i.idEmpresa);
    });
    const enCola = stagedItems.some((s) => {
      const fecha = fechaKey(s);
      const sTargetIds = getTargetEmpresaIds(s);
      return fecha === nuevaKey && sTargetIds.some((id) => targetIds.has(id));
    });
    return enBd || enCola;
  };

  const quitarStaged = (item: StagedItem) => {
    const key = stagedKey(item);
    setStagedItems((prev) => prev.filter((s) => stagedKey(s) !== key));
  };

  // --- Carga manual ---
  const agregarFechaManual = () => {
    if (!fechaInput) return;
    const [y, m, d] = fechaInput.split('-').map(Number);
    const targetEmpresaIds = selectedEmpresa === '__all__'
      ? empresas.map((e) => Number(e.idEmpresa))
      : [Number(selectedEmpresa)];
    const nueva: StagedItem = {
      anio: y,
      mes: m,
      dia: d,
      descripcion: descripcionInput.trim() || undefined,
      source: 'manual',
      idEmpresa: selectedEmpresa === '__all__' ? '__all__' : Number(selectedEmpresa),
      empresaNombre,
    };
    if (existeDuplicado(nueva, targetEmpresaIds)) {
      toast.error('La fecha ya existe en la base de datos o en la cola');
      return;
    }
    setStagedItems((prev) => [...prev, nueva].sort((a, b) => fechaKey(a).localeCompare(fechaKey(b))),
    );
    setFechaInput('');
    setDescripcionInput('');
    toast.success('Día agregado a la cola');
  };

  // --- Carga CSV ---
  const resetCsv = () => {
    setCsvFile(null);
    setCsvError(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleCsvFile = async (file: File) => {
    resetCsv();
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('El archivo debe tener extensión .csv');
      toast.error('El archivo debe tener extensión .csv');
      return;
    }
    if (file.size > 5_000_000) {
      setCsvError(`El archivo excede el límite de 5 MB (${(file.size / 1_000_000).toFixed(2)} MB)`);
      toast.error(`El archivo excede el límite de 5 MB (${(file.size / 1_000_000).toFixed(2)} MB)`);
      return;
    }
    setCsvFile(file);
    const parsed = await parseDiasNoHabilesCsv(file);
    if (parsed.errorMessage) {
      setCsvError(parsed.errorMessage);
      toast.error(parsed.errorMessage);
      return;
    }

    const targetEmpresaIds = selectedEmpresa === '__all__'
      ? empresas.map((e) => Number(e.idEmpresa))
      : [Number(selectedEmpresa)];

    const nuevos: StagedItem[] = [];
    const errores: string[] = [];
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const dia = Number(row.dia);
      const mes = Number(row.mes);
      const anio = Number(row.anio);
      if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(anio)) {
        errores.push(`Fila ${i + 2}: fecha inválida`);
        continue;
      }
      const desc = row.descripcion?.trim();
      const nueva: StagedItem = {
        anio,
        mes,
        dia,
        descripcion: desc || undefined,
        source: 'csv',
        rowNumber: i + 2,
        idEmpresa: selectedEmpresa === '__all__' ? '__all__' : Number(selectedEmpresa),
        empresaNombre,
      };
      if (existeDuplicado(nueva, targetEmpresaIds)) {
        errores.push(`Fila ${i + 2}: fecha duplicada`);
        continue;
      }
      nuevos.push(nueva);
    }

    if (errores.length > 0) {
      setCsvError(`${errores.length} fila(s) con error`);
      toast.warning(`${errores.length} fila(s) del CSV se omitieron por errores`);
    }

    if (nuevos.length > 0) {
      setStagedItems((prev) => [...prev, ...nuevos].sort((a, b) => fechaKey(a).localeCompare(fechaKey(b))),
      );
      toast.success(`${nuevos.length} día(s) del CSV agregado(s) a la cola`);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCsvFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCsvFile(file);
  };

  // --- Guardar todo ---
  const handleGuardar = async () => {
    if (stagedItems.length === 0) return;
    try {
      setIsSaving(true);

      const requests = new Map<number, DiaNoHabilFechaRequest[]>();
      for (const item of stagedItems) {
        const empresaIds = getTargetEmpresaIds(item);
        for (const idEmpresa of empresaIds) {
          if (!requests.has(idEmpresa)) requests.set(idEmpresa, []);
          requests.get(idEmpresa)!.push(item);
        }
      }

      let totalGuardados = 0;
      let totalErrores = 0;
      for (const [idEmpresa, fechas] of requests) {
        const response = await vacacionesApi.createDiasNoHabiles({
          idEmpresa,
          fechas,
          descripcionGeneral: undefined,
        });
        const data = response.data.data;
        if (data) {
          totalGuardados += data.successCount;
          totalErrores += data.errorCount;
        }
      }

      toast.success(`${totalGuardados} día(s) no hábil(es) guardado(s)`);
      if (totalErrores > 0) {
        toast.error(`${totalErrores} día(s) no se pudieron guardar por duplicados u otros errores`);
      }
      setStagedItems([]);
      resetCsv();
      loadDias();
      setIsModalOpen(false);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al guardar días no hábiles');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDescargarPlantilla = () => {
    const blob = buildPlantillaDiasNoHabilesCsv();
    downloadCsv(blob, 'plantilla_dias_no_habiles.csv');
  };

  const handleDescargarEjemplo = () => {
    const blob = buildPlantillaDiasNoHabilesCsv();
    downloadCsv(blob, 'ejemplo_dias_no_habiles.csv');
  };

  const handleCloseModal = () => {
    if (stagedItems.length > 0) {
      const confirmar = confirm('Tienes días en cola sin guardar. ¿Seguro que quieres cerrar?');
      if (!confirmar) return;
    }
    setIsModalOpen(false);
    setStagedItems([]);
    resetCsv();
    setFechaInput('');
    setDescripcionInput('');
  };

  const renderFiltros = (disabled = false) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1 sm:w-64">
        <label className="text-sm font-medium">
          <Building2 className="mr-1 inline h-3.5 w-3.5" />
          Empresa
        </label>
        <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las empresas</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e.idEmpresa} value={String(e.idEmpresa)}>
                {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Botón principal */}
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir día(s) no hábil
        </Button>
      </div>

      {/* Filtros principales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtra los días no hábiles guardados.</CardDescription>
        </CardHeader>
        <CardContent>{renderFiltros()}</CardContent>
      </Card>

      {/* Tabla principal: días no hábiles en BD */}
      <div className="min-h-[300px]">
        {items.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed bg-card p-2">
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No hay días no hábiles"
              description="No hay días no hábiles guardados para la empresa seleccionada. Usa el botón de arriba para agregar."
            />
          </div>
        ) : (
          <DataTable
            columns={mainColumns}
            data={items}
            loading={loading}
            title="Lista de días no hábiles"
            showRefreshButton
            onRefresh={loadDias}
            globalFilter
            filterConfig={{
              tableId: 'dias-no-habiles-guardados',
              searchableColumns: ['fecha', 'descripcion', 'empresaNombre'],
              defaultSearchColumns: ['descripcion'],
            }}
            pagination
            pageSize={10}
          />
        )}
      </div>

      {/* Modal de carga */}
      <Modal
        id="modal-carga-dias-no-habiles"
        open={isModalOpen}
        setOpen={handleCloseModal}
        title="Añadir días no hábiles"
        size="wide"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseModal}>
              Cerrar
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contexto de carga</CardTitle>
              <CardDescription>
                Selecciona la empresa para aplicar a las cargas manuales y CSV. Si eliges "Todas las empresas", los días se guardarán para cada empresa.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderFiltros()}</CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    Agregar día no hábil
                  </CardTitle>
                  <Badge variant="secondary">Manual</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label className="mb-1.5 block text-sm font-medium">Fecha</label>
                    <Input
                      type="date"
                      value={fechaInput}
                      onChange={(e) => setFechaInput(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-7">
                    <label className="mb-1.5 block text-sm font-medium">Descripción (opcional)</label>
                    <Input
                      value={descripcionInput}
                      onChange={(e) => setDescripcionInput(e.target.value)}
                      placeholder="Ej. Año Nuevo"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={agregarFechaManual} disabled={!fechaInput}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar a la cola
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    Carga masiva CSV
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleDescargarPlantilla}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Plantilla
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDescargarEjemplo}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Ejemplo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => csvInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all duration-300 ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : csvFile
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                  <div
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      dragActive
                        ? 'bg-primary/20 text-primary'
                        : csvFile
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {csvFile ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      dragActive ? 'text-primary' : csvFile ? 'text-emerald-600' : 'text-muted-foreground'
                    }`}
                  >
                    {csvFile ? csvFile.name : dragActive ? 'Suelta aquí' : 'Arrastra CSV o haz clic'}
                  </p>
                  {!csvFile && !dragActive && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">dia, mes, anio, descripcion</span>
                    </p>
                  )}
                </div>

                {csvFile && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{csvFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={resetCsv} className="text-red-500 hover:text-red-600">
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Quitar
                    </Button>
                  </div>
                )}

                {csvError && (
                  <p className="text-sm text-red-500">{csvError}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {stagedItems.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold">{stagedItems.length} día(s) en cola</span>
                <span className="text-muted-foreground">
                  {stagedItems.filter((s) => s.source === 'manual').length} manual ·{' '}
                  {stagedItems.filter((s) => s.source === 'csv').length} CSV
                </span>
              </div>
              <Button onClick={handleGuardar} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar {stagedItems.length > 0 && `(${stagedItems.length})`}
              </Button>
            </div>
          )}

          <div className="min-h-[300px]">
            {stagedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-2">
                <EmptyState
                  icon={<Inbox className="h-10 w-10" />}
                  title="Cola vacía"
                  description="Agrega días manualmente o carga un archivo CSV para previsualizarlos aquí antes de guardar."
                />
              </div>
            ) : (
              <DataTable
                columns={stagedColumns}
                data={stagedItems}
                title={`Cola de días por guardar (${stagedItems.length})`}
                globalFilter
                filterConfig={{
                  tableId: 'dias-no-habiles-cola',
                  searchableColumns: ['anio', 'descripcion', 'empresaNombre'],
                  defaultSearchColumns: ['descripcion'],
                }}
                pagination
                pageSize={10}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Usuarios afectados */}
      {afectados !== null && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Usuarios afectados</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAfectados(null)}>
                Cerrar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAfectados ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
              </div>
            ) : afectados.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay usuarios afectados.</p>
            ) : (
              <div className="max-h-60 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left">ID Usuario</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Tipo día</th>
                      <th className="px-3 py-2 text-left">Origen</th>
                      <th className="px-3 py-2 text-left">Consume saldo</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {afectados.map((a) => (
                    <tr key={a.idDiaUsuario}>
                      <td className="px-3 py-2">{a.idUsuario}</td>
                      <td className="px-3 py-2">
                        {new Date(a.fecha).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-3 py-2">{a.tipoDiaNombre ?? '—'}</td>
                      <td className="px-3 py-2">{a.origen}</td>
                      <td className="px-3 py-2">{a.consumeSaldo ? 'Sí' : 'No'}</td>
                      <td className="px-3 py-2">{a.estado ?? '—'}</td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Confirmación desactivar */}
      <AlertDialog open={diaADesactivar !== null} onOpenChange={(open) => !open && setDiaADesactivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar día no hábil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará el día no hábil y las vacaciones generadas para los usuarios. Puedes volver a activarlo más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDiaADesactivar(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (diaADesactivar) {
                  handleDesactivar(diaADesactivar);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
