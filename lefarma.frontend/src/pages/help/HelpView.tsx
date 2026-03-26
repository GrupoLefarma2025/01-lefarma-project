import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHelpStore } from '@/store/helpStore';
import TinyMceEditor from '@/components/help/TinyMceEditor';
import HtmlViewer from '@/components/help/HtmlViewer';
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
    <div className="max-w-4xl mx-auto p-6">
      {/* Action Buttons */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/help')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        {!isEditing ? (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </>
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
        <div className="space-y-6">
          {/* Title */}
          <h1 className="text-3xl font-bold">{selectedArticle.titulo}</h1>

          {/* Summary */}
          {selectedArticle.resumen && (
            <p className="text-lg text-muted-foreground">
              {selectedArticle.resumen}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>Módulo: {selectedArticle.modulo}</span>
            <span>•</span>
            <span>Tipo: {selectedArticle.tipo}</span>
            {selectedArticle.categoria && (
              <>
                <span>•</span>
                <span>Categoría: {selectedArticle.categoria}</span>
              </>
            )}
          </div>

          {/* Content */}
          <div className="border-t pt-6">
            {isEditing ? (
              <TinyMceEditor
                initialContent={selectedArticle.contenido}
                onChange={setEditedContent}
              />
            ) : (
              <HtmlViewer contenido={selectedArticle.contenido} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
