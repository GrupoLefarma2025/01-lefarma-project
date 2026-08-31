import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/shared/auth/authStore';
import { API } from '@/shared/api/apiClient';
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
import { Phone, Bell, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { FirmaUploadCard } from '@/components/common/FirmaUploadCard';

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
  const { user, fetchProfileSignature } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

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

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<Usuario>>('/profile');
      if (response.data.success && response.data.data) {
        const u = response.data.data;
        setUsuario(u);

        form.reset({
          nombreCompleto: u.nombreCompleto || '',
          correo: u.correo || '',
          firmaPath: u.detalle?.firmaPath ?? null,
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

      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar el perfil');
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
        await fetchPerfil();
        form.reset(values, { keepValues: true });
      } else {
        toast.error(response.data.message ?? 'Error al guardar el perfil');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      const errs: Array<{ description: string }> = err.errors ?? [];
      if (errs.length > 0) {
        errs.forEach((e) => toast.error(err.message, { description: e.description }));
      } else {
        toast.error(err.message ?? 'Error al guardar el perfil');
      }
    } finally {
      setIsSaving(false);
    }
  };

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
        <FirmaUploadCard />

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
        <div className="flex justify-end">
          <Button type="submit" disabled={!form.formState.isDirty || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>

      </form>
    </Form>
  );
}
