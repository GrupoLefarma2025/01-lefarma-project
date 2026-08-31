import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SignatureAlertProps {
  configPath?: string;
}

function resolveConfigPath(pathname: string): string {
  if (pathname.startsWith('/cxp')) return '/cxp/perfil/configuracion';
  if (pathname.startsWith('/rh')) return '/rh/perfil/configuracion';
  return '/perfil/configuracion';
}

export function SignatureAlert({ configPath }: SignatureAlertProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const targetPath = configPath ?? resolveConfigPath(pathname);

  return (
    <Alert
      variant="destructive"
      className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/20"
    >
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AlertTitle>No tienes firma digital registrada</AlertTitle>
          <AlertDescription>
            Ve a Configuración {'>'} Perfil para subir tu firma. Sin ella no podrás crear, editar ni
            firmar documentos.
          </AlertDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-600 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          onClick={() => navigate(targetPath)}
        >
          Ir a Configuración
        </Button>
      </div>
    </Alert>
  );
}
