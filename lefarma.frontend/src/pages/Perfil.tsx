import { useAuthStore } from '@/store/authStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Building2, MapPin } from 'lucide-react';

export default function Perfil() {
  usePageTitle('Mi Perfil', 'Información de tu cuenta');
  const { user, empresa, sucursal } = useAuthStore();

  return (
    <div className="space-y-6 max-w-4xl">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información Personal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
            <CardDescription>Datos de tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={user?.nombre || ''} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario</label>
              <Input value={user?.username || ''} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <Input value={user?.correo || ''} disabled />
            </div>
          </CardContent>
        </Card>

        {/* Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ubicación Actual
            </CardTitle>
            <CardDescription>Empresa y sucursal seleccionadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa
              </label>
              <Input value={empresa?.nombre || 'No seleccionada'} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Sucursal
              </label>
              <Input value={sucursal?.nombre || 'No seleccionada'} disabled />
            </div>
            <Button variant="outline" className="w-full">
              Cambiar Ubicación
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
