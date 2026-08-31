import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authService } from '@/shared/auth/authService';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * Landing SSO headless. Lee ?token=<handoff>&page=<ruta> de la URL,
 * intercambia el token de handoff de un solo uso por una sesión y redirige.
 * URL: /handoff-login?token=XXX&page=/ordenes/autorizaciones
 */
export default function HandoffLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  // El token de handoff es de un solo uso. React StrictMode monta los efectos dos
  // veces en desarrollo, lo que consumiría el token dos veces (la segunda llamada
  // falla). Esto lo protege.
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
        useAuthStore.getState().initialize(); // inicia sesión desde los tokens almacenados
        // Sin página -> seleccionar empresa/sucursal (front2 no tiene ninguno, dominio distinto = diferente localStorage)
        navigate(page || '/select-empresa', { replace: true });
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
