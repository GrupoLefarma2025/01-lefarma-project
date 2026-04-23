import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { FilePenLine, Save, FileText, Menu } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HelpSidebar } from '@/components/help/HelpSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import TinyMceEditor from '@/components/help/TinyMceEditor';
import TinyMceViewer from '@/components/help/TinyMceViewer';
import { useHelpStore } from '@/store/helpStore';
import { helpService } from '@/services/helpService';
import type { HelpArticle } from '@/types/help.types';
import { toApiError } from '@/utils/errors';


export default function HelpList() {
  usePageTitle('Ayuda', 'Centro de ayuda y soporte');

  const { 
    articles, 
    isLoading, 
    selectedModule, 
    selectedType, 
    fetchArticlesByModule, 
    fetchArticlesByType, 
    fetchForUser,
    setSelectedModule,
    setSelectedType
  } = useHelpStore();
  
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredArticles = useMemo(() => {
    if (!selectedModule) return articles;
    return articles.filter(a => a.modulo === selectedModule);
  }, [articles, selectedModule]);

  const selectedArticle = useMemo<HelpArticle | null>(() => {
    if (!selectedArticleId && filteredArticles.length > 0) {
      return filteredArticles[0];
    }
    return filteredArticles.find((a) => a.id === selectedArticleId) ?? null;
  }, [filteredArticles, selectedArticleId]);

  useEffect(() => {
    fetchForUser();
  }, [fetchForUser]);



  useEffect(() => {
    if (filteredArticles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(filteredArticles[0].id);
    } else if (filteredArticles.length === 0) {
      setSelectedArticleId(null);
      setIsEditing(false);
    } else if (selectedArticleId && !filteredArticles.some((a) => a.id === selectedArticleId)) {
      setSelectedArticleId(filteredArticles[0].id);
      setIsEditing(false);
    }
  }, [filteredArticles, selectedArticleId]);

  useEffect(() => {
    if (!isEditing && selectedArticle) {
      setEditedContent(selectedArticle.contenido);
    }
  }, [isEditing, selectedArticle]);

  const handleToggleDocType = (checked: boolean) => {
    setIsEditing(false);
    setSelectedArticleId(null);
    const newType = checked ? 'desarrollador' : 'usuario';
    setSelectedType(newType);
    if (selectedModule) {
      fetchArticlesByModule(selectedModule, newType);
    } else if (newType === 'desarrollador') {
      fetchArticlesByType('desarrollador');
    } else {
      fetchForUser();
    }
  };

  const handleModuleSelect = (modulo: string) => {
    setIsEditing(false);
    setSelectedArticleId(null);
    setSelectedModule(modulo);
    setIsSidebarOpen(false);
    if (modulo) {
      fetchArticlesByModule(modulo, selectedType);
    } else if (selectedType === 'desarrollador') {
      fetchArticlesByType('desarrollador');
    } else {
      fetchForUser();
    }
  };

  const handleEdit = () => {
    if (!selectedArticle) return;
    setEditedContent(selectedArticle.contenido);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!selectedArticle) return;
    setEditedContent(selectedArticle.contenido);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedArticle) return;
    setIsSaving(true);
    try {
      await helpService.update({
        id: selectedArticle.id,
        titulo: selectedArticle.titulo,
        contenido: editedContent,
        resumen: selectedArticle.resumen || '',
        modulo: selectedArticle.modulo,
        tipo: selectedArticle.tipo,
        categoria: selectedArticle.categoria || '',
        orden: selectedArticle.orden,
        activo: selectedArticle.activo,
      });
      setIsEditing(false);
      if (selectedModule) {
        fetchArticlesByModule(selectedModule);
      } else if (selectedType === 'desarrollador') {
        fetchArticlesByType('desarrollador');
      } else {
        fetchForUser();
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar el contenido de ayuda');
    }finally {
      setIsSaving(false);
    }
  };

  if (isLoading && articles.length === 0) {
    return (
      <div className="flex flex-col md:flex-row h-[calc(100vh-7rem)]">
        <div className="hidden md:block w-64 border-r shrink-0">
          <HelpSidebar 
            selectedModule={selectedModule}
            onModuleSelect={handleModuleSelect}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="w-full p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-4 rounded-lg border p-4 md:p-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-7rem)]">
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de módulos</SheetTitle>
          </SheetHeader>
          <HelpSidebar 
            selectedModule={selectedModule}
            onModuleSelect={handleModuleSelect}
          />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block w-64 border-r shrink-0">
        <HelpSidebar 
          selectedModule={selectedModule}
          onModuleSelect={handleModuleSelect}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-2 sm:p-4 sm:pb-0">
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Usuario</span>
                  <Switch
                    checked={selectedType === 'desarrollador'}
                    onCheckedChange={handleToggleDocType}
                    aria-label="Cambiar tipo de documento"
                  />
                  <span className="text-sm text-muted-foreground">Sistemas</span>
                </div>

                {selectedArticle && (
                   !isEditing ? (
                     <Button variant="outline" size="sm" onClick={handleEdit} className="w-full sm:w-auto">
                       <FilePenLine className="h-4 w-4 sm:mr-2" />
                       <span className="hidden sm:inline">Editar</span>
                     </Button>
                   ) : (
                     <div className="flex gap-2 w-full sm:w-auto">
                       <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="flex-1 sm:flex-initial">
                         <Save className="h-4 w-4 sm:mr-2" />
                         <span className="hidden sm:inline">{isSaving ? 'Guardando...' : 'Guardar'}</span>
                         <span className="sm:hidden">{isSaving ? '...' : 'Guardar'}</span>
                       </Button>
                       <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving} className="flex-1 sm:flex-initial">
                         Cancelar
                       </Button>
                     </div>
                   )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 min-h-0 p-2 sm:p-4">
          {filteredArticles.length === 0 ? (
            <Card className="border-dashed h-full">
              <CardContent className="flex flex-col items-center justify-center h-full p-4">
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50 mb-4" />
                <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground mb-2 text-center">
                  No hay artículos disponibles
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-md px-4">
                  {selectedType === 'desarrollador'
                    ? 'No hay artículos de documentación técnica en esta sección.'
                    : 'No hay artículos de ayuda para mostrar en esta sección.'}
                </p>
              </CardContent>
            </Card>
          ) : isEditing ? (
            <Card className="h-full">
              <CardContent className="p-2 sm:p-4 h-full flex flex-col">
                {selectedArticle && (
                  <TinyMceEditor
                    initialContent={selectedArticle.contenido}
                    onChange={setEditedContent}
                    height="100%"
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-full">
              <Card>
                <CardContent className="p-2 sm:p-4">
                  {selectedArticle && (
                    <TinyMceViewer contenido={selectedArticle.contenido} />
                  )}
                </CardContent>
              </Card>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
