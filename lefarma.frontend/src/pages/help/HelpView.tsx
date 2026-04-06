import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHelpStore } from '@/store/helpStore';
import TinyMceEditor from '@/components/help/TinyMceEditor';
import TinyMceViewer from '@/components/help/TinyMceViewer';
import { helpService } from '@/services/helpService';
import type { UpdateHelpArticleRequest } from '@/types/help.types';

export default function HelpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedArticle, isLoading, fetchArticleById } = useHelpStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    if (id) {
      fetchArticleById(parseInt(id));
    }
  }, [id, fetchArticleById]);

  useEffect(() => {
    if (selectedArticle) {
      setEditedContent(selectedArticle.contenido);
    }
  }, [selectedArticle]);

  const handleSave = async () => {
    if (!selectedArticle || !id) return;

    setIsSaving(true);
    try {
      const updateData: UpdateHelpArticleRequest = {
        id: selectedArticle.id,
        titulo: selectedArticle.titulo,
        contenido: editedContent,
        resumen: selectedArticle.resumen || '',
        modulo: selectedArticle.modulo,
        tipo: selectedArticle.tipo,
        categoria: selectedArticle.categoria || '',
        orden: selectedArticle.orden,
        activo: selectedArticle.activo,
      };
      await helpService.update(updateData);
      setIsEditing(false);
      // Refetch to get updated data
      await fetchArticleById(parseInt(id));
    } catch (error) {
      console.error('Error saving article:', error);
      alert('Error al guardar artículo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(selectedArticle?.contenido || '');
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/help')}
        >
          <ChevronLeft className="mr-1 md:mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="mr-1 md:mr-2 h-4 w-4" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2 ml-auto">
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-1 md:mr-2 h-4 w-4" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      )}

      {/* Not Found State */}
      {!isLoading && !selectedArticle && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold mb-2">Artículo no encontrado</h2>
          <p className="text-muted-foreground mb-4">
            El artículo que buscas no existe o ha sido eliminado.
          </p>
          <Button variant="outline" onClick={() => navigate('/help')}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver al centro de ayuda
          </Button>
        </div>
      )}

      {/* Article Content */}
      {!isLoading && selectedArticle && (
        <div className="space-y-4 md:space-y-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{selectedArticle.titulo}</h1>

          {selectedArticle.resumen && (
            <p className="text-base md:text-lg text-muted-foreground">
              {selectedArticle.resumen}
            </p>
          )}

          <div className="flex flex-wrap gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
            <span>Módulo: {selectedArticle.modulo}</span>
            <span className="hidden sm:inline">•</span>
            <span>Tipo: {selectedArticle.tipo}</span>
            {selectedArticle.categoria && (
              <>
                <span className="hidden sm:inline">•</span>
                <span>Categoría: {selectedArticle.categoria}</span>
              </>
            )}
          </div>

          <div className="border-t pt-4 md:pt-6">
            {isEditing ? (
              <TinyMceEditor
                initialContent={selectedArticle.contenido}
                onChange={setEditedContent}
              />
            ) : (
              <TinyMceViewer contenido={selectedArticle.contenido} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
