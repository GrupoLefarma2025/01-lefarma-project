import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useWorkflowCatalogs } from '@/hooks/useWorkflowCatalogs';

interface WorkflowJefesExcluidosResponse {
  idWorkflow: number;
  idUsuariosJefe: number[];
}

interface JefesExcluidosModalProps {
  idWorkflow: number;
  nombreWorkflow: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

export function JefesExcluidosModal({ idWorkflow, nombreWorkflow, open, setOpen, onSaved }: JefesExcluidosModalProps) {
  const { usuarios, loadUsuarios, loadingUsuarios } = useWorkflowCatalogs();
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || idWorkflow <= 0) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        await loadUsuarios();
        const res = await API.get<ApiResponse<WorkflowJefesExcluidosResponse>>(
          `/config/workflows/${idWorkflow}/jefes-excluidos`
        );
        setSeleccionados(new Set(res.data?.data?.idUsuariosJefe ?? []));
      } catch (error: unknown) {
        const err = toApiError(error);
        toast.error(err.message ?? 'Error al cargar los jefes excluidos');
        setSeleccionados(new Set());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idWorkflow]);

  const handleSetOpen = (newOpen: boolean) => {
    if (!newOpen) setSearch('');
    setOpen(newOpen);
  };

  const usuariosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...usuarios].sort((a, b) =>
      (a.nombreCompleto ?? '').localeCompare(b.nombreCompleto ?? '')
    );
    if (!term) return sorted;
    return sorted.filter((u) =>
      (u.nombreCompleto ?? '').toLowerCase().includes(term) ||
      String(u.idUsuario).includes(term)
    );
  }, [usuarios, search]);

  const toggleUsuario = (idUsuario: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(idUsuario)) next.delete(idUsuario);
      else next.add(idUsuario);
      return next;
    });
  };

  const handleGuardar = async () => {
    setIsSaving(true);
    try {
      const res = await API.put<ApiResponse<WorkflowJefesExcluidosResponse>>(
        `/config/workflows/${idWorkflow}/jefes-excluidos`,
        { idUsuariosJefe: Array.from(seleccionados) }
      );
      if (res.data.success) {
        toast.success('Jefes excluidos actualizados');
        handleSetOpen(false);
        await onSaved();
      } else {
        toast.error(res.data.message ?? 'Error al guardar los jefes excluidos');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar los jefes excluidos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      id="modal-jefes-excluidos"
      open={open}
      setOpen={handleSetOpen}
      title={`Jefes Excluidos — ${nombreWorkflow}`}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => handleSetOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={isSaving || loading} onClick={handleGuardar} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar ({seleccionados.size})
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Los jefes seleccionados <strong>no firmarán</strong> en este workflow. Cuando el motor
            los resuelva como jefe de un paso, el paso se omitirá automáticamente.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario por nombre o id..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {loading || loadingUsuarios ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron usuarios
            </p>
          ) : (
            usuariosFiltrados.map((u) => (
              <label
                key={u.idUsuario}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={seleccionados.has(u.idUsuario)}
                  onCheckedChange={() => toggleUsuario(u.idUsuario)}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <UserX className={`h-4 w-4 shrink-0 ${seleccionados.has(u.idUsuario) ? 'text-amber-600' : 'text-muted-foreground/40'}`} />
                  <span className="text-sm truncate">{u.nombreCompleto ?? `Usuario #${u.idUsuario}`}</span>
                  <span className="text-xs text-muted-foreground shrink-0">#{u.idUsuario}</span>
                </div>
              </label>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {seleccionados.size === 0
            ? 'Ningún jefe excluido: todos los jefes resueltos podrán firmar.'
            : `${seleccionados.size} jefe(s) excluido(s) de este workflow.`}
        </p>
      </div>
    </Modal>
  );
}
