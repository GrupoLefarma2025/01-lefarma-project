import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '@/shared/connection/connectionStore';
import { Button } from '@/components/ui/button';

export function ConnectionLostOverlay() {
  const navigate = useNavigate();
  const { status, retryCount, secondsUntilRetry, retryNow } = useConnectionStore();

  useEffect(() => {
    if (status === 'lost') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [status]);

  if (status !== 'lost') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          No se puede conectar con el servidor
        </h2>
        <p style={{ opacity: 0.8, marginBottom: '1.5rem' }}>
          Estamos reintentando automáticamente. Tu trabajo se guardará cuando vuelva la conexión.
        </p>
        <p style={{ fontSize: '0.875rem', opacity: 0.6, marginBottom: '1rem' }}>
          Reintentando en {secondsUntilRetry}s · Intento #{retryCount + 1}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Button
            onClick={retryNow}
            style={{
              background: 'white',
              color: 'black',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reintentar ahora
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/login')}
            style={{
              borderColor: 'rgba(255,255,255,0.4)',
              color: 'white',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Ir a login
          </Button>
        </div>
      </div>
    </div>
  );
}
