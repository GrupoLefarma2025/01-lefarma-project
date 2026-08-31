import { useState, useEffect, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  UserCog,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { empleadoJefesConfigApi, usuariosCatalogoApi } from '../services/rh.api';
import type {
  EmpleadoJefeNivelCompleto,
  EmpleadoJefesConfigListItem,
  JefeCadenaNivel,
  UpdateEmpleadoJefesConfigRequest,
} from '@/types/jefesNiveles.types';
import type { UsuarioCatalogo } from '../services/rh.api';

const MAX_NIVEL = 5;

const nivelesSchema = z.object({
  idUsuario: z.number().int().positive('Selecciona un empleado válido'),
  niveles: z
    .array(
      z.object({
        nivel: z.number().int().min(1).max(MAX_NIVEL),
        aplica: z.boolean(),
        idUsuarioJefeOverride: z.number().int().positive().nullable().optional(),
      })
    )
    .refine(
      (arr) => arr.filter((n) => n.aplica).length > 0,
      'Debes activar al menos un nivel'
    ),
});

type FormValues = z.infer<typeof nivelesSchema>;

function buildDefaultNiveles(niveles: EmpleadoJefeNivelCompleto[]): FormValues {
  const map = new Map<number, EmpleadoJefeNivelCompleto>(niveles.map((n) => [n.nivel, n]));
  const all: FormValues['niveles'] = Array.from({ length: MAX_NIVEL }, (_, i) => {
    const nivel = i + 1;
    const existente = map.get(nivel);
    return {
      nivel,
      aplica: existente?.aplica ?? false,
      idUsuarioJefeOverride: existente?.idUsuarioJefeOverride ?? null,
    };
  });
  return { idUsuario: 0, niveles: all };
}

export default function JefesNivelesList() {
  usePageTitle('Jefes por Niveles', 'Configuración de niveles de jefe por empleado');

  const [items, setItems] = useState<EmpleadoJefesConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingIdUsuario, setEditingIdUsuario] = useState(0);
  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [cadenaModal, setCadenaModal] = useState<JefeCadenaNivel[]>([]);
  const [loadingCadena, setLoadingCadena] = useState(false);

  const [modalStates, setModalStates] = useState({ edit: false });
  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates((prev) => ({ ...prev, [modalName]: state ?? !prev[modalName] }));
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(nivelesSchema),
    defaultValues: buildDefaultNiveles([]),
  });

  const usuarioOptions = useMemo(
    () =>
      usuarios.map((u) => ({
        value: String(u.idUsuario),
        label: u.nombreCompleto ?? `Usuario ${u.idUsuario}`,
      })),
    [usuarios]
  );

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await empleadoJefesConfigApi.getList();
      if (response.data.success) {
        setItems(response.data.data || []);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      setLoadingUsuarios(true);
      const list = await usuariosCatalogoApi.getAll();
      setUsuarios(list);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar usuarios');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const fetchCadena = async (idUsuario: number) => {
    if (!idUsuario) {
      setCadenaModal([]);
      return;
    }
    try {
      setLoadingCadena(true);
      const response = await empleadoJefesConfigApi.getCadena(idUsuario);
      if (response.data.success) {
        setCadenaModal(response.data.data?.cadena ?? []);
      }
    } catch {
      setCadenaModal([]);
    } finally {
      setLoadingCadena(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchItems();
  }, []);

  const handleNuevo = () => {
    setEditingIdUsuario(0);
    form.reset(buildDefaultNiveles([{ nivel: 1, aplica: true }]));
    form.setValue('idUsuario', 0);
    setIsEditing(false);
    toggleModal('edit', true);
    //if (usuarios.length === 0) fetchUsuarios();
  };

  const handleEditar = (idUsuario: number) => {
    const item = items.find((i) => i.idUsuario === idUsuario);
    setEditingIdUsuario(idUsuario);
    form.reset(
      buildDefaultNiveles(item?.niveles ?? [{ nivel: 1, aplica: true }])
    );
    form.setValue('idUsuario', idUsuario);
    setIsEditing(true);
    toggleModal('edit', true);
    fetchCadena(idUsuario);
  };

  const handleEliminar = async (idUsuario: number) => {
    if (!confirm(`¿Eliminar la configuración del usuario ${idUsuario}? Volverá al default legacy (solo nivel 1).`)) return;
    try {
      const response = await empleadoJefesConfigApi.update(idUsuario, { niveles: [] });
      if (response.data.success) {
        toast.success('Configuración eliminada (volvió al default).');
        await fetchItems();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al eliminar la configuración');
    }
  };

  const handleGuardar = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const targetIdUsuario = isEditing ? editingIdUsuario : values.idUsuario;
      const payload: UpdateEmpleadoJefesConfigRequest = {
        niveles: values.niveles
          .filter((n) => n.aplica)
          .map((n) => ({
            nivel: n.nivel,
            aplica: n.aplica,
            idUsuarioJefeOverride: n.idUsuarioJefeOverride,
          })),
      };

      const response = await empleadoJefesConfigApi.update(targetIdUsuario, payload);
      if (response.data.success) {
        toast.success(isEditing ? 'Configuración actualizada.' : 'Configuración creada.');
        toggleModal('edit', false);
        await fetchItems();
      } else {
        toast.error(response.data.message ?? 'Error al guardar la configuración');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(e.description));
      } else {
        toast.error(err.message ?? 'Error al guardar la configuración');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        (i.nombreCompleto ?? '').toLowerCase().includes(term) ||
        (i.numeroEmpleado ?? '').toLowerCase().includes(term) ||
        (i.niveles ?? []).some(
          (n) =>
            (n.nombreJefeVista ?? '').toLowerCase().includes(term) ||
            (n.nombreJefeOverride ?? '').toLowerCase().includes(term)
        ) ||
        String(i.idUsuario).includes(term)
    );
  }, [items, search]);

  const describirJefe = (nivel: EmpleadoJefeNivelCompleto | undefined) => {
    if (!nivel) return { tipo: 'sin-jefe' as const, texto: 'Sin jefe' };
    if (nivel.idUsuarioJefeOverride) {
      return {
        tipo: 'override' as const,
        texto: `${nivel.nombreJefeOverride ?? `Usuario ${nivel.idUsuarioJefeOverride}`}`,
      };
    }
    if (!nivel.nominaJefeVista) {
      return { tipo: 'sin-jefe' as const, texto: 'Sin jefe (vista)' };
    }
    if (!nivel.idUsuarioJefeVista) {
      return { tipo: 'sin-usuario' as const, texto: `${nivel.nominaJefeVista} (sin usuario)` };
    }
    return {
      tipo: 'ok' as const,
      texto: nivel.nombreJefeVista ?? `Usuario ${nivel.idUsuarioJefeVista}`,
    };
  };

  const columns: ColumnDef<EmpleadoJefesConfigListItem>[] = [
    {
      accessorKey: 'numeroEmpleado',
      header: 'Nómina',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.numeroEmpleado ?? '—'}
        </span>
      ),
    },
    {
      id: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {row.original.nombreCompleto ?? `Usuario ${row.original.idUsuario}`}
          </span>
          <span className="text-xs text-muted-foreground">
            idUsuario: {row.original.idUsuario}
          </span>
        </div>
      ),
    },
    {
      id: 'cadena',
      header: 'Cadena de Jefes',
      cell: ({ row }) => {
        const activos = row.original.niveles
          .filter((n) => n.aplica)
          .sort((a, b) => a.nivel - b.nivel);
        if (activos.length === 0) {
          return <Badge variant="secondary">Default (nivel 1)</Badge>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {activos.map((n) => {
              const jefe = describirJefe(n);
              if (jefe.tipo === 'sin-jefe') {
                return (
                  <Badge key={n.nivel} variant="outline" className="h-5 w-fit gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700"
                    title={`No hay jefe asignado para el nivel ${n.nivel}. El paso de nivel ${n.nivel} no aplicará.`}>
                    <span className="font-mono text-[10px]">Nivel {n.nivel}</span>
                    Sin jefe - se omitirá
                  </Badge>
                );
              }
              if (jefe.tipo === 'sin-usuario') {
                return (
                  <Badge key={n.nivel} variant="outline" className="h-5 w-fit gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700"
                    title={`El jefe ${jefe.texto} no tiene usuario en el sistema. El paso de nivel ${n.nivel} no aplicará.`}>
                    <span className="font-mono text-[10px]">Nivel {n.nivel}</span>
                    {jefe.texto}
                  </Badge>
                );
              }
              if (jefe.tipo === 'override') {
                return (
                  <Badge key={n.nivel} variant="outline" className="h-5 w-fit gap-1.5 border-blue-500/40 bg-blue-500/10 text-blue-700"
                    title={`Override: el paso de nivel ${n.nivel} irá a ${jefe.texto}`}>
                    <span className="font-mono text-[10px]">Nivel {n.nivel}</span>
                    <span className="truncate">{jefe.texto}</span>
                  </Badge>
                );
              }
              return (
                <Badge key={n.nivel} variant="outline" className="h-5 w-fit gap-1.5 border-green-500/40 bg-green-500/10 text-green-700"
                  title={`El jefe ${jefe.texto} tiene usuario en el sistema. El paso de nivel ${n.nivel} aplicará.`}>
                  <span className="font-mono text-[10px]">Nivel {n.nivel}</span>
                  <span className="truncate">{jefe.texto}</span>
                </Badge>
              );
            })}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleEditar(row.original.idUsuario)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5"
            onClick={() => handleEliminar(row.original.idUsuario)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const nivelesActivos = form.watch('niveles').filter((n) => n.aplica).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, nómina, jefe o id..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Configuración
        </Button>
      </div>

      <div className="relative">
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
            <ListChecks className="text-muted-foreground/40 mb-4 h-10 w-10" />
            <p className="text-sm font-medium text-foreground">
              No hay empleados con configuración de niveles
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Los empleados sin configuración usan el default legacy (solo nivel 1).
            </p>
            <Button className="mt-4" size="sm" onClick={handleNuevo}>
              <Plus className="mr-2 h-4 w-4" /> Crear primera configuración
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={filteredItems}
              title="Configuración de Niveles de Jefe"
              showRowCount
              showRefreshButton
              onRefresh={fetchItems}
            />
            {loading && (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        id="modal-jefes-niveles"
        open={modalStates.edit}
        setOpen={(open) => toggleModal('edit', open)}
        title={isEditing ? 'Editar Configuración' : 'Nueva Configuración'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => toggleModal('edit', false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={form.handleSubmit(handleGuardar)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar Cambios' : 'Crear'}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            {!isEditing && (
              <FormField
                control={form.control}
                name="idUsuario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado *</FormLabel>
                    <FormControl>
                      <Combobox
                        type="empleado"
                        value={String(field.value || '')}
                        onValueChange={(v) => {
                          field.onChange(v ? Number(v) : 0);
                          if (v) fetchCadena(Number(v));
                        }}
                        data={usuarioOptions}
                      >
                        <ComboboxTrigger className="w-full" disabled={loadingUsuarios}>
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">
                              {field.value
                                ? usuarioOptions.find((o) => o.value === String(field.value))?.label ??
                                  `Usuario ${field.value}`
                                : loadingUsuarios
                                  ? 'Cargando usuarios...'
                                  : 'Selecciona un empleado'}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </span>
                        </ComboboxTrigger>
                        <ComboboxContent>
                          <ComboboxInput placeholder="Buscar empleado por nombre..." />
                          <ComboboxEmpty>No se encontraron usuarios</ComboboxEmpty>
                          <ComboboxList>
                            <ComboboxGroup>
                              {usuarioOptions.map((opt) => (
                                <ComboboxItem key={opt.value} value={opt.value} keywords={[opt.label]}>
                                  {opt.label} (#{opt.value})
                                </ComboboxItem>
                              ))}
                            </ComboboxGroup>
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </FormControl>
                    <FormDescription>
                      Solo aparecen usuarios del sistema. Si no encuentras al empleado, verifica que
                      tenga usuario en Asokam.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEditing && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-muted-foreground text-xs">Editando a:</div>
                <div className="text-sm font-medium">
                  {items.find((i) => i.idUsuario === editingIdUsuario)?.nombreCompleto ??
                    `Usuario ${editingIdUsuario}`}{' '}
                  (#{editingIdUsuario})
                </div>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Niveles de jefe que aplican</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: MAX_NIVEL }, (_, i) => i + 1).map((nivel) => {
                  const completo = cadenaModal.find((c) => c.nivel === nivel);
                  const overrideId = form.watch(`niveles.${nivel - 1}.idUsuarioJefeOverride`);
                  return (
                    <FormField
                      key={nivel}
                      control={form.control}
                      name={`niveles.${nivel - 1}.aplica`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col space-y-2 rounded-md border p-3">
                          <div className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={Boolean(field.value)}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-0.5 leading-none">
                              <FormLabel>Nivel {nivel}</FormLabel>
                            </div>
                          </div>

                          <div className="pl-7 text-sm">
                            {loadingCadena ? (
                              <span className="text-muted-foreground">Cargando cadena de jefes...</span>
                            ) : !completo?.nominaJefe ? (
                              <span className="text-amber-700">
                                No hay jefe en la vista para este nivel.
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-muted-foreground">
                                  Vista: {completo.nombreJefe ?? `nómina ${completo.nominaJefe}`}
                                </div>
                              </div>
                            )}

                            <FormField
                              control={form.control}
                              name={`niveles.${nivel - 1}.idUsuarioJefeOverride`}
                              render={({ field: overrideField }) => (
                                <FormItem className="mt-2">
                                  <FormLabel className="text-xs font-normal">Override de jefe</FormLabel>
                                  <FormControl>
                                    <Combobox
                                      type="jefe"
                                      value={String(overrideField.value ?? '')}
                                      onValueChange={(v) => overrideField.onChange(v ? Number(v) : null)}
                                      data={[{ value: '', label: 'Usar jefe de la vista' }, ...usuarioOptions]}
                                    >
                                      <ComboboxTrigger className="h-9 w-full" disabled={loadingUsuarios}>
                                        <span className="flex w-full items-center justify-between gap-2">
                                          <span className="truncate">
                                            {overrideField.value != null
                                              ? usuarioOptions.find((o) => o.value === String(overrideField.value))?.label ??
                                                `Usuario ${overrideField.value}`
                                              : 'Usar jefe de la vista'}
                                          </span>
                                          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        </span>
                                      </ComboboxTrigger>
                                      <ComboboxContent>
                                        <ComboboxInput placeholder="Buscar jefe..." />
                                        <ComboboxEmpty>No se encontraron usuarios</ComboboxEmpty>
                                        <ComboboxList>
                                          <ComboboxGroup>
                                            <ComboboxItem value="" keywords={['vista']}>
                                              Usar jefe de la vista
                                            </ComboboxItem>
                                            {usuarioOptions.map((opt) => (
                                              <ComboboxItem key={opt.value} value={opt.value} keywords={[opt.label]}>
                                                {opt.label} (#{opt.value})
                                              </ComboboxItem>
                                            ))}
                                          </ComboboxGroup>
                                        </ComboboxList>
                                      </ComboboxContent>
                                    </Combobox>
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {overrideId && (
                              <div className="mt-1 text-xs text-blue-600">
                                ⚡ El paso irá al usuario #{overrideId} (override)
                              </div>
                            )}
                          </div>
                        </FormItem>
                      )}
                    />
                  );
                })}
                <p className="text-muted-foreground pt-2 text-xs">
                  {nivelesActivos === 0
                    ? '⚠️ Ningún nivel activo: se guardará como default legacy (solo nivel 1).'
                    : `${nivelesActivos} nivel(es) activo(s).`}
                </p>
              </CardContent>
            </Card>

            <div className="text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3 text-xs">
              <UserCog className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Recordatorio:</strong> sin configuración, el sistema usa el default
                legacy (solo nivel 1). Los pasos con nivel 1 funcionan siempre; los niveles 2+
                solo aplican si los activas aquí. El override reemplaza al jefe de la vista.
              </div>
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
