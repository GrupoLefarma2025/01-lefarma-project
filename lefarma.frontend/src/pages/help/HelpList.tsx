import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePenLine, Save, FileText, Plus } from 'lucide-react';
import { HelpSidebar } from '@/components/help/HelpSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import TinyMceEditor from '@/components/help/TinyMceEditor';
import HtmlViewer from '@/components/help/HtmlViewer';
import { useHelpStore } from '@/store/helpStore';
import type { HelpArticle } from '@/types/help.types';

export default function HelpList() {
  const navigate = useNavigate();
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
      const { helpService } = await import('@/services/helpService');
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
    } catch (error) {
      console.error('Error saving help article:', error);
      alert('Error al guardar el contenido de ayuda');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-64 border-r shrink-0">
          <HelpSidebar 
            selectedModule={selectedModule}
            onModuleSelect={handleModuleSelect}
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-4 rounded-lg border p-6">
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
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-64 border-r shrink-0">
        <HelpSidebar 
          selectedModule={selectedModule}
          onModuleSelect={handleModuleSelect}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Centro de Ayuda</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
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
                   <Button variant="outline" onClick={handleEdit}>
                     <FilePenLine className="h-4 w-4 mr-2" />
                     Editar
                   </Button>
                 ) : (
                   <>
                     <Button onClick={handleSaveEdit} disabled={isSaving}>
                       <Save className="h-4 w-4 mr-2" />
                       {isSaving ? 'Guardando...' : 'Guardar'}
                     </Button>
                     <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                       Cancelar
                     </Button>
                   </>
                 )
              )}
            </div>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                No hay artículos disponibles
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                {selectedType === 'desarrollador'
                  ? 'No hay artículos de documentación técnica en esta sección.'
                  : 'No hay artículos de ayuda para mostrar en esta sección.'}
              </p>
              <Button onClick={() => navigate('/help/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear artículo
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border p-6 bg-amber-50/50">
              {selectedArticle && (
                isEditing ? (
                  <TinyMceEditor
                    initialContent={selectedArticle.contenido}
                    onChange={setEditedContent}
                  />
                ) : (
                  <HtmlViewer contenido={selectedArticle.contenido} />
                )
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
