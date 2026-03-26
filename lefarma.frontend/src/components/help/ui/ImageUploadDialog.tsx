import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import { helpService } from '@/services/helpService';
import type { HelpImageUploadResponse } from '@/types/help.types';
import { toast } from 'sonner';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageInserted: (response: HelpImageUploadResponse) => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  onImageInserted,
}: ImageUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        toast.error('Por favor selecciona un archivo de imagen valido');
        return;
      }

      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('El archivo es demasiado grande. Tamano maximo: 5MB');
        return;
      }

      setFile(selectedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Por favor selecciona una imagen');
      return;
    }

    try {
      setUploading(true);
      const response = await helpService.uploadImage(file);
      toast.success('Imagen subida exitosamente');
      onImageInserted(response);
      handleClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Error al subir la imagen';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Subir Imagen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div className="flex flex-col gap-2">
            <Input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Formatos permitidos: JPG, PNG, GIF, WebP. Tamano maximo: 5MB
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="relative rounded-md border overflow-hidden">
              <img
                src={preview}
                alt="Vista previa"
                className="w-full h-auto max-h-64 object-contain bg-muted"
              />
              {file && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}

          {/* Placeholder when no image */}
          {!preview && (
            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-md bg-muted/50">
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Selecciona una imagen para subir
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Subir Imagen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
