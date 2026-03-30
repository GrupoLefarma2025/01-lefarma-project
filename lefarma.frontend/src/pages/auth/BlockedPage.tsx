import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';

export default function BlockedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-amber-100 p-6 rounded-full">
            <ShieldAlert className="h-20 w-20 text-amber-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Acceso Denegado</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            No tenés permisos para acceder a esta pantalla.
          </p>
          <p className="text-sm text-muted-foreground">
            Contactá a tu administrador si creés que esto es un error.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver Atrás
          </Button>
          <Button onClick={() => navigate('/dashboard')} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Ir al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
