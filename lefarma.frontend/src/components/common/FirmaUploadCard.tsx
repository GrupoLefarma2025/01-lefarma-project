import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import { Usuario } from '@/types/usuario.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PenLine, Upload, ImagePlus, Crop, RotateCcwIcon, Lock, Info, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageCrop, ImageCropContent, ImageCropApply, ImageCropReset } from '@/components/kibo-ui/image-crop';
import { SignaturePadDialog } from '@/components/common/SignaturePadDialog';

import type { ChangeEvent } from 'react';
import { toApiError } from '@/utils/errors';

const MAX_FIRMA_SIZE = 2 * 1024 * 1024;

export function FirmaUploadCard() {
  const { hasFirma, fetchProfileSignature } = useAuthStore();
  const [firmaPreviewUrl, setFirmaPreviewUrl] = useState<string | null>(null);
  const [isUploadingFirma, setIsUploadingFirma] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [padDialogOpen, setPadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firmaSubidas, setFirmaSubidas] = useState(0);
  const [firmaCambioHabilitado, setFirmaCambioHabilitado] = useState(false);
  const [firmaCambioSolicitado, setFirmaCambioSolicitado] = useState(false);
  const [fechaSolicitudCambio, setFechaSolicitudCambio] = useState<string | null>(null);
  const [isSolicitando, setIsSolicitando] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFirmaFile, setPendingFirmaFile] = useState<File | null>(null);
  const [pendingFirmaUrl, setPendingFirmaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFirmaPreview = async () => {
    try {
      const response = await API.get<ApiResponse<Usuario>>('/profile');
      if (response.data.success && response.data.data) {
        const detalle = response.data.data.detalle;
        const firmaPath = detalle?.firmaPath ?? null;
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        setFirmaPreviewUrl(firmaPath ? `${apiUrl}/media/archivos/${firmaPath}` : null);
        setFirmaSubidas(detalle?.firmaSubidas ?? 0);
        setFirmaCambioHabilitado(detalle?.firmaCambioHabilitado ?? false);
        setFirmaCambioSolicitado(detalle?.firmaCambioSolicitado ?? false);
        setFechaSolicitudCambio(detalle?.fechaSolicitudCambioFirma ?? null);
      }
    } catch {
      // Silent: the page must render even if the profile fetch fails
    }
  };

  useEffect(() => {
    fetchFirmaPreview();
  }, []);

  // Liberar el object URL de la firma pendiente al desmontar (evitar fugas).
  useEffect(() => {
    return () => {
      if (pendingFirmaUrl) URL.revokeObjectURL(pendingFirmaUrl);
    };
  }, [pendingFirmaUrl]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast.error('Formato no válido. Use PNG, JPG o SVG.');
      return;
    }

    if (file.size > MAX_FIRMA_SIZE) {
      toast.error('La imagen no puede superar 2 MB.');
      return;
    }

    // Abrir dialog de cropper
    setSelectedFile(file);
    setCropDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFirma = async (file: File): Promise<boolean> => {
    setIsUploadingFirma(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const apiResponse = await API.post('/profile/firma', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (apiResponse.data.success) {
        toast.success('Firma subida exitosamente');
        await fetchFirmaPreview();
        await fetchProfileSignature();
        return true;
      }

      toast.error(apiResponse.data.message ?? 'Error al guardar la firma');
      return false;
    } catch (error: unknown) {
      const err = toApiError(error);
      const errorMessage = err.message || 'Error al subir firma';
      toast.error('Error al subir firma', {
        description: errorMessage
      });
      return false;
    } finally {
      setIsUploadingFirma(false);
    }
  };

  // Paso de doble validación: tras el recorte o el dibujo, la firma queda pendiente
  // y se muestra en el dialog de confirmación antes de guardarla.
  const prepararConfirmacion = (file: File) => {
    if (pendingFirmaUrl) URL.revokeObjectURL(pendingFirmaUrl);
    setPendingFirmaFile(file);
    setPendingFirmaUrl(URL.createObjectURL(file));
    setConfirmDialogOpen(true);
  };

  const descartarPendiente = () => {
    if (pendingFirmaUrl) URL.revokeObjectURL(pendingFirmaUrl);
    setPendingFirmaFile(null);
    setPendingFirmaUrl(null);
  };

  // Volver (o X/Esc): cierra solo el confirm; el recorte/pad queda abierto con lo editado.
  const handleConfirmOpenChange = (open: boolean) => {
    setConfirmDialogOpen(open);
    if (!open) descartarPendiente();
  };

  const handleConfirmarEnvio = async () => {
    if (!pendingFirmaFile) return;

    const ok = await uploadFirma(pendingFirmaFile);
    if (!ok) return; // El dialog queda abierto para reintentar.

    setConfirmDialogOpen(false);
    setCropDialogOpen(false);
    setPadDialogOpen(false);
    setSelectedFile(null);
    descartarPendiente();
  };

  const handleCropComplete = async (croppedImageUrl: string) => {
    if (!selectedFile) return;

    // No cerrar el recorte: al "Volver" del confirm el usuario sigue editándolo.
    const response = await fetch(croppedImageUrl);
    const blob = await response.blob();
    const croppedFile = new File([blob], selectedFile.name, {
      type: 'image/png',
      lastModified: Date.now(),
    });

    prepararConfirmacion(croppedFile);
  };

  // Regla: solo la subida inicial es libre. Una vez registrada (firmaSubidas >= 1),
  // cualquier reemplazo requiere que RH haya habilitado el cambio (un solo uso).
  const firmaBloqueada = hasFirma && firmaSubidas >= 1 && !firmaCambioHabilitado;
  const firmaHabilitadaRh = hasFirma && firmaCambioHabilitado;

  const handleSolicitarCambio = async () => {
    setIsSolicitando(true);
    try {
      const response = await API.post<ApiResponse<boolean>>('/profile/firma/solicitud-cambio');
      if (response.data.success) {
        toast.success('Solicitud enviada a Recursos Humanos');
        await fetchFirmaPreview();
      } else {
        toast.error(response.data.message ?? 'No se pudo enviar la solicitud');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al enviar la solicitud');
    } finally {
      setIsSolicitando(false);
    }
  };

  return (
    <>
      {/* Firma Digital */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Firma Digital
          </CardTitle>
          <CardDescription>Tu firma digital para autorizar documentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={handleFileSelect}
          />

          {isUploadingFirma ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="ml-2 text-sm text-muted-foreground">Subiendo firma...</p>
            </div>
          ) : hasFirma ? (
            <div className="space-y-3">
              {firmaPreviewUrl && (
                <div className="relative flex justify-center rounded-lg border bg-muted/30 p-4">
                  <img
                    src={`${firmaPreviewUrl}?t=${Date.now()}`}
                    alt="Firma digital"
                    className="max-h-32 max-w-full object-contain"
                  />
                </div>
              )}

              {firmaBloqueada ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Tu firma ya fue registrada. Para cambiarla, un usuario de
                      Recursos Humanos debe habilitar la opción.
                    </p>
                  </div>
                  {firmaCambioSolicitado ? (
                    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Ya enviaste una solicitud a Recursos Humanos
                        {fechaSolicitudCambio
                          ? ` el ${new Date(fechaSolicitudCambio).toLocaleString()}`
                          : ''}
                        . Te avisaremos cuando habiliten el cambio.
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSolicitando}
                        onClick={handleSolicitarCambio}
                      >
                        {isSolicitando ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Solicitar cambio a RH
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {firmaHabilitadaRh && (
                    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Recursos Humanos habilitó un cambio de firma. Es de un
                        solo uso y se consumirá al guardar.
                      </p>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setChoiceDialogOpen(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Reemplazar firma
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChoiceDialogOpen(true)}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-8 transition-colors hover:border-primary/50 hover:bg-muted/20"
            >
              <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Arrastra tu firma aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground/70">
                Sube una imagen o dibuja tu firma
              </p>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Dialog de elección: subir imagen o dibujar firma */}
      <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Agregar firma digital
            </DialogTitle>
            <DialogDescription>Elige cómo quieres registrar tu firma</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto items-start justify-start py-3"
              onClick={() => {
                setChoiceDialogOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <ImagePlus className="mr-3 h-5 w-5 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">Subir imagen</span>
                <span className="text-xs text-muted-foreground">PNG, JPG o SVG — máximo 2 MB</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto items-start justify-start py-3"
              onClick={() => {
                setChoiceDialogOpen(false);
                setPadDialogOpen(true);
              }}
            >
              <PenLine className="mr-3 h-5 w-5 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">Dibujar firma</span>
                <span className="text-xs text-muted-foreground">Con el mouse o tu dedo</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Signature Pad */}
      <SignaturePadDialog
        open={padDialogOpen}
        onOpenChange={setPadDialogOpen}
        isSaving={isUploadingFirma}
        onSave={(file) => prepararConfirmacion(file)}
      />

      {/* Dialog de confirmación final: doble validación con vista previa antes de guardar */}
      <Dialog open={confirmDialogOpen} onOpenChange={handleConfirmOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Confirma tu firma
            </DialogTitle>
            <DialogDescription>¿Estás seguro de tu firma? Así quedará registrada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFirmaUrl && (
              <div className="flex justify-center rounded-lg border bg-white p-4">
                <img
                  src={pendingFirmaUrl}
                  alt="Vista previa de la firma"
                  className="max-h-40 max-w-full object-contain"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {firmaSubidas === 0
                ? 'Solo puedes registrar tu firma libremente una vez. Cambios posteriores requieren autorización de Recursos Humanos.'
                : firmaCambioHabilitado
                  ? 'Este cambio fue habilitado por Recursos Humanos, es de un solo uso y se consumirá al guardar.'
                  : 'Verifica que tu firma sea legible y correcta antes de guardar.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingFirma}
                onClick={() => handleConfirmOpenChange(false)}
              >
                Volver
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isUploadingFirma || !pendingFirmaFile}
                onClick={handleConfirmarEnvio}
              >
                {isUploadingFirma ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Sí, guardar firma
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cropper para Firma */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Recortar Firma Digital
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ajusta tu firma dentro del área de recorte. Puedes mover y redimensionar la selección.
            </p>
            {selectedFile && (
              <ImageCrop
                file={selectedFile}
                aspect={16 / 9}
                onCrop={handleCropComplete}
              >
                <div className="space-y-4">
                  <div className="flex justify-center rounded-lg border bg-muted/50 p-4">
                    <ImageCropContent className="max-h-[300px] w-full" />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <ImageCropReset asChild>
                      <Button variant="outline" size="sm">
                        <RotateCcwIcon className="mr-2 h-4 w-4" />
                        Reiniciar
                      </Button>
                    </ImageCropReset>
                    <ImageCropApply asChild>
                      <Button variant="default" size="sm">
                        <Crop className="mr-2 h-4 w-4" />
                        Aplicar y continuar
                      </Button>
                    </ImageCropApply>
                  </div>
                </div>
              </ImageCrop>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
