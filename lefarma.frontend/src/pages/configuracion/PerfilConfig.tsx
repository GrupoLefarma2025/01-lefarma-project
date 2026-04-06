import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/store/authStore';
import { API } from '@/services/api';
import { archivoService } from '@/services/archivoService';
import { ApiResponse } from '@/types/api.types';
import { Usuario } from '@/types/usuario.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { User, Mail, Phone, Bell, Loader2, Smartphone, PenLine, Upload, Trash2, ImagePlus, X, Crop, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageCrop, ImageCropContent, ImageCropApply, ImageCropReset } from '@/components/kibo-ui/image-crop';

import type { ChangeEvent } from 'react';

const MAX_FIRMA_SIZE = 2 * 1024 * 1024;

const perfilSchema = z.object({
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  correo: z.string().email('Email inválido').optional().or(z.literal('')),
  firmaPath: z.string().optional().nullable(),
  detalle: z.object({
    celular: z.string().optional().nullable(),
    telefonoOficina: z.string().optional().nullable(),
    extension: z.string().optional().nullable(),
    telegramChat: z.string().optional().nullable(),
    notificarEmail: z.boolean(),
    notificarApp: z.boolean(),
    notificarWhatsapp: z.boolean(),
    notificarSms: z.boolean(),
    notificarTelegram: z.boolean(),
    notificarSoloUrgentes: z.boolean(),
    notificarResumenDiario: z.boolean(),
    notificarRechazos: z.boolean(),
    notificarVencimientos: z.boolean(),
  }),
});

type PerfilFormValues = z.infer<typeof perfilSchema>;

export function PerfilConfig() {
  usePageTitle('Mi Perfil', 'Configuración de tu perfil y notificaciones');
  const { user, hasFirma, fetchProfileSignature } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [firmaPreviewUrl, setFirmaPreviewUrl] = useState<string | null>(null);
  const [isUploadingFirma, setIsUploadingFirma] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PerfilFormValues>({
    resolver: zodResolver(perfilSchema),
  defaultValues: {
      nombreCompleto: '',
      correo: '',
      firmaPath: null,
      detalle: {
        celular: '',
        telefonoOficina: '',
        extension: '',
        telegramChat: '',
        notificarEmail: true,
        notificarApp: true,
        notificarWhatsapp: false,
        notificarSms: false,
        notificarTelegram: false,
        notificarSoloUrgentes: false,
        notificarResumenDiario: true,
        notificarRechazos: true,
        notificarVencimientos: true,
      },
    },
  });

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

  const handleCropComplete = async (croppedImageUrl: string) => {
    if (!usuario || !selectedFile) return;

    setCroppedImage(croppedImageUrl);
    setCropDialogOpen(false);
    setIsUploadingFirma(true);

    try {
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const croppedFile = new File([blob], selectedFile.name, {
        type: 'image/png',
        lastModified: Date.now(),
      });

      const formData = new FormData();
      formData.append('file', croppedFile);

      const apiResponse = await API.post('/profile/firma', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (apiResponse.data.success) {
        toast.success('Firma subida exitosamente');
        await fetchPerfil();
        await fetchProfileSignature();
      } else {
        toast.error(apiResponse.data.message ?? 'Error al guardar la firma');
      }
    } catch (error: any) {
      console.error('Error completo:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Error al subir firma';
      toast.error('Error al subir firma', { 
        description: errorMessage 
      });
    } finally {
      setIsUploadingFirma(false);
      setSelectedFile(null);
      setCroppedImage(null);
    }
  };

  const handleRemoveFirma = async () => {
    setIsUploadingFirma(true);
    try {
      const response = await API.delete('/profile/firma');
      if (response.data.success) {
        toast.success('Firma eliminada');
        await fetchPerfil();
        await fetchProfileSignature();
      } else {
        toast.error(response.data.message ?? 'Error al eliminar firma');
      }
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Error al eliminar firma';
      toast.error('Error al eliminar firma', { description: errorMessage });
    } finally {
      setIsUploadingFirma(false);
    }
  };

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Usuario>>('/profile');
      if (response.data.success && response.data.data) {
        const u = response.data.data;
        setUsuario(u);
        const firmaPathValue = (u.detalle as any)?.firmaPath ?? null;
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const firmaUrl = firmaPathValue
          ? `${apiUrl}/media/archivos/${firmaPathValue}`
          : null;

        setFirmaPreviewUrl(firmaUrl);

        form.reset({
          nombreCompleto: u.nombreCompleto || '',
          correo: u.correo || '',
          firmaPath: firmaPathValue,
          detalle: {
            celular: u.detalle?.celular || '',
            telefonoOficina: u.detalle?.telefonoOficina || '',
            extension: u.detalle?.extension || '',
            telegramChat: u.detalle?.telegramChat || '',
            notificarEmail: u.detalle?.notificarEmail ?? true,
            notificarApp: u.detalle?.notificarApp ?? true,
            notificarWhatsapp: u.detalle?.notificarWhatsapp ?? false,
            notificarSms: u.detalle?.notificarSms ?? false,
            notificarTelegram: u.detalle?.notificarTelegram ?? false,
            notificarSoloUrgentes: u.detalle?.notificarSoloUrgentes ?? false,
            notificarResumenDiario: u.detalle?.notificarResumenDiario ?? true,
            notificarRechazos: u.detalle?.notificarRechazos ?? true,
            notificarVencimientos: u.detalle?.notificarVencimientos ?? true,
          },
        });
        setFirmaPreviewUrl(firmaUrl);

      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerfil();
    fetchProfileSignature();
  }, []);

  const handleSave = async (values: PerfilFormValues) => {
    if (!usuario) return;
    setIsSaving(true);
    try {
      const payload = {
        nombreCompleto: values.nombreCompleto,
        correo: values.correo,
        firmaPath: values.firmaPath,
        ...(usuario.detalle && {
          detalle: {
            ...usuario.detalle,
            ...values.detalle,
            idEmpresa: usuario.detalle.idEmpresa,
            idSucursal: usuario.detalle.idSucursal,
          },
        }),
      };
      const response = await API.put('/profile', payload);
      if (response.data.success) {
        toast.success('Perfil actualizado correctamente.');
        fetchPerfil();
      } else {
        toast.error(response.data.message ?? 'Error al guardar el perfil');
      }
    } catch (error: any) {
      const errs: Array<{ description: string }> = error?.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(error.message, { description: e.description }));
      } else {
        toast.error(error?.message ?? 'Error al guardar el perfil');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentFirmaPreview = firmaPreviewUrl;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">

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
                <div className="relative flex justify-center rounded-lg border bg-muted/30 p-4">
                  <img
                    src={currentFirmaPreview!}
                    alt="Firma digital"
                    className="max-h-32 max-w-full object-contain"
                  />
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Reemplazar firma
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-8 transition-colors hover:border-primary/50 hover:bg-muted/20"
              >
                <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Arrastra tu firma aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground/70">
                  PNG, JPG o SVG — máximo 2 MB
                </p>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contacto
            </CardTitle>
            <CardDescription>Datos de contacto y canales de comunicación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="detalle.celular"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Celular / WhatsApp
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+52..." {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="detalle.telefonoOficina"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Teléfono Oficina
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="detalle.extension"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Extensión</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="detalle.telegramChat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram Chat ID</FormLabel>
                    <FormControl>
                      <Input placeholder="ID numérico" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription>Para alertas vía bot de Telegram.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>Configura cómo y cuándo deseas recibir alertas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Canales Activos</p>
                {[
                  { name: 'detalle.notificarEmail' as const, label: 'Correo Electrónico' },
                  { name: 'detalle.notificarApp' as const, label: 'Notificaciones App' },
                  { name: 'detalle.notificarWhatsapp' as const, label: 'WhatsApp' },
                  { name: 'detalle.notificarSms' as const, label: 'SMS' },
                  { name: 'detalle.notificarTelegram' as const, label: 'Telegram' },
                ].map(({ name, label }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Tipos de Alerta</p>
                {[
                  { name: 'detalle.notificarRechazos' as const, label: 'Avisar sobre Rechazos' },
                  { name: 'detalle.notificarVencimientos' as const, label: 'Alertas de Vencimiento' },
                  { name: 'detalle.notificarResumenDiario' as const, label: 'Resumen Diario (8 AM)' },
                  { name: 'detalle.notificarSoloUrgentes' as const, label: 'Solo Urgentes' },
                ].map(({ name, label }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botón guardar */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>

      </form>

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
                        Aplicar y Guardar
                      </Button>
                    </ImageCropApply>
                  </div>
                </div>
              </ImageCrop>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
