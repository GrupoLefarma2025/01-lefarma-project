import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { helpService } from '@/services/helpService';
import type { HelpModule } from '@/types/help.types';

interface HelpSidebarProps {
  selectedModule: string;
  onModuleSelect: (nombre: string) => void;
}

export function HelpSidebar({ selectedModule, onModuleSelect }: HelpSidebarProps) {
  const [modules, setModules] = useState<HelpModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<HelpModule | null>(null);
  const [deletingModule, setDeletingModule] = useState<HelpModule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModules = async () => {
    setIsLoading(true);
    try {
      const data = await helpService.getModules();
      setModules(data);
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleSaved = async (data: { nombre: string; label: string; orden?: number }, isEditing: boolean) => {
    try {
      if (isEditing && editingModule) {
        await helpService.updateModule({
          id: editingModule.id,
          nombre: data.nombre,
          label: data.label,
          orden: data.orden ?? editingModule.orden,
          activo: editingModule.activo,
        });
      } else {
        await helpService.createModule({
          nombre: data.nombre,
          label: data.label,
          orden: data.orden ?? 0,
        });
      }
      fetchModules();
    } catch (error) {
      console.error('Error saving module:', error);
    }
  };

  const handleEditModule = (module: HelpModule) => {
    setEditingModule(module);
  };

  const handleDeleteModule = async () => {
    if (!deletingModule) return;
    setIsDeleting(true);
    try {
      await helpService.deleteModule(deletingModule.id);
      if (selectedModule === deletingModule.nombre) {
        onModuleSelect('');
      }
      setDeletingModule(null);
      fetchModules();
    } catch (error) {
      console.error('Error deleting module:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  return (
    <>
      <ScrollArea className="h-[calc(100vh-7rem)]">
        <div className="space-y-4 p-4">
          <Card>
            <CardContent className="p-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsAddModuleOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar módulo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Módulos
              </h3>
              <div className="space-y-1">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando...</p>
                ) : (
                  modules.map((module) => (
                    <div key={module.id} className="flex items-center gap-1">
                      <Button
                        variant={selectedModule === module.nombre ? 'default' : 'ghost'}
                        className="flex-1 justify-start"
                        onClick={() => onModuleSelect(module.nombre)}
                      >
                        {module.label}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditModule(module)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingModule(module)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <ModuleDialog
        open={isAddModuleOpen || !!editingModule}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModuleOpen(false);
            setEditingModule(null);
          }
        }}
        module={editingModule}
        onSave={handleModuleSaved}
      />

      <AlertDialog open={!!deletingModule} onOpenChange={(open) => !open && setDeletingModule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar módulo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el módulo <strong>{deletingModule?.label}</strong> y todos sus artículos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModule}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: HelpModule | null;
  onSave: (data: { nombre: string; label: string; orden?: number }, isEditing: boolean) => void;
}

function ModuleDialog({ open, onOpenChange, module, onSave }: ModuleDialogProps) {
  const [nombre, setNombre] = useState('');
  const [label, setLabel] = useState('');
  const [orden, setOrden] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (module) {
      setNombre(module.nombre);
      setLabel(module.label);
      setOrden(module.orden);
    } else {
      setNombre('');
      setLabel('');
      setOrden(0);
    }
  }, [module, open]);

  const handleSave = async () => {
    if (!nombre.trim() || !label.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ nombre: nombre.trim(), label: label.trim(), orden }, !!module);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{module ? 'Editar módulo' : 'Nuevo módulo'}</AlertDialogTitle>
          <AlertDialogDescription>
            {module 
              ? 'Modifica los datos del módulo existente.' 
              : 'Completa los datos para crear un nuevo módulo de ayuda.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre (identificador)</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: Catalogos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Etiqueta (display)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej: Catálogos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orden">Orden</Label>
            <Input
              id="orden"
              type="number"
              value={orden}
              onChange={(e) => setOrden(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
