import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { helpService } from '@/services/helpService';
import { useHelpStore } from '@/store/helpStore';
import type { CreateHelpArticleRequest, UpdateHelpArticleRequest } from '@/types/help.types';

const EMPTY_LEXICAL_JSON = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: '',
          },
        ],
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
};

const MODULOS = [
  'General',
  'Catalogos',
  'Auth',
  'Notificaciones',
  'Profile',
  'Admin',
  'SystemConfig',
];

const TIPOS = [
  { value: 'usuario', label: 'Usuario Final' },
  { value: 'desarrollador', label: 'Desarrollador' },
  { value: 'ambos', label: 'Ambos' },
];

export default function HelpEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { selectedArticle, fetchArticleById } = useHelpStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<CreateHelpArticleRequest>({
    titulo: '',
    contenido: JSON.stringify(EMPTY_LEXICAL_JSON, null, 2),
    resumen: '',
    modulo: 'General',
    tipo: 'usuario',
    categoria: '',
    orden: 0,
  });

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchArticleById(parseInt(id));
    }
  }, [id, fetchArticleById]);

  useEffect(() => {
    if (isEditMode && selectedArticle) {
      setFormData({
        titulo: selectedArticle.titulo,
        contenido: selectedArticle.contenido,
        resumen: selectedArticle.resumen || '',
        modulo: selectedArticle.modulo,
        tipo: selectedArticle.tipo,
        categoria: selectedArticle.categoria || '',
        orden: selectedArticle.orden,
      });
    }
  }, [isEditMode, selectedArticle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.titulo.trim()) {
      alert('El título es obligatorio');
      return;
    }

    if (!formData.contenido.trim()) {
      alert('El contenido es obligatorio');
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && id && selectedArticle) {
        // Update existing article
        const updateData: UpdateHelpArticleRequest = {
          ...formData,
          id: selectedArticle.id,
          activo: selectedArticle.activo,
        };
        await helpService.update(updateData);
      } else {
        // Create new article
        await helpService.create(formData);
      }
      navigate('/help');
    } catch (error) {
      console.error('Error saving article:', error);
      alert(isEditMode ? 'Error al actualizar artículo' : 'Error al crear artículo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/help')}
        className="mb-6"
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      {/* Header */}
      <h1 className="text-3xl font-bold mb-6">
        {isEditMode ? 'Editar Artículo' : 'Crear Nuevo Artículo'}
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <div>
          <Label htmlFor="titulo">Título *</Label>
          <Input
            id="titulo"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            required
          />
        </div>

        {/* Resumen */}
        <div>
          <Label htmlFor="resumen">Resumen</Label>
          <Textarea
            id="resumen"
            value={formData.resumen}
            onChange={(e) => setFormData({ ...formData, resumen: e.target.value })}
            rows={2}
          />
        </div>

        {/* Módulo y Tipo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="modulo">Módulo *</Label>
            <Select
              value={formData.modulo}
              onValueChange={(value) => setFormData({ ...formData, modulo: value })}
            >
              <SelectTrigger id="modulo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULOS.map((modulo) => (
                  <SelectItem key={modulo} value={modulo}>
                    {modulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => setFormData({ ...formData, tipo: value })}
            >
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Categoría */}
        <div>
          <Label htmlFor="categoria">Categoría (opcional)</Label>
          <Input
            id="categoria"
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
          />
        </div>

        {/* Orden */}
        <div>
          <Label htmlFor="orden">Orden</Label>
          <Input
            id="orden"
            type="number"
            value={formData.orden}
            onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
          />
        </div>

        {/* Contenido */}
        <div>
          <Label htmlFor="contenido">Contenido (Lexical JSON) *</Label>
          <Textarea
            id="contenido"
            value={formData.contenido}
            onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
            rows={10}
            className="font-mono text-sm"
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
            Temporalmente editor de JSON. En próxima versión: editor visual con Lexical.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : isEditMode ? 'Actualizar Artículo' : 'Crear Artículo'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/help')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
