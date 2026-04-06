import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { HelpModule, CreateHelpModuleRequest, UpdateHelpModuleRequest } from '@/types/help.types';

interface ModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: HelpModule | null;
  onSave: (data: CreateHelpModuleRequest | UpdateHelpModuleRequest) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export function ModuleDialog({ open, onOpenChange, module, onSave, onDelete }: ModuleDialogProps) {
  const isEditing = !!module;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateHelpModuleRequest>({
    defaultValues: {
      nombre: '',
      label: '',
      orden: 0,
    },
  });

  useEffect(() => {
    if (module) {
      reset({
        nombre: module.nombre,
        label: module.label,
        orden: module.orden,
      });
    } else {
      reset({
        nombre: '',
        label: '',
        orden: 0,
      });
    }
  }, [module, reset]);

  const onSubmit = async (data: CreateHelpModuleRequest) => {
    setIsSaving(true);
    try {
      if (isEditing && module) {
        await onSave({ ...data, id: module.id, activo: module.activo });
      } else {
        await onSave(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving module:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!module || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(module.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting module:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar módulo' : 'Agregar módulo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre (identificador)</Label>
              <Input
                id="nombre"
                {...register('nombre', { required: 'El nombre es requerido' })}
                placeholder="ej: Catalogos"
              />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Etiqueta (mostrar)</Label>
              <Input
                id="label"
                {...register('label', { required: 'La etiqueta es requerida' })}
                placeholder="ej: Catálogos"
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orden">Orden</Label>
              <Input
                id="orden"
                type="number"
                {...register('orden', { valueAsNumber: true })}
              />
            </div>

            <DialogFooter className="gap-2">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar módulo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el módulo <strong>{module?.label}</strong> y todos sus artículos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
