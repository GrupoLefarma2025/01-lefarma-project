import { useState } from 'react';
import { Boxes, Loader2, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineLoader } from '@/components/ui/inline-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { desactivarModulo, reactivarModulo } from '../services/configuracionAdminApi';
import type { ModuloConfig } from '../types';
import { formatearFecha, mensajeError } from '../utils';
import { ModuloEditorDialog } from './ModuloEditorDialog';

interface ModulosPanelProps {
  modulos: ModuloConfig[];
  cargando: boolean;
  /** Permiso para crear y editar módulos. */
  puedeGestionar: boolean;
  /** Recarga la lista de módulos en la página. */
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead className="w-[110px]">Variables</TableHead>
              <TableHead className="w-[80px]">Orden</TableHead>
              <TableHead className="w-[110px]">Estado</TableHead>
              <TableHead className="w-[150px]">Actualizado</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && modulos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <InlineLoader message="Cargando módulos…" />
                </TableCell>
              </TableRow>
            ) : modulos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={<Boxes className="h-10 w-10" />}
                    title="Aún no hay módulos"
                    description="El módulo «Global» se crea automáticamente. Crea módulos para agrupar variables por área."
                  />
                </TableCell>
              </TableRow>
            ) : (
              modulos.map((modulo) => {
                const esGlobal = modulo.clave === 'global';
                return (
                  <TableRow key={modulo.idModulo}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {modulo.nombre}
                          {esGlobal && (
                            <Badge variant="secondary" className="text-[9px]">
                              Base
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {modulo.clave}
                        </span>
                        {modulo.descripcion && (
                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                            {modulo.descripcion}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums">{modulo.totalVariables}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums">{modulo.orden}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          modulo.activo
                            ? 'border-emerald-500/40 text-emerald-600'
                            : 'border-destructive/40 text-destructive'
                        }
                      >
                        {modulo.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatearFecha(modulo.fechaModificacion)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                          className={
                            modulo.activo
                              ? 'h-7 w-7 text-destructive hover:text-destructive'
                              : 'h-7 w-7 text-emerald-600 hover:text-emerald-600'
                          }
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
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
