import { useState } from 'react';
import { Boxes, Layers, Loader2, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/ui/inline-loader';
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
import { cn } from '@/lib/utils';
import { desactivarModulo, reactivarModulo } from '../services/configuracionAdminApi';
import type { ModuloConfig } from '../types';
import { formatearFecha, mensajeError } from '../utils';
import { colorDeModulo, colorTextoContraste } from '../colores';
import { ModuloEditorDialog } from './ModuloEditorDialog';

interface ModulosPanelProps {
  modulos: ModuloConfig[];
  cargando: boolean;
  puedeGestionar: boolean;
  onCambio: () => void;
}

export function ModulosPanel({
  modulos,
  cargando,
  puedeGestionar,
  onCambio,
}: ModulosPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [moduloEditor, setModuloEditor] = useState<ModuloConfig | null>(null);
  const [moduloEstado, setModuloEstado] = useState<ModuloConfig | null>(null);
  const [procesando, setProcesando] = useState(false);

  const abrirCrear = () => {
    setModuloEditor(null);
    setEditorOpen(true);
  };

  const abrirEditar = (modulo: ModuloConfig) => {
    setModuloEditor(modulo);
    setEditorOpen(true);
  };

  const cambiarEstado = async (modulo: ModuloConfig) => {
    setProcesando(true);
    try {
      if (modulo.activo) {
        await desactivarModulo(modulo.idModulo);
      } else {
        await reactivarModulo(modulo.idModulo);
      }
      toast.success(
        modulo.activo ? 'Módulo desactivado.' : 'Módulo reactivado.',
      );
      setModuloEstado(null);
      onCambio();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Módulos</h3>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Agrupan variables y definen el prefijo de sus claves. Las variables sin módulo
            pertenecen a «Global».
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={abrirCrear}
          disabled={!puedeGestionar}
          title={
            puedeGestionar
              ? 'Crear un módulo'
              : 'Necesitas permiso para administrar la configuración.'
          }
        >
          <Plus className="h-4 w-4" />
          Nuevo módulo
        </Button>
      </div>

      {cargando && modulos.length === 0 ? (
        <InlineLoader message="Cargando módulos…" />
      ) : modulos.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-10 w-10" />}
          title="Aún no hay módulos"
          description="El módulo «Global» se crea automáticamente. Crea módulos para agrupar variables por área."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modulos.map((modulo) => {
            const esGlobal = modulo.clave === 'global';
            const color = colorDeModulo(modulo.color, modulo.clave);
            return (
              <article
                key={modulo.idModulo}
                className={cn(
                  'flex min-h-[9.5rem] flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors',
                  !modulo.activo && 'opacity-75',
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: color,
                      color: colorTextoContraste(color),
                    }}
                    title={`Color del módulo: ${color}`}
                  >
                    <Boxes className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-sm font-semibold leading-tight">
                        {modulo.nombre}
                      </h4>
                      {esGlobal && (
                        <Badge variant="secondary" className="px-1.5 text-[9px]">
                          Base
                        </Badge>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {modulo.clave}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[10px]',
                      modulo.activo
                        ? 'border-emerald-500/40 text-emerald-600'
                        : 'border-destructive/40 text-destructive',
                    )}
                  >
                    {modulo.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {modulo.descripcion ?? 'Sin descripción.'}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span
                    className="flex items-center gap-1 text-[11px] text-muted-foreground"
                    title="Variables ligadas al módulo"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {modulo.totalVariables}{' '}
                    {modulo.totalVariables === 1 ? 'variable' : 'variables'}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-[10px] text-muted-foreground">
                      {formatearFecha(modulo.fechaModificacion)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => abrirEditar(modulo)}
                      disabled={!puedeGestionar}
                      title="Editar módulo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        modulo.activo
                          ? 'text-destructive hover:text-destructive'
                          : 'text-emerald-600 hover:text-emerald-600',
                      )}
                      onClick={() => setModuloEstado(modulo)}
                      disabled={!puedeGestionar || esGlobal}
                      title={
                        esGlobal
                          ? 'El módulo global no puede desactivarse.'
                          : modulo.activo
                            ? 'Desactivar módulo'
                            : 'Reactivar módulo'
                      }
                    >
                      {modulo.activo ? (
                        <PowerOff className="h-3.5 w-3.5" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ModuloEditorDialog
        open={editorOpen}
        setOpen={setEditorOpen}
        modulo={moduloEditor}
        onGuardado={() => onCambio()}
      />

      <AlertDialog
        open={moduloEstado !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setModuloEstado(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {moduloEstado?.activo ? 'Desactivar módulo' : 'Reactivar módulo'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {moduloEstado?.activo
                ? `El módulo «${moduloEstado?.nombre}» dejará de estar disponible al crear variables. Las variables existentes no se modifican.`
                : `El módulo «${moduloEstado?.nombre}» volverá a estar disponible para nuevas variables.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={procesando}
              onClick={(evento) => {
                evento.preventDefault();
                if (moduloEstado) void cambiarEstado(moduloEstado);
              }}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
