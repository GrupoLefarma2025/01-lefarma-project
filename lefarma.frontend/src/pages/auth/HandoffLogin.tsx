import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authService } from '@/shared/auth/authService';
import { useAuthStore } from '@/shared/auth/authStore';

export default function HandoffLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = params.get('token');
    const page = params.get('page');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        await authService.exchangeHandoff(token);
        useAuthStore.getState().initialize(); 
        navigate(page || '/cxp/select-empresa', { replace: true });
      } catch {
        setError('El enlace de acceso es invalido o expiro. Inicia sesion normalmente.');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    })();
  }, [params, navigate]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{error || 'Iniciando sesion...'}</p>
    </div>
  );
}
